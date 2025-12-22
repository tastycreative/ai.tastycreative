// lib/imageStorage.ts - Dynamic URL image management for NeonDB
import { prisma } from './database';

const COMFYUI_URL = () => process.env.COMFYUI_URL || 'http://localhost:8188';

// Helper function to extract LoRA model filenames from job params
export function extractLoraModelsFromParams(params: any): string[] {
  if (!params) return [];
  
  const loraModels: string[] = [];
  
  // Handle nested params structure (serverless API stores entire request in params)
  // If params.params exists, use that instead (nested structure from API)
  const actualParams = params.params || params;
  
  console.log('🔍 Extracting LoRA models from params...');
  console.log('  - Has params.params?', !!params.params);
  console.log('  - actualParams.loras?', actualParams.loras ? `Array[${actualParams.loras.length}]` : 'none');
  console.log('  - actualParams.selectedLora?', actualParams.selectedLora || 'none');
  
  // Handle different param structures:
  // 1. actualParams.loras - array of LoRA objects (text-to-image, multi-LoRA style transfer)
  if (actualParams.loras && Array.isArray(actualParams.loras)) {
    actualParams.loras.forEach((lora: any, index: number) => {
      const loraName = lora.modelName || lora.model_name || lora.fileName || lora.filename;
      if (loraName) {
        console.log(`  - Found LoRA #${index + 1}:`, loraName);
        loraModels.push(loraName);
      }
    });
  }
  
  // 2. actualParams.selectedLora - single LoRA filename (style transfer legacy)
  if (actualParams.selectedLora) {
    console.log('  - Found selectedLora:', actualParams.selectedLora);
    loraModels.push(actualParams.selectedLora);
  }
  
  // 3. actualParams.loraModel - single LoRA filename (alternative format)
  if (actualParams.loraModel) {
    console.log('  - Found loraModel:', actualParams.loraModel);
    loraModels.push(actualParams.loraModel);
  }
  
  // Remove duplicates
  const uniqueLoraModels = [...new Set(loraModels)];
  console.log('  - Final LoRA models:', uniqueLoraModels);
  return uniqueLoraModels;
}

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
  networkVolumePath?: string; // Path to image on network volume
  s3Key?: string; // S3 key for network volume storage (deprecated)
  awsS3Key?: string; // AWS S3 key for primary storage
  awsS3Url?: string; // AWS S3 public URL for direct access
  metadata?: any;
  createdAt: Date | string;
  updatedAt: Date | string;
  // Dynamic properties
  url?: string | null; // Constructed dynamically (AWS S3 direct URL preferred)
  dataUrl?: string; // For database-served images
}

export interface ImagePathInfo {
  filename: string;
  subfolder: string;
  type: string;
}

