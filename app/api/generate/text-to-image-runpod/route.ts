import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { addJob, updateJob, GenerationJob as StoredGenerationJob } from '@/lib/jobsStorage';
import { verifyLoRAAccess } from '@/lib/loraAccessControl';

// RunPod API configuration
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID;
const RUNPOD_API_URL = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`;

interface GenerationJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  resultUrls?: string[];
  error?: string;
  createdAt: Date;
  userId: string;
  params?: any;
  runpodJobId?: string;
  comfyUIPromptId?: string;
}

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

    // Validate environment variables
    if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
      console.error('❌ Missing RunPod configuration:', {
        hasApiKey: !!RUNPOD_API_KEY,
        hasEndpointId: !!RUNPOD_ENDPOINT_ID
      });
      return NextResponse.json(
        { error: 'RunPod configuration missing' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { workflow, params } = body;

    if (!workflow) {
      return NextResponse.json(
        { error: 'Missing workflow' },
        { status: 400 }
      );
    }

    console.log('🎯 Starting RunPod text-to-image generation for user:', userId);
    console.log('📋 Generation params:', params);

    // 🔒 LORA ACCESS CONTROL: Verify user has permission to use the selected LoRA
    if (workflow["14"] && workflow["14"].inputs && workflow["14"].inputs.lora_name) {
      const loraName = workflow["14"].inputs.lora_name;
      console.log('🔍 Verifying LoRA access for:', loraName);
      
      try {
        await verifyLoRAAccess(loraName, userId);
        console.log('✅ LoRA access verified for user');
      } catch (error) {
        console.error('❌ LoRA access denied:', error);
        return NextResponse.json(
          { 
            error: error instanceof Error ? error.message : 'You do not have permission to use this LoRA model',
            code: 'LORA_ACCESS_DENIED'
          },
          { status: 403 }
        );
      }
    }

    // Generate unique job ID
    const jobId = `txt2img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 🔓 SHARED FOLDER SUPPORT: Extract owner clerkId from workflow if it's a shared folder
    let targetClerkId = userId; // Default to current user
    
    // Check SaveImage node (node "13") for shared folder prefix
    if (workflow["13"] && workflow["13"].inputs && workflow["13"].inputs.filename_prefix) {
      const filenamePrefix = workflow["13"].inputs.filename_prefix;
      console.log('🔍 DEBUG: Checking filename_prefix:', filenamePrefix);
      
      // Pattern: TextToImage_{timestamp}_{seed}_{userId}/{folderName}
      const sharedFolderMatch = filenamePrefix.match(/TextToImage_\d+_\d+_(user_[a-zA-Z0-9]+)\//);
      if (sharedFolderMatch) {
        const ownerClerkId = sharedFolderMatch[1];
        console.log('🔓 Detected shared folder - Owner:', ownerClerkId, 'Generator:', userId);
        targetClerkId = ownerClerkId;
      }
    }

    console.log('✅ Using clerkId for job:', targetClerkId);

    // Create job in database
    const job: StoredGenerationJob = {
      id: jobId,
      clerkId: targetClerkId,
      userId: targetClerkId,
      status: "pending",
      createdAt: new Date(),
      params,
      progress: 0,
      type: 'TEXT_TO_IMAGE'
    };

    await addJob(job);
    console.log('✅ Job created in database:', jobId);

    // Generate webhook URL for progress updates - use runpod webhook for S3 support
    // Use production domain first, fallback to other options for development
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    process.env.NEXT_PUBLIC_BASE_URL || 
                    process.env.BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    
    const webhookUrl = baseUrl ? `${baseUrl}/api/webhooks/runpod` : null;
    
    // Debug webhook URL construction
    console.log('🔧 Webhook URL construction debug:');
    console.log('  NEXT_PUBLIC_BASE_URL:', process.env.NEXT_PUBLIC_BASE_URL);
    console.log('  BASE_URL:', process.env.BASE_URL);
    console.log('  VERCEL_URL:', process.env.VERCEL_URL);
    console.log('  Final baseUrl:', baseUrl);
    console.log('  Final webhookUrl:', webhookUrl);

    // Prepare RunPod payload
    const runpodPayload = {
      input: {
        job_id: jobId,
        workflow,
        params,
        webhook_url: webhookUrl,
        user_id: userId
      }
    };

    console.log('📡 Sending to RunPod:', RUNPOD_API_URL);
    console.log('🔗 Webhook URL:', webhookUrl);
    
    // Debug: Log the LoRA information being sent to RunPod
    if (workflow["14"] && workflow["14"].inputs && workflow["14"].inputs.lora_name) {
      console.log('🎯 LoRA being sent to RunPod:', workflow["14"].inputs.lora_name);
      console.log('🎯 LoRA strength:', workflow["14"].inputs.strength_model);
      console.log('🎯 Full LoRA node:', JSON.stringify(workflow["14"], null, 2));
    } else {
      console.log('⚠️ No LoRA node found in workflow');
    }

    // Submit job to RunPod
    const runpodResponse = await fetch(RUNPOD_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(runpodPayload)
    });

    if (!runpodResponse.ok) {
      const errorText = await runpodResponse.text();
      console.error('❌ RunPod submission failed:', runpodResponse.status, errorText);
      
      // Update job status to failed
      await updateJob(jobId, {
        status: 'failed',
        error: `RunPod submission failed: ${runpodResponse.status}`
      });

      return NextResponse.json(
        { error: `RunPod submission failed: ${runpodResponse.status}` },
        { status: 500 }
      );
    }

    const runpodResult = await runpodResponse.json();
    console.log('✅ RunPod job submitted:', runpodResult);

    // Update job with RunPod job ID
    if (runpodResult.id) {
      const updatedParams = {
        ...params,
        runpodJobId: runpodResult.id
      };
      
      await updateJob(jobId, {
        params: updatedParams,
        status: 'processing'
      });
    }

    // Return job ID to frontend for polling
    return NextResponse.json({
      success: true,
      jobId,
      runpodJobId: runpodResult.id,
      message: 'Text-to-image generation started'
    });

  } catch (error) {
    console.error('❌ Text-to-image generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
