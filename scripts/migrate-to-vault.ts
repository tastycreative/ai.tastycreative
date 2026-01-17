/**
 * Migration Script: Generated Content → Vault
 * 
 * This script migrates content from the Generated Content system to Vault.
 * 
 * Run with: npx tsx scripts/migrate-to-vault.ts
 * 
 * Modes:
 *   DRY_RUN=true  - Preview changes without making them (default)
 *   DRY_RUN=false - Actually execute the migration
 */

import { S3Client, ListObjectsV2Command, CopyObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "../lib/generated/prisma";
import * as fs from "fs/promises";

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// ============================================================================
// CONFIGURATION
// ============================================================================

const DRY_RUN = process.env.DRY_RUN !== "false"; // Default to true (dry run)
const PROFILE_NAME = "Migrated Content";
const UNCATEGORIZED_FOLDER = "Uncategorized";
const BATCH_SIZE = 50; // Process files in batches
const SKIP_ORPHAN_FILES = true; // Skip files not in user folders

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
// TYPES
// ============================================================================

interface S3FileInfo {
  key: string;
  size: number;
  lastModified: Date;
}

interface MigrationPlan {
  user: {
    clerkId: string;
    email: string | null;
  };
  profile: {
    name: string;
    willCreate: boolean;
    existingId?: string;
  };
  folders: {
    name: string;
    willCreate: boolean;
    existingId?: string;
    fileCount: number;
    totalSize: number;
  }[];
  files: {
    sourceKey: string;
    targetKey: string;
    folderName: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  }[];
  summary: {
    totalFiles: number;
    totalSize: number;
    foldersToCreate: number;
    existingFolders: number;
  };
}

interface MigrationResult {
  success: boolean;
  user: string;
  profileId?: string;
  foldersCreated: number;
  filesProcessed: number;
  filesCopied: number;
  vaultItemsCreated: number;
  errors: string[];
}

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

function getFileType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mp3: "audio/mpeg",
    wav: "audio/wav",
  };
  return mimeTypes[ext] || "application/octet-stream";
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
        if (obj.Key && obj.Size !== undefined && obj.Size > 0) {
          files.push({
            key: obj.Key,
            size: obj.Size,
            lastModified: obj.LastModified || new Date(),
          });
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return files;
}

// ============================================================================
// MIGRATION PLANNING
// ============================================================================

async function buildMigrationPlan(clerkId: string, email: string | null): Promise<MigrationPlan> {
  console.log(`\n  📋 Building migration plan for ${email || clerkId}...`);

  // Get all files for this user from S3
  const userPrefix = `outputs/${clerkId}/`;
  const files = await listS3Objects(userPrefix);

  // Check for existing Instagram profile
  const existingProfile = await prisma.instagramProfile.findFirst({
    where: { clerkId, name: PROFILE_NAME },
  });

  // Organize files by folder
  const folderMap: Map<string, S3FileInfo[]> = new Map();
  
  for (const file of files) {
    // Parse: outputs/{clerkId}/{folder}/{filename} or outputs/{clerkId}/{filename}
    const relativePath = file.key.substring(userPrefix.length);
    const parts = relativePath.split("/");
    
    let folderName: string;
    let fileName: string;
    
    if (parts.length === 1) {
      // Root file
      folderName = UNCATEGORIZED_FOLDER;
      fileName = parts[0];
    } else {
      // File in subfolder
      folderName = parts[0];
      fileName = parts.slice(1).join("/"); // Handle nested paths
    }

    // Skip vault: prefixed folders (they're already in vault)
    if (folderName.startsWith("vault:")) {
      continue;
    }

    if (!folderMap.has(folderName)) {
      folderMap.set(folderName, []);
    }
    folderMap.get(folderName)!.push(file);
  }

  // Check for existing vault folders
  const existingFolders = existingProfile
    ? await prisma.vaultFolder.findMany({
        where: { profileId: existingProfile.id },
        select: { id: true, name: true },
      })
    : [];

  const existingFolderMap = new Map(existingFolders.map(f => [f.name, f.id]));

  // Build folder plans
  const folderPlans: MigrationPlan["folders"] = [];
  const filePlans: MigrationPlan["files"] = [];

  for (const [folderName, folderFiles] of folderMap) {
    const existingFolderId = existingFolderMap.get(folderName);
    
    folderPlans.push({
      name: folderName,
      willCreate: !existingFolderId,
      existingId: existingFolderId,
      fileCount: folderFiles.length,
      totalSize: folderFiles.reduce((sum, f) => sum + f.size, 0),
    });

    // Build file plans
    for (const file of folderFiles) {
      const relativePath = file.key.substring(userPrefix.length);
      const parts = relativePath.split("/");
      const fileName = parts.length === 1 ? parts[0] : parts.slice(1).join("/");

      // Target key will be set during execution when we have the actual IDs
      // For now, use placeholder
      const targetKey = `vault/${clerkId}/{profileId}/{folderId}/${fileName}`;

      filePlans.push({
        sourceKey: file.key,
        targetKey,
        folderName,
        fileName,
        fileSize: file.size,
        fileType: getFileType(fileName),
      });
    }
  }

  return {
    user: { clerkId, email },
    profile: {
      name: PROFILE_NAME,
      willCreate: !existingProfile,
      existingId: existingProfile?.id,
    },
    folders: folderPlans.sort((a, b) => b.fileCount - a.fileCount),
    files: filePlans,
    summary: {
      totalFiles: filePlans.length,
      totalSize: filePlans.reduce((sum, f) => sum + f.fileSize, 0),
      foldersToCreate: folderPlans.filter(f => f.willCreate).length,
      existingFolders: folderPlans.filter(f => !f.willCreate).length,
    },
  };
}

