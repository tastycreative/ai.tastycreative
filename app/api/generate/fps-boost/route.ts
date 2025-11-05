// app/api/generate/fps-boost/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { workflow, params, videoData } = body;

    if (!workflow || !videoData) {
      return NextResponse.json(
        { error: "Missing workflow or video data" },
        { status: 400 }
      );
    }

    console.log("=== FPS BOOST GENERATION REQUEST ===");
    console.log("User ID:", userId);
    console.log("FPS Multiplier:", params?.fpsMultiplier);
    console.log("Target FPS:", params?.targetFPS);

    // 🔓 SHARED FOLDER SUPPORT: Extract owner clerkId from workflow if it's a shared folder
    let targetClerkId = userId; // Default to current user
    
    // Check SaveVideo node (node "6") for shared folder prefix
    if (workflow["6"] && workflow["6"].inputs && workflow["6"].inputs.filename_prefix) {
      const filenamePrefix = workflow["6"].inputs.filename_prefix;
      console.log('🔍 DEBUG: Checking filename_prefix:', filenamePrefix);
      
      // Pattern: FPSBoost_{timestamp}_{seed}_{userId}/{folderName}
      const sharedFolderMatch = filenamePrefix.match(/FPSBoost_\d+_\d+_(user_[a-zA-Z0-9]+)\//);
      if (sharedFolderMatch) {
        const ownerClerkId = sharedFolderMatch[1];
        console.log('🔓 Detected shared folder - Owner:', ownerClerkId, 'Generator:', userId);
        targetClerkId = ownerClerkId;
      }
    }

    console.log('✅ Using clerkId for job:', targetClerkId);

    // Create job in database
    const job = await prisma.generationJob.create({
      data: {
        clerkId: targetClerkId,
        type: "VIDEO_FPS_BOOST",
        status: "PENDING",
        progress: 0,
        params: params || {},
        comfyUIPromptId: null,
      },
    });

    console.log("✅ Job created:", job.id);

    // Construct webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL;
    const webhookUrl = `${baseUrl}/api/webhook/fps-boost`;

    console.log("📞 Webhook URL:", webhookUrl);

    // Get RunPod endpoint URL
    const runpodEndpointUrl =
      process.env.RUNPOD_FPS_BOOST_ENDPOINT_URL ||
      `https://api.runpod.ai/v2/${process.env.RUNPOD_FPS_BOOST_ENDPOINT_ID}`;
    const runpodApiKey = process.env.RUNPOD_API_KEY;

    if (!runpodApiKey) {
      console.error("❌ RUNPOD_API_KEY not configured");
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: "RunPod API key not configured",
        },
      });
      return NextResponse.json(
        { error: "RunPod not configured" },
        { status: 500 }
      );
    }

    console.log("🚀 Sending request to RunPod:", runpodEndpointUrl);

    // Send to RunPod
    const runpodResponse = await fetch(`${runpodEndpointUrl}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runpodApiKey}`,
      },
      body: JSON.stringify({
        input: {
          workflow,
          params,
          videoData,
          user_id: userId,
          job_id: job.id,
          webhook_url: webhookUrl,
        },
      }),
    });

    if (!runpodResponse.ok) {
      const errorText = await runpodResponse.text();
      console.error("❌ RunPod error:", runpodResponse.status, errorText);

      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: `RunPod error: ${runpodResponse.status}`,
        },
      });

      return NextResponse.json(
        { error: "Failed to start generation" },
        { status: 500 }
      );
    }

    const runpodResult = await runpodResponse.json();
    console.log("✅ RunPod response:", runpodResult);

    // Update job with RunPod ID
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: "PROCESSING",
        comfyUIPromptId: runpodResult.id,
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      runpodId: runpodResult.id,
    });
  } catch (error) {
    console.error("❌ FPS boost generation error:", error);
    
    // Log detailed error information
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
