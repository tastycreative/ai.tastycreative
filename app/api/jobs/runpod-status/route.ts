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
    const { jobId, runpodJobId } = body;

    if (!jobId || !runpodJobId) {
      return NextResponse.json(
        { error: 'Missing jobId or runpodJobId' },
        { status: 400 }
      );
    }

    console.log('🔍 Polling RunPod status for job:', jobId, 'RunPod ID:', runpodJobId);

    // Check job exists and belongs to user
    const existingJob = await getJob(jobId);
    if (!existingJob || existingJob.clerkId !== userId) {
      return NextResponse.json(
        { error: 'Job not found or unauthorized' },
        { status: 404 }
      );
    }

    // Poll RunPod for job status
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
    console.log('📊 RunPod status response:', statusData);

    // Map RunPod status to our status
    let ourStatus = existingJob.status;
    let progress = existingJob.progress || 0;
    const images: string[] = [];

    switch (statusData.status) {
      case 'IN_QUEUE':
        ourStatus = 'pending';
        progress = 0;
        break;
      case 'IN_PROGRESS':
        ourStatus = 'processing';
        progress = Math.min(90, progress + 5); // Increment progress
        break;
      case 'COMPLETED':
        ourStatus = 'completed';
        progress = 100;
        
        // Handle completed job with images from serverless handler
        console.log('📦 Checking for images in RunPod response...');
        console.log('📊 Full output structure:', JSON.stringify(statusData.output, null, 2));
        
        // Check for images in direct serverless response format
        if (statusData.output && statusData.output.images) {
          console.log(`🖼️ Processing ${statusData.output.images.length} images from RunPod serverless response`);
          
          for (const imageData of statusData.output.images) {
            try {
              // Extract base64 data from serverless handler response
              let base64Data = imageData.data;
              if (base64Data && base64Data.startsWith('data:image/')) {
                base64Data = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
              }
              
              if (!base64Data) {
                console.error('❌ No base64 data found in image response');
                continue;
              }
              
              const imageBuffer = Buffer.from(base64Data, 'base64');
              console.log(`📊 Image buffer size: ${imageBuffer.length} bytes`);
              
              // Save to database
              const imageRecord = await saveImageToDatabase(
                userId,
                jobId,
                {
                  filename: imageData.filename || `generated_${Date.now()}.png`,
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
                console.log('✅ Image saved from RunPod response:', imageRecord.filename);
              }
              
            } catch (error) {
              console.error('❌ Failed to save image from RunPod response:', error);
            }
          }
        }
        break;
      case 'FAILED':
      case 'CANCELLED':
      case 'TIMED_OUT':
        ourStatus = 'failed';
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

    return NextResponse.json({
      success: true,
      jobId,
      status: ourStatus,
      progress,
      images,
      runpodStatus: statusData.status,
      message: getStatusMessage(ourStatus, progress)
    });

  } catch (error) {
    console.error('❌ RunPod status polling error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function getStatusMessage(status: string, progress: number): string {
  switch (status) {
    case 'pending':
      return 'Job queued on RunPod...';
    case 'processing':
      return `Generating image... ${progress}%`;
    case 'completed':
      return 'Image generation completed!';
    case 'failed':
      return 'Image generation failed';
    default:
      return 'Processing...';
  }
}
