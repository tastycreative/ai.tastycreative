import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';
import { updateProductionProgressDirect } from '@/lib/productionProgressHelper';
import { prisma } from '@/lib/database';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('🔔 Generation status webhook received:', body);
    
    const { jobId, status, progress, message, error, resultImages } = body;
    
    if (!jobId) {
      console.error('❌ No jobId provided in webhook');
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // First, get the job to verify it exists
    const existingJob = await prisma.generationJob.findUnique({
      where: { id: jobId }
    });

    if (!existingJob) {
      console.error('❌ Job not found:', jobId);
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    console.log(`🔍 Existing job status: ${existingJob.status}, Webhook status: ${status}`);

    // Check if job was already cancelled - ignore completion webhooks for cancelled jobs
    if (existingJob.status === 'FAILED' && existingJob.error === 'Job canceled by user') {
      if (status === 'completed') {
        console.log('🛑 Ignoring completion webhook for cancelled job:', jobId);
        return NextResponse.json({ 
          success: true, 
          message: 'Ignored completion for cancelled job',
          jobId: jobId,
          status: 'cancelled'
        });
      }
    }

    // Also ignore any status updates if the job was manually cancelled
    if (existingJob.status === 'FAILED' && existingJob.error === 'Job canceled by user' && status !== 'failed') {
      console.log(`🛑 Ignoring status update (${status}) for cancelled job:`, jobId);
      return NextResponse.json({ 
        success: true, 
        message: 'Ignored status update for cancelled job',
        jobId: jobId,
        status: 'cancelled'
      });
    }

    // Update the job status in the database
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (status) {
      updateData.status = status.toUpperCase();
    }

    if (typeof progress === 'number') {
      updateData.progress = progress;
    }

    if (error) {
      updateData.error = error;
    }

    const updatedJob = await prisma.generationJob.update({
      where: { id: jobId },
      data: updateData,
    });

    console.log('✅ Updated job status:', updatedJob.id, 'Status:', updatedJob.status, 'Progress:', updatedJob.progress);

    // If job is completed and has result images, save them to the database
    if (status === 'completed' && resultImages && Array.isArray(resultImages)) {
      console.log('💾 Saving result images to database:', resultImages.length);
      
      for (const imageInfo of resultImages) {
        try {
          // Convert base64 data to buffer
          const imageBuffer = Buffer.from(imageInfo.data, 'base64');
          
          // Save image to database
          await prisma.generatedImage.create({
            data: {
              clerkId: existingJob.clerkId, // Use the clerkId from the existing job
              jobId: jobId,
              filename: imageInfo.filename,
              subfolder: imageInfo.subfolder || '',
              type: imageInfo.type || 'output',
              data: imageBuffer,
              fileSize: imageBuffer.length,
              format: imageInfo.filename.split('.').pop()?.toLowerCase() || 'jpg',
              metadata: {
                source: 'face_swap_serverless',
                timestamp: new Date().toISOString(),
              },
            },
          });
          
          console.log('✅ Saved image to database:', imageInfo.filename);
        } catch (imageError) {
          console.error('❌ Error saving image to database:', imageError);
        }
      }
      
      // Update production progress for manager tasks
      if (resultImages.length > 0) {
        try {
          console.log(`📊 Updating production progress for ${resultImages.length} generated image(s)`);
          await updateProductionProgressDirect(existingJob.clerkId, 'image', resultImages.length);
        } catch (progressError) {
          console.error('❌ Error updating production progress:', progressError);
          // Don't fail the webhook if progress update fails
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed successfully',
      jobId: jobId,
      status: updatedJob.status
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json({ 
      error: 'Failed to process webhook',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
