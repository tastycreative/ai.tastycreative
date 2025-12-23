// app/api/cron/post-scheduled-feeds/route.ts
// Auto-post scheduled feed posts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export const maxDuration = 60; // 60 seconds timeout
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key';
    
    console.log('[Cron Debug] Auth header received:', authHeader);
    console.log('[Cron Debug] Expected secret:', `Bearer ${cronSecret}`);
    console.log('[Cron Debug] Env CRON_SECRET:', cronSecret);
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized', debug: { received: authHeader, expected: `Bearer ${cronSecret?.substring(0, 10)}...` } }, { status: 401 });
    }

    const now = new Date();
    console.log(`[Cron] Checking for scheduled posts at ${now.toISOString()}`);

    // Find all scheduled posts that are due (timeSlot is in the past or now) and not yet posted
    const dueSlots = await prisma.feedPostPlanningSlot.findMany({
      where: {
        timeSlot: {
          lte: now,
        },
        isPosted: false,
      },
      include: {
        pipelineItem: true,
      },
    });

    console.log(`[Cron] Found ${dueSlots.length} posts to publish`);

    const results = [];

    for (const slot of dueSlots) {
      try {
        // Get the profile ID
        if (!slot.profileId) {
          console.error(`[Cron] No profile ID for slot ${slot.id}`);
          results.push({ slotId: slot.id, status: 'error', reason: 'No profile ID' });
          continue;
        }

        // Parse the files from the slot
        let mediaUrls: string[] = [];
        let mediaType: 'image' | 'video' = 'image';

        if (slot.files && typeof slot.files === 'object') {
          const filesArray = Array.isArray(slot.files) ? slot.files : [slot.files];
          mediaUrls = filesArray
            .filter((f: any) => f && typeof f === 'object' && f.awsS3Url)
            .map((f: any) => f.awsS3Url);
          
          // Determine media type from first file
          const firstFile = filesArray[0];
          if (filesArray.length > 0 && firstFile && typeof firstFile === 'object' && 'mimeType' in firstFile) {
            const mimeType = (firstFile as any).mimeType;
            if (typeof mimeType === 'string' && mimeType.startsWith('video/')) {
              mediaType = 'video';
            }
          }
        }

        if (mediaUrls.length === 0) {
          console.error(`[Cron] No media files for slot ${slot.id}`);
          results.push({ slotId: slot.id, status: 'error', reason: 'No media files' });
          continue;
        }

        // Create the feed post
        const feedPost = await prisma.feedPost.create({
          data: {
            user: {
              connect: {
                clerkId: slot.clerkId,
              },
            },
            profile: {
              connect: {
                id: slot.profileId,
              },
            },
            imageUrls: mediaUrls,
            mediaType: mediaType,
            caption: slot.caption || '',
          },
        });

        // Mark the slot as posted
        await prisma.feedPostPlanningSlot.update({
          where: { id: slot.id },
          data: {
            isPosted: true,
            postedAt: new Date(),
          },
        });

        console.log(`[Cron] Successfully posted slot ${slot.id} as feed post ${feedPost.id}`);
        results.push({ 
          slotId: slot.id, 
          feedPostId: feedPost.id, 
          status: 'success',
          scheduledTime: slot.timeSlot,
        });
      } catch (error) {
        console.error(`[Cron] Error posting slot ${slot.id}:`, error);
        results.push({ 
          slotId: slot.id, 
          status: 'error', 
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      postsChecked: dueSlots.length,
      results,
    });
  } catch (error) {
    console.error('[Cron] Fatal error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process scheduled posts',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