// ============================================================================
// DRY RUN OUTPUT
// ============================================================================

function printMigrationPlan(plan: MigrationPlan): void {
  const { user, profile, folders, summary } = plan;

  console.log(`\n  ${"─".repeat(70)}`);
  console.log(`  👤 User: ${user.email || user.clerkId}`);
  console.log(`     ClerkId: ${user.clerkId}`);
  console.log(`  ${"─".repeat(70)}`);

  // Profile
  if (profile.willCreate) {
    console.log(`  📱 Profile: "${profile.name}" [WILL CREATE]`);
  } else {
    console.log(`  📱 Profile: "${profile.name}" [EXISTS: ${profile.existingId}]`);
  }

  // Folders
  console.log(`\n  📁 Folders (${folders.length}):`);
  for (const folder of folders) {
    const status = folder.willCreate ? "[WILL CREATE]" : `[EXISTS: ${folder.existingId?.substring(0, 8)}...]`;
    console.log(`     ${folder.willCreate ? "+" : "•"} ${folder.name.padEnd(45)} ${folder.fileCount.toString().padStart(5)} files  ${formatBytes(folder.totalSize).padStart(10)}  ${status}`);
  }

  // Summary
  console.log(`\n  📊 Summary:`);
  console.log(`     Total files to migrate: ${summary.totalFiles}`);
  console.log(`     Total size: ${formatBytes(summary.totalSize)}`);
  console.log(`     Folders to create: ${summary.foldersToCreate}`);
  console.log(`     Existing folders: ${summary.existingFolders}`);
}

// ============================================================================
// MIGRATION EXECUTION
// ============================================================================

