// manually rewritten from CoffeeScript output
// (see dev-coffee branch for original source)

// navigator.getUserMedia shim
navigator.getUserMedia =
  navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.msGetUserMedia ||
  navigator.mediaDevices.getUserMedia;

// URL shim
window.URL = window.URL || window.webkitURL;

// audio context + .createScriptProcessor shim
var audioContext = new (window.AudioContext || window.webkitAudioContext)
if (audioContext.createScriptProcessor == null)
  audioContext.createScriptProcessor = audioContext.createJavaScriptNode;

// elements (jQuery objects)
var $microphone = $('#microphone'),
    $microphoneLevel = $('#microphone-level'),
    $recordarea = $('#record-area')
    $recording = $('#recording'),
    $timeDisplay = $('#time-display'),
    $record = $('#record'),
    $cancel = $('#cancel'),
    $recordingList = $('#recording-list')
    $modalLoading = $('#modal-loading'),
    $modalProgress = $('#modal-progress'),
    $blobID = 0,
    $modalError = $('#modal-error');

    $microphoneLevel.attr('disabled', false);
var
    microphone = undefined,     // obtained by user click
    microphoneLevel = audioContext.createGain(),
    mixer = audioContext.createGain();

    microphoneLevel.gain.value = 0;
    microphoneLevel.connect(mixer);
    // mixer.connect(audioContext.destination);

 defaultBufSz = (function() {
    var processor;
    processor = audioContext.createScriptProcessor(void 0, 2, 2);
    return processor.bufferSize;
  })();

// audio recorder object
var audioRecorder = new WebAudioRecorder(mixer, {
  workerDir: 'assets/',
  encoding: "mp3",
  onEncoderLoading: function(recorder, encoding) {
    $modalLoading
      .find('.modal-title')
      .html("Loading " + encoding.toUpperCase() + " encoder ...");
    $modalLoading.modal('show');
  },
  onEncoderLoaded: function() { $modalLoading.modal('hide'); }
});

// obtaining microphone input
$microphone.click(function() {
  if (microphone == null)
    navigator.getUserMedia({ audio: true },
      function(stream) {
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(microphoneLevel);
        $microphone.addClass('hidden');
        $microphoneLevel.removeClass('hidden');
        $recordarea.removeClass('hidden');
      },
      function(error) {
        alert("You must enable your microphone");
        audioRecorder.onError(audioRecorder, "Could not get audio input.");
      });
});

// time indicator
function minSecStr(n) { return (n < 10 ? "0" : "") + n; };

function updateDateTime() {
  var sec = audioRecorder.recordingTime() | 0;
  $timeDisplay.html(minSecStr(sec / 60 | 0) + ":" + minSecStr(sec % 60));
};

window.setInterval(updateDateTime, 200);


// encoding progress report modal
var progressComplete = false;

function setProgress(progress) {
  var percent = (progress * 100).toFixed(1) + "%";
  $modalProgress
    .find('.progress-bar')
    .attr('style', "width: " + percent + ";");
  $modalProgress
    .find('.text-center')
    .html(percent);
  progressComplete = progress === 1;
};

$modalProgress.on("hide.bs.modal", function() {
  if (!progressComplete)
    audioRecorder.cancelEncoding();
});

// record | stop | cancel buttons
function disableControlsOnRecord(disabled) {
  if (microphone == null)
    $microphone.attr('disabled', disabled);
};

function startRecording() {
  var level = $microphoneLevel.val() / 100;
  microphoneLevel.gain.value = level * level;
  $recording.removeClass('hidden');
  $record.html('STOP');
  $cancel.removeClass('hidden');
  disableControlsOnRecord(true);
  audioRecorder.setOptions({
    timeLimit: 1200,
    encodeAfterRecord: false,
    progressInterval: 1000,
    bufferSize: 1024,
    mp3: { bitRate: 160 }
  });
  audioRecorder.startRecording();
};