// Helper function to construct ComfyUI URLs dynamically
export function buildComfyUIUrl(pathInfo: ImagePathInfo): string | null {
  // For serverless RunPod setups, don't provide ComfyUI URLs since they won't work
  // Check if this is a serverless environment (no persistent ComfyUI server)
  const isServerless = process.env.RUNPOD_SERVERLESS === 'true' || 
                       process.env.NODE_ENV === 'production' ||
                       !process.env.COMFYUI_URL?.includes('localhost');

  if (isServerless) {
    console.log('🚫 Serverless mode - not generating ComfyUI URLs');
    return null;
  }

  const params = new URLSearchParams({
    filename: pathInfo.filename,
    subfolder: pathInfo.subfolder,
    type: pathInfo.type
  });

  // Always use proxy endpoint for image viewing to handle authentication properly
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${appUrl}/api/proxy/comfyui/view?${params.toString()}`;
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
    providedData?: Buffer; // Pre-downloaded image data to use instead of downloading
    networkVolumePath?: string; // Path to image on network volume
    s3Key?: string; // S3 key for network volume storage
    awsS3Key?: string; // AWS S3 key for primary storage
    awsS3Url?: string; // AWS S3 public URL for direct access
    fileSize?: number; // File size if known
    loraModels?: string[]; // ✅ Array of LoRA model filenames used in generation
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

    // Download image data if requested or use provided data
    if (options.providedData) {
      // Use provided image data (from webhook)
      console.log('📦 Using provided image data from webhook');
      const buffer = options.providedData;
      fileSize = buffer.length;
      
      if (options.saveData) {
        imageData = buffer;
        console.log('💾 Will save provided image data to database');
      }
      
      if (options.extractMetadata) {
        try {
          // Basic format detection from filename
          const extension = pathInfo.filename.split('.').pop()?.toLowerCase();
          format = extension || 'unknown';
          
          metadata = {
            providedData: true,
            webhookSource: true,
            originalSize: fileSize,
            processedAt: new Date().toISOString()
          };
          
          console.log('📸 Extracted metadata from provided data:', { format, fileSize });
        } catch (metadataError) {
          console.warn('⚠️ Failed to extract image metadata:', metadataError);
        }
      }
    } else if (options.saveData || options.extractMetadata) {
      // For server-side downloads, always use direct ComfyUI URL with authentication
      const baseUrl = COMFYUI_URL();
      const params = new URLSearchParams({
        filename: pathInfo.filename,
        subfolder: pathInfo.subfolder,
        type: pathInfo.type
      });
      const directUrl = `${baseUrl}/view?${params.toString()}`;
      
      console.log('� Downloading image from ComfyUI directly:', directUrl);
      
      const headers: Record<string, string> = {};
      const runpodApiKey = process.env.RUNPOD_API_KEY;
      if (runpodApiKey) {
        headers['Authorization'] = `Bearer ${runpodApiKey}`;
        console.log('🔐 Adding RunPod API key authentication');
      }
      
      const response = await fetch(directUrl, {
        headers,
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
            sourceUrl: directUrl
          };
          
          console.log('📸 Extracted metadata:', { format, fileSize });
        } catch (metadataError) {
          console.warn('⚠️ Failed to extract image metadata:', metadataError);
        }
      }
    }

    // Save to database using upsert to handle potential duplicates
    const savedImage = await prisma.generatedImage.upsert({
      where: {
        jobId_filename_subfolder_type: {
          jobId,
          filename: pathInfo.filename,
          subfolder: pathInfo.subfolder,
          type: pathInfo.type
        }
      },
      update: {
        // Update with new data if image already exists
        fileSize: options.fileSize || fileSize,
        width,
        height,
        format,
        data: imageData,
        networkVolumePath: options.networkVolumePath,
        s3Key: options.s3Key,
        awsS3Key: options.awsS3Key,
        awsS3Url: options.awsS3Url,
        metadata,
        loraModels: options.loraModels // ✅ Update LoRA models if provided
      },
      create: {
        clerkId,
        jobId,
        filename: pathInfo.filename,
        subfolder: pathInfo.subfolder,
        type: pathInfo.type,
        fileSize: options.fileSize || fileSize,
        width,
        height,
        format,
        data: imageData,
        networkVolumePath: options.networkVolumePath,
        s3Key: options.s3Key,
        awsS3Key: options.awsS3Key,
        awsS3Url: options.awsS3Url,
        metadata,
        loraModels: options.loraModels || [] // ✅ Store LoRA models array
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
      networkVolumePath: savedImage.networkVolumePath || undefined,
      s3Key: savedImage.s3Key || undefined,
      awsS3Key: savedImage.awsS3Key || undefined,
      awsS3Url: savedImage.awsS3Url || undefined,
      metadata: savedImage.metadata,
      createdAt: savedImage.createdAt,
      updatedAt: savedImage.updatedAt,
      // Priority 1: Direct AWS S3 URL (no Vercel bandwidth usage)
      // Priority 2: Network volume path over ComfyUI URL
      url: savedImage.awsS3Url ||
           (savedImage.networkVolumePath ? 
           `/api/images/${savedImage.id}/network-volume` : 
           buildComfyUIUrl({
             filename: savedImage.filename,
             subfolder: savedImage.subfolder,
             type: savedImage.type
           })),
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
    sortBy?: 'newest' | 'oldest' | 'largest' | 'smallest' | 'name';
  } = {}
): Promise<GeneratedImage[]> {
  console.log('🖼️ Getting images for user:', clerkId, 'sortBy:', options.sortBy);
  
  try {
    // Determine orderBy based on sortBy parameter
    let orderBy: any;
    switch (options.sortBy) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'largest':
        orderBy = { fileSize: 'desc' };
        break;
      case 'smallest':
        orderBy = { fileSize: 'asc' };
        break;
      case 'name':
        orderBy = { filename: 'asc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

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
        networkVolumePath: true,
        s3Key: true,
        awsS3Key: true,
        awsS3Url: true,
        googleDriveFileId: true,
        googleDriveFolderName: true,
        googleDriveUploadedAt: true,
        metadata: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: orderBy,
      take: options.limit,
      skip: options.offset
    });

    // If we're not including data, we need to separately check which images have data
    // This is needed for proper dataUrl generation in frontend fallback mechanism
    let imageDataStatus: Record<string, boolean> = {};
    if (!options.includeData) {
      const dataCheck = await prisma.generatedImage.findMany({
        where: {
          clerkId,
          id: { in: images.map(img => img.id) },
          data: { not: null }
        },
        select: {
          id: true
        }
      });
      imageDataStatus = dataCheck.reduce((acc, img) => {
        acc[img.id] = true;
        return acc;
      }, {} as Record<string, boolean>);
    }
    
    console.log('📊 Found', images.length, 'images');
    
    return images.map(img => ({
      ...img,
      data: img.data ? Buffer.from(img.data) : undefined,
      fileSize: img.fileSize || undefined,
      width: img.width || undefined,
      height: img.height || undefined,
      format: img.format || undefined,
      networkVolumePath: img.networkVolumePath || undefined,
      s3Key: img.s3Key || undefined,
      awsS3Key: img.awsS3Key || undefined,
      awsS3Url: img.awsS3Url || undefined,
      // Priority 1: Direct AWS S3 URL (no Vercel bandwidth usage)
      // Priority 2: Network volume path over ComfyUI URL
      url: img.awsS3Url ||
           (img.networkVolumePath ? 
           `/api/images/${img.id}/network-volume` : 
           buildComfyUIUrl({
             filename: img.filename,
             subfolder: img.subfolder,
             type: img.type
           })),
      // Set dataUrl if image has data stored (either from included data or separate check)
      dataUrl: (img.data || imageDataStatus[img.id]) ? `/api/images/${img.id}/data` : undefined
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
        networkVolumePath: true,
        s3Key: true,
        awsS3Key: true,
        awsS3Url: true,
        metadata: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    // If we're not including data, we need to separately check which images have data
    // This is needed for proper dataUrl generation in frontend fallback mechanism
    let imageDataStatus: Record<string, boolean> = {};
    if (!options.includeData) {
      const dataCheck = await prisma.generatedImage.findMany({
        where: {
          jobId,
          id: { in: images.map(img => img.id) },
          data: { not: null }
        },
        select: {
          id: true
        }
      });
      imageDataStatus = dataCheck.reduce((acc, img) => {
        acc[img.id] = true;
        return acc;
      }, {} as Record<string, boolean>);
    }
    
    console.log('📊 Found', images.length, 'images for job');
    
    return images.map(img => ({
      ...img,
      data: img.data ? Buffer.from(img.data) : undefined,
      fileSize: img.fileSize || undefined,
      width: img.width || undefined,
      height: img.height || undefined,
      format: img.format || undefined,
      networkVolumePath: img.networkVolumePath || undefined,
      s3Key: img.s3Key || undefined,
      awsS3Key: img.awsS3Key || undefined,
      awsS3Url: img.awsS3Url || undefined,
      // Priority 1: Direct AWS S3 URL (no Vercel bandwidth usage)
      // Priority 2: S3 proxy (for backward compatibility with RunPod S3)
      // Priority 3: Network volume path
      // Priority 4: ComfyUI URL
      url: img.awsS3Url ||
           (img.s3Key ? 
           `/api/images/s3/${encodeURIComponent(img.s3Key)}` :
           img.networkVolumePath ? 
           `/api/images/${img.id}/network-volume` : 
           buildComfyUIUrl({
             filename: img.filename,
             subfolder: img.subfolder,
             type: img.type
           })),
      // Set dataUrl if image has data stored (either from included data or separate check)
      dataUrl: (img.data || imageDataStatus[img.id]) ? `/api/images/${img.id}/data` : undefined
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
    // First, get the image to find its AWS S3 key
    const image = await prisma.generatedImage.findUnique({
      where: {
        id: imageId,
        clerkId // Ensure user can only delete their own images
      },
      select: {
        awsS3Key: true
      }
    });

    if (!image) {
      console.warn('⚠️ Image not found or user not authorized');
      return false;
    }

    // Delete from AWS S3 if it exists there
    if (image.awsS3Key) {
      console.log(`🗑️ Deleting from AWS S3: ${image.awsS3Key}`);
      try {
        const { deleteFromAwsS3 } = await import('./awsS3Utils');
        const result = await deleteFromAwsS3(image.awsS3Key);
        if (result.success) {
          console.log('✅ Image deleted from AWS S3');
        } else {
          console.warn('⚠️ Failed to delete from AWS S3:', result.error);
        }
      } catch (s3Error) {
        console.error('❌ Error deleting from AWS S3:', s3Error);
        // Continue with database deletion even if S3 deletion fails
      }
    }

    // Delete from database
    await prisma.generatedImage.delete({
      where: {
        id: imageId,
        clerkId
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

/**
 * Get the appropriate URL for an image based on its storage type
 * Prioritizes direct AWS S3 URLs to eliminate Vercel bandwidth usage
 */
export function getImageUrl(image: GeneratedImage): string | null {
  // Priority 1: AWS S3 direct URL (no Vercel bandwidth usage)
  if (image.awsS3Url) {
    return image.awsS3Url;
  }
  
  // Priority 2: S3 key (use our S3 API route for RunPod S3 backward compatibility)
  if (image.s3Key) {
    return `/api/images/s3/${encodeURIComponent(image.s3Key)}`;
  }
  
  // Priority 3: Network volume path (use network volume API route)
  if (image.networkVolumePath) {
    return `/api/images/${image.id}/network-volume`;
  }
  
  // Priority 4: Database-stored image data (use database API route)
  if (image.data) {
    return `/api/images/${image.id}`;
  }
  
  // Priority 5: Fallback to ComfyUI URL if we have path components
  if (image.filename && image.subfolder && image.type) {
    const baseUrl = COMFYUI_URL();
    const params = new URLSearchParams({
      filename: image.filename,
      subfolder: image.subfolder,
      type: image.type
    });
    return `${baseUrl}/view?${params.toString()}`;
  }
  
  // No valid storage method found
  return null;
}