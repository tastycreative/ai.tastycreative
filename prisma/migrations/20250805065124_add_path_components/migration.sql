/*
  Warnings:

  - You are about to drop the column `originalUrl` on the `generated_images` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."generated_images" DROP COLUMN "originalUrl",
ADD COLUMN     "subfolder" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'output';
