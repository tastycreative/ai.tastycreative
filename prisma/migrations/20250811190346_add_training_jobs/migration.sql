-- CreateEnum
CREATE TYPE "public"."TrainingStatus" AS ENUM ('PENDING', 'QUEUED', 'INITIALIZING', 'PROCESSING', 'SAMPLING', 'SAVING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT');

-- AlterTable
ALTER TABLE "public"."influencer_loras" ADD COLUMN     "trainingJobId" TEXT;

-- CreateTable
CREATE TABLE "public"."training_jobs" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."TrainingStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER DEFAULT 0,
    "currentStep" INTEGER DEFAULT 0,
    "totalSteps" INTEGER,
    "runpodJobId" TEXT,
    "runpodPodId" TEXT,
    "trainingConfig" JSONB NOT NULL,
    "datasetConfig" JSONB NOT NULL,
    "modelConfig" JSONB NOT NULL,
    "sampleConfig" JSONB NOT NULL,
    "error" TEXT,
    "loss" DOUBLE PRECISION,
    "learningRate" DOUBLE PRECISION,
    "eta" TEXT,
    "sampleUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "checkpointUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "finalModelUrl" TEXT,
    "logUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "training_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."training_images" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "trainingJobId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "caption" TEXT,
    "fileSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "format" TEXT,
    "storageUrl" TEXT NOT NULL,
    "localPath" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_jobs_clerkId_idx" ON "public"."training_jobs"("clerkId");

-- CreateIndex
CREATE INDEX "training_jobs_status_idx" ON "public"."training_jobs"("status");

-- CreateIndex
CREATE INDEX "training_jobs_clerkId_status_idx" ON "public"."training_jobs"("clerkId", "status");

-- CreateIndex
CREATE INDEX "training_jobs_createdAt_idx" ON "public"."training_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "training_jobs_runpodJobId_idx" ON "public"."training_jobs"("runpodJobId");

-- CreateIndex
CREATE INDEX "training_images_trainingJobId_idx" ON "public"."training_images"("trainingJobId");

-- CreateIndex
CREATE INDEX "training_images_clerkId_idx" ON "public"."training_images"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "training_images_trainingJobId_filename_key" ON "public"."training_images"("trainingJobId", "filename");

-- CreateIndex
CREATE INDEX "influencer_loras_trainingJobId_idx" ON "public"."influencer_loras"("trainingJobId");

-- AddForeignKey
ALTER TABLE "public"."influencer_loras" ADD CONSTRAINT "influencer_loras_trainingJobId_fkey" FOREIGN KEY ("trainingJobId") REFERENCES "public"."training_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_jobs" ADD CONSTRAINT "training_jobs_clerkId_fkey" FOREIGN KEY ("clerkId") REFERENCES "public"."users"("clerkId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_images" ADD CONSTRAINT "training_images_clerkId_fkey" FOREIGN KEY ("clerkId") REFERENCES "public"."users"("clerkId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_images" ADD CONSTRAINT "training_images_trainingJobId_fkey" FOREIGN KEY ("trainingJobId") REFERENCES "public"."training_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
