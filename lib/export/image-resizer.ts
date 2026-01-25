/**
 * V1a Image Resizer - Platform-optimized image resizing using Sharp
 *
 * Resizes images to platform-specific dimensions while maintaining quality
 * and handling various aspect ratio scenarios (crop, fit, fill).
 */

import sharp from 'sharp';
import { PlatformId, PlatformDimension, PLATFORM_SPECS, getRecommendedDimension } from './platform-specs';

/**
 * Resize mode options
 */
export type ResizeMode = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

/**
 * Image position for cropping
 */
export type CropPosition =
  | 'center'
  | 'top'
  | 'right top'
  | 'right'
  | 'right bottom'
  | 'bottom'
  | 'left bottom'
  | 'left'
  | 'left top'
  | 'attention'  // Focus on region with highest attention
  | 'entropy';   // Focus on region with highest entropy

/**
 * Output format options
 */
export type OutputFormat = 'jpeg' | 'png' | 'webp' | 'avif';

/**
 * Resize options
 */
export interface ResizeOptions {
  /** Target width */
  width: number;
  /** Target height */
  height: number;
  /** Resize mode (default: 'cover' for cropping to fill) */
  mode?: ResizeMode;
  /** Crop position when using 'cover' mode (default: 'attention') */
  position?: CropPosition;
  /** Output format (default: 'jpeg') */
  format?: OutputFormat;
  /** Quality for lossy formats (1-100, default: 85) */
  quality?: number;
  /** Background color for 'contain' mode (default: white) */
  background?: { r: number; g: number; b: number; alpha?: number };
  /** Whether to sharpen after resize (default: true) */
  sharpen?: boolean;
  /** Strip metadata (default: true) */
  stripMetadata?: boolean;
}

/**
 * Resize result
 */
export interface ResizeResult {
  /** Resized image data as Buffer */
  buffer: Buffer;
  /** Output format */
  format: OutputFormat;
  /** Final width */
  width: number;
  /** Final height */
  height: number;
  /** File size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
}

/**
 * Batch resize result for multiple platforms
 */
export interface BatchResizeResult {
  platformId: PlatformId;
  dimension: PlatformDimension;
  result: ResizeResult;
}

/**
 * Get MIME type for output format
 */
function getMimeType(format: OutputFormat): string {
  const mimeTypes: Record<OutputFormat, string> = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
  };
  return mimeTypes[format];
}

/**
 * Map position string to Sharp position
 */
function getSharpPosition(position: CropPosition): string {
  const positionMap: Record<CropPosition, string> = {
    'center': 'center',
    'top': 'top',
    'right top': 'right top',
    'right': 'right',
    'right bottom': 'right bottom',
    'bottom': 'bottom',
    'left bottom': 'left bottom',
    'left': 'left',
    'left top': 'left top',
    'attention': 'attention',
    'entropy': 'entropy',
  };
  return positionMap[position];
}

/**
 * Resize an image to specified dimensions
 */
export async function resizeImage(
  input: Buffer | string,
  options: ResizeOptions
): Promise<ResizeResult> {
  const {
    width,
    height,
    mode = 'cover',
    position = 'attention',
    format = 'jpeg',
    quality = 85,
    background = { r: 255, g: 255, b: 255 },
    sharpen = true,
    stripMetadata = true,
  } = options;

  // Start with input
  let pipeline = sharp(input);

  // Get metadata first to check orientation
  const metadata = await pipeline.metadata();

  // Rotate based on EXIF orientation
  pipeline = pipeline.rotate();

  // Apply resize based on mode
  switch (mode) {
    case 'cover':
      // Crop to fill the target dimensions
      pipeline = pipeline.resize(width, height, {
        fit: 'cover',
        position: getSharpPosition(position),
      });
      break;

    case 'contain':
      // Fit within dimensions, add background
      pipeline = pipeline.resize(width, height, {
        fit: 'contain',
        background,
      });
      break;

    case 'fill':
      // Stretch to fill (may distort)
      pipeline = pipeline.resize(width, height, {
        fit: 'fill',
      });
      break;

    case 'inside':
      // Fit inside, no upscaling
      pipeline = pipeline.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
      });
      break;

    case 'outside':
      // Cover but allow overflow
      pipeline = pipeline.resize(width, height, {
        fit: 'outside',
      });
      break;
  }

  // Apply sharpening after resize
  if (sharpen) {
    pipeline = pipeline.sharpen({
      sigma: 0.5,
      m1: 0.5,
      m2: 0.5,
    });
  }

  // Strip metadata if requested
  if (stripMetadata) {
    pipeline = pipeline.withMetadata({});
  } else if (metadata.orientation) {
    // Keep other metadata but fix orientation
    pipeline = pipeline.withMetadata({ orientation: 1 });
  }

  // Apply output format
  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({
        quality,
        mozjpeg: true, // Better compression
      });
      break;

    case 'png':
      pipeline = pipeline.png({
        compressionLevel: 9,
        palette: true,
      });
      break;

    case 'webp':
      pipeline = pipeline.webp({
        quality,
        effort: 6,
      });
      break;

    case 'avif':
      pipeline = pipeline.avif({
        quality,
        effort: 6,
      });
      break;
  }

  // Execute pipeline
  const buffer = await pipeline.toBuffer();

  return {
    buffer,
    format,
    width,
    height,
    size: buffer.length,
    mimeType: getMimeType(format),
  };
}

