import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from '@/lib/database';

// Vercel function configuration
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// GET endpoint to fetch style transfer generation history
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get profileId from query params to filter by profile
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');

    console.log('📋 Fetching Style Transfer history for user:', userId, 'profileId:', profileId);

    // First get generation jobs that could be style transfer type - they are stored as IMAGE_TO_IMAGE
    const recentJobs = await prisma.generationJob.findMany({
      where: {
        clerkId: userId,
        status: 'COMPLETED',
        // Style transfer uses IMAGE_TO_IMAGE type (same as SeeDream I2I)
        // We'll filter by params to distinguish
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 200, // Increased to find more potential matches
      select: {
        id: true,
        params: true,
        type: true,
      },
    });

    // Filter to only style transfer jobs by checking params - check multiple possible indicators
    const filteredJobIds = recentJobs
      .filter((job) => {
        const params = job.params as any;
        
        // Check various ways a job could be identified as style transfer
        const isStyleTransfer = 
          params?.source === 'flux-style-transfer' || 
          params?.generationType === 'style-transfer' ||
          params?.generation_type === 'style_transfer' ||
          params?.action === 'generate_style_transfer' ||
          // Also check nested params object (in case they're nested)
          params?.params?.source === 'flux-style-transfer' ||
          params?.params?.generationType === 'style-transfer' ||
          // Also check for style transfer specific params (FLUX Redux style transfer signature)
          (params?.weight !== undefined && params?.mode !== undefined && params?.referenceImage !== undefined) ||
          // Check for referenceImageData which is unique to style transfer
          (params?.referenceImageData !== undefined && params?.action === 'generate_style_transfer');
        
        // If profileId is provided, filter to only jobs for that profile
        if (profileId && isStyleTransfer) {
          const jobProfileId = params?.vaultProfileId || params?.profileId || params?.params?.vaultProfileId;
          return jobProfileId === profileId;
        }
        return isStyleTransfer;
      })
      .map((job) => job.id);

    console.log('📋 Found Style Transfer job IDs:', filteredJobIds.length);

    // Fetch images from GeneratedImage table
    let generatedImages: any[] = [];
    if (filteredJobIds.length > 0) {
      generatedImages = await prisma.generatedImage.findMany({
        where: {
          clerkId: userId,
          jobId: {
            in: filteredJobIds,
          },
          awsS3Url: {
            not: null,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
      });
      
      // Filter by profileId from metadata if provided
      if (profileId) {
        generatedImages = generatedImages.filter((img) => {
          const metadata = img.metadata as any;
          return metadata?.vaultProfileId === profileId || metadata?.profileId === profileId;
        });
      }
    }

    console.log('📋 Found generated images:', generatedImages.length);

    // Also fetch vault items that were created from Style Transfer
    const vaultWhere: any = {
      clerkId: userId,
      fileType: 'image/png',
    };
    
    // Filter by profileId if provided
    if (profileId) {
      vaultWhere.profileId = profileId;
    }
    
    const allVaultImages = await prisma.vaultItem.findMany({
      where: vaultWhere,
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    // Filter to only Style Transfer generated images
    const vaultImages = allVaultImages.filter((img) => {
      const metadata = img.metadata as any;
      // Check multiple ways to identify style transfer images
      return metadata?.source === 'flux-style-transfer' ||
             metadata?.generation_type === 'style_transfer' ||
             metadata?.generationType === 'style-transfer' ||
             // Also check for style transfer-specific metadata fields
             (metadata?.weight !== undefined && metadata?.mode !== undefined && metadata?.referenceImageUrl !== undefined);
    }).slice(0, 20);

    console.log('📋 Found vault images:', vaultImages.length);

    // Combine and deduplicate by URL
    const seenUrls = new Set<string>();
    const allImages: any[] = [];

    // Add generated images
    for (const img of generatedImages) {
      const url = img.awsS3Url;
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        const metadata = img.metadata as any;
        allImages.push({
          id: img.id,
          imageUrl: url,
          prompt: metadata?.prompt || '',
          modelVersion: 'FLUX Redux',
          size: `${metadata?.width || 'N/A'}x${metadata?.height || 'N/A'}`,
          createdAt: img.createdAt.toISOString(),
          status: 'completed' as const,
          source: 'generated',
          profileId: metadata?.vaultProfileId || metadata?.profileId,
          metadata: {
            width: metadata?.width,
            height: metadata?.height,
            steps: metadata?.steps,
            cfg: metadata?.cfg,
            samplerName: metadata?.samplerName,
            scheduler: metadata?.scheduler,
            guidance: metadata?.guidance,
            loraStrength: metadata?.loraStrength,
            selectedLora: metadata?.selectedLora,
            seed: metadata?.seed,
            weight: metadata?.weight,
            mode: metadata?.mode,
            downsamplingFactor: metadata?.downsamplingFactor,
            downsamplingFunction: metadata?.downsamplingFunction,
            autocropMargin: metadata?.autocropMargin,
            referenceImage: metadata?.referenceImage,
            referenceImageUrl: metadata?.referenceImageUrl,
            profileId: metadata?.vaultProfileId || metadata?.profileId,
          },
        });
      }
    }

    // Add vault images
    for (const img of vaultImages) {
      const url = img.awsS3Url;
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        const metadata = img.metadata as any;
        allImages.push({
          id: img.id,
          imageUrl: url,
          prompt: metadata?.prompt || '',
          modelVersion: 'FLUX Redux',
          size: `${metadata?.width || 'N/A'}x${metadata?.height || 'N/A'}`,
          createdAt: img.createdAt.toISOString(),
          status: 'completed' as const,
          source: 'vault',
          profileId: img.profileId,
          metadata: {
            width: metadata?.width,
            height: metadata?.height,
            steps: metadata?.steps,
            cfg: metadata?.cfg,
            samplerName: metadata?.samplerName,
            scheduler: metadata?.scheduler,
            guidance: metadata?.guidance,
            loraStrength: metadata?.loraStrength,
            selectedLora: metadata?.selectedLora,
            seed: metadata?.seed,
            weight: metadata?.weight,
            mode: metadata?.mode,
            downsamplingFactor: metadata?.downsamplingFactor,
            downsamplingFunction: metadata?.downsamplingFunction,
            autocropMargin: metadata?.autocropMargin,
            referenceImage: metadata?.referenceImage,
            referenceImageUrl: metadata?.referenceImageUrl,
            profileId: img.profileId,
          },
        });
      }
    }

    // Sort by createdAt descending
    allImages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log('📋 Returning total images:', allImages.length);

    return NextResponse.json({
      success: true,
      images: allImages.slice(0, 50), // Limit to 50
    });
  } catch (error) {
    console.error("Error fetching style transfer history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history", details: String(error) },
      { status: 500 }
    );
  }
}
