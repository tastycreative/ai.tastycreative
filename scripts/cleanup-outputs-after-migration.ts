/**
 * Cleanup Script: Delete Original Files from outputs/
 * 
 * This script deletes the original files from outputs/ after verifying
 * the migration to vault was successful.
 * 
 * Run with: npx tsx scripts/cleanup-outputs-after-migration.ts
 * 
 * Modes:
 *   DRY_RUN=true  - Preview what will be deleted (default)
 *   DRY_RUN=false - Actually delete the files
 */

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "../lib/generated/prisma";
import * as fs from "fs/promises";

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// ============================================================================
// CONFIGURATION
// ============================================================================

const DRY_RUN = process.env.DRY_RUN !== "false"; // Default to true (dry run)
const BATCH_SIZE = 1000; // S3 DeleteObjects limit is 1000

// ============================================================================
// SETUP
// ============================================================================

const prisma = new PrismaClient();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "tastycreative";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

interface S3FileInfo {
  key: string;
  size: number;
}

async function listS3Objects(prefix: string): Promise<S3FileInfo[]> {
  const files: S3FileInfo[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });

    const response = await s3Client.send(command);

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key && obj.Size !== undefined) {
          files.push({
            key: obj.Key,
            size: obj.Size,
          });
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return files;
}

async function deleteS3Objects(keys: string[]): Promise<{ deleted: number; errors: string[] }> {
  const errors: string[] = [];
  let deleted = 0;

  // Process in batches of 1000 (S3 limit)
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE);
    
    try {
      const command = new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: batch.map(key => ({ Key: key })),
          Quiet: true,
        },
      });

      const response = await s3Client.send(command);
      
      if (response.Errors && response.Errors.length > 0) {
        for (const error of response.Errors) {
          errors.push(`${error.Key}: ${error.Message}`);
        }
      }
      
      deleted += batch.length - (response.Errors?.length || 0);
      
      process.stdout.write(`\r  Deleted ${deleted}/${keys.length} files...`);
    } catch (error: any) {
      errors.push(`Batch error: ${error.message}`);
    }
  }

  console.log(""); // New line after progress
  return { deleted, errors };
}

// ============================================================================
// VERIFICATION
// ============================================================================

