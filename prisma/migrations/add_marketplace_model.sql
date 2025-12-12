-- Add MarketplaceModel table and MarketplaceStatus enum
-- Run this migration with: npx prisma db push
-- Or apply manually to the database

-- Create enum for marketplace status
DO $$ BEGIN
    CREATE TYPE "MarketplaceStatus" AS ENUM ('AVAILABLE', 'SOLD', 'RESERVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create marketplace_models table
CREATE TABLE IF NOT EXISTS "marketplace_models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "status" "MarketplaceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "imageUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Premium',
    "gallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT NOT NULL,
    "included" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "usedFor" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_models_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "marketplace_models_status_idx" ON "marketplace_models"("status");
CREATE INDEX IF NOT EXISTS "marketplace_models_createdAt_idx" ON "marketplace_models"("createdAt");
