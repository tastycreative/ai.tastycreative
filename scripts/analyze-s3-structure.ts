/**
 * Analyze S3 Outputs Structure
 * 
 * This script analyzes the folder structure in the outputs/ folder
 * to understand how files are organized per user.
 * 
 * Run with: npx tsx scripts/analyze-s3-structure.ts
 */

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { PrismaClient } from "../lib/generated/prisma";

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
}

interface FolderStructure {
  [folder: string]: {
    fileCount: number;
    totalSize: number;
    files: S3FileInfo[];
  };
}

interface UserS3Structure {
  clerkId: string;
  email: string | null;
  totalFiles: number;
  totalSize: number;
  folders: FolderStructure;
  rootFiles: S3FileInfo[]; // Files not in any subfolder
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
            lastModified: obj.LastModified || new Date(),
          });
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return files;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function analyzeOutputsStructure() {
  console.log("🔍 Analyzing S3 outputs/ folder structure...\n");

  // Get all files in outputs/
  const allFiles = await listS3Objects("outputs/");
  console.log(`Total files in outputs/: ${allFiles.length}`);
  console.log(`Total size: ${formatBytes(allFiles.reduce((sum, f) => sum + f.size, 0))}\n`);

  // Get all users from database
  const users = await prisma.user.findMany({
    select: {
      clerkId: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  const userMap = new Map(users.map(u => [u.clerkId, u]));

  // Analyze structure - outputs/{clerkId}/... or outputs/{filename}
  const userStructures: Map<string, UserS3Structure> = new Map();
  const orphanFiles: S3FileInfo[] = []; // Files not belonging to any user

  for (const file of allFiles) {
    // Parse the key: outputs/{clerkId}/{folder}/{filename} or outputs/{clerkId}/{filename} or outputs/{filename}
    const parts = file.key.split("/");
    
    if (parts.length < 2) continue; // Skip if malformed
    
    // parts[0] = "outputs"
    // parts[1] = could be clerkId or filename
    
    const potentialClerkId = parts[1];
    
    // Check if this is a user folder (clerkId starts with "user_")
    if (potentialClerkId && (potentialClerkId.startsWith("user_") || userMap.has(potentialClerkId))) {
      const clerkId = potentialClerkId;
      
      if (!userStructures.has(clerkId)) {
        const user = userMap.get(clerkId);
        userStructures.set(clerkId, {
          clerkId,
          email: user?.email || null,
          totalFiles: 0,
          totalSize: 0,
          folders: {},
          rootFiles: [],
        });
      }
      
      const userStruct = userStructures.get(clerkId)!;
      userStruct.totalFiles++;
      userStruct.totalSize += file.size;
      
      if (parts.length === 3) {
        // outputs/{clerkId}/{filename} - root level file
        userStruct.rootFiles.push(file);
      } else if (parts.length >= 4) {
        // outputs/{clerkId}/{folder}/... - file in subfolder
        const folderName = parts[2];
        
        if (!userStruct.folders[folderName]) {
          userStruct.folders[folderName] = {
            fileCount: 0,
            totalSize: 0,
            files: [],
          };
        }
        
        userStruct.folders[folderName].fileCount++;
        userStruct.folders[folderName].totalSize += file.size;
        userStruct.folders[folderName].files.push(file);
      }
    } else {
      // File directly in outputs/ without user folder
      orphanFiles.push(file);
    }
  }

  // Print analysis
  console.log("=" .repeat(100));
  console.log("📂 USER FOLDER STRUCTURES");
  console.log("=".repeat(100));

  const sortedUsers = Array.from(userStructures.values()).sort((a, b) => b.totalFiles - a.totalFiles);

  for (const user of sortedUsers) {
    console.log(`\n👤 ${user.email || user.clerkId}`);
    console.log(`   ClerkId: ${user.clerkId}`);
    console.log(`   Total Files: ${user.totalFiles} (${formatBytes(user.totalSize)})`);
    console.log(`   Root Files (no folder): ${user.rootFiles.length}`);
    
    const folderNames = Object.keys(user.folders).sort();
    if (folderNames.length > 0) {
      console.log(`   Subfolders: ${folderNames.length}`);
      console.log("   " + "-".repeat(70));
      
      for (const folderName of folderNames) {
        const folder = user.folders[folderName];
        console.log(`     📁 ${folderName.padEnd(40)} ${folder.fileCount.toString().padStart(6)} files  ${formatBytes(folder.totalSize).padStart(12)}`);
      }
    }
  }

  if (orphanFiles.length > 0) {
    console.log("\n" + "=".repeat(100));
    console.log("⚠️  ORPHAN FILES (not in user folders)");
    console.log("=".repeat(100));
    console.log(`Count: ${orphanFiles.length}`);
    console.log(`Size: ${formatBytes(orphanFiles.reduce((sum, f) => sum + f.size, 0))}`);
    console.log("\nSample files:");
    for (const file of orphanFiles.slice(0, 20)) {
      console.log(`  - ${file.key}`);
    }
    if (orphanFiles.length > 20) {
      console.log(`  ... and ${orphanFiles.length - 20} more`);
    }
  }

  // Also check database records to see S3 key patterns
  console.log("\n" + "=".repeat(100));
  console.log("🗃️  DATABASE S3 KEY PATTERNS");
  console.log("=".repeat(100));

  const sampleImages = await prisma.generatedImage.findMany({
    where: { awsS3Key: { not: null } },
    select: { awsS3Key: true, clerkId: true },
    take: 50,
  });

  const keyPatterns: Record<string, number> = {};
  for (const img of sampleImages) {
    if (img.awsS3Key) {
      const parts = img.awsS3Key.split("/");
      const pattern = parts.length >= 3 
        ? `${parts[0]}/${parts[1] === img.clerkId ? '{clerkId}' : parts[1]}/${parts.length > 3 ? '{folder}/' : ''}{filename}`
        : img.awsS3Key;
      keyPatterns[pattern] = (keyPatterns[pattern] || 0) + 1;
    }
  }

  console.log("\nS3 Key patterns found in GeneratedImage:");
  for (const [pattern, count] of Object.entries(keyPatterns).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pattern}: ${count} occurrences`);
  }

  // Export detailed structure for migration planning
  const exportData = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalFiles: allFiles.length,
      totalSize: allFiles.reduce((sum, f) => sum + f.size, 0),
      usersWithFolders: userStructures.size,
      orphanFiles: orphanFiles.length,
    },
    users: sortedUsers.map(u => ({
      clerkId: u.clerkId,
      email: u.email,
      totalFiles: u.totalFiles,
      totalSize: u.totalSize,
      rootFileCount: u.rootFiles.length,
      folders: Object.entries(u.folders).map(([name, data]) => ({
        name,
        fileCount: data.fileCount,
        totalSize: data.totalSize,
      })),
    })),
    orphanFiles: orphanFiles.map(f => f.key),
  };

  const fs = await import("fs/promises");
  await fs.writeFile("./scripts/s3-structure-analysis.json", JSON.stringify(exportData, null, 2));
  console.log("\n✅ Detailed structure exported to: scripts/s3-structure-analysis.json");

  return { userStructures, orphanFiles };
}

async function main() {
  try {
    await analyzeOutputsStructure();
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
