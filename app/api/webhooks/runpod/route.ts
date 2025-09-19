import { NextRequest, NextResponse } from 'next/server';
import { updateJob, getJob } from '@/lib/jobsStorage';
import { saveImageToDatabase, buildComfyUIUrl } from '@/lib/imageStorage';
import { saveVideoToDatabase, buildComfyUIVideoUrl } from '@/lib/videoStorage';
import { prisma } from '@/lib/database';

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
    const { status, progress, message, images, videos, error, prompt_id, resultUrls, allImages } = body;

    console.log(`📊 Job ${jobId} status update: ${status}, progress: ${progress}%`);

    // Prepare update data
    const updateData: any = {};

    if (status) {
      // Map webhook status to database JobStatus enum
      let mappedStatus: string;
      switch (status.toUpperCase()) {
        case 'PENDING':
        case 'QUEUED':
          mappedStatus = 'PENDING';
          break;
        case 'PROCESSING':
        case 'IN_PROGRESS':
        case 'RUNNING':
          mappedStatus = 'PROCESSING';
          break;
        case 'COMPLETED':
        case 'IMAGE_READY':
        case 'FINISHED':
        case 'SUCCESS':
          mappedStatus = 'COMPLETED';
          break;
        case 'FAILED':
        case 'ERROR':
        case 'CANCELLED':
          mappedStatus = 'FAILED';
          break;
        default:
          mappedStatus = status.toUpperCase();
      }
      updateData.status = mappedStatus;
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

    // Handle resultUrls for completed generations
    if (resultUrls && Array.isArray(resultUrls) && resultUrls.length > 0) {
      updateData.resultUrls = resultUrls;
      console.log(`📊 Adding ${resultUrls.length} result URLs to job ${jobId}`);
      
      // For completed status with resultUrls, create GeneratedImage records
      if (status === 'COMPLETED') {
        console.log(`🖼️ Processing ${resultUrls.length} result URLs for job ${jobId}`);
        
        try {
          const savedImages = [];
          
          for (const url of resultUrls) {
            // Parse the ComfyUI URL to get path components
            const { parseComfyUIUrl } = await import('@/lib/imageStorage');
            const pathInfo = parseComfyUIUrl(url);
            
            if (pathInfo) {
              console.log(`💾 Creating image record from URL: ${pathInfo.filename}`);
              
              // Check if this image already exists
              const existingImage = await prisma.generatedImage.findFirst({
                where: {
                  jobId: jobId,
                  filename: pathInfo.filename,
                  subfolder: pathInfo.subfolder,
                  type: pathInfo.type
                }
              });
              
              if (!existingImage) {
                // Create the GeneratedImage record
                const savedImage = await prisma.generatedImage.create({
                  data: {
                    clerkId: existingJob.clerkId,
                    jobId: jobId,
                    filename: pathInfo.filename,
                    subfolder: pathInfo.subfolder,
                    type: pathInfo.type,
                    metadata: { sourceUrl: url }
                  }
                });
                
                savedImages.push(savedImage);
                console.log(`✅ Image record created from URL: ${savedImage.id}`);
              } else {
                console.log(`ℹ️ Image already exists: ${pathInfo.filename}`);
                savedImages.push(existingImage);
              }
            } else {
              console.error(`❌ Failed to parse ComfyUI URL: ${url}`);
            }
          }
          
          if (savedImages.length > 0) {
            updateData.resultImages = savedImages;
            console.log(`✅ Created ${savedImages.length} image records from URLs for job ${jobId}`);
          }
        } catch (urlError) {
          console.error('❌ Error processing result URLs:', urlError);
          updateData.error = 'Failed to process result URLs';
        }
      }
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

    // Handle completed generation with allImages (from final completion webhook)
    if (status === 'COMPLETED' && allImages && Array.isArray(allImages)) {
      console.log(`🖼️ Processing ${allImages.length} images from completion webhook for job ${jobId}`);
      
      try {
        const savedImages = [];
        
        for (const imageData of allImages) {
          const { filename, subfolder, type, data } = imageData;
          
          // Create path info object
          const pathInfo = { filename, subfolder, type };
          
          console.log(`💾 Saving completion image: ${filename}`);
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
          
          // Save to database (check if not already saved to avoid duplicates)
          const savedImage = await saveImageToDatabase(
            existingJob.clerkId,
            jobId,
            pathInfo,
            {
              saveData: true,
              extractMetadata: true,
              providedData: imageBuffer
            }
          );
          
          if (savedImage) {
            savedImages.push(savedImage);
            console.log(`✅ Completion image saved to database: ${savedImage.id}`);
          } else {
            console.log(`ℹ️ Image may already exist: ${filename}`);
          }
        }
        
        updateData.completedAt = new Date();
        if (savedImages.length > 0) {
          updateData.resultImages = savedImages;
        }
        
        console.log(`✅ Processed ${savedImages.length} completion images for job ${jobId}`);
      } catch (imageError) {
        console.error('❌ Error processing completion images:', imageError);
        updateData.error = 'Failed to process completion images';
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
