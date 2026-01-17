/**
 * Migration Analysis Script
 * 
 * This script analyzes data in AWS S3 and database to prepare for
 * migrating Generated Content to Vault.
 * 
 * Run with: npx ts-node --skip-project scripts/analyze-migration-data.ts
 * Or: npx tsx scripts/analyze-migration-data.ts
 */

import { S3Client, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "../lib/generated/prisma";

// Load environment variables
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "tastycreative";

interface S3FileInfo {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
}

interface UserContentSummary {
  clerkId: string;
  email: string | null;
  name: string | null;
  imageCount: number;
  videoCount: number;
  imagesWithS3: number;
  videosWithS3: number;
  totalSize: number;
  images: {
    id: string;
    filename: string;
    awsS3Key: string | null;
    awsS3Url: string | null;
    fileSize: number | null;
    createdAt: Date;
  }[];
  videos: {
    id: string;
    filename: string;
    awsS3Key: string | null;
    awsS3Url: string | null;
    fileSize: number | null;
    createdAt: Date;
  }[];
}

interface VaultSummary {
  clerkId: string;
  email: string | null;
  name: string | null;
  folderCount: number;
  itemCount: number;
  totalSize: number;
  folders: {
    id: string;
    name: string;
    itemCount: number;
  }[];
}

async function listS3Objects(prefix: string = ""): Promise<S3FileInfo[]> {
  const files: S3FileInfo[] = [];
  let continuationToken: string | undefined;

  console.log(`\n📂 Listing S3 objects with prefix: "${prefix || "(root)"}"`);

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
            lastModified: obj.LastModified || new Date(),
          });
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return files;
}

async function getS3BucketOverview() {
  console.log("\n" + "=".repeat(80));
  console.log("📦 AWS S3 BUCKET OVERVIEW");
  console.log("=".repeat(80));
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log(`Region: ${process.env.AWS_REGION}`);

  // List top-level prefixes
  const allFiles = await listS3Objects("");
  
  // Group by top-level folder
  const folderStats: Record<string, { count: number; size: number }> = {};
  
  for (const file of allFiles) {
    const topFolder = file.key.split("/")[0] || "(root)";
    if (!folderStats[topFolder]) {
      folderStats[topFolder] = { count: 0, size: 0 };
    }
    folderStats[topFolder].count++;
    folderStats[topFolder].size += file.size;
  }

  console.log(`\nTotal files: ${allFiles.length}`);
  console.log(`Total size: ${formatBytes(allFiles.reduce((sum, f) => sum + f.size, 0))}`);
  
  console.log("\n📁 Folders breakdown:");
  console.log("-".repeat(60));
  
  const sortedFolders = Object.entries(folderStats).sort((a, b) => b[1].size - a[1].size);
  
  for (const [folder, stats] of sortedFolders) {
    console.log(`  ${folder.padEnd(30)} ${stats.count.toString().padStart(8)} files  ${formatBytes(stats.size).padStart(12)}`);
  }

  return { allFiles, folderStats };
}

