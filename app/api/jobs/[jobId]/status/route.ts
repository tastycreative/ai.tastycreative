import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    // Get job status from database
    const job = await prisma.generationJob.findFirst({
      where: {
        id: jobId,
        clerkId: userId,
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // If job is still processing, try to poll RunPod for updated status
    if (job.status === 'PROCESSING' || job.status === 'PENDING') {
      const runpodJobId = (job.params as any)?.runpodJobId;
      if (runpodJobId) {
        try {
          // Get the appropriate endpoint ID based on job type
          let RUNPOD_ENDPOINT_ID: string | undefined;
          if (job.type === 'FLUX_KONTEXT') {
            RUNPOD_ENDPOINT_ID = process.env.RUNPOD_FLUX_KONTEXT_ENDPOINT_ID;
          } else if (job.type === 'IMAGE_TO_VIDEO') {
            RUNPOD_ENDPOINT_ID = process.env.RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_ID;
          } else {
            RUNPOD_ENDPOINT_ID = process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID;
          }

          const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;

          if (RUNPOD_API_KEY && RUNPOD_ENDPOINT_ID) {
            console.log(`🔍 Polling RunPod for job ${runpodJobId} (type: ${job.type})`);
            const runpodResponse = await fetch(
              `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${runpodJobId}`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${RUNPOD_API_KEY}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (runpodResponse.ok) {
              const runpodData = await runpodResponse.json();
              console.log(`📊 RunPod status: ${runpodData.status}`);

              // Update job based on RunPod status
              if (runpodData.status === 'COMPLETED' && runpodData.output) {
                const output = runpodData.output;
                
                // Save images to database if they exist
                if (output.images && Array.isArray(output.images) && output.images.length > 0) {
                  console.log(`✅ Saving ${output.images.length} result images for job ${jobId}`);

                  for (const imageData of output.images) {
                    try {
                      // Check if image already exists
                      const existing = await prisma.generatedImage.findFirst({
                        where: {
                          jobId: jobId,
                          filename: imageData.filename,
                        }
                      });

                      if (existing) {
                        console.log(`⏭️  Image already exists: ${imageData.filename}`);
                        continue;
                      }

                      // Save image to database (handle both S3 URLs and base64 data)
                      if (imageData.awsS3Url) {
                        await prisma.generatedImage.create({
                          data: {
                            clerkId: job.clerkId,
                            jobId: jobId,
                            filename: imageData.filename,
                            subfolder: imageData.subfolder || '',
                            type: imageData.type || 'output',
                            fileSize: imageData.fileSize,
                            awsS3Key: imageData.awsS3Key,
                            awsS3Url: imageData.awsS3Url,
                            format: 'png',
                          }
                        });
                      } else if (imageData.data) {
                        const imageBuffer = Buffer.from(imageData.data, 'base64');
                        await prisma.generatedImage.create({
                          data: {
                            clerkId: job.clerkId,
                            jobId: jobId,
                            filename: imageData.filename || `generated_${Date.now()}.png`,
                            subfolder: '',
                            type: 'output',
                            data: imageBuffer,
                            fileSize: imageBuffer.length,
                            format: 'png',
                          }
                        });
                      }

                      console.log(`✅ Saved image to database: ${imageData.filename}`);
                    } catch (imageError) {
                      console.error(`❌ Error saving image ${imageData.filename}:`, imageError);
                    }
                  }

                  // Update job with result URLs
                  const resultUrls = output.images
                    .map((img: any) => img.awsS3Url || null)
                    .filter((url: string | null) => url);

                  await prisma.generationJob.update({
                    where: { id: jobId },
                    data: {
                      status: 'COMPLETED',
                      progress: 100,
                      resultUrls,
                      elapsedTime: output.elapsedTime || null,
                    }
                  });

                  // Re-fetch the updated job
                  const updatedJob = await prisma.generationJob.findUnique({
                    where: { id: jobId },
                  });

                  if (updatedJob) {
                    return NextResponse.json({
                      id: updatedJob.id,
                      status: 'completed',
                      progress: 100,
                      resultUrls: updatedJob.resultUrls || [],
                      error: updatedJob.error,
                      createdAt: updatedJob.createdAt,
                      updatedAt: updatedJob.updatedAt,
                    });
                  }
                }
              } else if (runpodData.status === 'FAILED') {
                await prisma.generationJob.update({
                  where: { id: jobId },
                  data: {
                    status: 'FAILED',
                    error: runpodData.error || 'Job failed on RunPod',
                  }
                });

                return NextResponse.json({
                  id: job.id,
                  status: 'failed',
                  progress: job.progress || 0,
                  resultUrls: [],
                  error: runpodData.error || 'Job failed on RunPod',
                  createdAt: job.createdAt,
                  updatedAt: new Date(),
                });
              }
            }
          }
        } catch (runpodError) {
          console.error('❌ Error polling RunPod:', runpodError);
          // Continue with database status if RunPod polling fails
        }
      }
    }

    // Map database status to frontend expected format
    let frontendStatus = job.status.toLowerCase();
    if (frontendStatus === 'processing') {
      frontendStatus = 'running';
    } else if (frontendStatus === 'completed') {
      frontendStatus = 'completed';
    } else if (frontendStatus === 'failed') {
      frontendStatus = 'failed';
    } else {
      frontendStatus = 'pending';
    }

    return NextResponse.json({
      id: job.id,
      status: frontendStatus,
      progress: job.progress || 0,
      resultUrls: job.resultUrls || [],
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });

  } catch (error) {
    console.error('Get job status error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
