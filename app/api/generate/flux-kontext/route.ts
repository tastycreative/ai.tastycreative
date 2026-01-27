import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// GET handler to fetch Flux Kontext generation history
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

    console.log('📋 Fetching Flux Kontext history for user:', userId, 'profileId:', profileId);

    // Import prisma lazily to avoid issues
    const { prisma } = await import('@/lib/database');

    // Handle "all" profile case - fetch across all profiles
    const isAllProfiles = profileId === 'all';

    // Fetch recent Flux Kontext generations from database
    const recentJobs = await prisma.generationJob.findMany({
      where: {
        clerkId: userId,
        type: 'FLUX_KONTEXT',
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

    // Filter by profileId if provided (and not "all")
    const filteredJobs = recentJobs.filter((job) => {
      const params = job.params as any;
      
      // If viewing all profiles, include everything
      if (isAllProfiles) return true;
      
      // If profileId filter is provided, STRICTLY match the profileId
      if (profileId) {
        const jobProfileId = params?.vaultProfileId;
        return jobProfileId === profileId;
      }
      
      // If no profileId filter, show all jobs
      return true;
    });

    const jobIds = filteredJobs.map((job) => job.id);

    console.log('📋 Found Flux Kontext job IDs:', jobIds.length);

    // Fetch images from GeneratedImage table
    let generatedImages: any[] = [];
    if (jobIds.length > 0) {
      generatedImages = await prisma.generatedImage.findMany({
        where: {
          clerkId: userId,
          jobId: {
            in: jobIds,
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
      
      // Filter by profileId from metadata if provided (and not "all")
      if (profileId && !isAllProfiles) {
        generatedImages = generatedImages.filter((img) => {
          const metadata = img.metadata as any;
          const imgProfileId = metadata?.vaultProfileId;
          return imgProfileId === profileId;
        });
      }
    }

    console.log('📋 Found Flux Kontext generated images:', generatedImages.length);

    // Get profile names for "all profiles" view
    let profileNames: Record<string, string> = {};
    if (isAllProfiles) {
      // Collect unique profile IDs from images
      const profileIds = new Set<string>();
      generatedImages.forEach((img) => {
        const metadata = img.metadata as any;
        if (metadata?.vaultProfileId) {
          profileIds.add(metadata.vaultProfileId);
        }
      });

      // Fetch profile names
      if (profileIds.size > 0) {
        const profiles = await prisma.instagramProfile.findMany({
          where: {
            id: { in: Array.from(profileIds) }
          },
          select: {
            id: true,
            name: true,
            instagramUsername: true,
          }
        });
        profiles.forEach((p) => {
          profileNames[p.id] = p.instagramUsername || p.name;
        });
      }
    }

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

      const metadata = img.metadata as any;
      const imgProfileId = metadata?.vaultProfileId;

      return {
        id: img.id,
        imageUrl,
        prompt: metadata?.prompt || '',
        createdAt: img.createdAt.toISOString(),
        width: metadata?.width || img.width || 0,
        height: metadata?.height || img.height || 0,
        status: 'completed' as const,
        profileId: imgProfileId,
        profileName: imgProfileId ? profileNames[imgProfileId] : undefined,
        metadata: {
          ...metadata,
          referenceImageUrl: metadata?.referenceImageUrl,
          referenceImageUrls: metadata?.referenceImageUrls,
          steps: metadata?.steps,
          guidance: metadata?.guidance,
          seed: metadata?.seed,
        },
      };
    });

    return NextResponse.json({
      success: true,
      images,
      total: images.length,
    });

  } catch (error) {
    console.error('❌ Error fetching Flux Kontext history:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
