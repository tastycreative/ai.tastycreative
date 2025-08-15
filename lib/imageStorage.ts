// lib/imageStorage.ts - Dynamic URL image management for NeonDB
import { prisma } from './database';

const COMFYUI_URL = () => process.env.COMFYUI_URL || 'http://209.53.88.242:14753';

export interface GeneratedImage {
  id: string;
  clerkId: string;
  jobId: string;
  filename: string;
  subfolder: string;
  type: string;
  fileSize?: number;
  width?: number;
  height?: number;
  format?: string;
  data?: Buffer;
  metadata?: any;
  createdAt: Date | string;
  updatedAt: Date | string;
  // Dynamic properties
  url?: string; // Constructed dynamically
  dataUrl?: string; // For database-served images
}

export interface ImagePathInfo {
  filename: string;
  subfolder: string;
  type: string;
}

// Helper function to construct ComfyUI URLs dynamically
export function buildComfyUIUrl(pathInfo: ImagePathInfo): string {
  // Use proxy endpoint for production to avoid mixed content issues
  if (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://')) {
    const params = new URLSearchParams({
      filename: pathInfo.filename,
      subfolder: pathInfo.subfolder,
      type: pathInfo.type
    });
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai.tastycreative.xyz';
    return `${appUrl}/api/proxy/comfyui/view?${params.toString()}`;
  }
  
  // Use direct ComfyUI URL for local development
  const baseUrl = COMFYUI_URL();
  const params = new URLSearchParams({
    filename: pathInfo.filename,
    subfolder: pathInfo.subfolder,
    type: pathInfo.type
  });
  
  return `${baseUrl}/view?${params.toString()}`;
}

// Helper function to parse ComfyUI URLs (for backward compatibility)
export function parseComfyUIUrl(url: string): ImagePathInfo | null {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;
    
    return {
      filename: params.get('filename') || '',
      subfolder: params.get('subfolder') || '',
      type: params.get('type') || 'output'
    };
  } catch (error) {
    console.error('Error parsing ComfyUI URL:', error);
    return null;
  }
}

