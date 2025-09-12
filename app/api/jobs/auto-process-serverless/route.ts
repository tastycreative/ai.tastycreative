import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { updateJob } from '@/lib/jobsStorage';
import { saveImageToDatabase } from '@/lib/imageStorage';
import { prisma } from '@/lib/database';

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID = process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID;
const RUNPOD_STYLE_TRANSFER_ENDPOINT_ID = process.env.RUNPOD_STYLE_TRANSFER_ENDPOINT_ID;

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

    console.log('🔄 Auto-processing serverless jobs for user:', userId);

    // Get all jobs for this user from database
    const jobs = await prisma.generationJob.findMany({
      where: { clerkId: userId },
      orderBy: { createdAt: 'desc' }
    });
    
    let processedCount = 0;
    let totalImages = 0;

    for (const job of jobs) {
      // Skip if job doesn't have RunPod job ID or is already completed with images
      const params = job.params as any;
      const runpodJobId = params?.runpodJobId;
      if (!runpodJobId || (job.status === 'COMPLETED' && job.resultUrls && job.resultUrls.length > 0)) {
        continue;
      }

      console.log(`🔍 Checking RunPod job: ${job.id} (${runpodJobId})`);

      try {
        // Determine which endpoint to use based on job action/type
        let endpointId = RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID; // Default
        
        if (params?.action === 'generate_style_transfer' || 
            params?.generation_type === 'style_transfer') {
          endpointId = RUNPOD_STYLE_TRANSFER_ENDPOINT_ID;
        }

        if (!endpointId) {
          console.error('❌ No RunPod endpoint ID configured for this job type');
          continue;
        }

        // Check RunPod status
        const runpodStatusUrl = `https://api.runpod.ai/v2/${endpointId}/status/${runpodJobId}`;
        
        const statusResponse = await fetch(runpodStatusUrl, {
          headers: {
            'Authorization': `Bearer ${RUNPOD_API_KEY}`,
          },
        });

        if (!statusResponse.ok) {
          console.warn(`⚠️ Failed to get status for ${runpodJobId}: ${statusResponse.status}`);
          continue;
        }

        const statusData = await statusResponse.json();

        if (statusData.status === 'COMPLETED' && statusData.output && statusData.output.images) {
          console.log(`🎉 Found completed job with ${statusData.output.images.length} images: ${job.id}`);
          
          const images: string[] = [];
          
          for (let i = 0; i < statusData.output.images.length; i++) {
            const imageData = statusData.output.images[i];
            
            try {
              // Extract base64 data
              let base64Data = imageData.data;
              if (base64Data && base64Data.startsWith('data:image/')) {
                base64Data = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
              }
              
              if (!base64Data) {
                console.warn(`⚠️ No base64 data for image ${i + 1} in job ${job.id}`);
                continue;
              }
              
              const imageBuffer = Buffer.from(base64Data, 'base64');
              
              // Save to database
              const imageRecord = await saveImageToDatabase(
                userId,
                job.id,
                {
                  filename: imageData.filename || `auto_${Date.now()}_${i + 1}.png`,
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
                totalImages++;
              }
              
            } catch (imageError) {
              console.error(`❌ Failed to process image ${i + 1} for job ${job.id}:`, imageError);
            }
          }
          
          // Update job with completed status and images
          if (images.length > 0) {
            await updateJob(job.id, {
              status: 'completed' as any,
              progress: 100,
              resultUrls: images
            });
            
            processedCount++;
            console.log(`✅ Updated job ${job.id} with ${images.length} images`);
          }
        }
        
      } catch (jobError) {
        console.error(`❌ Failed to process job ${job.id}:`, jobError);
      }
    }

    console.log(`✅ Auto-processing complete: ${processedCount} jobs processed, ${totalImages} images saved`);

    return NextResponse.json({
      success: true,
      jobsProcessed: processedCount,
      imagesProcessed: totalImages,
      message: processedCount > 0 ? `Processed ${processedCount} jobs with ${totalImages} images` : 'No new completed jobs found'
    });

  } catch (error) {
    console.error('❌ Auto-processing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
