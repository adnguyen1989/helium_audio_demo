DOES NOT WORK IN SAFARI /IE UNTIL GETUSERMEDIA IS MADE AVAILABLE

Demo
===

mighty-beyond-32627.herokuapp.com

AWS setup
===

1. Follow this link to setup an account and bucket: http://docs.aws.amazon.com/AmazonS3/latest/gsg/SigningUpforS3.html
2. Create an access key and secret: http://docs.aws.amazon.com/general/latest/gr/managing-aws-access-keys.html
3. Note the bucket name and region name (NOTE: Tokyo is a REGION. We need REGION NAME, which is ap-northeast-1). Find region name here: http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
4. Under Permissions -> CORS, paste the following:

    ```
    <?xml version="1.0" encoding="UTF-8"?>
    <CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
        <CORSRule>
            <AllowedOrigin>*</AllowedOrigin>
            <AllowedMethod>HEAD</AllowedMethod>
            <AllowedMethod>GET</AllowedMethod>
            <AllowedMethod>PUT</AllowedMethod>
            <AllowedMethod>POST</AllowedMethod>
            <AllowedMethod>DELETE</AllowedMethod>
            <ExposeHeader>ETag</ExposeHeader>
            <ExposeHeader>Location</ExposeHeader>
            <ExposeHeader>x-amz-meta-custom-header</ExposeHeader>
            <AllowedHeader>*</AllowedHeader>
            <AllowedHeader>Location</AllowedHeader>
        </CORSRule>
    </CORSConfiguration>
    ```

Rails setup
===

1. Add gem 'aws-sdk', '~> 2' to Gemfile
2. Add this line to assets.rb to enable precompilation of RecorderDemo.js

    ```
    Rails.application.config.assets.precompile += %w( RecorderDemo.js )
    ```

3. Add this line to development.rb and production.rb to enable serving of assets in the public folder

    ```
    config.public_file_server.enabled = true
    ```

4. Add the following configuration to application.yml (Figaro) for AWS

    ```
    AWS_REGION: ap-northeast-1
    AWS_S3_BUCKET: testaudiodemo
    AWS_ACCESS_KEY_ID: AKIAJIICJFKAHTSN7HXA
    AWS_SECRET_ACCESS_KEY: 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
    ```

5. Create config/initializers/aws.rb and add the following code

    ```
    require 'aws-sdk'

    Aws.config.update({
      region: ENV['AWS_REGION'],
      credentials: Aws::Credentials.new(ENV['AWS_ACCESS_KEY_ID'], ENV['AWS_SECRET_ACCESS_KEY']),
    })

    AWS_S3_BUCKET = Aws::S3::Resource.new.bucket(ENV['AWS_S3_BUCKET'])
    ```

JS setup
====

We use https://github.com/higuma/web-audio-recorder-js to record audio in the web browser.

It contains:

1. WebAudioRecorder.min.js and WebAudioRecorderMp3.min.js, which should be placed in public/assets. There is no need to declare WebAudioRecorderMp3.min.js directly in HTML since WebAudioRecord.min.js will auto-load it as long as they are in the same directory.
2. Mp3LameEncoder.min.js.mem must be in same directory level as the HTML that includes the other javascript files. Place it in both public and public/assets for local testing (Firefox and Chrome load files differently in local)
3. RecorderDemo.js, the application-specific JS, should be in app/assets/javascripts. This should be the last in the javascript declaration

    ```
    <script src="/assets/WebAudioRecorder.min.js"></script>
    <%= javascript_include_tag "RecorderDemo" %>
    ```

4. RecoderDemo.js contains all of the custom code for our application. High level flow is this
    1. When microphone button is clicked, enable microphone input permission prompt
    2. Initialize the audioRecorder object with directory of workers (WebAudioRecorderMp3.min.js) and encoding type (Mp3)
    3. When record button is clicked, set options of the audioRecorder
        1. timeLimit: maximum length of audio in seconds
        2. encodeAfterRecord: encode to MP3 during (false) or after completion (true)
        3. progressInterval: only applicable if #2 is true. set how quickly the progress bar updates
        4. bufferSize: use browser's default or 1024
        5. birate: the bitrate of MP3. If set at 160, one minute = 1 MB

How it works
===

1. Static_pages_controller generates a AWS presigned-post for the "home" action. A presigned-post is essentially a way to generate credentials for end-users to post to AWS without having to create their own credentials. Reference: https://devcenter.heroku.com/articles/direct-to-s3-image-uploads-in-rails#pre-signed-post
2. The "home" action view is located at home.html.erb
3. The RecorderDemo.js file carries out the recording and saving to a browser stream
4. The @s3post instance variable is passed to the view using a hidden form. It includes all necessary information to send to AWS.
5. After recording is completed, the callAWS method is fired when "Upload" button is clicked.
    1. It selects the hidden form that contains the @s3post instance variable in #4
    2. It turns that form into a FormData object
    3. It appears the actual file (myBlob) to the FormData object, giving it the name "sentence_audio.mp3"
    4. It creates a XMLHttpRequest to the destination referenced by the form in #4, using the FormData object in #3
    5. If successful, it gets the location of the uploaded file (aws_url = xhr.getResponseHeader("Location"))
