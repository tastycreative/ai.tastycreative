import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { convertS3ToCdnUrl } from '@/lib/cdnUtils';

/**
 * GET /api/generate/seedream-image-to-image/status/[jobId]
 *
 * Polling endpoint for async I2I generations started via /start.
 * The client calls this every ~3 s until status === "completed" or "failed".
 *
 * Response shape:
 *  { jobId, status, progress, stage, message, images?, error? }
 *
 * `images` is only populated when status === "completed".
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      clerkId: true,
      status: true,
      progress: true,
      stage: true,
      message: true,
      error: true,
      resultUrls: true,
      params: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Users may only access their own jobs
  if (job.clerkId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const jobParams = job.params as Record<string, any> | null;
  const saveToVault = jobParams?.saveToVault ?? false;
  const vaultProfileId = jobParams?.vaultProfileId ?? null;

  // If not yet complete, return just the progress metadata
  if (job.status !== 'COMPLETED') {
    return NextResponse.json({
      jobId: job.id,
      status: job.status.toLowerCase(),
      progress: job.progress ?? 0,
      stage: job.stage ?? 'processing',
      message: job.message ?? 'Processing…',
      error: job.error ?? null,
    });
  }

  // ---- COMPLETED: hydrate full image payloads ----

  let images: Array<{
    id: string;
    imageUrl: string;
    prompt: string;
    modelVersion: string;
    size: string;
    createdAt: string;
    status: 'completed';
    source: 'generated' | 'vault';
    profileId?: string | null;
    metadata: {
      resolution: string;
      aspectRatio: string | null;
      watermark: boolean;
      numReferenceImages: number;
      referenceImageUrls: string[];
      profileId: string | null;
    };
  }> = [];

  if (saveToVault && vaultProfileId) {
    // Fetch VaultItems created by this job
    const vaultItems = await prisma.vaultItem.findMany({
      where: {
        clerkId: job.clerkId, // vault items are stored under folder owner's clerkId
        profileId: vaultProfileId,
        metadata: {
          path: ['generatedByClerkId'],
          equals: userId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Filter to items linked to this job (generated around the same time window)
    const jobTime = job.updatedAt.getTime();
    const window = 120_000; // 2-minute window

    const filtered = vaultItems.filter((vi) => {
      const meta = vi.metadata as any;
      const diff = Math.abs(new Date(vi.createdAt).getTime() - jobTime);
      return (
        meta?.source === 'seedream-i2i' &&
        meta?.generatedByClerkId === userId &&
        diff < window
      );
    });

    images = filtered.map((vi) => {
      const meta = vi.metadata as any;
      return {
        id: vi.id,
        imageUrl: convertS3ToCdnUrl(vi.awsS3Url ?? '') || vi.awsS3Url || '',
        prompt: meta?.prompt ?? '',
        modelVersion: meta?.model ?? 'SeeDream 4.5',
        size: meta?.size ?? '',
        createdAt: vi.createdAt.toISOString(),
        status: 'completed' as const,
        source: 'vault' as const,
        profileId: vi.profileId,
        metadata: {
          resolution: meta?.resolution ?? '2K',
          aspectRatio: meta?.aspectRatio ?? null,
          watermark: meta?.watermark ?? false,
          numReferenceImages: meta?.numReferenceImages ?? 1,
          referenceImageUrls: meta?.referenceImageUrls ?? [],
          profileId: vi.profileId,
        },
      };
    });
  } else {
    // Fetch GeneratedImages belonging to this job
    const generatedImages = await prisma.generatedImage.findMany({
      where: { clerkId: userId, jobId: job.id },
      orderBy: { createdAt: 'asc' },
    });

    images = generatedImages.map((gi) => {
      const meta = gi.metadata as any;
      return {
        id: gi.id,
        imageUrl:
          convertS3ToCdnUrl(gi.awsS3Url ?? '') || gi.awsS3Url || '',
        prompt: meta?.prompt ?? '',
        modelVersion: meta?.model ?? 'SeeDream 4.5',
        size:
          gi.width && gi.height
            ? `${gi.width}x${gi.height}`
            : (meta?.size ?? ''),
        createdAt: gi.createdAt.toISOString(),
        status: 'completed' as const,
        source: 'generated' as const,
        profileId: meta?.vaultProfileId ?? null,
        metadata: {
          resolution: meta?.resolution ?? '2K',
          aspectRatio: meta?.aspectRatio ?? null,
          watermark: meta?.watermark ?? false,
          numReferenceImages: meta?.numReferenceImages ?? 1,
          referenceImageUrls: meta?.referenceImageUrls ?? [],
          profileId: meta?.vaultProfileId ?? null,
        },
      };
    });
  }

  return NextResponse.json({
    jobId: job.id,
    status: 'completed',
    progress: 100,
    stage: 'completed',
    message: job.message ?? 'Generation complete',
    images,
  });
}
