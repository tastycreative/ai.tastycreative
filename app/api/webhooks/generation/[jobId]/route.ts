import { NextRequest, NextResponse } from 'next/server';
import { updateJob, getJob } from '@/lib/jobsStorage';
import { saveImageToDatabase, buildComfyUIUrl } from '@/lib/imageStorage';
import { saveVideoToDatabase, buildComfyUIVideoUrl } from '@/lib/videoStorage';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const body = await request.json();
    
    console.log('🔔 Generation webhook received for job:', jobId);
    console.log('📋 Webhook payload:', JSON.stringify(body, null, 2));
    
    // Debug: Log key fields for troubleshooting
    console.log('🔍 Debug - Key fields:');
    console.log('  - status:', body.status);
    console.log('  - images array:', body.images ? `${body.images.length} items` : 'not present');
    console.log('  - single image:', body.image ? 'present' : 'not present');
    console.log('  - allImages array:', body.allImages ? `${body.allImages.length} items` : 'not present');
    console.log('  - resultUrls:', body.resultUrls ? `${body.resultUrls.length} items` : 'not present');

    // Extract webhook data including enhanced progress fields
    const { 
      status, 
      progress, 
      message, 
      images, 
      videos, 
      network_volume_paths,  // Add this for S3-optimized video storage
      error, 
      prompt_id,
      stage,
      elapsedTime,
      estimatedTimeRemaining
    } = body;

    // Verify job exists
    const existingJob = await getJob(jobId);
    if (!existingJob) {
      console.error('❌ Job not found:', jobId);
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    console.log(`🔍 Existing job status: ${existingJob.status}, Webhook status: ${status}`);

    // Check if job was already cancelled - ignore completion webhooks for cancelled jobs
    if (existingJob.status === 'failed' && existingJob.error === 'Job canceled by user') {
      if (status === 'COMPLETED' || status === 'DELIVERY_COMPLETE') {
        console.log('🛑 Ignoring completion webhook for cancelled job:', jobId);
        return NextResponse.json({ 
          success: true, 
          message: 'Ignored completion for cancelled job',
          jobId: jobId,
          status: 'cancelled'
        });
      }
    }

    // Also ignore any status updates if the job was manually cancelled
    if (existingJob.status === 'failed' && existingJob.error === 'Job canceled by user' && 
        status !== 'FAILED' && status !== 'ERROR') {
      console.log(`🛑 Ignoring status update (${status}) for cancelled job:`, jobId);
      return NextResponse.json({ 
        success: true, 
        message: 'Ignored status update for cancelled job',
        jobId: jobId,
        status: 'cancelled'
      });
    }

    console.log(`📊 Job ${jobId} status update: ${status}, progress: ${progress}%`);

    // Prepare update data with proper status mapping
    const updateData: any = {};

    if (status) {
      // Map incoming webhook status to Prisma JobStatus enum
      const statusMapping: { [key: string]: string } = {
        'PENDING': 'PENDING',
        'IN_PROGRESS': 'PROCESSING',
        'PROCESSING': 'PROCESSING',
        'COMPLETED': 'COMPLETED',
        'FAILED': 'FAILED',
        'ERROR': 'FAILED',
        'IMAGE_CHUNK': 'PROCESSING', // Handle chunked image delivery as still processing
        'IMAGE_READY': 'PROCESSING', // Handle skin enhancer chunked delivery as still processing
        'DELIVERY_COMPLETE': 'COMPLETED' // Final delivery completion
      };
      
      const mappedStatus = statusMapping[status.toUpperCase()] || 'PROCESSING';
      updateData.status = mappedStatus;
      console.log(`📝 Status mapping: ${status} -> ${mappedStatus}`);
    }

    if (progress !== undefined) {
      updateData.progress = progress;
    }

    if (error) {
      updateData.error = error;
    }

    if (prompt_id) {
      updateData.comfyUIPromptId = prompt_id;
    }

    // Add enhanced progress fields
    if (stage) {
      updateData.stage = stage;
    }

    if (message) {
      updateData.message = message;
    }

    if (elapsedTime !== undefined) {
      updateData.elapsedTime = elapsedTime;
    }

    if (estimatedTimeRemaining !== undefined) {
      updateData.estimatedTimeRemaining = estimatedTimeRemaining;
    }

    // Handle completed generation with S3 network volume paths (NEW: S3 API storage)
    if (status === 'COMPLETED' && body.network_volume_paths && Array.isArray(body.network_volume_paths)) {
      console.log(`🖼️ Processing ${body.network_volume_paths.length} S3 network volume images for job ${jobId}`);
      
      try {
        const savedImages = [];
        
        for (const pathData of body.network_volume_paths) {
          const { filename, subfolder, type, s3_key, file_size } = pathData;
          
          console.log(`💾 Saving S3 network volume image: ${filename} with S3 key: ${s3_key}`);
          
          // Save to database with S3 key (no image data stored)
          const savedImage = await saveImageToDatabase(
            existingJob.clerkId,
            jobId,
            { filename, subfolder, type },
            {
              saveData: false, // Don't save image bytes to database
              extractMetadata: false, // Don't extract metadata (we have it from handler)
              s3Key: s3_key, // NEW: Store S3 key instead of network volume path
              fileSize: file_size
            }
          );
          
          if (savedImage) {
            savedImages.push(savedImage);
            console.log(`✅ S3 network volume image saved to database: ${savedImage.id}`);
          } else {
            console.error(`❌ Failed to save S3 network volume image: ${filename}`);
          }
        }
        
        updateData.completedAt = new Date();
        updateData.resultImages = savedImages;
        
        console.log(`✅ Saved ${savedImages.length} S3 network volume images for job ${jobId}`);
      } catch (imageError) {
        console.error('❌ Error processing S3 network volume images:', imageError);
        updateData.error = 'Failed to process S3 network volume images';
        updateData.status = 'failed';
      }
    }

    // Handle S3 keys from style transfer handler (NEW: Enhanced S3 support)
    if (status === 'COMPLETED' && body.s3Keys && Array.isArray(body.s3Keys) && body.s3Keys.length > 0) {
      console.log(`📤 Processing ${body.s3Keys.length} S3 keys from style transfer handler for job ${jobId}`);
      
      try {
        const savedImages = [];
        const s3Keys = body.s3Keys;
        const networkVolumePaths = body.networkVolumePaths || [];
        const resultUrls = body.resultUrls || [];
        
        for (let i = 0; i < s3Keys.length; i++) {
          const s3Key = s3Keys[i];
          const networkVolumePath = networkVolumePaths[i];
          const resultUrl = resultUrls[i];
          
          // Parse filename from result URL or S3 key
          let filename = `image_${i + 1}.png`;
          let subfolder = '';
          let type = 'output';
          
          if (resultUrl) {
            try {
              const url = new URL(resultUrl);
              filename = url.searchParams.get('filename') || filename;
              subfolder = url.searchParams.get('subfolder') || '';
              type = url.searchParams.get('type') || 'output';
            } catch (urlError) {
              console.warn('⚠️ Failed to parse result URL:', resultUrl);
            }
          } else if (s3Key) {
            // Extract filename from S3 key: generated-images/jobId/filename
            const keyParts = s3Key.split('/');
            if (keyParts.length >= 3) {
              filename = keyParts[keyParts.length - 1];
            }
          }
          
          console.log(`💾 Saving S3 image: ${filename} with S3 key: ${s3Key}`);
          
          // Save to database with S3 key and network volume path
          const savedImage = await saveImageToDatabase(
            existingJob.clerkId,
            jobId,
            { filename, subfolder, type },
            {
              saveData: false, // Don't save image bytes (use S3)
              extractMetadata: false, // Handler already provided metadata
              s3Key: s3Key,
              networkVolumePath: networkVolumePath
            }
          );
          
          if (savedImage) {
            savedImages.push(savedImage);
            console.log(`✅ S3 image saved to database: ${savedImage.id}`);
          } else {
            console.error(`❌ Failed to save S3 image: ${filename}`);
          }
        }
        
        updateData.completedAt = new Date();
        updateData.resultImages = savedImages;
        
        console.log(`✅ Saved ${savedImages.length} S3 images for job ${jobId}`);
      } catch (imageError) {
        console.error('❌ Error processing S3 images:', imageError);
        updateData.error = 'Failed to process S3 images';
        updateData.status = 'failed';
      }
    }

    // Handle completed generation with images (including skin enhancer chunked delivery)
    const imagesToProcess: any[] = [];
    
    // Handle different image delivery formats
    if (images && Array.isArray(images)) {
      imagesToProcess.push(...images);
    } else if (body.image) {
      // Handle single chunked image delivery (from skin enhancer)
      imagesToProcess.push(body.image);
    } else if (body.allImages && Array.isArray(body.allImages)) {
      // Handle skin enhancer final completion with all images
      imagesToProcess.push(...body.allImages);
    }
    
    // Check if the webhook provides resultUrls directly (for final completion)
    if (status === 'COMPLETED' && body.resultUrls && Array.isArray(body.resultUrls)) {
      console.log(`📋 Using provided resultUrls from webhook: ${body.resultUrls.length} URLs`);
      updateData.resultUrls = body.resultUrls;
    } else if ((status === 'COMPLETED' || status === 'IMAGE_CHUNK' || status === 'IMAGE_READY') && imagesToProcess.length > 0) {
      const isChunkDelivery = status === 'IMAGE_CHUNK' || status === 'IMAGE_READY';
      console.log(`🖼️ Processing ${imagesToProcess.length} generated images for job ${jobId}${isChunkDelivery ? ' (chunk delivery)' : ''}`);
      
      // Store images in database and get URLs
      const imageUrls: string[] = [];
      
      for (const imageInfo of imagesToProcess) {
        try {
          console.log('📸 Processing image:', imageInfo.filename);
          
          // Check if image data is provided directly in webhook (from text_to_image_handler.py or style_transfer_handler.py)
          if (imageInfo.data) {
            console.log('💾 Image data provided in webhook, saving directly to database');
            
            // Extract base64 data (remove data:image/png;base64, prefix)
            const base64Data = imageInfo.data.replace(/^data:image\/[a-z]+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            
            console.log(`📊 Processing webhook image: ${imageInfo.filename}, size: ${imageBuffer.length} bytes`);
            
            // Include S3 and network volume data if provided
            const saveOptions: any = { 
              extractMetadata: true,
              providedData: imageBuffer // Pass the buffer directly
            };
            
            // Add S3 key if provided by the handler
            if (imageInfo.s3Key) {
              saveOptions.s3Key = imageInfo.s3Key;
              saveOptions.saveData = false; // Don't save blob data when S3 key is available
              console.log('📤 S3 key provided - using S3 optimization:', imageInfo.s3Key);
            } else {
              saveOptions.saveData = true; // Save blob data only when no S3 key
              console.log('⚠️ No S3 key provided - saving blob data to database (legacy mode)');
            }
            
            // Add network volume path if provided by the handler
            if (imageInfo.networkVolumePath) {
              saveOptions.networkVolumePath = imageInfo.networkVolumePath;
              console.log('💾 Network volume path provided:', imageInfo.networkVolumePath);
            }
            
            // Add file size if provided
            if (imageInfo.fileSize) {
              saveOptions.fileSize = imageInfo.fileSize;
              console.log('📏 File size provided:', imageInfo.fileSize);
            }
            
            // Save directly to database with provided data and S3/network volume info
            const imageRecord = await saveImageToDatabase(
              existingJob.clerkId,
              jobId,
              {
                filename: imageInfo.filename,
                subfolder: imageInfo.subfolder || '',
                type: imageInfo.type || 'output'
              },
              saveOptions
            );
            
            if (imageRecord && imageRecord.dataUrl) {
              imageUrls.push(imageRecord.dataUrl);
              console.log('✅ Image stored with provided data:', imageRecord.filename, 'URL:', imageRecord.dataUrl);
            } else {
              console.error('❌ Failed to save image with provided data:', imageInfo.filename);
            }
          } else {
            console.log('📡 No image data in webhook, downloading from ComfyUI');
            
            // Store image info AND binary data in database (download from ComfyUI)
            const imageRecord = await saveImageToDatabase(
              existingJob.clerkId,
              jobId,
              {
                filename: imageInfo.filename,
                subfolder: imageInfo.subfolder || '',
                type: imageInfo.type || 'output'
              },
              { 
                saveData: true, // ✅ Now save the actual image bytes!
                extractMetadata: true // Also extract image metadata
              }
            );
            
            if (imageRecord && imageRecord.dataUrl) {
              imageUrls.push(imageRecord.dataUrl);
              console.log('✅ Image downloaded and stored:', imageRecord.filename, 'URL:', imageRecord.dataUrl);
            } else {
              console.error('❌ Failed to download and save image:', imageInfo.filename);
            }
          }
        } catch (imageError) {
          console.error('❌ Error processing image:', imageInfo.filename, imageError);
          // Try to continue processing other images
        }
      }
      
      // Handle resultUrls appropriately for chunked vs complete delivery
      if (isChunkDelivery && status === 'IMAGE_READY') {
        // For chunked delivery, append to existing URLs
        const currentUrls = existingJob.resultUrls || [];
        updateData.resultUrls = [...currentUrls, ...imageUrls];
        console.log(`✅ Added ${imageUrls.length} chunked images. Total: ${updateData.resultUrls.length} images for job ${jobId}`);
      } else {
        // For complete delivery or final completion, set all URLs
        updateData.resultUrls = imageUrls;
        console.log(`✅ Stored ${imageUrls.length} image URLs for job ${jobId}`);
      }
    }

    // Handle S3-optimized videos from network_volume_paths (image-to-video with S3 storage)
    // Only process as videos if the files are actually video files or the job type indicates video generation
    if (status === 'COMPLETED' && network_volume_paths && Array.isArray(network_volume_paths)) {
      // Check if these are actually video files by examining extensions and job type
      const hasVideoFiles = network_volume_paths.some(item => {
        const filename = item.filename || '';
        return filename.toLowerCase().match(/\.(mp4|mov|avi|webm|mkv)$/);
      });
      
      const isVideoGenerationJob = existingJob.type === 'IMAGE_TO_VIDEO' || existingJob.type === 'TEXT_TO_VIDEO' || existingJob.type === 'VIDEO_TO_VIDEO';
      
      if (hasVideoFiles || isVideoGenerationJob) {
        console.log(`🎬 Processing ${network_volume_paths.length} S3-optimized videos for job ${jobId}`);
        
        // Store video metadata in database (no blob data)
        const videoUrls: string[] = [];
        
        for (const videoInfo of network_volume_paths) {
          try {
            console.log('🎬 Processing S3 video:', videoInfo.filename, 'S3 key:', videoInfo.s3Key);
            
            // Save video metadata to database without blob data
            const videoRecord = await saveVideoToDatabase(
              existingJob.clerkId,
              jobId,
              {
                filename: videoInfo.filename,
                subfolder: videoInfo.subfolder || '',
                type: videoInfo.type || 'output',
                s3Key: videoInfo.s3Key,  // Include S3 key for retrieval
                networkVolumePath: videoInfo.networkVolumePath,
                fileSize: videoInfo.fileSize || 0
              },
              { 
                saveData: false,  // Don't save blob data
                extractMetadata: false,  // Metadata provided
                s3Key: videoInfo.s3Key  // Pass S3 key for URL generation
              }
            );
            
            if (videoRecord) {
              // Use S3 URL generation
              const videoUrl = `/api/videos/${videoRecord.id}/data`;
              videoUrls.push(videoUrl);
              console.log('✅ S3 video stored:', videoRecord.filename, 'URL:', videoUrl);
            } else {
              console.error('❌ Failed to save S3 video metadata:', videoInfo.filename);
            }
          } catch (videoError) {
            console.error('❌ Error processing S3 video:', videoInfo.filename, videoError);
          }
        }
        
        if (videoUrls.length > 0) {
          updateData.resultUrls = videoUrls;
          console.log(`✅ Stored ${videoUrls.length} S3 video URLs for job ${jobId}`);
        }
      } else {
        console.log(`🖼️ Network volume paths contain image files, skipping video processing for job ${jobId}`);
        // These will be handled by the existing image processing logic above
      }
    }
    // Handle completed generation with videos (for image-to-video with blob data - backward compatibility)
    else if (status === 'COMPLETED' && videos && Array.isArray(videos)) {
      console.log(`🎬 Processing ${videos.length} generated videos for job ${jobId}`);
      
      // Store videos in database and get URLs
      const videoUrls: string[] = [];
      
      for (const videoInfo of videos) {
        try {
          console.log('🎬 Processing video:', videoInfo.filename);
          
          // Check if video data is provided directly in webhook (from image_to_video_handler.py)
          if (videoInfo.data) {
            console.log('💾 Video data provided in webhook, saving directly to database');
            
            // Extract base64 data
            const base64Data = videoInfo.data;
            const videoBuffer = Buffer.from(base64Data, 'base64');
            
            console.log(`📊 Processing webhook video: ${videoInfo.filename}, size: ${videoBuffer.length} bytes`);
            
            // Save directly to database with provided data
            const videoRecord = await saveVideoToDatabase(
              existingJob.clerkId,
              jobId,
              {
                filename: videoInfo.filename,
                subfolder: videoInfo.subfolder || '',
                type: videoInfo.type || 'output'
              },
              { 
                saveData: true,
                extractMetadata: true,
                providedData: videoBuffer // Pass the buffer directly
              }
            );
            
            if (videoRecord && videoRecord.dataUrl) {
              videoUrls.push(videoRecord.dataUrl);
              console.log('✅ Video stored with provided data:', videoRecord.filename, 'URL:', videoRecord.dataUrl);
            } else {
              console.error('❌ Failed to save video with provided data:', videoInfo.filename);
            }
          } else {
            console.log('📡 No video data in webhook, this is expected for image-to-video serverless');
            console.log('⚠️ Serverless video generation should provide video data directly in webhook');
          }
        } catch (videoError) {
          console.error('❌ Error processing video:', videoInfo.filename, videoError);
          // Try to continue processing other videos
        }
      }
      
      if (videoUrls.length > 0) {
        updateData.resultUrls = videoUrls;
        console.log(`✅ Stored ${videoUrls.length} video URLs for job ${jobId}`);
      }
    }

    // Update job in database
    const updatedJob = await updateJob(jobId, updateData);
    
    if (updatedJob) {
      console.log('✅ Job updated successfully:', jobId);
      
      // Log final completion
      if (status === 'COMPLETED') {
        console.log(`🎉 Generation job completed: ${jobId}`);
        if (updateData.resultUrls && images) {
          console.log(`📊 Final stats: ${updateData.resultUrls.length} images generated`);
        } else if (updateData.resultUrls && videos) {
          console.log(`📊 Final stats: ${updateData.resultUrls.length} videos generated`);
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Webhook processed successfully',
        jobId 
      });
    } else {
      throw new Error('Failed to update job in database');
    }

  } catch (error) {
    console.error('❌ Generation webhook error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      },
      { status: 500 }
    );
  }
}
