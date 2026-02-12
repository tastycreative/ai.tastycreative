/**
 * AWS S3 utilities for direct media storage
 * Eliminates Vercel bandwidth usage completely
 */

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// AWS S3 Configuration
const AWS_REGION = process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || '';

// Initialize AWS S3 client
function getAwsS3Client() {
  return new S3Client({
    region: AWS_REGION,
    credentials: {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || ''
    }
  });
}

/**
 * Upload image to AWS S3 with organization-based folder structure
 */
export async function uploadToAwsS3(
  imageData: Buffer | Uint8Array,
  userId: string,
  filename: string,
  contentType: string = 'image/png',
  options?: {
    organizationSlug?: string;
    type?: 'images' | 'videos';
  }
): Promise<{ success: boolean; s3Key?: string; publicUrl?: string; error?: string }> {
  try {
    const s3Client = getAwsS3Client();

    // Create organization-based S3 key structure:
    // - With org: organizations/{organizationSlug}/user_{userId}/{type}/{filename}
    // - Without org (fallback): outputs/{userId}/{filename}
    let s3Key: string;
    if (options?.organizationSlug) {
      const typeFolder = options.type || 'images';
      s3Key = `organizations/${options.organizationSlug}/user_${userId}/${typeFolder}/${filename}`;
    } else {
      s3Key = `outputs/${userId}/${filename}`;
    }

    console.log(`📤 Uploading to AWS S3: ${s3Key}`);

    const command = new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: s3Key,
      Body: imageData,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1 year cache
      // Note: ACL removed - bucket uses bucket policy for public access instead
    });

    await s3Client.send(command);

    // Generate public URL
    const publicUrl = `https://${AWS_S3_BUCKET}.s3.amazonaws.com/${s3Key}`;

    console.log(`✅ Successfully uploaded to AWS S3: ${publicUrl}`);

    return {
      success: true,
      s3Key,
      publicUrl
    };

  } catch (error) {
    console.error(`❌ AWS S3 upload error for ${filename}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate signed URL for private access (alternative to public URLs)
 */
export async function generateAwsSignedUrl(
  s3Key: string, 
  expiresIn: number = 3600
): Promise<string> {
  try {
    const s3Client = getAwsS3Client();
    
    const command = new GetObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: s3Key
    });
    
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    
    console.log(`✅ Generated AWS signed URL for: ${s3Key} (expires in ${expiresIn}s)`);
    return signedUrl;
    
  } catch (error) {
    console.error(`❌ Error generating AWS signed URL for ${s3Key}:`, error);
    throw error;
  }
}

/**
 * Generate direct public URL (fastest - no Vercel bandwidth)
 */
export function generateAwsPublicUrl(s3Key: string): string {
  if (!s3Key) return '';
  
  const cleanKey = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key;
  return `https://${AWS_S3_BUCKET}.s3.amazonaws.com/${cleanKey}`;
}

/**
 * Check if object exists in AWS S3
 */
export async function checkAwsS3ObjectExists(s3Key: string): Promise<boolean> {
  try {
    const s3Client = getAwsS3Client();
    
    const command = new HeadObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: s3Key
    });
    
    await s3Client.send(command);
    return true;
    
  } catch (error: any) {
    if (error?.name === 'NotFound' || error?.$response?.statusCode === 404) {
      return false;
    }
    console.error(`❌ Error checking AWS S3 object ${s3Key}:`, error);
    return false;
  }
}

/**
 * Delete object from AWS S3
 */
export async function deleteFromAwsS3(s3Key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const s3Client = getAwsS3Client();
    
    console.log(`🗑️ Deleting from AWS S3: ${s3Key}`);
    
    const command = new DeleteObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: s3Key
    });
    
    await s3Client.send(command);
    
    console.log(`✅ Successfully deleted from AWS S3: ${s3Key}`);
    
    return {
      success: true
    };
    
  } catch (error) {
    console.error(`❌ AWS S3 delete error for ${s3Key}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get optimized image URL with AWS S3 priority
 */
export function getOptimizedImageUrl(image: {
  awsS3Key?: string | null;
  awsS3Url?: string | null;
  s3Key?: string | null;
  networkVolumePath?: string | null;
  dataUrl?: string | null;
  url?: string | null;
  id: string;
  filename: string;
}): string {
  
  // Priority 1: AWS S3 public URL (fastest, no bandwidth usage)
  if (image.awsS3Url) {
    return image.awsS3Url;
  }
  
  if (image.awsS3Key) {
    return generateAwsPublicUrl(image.awsS3Key);
  }
  
  // Priority 2: RunPod S3 (existing fallback)
  if (image.s3Key) {
    return `/api/media/s3/${encodeURIComponent(image.s3Key)}`;
  }
  
  // Priority 3: Database URLs
  if (image.dataUrl) {
    return image.dataUrl;
  }
  
  if (image.url) {
    return image.url;
  }
  
  // Last resort: API endpoint
  return `/api/images/${image.id}`;
}

/**
 * Validate AWS S3 configuration
 */
export function validateAwsS3Config(): boolean {
  const requiredEnvs = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_S3_BUCKET',
    'AWS_REGION'
  ];

  const missing = requiredEnvs.filter(env => !process.env[env]);

  if (missing.length > 0) {
    console.error(`❌ Missing required AWS S3 environment variables: ${missing.join(', ')}`);
    return false;
  }

  return true;
}

/**
 * Extract organization slug from S3 key
 * Supports both new (org-based) and legacy formats
 */
export function extractOrganizationSlugFromS3Key(s3Key: string): string | null {
  // New format: organizations/{organizationSlug}/user_{userId}/{type}/{filename}
  const orgMatch = s3Key.match(/^organizations\/([^/]+)\//);
  if (orgMatch) {
    return orgMatch[1];
  }

  // Legacy org_id format: org_{organizationId}/user_{userId}/{type}/{filename}
  const legacyOrgMatch = s3Key.match(/^org_([^/]+)\//);
  if (legacyOrgMatch) {
    return legacyOrgMatch[1];
  }

  // Legacy format: outputs/{userId}/{filename} - no org slug
  return null;
}

/**
 * Extract user ID from S3 key
 */
export function extractUserIdFromS3Key(s3Key: string): string | null {
  // New format: organizations/{organizationSlug}/user_{userId}/{type}/{filename}
  // Or legacy: org_{organizationId}/user_{userId}/{type}/{filename}
  const newMatch = s3Key.match(/\/user_([^/]+)\//);
  if (newMatch) {
    return newMatch[1];
  }

  // Legacy format: outputs/{userId}/{filename}
  const legacyMatch = s3Key.match(/^outputs\/([^/]+)\//);
  if (legacyMatch) {
    return legacyMatch[1];
  }

  return null;
}

/**
 * Build S3 key from components (helper for uploads)
 */
export function buildS3Key(
  userId: string,
  filename: string,
  options?: {
    organizationSlug?: string;
    type?: 'images' | 'videos';
  }
): string {
  if (options?.organizationSlug) {
    const typeFolder = options.type || 'images';
    return `organizations/${options.organizationSlug}/user_${userId}/${typeFolder}/${filename}`;
  }
  return `outputs/${userId}/${filename}`;
}