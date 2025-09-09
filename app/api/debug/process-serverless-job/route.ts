import { NextRequest, NextResponse } from 'next/server';
import { updateJob, getJob } from '@/lib/jobsStorage';
import { saveImageToDatabase } from '@/lib/imageStorage';

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, runpodJobId, userId } = body;

    if (!jobId || !runpodJobId || !userId) {
      return NextResponse.json({
        error: 'Missing required fields: jobId, runpodJobId, userId',
        example: {
          jobId: 'txt2img_1756801716642_680ruj4uy',
          runpodJobId: '6daa7eed-46b5-4a01-afd2-fdefbf3ff06f-e2',
          userId: 'user_30dULT8ZLO1jthhCEgn349cKcvT'
        }
      }, { status: 400 });
    }

    console.log('🔧 Manual processing for job:', jobId, 'RunPod:', runpodJobId, 'User:', userId);

    // Check RunPod job status
    const runpodStatusUrl = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${runpodJobId}`;
    
    const statusResponse = await fetch(runpodStatusUrl, {
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      },
    });

    if (!statusResponse.ok) {
      return NextResponse.json({
        error: 'Failed to get RunPod status',
        status: statusResponse.status
      }, { status: 500 });
    }

    const statusData = await statusResponse.json();
    console.log('📊 RunPod status:', statusData.status);

    if (statusData.status !== 'COMPLETED') {
      return NextResponse.json({
        error: 'RunPod job not completed',
        currentStatus: statusData.status
      }, { status: 400 });
    }

    // Process images
    const images: string[] = [];
    
    if (statusData.output && statusData.output.images && statusData.output.images.length > 0) {
      console.log(`🖼️ Processing ${statusData.output.images.length} images...`);
      
      for (let i = 0; i < statusData.output.images.length; i++) {
        const imageData = statusData.output.images[i];
        console.log(`📸 Processing image ${i + 1}:`, imageData.filename);
        
        try {
          // Extract base64 data
          let base64Data = imageData.data;
          if (base64Data && base64Data.startsWith('data:image/')) {
            base64Data = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
          }
          
          if (!base64Data) {
            console.error(`❌ No base64 data for image ${i + 1}`);
            continue;
          }
          
          const imageBuffer = Buffer.from(base64Data, 'base64');
          console.log(`📊 Image ${i + 1} buffer: ${imageBuffer.length} bytes`);
          
          // Save to database
          const imageRecord = await saveImageToDatabase(
            userId,
            jobId,
            {
              filename: imageData.filename || `manual_${Date.now()}_${i + 1}.png`,
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
            console.log(`✅ Image ${i + 1} saved:`, imageRecord.filename);
          }
          
        } catch (imageError) {
          console.error(`❌ Failed to process image ${i + 1}:`, imageError);
        }
      }
    } else {
      console.warn('⚠️ No images found in RunPod response');
    }

    // Update job status
    const updateData: any = {
      status: 'completed' as any,
      progress: 100
    };

    if (images.length > 0) {
      updateData.resultUrls = images;
    }

    await updateJob(jobId, updateData);
    console.log(`✅ Job ${jobId} updated with ${images.length} images`);

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${images.length} images`,
      jobId,
      imagesProcessed: images.length,
      imageUrls: images
    });

  } catch (error) {
    console.error('❌ Manual processing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
