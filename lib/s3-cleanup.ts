import { S3Client, DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'tastycreative';

/**
 * Delete a single file from S3
 */
export async function deleteFromS3(s3Key: string): Promise<boolean> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    await s3Client.send(command);
    console.log(`✅ Deleted from S3: ${s3Key}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete from S3: ${s3Key}`, error);
    return false;
  }
}

/**
 * Delete multiple files from S3 in batch (up to 1000 per batch)
 */
export async function deleteMultipleFromS3(s3Keys: string[]): Promise<{ 
  deleted: string[]; 
  failed: string[];
}> {
  if (s3Keys.length === 0) {
    return { deleted: [], failed: [] };
  }

  const deleted: string[] = [];
  const failed: string[] = [];

  // S3 DeleteObjects supports max 1000 keys per request
  const batchSize = 1000;
  const batches = [];
  
  for (let i = 0; i < s3Keys.length; i += batchSize) {
    batches.push(s3Keys.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    try {
      const command = new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: batch.map(key => ({ Key: key })),
          Quiet: false,
        },
      });

      const response = await s3Client.send(command);
      
      // Track successfully deleted
      if (response.Deleted) {
        deleted.push(...response.Deleted.map(d => d.Key!).filter(Boolean));
      }
      
      // Track failures
      if (response.Errors) {
        failed.push(...response.Errors.map(e => e.Key!).filter(Boolean));
      }
      
      console.log(`✅ Batch deleted ${response.Deleted?.length || 0} files from S3`);
      if (response.Errors && response.Errors.length > 0) {
        console.error(`❌ Failed to delete ${response.Errors.length} files from S3`);
      }
    } catch (error) {
      console.error(`❌ Batch delete failed for ${batch.length} files`, error);
      failed.push(...batch);
    }
  }

  return { deleted, failed };
}

/**
 * Delete all files in a profile's vault (by profileId)
 */
export async function deleteProfileVaultFiles(profileId: string): Promise<{
  deletedCount: number;
  failedCount: number;
}> {
  const { prisma } = await import("@/lib/database");
  
  try {
    // Get all vault items for this profile
    const vaultItems = await prisma.vaultItem.findMany({
      where: { profileId },
      select: { awsS3Key: true, id: true },
    });

    if (vaultItems.length === 0) {
      console.log(`No vault files to delete for profile: ${profileId}`);
      return { deletedCount: 0, failedCount: 0 };
    }

    console.log(`🗑️ Deleting ${vaultItems.length} vault files for profile: ${profileId}`);

    // Delete files from S3
    const s3Keys = vaultItems.map(item => item.awsS3Key);
    const { deleted, failed } = await deleteMultipleFromS3(s3Keys);

    console.log(`✅ Deleted ${deleted.length} files, ❌ Failed ${failed.length} files`);

    return {
      deletedCount: deleted.length,
      failedCount: failed.length,
    };
  } catch (error) {
    console.error(`❌ Error deleting profile vault files for ${profileId}:`, error);
    return { deletedCount: 0, failedCount: 0 };
  }
}
