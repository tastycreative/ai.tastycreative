import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/clerk-compat";
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
    const { workflow, saveToVault, vaultProfileId, vaultFolderId, targetFolder } = body;
    
    // Extract generation params from body (they're at top level, not in a nested 'params' object)
    const params = {
      prompt: body.prompt || '',
      negativePrompt: body.negativePrompt || '',
      width: body.width || 832,
      height: body.height || 1216,
      batchSize: body.batchSize || 1,
      steps: body.steps || 40,
      cfg: body.cfg || 1,
      samplerName: body.samplerName || 'euler',
      scheduler: body.scheduler || 'beta',
      guidance: body.guidance || 4,
      seed: body.seed || null,
      loras: body.loras || [],
    };

    if (!workflow) {
      return NextResponse.json(
        { error: 'Missing workflow' },
        { status: 400 }
      );
    }

    console.log('🎯 Starting RunPod text-to-image generation for user:', userId);
    console.log('📋 Generation params:', params);
    if (saveToVault) {
      console.log('📁 Saving to vault - Profile:', vaultProfileId, 'Folder:', vaultFolderId);
    } else if (targetFolder) {
      console.log('📁 Saving to S3 folder:', targetFolder);
    }

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

    // Prepare params with vault info if applicable
    const jobParams = {
      ...params,
      saveToVault: saveToVault || false,
      vaultProfileId: vaultProfileId || null,
      vaultFolderId: vaultFolderId || null,
      targetFolder: targetFolder || null,
    };
    
    console.log('🔍 DEBUG: Job params being saved to database:', JSON.stringify(jobParams, null, 2));

    // Create job in database
    const job: StoredGenerationJob = {
      id: jobId,
      clerkId: targetClerkId,
      userId: targetClerkId,
      status: "pending",
      createdAt: new Date(),
      params: jobParams,
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
        params: jobParams, // Use jobParams which includes vault info
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
        ...jobParams,  // ✅ Use jobParams (includes vault info) instead of params
        runpodJobId: runpodResult.id
      };
      
      await updateJob(jobId, {
        params: updatedParams,
        status: 'processing'
      });
      
      console.log('✅ Job params updated with RunPod ID (vault info preserved)');
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

// GET handler to fetch FLUX text-to-image generation history
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get profileId from query params to filter by profile
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');
    const limit = parseInt(searchParams.get('limit') || '50');

    console.log('📋 Fetching FLUX T2I history for user:', userId, 'profileId:', profileId);

    // Import prisma lazily to avoid issues
    const { prisma } = await import('@/lib/database');

    // Fetch recent FLUX text-to-image generations from database
    // Look for generation jobs that are TEXT_TO_IMAGE type (FLUX)
    const recentJobs = await prisma.generationJob.findMany({
      where: {
        clerkId: userId,
        type: 'TEXT_TO_IMAGE',
        status: 'COMPLETED',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit * 2, // Get more jobs to filter
      select: {
        id: true,
        params: true,
        createdAt: true,
      },
    });

    // Filter to only FLUX jobs (NOT SeeDream) and optionally by profileId
    const fluxJobIds = recentJobs
      .filter((job) => {
        const params = job.params as any;
        // Exclude SeeDream jobs - FLUX jobs don't have source='seedream'
        const isSeeDream = params?.source === 'seedream';
        if (isSeeDream) return false;
        
        // If profileId filter is provided, STRICTLY match the profileId
        // Don't include legacy/unassociated images when viewing a specific profile
        if (profileId) {
          const jobProfileId = params?.vaultProfileId;
          return jobProfileId === profileId;
        }
        // If no profileId filter, show all FLUX jobs (including those without profiles)
        return true;
      })
      .map((job) => job.id);

    console.log('📋 Found FLUX job IDs:', fluxJobIds.length);

    // Fetch images from GeneratedImage table
    let generatedImages: any[] = [];
    if (fluxJobIds.length > 0) {
      generatedImages = await prisma.generatedImage.findMany({
        where: {
          clerkId: userId,
          jobId: {
            in: fluxJobIds,
          },
          OR: [
            { awsS3Url: { not: null } },
            { awsS3Key: { not: null } },
            { data: { not: null } },
          ],
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });
      
      // Filter by profileId from metadata if provided - STRICT matching
      if (profileId) {
        generatedImages = generatedImages.filter((img) => {
          const metadata = img.metadata as any;
          const imgProfileId = metadata?.vaultProfileId;
          // STRICTLY match profile - don't include images without profiles
          return imgProfileId === profileId;
        });
      }
    }

    console.log('📋 Found FLUX generated images:', generatedImages.length);

    // Transform to match the expected format
    const images = generatedImages.map((img) => {
      // Build image URL from available fields
      let imageUrl = img.awsS3Url;
      if (!imageUrl && img.awsS3Key) {
        // Construct S3 URL from key if direct URL not available
        const bucket = process.env.AWS_S3_BUCKET || '';
        const region = process.env.AWS_REGION || 'us-east-1';
        imageUrl = `https://${bucket}.s3.${region}.amazonaws.com/${img.awsS3Key}`;
      }
      if (!imageUrl && img.data) {
        // Use base64 data as fallback
        const base64 = Buffer.isBuffer(img.data) ? img.data.toString('base64') : img.data;
        imageUrl = `data:image/png;base64,${base64}`;
      }

      return {
        id: img.id,
        imageUrl,
        prompt: (img.metadata as any)?.prompt || '',
        createdAt: img.createdAt.toISOString(),
        width: (img.metadata as any)?.width || img.width || 0,
        height: (img.metadata as any)?.height || img.height || 0,
        status: 'completed' as const,
        metadata: img.metadata,
      };
    });

    return NextResponse.json({
      success: true,
      images,
      total: images.length,
    });

  } catch (error) {
    console.error('❌ Error fetching FLUX T2I history:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
