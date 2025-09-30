-- Add AWS S3 fields to generated_images table
ALTER TABLE "generated_images" ADD COLUMN "awsS3Key" TEXT;
ALTER TABLE "generated_images" ADD COLUMN "awsS3Url" TEXT;

-- Add index for AWS S3 key for better query performance
CREATE INDEX "generated_images_awsS3Key_idx" ON "generated_images"("awsS3Key");