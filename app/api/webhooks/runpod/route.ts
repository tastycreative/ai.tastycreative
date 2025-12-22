import { NextRequest, NextResponse } from 'next/server';
import { updateJob, getJob } from '@/lib/jobsStorage';
import { saveImageToDatabase, buildComfyUIUrl, extractLoraModelsFromParams } from '@/lib/imageStorage';
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
    }

    // Handle completed generation with AWS S3 paths (new format)
    if (status === 'COMPLETED' && body.aws_s3_paths && Array.isArray(body.aws_s3_paths)) {
      console.log(`🖼️ Processing ${body.aws_s3_paths.length} AWS S3 images for job ${jobId}`);
      
      try {
        const savedImages = [];
        const resultUrls = [];
        
        // 🔓 SHARED FOLDER SUPPORT: Extract owner clerkId from S3 path if it's a shared folder
        let targetClerkId = existingJob.clerkId; // Default to job creator
        
        // Check the first S3 key to determine if it's a shared folder
        if (body.aws_s3_paths.length > 0) {
          const firstPathData = body.aws_s3_paths[0];
          const s3Key = firstPathData.awsS3Key || firstPathData.s3_key || firstPathData.s3Key;
          
          if (s3Key && s3Key.startsWith('outputs/')) {
            console.log('🔍 DEBUG (runpod): Checking S3 key for shared folder:', s3Key);
            
            // Extract owner from S3 path: outputs/{ownerId}/folderName/filename
            const pathParts = s3Key.split('/');
            if (pathParts.length >= 3 && pathParts[0] === 'outputs' && pathParts[1].startsWith('user_')) {
              const ownerUserId = pathParts[1];
              console.log('🔍 DEBUG (runpod): Extracted owner from S3 path:', ownerUserId);
              
              // Verify owner exists in database
              const { PrismaClient } = await import('@/lib/generated/prisma');
              const prisma = new PrismaClient();
              
              const ownerUser = await prisma.user.findUnique({
                where: { clerkId: ownerUserId }
              });
              
              await prisma.$disconnect();
              
              if (ownerUser) {
                console.log('🔓 Detected shared folder (runpod) - Owner:', ownerUserId, 'Generator:', existingJob.clerkId);
                targetClerkId = ownerUserId;
              } else {
                console.warn('⚠️ Owner not found in database, using job creator:', ownerUserId);
              }
            }
          }
        }
        
        console.log('✅ Using clerkId for image save (runpod):', targetClerkId);
        
        // Extract LoRA models from job params for tracking
        const loraModels = extractLoraModelsFromParams(existingJob.params);
        console.log('🎨 Extracted LoRA models from job:', loraModels);
        
        for (const pathData of body.aws_s3_paths) {
          const { filename, subfolder, type, awsS3Key, awsS3Url, file_size } = pathData;
          
          console.log(`💾 Saving AWS S3 image: ${filename} at ${awsS3Key}`);
          console.log(`☁️ AWS S3 URL: ${awsS3Url}`);
          
          // Save to database with AWS S3 data using the correct clerkId
          const savedImage = await saveImageToDatabase(
            targetClerkId,
            jobId,
            { filename, subfolder, type },
            {
              saveData: false, // Don't save image bytes to database
              extractMetadata: false, // Don't extract metadata (we have it from handler)
              awsS3Key: awsS3Key,
              awsS3Url: awsS3Url,
              fileSize: file_size,
              loraModels: loraModels // ✅ Track LoRA models used
            }
          );
          
          if (savedImage) {
            savedImages.push(savedImage);
            
            // Use AWS S3 URL directly as result URL
            if (awsS3Url) {
              resultUrls.push(awsS3Url);
              console.log(`✅ Added AWS S3 URL: ${awsS3Url}`);
            }
            
            console.log(`✅ AWS S3 image saved to database: ${savedImage.id}`);
          } else {
            console.error(`❌ Failed to save AWS S3 image: ${filename}`);
          }
        }
        
        updateData.completedAt = new Date();
        updateData.resultImages = savedImages;
        
        // Add AWS S3 URLs to job resultUrls
        if (resultUrls.length > 0) {
          updateData.resultUrls = resultUrls;
          console.log(`✅ Added ${resultUrls.length} AWS S3 URLs to job resultUrls`);
        }
        
        console.log(`✅ Saved ${savedImages.length} AWS S3 images for job ${jobId}`);
      } catch (imageError) {
        console.error('❌ Error processing AWS S3 images:', imageError);
        updateData.error = 'Failed to process AWS S3 images';
        updateData.status = 'failed';
      }
    }
    // Handle completed generation with S3 network volume paths (legacy format)
    else if (status === 'COMPLETED' && body.network_volume_paths && Array.isArray(body.network_volume_paths)) {
      console.log(`🖼️ Processing ${body.network_volume_paths.length} S3 network volume images for job ${jobId}`);
      
      try {
        const savedImages = [];
        const resultUrls = [];
        
        // 🔓 SHARED FOLDER SUPPORT: Extract owner clerkId from S3 path if it's a shared folder
        let targetClerkId = existingJob.clerkId; // Default to job creator
        
        // Check the first S3 key to determine if it's a shared folder
        if (body.network_volume_paths.length > 0) {
          const firstPathData = body.network_volume_paths[0];
          const s3Key = firstPathData.s3_key || firstPathData.aws_s3_key || firstPathData.awsS3Key;
          
          if (s3Key && s3Key.startsWith('outputs/')) {
            console.log('🔍 DEBUG (network_volume): Checking S3 key for shared folder:', s3Key);
            
            // Extract owner from S3 path: outputs/{ownerId}/folderName/filename
            const pathParts = s3Key.split('/');
            if (pathParts.length >= 3 && pathParts[0] === 'outputs' && pathParts[1].startsWith('user_')) {
              const ownerUserId = pathParts[1];
              console.log('🔍 DEBUG (network_volume): Extracted owner from S3 path:', ownerUserId);
              
              // Verify owner exists in database
              const { PrismaClient } = await import('@/lib/generated/prisma');
              const prisma = new PrismaClient();
              
              const ownerUser = await prisma.user.findUnique({
                where: { clerkId: ownerUserId }
              });
              
              await prisma.$disconnect();
              
              if (ownerUser) {
                console.log('🔓 Detected shared folder (network_volume) - Owner:', ownerUserId, 'Generator:', existingJob.clerkId);
                targetClerkId = ownerUserId;
              } else {
                console.warn('⚠️ Owner not found in database, using job creator:', ownerUserId);
              }
            }
          }
        }
        
        console.log('✅ Using clerkId for image save (network_volume):', targetClerkId);
        
        // Extract LoRA models from job params for tracking
        const loraModels = extractLoraModelsFromParams(existingJob.params);
        console.log('🎨 Extracted LoRA models from job:', loraModels);
        
        for (const pathData of body.network_volume_paths) {
          const { filename, subfolder, type, s3_key, network_volume_path, file_size, aws_s3_key, aws_s3_url } = pathData;
          
          console.log(`💾 Saving S3 network volume image: ${filename} at ${s3_key || network_volume_path}`);
          if (aws_s3_key) {
            console.log(`☁️ AWS S3 URL: ${aws_s3_url}`);
          }
          
          // Save to database with both RunPod S3 and AWS S3 data using the correct clerkId
          const savedImage = await saveImageToDatabase(
            targetClerkId,
            jobId,
            { filename, subfolder, type },
            {
              saveData: false, // Don't save image bytes to database
              extractMetadata: false, // Don't extract metadata (we have it from handler)
              s3Key: s3_key,
              networkVolumePath: network_volume_path,
              awsS3Key: aws_s3_key,
              awsS3Url: aws_s3_url,
              fileSize: file_size,
              loraModels: loraModels // ✅ Track LoRA models used
            }
          );
          
          if (savedImage) {
            savedImages.push(savedImage);
            
            // Generate S3 proxy URL for frontend
            if (s3_key) {
              const proxyUrl = `/api/images/s3/${encodeURIComponent(s3_key)}`;
              resultUrls.push(proxyUrl);
              console.log(`✅ Generated S3 proxy URL: ${proxyUrl}`);
            }
            
            console.log(`✅ S3 network volume image saved to database: ${savedImage.id}`);
          } else {
            console.error(`❌ Failed to save S3 network volume image: ${filename}`);
          }
        }
        
        updateData.completedAt = new Date();
        updateData.resultImages = savedImages;
        
        // Add S3 proxy URLs to job resultUrls
        if (resultUrls.length > 0) {
          updateData.resultUrls = resultUrls;
          console.log(`✅ Added ${resultUrls.length} S3 proxy URLs to job resultUrls`);
        }
        
        console.log(`✅ Saved ${savedImages.length} S3 network volume images for job ${jobId}`);
      } catch (imageError) {
        console.error('❌ Error processing S3 network volume images:', imageError);
        updateData.error = 'Failed to process S3 network volume images';
        updateData.status = 'failed';
      }
    }

    // Handle completed generation with images (legacy support - base64 data)
    if (status === 'COMPLETED' && images && Array.isArray(images)) {
      console.log(`🖼️ Processing ${images.length} generated images for job ${jobId}`);
      
      try {
        const savedImages = [];
        
        // Use job creator's clerkId for legacy base64 images (unlikely to be shared folder)
        const targetClerkId = existingJob.userId || existingJob.clerkId;
        
        // Extract LoRA models from job params for tracking
        const loraModels = extractLoraModelsFromParams(existingJob.params);
        console.log('🎨 Extracted LoRA models from job:', loraModels);
        
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
            targetClerkId,
            jobId,
            pathInfo,
            {
              saveData: true, // Save the actual image bytes
              extractMetadata: true, // Extract basic metadata
              providedData: imageBuffer, // Use the converted buffer
              loraModels: loraModels // ✅ Track LoRA models used
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
        
        // Use job creator's clerkId for legacy completion images (unlikely to be shared folder)
        const targetClerkId = existingJob.clerkId;
        
        // Extract LoRA models from job params for tracking
        const loraModels = extractLoraModelsFromParams(existingJob.params);
        console.log('🎨 Extracted LoRA models from job:', loraModels);
        
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
            targetClerkId,
            jobId,
            pathInfo,
            {
              saveData: true,
              extractMetadata: true,
              providedData: imageBuffer,
              loraModels: loraModels // ✅ Track LoRA models used
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
        
        // Use job creator's clerkId for legacy video data (unlikely to be shared folder)
        const targetClerkId = existingJob.userId || existingJob.clerkId;
        
        for (const videoData of videos) {
          const { filename, subfolder, type } = videoData;
          
          // Create path info object
          const pathInfo = { filename, subfolder, type };
          
          console.log(`💾 Saving video: ${filename}`);
          
          // Save to database and get the result
          const savedVideo = await saveVideoToDatabase(
            targetClerkId,
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
