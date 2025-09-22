// lib/imageOptimization.ts - Image optimization utilities

export interface ImageOptimizationOptions {
  size?: 'thumbnail' | 'medium' | 'full';
  format?: 'auto' | 'webp' | 'jpeg' | 'png';
  quality?: number; // 1-100
}

/**
 * Generate optimized image URL with compression parameters
 */
export function getOptimizedImageUrl(
  baseUrl: string, 
  options: ImageOptimizationOptions = {}
): string {
  const {
    size = 'medium', // Default to medium for better performance
    format = 'auto', // Auto-detect WebP support
    quality = 85
  } = options;

  const url = new URL(baseUrl, window.location.origin);
  
  // Add optimization parameters
  url.searchParams.set('size', size);
  url.searchParams.set('format', format);
  url.searchParams.set('quality', quality.toString());
  
  return url.toString();
}

/**
 * Get progressive loading URLs (thumbnail first, then full)
 */
export function getProgressiveImageUrls(baseUrl: string) {
  return {
    thumbnail: getOptimizedImageUrl(baseUrl, { 
      size: 'thumbnail', 
      format: 'webp', 
      quality: 70 
    }),
    medium: getOptimizedImageUrl(baseUrl, { 
      size: 'medium', 
      format: 'webp', 
      quality: 85 
    }),
    full: getOptimizedImageUrl(baseUrl, { 
      size: 'full', 
      format: 'auto', 
      quality: 90 
    })
  };
}

/**
 * Check if browser supports WebP format
 */
export function supportsWebP(): Promise<boolean> {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
}

/**
 * Calculate estimated data savings
 */
export function estimateDataSavings(originalSize: number, compressionType: 'thumbnail' | 'medium' | 'webp') {
  switch (compressionType) {
    case 'thumbnail':
      return Math.round(originalSize * 0.1); // ~90% reduction
    case 'medium':
      return Math.round(originalSize * 0.4); // ~60% reduction
    case 'webp':
      return Math.round(originalSize * 0.7); // ~30% reduction
    default:
      return originalSize;
  }
}