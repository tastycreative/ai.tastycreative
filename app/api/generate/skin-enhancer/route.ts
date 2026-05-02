import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/clerk-compat";
import { addJob, updateJob, GenerationJob as StoredGenerationJob } from '@/lib/jobsStorage';

// RunPod API configuration for skin enhancement
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_SKIN_ENHANCER_ENDPOINT_ID = process.env.RUNPOD_SKIN_ENHANCER_ENDPOINT_ID;
const RUNPOD_API_URL = `https://api.runpod.ai/v2/${RUNPOD_SKIN_ENHANCER_ENDPOINT_ID}/run`;

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
    if (!RUNPOD_API_KEY || !RUNPOD_SKIN_ENHANCER_ENDPOINT_ID) {
      console.error('❌ Missing RunPod skin enhancer configuration:', {
        hasApiKey: !!RUNPOD_API_KEY,
        hasEndpointId: !!RUNPOD_SKIN_ENHANCER_ENDPOINT_ID
      });
      return NextResponse.json(
        { error: 'RunPod skin enhancer configuration missing' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { workflow, params, saveToVault, vaultProfileId, vaultFolderId } = body;

    if (!workflow) {
      return NextResponse.json(
        { error: 'Missing workflow' },
        { status: 400 }
      );
    }

    console.log('🎨 Starting RunPod skin enhancement generation for user:', userId);
    console.log('📋 Enhancement params:', params);
    console.log('🔒 Vault params received from frontend:', { saveToVault, vaultProfileId, vaultFolderId });
    console.log('🔒 saveToVault type:', typeof saveToVault, 'value:', saveToVault);
    console.log('🔒 vaultProfileId type:', typeof vaultProfileId, 'value:', vaultProfileId);
    console.log('🔒 vaultFolderId type:', typeof vaultFolderId, 'value:', vaultFolderId);

    // Generate unique job ID
    const jobId = `skin_enhancer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 🔓 SHARED FOLDER SUPPORT: Extract owner clerkId from workflow if it's a shared folder
    let targetClerkId = userId; // Default to current user
    
    // Check SaveImage node (node "8") for shared folder prefix
    if (workflow["8"] && workflow["8"].inputs && workflow["8"].inputs.filename_prefix) {
      const filenamePrefix = workflow["8"].inputs.filename_prefix;
      console.log('🔍 DEBUG: Checking filename_prefix:', filenamePrefix);
      
      // Pattern: SkinEnhancer_{timestamp}_{seed}_{userId}/{folderName}
      const sharedFolderMatch = filenamePrefix.match(/SkinEnhancer_\d+_\d+_(user_[a-zA-Z0-9]+)\//);
      if (sharedFolderMatch) {
        const ownerClerkId = sharedFolderMatch[1];
        console.log('🔓 Detected shared folder - Owner:', ownerClerkId, 'Generator:', userId);
        targetClerkId = ownerClerkId;
      }
    }

    console.log('✅ Using clerkId for job:', targetClerkId);

    // Create job in database with vault params
    // IMPORTANT: Handle saveToVault as boolean, string "true", or truthy value
    const isSaveToVaultEnabled = saveToVault === true || saveToVault === 'true' || saveToVault === 1;
    const shouldSaveToVault = isSaveToVaultEnabled && !!vaultProfileId && !!vaultFolderId;
    
    console.log('🔍 saveToVault raw value:', saveToVault, 'type:', typeof saveToVault);
    console.log('🔍 isSaveToVaultEnabled:', isSaveToVaultEnabled);
    console.log('🔍 vaultProfileId:', vaultProfileId, 'vaultFolderId:', vaultFolderId);
    console.log('🔍 shouldSaveToVault:', shouldSaveToVault);
    
    const jobParamsToStore = {
      ...params,
      // Vault storage params - explicitly use boolean true for webhook handler
      saveToVault: shouldSaveToVault ? true : false,
      vaultProfileId: shouldSaveToVault ? vaultProfileId : null,
      vaultFolderId: shouldSaveToVault ? vaultFolderId : null,
    };
    
    console.log('📦 Params being stored in job:', JSON.stringify(jobParamsToStore, null, 2));
    console.log('🔒 shouldSaveToVault calculated:', shouldSaveToVault);
    
    const job: StoredGenerationJob = {
      id: jobId,
      clerkId: targetClerkId,
      userId: targetClerkId,
      status: "pending",
      createdAt: new Date(),
      params: jobParamsToStore,
      progress: 0,
      type: 'SKIN_ENHANCEMENT'
    };

    await addJob(job);
    console.log('✅ Skin enhancement job created in database:', jobId);
    if (saveToVault) {
      console.log('🔒 Vault storage enabled - profileId:', vaultProfileId, 'folderId:', vaultFolderId);
    }

    // Generate webhook URL for progress updates
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    process.env.NEXT_PUBLIC_BASE_URL || 
                    process.env.BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    
    const webhookUrl = baseUrl ? `${baseUrl}/api/webhooks/generation/${jobId}` : null;
    
    // Debug webhook URL construction
    console.log('🔧 Skin enhancement webhook URL construction debug:');
    console.log('  NEXT_PUBLIC_BASE_URL:', process.env.NEXT_PUBLIC_BASE_URL);
    console.log('  BASE_URL:', process.env.BASE_URL);
    console.log('  VERCEL_URL:', process.env.VERCEL_URL);
    console.log('  Final baseUrl:', baseUrl);
    console.log('  Final webhookUrl:', webhookUrl);

    // Prepare RunPod payload
    const runpodPayload = {
      input: {
        action: 'enhance_skin',
        job_id: jobId,
        workflow,
        params,
        webhook_url: webhookUrl,
        user_id: userId
      }
    };

    console.log('📡 Sending to RunPod skin enhancer:', RUNPOD_API_URL);
    console.log('🔗 Webhook URL:', webhookUrl);
    
    // Debug: Log the enhancement LoRA information being sent to RunPod
    console.log('🎭 Enhancement LoRAs in workflow:');
    
    // Check for fixed enhancement LoRAs
    if (workflow["115"] && workflow["115"].inputs && workflow["115"].inputs.lora_name) {
      console.log('🎯 Fixed LoRA 1:', workflow["115"].inputs.lora_name, 'strength:', workflow["115"].inputs.strength_model);
    }
    
    if (workflow["115_2"] && workflow["115_2"].inputs && workflow["115_2"].inputs.lora_name) {
      console.log('🎯 Fixed LoRA 2:', workflow["115_2"].inputs.lora_name, 'strength:', workflow["115_2"].inputs.strength_model);
    }
    
    // Check for influencer LoRA
    if (workflow["108"] && workflow["108"].inputs && workflow["108"].inputs.lora_name) {
      console.log('🎯 Influencer LoRA:', workflow["108"].inputs.lora_name, 'strength:', workflow["108"].inputs.strength_model);
    }
    
    // Check for main prompts
    if (workflow["106"] && workflow["106"].inputs && workflow["106"].inputs.text) {
      console.log('📝 Main prompt:', workflow["106"].inputs.text);
    }
    
    if (workflow["113"] && workflow["113"].inputs && workflow["113"].inputs.text) {
      console.log('📝 Enhancement prompt:', workflow["113"].inputs.text);
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
      console.error('❌ RunPod skin enhancer submission failed:', runpodResponse.status, errorText);
      
      // Update job status to failed
      await updateJob(jobId, {
        status: 'failed',
        error: `RunPod skin enhancer submission failed: ${runpodResponse.status}`
      });

      return NextResponse.json(
        { error: `RunPod skin enhancer submission failed: ${runpodResponse.status}` },
        { status: 500 }
      );
    }

    const runpodResult = await runpodResponse.json();
    console.log('✅ RunPod skin enhancement job submitted:', runpodResult);

    // Update job with RunPod job ID - store in both params and comfyUIPromptId for cancellation
    if (runpodResult.id) {
      const updatedParams = {
        ...params,
        runpodJobId: runpodResult.id
      };
      
      await updateJob(jobId, {
        params: updatedParams,
        comfyUIPromptId: runpodResult.id, // Store RunPod job ID for cancellation
        status: 'processing'
      });
      
      console.log('💾 Stored RunPod job ID for cancellation:', runpodResult.id);
    }

    // Return job ID to frontend for polling
    return NextResponse.json({
      success: true,
      jobId,
      runpodJobId: runpodResult.id,
      message: 'Skin enhancement generation started'
    });

  } catch (error) {
    console.error('❌ Skin enhancement generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
