import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const body = await request.json();
    
    console.log('🔔 Training webhook received for job:', jobId);
    console.log('📋 Webhook payload:', body);

    // Extract webhook data
    const { 
      status, 
      progress, 
      message, 
      error,
      stage,
      elapsedTime,
      estimatedTimeRemaining,
      modelUrl,
      modelPath,
      networkVolumePath
    } = body;

    console.log(`📊 Training job ${jobId} status update: ${status}, progress: ${progress}%`);

    // Try to find the training job in the database
    let trainingJob;
    try {
      trainingJob = await prisma.trainingJob.findUnique({
        where: { id: jobId }
      });
    } catch (error) {
      console.log('🔍 Training job not found in database, this might be a test job');
    }

    // If we have a training job, update it
    if (trainingJob) {
      const updateData: any = {
        updatedAt: new Date()
      };

      // Map status to our enum values
      if (status) {
        const statusMapping: { [key: string]: string } = {
          'PENDING': 'PENDING',
          'IN_PROGRESS': 'PROCESSING', 
          'PROCESSING': 'PROCESSING',
          'COMPLETED': 'COMPLETED',
          'FAILED': 'FAILED',
          'CANCELLED': 'CANCELLED'
        };
        updateData.status = statusMapping[status] || status;
      }

      if (progress !== undefined) {
        updateData.progress = Math.max(0, Math.min(100, progress));
      }

      if (message) {
        updateData.statusMessage = message;
      }

      if (error) {
        updateData.errorMessage = error;
        updateData.status = 'FAILED';
      }

      // Training completed successfully
      if (status === 'COMPLETED' && modelUrl) {
        updateData.status = 'COMPLETED';
        updateData.progress = 100;
        updateData.resultUrl = modelUrl;
        updateData.completedAt = new Date();

        // If we have network volume path, save it
        if (networkVolumePath) {
          updateData.networkVolumePath = networkVolumePath;
        }

        console.log('✅ Training completed successfully for job:', jobId);
        console.log('📁 Model URL:', modelUrl);
        console.log('🗄️ Network volume path:', networkVolumePath);
      }

      try {
        await prisma.trainingJob.update({
          where: { id: jobId },
          data: updateData
        });
        console.log(`✅ Updated training job ${jobId} in database`);
      } catch (dbError) {
        console.error('❌ Failed to update training job in database:', dbError);
      }
    }

    // Always respond successfully to prevent retries
    return NextResponse.json({ 
      success: true, 
      message: 'Training webhook processed successfully',
      jobId,
      status: status || 'unknown'
    });

  } catch (error) {
    console.error('❌ Training webhook error:', error);
    
    // Still respond with success to prevent webhook retries
    return NextResponse.json({ 
      success: true, 
      message: 'Training webhook processed with errors',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json({ message: 'Training webhook endpoint - POST only' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ message: 'Training webhook endpoint - POST only' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ message: 'Training webhook endpoint - POST only' }, { status: 405 });
}