async function verifyMigration(): Promise<{
  verified: boolean;
  vaultItemCount: number;
  outputFileCount: number;
  details: string[];
}> {
  console.log("\n🔍 Verifying migration...\n");

  const details: string[] = [];

  // Count vault items
  const vaultItemCount = await prisma.vaultItem.count();
  details.push(`Vault items in database: ${vaultItemCount}`);

  // Count files in vault/ S3 prefix
  const vaultFiles = await listS3Objects("vault/");
  details.push(`Files in vault/ S3 folder: ${vaultFiles.length}`);

  // Count files in outputs/ S3 prefix (only user folders)
  const outputFiles = await listS3Objects("outputs/");
  const userOutputFiles = outputFiles.filter(f => {
    const parts = f.key.split("/");
    return parts.length >= 2 && parts[1].startsWith("user_");
  });
  details.push(`Files in outputs/ S3 folder (user folders): ${userOutputFiles.length}`);

  // Check if vault items match approximately
  const tolerance = 0.05; // 5% tolerance for any edge cases
  const ratio = vaultFiles.length / userOutputFiles.length;
  const isCountMatch = ratio >= (1 - tolerance);

  details.push(`\nVerification ratio: ${(ratio * 100).toFixed(1)}%`);
  
  if (isCountMatch) {
    details.push("✅ Vault has sufficient files to proceed with cleanup");
  } else {
    details.push("⚠️  Warning: Vault may be missing some files");
  }

  return {
    verified: isCountMatch,
    vaultItemCount,
    outputFileCount: userOutputFiles.length,
    details,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("═".repeat(80));
  console.log("🧹 CLEANUP: Delete Original Files from outputs/");
  console.log("═".repeat(80));
  console.log(`Mode: ${DRY_RUN ? "🔍 DRY RUN (no files will be deleted)" : "⚡ EXECUTE (files will be deleted)"}`);
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log("═".repeat(80));

  try {
    // Step 1: Verify migration
    const verification = await verifyMigration();
    
    console.log("\n📊 Verification Results:");
    for (const detail of verification.details) {
      console.log(`  ${detail}`);
    }

    if (!verification.verified && !DRY_RUN) {
      console.log("\n❌ Migration verification failed. Aborting cleanup.");
      console.log("   Please ensure all files have been migrated to vault first.");
      return;
    }

    // Step 2: Get all files to delete
    console.log("\n📂 Scanning outputs/ folder for user files...");
    
    const allOutputFiles = await listS3Objects("outputs/");
    
    // Filter to only user folders (outputs/user_xxx/...)
    const filesToDelete = allOutputFiles.filter(f => {
      const parts = f.key.split("/");
      if (parts.length < 2) return false;
      
      // Only delete files in user folders
      if (!parts[1].startsWith("user_")) return false;
      
      // Skip vault: prefixed folders (they were already skipped in migration)
      if (parts.length >= 3 && parts[2].startsWith("vault:")) return false;
      
      return true;
    });

    const totalSize = filesToDelete.reduce((sum, f) => sum + f.size, 0);

    console.log(`\nFiles to delete: ${filesToDelete.length}`);
    console.log(`Total size to free: ${formatBytes(totalSize)}`);

    // Group by user for summary
    const userStats: Record<string, { count: number; size: number }> = {};
    for (const file of filesToDelete) {
      const parts = file.key.split("/");
      const userId = parts[1];
      if (!userStats[userId]) {
        userStats[userId] = { count: 0, size: 0 };
      }
      userStats[userId].count++;
      userStats[userId].size += file.size;
    }

    console.log("\n👤 Per-user breakdown:");
    console.log("-".repeat(60));
    for (const [userId, stats] of Object.entries(userStats).sort((a, b) => b[1].count - a[1].count)) {
      console.log(`  ${userId.substring(0, 30).padEnd(32)} ${stats.count.toString().padStart(6)} files  ${formatBytes(stats.size).padStart(12)}`);
    }

    if (DRY_RUN) {
      console.log("\n" + "═".repeat(80));
      console.log("🔍 DRY RUN COMPLETE");
      console.log("═".repeat(80));
      console.log("No files were deleted. To execute the cleanup, run:");
      console.log("  DRY_RUN=false npx tsx scripts/cleanup-outputs-after-migration.ts");
      console.log("═".repeat(80));

      // Save plan to file
      const planFile = "./scripts/cleanup-plan.json";
      await fs.writeFile(planFile, JSON.stringify({
        generatedAt: new Date().toISOString(),
        mode: "DRY_RUN",
        verification,
        summary: {
          totalFiles: filesToDelete.length,
          totalSize,
          users: Object.entries(userStats).map(([userId, stats]) => ({
            userId,
            ...stats,
          })),
        },
        sampleFiles: filesToDelete.slice(0, 50).map(f => f.key),
      }, null, 2));
      console.log(`\nCleanup plan saved to: ${planFile}`);

    } else {
      // Confirm before deleting
      console.log("\n" + "═".repeat(80));
      console.log("⚠️  WARNING: This will permanently delete files!");
      console.log("═".repeat(80));
      console.log(`\nAbout to delete ${filesToDelete.length} files (${formatBytes(totalSize)})`);
      console.log("\nProceeding with deletion in 5 seconds...");
      console.log("(This is your last chance to cancel with Ctrl+C)\n");

      // Wait 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log("⚡ EXECUTING CLEANUP");
      console.log("═".repeat(80));

      const keys = filesToDelete.map(f => f.key);
      const result = await deleteS3Objects(keys);

      console.log("\n" + "═".repeat(80));
      console.log("✅ CLEANUP COMPLETE");
      console.log("═".repeat(80));
      console.log(`  Files deleted: ${result.deleted}`);
      console.log(`  Space freed: ${formatBytes(totalSize)}`);
      console.log(`  Errors: ${result.errors.length}`);

      if (result.errors.length > 0) {
        console.log("\n⚠️  Errors encountered:");
        for (const error of result.errors.slice(0, 10)) {
          console.log(`    - ${error}`);
        }
        if (result.errors.length > 10) {
          console.log(`    ... and ${result.errors.length - 10} more`);
        }
      }

      // Save results
      const resultsFile = "./scripts/cleanup-results.json";
      await fs.writeFile(resultsFile, JSON.stringify({
        completedAt: new Date().toISOString(),
        summary: {
          filesDeleted: result.deleted,
          sizeFreed: totalSize,
          errors: result.errors.length,
        },
        errors: result.errors,
      }, null, 2));
      console.log(`\nResults saved to: ${resultsFile}`);
    }

  } catch (error) {
    console.error("\n❌ Cleanup failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
