-- CreateTable
CREATE TABLE "public"."generated_images" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "format" TEXT,
    "data" BYTEA,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_images_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."generated_images" ADD CONSTRAINT "generated_images_clerkId_fkey" FOREIGN KEY ("clerkId") REFERENCES "public"."users"("clerkId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."generated_images" ADD CONSTRAINT "generated_images_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."generation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