/**
 * Resize an image for a specific platform using recommended dimensions
 */
export async function resizeForPlatform(
  input: Buffer | string,
  platformId: PlatformId,
  options: Partial<Omit<ResizeOptions, 'width' | 'height'>> = {}
): Promise<ResizeResult> {
  const dimension = getRecommendedDimension(platformId);
  if (!dimension) {
    throw new Error(`Unknown platform: ${platformId}`);
  }

  return resizeImage(input, {
    width: dimension.width,
    height: dimension.height,
    ...options,
  });
}

/**
 * Resize an image for multiple platforms at once
 */
export async function resizeForPlatforms(
  input: Buffer | string,
  platformIds: PlatformId[],
  options: Partial<Omit<ResizeOptions, 'width' | 'height'>> = {}
): Promise<BatchResizeResult[]> {
  const results: BatchResizeResult[] = [];

  for (const platformId of platformIds) {
    const dimension = getRecommendedDimension(platformId);
    if (!dimension) continue;

    const result = await resizeImage(input, {
      width: dimension.width,
      height: dimension.height,
      ...options,
    });

    results.push({
      platformId,
      dimension,
      result,
    });
  }

  return results;
}

/**
 * Resize for all dimensions of a platform (not just recommended)
 */
export async function resizeForAllPlatformDimensions(
  input: Buffer | string,
  platformId: PlatformId,
  options: Partial<Omit<ResizeOptions, 'width' | 'height'>> = {}
): Promise<{ dimension: PlatformDimension; result: ResizeResult }[]> {
  const spec = PLATFORM_SPECS[platformId];
  if (!spec) {
    throw new Error(`Unknown platform: ${platformId}`);
  }

  const results: { dimension: PlatformDimension; result: ResizeResult }[] = [];

  for (const dimension of spec.dimensions) {
    const result = await resizeImage(input, {
      width: dimension.width,
      height: dimension.height,
      ...options,
    });

    results.push({ dimension, result });
  }

  return results;
}

/**
 * Get image metadata without resizing
 */
export async function getImageMetadata(input: Buffer | string) {
  const metadata = await sharp(input).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    space: metadata.space,
    channels: metadata.channels,
    depth: metadata.depth,
    hasAlpha: metadata.hasAlpha,
    orientation: metadata.orientation,
    size: metadata.size,
  };
}

/**
 * Calculate what dimensions an image will be after resizing
 */
export function calculateResizeDimensions(
  originalWidth: number,
  originalHeight: number,
  targetWidth: number,
  targetHeight: number,
  mode: ResizeMode = 'cover'
): { width: number; height: number } {
  const originalRatio = originalWidth / originalHeight;
  const targetRatio = targetWidth / targetHeight;

  switch (mode) {
    case 'cover':
    case 'fill':
      // Always returns exact target dimensions
      return { width: targetWidth, height: targetHeight };

    case 'contain':
    case 'inside':
      // Fit within target, maintaining aspect ratio
      if (originalRatio > targetRatio) {
        // Image is wider than target
        return {
          width: targetWidth,
          height: Math.round(targetWidth / originalRatio),
        };
      } else {
        // Image is taller than target
        return {
          width: Math.round(targetHeight * originalRatio),
          height: targetHeight,
        };
      }

    case 'outside':
      // Cover target, maintaining aspect ratio
      if (originalRatio > targetRatio) {
        return {
          width: Math.round(targetHeight * originalRatio),
          height: targetHeight,
        };
      } else {
        return {
          width: targetWidth,
          height: Math.round(targetWidth / originalRatio),
        };
      }

    default:
      return { width: targetWidth, height: targetHeight };
  }
}

/**
 * Create a thumbnail for preview
 */
export async function createThumbnail(
  input: Buffer | string,
  size: number = 200
): Promise<ResizeResult> {
  return resizeImage(input, {
    width: size,
    height: size,
    mode: 'cover',
    format: 'jpeg',
    quality: 70,
  });
}

/**
 * Optimize an image without resizing (just compression)
 */
export async function optimizeImage(
  input: Buffer | string,
  options: {
    format?: OutputFormat;
    quality?: number;
    stripMetadata?: boolean;
  } = {}
): Promise<ResizeResult> {
  const { format = 'jpeg', quality = 85, stripMetadata = true } = options;

  const metadata = await sharp(input).metadata();

  let pipeline = sharp(input).rotate();

  if (stripMetadata) {
    pipeline = pipeline.withMetadata({});
  }

  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      break;
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 9 });
      break;
    case 'webp':
      pipeline = pipeline.webp({ quality });
      break;
    case 'avif':
      pipeline = pipeline.avif({ quality });
      break;
  }

  const buffer = await pipeline.toBuffer();

  return {
    buffer,
    format,
    width: metadata.width || 0,
    height: metadata.height || 0,
    size: buffer.length,
    mimeType: getMimeType(format),
  };
}
