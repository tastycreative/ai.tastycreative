/**
 * S3 URL utilities for RunPod network volume storage
 * Optimized to reduce Vercel fast data transfer usage
 * NOTE: RunPod S3 API does NOT support signed URLs (GeneratePresignedURL operation)
 */

// S3 Configuration - These should match your handler configuration
const S3_ENDPOINT = 'https://s3api-us-ks-2.runpod.io';
const S3_BUCKET = '83cljmpqfd';
const S3_REGION = 'us-ks-2';

/**
 * Build a direct S3 URL for accessing files
 * NOTE: This requires the bucket to have public read access or proper CORS setup
 */
export function buildDirectS3Url(s3Key: string): string {
  if (!s3Key) {
    return '';
  }

  // Remove leading slash if present
  const cleanKey = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key;
  
  // Build the direct S3 URL
  return `${S3_ENDPOINT}/${S3_BUCKET}/${cleanKey}`;
}

/**
 * Build an optimized proxy URL through the new unified media endpoint
 * This reduces the number of different proxy routes and optimizes streaming
 */
export function buildOptimizedProxyUrl(s3Key: string): string {
  if (!s3Key) {
    return '';
  }

  const cleanKey = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key;
  return `/api/media/s3/${encodeURIComponent(cleanKey)}`;
}

/**
 * Build a signed S3 URL (DEPRECATED - RunPod doesn't support this)
 * Kept for backward compatibility but will return direct URL
 */
export async function buildSignedS3Url(s3Key: string, expiresIn: number = 3600): Promise<string> {
  console.warn('⚠️ Signed URLs are not supported by RunPod S3 API. Returning direct URL instead.');
  return buildDirectS3Url(s3Key);
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
 * Check if an image has S3 storage available (AWS S3 or legacy RunPod S3)
 */
export function hasS3Storage(image: { 
  awsS3Key?: string | null; 
  awsS3Url?: string | null;
  s3Key?: string | null; 
  networkVolumePath?: string | null 
}): boolean {
  return !!(image.awsS3Key || image.awsS3Url || image.s3Key || image.networkVolumePath);
}

/**
 * Get the best available URL with optimization strategies
 * Strategy 1: Try AWS S3 URL (fastest, direct access)
 * Strategy 2: Try direct RunPod S3 URL (legacy)
 * Strategy 3: Use optimized proxy (streaming, better caching)
 * Strategy 4: Fall back to database URLs
 */
export function getBestImageUrl(image: {
  awsS3Key?: string | null;
  awsS3Url?: string | null;
  s3Key?: string | null;
  networkVolumePath?: string | null;
  dataUrl?: string | null;
  url?: string | null;
  id: string;
  filename: string;
}, strategy: 'direct' | 'proxy' | 'auto' = 'auto'): string {
  
  // Priority 1: AWS S3 direct URL
  if (image.awsS3Url) {
    console.log(`🚀 Using AWS S3 URL for ${image.filename}:`, image.awsS3Url);
    return image.awsS3Url;
  }
  
  // Priority 2: AWS S3 key (construct URL)
  if (image.awsS3Key) {
    const awsS3Url = `https://tastycreative.s3.amazonaws.com/${image.awsS3Key}`;
    console.log(`🚀 Using AWS S3 key for ${image.filename}:`, awsS3Url);
    return awsS3Url;
  }
  
  // Priority 3: Legacy RunPod S3 system
  const s3Key = image.s3Key || extractS3Key(image.networkVolumePath);
  
  if (s3Key) {
    switch (strategy) {
      case 'direct':
        // Direct S3 URL - fastest but requires public bucket or CORS
        return buildDirectS3Url(s3Key);
        
      case 'proxy':
        // Optimized proxy - supports private buckets, streaming, better caching
        return buildOptimizedProxyUrl(s3Key);
        
      case 'auto':
      default:
        // Auto-detect: try direct first, fallback to proxy
        // You could add logic here to test direct access and fallback
        // For now, use proxy as it's more reliable for private buckets
        return buildOptimizedProxyUrl(s3Key);
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
  
  // Last resort: legacy API endpoint for database blob
  return `/api/images/${image.id}`;
}

/**
 * Get video URL with streaming optimization
 */
export function getBestVideoUrl(video: {
  s3Key?: string | null;
  networkVolumePath?: string | null;
  dataUrl?: string | null;
  url?: string | null;
  id: string;
  filename: string;
}, strategy: 'direct' | 'proxy' | 'auto' = 'auto'): string {
  
  const s3Key = video.s3Key || extractS3Key(video.networkVolumePath);
  
  if (s3Key) {
    switch (strategy) {
      case 'direct':
        return buildDirectS3Url(s3Key);
        
      case 'proxy':
        // Use optimized proxy with range request support for video streaming
        return buildOptimizedProxyUrl(s3Key);
        
      case 'auto':
      default:
        // For videos, prefer proxy to ensure range request support
        return buildOptimizedProxyUrl(s3Key);
    }
  }
  
  // Fall back to database URL
  if (video.dataUrl) {
    return video.dataUrl;
  }
  
  if (video.url) {
    return video.url;
  }
  
  // Last resort: legacy API endpoint
  return `/api/videos/${video.id}`;
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