import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔔 Flux Kontext webhook received:', JSON.stringify(body, null, 2));

    const { jobId, status, stage, message, progress, resultImages, error, elapsedTime } = body;

    if (!jobId) {
      console.error('❌ No jobId in webhook payload');
      return NextResponse.json(
        { error: 'Missing jobId' },
        { status: 400 }
      );
    }

    // Find the job in database
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      console.error(`❌ Job ${jobId} not found in database`);
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    console.log(`📝 Updating job ${jobId}: status=${status}, stage=${stage}, progress=${progress}`);

    // Prepare update data
    const updateData: any = {
      status: status || job.status,
      progress: progress !== undefined ? progress : job.progress,
      stage: stage || job.stage,
      message: message || job.message,
      lastChecked: new Date(),
    };

    if (error) {
      updateData.error = error;
    }

    if (elapsedTime !== undefined) {
      updateData.elapsedTime = elapsedTime;
    }

    // Update job in database
    await prisma.generationJob.update({
      where: { id: jobId },
      data: updateData
    });

    // If job is completed and we have result images, save them to database
    if (status === 'COMPLETED' && resultImages && Array.isArray(resultImages) && resultImages.length > 0) {
      console.log(`✅ Saving ${resultImages.length} result images for job ${jobId}`);

      for (const imageData of resultImages) {
        try {
          // Check if image already exists
          const existing = await prisma.generatedImage.findFirst({
            where: {
              jobId: jobId,
              filename: imageData.filename,
              subfolder: imageData.subfolder || '',
              type: imageData.type || 'output'
            }
          });

          if (existing) {
            console.log(`⏭️  Image already exists: ${imageData.filename}`);
            continue;
          }

          // Save image to database
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

          console.log(`✅ Saved image to database: ${imageData.filename}`);
        } catch (imageError) {
          console.error(`❌ Error saving image ${imageData.filename}:`, imageError);
        }
      }

      // Update job with result URLs
      const resultUrls = resultImages
        .map(img => img.awsS3Url)
        .filter(url => url);

      await prisma.generationJob.update({
        where: { id: jobId },
        data: { resultUrls }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    console.error('❌ Error processing Flux Kontext webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