// Function to download and save image from ComfyUI to database
export async function saveImageToDatabase(
  clerkId: string,
  jobId: string,
  pathInfo: ImagePathInfo,
  options: {
    saveData?: boolean; // Whether to store actual image bytes
    extractMetadata?: boolean; // Whether to extract image dimensions/format
  } = {}
): Promise<GeneratedImage | null> {
  console.log('💾 Saving image to database:', pathInfo.filename);
  console.log('👤 User:', clerkId);
  console.log('🆔 Job:', jobId);
  console.log('📂 Path info:', pathInfo);
  
  try {
    let imageData: Buffer | undefined;
    let fileSize: number | undefined;
    let width: number | undefined;
    let height: number | undefined;
    let format: string | undefined;
    let metadata: any = {};

    // Download image data if requested
    if (options.saveData || options.extractMetadata) {
      const imageUrl = buildComfyUIUrl(pathInfo);
      console.log('📥 Downloading image from:', imageUrl);
      
      const response = await fetch(imageUrl, {
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fileSize = buffer.length;
      
      console.log('📊 Downloaded image size:', fileSize, 'bytes');
      
      if (options.saveData) {
        imageData = buffer;
        console.log('💾 Will save image data to database');
      }
      
      if (options.extractMetadata) {
        try {
          // Basic format detection from filename
          const extension = pathInfo.filename.split('.').pop()?.toLowerCase();
          format = extension || 'unknown';
          
          // For more detailed metadata, you could use sharp:
          // const sharp = require('sharp');
          // const imageMetadata = await sharp(buffer).metadata();
          // width = imageMetadata.width;
          // height = imageMetadata.height;
          // format = imageMetadata.format;
          
          metadata = {
            downloadedAt: new Date().toISOString(),
            comfyUIInfo: pathInfo,
            originalSize: fileSize,
            sourceUrl: imageUrl
          };
          
          console.log('📸 Extracted metadata:', { format, fileSize });
        } catch (metadataError) {
          console.warn('⚠️ Failed to extract image metadata:', metadataError);
        }
      }
    }

    // Save to database
    const savedImage = await prisma.generatedImage.create({
      data: {
        clerkId,
        jobId,
        filename: pathInfo.filename,
        subfolder: pathInfo.subfolder,
        type: pathInfo.type,
        fileSize,
        width,
        height,
        format,
        data: imageData,
        metadata
      }
    });
    
    console.log('✅ Image saved to database:', savedImage.id);
    
    return {
      id: savedImage.id,
      clerkId: savedImage.clerkId,
      jobId: savedImage.jobId,
      filename: savedImage.filename,
      subfolder: savedImage.subfolder,
      type: savedImage.type,
      fileSize: savedImage.fileSize || undefined,
      width: savedImage.width || undefined,
      height: savedImage.height || undefined,
      format: savedImage.format || undefined,
      data: savedImage.data ? Buffer.from(savedImage.data) : undefined,
      metadata: savedImage.metadata,
      createdAt: savedImage.createdAt,
      updatedAt: savedImage.updatedAt,
      url: buildComfyUIUrl({
        filename: savedImage.filename,
        subfolder: savedImage.subfolder,
        type: savedImage.type
      }),
      dataUrl: savedImage.data ? `/api/images/${savedImage.id}/data` : undefined
    };
    
  } catch (error) {
    console.error('💥 Error saving image to database:', error);
    return null;
  }
}

// Get images for a user
export async function getUserImages(
  clerkId: string,
  options: {
    includeData?: boolean;
    jobId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<GeneratedImage[]> {
  console.log('🖼️ Getting images for user:', clerkId);
  
  try {
    const images = await prisma.generatedImage.findMany({
      where: {
        clerkId,
        jobId: options.jobId
      },
      select: {
        id: true,
        clerkId: true,
        jobId: true,
        filename: true,
        subfolder: true,
        type: true,
        fileSize: true,
        width: true,
        height: true,
        format: true,
        data: options.includeData || false,
        metadata: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      skip: options.offset
    });
    
    console.log('📊 Found', images.length, 'images');
    
    return images.map(img => ({
      ...img,
      data: img.data ? Buffer.from(img.data) : undefined,
      fileSize: img.fileSize || undefined,
      width: img.width || undefined,
      height: img.height || undefined,
      format: img.format || undefined,
      url: buildComfyUIUrl({
        filename: img.filename,
        subfolder: img.subfolder,
        type: img.type
      }),
      dataUrl: img.data ? `/api/images/${img.id}/data` : undefined
    }));
    
  } catch (error) {
    console.error('💥 Error getting user images:', error);
    return [];
  }
}

// Get images for a specific job
export async function getJobImages(
  jobId: string,
  options: { includeData?: boolean } = {}
): Promise<GeneratedImage[]> {
  console.log('🖼️ Getting images for job:', jobId);
  
  try {
    const images = await prisma.generatedImage.findMany({
      where: { jobId },
      select: {
        id: true,
        clerkId: true,
        jobId: true,
        filename: true,
        subfolder: true,
        type: true,
        fileSize: true,
        width: true,
        height: true,
        format: true,
        data: options.includeData || false,
        metadata: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log('📊 Found', images.length, 'images for job');
    
    return images.map(img => ({
      ...img,
      data: img.data ? Buffer.from(img.data) : undefined,
      fileSize: img.fileSize || undefined,
      width: img.width || undefined,
      height: img.height || undefined,
      format: img.format || undefined,
      url: buildComfyUIUrl({
        filename: img.filename,
        subfolder: img.subfolder,
        type: img.type
      }),
      dataUrl: img.data ? `/api/images/${img.id}/data` : undefined
    }));
    
  } catch (error) {
    console.error('💥 Error getting job images:', error);
    return [];
  }
}

// Serve image data from database
export async function getImageData(
  imageId: string,
  clerkId: string
): Promise<{ data: Buffer; filename: string; format?: string } | null> {
  console.log('📤 Serving image data:', imageId, 'for user:', clerkId);
  
  try {
    const image = await prisma.generatedImage.findFirst({
      where: {
        id: imageId,
        clerkId // Ensure user can only access their own images
      },
      select: {
        data: true,
        filename: true,
        format: true
      }
    });
    
    if (!image || !image.data) {
      console.log('❌ Image not found or no data stored');
      return null;
    }
    
    console.log('✅ Serving image data:', image.filename);
    
    return {
      data: Buffer.from(image.data),
      filename: image.filename,
      format: image.format || undefined
    };
    
  } catch (error) {
    console.error('💥 Error getting image data:', error);
    return null;
  }
}

// Delete image from database
export async function deleteImage(
  imageId: string,
  clerkId: string
): Promise<boolean> {
  console.log('🗑️ Deleting image:', imageId, 'for user:', clerkId);
  
  try {
    await prisma.generatedImage.delete({
      where: {
        id: imageId,
        clerkId // Ensure user can only delete their own images
      }
    });
    
    console.log('✅ Image deleted from database');
    return true;
    
  } catch (error) {
    console.error('💥 Error deleting image:', error);
    return false;
  }
}

// Get image statistics
export async function getImageStats(clerkId: string): Promise<{
  totalImages: number;
  totalSize: number;
  formatBreakdown: Record<string, number>;
  imagesWithData: number;
  imagesWithoutData: number;
}> {
  try {
    const images = await prisma.generatedImage.findMany({
      where: { clerkId },
      select: {
        fileSize: true,
        format: true,
        data: true
      }
    });
    
    const stats = {
      totalImages: images.length,
      totalSize: images.reduce((sum, img) => sum + (img.fileSize || 0), 0),
      formatBreakdown: {} as Record<string, number>,
      imagesWithData: images.filter(img => img.data).length,
      imagesWithoutData: images.filter(img => !img.data).length
    };
    
    // Count formats
    images.forEach(img => {
      const format = img.format || 'unknown';
      stats.formatBreakdown[format] = (stats.formatBreakdown[format] || 0) + 1;
    });
    
    return stats;
    
  } catch (error) {
    console.error('💥 Error getting image stats:', error);
    return {
      totalImages: 0,
      totalSize: 0,
      formatBreakdown: {},
      imagesWithData: 0,
      imagesWithoutData: 0
    };
  }
}

// Utility function to migrate existing URLs to path components (one-time migration)
export async function migrateUrlsToPathComponents(): Promise<void> {
  console.log('🔄 Migrating existing URLs to path components...');
  
  try {
    // This would be used to migrate existing GenerationJob.resultUrls
    // to GeneratedImage records with path components
    const jobs = await prisma.generationJob.findMany({
      where: {
        resultUrls: { isEmpty: false }
      }
    });
    
    for (const job of jobs) {
      for (const url of job.resultUrls) {
        const pathInfo = parseComfyUIUrl(url);
        if (pathInfo) {
          // Check if this image already exists
          const existing = await prisma.generatedImage.findFirst({
            where: {
              jobId: job.id,
              filename: pathInfo.filename,
              subfolder: pathInfo.subfolder,
              type: pathInfo.type
            }
          });
          
          if (!existing) {
            await prisma.generatedImage.create({
              data: {
                clerkId: job.clerkId,
                jobId: job.id,
                filename: pathInfo.filename,
                subfolder: pathInfo.subfolder,
                type: pathInfo.type
              }
            });
            console.log('✅ Migrated:', pathInfo.filename);
          }
        }
      }
    }
    
    console.log('✅ Migration complete');
    
  } catch (error) {
    console.error('💥 Migration error:', error);
    throw error;
  }
}