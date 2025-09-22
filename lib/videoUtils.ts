// lib/videoUtils.ts - Video optimization utilities for bandwidth reduction

export interface VideoOptimizationOptions {
  quality?: 'low' | 'medium' | 'high' | 'original'; // Compression level
  format?: 'auto' | 'mp4' | 'webm'; // Video format
  resolution?: 'auto' | '480p' | '720p' | '1080p' | 'original'; // Video resolution
  bitrate?: number; // Target bitrate in kbps
}

/**
 * Check if a video has S3 storage available
 */
export function hasS3VideoStorage(video: { 
  s3Key?: string | null; 
  networkVolumePath?: string | null 
}): boolean {
  return !!(video.s3Key || video.networkVolumePath);
}

/**
 * Extract S3 key from network volume path
 */
export function extractVideoS3Key(path: string | null | undefined): string | null {
  if (!path) return null;
  
  // Handle RunPod network volume paths like: /runpod-volume/outputs/user_123/video.mp4
  if (path.includes('/runpod-volume/')) {
    const match = path.match(/\/runpod-volume\/(.+)/);
    return match ? match[1] : null;
  }
  
  // Handle direct S3 paths like: outputs/user_123/video.mp4
  if (path.startsWith('outputs/')) {
    return path;
  }
  
  return null;
}

/**
 * Get optimized video URL with compression parameters
 */
function getOptimizedVideoUrl(baseUrl: string, options: VideoOptimizationOptions): string {
  const url = new URL(baseUrl, window.location.origin);
  
  if (options.quality && options.quality !== 'original') {
    url.searchParams.set('quality', options.quality);
  }
  
  if (options.format && options.format !== 'auto') {
    url.searchParams.set('format', options.format);
  }
  
  if (options.resolution && options.resolution !== 'auto') {
    url.searchParams.set('resolution', options.resolution);
  }
  
  if (options.bitrate) {
    url.searchParams.set('bitrate', options.bitrate.toString());
  }
  
  return url.toString();
}

/**
 * Get the best available video URL with optimization options
 * Priority: S3 proxy URL > Database blob URL > Fallback
 */
export function getBestVideoUrl(
  video: {
    s3Key?: string | null;
    networkVolumePath?: string | null;
    dataUrl?: string | null;
    url?: string | null;
    id: string;
    filename: string;
  },
  options?: VideoOptimizationOptions
): string {
  // Try S3 first - use API proxy for authenticated access and compression
  if (video.s3Key) {
    const baseUrl = `/api/videos/s3/${encodeURIComponent(video.s3Key)}`;
    return options ? getOptimizedVideoUrl(baseUrl, options) : baseUrl;
  }
  
  // Try network volume path
  if (video.networkVolumePath) {
    const s3Key = extractVideoS3Key(video.networkVolumePath);
    if (s3Key) {
      const baseUrl = `/api/videos/s3/${encodeURIComponent(s3Key)}`;
      return options ? getOptimizedVideoUrl(baseUrl, options) : baseUrl;
    }
  }
  
  // Fall back to database URL (no optimization available for database blobs)
  if (video.dataUrl) {
    return video.dataUrl;
  }
  
  // Fall back to legacy URL
  if (video.url) {
    return video.url;
  }
  
  // Last resort: API endpoint for database blob
  return `/api/videos/${video.id}`;
}

/**
 * Get multiple optimized video URLs for different quality levels
 */
export function getProgressiveVideoUrls(video: {
  s3Key?: string | null;
  networkVolumePath?: string | null;
  dataUrl?: string | null;
  url?: string | null;
  id: string;
  filename: string;
}): {
  low: string;
  medium: string;
  high: string;
  original: string;
} {
  return {
    low: getBestVideoUrl(video, { quality: 'low', format: 'mp4', resolution: '480p' }),
    medium: getBestVideoUrl(video, { quality: 'medium', format: 'mp4', resolution: '720p' }),
    high: getBestVideoUrl(video, { quality: 'high', format: 'mp4', resolution: '1080p' }),
    original: getBestVideoUrl(video, { quality: 'original', format: 'auto', resolution: 'original' }),
  };
}

/**
 * Check if WebM format is supported by the browser
 */
export function isWebMSupported(): boolean {
  if (typeof window === 'undefined') return false;
  
  const video = document.createElement('video');
  return video.canPlayType('video/webm') !== '';
}

/**
 * Get optimal video format based on browser support
 */
export function getOptimalVideoFormat(): 'mp4' | 'webm' {
  return isWebMSupported() ? 'webm' : 'mp4';
}

/**
 * Estimate bandwidth savings from video compression
 */
export function estimateVideoCompressionSavings(options: VideoOptimizationOptions): number {
  let savings = 0;
  
  switch (options.quality) {
    case 'low':
      savings = 70; // ~70% smaller
      break;
    case 'medium':
      savings = 50; // ~50% smaller
      break;
    case 'high':
      savings = 30; // ~30% smaller
      break;
    default:
      savings = 0;
  }
  
  // Additional savings for resolution reduction
  switch (options.resolution) {
    case '480p':
      savings = Math.max(savings, 60);
      break;
    case '720p':
      savings = Math.max(savings, 40);
      break;
  }
  
  return Math.min(savings, 80); // Cap at 80% savings
}