async function getDatabaseContentSummary(): Promise<UserContentSummary[]> {
  console.log("\n" + "=".repeat(80));
  console.log("🗃️  DATABASE CONTENT SUMMARY");
  console.log("=".repeat(80));

  // Get all users with their content
  const users = await prisma.user.findMany({
    select: {
      clerkId: true,
      email: true,
      firstName: true,
      lastName: true,
      images: {
        select: {
          id: true,
          filename: true,
          awsS3Key: true,
          awsS3Url: true,
          fileSize: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      videos: {
        select: {
          id: true,
          filename: true,
          awsS3Key: true,
          awsS3Url: true,
          fileSize: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const summaries: UserContentSummary[] = [];

  for (const user of users) {
    const imagesWithS3 = user.images.filter(img => img.awsS3Key || img.awsS3Url);
    const videosWithS3 = user.videos.filter(vid => vid.awsS3Key || vid.awsS3Url);
    const totalSize = 
      user.images.reduce((sum, img) => sum + (img.fileSize || 0), 0) +
      user.videos.reduce((sum, vid) => sum + (vid.fileSize || 0), 0);

    if (user.images.length > 0 || user.videos.length > 0) {
      summaries.push({
        clerkId: user.clerkId,
        email: user.email,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
        imageCount: user.images.length,
        videoCount: user.videos.length,
        imagesWithS3: imagesWithS3.length,
        videosWithS3: videosWithS3.length,
        totalSize,
        images: user.images,
        videos: user.videos,
      });
    }
  }

  // Sort by total content
  summaries.sort((a, b) => (b.imageCount + b.videoCount) - (a.imageCount + a.videoCount));

  // Print summary
  console.log(`\nUsers with content: ${summaries.length}`);
  console.log(`Total images: ${summaries.reduce((sum, u) => sum + u.imageCount, 0)}`);
  console.log(`Total videos: ${summaries.reduce((sum, u) => sum + u.videoCount, 0)}`);
  console.log(`Images with S3 URLs: ${summaries.reduce((sum, u) => sum + u.imagesWithS3, 0)}`);
  console.log(`Videos with S3 URLs: ${summaries.reduce((sum, u) => sum + u.videosWithS3, 0)}`);

  console.log("\n👤 Per-user breakdown:");
  console.log("-".repeat(100));
  console.log(
    "Email".padEnd(35) +
    "Images".padStart(10) +
    "Videos".padStart(10) +
    "w/ S3".padStart(10) +
    "Size".padStart(15)
  );
  console.log("-".repeat(100));

  for (const user of summaries) {
    const displayName = user.email || user.clerkId.substring(0, 20);
    console.log(
      displayName.substring(0, 34).padEnd(35) +
      user.imageCount.toString().padStart(10) +
      user.videoCount.toString().padStart(10) +
      (user.imagesWithS3 + user.videosWithS3).toString().padStart(10) +
      formatBytes(user.totalSize).padStart(15)
    );
  }

  return summaries;
}

async function getVaultSummary(): Promise<VaultSummary[]> {
  console.log("\n" + "=".repeat(80));
  console.log("🔐 EXISTING VAULT DATA SUMMARY");
  console.log("=".repeat(80));

  // Get users
  const users = await prisma.user.findMany({
    select: {
      clerkId: true,
      email: true,
      firstName: true,
      lastName: true,
      instagramProfiles: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const summaries: VaultSummary[] = [];

  for (const user of users) {
    const folders: { id: string; name: string; itemCount: number }[] = [];
    let totalItems = 0;
    let totalSize = 0;

    // Get vault folders for this user's profiles
    for (const profile of user.instagramProfiles) {
      const vaultFolders = await prisma.vaultFolder.findMany({
        where: { profileId: profile.id },
        select: {
          id: true,
          name: true,
          items: {
            select: {
              id: true,
              fileSize: true,
            },
          },
        },
      });

      for (const folder of vaultFolders) {
        const itemCount = folder.items.length;
        const folderSize = folder.items.reduce((sum, item) => sum + item.fileSize, 0);
        
        folders.push({
          id: folder.id,
          name: `${profile.name}/${folder.name}`,
          itemCount,
        });
        
        totalItems += itemCount;
        totalSize += folderSize;
      }
    }

    if (folders.length > 0 || totalItems > 0) {
      summaries.push({
        clerkId: user.clerkId,
        email: user.email,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
        folderCount: folders.length,
        itemCount: totalItems,
        totalSize,
        folders,
      });
    }
  }

  console.log(`\nUsers with vault data: ${summaries.length}`);
  console.log(`Total vault folders: ${summaries.reduce((sum, u) => sum + u.folderCount, 0)}`);
  console.log(`Total vault items: ${summaries.reduce((sum, u) => sum + u.itemCount, 0)}`);

  if (summaries.length > 0) {
    console.log("\n👤 Per-user vault breakdown:");
    console.log("-".repeat(80));
    
    for (const user of summaries) {
      const displayName = user.email || user.clerkId.substring(0, 20);
      console.log(`\n  ${displayName}`);
      console.log(`    Folders: ${user.folderCount}, Items: ${user.itemCount}, Size: ${formatBytes(user.totalSize)}`);
      
      for (const folder of user.folders) {
        console.log(`      📁 ${folder.name}: ${folder.itemCount} items`);
      }
    }
  }

  return summaries;
}

async function checkMigrationRequirements(contentSummaries: UserContentSummary[]) {
  console.log("\n" + "=".repeat(80));
  console.log("🔍 MIGRATION REQUIREMENTS CHECK");
  console.log("=".repeat(80));

  // Check if users have Instagram profiles (required for Vault)
  const usersNeedingProfiles: string[] = [];
  
  for (const user of contentSummaries) {
    const profiles = await prisma.instagramProfile.findMany({
      where: { clerkId: user.clerkId },
      select: { id: true, name: true },
    });

    if (profiles.length === 0) {
      usersNeedingProfiles.push(user.email || user.clerkId);
    }
  }

  console.log("\n📋 Requirements:");
  console.log(`  - Users needing Instagram profiles: ${usersNeedingProfiles.length}`);
  
  if (usersNeedingProfiles.length > 0) {
    console.log("\n  Users without profiles (will need auto-creation):");
    for (const user of usersNeedingProfiles.slice(0, 10)) {
      console.log(`    - ${user}`);
    }
    if (usersNeedingProfiles.length > 10) {
      console.log(`    ... and ${usersNeedingProfiles.length - 10} more`);
    }
  }

  // Count content that can be migrated (has S3 URL)
  const migratable = {
    images: contentSummaries.reduce((sum, u) => sum + u.imagesWithS3, 0),
    videos: contentSummaries.reduce((sum, u) => sum + u.videosWithS3, 0),
  };
  const nonMigratable = {
    images: contentSummaries.reduce((sum, u) => sum + (u.imageCount - u.imagesWithS3), 0),
    videos: contentSummaries.reduce((sum, u) => sum + (u.videoCount - u.videosWithS3), 0),
  };

  console.log("\n📊 Migration Stats:");
  console.log(`  ✅ Migratable (has S3 URL): ${migratable.images} images, ${migratable.videos} videos`);
  console.log(`  ⚠️  Non-migratable (no S3 URL): ${nonMigratable.images} images, ${nonMigratable.videos} videos`);

  return {
    usersNeedingProfiles,
    migratable,
    nonMigratable,
  };
}

async function exportDetailedReport(contentSummaries: UserContentSummary[]) {
  console.log("\n" + "=".repeat(80));
  console.log("📄 DETAILED DATA EXPORT");
  console.log("=".repeat(80));

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalUsers: contentSummaries.length,
      totalImages: contentSummaries.reduce((sum, u) => sum + u.imageCount, 0),
      totalVideos: contentSummaries.reduce((sum, u) => sum + u.videoCount, 0),
      totalSize: contentSummaries.reduce((sum, u) => sum + u.totalSize, 0),
    },
    users: contentSummaries.map(user => ({
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      stats: {
        imageCount: user.imageCount,
        videoCount: user.videoCount,
        imagesWithS3: user.imagesWithS3,
        videosWithS3: user.videosWithS3,
        totalSize: user.totalSize,
      },
      // Include sample of content (first 5 of each)
      sampleImages: user.images.slice(0, 5).map(img => ({
        id: img.id,
        filename: img.filename,
        awsS3Key: img.awsS3Key,
        awsS3Url: img.awsS3Url,
        fileSize: img.fileSize,
        createdAt: img.createdAt,
      })),
      sampleVideos: user.videos.slice(0, 5).map(vid => ({
        id: vid.id,
        filename: vid.filename,
        awsS3Key: vid.awsS3Key,
        awsS3Url: vid.awsS3Url,
        fileSize: vid.fileSize,
        createdAt: vid.createdAt,
      })),
    })),
  };

  // Write report to file
  const fs = await import("fs/promises");
  const reportPath = "./scripts/migration-analysis-report.json";
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ Detailed report saved to: ${reportPath}`);

  return report;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function main() {
  console.log("🚀 Starting Migration Data Analysis...\n");
  console.log("This script will analyze:");
  console.log("  1. AWS S3 bucket contents");
  console.log("  2. Database GeneratedImage/GeneratedVideo records");
  console.log("  3. Existing Vault data");
  console.log("  4. Migration requirements\n");

  try {
    // 1. S3 Bucket Overview
    const { allFiles, folderStats } = await getS3BucketOverview();

    // 2. Database Content Summary
    const contentSummaries = await getDatabaseContentSummary();

    // 3. Existing Vault Data
    const vaultSummaries = await getVaultSummary();

    // 4. Migration Requirements Check
    const requirements = await checkMigrationRequirements(contentSummaries);

    // 5. Export Detailed Report
    await exportDetailedReport(contentSummaries);

    console.log("\n" + "=".repeat(80));
    console.log("✅ ANALYSIS COMPLETE");
    console.log("=".repeat(80));
    console.log("\nNext steps:");
    console.log("  1. Review the migration-analysis-report.json file");
    console.log("  2. Decide on migration strategy for users without Instagram profiles");
    console.log("  3. Run the migration script when ready");

  } catch (error) {
    console.error("\n❌ Error during analysis:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
