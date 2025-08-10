/*
  Warnings:

  - A unique constraint covering the columns `[jobId,filename,subfolder,type]` on the table `generated_images` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."GenerationType" AS ENUM ('TEXT_TO_IMAGE', 'IMAGE_TO_VIDEO', 'IMAGE_TO_IMAGE', 'TEXT_TO_VIDEO', 'VIDEO_TO_VIDEO');

-- AlterTable
ALTER TABLE "public"."generation_jobs" ADD COLUMN     "type" "public"."GenerationType" NOT NULL DEFAULT 'TEXT_TO_IMAGE';

-- CreateTable
CREATE TABLE "public"."generated_videos" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "subfolder" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'output',
    "fileSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "duration" DOUBLE PRECISION,
    "fps" DOUBLE PRECISION,
    "format" TEXT,
    "data" BYTEA,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generated_videos_clerkId_idx" ON "public"."generated_videos"("clerkId");

-- CreateIndex
CREATE INDEX "generated_videos_jobId_idx" ON "public"."generated_videos"("jobId");

-- CreateIndex
CREATE INDEX "generated_videos_clerkId_createdAt_idx" ON "public"."generated_videos"("clerkId", "createdAt");

-- CreateIndex
CREATE INDEX "generated_videos_format_idx" ON "public"."generated_videos"("format");

-- CreateIndex
CREATE INDEX "generated_videos_filename_idx" ON "public"."generated_videos"("filename");

-- CreateIndex
CREATE INDEX "generated_videos_duration_idx" ON "public"."generated_videos"("duration");

-- CreateIndex
CREATE INDEX "generated_videos_fileSize_idx" ON "public"."generated_videos"("fileSize");

-- CreateIndex
CREATE UNIQUE INDEX "generated_videos_jobId_filename_subfolder_type_key" ON "public"."generated_videos"("jobId", "filename", "subfolder", "type");

-- CreateIndex
CREATE INDEX "generated_images_clerkId_idx" ON "public"."generated_images"("clerkId");

-- CreateIndex
CREATE INDEX "generated_images_jobId_idx" ON "public"."generated_images"("jobId");

-- CreateIndex
CREATE INDEX "generated_images_clerkId_createdAt_idx" ON "public"."generated_images"("clerkId", "createdAt");

-- CreateIndex
CREATE INDEX "generated_images_format_idx" ON "public"."generated_images"("format");

-- CreateIndex
CREATE INDEX "generated_images_filename_idx" ON "public"."generated_images"("filename");

-- CreateIndex
CREATE UNIQUE INDEX "generated_images_jobId_filename_subfolder_type_key" ON "public"."generated_images"("jobId", "filename", "subfolder", "type");

-- CreateIndex
CREATE INDEX "generation_jobs_clerkId_idx" ON "public"."generation_jobs"("clerkId");

-- CreateIndex
CREATE INDEX "generation_jobs_status_idx" ON "public"."generation_jobs"("status");

-- CreateIndex
CREATE INDEX "generation_jobs_type_idx" ON "public"."generation_jobs"("type");

-- CreateIndex
CREATE INDEX "generation_jobs_createdAt_idx" ON "public"."generation_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "generation_jobs_clerkId_createdAt_idx" ON "public"."generation_jobs"("clerkId", "createdAt");

-- CreateIndex
CREATE INDEX "generation_jobs_clerkId_status_idx" ON "public"."generation_jobs"("clerkId", "status");

-- CreateIndex
CREATE INDEX "generation_jobs_clerkId_type_idx" ON "public"."generation_jobs"("clerkId", "type");

-- CreateIndex
CREATE INDEX "influencer_loras_clerkId_idx" ON "public"."influencer_loras"("clerkId");

-- CreateIndex
CREATE INDEX "influencer_loras_fileName_idx" ON "public"."influencer_loras"("fileName");

-- CreateIndex
CREATE INDEX "influencer_loras_isActive_idx" ON "public"."influencer_loras"("isActive");

-- AddForeignKey
ALTER TABLE "public"."generated_videos" ADD CONSTRAINT "generated_videos_clerkId_fkey" FOREIGN KEY ("clerkId") REFERENCES "public"."users"("clerkId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."generated_videos" ADD CONSTRAINT "generated_videos_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."generation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
