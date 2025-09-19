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
          
          // Check if image data is provided directly in webhook (from text_to_image_handler.py)
          if (imageInfo.data) {
            console.log('💾 Image data provided in webhook, saving directly to database');
            
            // Extract base64 data (remove data:image/png;base64, prefix)
            const base64Data = imageInfo.data.replace(/^data:image\/[a-z]+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            
            console.log(`📊 Processing webhook image: ${imageInfo.filename}, size: ${imageBuffer.length} bytes`);
            
            // Save directly to database with provided data
            const imageRecord = await saveImageToDatabase(
              existingJob.clerkId,
              jobId,
              {
                filename: imageInfo.filename,
                subfolder: imageInfo.subfolder || '',
                type: imageInfo.type || 'output'
              },
              { 
                saveData: true,
                extractMetadata: true,
                providedData: imageBuffer // Pass the buffer directly
              }
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

    // Handle completed generation with videos (for image-to-video)
    if (status === 'COMPLETED' && videos && Array.isArray(videos)) {
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