function stopRecording(finish) {
  $recording.addClass('hidden');
  $record.html('RECORD');
  $cancel.addClass('hidden');
  disableControlsOnRecord(false);
  if (finish) {
    if (audioRecorder.options.encodeAfterRecord) {
      $modalProgress
        .find('.modal-title')
        .html("Encoding " + audioRecorder.encoding.toUpperCase());
      $modalProgress.modal('show');
    }
    audioRecorder.finishRecording();
  } else
    audioRecorder.cancelRecording();
};

$record.click(function() {
  if (audioRecorder.isRecording())
    stopRecording(true);
  else
    startRecording();
});

$cancel.click(function() { stopRecording(false); });

// event handlers
audioRecorder.onTimeout = function(recorder) {
  stopRecording(true);
};

audioRecorder.onEncodingProgress = function(recorder, progress) {
  setProgress(progress);
};

audioRecorder.onComplete = function(recorder, blob) {
  if (recorder.options.encodeAfterRecord)
    $modalProgress.modal('hide');
  saveRecording(blob, recorder.encoding);
};

audioRecorder.onError = function(recorder, message) {
  $modalError
    .find('.alert')
    .html(message);
  $modalError.modal('show');
};

// ==== APPLICATION CODE STARTS HERE
// save/delete recording
function saveRecording(blob, encoding) {
  $blobID = $blobID + 1
  var time = new Date(),
      url = URL.createObjectURL(blob),
      html = "<p id='recording-no-" + $blobID + "' recording='" + url + "'>" +
             "<audio controls src='" + url + "'></audio> " +
             " (" + encoding.toUpperCase() + ") " +
             time +
             " <a class='btn btn-default' href='" + url +
             "' download='recording." +
             encoding +
             "'>Save...</a> " +
             "<button class='btn btn-danger delete-button' id='delete-blob" + $blobID + "'recording='" +
             url +
             "'>Delete</button> " +
             "<button class='btn upload-button' id='upload-blob" + $blobID + "' recording='" +
             url +
             "'>Upload</button>" +
             "</p>";
  $recordingList.prepend($(html));
  $("#upload-blob"+$blobID).click(function(event){
    uploadRecording(event);
  })

  $("#delete-blob"+$blobID).click(function(event){
    deleteRecording(event)
  })
}



function deleteRecording(event){
  var url = $(event.target).attr('recording');
      $("p[recording='" + url + "']").remove();
      URL.revokeObjectURL(url);
}

function uploadRecording(event){
  var url = $(event.target).attr('recording');
  var xhr = new XMLHttpRequest();
  var myBlob;
  xhr.open('GET', url, true);
  xhr.setRequestHeader("Content-type",  "application/x-www-form-urlencoded");
  xhr.responseType = 'blob';
  xhr.onload = function(e) {
    if (this.status == 200) {
          myBlob = xhr.response;
          callAWS(myBlob);
    }
    else
      {
        alert("cannot get audio blob");
      }
  };
  xhr.send();
}

function callAWS(myBlob){

  var myForm = document.querySelector('form');
  formData = new FormData(myForm);
  presignedURL = $('#upload-form').attr('action');

  formData.append('file', myBlob, "sentence_audio.mp3")
  // console.log(myBlob);
  // console.log(presignedURL);
  // console.log(formData);
  // console.info("Old Form", formData.getAll("file"));
  //   for(var pair of formData.entries()) {
  //     console.log(pair[0]+ ', '+ pair[1]);
  // }

  var xhr = new XMLHttpRequest();
  xhr.open('POST', presignedURL, true);
  xhr.onerror = function (e) {
      alert("error");
    };

    xhr.upload.addEventListener('progress', function (e) {
      console.log(e.loaded / e.total)
    }, false);

    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          if (xhr.status >= 200 && xhr.status <= 299) {
            alert("completed");
            aws_url = xhr.getResponseHeader("Location")
            alert(aws_url)
          } else {
            alert(xhr.responseText);
          }
        }
    };
  xhr.send(formData);
}
