import { NextRequest, NextResponse } from 'next/server';
import { updateJob, getJob } from '@/lib/jobsStorage';
import { saveImageToDatabase, buildComfyUIUrl } from '@/lib/imageStorage';
import { saveVideoToDatabase, buildComfyUIVideoUrl } from '@/lib/videoStorage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('🔔 RunPod webhook received:', body);
    console.log('🔍 Webhook body keys:', Object.keys(body));
    console.log('🖼️ Images in webhook:', body.images ? `${body.images.length} images` : 'No images');
    
    // Log first image for debugging
    if (body.images && body.images.length > 0) {
      const firstImage = body.images[0];
      console.log('🖼️ First image structure:', {
        filename: firstImage.filename,
        subfolder: firstImage.subfolder,
        type: firstImage.type,
        hasData: !!firstImage.data,
        dataLength: firstImage.data ? firstImage.data.length : 0
      });
    }

    // Extract job ID from the webhook data
    const jobId = body.job_id || body.jobId;
    if (!jobId) {
      console.error('❌ No job ID found in webhook payload');
      return NextResponse.json({ error: 'No job ID provided' }, { status: 400 });
    }

    console.log('🔔 Processing webhook for job:', jobId);

    // Verify job exists
    const existingJob = await getJob(jobId);
    if (!existingJob) {
      console.error('❌ Job not found:', jobId);
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Extract webhook data
    const { status, progress, message, images, videos, error, prompt_id } = body;

    console.log(`📊 Job ${jobId} status update: ${status}, progress: ${progress}%`);

    // Prepare update data
    const updateData: any = {};

    if (status) {
      updateData.status = status.toLowerCase();
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

    // Handle completed generation with images
    if (status === 'COMPLETED' && images && Array.isArray(images)) {
      console.log(`🖼️ Processing ${images.length} generated images for job ${jobId}`);
      
      try {
        const savedImages = [];
        
        for (const imageData of images) {
          const { filename, subfolder, type, data } = imageData;
          
          // Create path info object
          const pathInfo = { filename, subfolder, type };
          
          console.log(`💾 Saving image: ${filename}`);
          console.log(`📦 Image data available: ${data ? 'YES' : 'NO'}`);
          
          // Convert base64 data to Buffer if provided
          let imageBuffer: Buffer | undefined;
          if (data) {
            try {
              // Remove data:image/png;base64, prefix if present
              const base64Data = data.replace(/^data:image\/[a-z]+;base64,/, '');
              imageBuffer = Buffer.from(base64Data, 'base64');
              console.log(`✅ Converted base64 to buffer: ${imageBuffer.length} bytes`);
            } catch (error) {
              console.error('❌ Failed to convert base64 to buffer:', error);
            }
          }
          
          // Save to database with provided image data
          const savedImage = await saveImageToDatabase(
            existingJob.userId,
            jobId,
            pathInfo,
            {
              saveData: true, // Save the actual image bytes
              extractMetadata: true, // Extract basic metadata
              providedData: imageBuffer // Use the converted buffer
            }
          );
          
          if (savedImage) {
            savedImages.push(savedImage);
            console.log(`✅ Image saved to database: ${savedImage.id}`);
          } else {
            console.error(`❌ Failed to save image: ${filename}`);
          }
        }
        
        updateData.completedAt = new Date();
        updateData.resultImages = savedImages;
        
        console.log(`✅ Saved ${savedImages.length} images for job ${jobId}`);
      } catch (imageError) {
        console.error('❌ Error processing images:', imageError);
        updateData.error = 'Failed to process generated images';
        updateData.status = 'failed';
      }
    }

    // Handle completed generation with videos
    if (status === 'COMPLETED' && videos && Array.isArray(videos)) {
      console.log(`🎬 Processing ${videos.length} generated videos for job ${jobId}`);
      
      try {
        const savedVideos = [];
        
        for (const videoData of videos) {
          const { filename, subfolder, type } = videoData;
          
          // Create path info object
          const pathInfo = { filename, subfolder, type };
          
          console.log(`💾 Saving video: ${filename}`);
          
          // Save to database and get the result
          const savedVideo = await saveVideoToDatabase(
            existingJob.userId,
            jobId,
            pathInfo
          );
          
          if (savedVideo) {
            savedVideos.push(savedVideo);
          }
        }
        
        updateData.completedAt = new Date();
        updateData.resultVideos = savedVideos;
        
        console.log(`✅ Saved ${savedVideos.length} videos for job ${jobId}`);
      } catch (videoError) {
        console.error('❌ Error processing videos:', videoError);
        updateData.error = 'Failed to process generated videos';
        updateData.status = 'failed';
      }
    }

    // Handle failed status
    if (status === 'FAILED' || error) {
      updateData.status = 'failed';
      updateData.error = error || 'Generation failed';
      updateData.completedAt = new Date();
    }

    // Update the job in storage
    await updateJob(jobId, updateData);
    
    console.log(`✅ Job ${jobId} updated successfully`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed successfully',
      jobId: jobId
    });

  } catch (error) {
    console.error('❌ Webhook processing failed:', error);
    return NextResponse.json({ 
      error: 'Failed to process webhook',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
