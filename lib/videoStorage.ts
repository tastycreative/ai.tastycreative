// lib/videoStorage.ts - Dynamic URL video management for NeonDB
import { prisma } from './database';

const COMFYUI_URL = () => process.env.COMFYUI_URL || 'http://211.21.50.84:15833';

export interface GeneratedVideo {
  id: string;
  clerkId: string;
  jobId: string;
  filename: string;
  subfolder: string;
  type: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number; // Video duration in seconds
  fps?: number; // Frames per second
  format?: string;
  data?: Buffer;
  metadata?: any;
  createdAt: Date | string;
  updatedAt: Date | string;
  // Dynamic properties
  url?: string; // Constructed dynamically
  dataUrl?: string; // For database-served videos
}

export interface VideoPathInfo {
  filename: string;
  subfolder: string;
  type: string;
}

// Helper function to construct ComfyUI video URLs dynamically
export function buildComfyUIVideoUrl(pathInfo: VideoPathInfo): string {
  const params = new URLSearchParams({
    filename: pathInfo.filename,
    subfolder: pathInfo.subfolder,
    type: pathInfo.type
  });

  // Always use proxy endpoint for video viewing to handle authentication properly
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${appUrl}/api/proxy/comfyui/view?${params.toString()}`;
}

// Helper function to parse ComfyUI video URLs (for backward compatibility)
export function parseComfyUIVideoUrl(url: string): VideoPathInfo | null {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;
    
    return {
      filename: params.get('filename') || '',
      subfolder: params.get('subfolder') || '',
      type: params.get('type') || 'output'
    };
  } catch (error) {
    console.error('Error parsing ComfyUI video URL:', error);
    return null;
  }
}

// Function to extract video metadata (basic implementation)
function extractVideoMetadata(buffer: Buffer, filename: string): {
  format?: string;
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
} {
  // Basic format detection from filename
  const extension = filename.split('.').pop()?.toLowerCase();
  const format = extension || 'unknown';
  
  // For more detailed metadata, you could use ffprobe or similar:
  // const ffprobe = require('ffprobe');
  // const metadata = await ffprobe(buffer);
  // return {
  //   format: metadata.format.format_name,
  //   width: metadata.streams[0].width,
  //   height: metadata.streams[0].height,
  //   duration: parseFloat(metadata.format.duration),
  //   fps: eval(metadata.streams[0].r_frame_rate)
  // };
  
  return { format };
}

// Function to download and save video from ComfyUI to database
export async function saveVideoToDatabase(
  clerkId: string,
  jobId: string,
  pathInfo: VideoPathInfo,
  options: {
    saveData?: boolean; // Whether to store actual video bytes
    extractMetadata?: boolean; // Whether to extract video dimensions/duration
  } = {}
): Promise<GeneratedVideo | null> {
  console.log('💾 saveVideoToDatabase called with:');
  console.log('👤 User:', clerkId);
  console.log('🆔 Job:', jobId);
  console.log('📂 Path info:', pathInfo);
  console.log('⚙️ Options:', options);
  
  try {
    let videoData: Buffer | undefined;
    let fileSize: number | undefined;
    let width: number | undefined;
    let height: number | undefined;
    let duration: number | undefined;
    let fps: number | undefined;
    let format: string | undefined;
    let metadata: any = {};

    // Download video data if requested
    if (options.saveData || options.extractMetadata) {
      // For server-side downloads, always use direct ComfyUI URL with authentication
      const baseUrl = COMFYUI_URL();
      const params = new URLSearchParams({
        filename: pathInfo.filename,
        subfolder: pathInfo.subfolder,
        type: pathInfo.type
      });
      const directUrl = `${baseUrl}/view?${params.toString()}`;
      
      console.log('📥 Downloading video from ComfyUI directly:', directUrl);
      
      const headers: Record<string, string> = {};
      const runpodApiKey = process.env.RUNPOD_API_KEY;
      if (runpodApiKey) {
        headers['Authorization'] = `Bearer ${runpodApiKey}`;
        console.log('🔐 Adding RunPod API key authentication');
      }
      
      const response = await fetch(directUrl, {
        headers,
        signal: AbortSignal.timeout(60000) // 60 second timeout for videos
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fileSize = buffer.length;
      
      console.log('📊 Downloaded video size:', fileSize, 'bytes');
      
      if (options.saveData) {
        videoData = buffer;
        console.log('💾 Will save video data to database');
      }
      
      if (options.extractMetadata) {
        try {
          const videoMetadata = extractVideoMetadata(buffer, pathInfo.filename);
          format = videoMetadata.format;
          width = videoMetadata.width;
          height = videoMetadata.height;
          duration = videoMetadata.duration;
          fps = videoMetadata.fps;
          
          metadata = {
            downloadedAt: new Date().toISOString(),
            comfyUIInfo: pathInfo,
            originalSize: fileSize,
            sourceUrl: directUrl,
            videoMetadata
          };
          
          console.log('🎬 Extracted video metadata:', { format, width, height, duration, fps, fileSize });
        } catch (metadataError) {
          console.warn('⚠️ Failed to extract video metadata:', metadataError);
        }
      }
    }

    // Save to database
    const savedVideo = await prisma.generatedVideo.create({
      data: {
        clerkId,
        jobId,
        filename: pathInfo.filename,
        subfolder: pathInfo.subfolder,
        type: pathInfo.type,
        fileSize,
        width,
        height,
        duration,
        fps,
        format,
        data: videoData,
        metadata
      }
    });
    
    console.log('✅ Video saved to database:', savedVideo.id);
    
    return {
      id: savedVideo.id,
      clerkId: savedVideo.clerkId,
      jobId: savedVideo.jobId,
      filename: savedVideo.filename,
      subfolder: savedVideo.subfolder,
      type: savedVideo.type,
      fileSize: savedVideo.fileSize || undefined,
      width: savedVideo.width || undefined,
      height: savedVideo.height || undefined,
      duration: savedVideo.duration || undefined,
      fps: savedVideo.fps || undefined,
      format: savedVideo.format || undefined,
      data: savedVideo.data ? Buffer.from(savedVideo.data) : undefined,
      metadata: savedVideo.metadata,
      createdAt: savedVideo.createdAt,
      updatedAt: savedVideo.updatedAt,
      url: buildComfyUIVideoUrl({
        filename: savedVideo.filename,
        subfolder: savedVideo.subfolder,
        type: savedVideo.type
      }),
      dataUrl: savedVideo.data ? `/api/videos/${savedVideo.id}/data` : undefined
    };
    
  } catch (error) {
    console.error('💥 Error saving video to database:', error);
    return null;
  }
}

// Get videos for a user
export async function getUserVideos(
  clerkId: string,
  options: {
    includeData?: boolean;
    jobId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<GeneratedVideo[]> {
  console.log('🎬 Getting videos for user:', clerkId);
  
  try {
    const videos = await prisma.generatedVideo.findMany({
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
        duration: true,
        fps: true,
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
    
    console.log('📊 Found', videos.length, 'videos');
    
    return videos.map(video => ({
      ...video,
      data: video.data ? Buffer.from(video.data) : undefined,
      fileSize: video.fileSize || undefined,
      width: video.width || undefined,
      height: video.height || undefined,
      duration: video.duration || undefined,
      fps: video.fps || undefined,
      format: video.format || undefined,
      url: buildComfyUIVideoUrl({
        filename: video.filename,
        subfolder: video.subfolder,
        type: video.type
      }),
      dataUrl: video.data ? `/api/videos/${video.id}/data` : undefined
    }));
    
  } catch (error) {
    console.error('💥 Error getting user videos:', error);
    return [];
  }
}

// Get videos for a specific job
export async function getJobVideos(
  jobId: string,
  options: { includeData?: boolean } = {}
): Promise<GeneratedVideo[]> {
  console.log('🎬 Getting videos for job:', jobId);
  
  try {
    const videos = await prisma.generatedVideo.findMany({
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
        duration: true,
        fps: true,
        format: true,
        data: options.includeData || false,
        metadata: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log('📊 Found', videos.length, 'videos for job');
    
    return videos.map(video => ({
      ...video,
      data: video.data ? Buffer.from(video.data) : undefined,
      fileSize: video.fileSize || undefined,
      width: video.width || undefined,
      height: video.height || undefined,
      duration: video.duration || undefined,
      fps: video.fps || undefined,
      format: video.format || undefined,
      url: buildComfyUIVideoUrl({
        filename: video.filename,
        subfolder: video.subfolder,
        type: video.type
      }),
      dataUrl: video.data ? `/api/videos/${video.id}/data` : undefined
    }));
    
  } catch (error) {
    console.error('💥 Error getting job videos:', error);
    return [];
  }
}

// Serve video data from database
export async function getVideoData(
  videoId: string,
  clerkId: string
): Promise<{ data: Buffer; filename: string; format?: string } | null> {
  console.log('📤 Serving video data:', videoId, 'for user:', clerkId);
  
  try {
    const video = await prisma.generatedVideo.findFirst({
      where: {
        id: videoId,
        clerkId // Ensure user can only access their own videos
      },
      select: {
        data: true,
        filename: true,
        format: true
      }
    });
    
    if (!video || !video.data) {
      console.log('❌ Video not found or no data stored');
      return null;
    }
    
    console.log('✅ Serving video data:', video.filename);
    
    return {
      data: Buffer.from(video.data),
      filename: video.filename,
      format: video.format || undefined
    };
    
  } catch (error) {
    console.error('💥 Error getting video data:', error);
    return null;
  }
}

// Delete video from database
export async function deleteVideo(
  videoId: string,
  clerkId: string
): Promise<boolean> {
  console.log('🗑️ Deleting video:', videoId, 'for user:', clerkId);
  
  try {
    await prisma.generatedVideo.delete({
      where: {
        id: videoId,
        clerkId // Ensure user can only delete their own videos
      }
    });
    
    console.log('✅ Video deleted from database');
    return true;
    
  } catch (error) {
    console.error('💥 Error deleting video:', error);
    return false;
  }
}

// Get video statistics
export async function getVideoStats(clerkId: string): Promise<{
  totalVideos: number;
  totalSize: number;
  totalDuration: number;
  formatBreakdown: Record<string, number>;
  videosWithData: number;
  videosWithoutData: number;
  averageDuration: number;
  averageFileSize: number;
  resolutionBreakdown: Record<string, number>;
}> {
  try {
    const videos = await prisma.generatedVideo.findMany({
      where: { clerkId },
      select: {
        fileSize: true,
        format: true,
        duration: true,
        width: true,
        height: true,
        data: true
      }
    });
    
    const stats = {
      totalVideos: videos.length,
      totalSize: videos.reduce((sum, video) => sum + (video.fileSize || 0), 0),
      totalDuration: videos.reduce((sum, video) => sum + (video.duration || 0), 0),
      formatBreakdown: {} as Record<string, number>,
      videosWithData: videos.filter(video => video.data).length,
      videosWithoutData: videos.filter(video => !video.data).length,
      averageDuration: 0,
      averageFileSize: 0,
      resolutionBreakdown: {} as Record<string, number>
    };
    
    // Calculate averages
    if (videos.length > 0) {
      stats.averageDuration = stats.totalDuration / videos.length;
      stats.averageFileSize = stats.totalSize / videos.length;
    }
    
    // Count formats
    videos.forEach(video => {
      const format = video.format || 'unknown';
      stats.formatBreakdown[format] = (stats.formatBreakdown[format] || 0) + 1;
      
      // Count resolutions
      if (video.width && video.height) {
        const resolution = `${video.width}x${video.height}`;
        stats.resolutionBreakdown[resolution] = (stats.resolutionBreakdown[resolution] || 0) + 1;
      }
    });
    
    return stats;
    
  } catch (error) {
    console.error('💥 Error getting video stats:', error);
    return {
      totalVideos: 0,
      totalSize: 0,
      totalDuration: 0,
      formatBreakdown: {},
      videosWithData: 0,
      videosWithoutData: 0,
      averageDuration: 0,
      averageFileSize: 0,
      resolutionBreakdown: {}
    };
  }
}

// Get single video by ID
export async function getVideoById(
  videoId: string,
  clerkId: string
): Promise<GeneratedVideo | null> {
  console.log('🎬 Getting video by ID:', videoId, 'for user:', clerkId);
  
  try {
    const video = await prisma.generatedVideo.findFirst({
      where: {
        id: videoId,
        clerkId
      }
    });
    
    if (!video) {
      console.log('❌ Video not found');
      return null;
    }
    
    console.log('✅ Video found:', video.filename);
    
    return {
      id: video.id,
      clerkId: video.clerkId,
      jobId: video.jobId,
      filename: video.filename,
      subfolder: video.subfolder,
      type: video.type,
      fileSize: video.fileSize || undefined,
      width: video.width || undefined,
      height: video.height || undefined,
      duration: video.duration || undefined,
      fps: video.fps || undefined,
      format: video.format || undefined,
      data: video.data ? Buffer.from(video.data) : undefined,
      metadata: video.metadata,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt,
      url: buildComfyUIVideoUrl({
        filename: video.filename,
        subfolder: video.subfolder,
        type: video.type
      }),
      dataUrl: video.data ? `/api/videos/${video.id}/data` : undefined
    };
    
  } catch (error) {
    console.error('💥 Error getting video by ID:', error);
    return null;
  }
}

// Update video metadata
export async function updateVideoMetadata(
  videoId: string,
  clerkId: string,
  updates: {
    width?: number;
    height?: number;
    duration?: number;
    fps?: number;
    format?: string;
    metadata?: any;
  }
): Promise<GeneratedVideo | null> {
  console.log('🔄 Updating video metadata:', videoId, 'for user:', clerkId);
  
  try {
    const updated = await prisma.generatedVideo.update({
      where: {
        id: videoId,
        clerkId
      },
      data: updates
    });
    
    console.log('✅ Video metadata updated');
    
    return {
      id: updated.id,
      clerkId: updated.clerkId,
      jobId: updated.jobId,
      filename: updated.filename,
      subfolder: updated.subfolder,
      type: updated.type,
      fileSize: updated.fileSize || undefined,
      width: updated.width || undefined,
      height: updated.height || undefined,
      duration: updated.duration || undefined,
      fps: updated.fps || undefined,
      format: updated.format || undefined,
      data: updated.data ? Buffer.from(updated.data) : undefined,
      metadata: updated.metadata,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      url: buildComfyUIVideoUrl({
        filename: updated.filename,
        subfolder: updated.subfolder,
        type: updated.type
      }),
      dataUrl: updated.data ? `/api/videos/${updated.id}/data` : undefined
    };
    
  } catch (error) {
    console.error('💥 Error updating video metadata:', error);
    return null;
  }
}

// Utility function to migrate existing URLs to path components (one-time migration)
export async function migrateVideoUrlsToPathComponents(): Promise<void> {
  console.log('🔄 Migrating existing video URLs to path components...');
  
  try {
    // This would be used to migrate existing GenerationJob.resultUrls
    // to GeneratedVideo records with path components
    const jobs = await prisma.generationJob.findMany({
      where: {
        resultUrls: { isEmpty: false },
        // Only migrate jobs that might contain videos
        params: {
          path: ['type'],
          equals: 'image-to-video'
        }
      }
    });
    
    for (const job of jobs) {
      for (const url of job.resultUrls) {
        const pathInfo = parseComfyUIVideoUrl(url);
        if (pathInfo && (
          pathInfo.filename.endsWith('.mp4') ||
          pathInfo.filename.endsWith('.webm') ||
          pathInfo.filename.endsWith('.avi') ||
          pathInfo.filename.endsWith('.mov') ||
          pathInfo.filename.endsWith('.gif')
        )) {
          // Check if this video already exists
          const existing = await prisma.generatedVideo.findFirst({
            where: {
              jobId: job.id,
              filename: pathInfo.filename,
              subfolder: pathInfo.subfolder,
              type: pathInfo.type
            }
          });
          
          if (!existing) {
            await prisma.generatedVideo.create({
              data: {
                clerkId: job.clerkId,
                jobId: job.id,
                filename: pathInfo.filename,
                subfolder: pathInfo.subfolder,
                type: pathInfo.type
              }
            });
            console.log('✅ Migrated video:', pathInfo.filename);
          }
        }
      }
    }
    
    console.log('✅ Video migration complete');
    
  } catch (error) {
    console.error('💥 Video migration error:', error);
    throw error;
  }
}

// Bulk delete videos by job ID
export async function deleteVideosByJobId(
  jobId: string,
  clerkId: string
): Promise<number> {
  console.log('🗑️ Deleting all videos for job:', jobId, 'user:', clerkId);
  
  try {
    const result = await prisma.generatedVideo.deleteMany({
      where: {
        jobId,
        clerkId
      }
    });
    
    console.log('✅ Deleted', result.count, 'videos for job');
    return result.count;
    
  } catch (error) {
    console.error('💥 Error deleting videos by job ID:', error);
    return 0;
  }
}

// Cleanup old videos
export async function cleanupOldVideos(maxAgeHours: number = 72): Promise<number> {
  console.log('🧹 Cleaning up old videos...');
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);
    
    const result = await prisma.generatedVideo.deleteMany({
      where: {
        createdAt: { lt: cutoffDate }
      }
    });
    
    console.log('🧹 Cleaned up', result.count, 'old videos');
    return result.count;
  } catch (error) {
    console.error('💥 Error cleaning up old videos:', error);
    return 0;
  }
}

// Get videos by format
export async function getVideosByFormat(
  clerkId: string,
  format: string,
  options: { includeData?: boolean; limit?: number } = {}
): Promise<GeneratedVideo[]> {
  console.log('🎬 Getting videos by format:', format, 'for user:', clerkId);
  
  try {
    const videos = await prisma.generatedVideo.findMany({
      where: {
        clerkId,
        format
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
        duration: true,
        fps: true,
        format: true,
        data: options.includeData || false,
        metadata: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit
    });
    
    console.log('📊 Found', videos.length, 'videos with format:', format);
    
    return videos.map(video => ({
      ...video,
      data: video.data ? Buffer.from(video.data) : undefined,
      fileSize: video.fileSize || undefined,
      width: video.width || undefined,
      height: video.height || undefined,
      duration: video.duration || undefined,
      fps: video.fps || undefined,
      format: video.format || undefined,
      url: buildComfyUIVideoUrl({
        filename: video.filename,
        subfolder: video.subfolder,
        type: video.type
      }),
      dataUrl: video.data ? `/api/videos/${video.id}/data` : undefined
    }));
    
  } catch (error) {
    console.error('💥 Error getting videos by format:', error);
    return [];
  }
}