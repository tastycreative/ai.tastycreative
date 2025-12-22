import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJob } from '@/lib/jobsStorage';
import { saveImageToDatabase } from '@/lib/imageStorage';

// Force download and save images from ComfyUI to database
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { jobId } = await params;
    console.log('🔧 Force saving images for job:', jobId);

    // Get job details
    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.clerkId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized - job belongs to different user' },
        { status: 403 }
      );
    }

    if (job.status !== 'completed') {
      return NextResponse.json(
        { error: 'Job is not completed yet' },
        { status: 400 }
      );
    }

    // Get the filename prefix from job parameters or generate it
    const params_data = job.params || {};
    const seed = params_data.seed || Math.floor(Math.random() * 1000000000);
    const timestamp = job.createdAt ? new Date(job.createdAt).getTime() : Date.now();
    
    // Generate expected filename pattern based on workflow
    const baseFilename = `ComfyUI_${timestamp}_${seed}`;
    const expectedFilenames = [
      `${baseFilename}_00001_.png`,
      `${baseFilename}_00001.png`,
      `${baseFilename}.png`,
      `ComfyUI_${seed}.png`
    ];

    console.log('🔍 Looking for images with patterns:', expectedFilenames);

    const savedImages = [];
    let successCount = 0;

    // Try each expected filename
    for (const filename of expectedFilenames) {
      try {
        console.log('📥 Attempting to download and save:', filename);

        const imageRecord = await saveImageToDatabase(
          userId,
          jobId,
          {
            filename: filename,
            subfolder: '',
            type: 'output'
          },
          {
            saveData: true,
            extractMetadata: true
          }
        );

        if (imageRecord) {
          savedImages.push(imageRecord);
          successCount++;
          console.log('✅ Successfully saved image:', filename);
          break; // Found and saved the image, no need to try other patterns
        }
      } catch (imageError) {
        console.log('⚠️ Failed to save image with filename:', filename, 'Error:', imageError);
        // Continue trying other filename patterns
      }
    }

    // If no images were found with expected patterns, try to get from ComfyUI history
    if (successCount === 0 && job.comfyUIPromptId) {
      console.log('🔍 No images found with expected patterns, checking ComfyUI history');
      
      try {
        const COMFYUI_URL = process.env.COMFYUI_URL || 'http://localhost:8188';
        
        const historyResponse = await fetch(`${COMFYUI_URL}/history/${job.comfyUIPromptId}`, {
          method: 'GET',
          headers: process.env.RUNPOD_API_KEY ? {
            'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`
          } : {},
          signal: AbortSignal.timeout(10000)
        });

        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          console.log('📜 Got ComfyUI history:', Object.keys(historyData));

          // Look for output images in history
          for (const [promptId, jobData] of Object.entries(historyData)) {
            const jobInfo = jobData as any;
            
            if (jobInfo.outputs) {
              for (const [nodeId, nodeOutput] of Object.entries(jobInfo.outputs)) {
                const output = nodeOutput as any;
                
                if (output.images && Array.isArray(output.images)) {
                  console.log(`📸 Found ${output.images.length} images in history node ${nodeId}`);
                  
                  for (const imageInfo of output.images) {
                    try {
                      const imageRecord = await saveImageToDatabase(
                        userId,
                        jobId,
                        {
                          filename: imageInfo.filename,
                          subfolder: imageInfo.subfolder || '',
                          type: imageInfo.type || 'output'
                        },
                        {
                          saveData: true,
                          extractMetadata: true
                        }
                      );

                      if (imageRecord) {
                        savedImages.push(imageRecord);
                        successCount++;
                        console.log('✅ Successfully saved image from history:', imageInfo.filename);
                      }
                    } catch (imageError) {
                      console.error('❌ Failed to save image from history:', imageInfo.filename, imageError);
                    }
                  }
                }
              }
            }
          }
        } else {
          console.warn('⚠️ Failed to get ComfyUI history:', historyResponse.status);
        }
      } catch (historyError) {
        console.error('❌ Error getting ComfyUI history:', historyError);
      }
    }

    if (successCount > 0) {
      console.log(`🎉 Successfully saved ${successCount} images for job ${jobId}`);
      return NextResponse.json({
        success: true,
        message: `Successfully saved ${successCount} images`,
        images: savedImages.map(img => ({
          id: img.id,
          filename: img.filename,
          dataUrl: img.dataUrl
        })),
        count: successCount
      });
    } else {
      console.error('❌ No images could be saved for job:', jobId);
      return NextResponse.json({
        success: false,
        message: 'No images could be downloaded and saved. Images may not be available on the ComfyUI server.',
        attemptedFilenames: expectedFilenames,
        comfyUIPromptId: job.comfyUIPromptId
      }, { status: 404 });
    }

  } catch (error) {
    console.error('❌ Force save images error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
