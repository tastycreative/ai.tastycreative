import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { addJob, updateJob, GenerationJob as StoredGenerationJob } from '@/lib/jobsStorage';
import { trackApiUsage } from '@/lib/bandwidthMonitor';

// RunPod API configuration for Image-to-Video (dedicated endpoint)
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_ID = process.env.RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_ID;
const RUNPOD_API_URL = `https://api.runpod.ai/v2/${RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_ID}/run`;

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
    if (!RUNPOD_API_KEY || !RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_ID) {
      console.error('❌ Missing RunPod configuration:', {
        hasApiKey: !!RUNPOD_API_KEY,
        hasEndpointId: !!RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_ID
      });
      return NextResponse.json(
        { error: 'RunPod configuration missing' },
        { status: 500 }
      );
    }

    // Debug: Log the endpoint configuration being used
    console.log('🎯 IMAGE-TO-VIDEO ENDPOINT DEBUG:');
    console.log('  RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_ID:', RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_ID);
    console.log('  RUNPOD_API_URL being used:', RUNPOD_API_URL);
    console.log('  Expected endpoint: ruuan3q8eweazy');

    // Parse request body
    const body = await request.json();
    const { workflow, params, imageData, saveToVault, vaultProfileId, vaultFolderId } = body;

    // Debug: Log the entire request body structure (without sensitive data)
    console.log('🔍 REQUEST BODY DEBUG:');
    console.log('  - workflow keys:', workflow ? Object.keys(workflow).slice(0, 5) : 'missing');
    console.log('  - params keys:', params ? Object.keys(params) : 'missing');
    console.log('  - imageData available:', !!imageData);
    console.log('  - uploadedImage:', params?.uploadedImage);
    console.log('  - saveToVault:', saveToVault);
    console.log('  - vaultProfileId:', vaultProfileId);
    console.log('  - vaultFolderId:', vaultFolderId);

    if (!workflow) {
      return NextResponse.json(
        { error: 'Missing workflow' },
        { status: 400 }
      );
    }

    if (!params.uploadedImage) {
      return NextResponse.json(
        { error: 'Missing uploaded image' },
        { status: 400 }
      );
    }

    // Log base64 data availability
    console.log('📦 Image base64 data available:', !!imageData);
    if (imageData) {
      console.log('📦 Base64 data length:', imageData.length);
      console.log('📦 Base64 data preview:', imageData.substring(0, 50) + '...');
    } else {
      console.error('❌ No base64 image data provided - this will cause the handler to fail!');
      console.error('❌ Available body keys:', Object.keys(body));
    }

    console.log('🎯 Starting RunPod image-to-video generation for user:', userId);
    console.log('📋 Generation params:', params);

    // Generate unique job ID
    const jobId = `img2vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 🔓 SHARED FOLDER SUPPORT: Extract owner clerkId from workflow if it's a shared folder
    let targetClerkId = userId; // Default to current user
    
    // Check SaveVideo node (node "7") for shared folder prefix
    if (workflow["7"] && workflow["7"].inputs && workflow["7"].inputs.filename_prefix) {
      const filenamePrefix = workflow["7"].inputs.filename_prefix;
      console.log('🔍 DEBUG: Checking filename_prefix:', filenamePrefix);
      
      // Pattern: ImageToVideo_{timestamp}_{seed}_{userId}/{folderName}
      const sharedFolderMatch = filenamePrefix.match(/ImageToVideo_\d+_\d+_(user_[a-zA-Z0-9]+)\//);
      if (sharedFolderMatch) {
        const ownerClerkId = sharedFolderMatch[1];
        console.log('🔓 Detected shared folder - Owner:', ownerClerkId, 'Generator:', userId);
        targetClerkId = ownerClerkId;
      }
    }

    console.log('✅ Using clerkId for job:', targetClerkId);

    // Create job in database with vault params
    const job: StoredGenerationJob = {
      id: jobId,
      clerkId: targetClerkId,
      userId: targetClerkId,
      status: "pending",
      createdAt: new Date(),
      params: {
        ...params,
        // Vault storage params
        saveToVault: saveToVault || false,
        vaultProfileId: vaultProfileId || null,
        vaultFolderId: vaultFolderId || null,
      },
      progress: 0,
      type: 'IMAGE_TO_VIDEO'
    };

    await addJob(job);
    console.log('✅ Job created in database:', jobId);
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
    console.log('🔧 Webhook URL construction debug:');
    console.log('  NEXT_PUBLIC_BASE_URL:', process.env.NEXT_PUBLIC_BASE_URL);
    console.log('  BASE_URL:', process.env.BASE_URL);
    console.log('  VERCEL_URL:', process.env.VERCEL_URL);
    console.log('  Final baseUrl:', baseUrl);
    console.log('  Final webhookUrl:', webhookUrl);

    // Prepare RunPod payload for image-to-video generation
    const runpodPayload = {
      input: {
        action: 'generate_video', // Specify this is a video generation request
        generation_type: 'image_to_video', // Specify the generation type
        job_id: jobId,
        workflow,
        params,
        webhook_url: webhookUrl,
        user_id: userId,
        base_url: baseUrl, // Add base URL so RunPod can download images
        // Send base64 image data in the field the handler expects
        referenceImageData: imageData, // This is the field the RunPod handler looks for
        image_url: params.uploadedImage // Use URL as fallback
      }
    };

    console.log('📡 Sending image-to-video to RunPod (dedicated endpoint):', RUNPOD_API_URL);
    console.log('🔗 Webhook URL:', webhookUrl);
    
    // Debug: Log the uploaded image being sent to RunPod
    if (params.uploadedImage) {
      console.log('🖼️ Uploaded image for video generation:', params.uploadedImage);
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

    const responseData = {
      success: true,
      jobId,
      runpodJobId: runpodResult.id,
      message: 'Image-to-video generation started'
    };

    // Track bandwidth usage - significant reduction from removing imageData
    try {
      trackApiUsage('/api/generate/image-to-video-runpod', 
        { 
          workflowSize: JSON.stringify(workflow).length,
          paramsSize: JSON.stringify(params).length,
          // Note: imageData removed, saving significant bandwidth
        }, 
        responseData,
        { 
          userId,
          compressionRatio: 90 // Estimated 90% reduction from removing base64 data
        }
      );
    } catch (trackingError) {
      console.warn('⚠️ Bandwidth tracking failed:', trackingError);
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ Image-to-video generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
