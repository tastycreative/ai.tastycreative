// app/api/jobs/[jobId]/runpod-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getJob, updateJob } from '@/lib/jobsStorage';
import { saveImageToDatabase } from '@/lib/imageStorage';
import { prisma } from '@/lib/database';
import { updateProductionProgressDirect } from '@/lib/productionProgressHelper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    
    console.log('🔄 Manually checking RunPod status for job:', jobId);

    // Get job from database
    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get RunPod job ID from job params
    const runpodJobId = job.params?.runpodJobId;
    if (!runpodJobId) {
      return NextResponse.json({ error: 'RunPod job ID not found' }, { status: 400 });
    }

    // Check RunPod status
    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID;
    
    if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
      return NextResponse.json({ error: 'RunPod configuration missing' }, { status: 500 });
    }

    const statusUrl = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${runpodJobId}`;
    
    console.log('📡 Checking RunPod status:', statusUrl);
    
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!statusResponse.ok) {
      console.error('❌ RunPod status check failed:', statusResponse.status);
      return NextResponse.json({ error: 'Failed to check RunPod status' }, { status: 500 });
    }

    const statusData = await statusResponse.json();
    console.log('📊 RunPod status response:', statusData);

    // Update job based on RunPod status
    const updateData: any = {};
    
    if (statusData.status === 'COMPLETED') {
      updateData.status = 'completed';
      updateData.progress = 100;
      
      // If there are output images, save them
      if (statusData.output && statusData.output.images) {
        console.log('🖼️ Saving generated images to database');
        
        for (const imageData of statusData.output.images) {
          try {
            console.log('💾 Saving image to database:', imageData.filename);
            console.log('👤 User:', job.userId);
            console.log('🆔 Job:', jobId);
            
            // Convert base64 string to Buffer for Prisma Bytes field
            const imageBuffer = Buffer.from(imageData.data, 'base64');
            console.log('📏 Image buffer size:', imageBuffer.length, 'bytes');
            
            // Save image directly to database using RunPod data
            const savedImage = await prisma.generatedImage.create({
              data: {
                clerkId: job.userId,
                jobId: jobId,
                filename: imageData.filename || `generated_${Date.now()}.png`,
                subfolder: '',
                type: 'output',
                data: imageBuffer, // Save Buffer instead of raw base64 string
                metadata: { source: 'runpod', nodeId: imageData.node_id },
                fileSize: imageBuffer.length,
                format: 'png'
              }
            });
            
            console.log('✅ Image saved with ID:', savedImage.id);
          } catch (error) {
            console.error('❌ Failed to save image:', error);
          }
        }
        
        // Update production progress for manager tasks if images were generated
        if (statusData.output && statusData.output.images && statusData.output.images.length > 0) {
          try {
            console.log(`📊 Updating production progress for ${statusData.output.images.length} generated image(s)`);
            await updateProductionProgressDirect(job.userId, 'image', statusData.output.images.length);
          } catch (progressError) {
            console.error('❌ Error updating production progress:', progressError);
            // Don't fail the job status if progress update fails
          }
        }
      }
    } else if (statusData.status === 'FAILED') {
      updateData.status = 'failed';
      updateData.error = statusData.error || 'RunPod job failed';
    } else if (statusData.status === 'IN_QUEUE' || statusData.status === 'IN_PROGRESS') {
      updateData.status = 'processing';
      if (statusData.executionTime) {
        // Estimate progress based on execution time (rough estimate)
        const estimatedProgress = Math.min(95, (statusData.executionTime / 300) * 100);
        updateData.progress = Math.round(estimatedProgress);
      }
    }

    // Update job in database
    if (Object.keys(updateData).length > 0) {
      console.log('🔄 Updating job with:', updateData);
      await updateJob(jobId, updateData);
    }

    return NextResponse.json({
      success: true,
      runpodStatus: statusData.status,
      jobStatus: updateData.status || job.status,
      progress: updateData.progress || job.progress,
      updated: Object.keys(updateData).length > 0
    });

  } catch (error) {
    console.error('❌ Error checking RunPod status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
