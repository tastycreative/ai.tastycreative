/**
 * CDN utilities for converting S3 URLs to CDN URLs
 */

// CDN Configuration
const S3_BUCKET = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || 'tastycreative';
const AWS_REGION = process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1';
const CDN_DOMAIN = process.env.CDN_DOMAIN || 'cdn.tastycreative.xyz';

/**
 * Convert AWS S3 URL to CDN URL
 *
 * Transforms:
 * https://tastycreative.s3.us-east-1.amazonaws.com/path/to/file.jpg
 *
 * To:
 * https://cdn.tastycreative.xyz/path/to/file.jpg
 *
 * @param s3Url - The original S3 URL
 * @returns The CDN URL, or the original URL if conversion fails
 */
export function convertS3ToCdnUrl(s3Url: string | null | undefined): string {
  if (!s3Url) return '';

  try {
    // Parse the S3 URL
    const url = new URL(s3Url);

    // Check if this is an S3 URL
    const isS3Url =
      url.hostname.includes('.s3.') &&
      url.hostname.includes('.amazonaws.com');

    if (!isS3Url) {
      // Not an S3 URL, return as-is
      return s3Url;
    }

    // Extract the S3 key (path after the bucket)
    const s3Key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;

    // Construct CDN URL
    const cdnUrl = `https://${CDN_DOMAIN}/${s3Key}`;

    return cdnUrl;
  } catch (error) {
    console.error('Error converting S3 URL to CDN URL:', error);
    // Return original URL on error
    return s3Url;
  }
}

/**
 * Convert multiple S3 URLs to CDN URLs
 *
 * @param s3Urls - Array of S3 URLs
 * @returns Array of CDN URLs
 */
export function convertS3ArrayToCdnUrls(s3Urls: (string | null | undefined)[]): string[] {
  return s3Urls.map(convertS3ToCdnUrl);
}

/**
 * Check if a URL is an S3 URL
 *
 * @param url - The URL to check
 * @returns true if the URL is an S3 URL
 */
export function isS3Url(url: string | null | undefined): boolean {
  if (!url) return false;

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname.includes('.s3.') && parsedUrl.hostname.includes('.amazonaws.com');
  } catch {
    return false;
  }
}

/**
 * Check if a URL is already a CDN URL
 *
 * @param url - The URL to check
 * @returns true if the URL is already a CDN URL
 */
export function isCdnUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname === CDN_DOMAIN;
  } catch {
    return false;
  }
}

/**
 * Get optimized URL (CDN if available, otherwise S3)
 * Works with image/video objects from database
 *
 * @param media - Media object with awsS3Url, awsS3Key, or other URL fields
 * @returns The optimized URL (CDN > S3 > fallback)
 */
export function getOptimizedMediaUrl(media: {
  awsS3Url?: string | null;
  awsS3Key?: string | null;
  s3Key?: string | null;
  dataUrl?: string | null;
  url?: string | null;
}): string {
  // Priority 1: AWS S3 URL converted to CDN
  if (media.awsS3Url) {
    return convertS3ToCdnUrl(media.awsS3Url);
  }

  // Priority 2: Construct from AWS S3 Key
  if (media.awsS3Key) {
    return `https://${CDN_DOMAIN}/${media.awsS3Key}`;
  }

  // Priority 3: Legacy RunPod S3 (keep as-is, needs different handling)
  if (media.s3Key) {
    return `/api/media/s3/${encodeURIComponent(media.s3Key)}`;
  }

  // Priority 4: Data URL or regular URL
  if (media.dataUrl) {
    return media.dataUrl;
  }

  if (media.url) {
    return media.url;
  }

  return '';
}