async function executeMigration(plan: MigrationPlan): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    user: plan.user.email || plan.user.clerkId,
    foldersCreated: 0,
    filesProcessed: 0,
    filesCopied: 0,
    vaultItemsCreated: 0,
    errors: [],
  };

  try {
    // 1. Create or get profile
    let profileId: string;
    
    if (plan.profile.willCreate) {
      const profile = await prisma.instagramProfile.create({
        data: {
          clerkId: plan.user.clerkId,
          name: PROFILE_NAME,
          isDefault: false,
        },
      });
      profileId = profile.id;
      console.log(`     ✅ Created profile: ${profileId}`);
    } else {
      profileId = plan.profile.existingId!;
      console.log(`     ℹ️  Using existing profile: ${profileId}`);
    }
    
    result.profileId = profileId;

    // 2. Create folders and build folder ID map
    const folderIdMap: Map<string, string> = new Map();

    for (const folder of plan.folders) {
      if (folder.willCreate) {
        const newFolder = await prisma.vaultFolder.create({
          data: {
            clerkId: plan.user.clerkId,
            profileId,
            name: folder.name,
            isDefault: folder.name === UNCATEGORIZED_FOLDER,
          },
        });
        folderIdMap.set(folder.name, newFolder.id);
        result.foldersCreated++;
        console.log(`     ✅ Created folder: ${folder.name} (${newFolder.id})`);
      } else {
        folderIdMap.set(folder.name, folder.existingId!);
      }
    }

    // 3. Process files in batches
    const totalFiles = plan.files.length;
    console.log(`     📦 Processing ${totalFiles} files...`);

    for (let i = 0; i < plan.files.length; i += BATCH_SIZE) {
      const batch = plan.files.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(totalFiles / BATCH_SIZE);
      
      process.stdout.write(`\r     📦 Batch ${batchNum}/${totalBatches} (${Math.min(i + BATCH_SIZE, totalFiles)}/${totalFiles} files)...`);

      for (const file of batch) {
        result.filesProcessed++;

        try {
          const folderId = folderIdMap.get(file.folderName)!;
          const targetKey = `vault/${plan.user.clerkId}/${profileId}/${folderId}/${file.fileName}`;
          const targetUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${targetKey}`;

          // Check if VaultItem already exists
          const existingItem = await prisma.vaultItem.findFirst({
            where: {
              clerkId: plan.user.clerkId,
              profileId,
              folderId,
              fileName: file.fileName,
            },
          });

          if (existingItem) {
            // Skip if already exists
            continue;
          }

          // Copy S3 file
          await s3Client.send(new CopyObjectCommand({
            Bucket: BUCKET_NAME,
            CopySource: `${BUCKET_NAME}/${file.sourceKey}`,
            Key: targetKey,
          }));
          result.filesCopied++;

          // Create VaultItem record
          await prisma.vaultItem.create({
            data: {
              clerkId: plan.user.clerkId,
              profileId,
              folderId,
              fileName: file.fileName,
              fileType: file.fileType,
              fileSize: file.fileSize,
              awsS3Key: targetKey,
              awsS3Url: targetUrl,
            },
          });
          result.vaultItemsCreated++;

        } catch (error: any) {
          result.errors.push(`File ${file.fileName}: ${error.message}`);
        }
      }
    }

    console.log(""); // New line after progress
    result.success = result.errors.length === 0;

  } catch (error: any) {
    result.errors.push(`Migration failed: ${error.message}`);
  }

  return result;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("═".repeat(80));
  console.log("🚀 MIGRATION: Generated Content → Vault");
  console.log("═".repeat(80));
  console.log(`Mode: ${DRY_RUN ? "🔍 DRY RUN (no changes will be made)" : "⚡ EXECUTE (changes will be made)"}`);
  console.log(`Profile Name: "${PROFILE_NAME}"`);
  console.log(`Uncategorized Folder: "${UNCATEGORIZED_FOLDER}"`);
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log("═".repeat(80));

  try {
    // Get all users with content in outputs/
    console.log("\n📂 Scanning S3 for users with content...");
    
    const allOutputFiles = await listS3Objects("outputs/");
    
    // Extract unique clerkIds
    const clerkIds = new Set<string>();
    for (const file of allOutputFiles) {
      const parts = file.key.split("/");
      if (parts.length >= 2 && parts[1].startsWith("user_")) {
        clerkIds.add(parts[1]);
      }
    }

    console.log(`Found ${clerkIds.size} users with content`);

    // Get user info from database
    const users = await prisma.user.findMany({
      where: { clerkId: { in: Array.from(clerkIds) } },
      select: { clerkId: true, email: true },
    });

    const userMap = new Map(users.map(u => [u.clerkId, u.email]));

    // Build migration plans
    const plans: MigrationPlan[] = [];
    
    for (const clerkId of clerkIds) {
      const email = userMap.get(clerkId) || null;
      const plan = await buildMigrationPlan(clerkId, email);
      
      if (plan.files.length > 0) {
        plans.push(plan);
      }
    }

    // Sort by file count descending
    plans.sort((a, b) => b.summary.totalFiles - a.summary.totalFiles);

    // Print all plans
    console.log("\n" + "═".repeat(80));
    console.log("📋 MIGRATION PLANS");
    console.log("═".repeat(80));

    for (const plan of plans) {
      printMigrationPlan(plan);
    }

    // Overall summary
    const totalSummary = {
      users: plans.length,
      files: plans.reduce((sum, p) => sum + p.summary.totalFiles, 0),
      size: plans.reduce((sum, p) => sum + p.summary.totalSize, 0),
      foldersToCreate: plans.reduce((sum, p) => sum + p.summary.foldersToCreate, 0),
      profilesToCreate: plans.filter(p => p.profile.willCreate).length,
    };

    console.log("\n" + "═".repeat(80));
    console.log("📊 OVERALL MIGRATION SUMMARY");
    console.log("═".repeat(80));
    console.log(`  Users to migrate: ${totalSummary.users}`);
    console.log(`  Total files: ${totalSummary.files}`);
    console.log(`  Total size: ${formatBytes(totalSummary.size)}`);
    console.log(`  Profiles to create: ${totalSummary.profilesToCreate}`);
    console.log(`  Folders to create: ${totalSummary.foldersToCreate}`);

    if (DRY_RUN) {
      console.log("\n" + "═".repeat(80));
      console.log("🔍 DRY RUN COMPLETE");
      console.log("═".repeat(80));
      console.log("No changes were made. To execute the migration, run:");
      console.log("  DRY_RUN=false npx tsx scripts/migrate-to-vault.ts");
      console.log("═".repeat(80));

      // Save plan to file for review
      const planFile = "./scripts/migration-plan.json";
      await fs.writeFile(planFile, JSON.stringify({
        generatedAt: new Date().toISOString(),
        mode: "DRY_RUN",
        summary: totalSummary,
        plans: plans.map(p => ({
          user: p.user,
          profile: p.profile,
          folders: p.folders,
          summary: p.summary,
          sampleFiles: p.files.slice(0, 10), // Only include sample for review
        })),
      }, null, 2));
      console.log(`\nDetailed plan saved to: ${planFile}`);

    } else {
      // Execute migration
      console.log("\n" + "═".repeat(80));
      console.log("⚡ EXECUTING MIGRATION");
      console.log("═".repeat(80));

      const results: MigrationResult[] = [];

      for (const plan of plans) {
        console.log(`\n  🔄 Migrating ${plan.user.email || plan.user.clerkId}...`);
        const result = await executeMigration(plan);
        results.push(result);

        if (result.success) {
          console.log(`     ✅ Success: ${result.filesCopied} files copied, ${result.vaultItemsCreated} vault items created`);
        } else {
          console.log(`     ⚠️  Completed with ${result.errors.length} errors`);
          for (const error of result.errors.slice(0, 5)) {
            console.log(`        - ${error}`);
          }
        }
      }

      // Final summary
      console.log("\n" + "═".repeat(80));
      console.log("✅ MIGRATION COMPLETE");
      console.log("═".repeat(80));
      console.log(`  Users processed: ${results.length}`);
      console.log(`  Files copied: ${results.reduce((sum, r) => sum + r.filesCopied, 0)}`);
      console.log(`  Vault items created: ${results.reduce((sum, r) => sum + r.vaultItemsCreated, 0)}`);
      console.log(`  Folders created: ${results.reduce((sum, r) => sum + r.foldersCreated, 0)}`);
      console.log(`  Errors: ${results.reduce((sum, r) => sum + r.errors.length, 0)}`);

      // Save results
      const resultsFile = "./scripts/migration-results.json";
      await fs.writeFile(resultsFile, JSON.stringify({
        completedAt: new Date().toISOString(),
        summary: {
          usersProcessed: results.length,
          filesCopied: results.reduce((sum, r) => sum + r.filesCopied, 0),
          vaultItemsCreated: results.reduce((sum, r) => sum + r.vaultItemsCreated, 0),
          foldersCreated: results.reduce((sum, r) => sum + r.foldersCreated, 0),
          totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
        },
        results,
      }, null, 2));
      console.log(`\nResults saved to: ${resultsFile}`);
    }

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
