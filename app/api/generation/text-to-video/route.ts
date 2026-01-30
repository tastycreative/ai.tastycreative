import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET endpoint for fetching generation history
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const isHistoryRequest = searchParams.get('history') === 'true';

    if (isHistoryRequest) {
      try {
        const profileId = searchParams.get('profileId');
        const isAllProfiles = profileId === 'all' || !profileId;

        console.log('[Wan T2V] Fetching video history for user:', userId, 'profileId:', profileId, 'isAllProfiles:', isAllProfiles);

        // If viewing all profiles, get profile map for name lookups
        let profileMap: Record<string, string> = {};
        if (isAllProfiles) {
          const profiles = await prisma.instagramProfile.findMany({
            where: { clerkId: userId },
            select: { id: true, name: true, instagramUsername: true },
          });
          profileMap = profiles.reduce((acc, p) => {
            acc[p.id] = p.instagramUsername ? `@${p.instagramUsername}` : p.name;
            return acc;
          }, {} as Record<string, string>);
        }

        // Get recent completed TEXT_TO_VIDEO jobs (filtering for wan-t2v source)
        const recentJobs = await prisma.generationJob.findMany({
          where: {
            clerkId: userId,
            type: 'TEXT_TO_VIDEO',
            status: 'COMPLETED',
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 50,
          select: {
            id: true,
            params: true,
          },
        });

        // Filter to only Wan T2V jobs (source === 'wan-t2v' or no source which means it's from this handler)
        const wanJobIds = recentJobs
          .filter((job) => {
            const params = job.params as any;
            // Include if source is wan-t2v OR if source is not set (legacy jobs from this handler)
            return params?.source === 'wan-t2v' || !params?.source;
          })
          .map((job) => job.id);

        console.log('[Wan T2V] Found Wan job IDs:', wanJobIds.length);

        // Fetch videos for these jobs
        let videos: any[] = [];
        if (wanJobIds.length > 0) {
          videos = await prisma.generatedVideo.findMany({
            where: {
              clerkId: userId,
              jobId: {
                in: wanJobIds,
              },
              awsS3Url: {
                not: null,
              },
            },
            include: {
              job: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 20,
          });
        }

        console.log('[Wan T2V] Found generated videos:', videos.length);

        // Filter by profileId if provided
        let filteredVideos = videos;
        if (profileId && !isAllProfiles) {
          filteredVideos = videos.filter((video) => {
            const params = video.job.params as any;
            // Include if profileId matches OR if no profileId was set (backward compatibility)
            return params?.vaultProfileId === profileId || !params?.vaultProfileId;
          });
        }

        console.log('[Wan T2V] Filtered videos by profile:', filteredVideos.length);

        // Map generated videos for response
        const mappedVideos = filteredVideos.map((video) => {
          const params = video.job.params as any;
          const videoProfileId = params?.vaultProfileId || null;
          return {
            id: video.id,
            videoUrl: video.awsS3Url || video.s3Key || '',
            prompt: params?.prompt || 'Unknown prompt',
            negativePrompt: params?.negativePrompt || '',
            width: params?.width || 832,
            height: params?.height || 480,
            videoLength: params?.videoLength || 81,
            highNoiseSteps: params?.highNoiseSteps || 20,
            highNoiseCfg: params?.highNoiseCfg || 5.5,
            highNoiseSeed: params?.highNoiseSeed || 0,
            lowNoiseSteps: params?.lowNoiseSteps || 20,
            lowNoiseCfg: params?.lowNoiseCfg || 5.5,
            presetMode: params?.presetMode || 'none',
            customHighNoiseLoraList: params?.customHighNoiseLoraList || [],
            customLowNoiseLoraList: params?.customLowNoiseLoraList || [],
            createdAt: video.createdAt.toISOString(),
            status: 'completed' as const,
            source: 'wan-t2v' as const,
            profileName: isAllProfiles && videoProfileId ? profileMap[videoProfileId] || null : null,
          };
        });

        return NextResponse.json({
          success: true,
          videos: mappedVideos,
        });
      } catch (historyError) {
        console.error('[Wan T2V] Error fetching history:', historyError);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch history', videos: [] },
          { status: 500 }
        );
      }
    }

    // No valid query parameter
    return NextResponse.json(
      { error: 'Invalid request. Use ?history=true to fetch history.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Wan T2V] Error in GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { workflow, params } = body;

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow is required' },
        { status: 400 }
      );
    }

    // Create a generation job in the database
    const job = await prisma.generationJob.create({
      data: {
        clerkId: userId,
        type: 'TEXT_TO_VIDEO',
        status: 'PENDING',
        progress: 0,
        params: params || {},
      },
    });

    // Prepare webhook URL for RunPod to send updates (must match image-to-video pattern)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    process.env.NEXT_PUBLIC_BASE_URL || 
                    process.env.BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    
    const webhookUrl = baseUrl ? `${baseUrl}/api/webhooks/generation/${job.id}` : null;
    
    console.log('🔧 Webhook URL for text-to-video:', webhookUrl);

    // Call RunPod serverless endpoint
    const runpodResponse = await fetch(
      `${process.env.RUNPOD_TEXT_TO_VIDEO_ENDPOINT_URL}/run`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`,
        },
        body: JSON.stringify({
          input: {
            action: 'generate_text_to_video',
            workflow,
            userId,
            webhook_url: webhookUrl,
            jobId: job.id,  // Changed from job_id to jobId for consistency
          },
        }),
      }
    );

    if (!runpodResponse.ok) {
      const errorText = await runpodResponse.text();
      console.error('RunPod API error:', errorText);
      
      // Update job status to failed
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          error: `RunPod API error: ${errorText}`,
        },
      });

      return NextResponse.json(
        { success: false, error: 'Failed to start generation on RunPod' },
        { status: 500 }
      );
    }

    const runpodData = await runpodResponse.json();
    console.log('RunPod response:', runpodData);

    // Update job with RunPod job ID
    if (runpodData.id) {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          comfyUIPromptId: runpodData.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      runpodJobId: runpodData.id,
    });
  } catch (error) {
    console.error('Error in text-to-video generation:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
