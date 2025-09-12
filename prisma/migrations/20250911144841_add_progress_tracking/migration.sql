/*
  Warnings:

  - You are about to drop the column `data` on the `influencer_loras` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."GenerationType" ADD VALUE 'SKIN_ENHANCEMENT';
ALTER TYPE "public"."GenerationType" ADD VALUE 'FACE_SWAP';

-- AlterTable
ALTER TABLE "public"."generation_jobs" ADD COLUMN     "elapsedTime" INTEGER,
ADD COLUMN     "estimatedTimeRemaining" INTEGER,
ADD COLUMN     "message" TEXT,
ADD COLUMN     "stage" TEXT;

-- AlterTable
ALTER TABLE "public"."influencer_loras" DROP COLUMN "data",
ADD COLUMN     "cloudinaryPublicId" TEXT,
ADD COLUMN     "cloudinaryUrl" TEXT;
