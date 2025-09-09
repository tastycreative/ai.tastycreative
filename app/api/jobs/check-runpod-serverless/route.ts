import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { updateJob, getJob } from '@/lib/jobsStorage';
import { saveImageToDatabase } from '@/lib/imageStorage';

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID;

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId' },
        { status: 400 }
      );
    }

    console.log('🔍 Checking RunPod serverless job completion for:', jobId);

    // Get job from database
    const existingJob = await getJob(jobId);
    if (!existingJob || existingJob.clerkId !== userId) {
      return NextResponse.json(
        { error: 'Job not found or unauthorized' },
        { status: 404 }
      );
    }

    // Check if job already completed
    if (existingJob.status === 'completed') {
      return NextResponse.json({
        success: true,
        jobId,
        status: 'completed',
        progress: 100,
        message: 'Job already completed'
      });
    }

    // Extract RunPod job ID from params
    const runpodJobId = existingJob.params?.runpodJobId;
    if (!runpodJobId) {
      return NextResponse.json(
        { error: 'No RunPod job ID found' },
        { status: 400 }
      );
    }

    console.log('🔍 Checking RunPod status for:', runpodJobId);

    // Check RunPod job status
    const runpodStatusUrl = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${runpodJobId}`;
    
    const statusResponse = await fetch(runpodStatusUrl, {
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      },
    });

    if (!statusResponse.ok) {
      console.error('❌ Failed to get RunPod status:', statusResponse.status);
      return NextResponse.json(
        { error: 'Failed to get RunPod status' },
        { status: 500 }
      );
    }

    const statusData = await statusResponse.json();
    console.log('📊 RunPod status response:', JSON.stringify(statusData, null, 2));

    // Map RunPod status to our status
    let ourStatus = existingJob.status;
    let progress = existingJob.progress || 0;
    const images: string[] = [];
    let message = 'Processing...';

    switch (statusData.status) {
      case 'IN_QUEUE':
        ourStatus = 'pending';
        progress = 0;
        message = 'Job queued on RunPod...';
        break;
        
      case 'IN_PROGRESS':
        ourStatus = 'processing';
        progress = Math.min(90, progress + 10); // Increment progress
        message = `Generating image... ${progress}%`;
        break;
        
      case 'COMPLETED':
        ourStatus = 'completed' as any; // Type assertion for completed status
        progress = 100;
        message = 'Image generation completed!';
        
        // Handle completed serverless job with direct image data
        console.log('🎉 RunPod job completed! Processing images...');
        
        if (statusData.output && statusData.output.images && statusData.output.images.length > 0) {
          console.log(`🖼️ Found ${statusData.output.images.length} images in serverless response`);
          
          for (let i = 0; i < statusData.output.images.length; i++) {
            const imageData = statusData.output.images[i];
            console.log(`📸 Processing image ${i + 1}:`, {
              filename: imageData.filename,
              hasData: !!imageData.data,
              dataLength: imageData.data ? imageData.data.length : 0
            });
            
            try {
              // Extract base64 data from serverless handler response
              let base64Data = imageData.data;
              if (base64Data && base64Data.startsWith('data:image/')) {
                base64Data = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
              }
              
              if (!base64Data) {
                console.error(`❌ No base64 data found for image ${i + 1}`);
                continue;
              }
              
              const imageBuffer = Buffer.from(base64Data, 'base64');
              console.log(`📊 Image ${i + 1} buffer size: ${imageBuffer.length} bytes`);
              
              // Save to database
              const imageRecord = await saveImageToDatabase(
                userId,
                jobId,
                {
                  filename: imageData.filename || `generated_${Date.now()}_${i + 1}.png`,
                  subfolder: '',
                  type: 'output'
                },
                { 
                  saveData: true,
                  extractMetadata: true,
                  providedData: imageBuffer
                }
              );
              
              if (imageRecord && imageRecord.dataUrl) {
                images.push(imageRecord.dataUrl);
                console.log(`✅ Image ${i + 1} saved to database:`, imageRecord.filename);
              } else {
                console.error(`❌ Failed to save image ${i + 1} to database`);
              }
              
            } catch (imageError) {
              console.error(`❌ Failed to process image ${i + 1}:`, imageError);
            }
          }
          
          console.log(`✅ Successfully saved ${images.length} images to database`);
        } else {
          console.warn('⚠️ No images found in RunPod serverless response');
          console.log('🔍 Response structure check:', {
            hasOutput: !!statusData.output,
            hasImages: !!(statusData.output && statusData.output.images),
            imagesLength: statusData.output?.images?.length || 0
          });
        }
        break;
        
      case 'FAILED':
      case 'CANCELLED':
      case 'TIMED_OUT':
        ourStatus = 'failed';
        message = `Job ${statusData.status.toLowerCase()}`;
        if (statusData.output?.error) {
          message += `: ${statusData.output.error}`;
        }
        break;
        
      default:
        console.log('🤔 Unknown RunPod status:', statusData.status);
        break;
    }

    // Update job in database
    const updateData: any = {
      status: ourStatus,
      progress: progress
    };

    if (statusData.output?.error) {
      updateData.error = statusData.output.error;
    }

    if (images.length > 0) {
      updateData.resultUrls = images;
    }

    await updateJob(jobId, updateData);
    console.log(`📝 Updated job ${jobId} with status: ${ourStatus}, progress: ${progress}%, images: ${images.length}`);

    return NextResponse.json({
      success: true,
      jobId,
      status: ourStatus,
      progress,
      images,
      runpodStatus: statusData.status,
      message
    });

  } catch (error) {
    console.error('❌ RunPod serverless check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
