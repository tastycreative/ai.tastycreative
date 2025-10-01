-- Add AWS S3 fields to generated_videos table
ALTER TABLE "generated_videos" ADD COLUMN "awsS3Key" TEXT;
ALTER TABLE "generated_videos" ADD COLUMN "awsS3Url" TEXT;

-- Add index for AWS S3 key for better query performance
CREATE INDEX "generated_videos_awsS3Key_idx" ON "generated_videos"("awsS3Key");