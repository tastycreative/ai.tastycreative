import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_FLUX_KONTEXT_ENDPOINT_ID = process.env.RUNPOD_FLUX_KONTEXT_ENDPOINT_ID;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';

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

    console.log('🎨 Creating Flux Kontext job for user:', userId);

    const body = await request.json();
    const { workflow, prompt, params, saveToVault, vaultProfileId, vaultFolderId } = body;

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow is required' },
        { status: 400 }
      );
    }

    // Prepare job params - include vault info if saving to vault
    const jobParams: any = {
      workflow,
      prompt,
      ...params
    };
    
    if (saveToVault && vaultProfileId && vaultFolderId) {
      jobParams.saveToVault = true;
      jobParams.vaultProfileId = vaultProfileId;
      jobParams.vaultFolderId = vaultFolderId;
      console.log(`💾 Job will save to vault - Profile: ${vaultProfileId}, Folder: ${vaultFolderId}`);
    }

    // Create job in database
    const job = await prisma.generationJob.create({
      data: {
        clerkId: userId,
        status: 'PENDING',
        type: 'FLUX_KONTEXT',
        progress: 0,
        params: jobParams
      }
    });

    console.log('✅ Created job in database:', job.id);

    // Prepare webhook URL for RunPod to call
    const webhookUrl = `${BASE_URL}/api/webhook/flux-kontext`;

    // Prepare RunPod payload
    const runpodPayload = {
      input: {
        action: 'transform_flux_kontext',
        workflow,
        userId: userId,
        jobId: job.id,
        webhook_url: webhookUrl
      }
    };

    console.log('📤 Sending job to RunPod endpoint:', RUNPOD_FLUX_KONTEXT_ENDPOINT_ID);

    // Send to RunPod
    const runpodResponse = await fetch(
      `https://api.runpod.ai/v2/${RUNPOD_FLUX_KONTEXT_ENDPOINT_ID}/run`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RUNPOD_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(runpodPayload),
      }
    );

    if (!runpodResponse.ok) {
      const errorText = await runpodResponse.text();
      console.error('❌ RunPod API error:', errorText);
      
      // Update job status to failed
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          error: `RunPod API error: ${errorText}`
        }
      });

      return NextResponse.json(
        { error: 'Failed to submit job to RunPod', details: errorText },
        { status: 500 }
      );
    }

    const runpodData = await runpodResponse.json();
    console.log('✅ RunPod response:', runpodData);

    // Update job with RunPod job ID
    const updatedJob = await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        params: {
          ...(job.params as any || {}),
          runpodJobId: runpodData.id
        },
        status: 'PROCESSING'
      }
    });

    return NextResponse.json({
      id: updatedJob.id,
      status: updatedJob.status,
      runpodJobId: runpodData.id,
      createdAt: updatedJob.createdAt
    });

  } catch (error) {
    console.error('❌ Error creating Flux Kontext job:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
