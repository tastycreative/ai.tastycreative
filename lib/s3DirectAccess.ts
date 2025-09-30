/**
 * Direct S3 access utilities for RunPod network volume
 * NOTE: RunPod S3 API does NOT support signed URLs (GeneratePresignedURL operation)
 * This utility focuses on direct URLs and optimized proxy strategies
 */

import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// S3 Configuration for RunPod Network Volume
const S3_ENDPOINT = 'https://s3api-us-ks-2.runpod.io';
const S3_BUCKET = process.env.RUNPOD_S3_BUCKET_NAME || '83cljmpqfd';
const S3_REGION = 'us-ks-2';

// Initialize S3 client
function getS3Client() {
  return new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.RUNPOD_S3_ACCESS_KEY || '',
      secretAccessKey: process.env.RUNPOD_S3_SECRET_KEY || ''
    },
    forcePathStyle: true
  });
}

/**
 * Generate a direct S3 URL (since signed URLs are not supported by RunPod)
 * NOTE: This requires the bucket to have public read access configured
 */
export function generateDirectUrl(s3Key: string): string {
  if (!s3Key) return '';
  
  const cleanKey = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key;
  const directUrl = `${S3_ENDPOINT}/${S3_BUCKET}/${cleanKey}`;
  
  console.log(`✅ Generated direct S3 URL for: ${s3Key}`);
  return directUrl;
}

/**
 * Generate direct URLs for multiple S3 keys in batch
 */
export function generateBatchDirectUrls(s3Keys: string[]): Record<string, string> {
  const results: Record<string, string> = {};
  
  s3Keys.forEach(s3Key => {
    if (s3Key) {
      results[s3Key] = generateDirectUrl(s3Key);
    }
  });
  
  console.log(`✅ Generated ${Object.keys(results).length} direct S3 URLs`);
  return results;
}

/**
 * Build direct S3 URL (if bucket allows public access)
 * WARNING: Only use if your bucket is configured for public read access
 */
export function buildDirectS3Url(s3Key: string): string {
  if (!s3Key) return '';
  
  const cleanKey = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key;
  return `${S3_ENDPOINT}/${S3_BUCKET}/${cleanKey}`;
}

/**
 * Check if S3 object exists without downloading it
 * Uses HeadObject for efficient existence checking
 */
export async function checkS3ObjectExists(s3Key: string): Promise<boolean> {
  try {
    const s3Client = getS3Client();
    
    // Use HeadObject to check existence without downloading the full object
    const command = new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key
    });
    
    await s3Client.send(command);
    return true;
    
  } catch (error: any) {
    if (error?.name === 'NoSuchKey' || error?.$response?.statusCode === 404) {
      return false;
    }
    console.error(`❌ Error checking S3 object ${s3Key}:`, error);
    return false;
  }
}

/**
 * Get the best URL for an image/video with S3 optimization
 * Priority: Direct S3 URL > Database URL > Vercel proxy (fallback)
 */
export async function getOptimizedMediaUrl(media: {
  s3Key?: string | null;
  networkVolumePath?: string | null;
  dataUrl?: string | null;
  url?: string | null;
  id: string;
  filename: string;
  type?: 'image' | 'video';
}): Promise<string> {
  
  // Extract S3 key from various sources
  let s3Key = media.s3Key;
  if (!s3Key && media.networkVolumePath) {
    s3Key = extractS3KeyFromPath(media.networkVolumePath);
  }
  
  // Try direct S3 URL first (if bucket is public or CORS configured)
  if (s3Key) {
    try {
      // Check if object exists
      const exists = await checkS3ObjectExists(s3Key);
      if (exists) {
        // Return direct S3 URL - fastest option if accessible
        return generateDirectUrl(s3Key);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to check S3 object ${s3Key}, falling back`);
    }
  }
  
  // Fallback to database URL
  if (media.dataUrl) {
    return media.dataUrl;
  }
  
  // Fallback to legacy URL
  if (media.url) {
    return media.url;
  }
  
  // Last resort: Vercel proxy (what we're trying to avoid, but necessary for private buckets)
  if (media.type === 'video') {
    return `/api/videos/s3/${encodeURIComponent(s3Key || media.id)}`;
  } else {
    return `/api/images/s3/${encodeURIComponent(s3Key || media.id)}`;
  }
}

/**
 * Extract S3 key from network volume path
 */
function extractS3KeyFromPath(path: string): string | null {
  if (!path) return null;
  
  // If it's already an S3 key format (outputs/userId/filename), return as-is
  if (path.startsWith('outputs/')) {
    return path;
  }
  
  // If it's a full network volume path (/runpod-volume/outputs/...), extract the key
  if (path.includes('/runpod-volume/outputs/')) {
    const parts = path.split('/runpod-volume/');
    if (parts.length > 1) {
      return parts[1]; // Everything after /runpod-volume/
    }
  }
  
  // If it starts with a slash, remove it
  if (path.startsWith('/')) {
    return path.slice(1);
  }
  
  return path;
}

/**
 * Get appropriate content type for file
 */
function getContentType(filename: string, type?: 'image' | 'video'): string {
  const ext = filename.toLowerCase().split('.').pop() || '';
  
  if (type === 'video') {
    switch (ext) {
      case 'mp4': return 'video/mp4';
      case 'webm': return 'video/webm';
      case 'mov': return 'video/quicktime';
      case 'avi': return 'video/x-msvideo';
      case 'gif': return 'image/gif';
      default: return 'video/mp4';
    }
  } else {
    switch (ext) {
      case 'png': return 'image/png';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'webp': return 'image/webp';
      case 'gif': return 'image/gif';
      default: return 'image/png';
    }
  }
}

/**
 * Validate S3 configuration
 */
export function validateS3Config(): boolean {
  const requiredEnvs = [
    'RUNPOD_S3_ACCESS_KEY',
    'RUNPOD_S3_SECRET_KEY',
    'RUNPOD_S3_BUCKET_NAME'
  ];
  
  const missing = requiredEnvs.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.error(`❌ Missing required S3 environment variables: ${missing.join(', ')}`);
    return false;
  }
  
  return true;
}