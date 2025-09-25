/**
 * S3 URL utilities for RunPod network volume storage
 * Builds signed and public URLs for accessing stored images
 */

// S3 Configuration - These should match your handler configuration
const S3_ENDPOINT = 'https://s3api-us-ks-2.runpod.io';
const S3_BUCKET = '83cljmpqfd';
const S3_REGION = 'us-ks-2';

/**
 * Build a direct S3 URL for accessing images
 * Note: This assumes the bucket allows public read access or you have proper CORS setup
 */
export function buildS3ImageUrl(s3Key: string): string {
  if (!s3Key) {
    return '';
  }

  // Remove leading slash if present
  const cleanKey = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key;
  
  // Build the direct S3 URL
  return `${S3_ENDPOINT}/${S3_BUCKET}/${cleanKey}`;
}

/**
 * Build a signed S3 URL (if you need authenticated access)
 * This would require AWS SDK and proper credentials
 */
export async function buildSignedS3Url(s3Key: string, expiresIn: number = 3600): Promise<string> {
  // For now, return the direct URL
  // In the future, you could implement signed URLs here if needed
  return buildS3ImageUrl(s3Key);
}

/**
 * Extract the S3 key from various path formats
 */
export function extractS3Key(path: string | null | undefined): string | null {
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
 * Check if an image has S3 storage available
 */
export function hasS3Storage(image: { s3Key?: string | null; networkVolumePath?: string | null }): boolean {
  return !!(image.s3Key || image.networkVolumePath);
}

/**
 * Get the best available image URL
 * Priority: S3 proxy URL > Database blob URL > Fallback
 */
export function getBestImageUrl(image: {
  s3Key?: string | null;
  networkVolumePath?: string | null;
  dataUrl?: string | null;
  url?: string | null;
  id: string;
  filename: string;
}): string {
  // Try S3 first - use API proxy for authenticated access
  if (image.s3Key) {
    return `/api/images/s3/${encodeURIComponent(image.s3Key)}`;
  }
  
  // Try network volume path
  if (image.networkVolumePath) {
    const s3Key = extractS3Key(image.networkVolumePath);
    if (s3Key) {
      return `/api/images/s3/${encodeURIComponent(s3Key)}`;
    }
  }
  
  // Fall back to database URL
  if (image.dataUrl) {
    return image.dataUrl;
  }
  
  // Fall back to legacy URL
  if (image.url) {
    return image.url;
  }
  
  // Last resort: API endpoint for database blob
  return `/api/images/${image.id}`;
}

/**
 * Validate that an S3 URL is accessible (optional utility)
 */
export async function validateS3Url(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}