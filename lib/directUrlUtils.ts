/**
 * Direct URL utilities to eliminate Vercel bandwidth usage
 * Prioritizes direct S3 access over proxy endpoints
 */

// AWS S3 Configuration for direct public access
const AWS_S3_BUCKET = process.env.NEXT_PUBLIC_AWS_S3_BUCKET || process.env.NEXT_PUBLIC_S3_BUCKET || 'tastycreative';
const AWS_REGION = process.env.NEXT_PUBLIC_AWS_REGION || process.env.NEXT_PUBLIC_S3_REGION || 'us-east-1';

/**
 * Generate direct AWS S3 URL (fastest option - no bandwidth usage)
 */
export function generateDirectAwsUrl(s3Key: string): string {
  if (!s3Key) return '';
  
  const cleanKey = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key;
  return `https://${AWS_S3_BUCKET}.s3.amazonaws.com/${cleanKey}`;
}

/**
 * Generate AWS CloudFront URL (if CDN is configured)
 * Even faster than direct S3 for global access
 */
export function generateCloudFrontUrl(s3Key: string): string {
  const cloudFrontDomain = process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN;
  if (!cloudFrontDomain || !s3Key) return generateDirectAwsUrl(s3Key);
  
  const cleanKey = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key;
  return `https://${cloudFrontDomain}/${cleanKey}`;
}

/**
 * Check if media uses new AWS S3 storage (direct URLs available)
 */
export function hasDirectAwsAccess(media: {
  awsS3Key?: string | null;
  awsS3Url?: string | null;
}): boolean {
  return !!(media.awsS3Key || media.awsS3Url);
}

/**
 * Check if media uses legacy RunPod storage (requires proxy)
 */
export function requiresProxy(media: {
  s3Key?: string | null;
  networkVolumePath?: string | null;
  awsS3Key?: string | null;
  awsS3Url?: string | null;
}): boolean {
  return !hasDirectAwsAccess(media) && !!(media.s3Key || media.networkVolumePath);
}

/**
 * Get the most bandwidth-efficient URL for any media
 * Priority: Direct AWS S3 > Proxy for legacy content
 */
export function getBestMediaUrl(media: {
  awsS3Key?: string | null;
  awsS3Url?: string | null;
  s3Key?: string | null;
  networkVolumePath?: string | null;
  dataUrl?: string | null;
  url?: string | null;
  id: string;
  filename: string;
  type?: string; // More flexible type handling
}): string {
  
  // Determine if this is a video based on filename or type
  const isVideo = media.type === 'video' || 
                  media.filename.toLowerCase().match(/\.(mp4|webm|avi|mov|mkv|m4v)$/);
  
  // Priority 1: Direct AWS S3 URL (already stored)
  if (media.awsS3Url) {
    console.log(`🚀 Using direct AWS URL for ${media.filename}:`, media.awsS3Url);
    return media.awsS3Url;
  }
  
  // Priority 2: Generate direct AWS S3 URL from key
  if (media.awsS3Key) {
    const directUrl = generateDirectAwsUrl(media.awsS3Key);
    console.log(`🚀 Generated direct AWS URL for ${media.filename}:`, directUrl);
    return directUrl;
  }
  
  // Priority 3: Legacy RunPod S3 (requires proxy - bandwidth usage)
  if (media.s3Key) {
    const proxyUrl = isVideo 
      ? `/api/videos/s3/${encodeURIComponent(media.s3Key)}`
      : `/api/images/s3/${encodeURIComponent(media.s3Key)}`;
    console.log(`⚠️ Using proxy for legacy RunPod content ${media.filename}:`, proxyUrl);
    return proxyUrl;
  }
  
  // Priority 4: Network volume path (requires proxy)
  if (media.networkVolumePath) {
    const proxyUrl = isVideo
      ? `/api/videos/${media.id}/data`
      : `/api/images/${media.id}/network-volume`;
    console.log(`⚠️ Using proxy for network volume ${media.filename}:`, proxyUrl);
    return proxyUrl;
  }
  
  // Priority 5: Database blob (requires API endpoint)
  if (media.dataUrl && media.dataUrl.startsWith('/api/')) {
    console.log(`📦 Using database API for ${media.filename}:`, media.dataUrl);
    return media.dataUrl;
  }
  
  // Priority 6: Direct data URL (base64)
  if (media.dataUrl) {
    console.log(`💾 Using base64 data URL for ${media.filename}`);
    return media.dataUrl;
  }
  
  // Priority 7: Legacy ComfyUI URL
  if (media.url) {
    console.log(`🔗 Using legacy URL for ${media.filename}:`, media.url);
    return media.url;
  }
  
  // Fallback: API endpoint
  const fallbackUrl = isVideo 
    ? `/api/videos/${media.id}/data`
    : `/api/images/${media.id}`;
  console.log(`🆘 Using fallback API for ${media.filename}:`, fallbackUrl);
  return fallbackUrl;
}

/**
 * Get bandwidth usage statistics
 */
export function getBandwidthStats(mediaList: Array<{
  awsS3Key?: string | null;
  awsS3Url?: string | null;
  s3Key?: string | null;
  networkVolumePath?: string | null;
  dataUrl?: string | null;
  url?: string | null;
  id: string;
  filename: string;
  type?: string; // More flexible type
}>): {
  directAccess: number;
  requiresProxy: number;
  percentDirect: number;
} {
  const directAccess = mediaList.filter(hasDirectAwsAccess).length;
  const requiresProxyCount = mediaList.filter(requiresProxy).length;
  const percentDirect = mediaList.length > 0 ? (directAccess / mediaList.length) * 100 : 0;
  
  return {
    directAccess,
    requiresProxy: requiresProxyCount,
    percentDirect: Math.round(percentDirect * 100) / 100
  };
}

/**
 * Optimize URL for download (prefer direct URLs to avoid proxy bandwidth)
 */
export function getDownloadUrl(media: {
  awsS3Key?: string | null;
  awsS3Url?: string | null;
  s3Key?: string | null;
  networkVolumePath?: string | null;
  dataUrl?: string | null;
  url?: string | null;
  id: string;
  filename: string;
  type?: string; // More flexible type
}): string {
  // For downloads, prioritize direct URLs even more strongly
  if (media.awsS3Url || media.awsS3Key) {
    return getBestMediaUrl(media);
  }
  
  // For legacy content, we might need to use proxy endpoints for downloads
  // but at least we're being explicit about the bandwidth cost
  return getBestMediaUrl(media);
}