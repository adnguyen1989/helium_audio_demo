class StaticPagesController < ApplicationController
  before_action :set_s3_direct_post, only: [:home]

  def home
  end

  private
    def set_s3_direct_post
      @s3post = AWS_S3_BUCKET.presigned_post(key: "uploads/audios/sentence_audio_#{SecureRandom.uuid}_${filename}", acl: 'public-read', content_type: 'audio/mpeg')
      # byebug
    end
end
