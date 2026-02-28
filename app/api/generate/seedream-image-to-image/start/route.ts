import { NextRequest, NextResponse, after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/database';
import { deductCredits } from '@/lib/credits';
import { generationChannel } from '@/lib/ably-server';

/**
 * POST /api/generate/seedream-image-to-image/start
 *
 * Async entry point for SeeDream I2I generation.
 * 1. Validates request + deducts credits.
 * 2. Uploads base64 reference images to temporary S3 keys.
 * 3. Creates a PENDING GenerationJob in the DB.
 * 4. After the response is sent, fires a fire-and-forget POST to the /process
 *    route which runs in its own serverless invocation (own 5-min timeout).
 * 5. Returns { jobId, channelName } immediately — client subscribes to the
 *    Ably generation channel to receive the result when ready.
 */
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 s is more than enough to upload temp images
export const dynamic = 'force-dynamic';

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || '';

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

function getFeatureKeyFromPath(requestUrl: string): string {
  // Reuse the same feature key as the main route
  return 'seedream_image_to_image';
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      prompt,
      model = 'ep-20260103160511-gxx75',
      image, // base64 string or array of base64 strings
      watermark = false,
      sequential_image_generation = 'disabled',
      sequential_image_generation_options,
      size = '2048x2048',
      organizationSlug,
      saveToVault,
      vaultProfileId,
      vaultFolderId,
      resolution,
      aspectRatio,
      referenceImageUrls,
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }
    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    // Look up user and org
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, currentOrganizationId: true },
    });
    if (!user?.currentOrganizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    // Deduct credits upfront
    const creditResult = await deductCredits(
      user.currentOrganizationId,
      getFeatureKeyFromPath(request.url),
      user.id,
    );
    if (!creditResult.success) {
      return NextResponse.json(
        {
          error: creditResult.error || 'Failed to deduct credits',
          insufficientCredits: creditResult.error?.includes('Insufficient credits'),
        },
        { status: 400 },
      );
    }

    // Upload each base64 image to a temp S3 key so the /process route can
    // retrieve them without the client needing to resend large payloads.
    const images = Array.isArray(image) ? image : [image];
    const tempS3Keys: string[] = [];

    const jobId = `i2i-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    for (let i = 0; i < images.length; i++) {
      const base64 = images[i] as string;
      // Strip data URL prefix if present
      const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
      const mimeType = base64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      const ext = mimeType === 'image/png' ? 'png' : 'jpg';
      const key = `temp/i2i/${jobId}/image-${i}.${ext}`;

      const buffer = Buffer.from(base64Data, 'base64');
      await s3Client.send(
        new PutObjectCommand({
          Bucket: AWS_S3_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          // Auto-expire after 1 hour via an S3 lifecycle rule (or we delete in /process)
        }),
      );

      tempS3Keys.push(key);
    }

    // Create a PENDING job record carrying all generation parameters
    const job = await prisma.generationJob.create({
      data: {
        clerkId: userId,
        status: 'PROCESSING',
        type: 'IMAGE_TO_IMAGE',
        progress: 0,
        params: {
          source: 'seedream-i2i',
          async: true,
          prompt,
          model,
          watermark,
          sequential_image_generation,
          sequential_image_generation_options: sequential_image_generation_options ?? null,
          size,
          organizationSlug: organizationSlug ?? null,
          saveToVault: saveToVault ?? false,
          vaultProfileId: vaultProfileId ?? null,
          vaultFolderId: vaultFolderId ?? null,
          resolution: resolution ?? null,
          aspectRatio: aspectRatio ?? null,
          referenceImageUrls: referenceImageUrls ?? [],
          tempS3Keys,
          numReferenceImages: images.length,
        },
      },
    });

    const channelName = generationChannel(userId);

    // Determine process URL (same origin)
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      (request.headers.get('origin') ?? `https://${request.headers.get('host')}`);
    const processUrl = `${origin}/api/generate/seedream-image-to-image/process`;
    const internalKey = process.env.INTERNAL_GENERATION_API_KEY ?? '';

    // After the response is sent, fire the /process route asynchronously.
    // /process gets its own 5-minute serverless execution window.
    after(async () => {
      try {
        // We intentionally do NOT await the full response — we only need to
        // initiate the request so the separate serverless invocation starts.
        const ctrl = new AbortController();
        const _ = fetch(processUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-key': internalKey,
          },
          body: JSON.stringify({ jobId: job.id }),
          // Give it a short signal just to ensure the request is dispatched;
          // the process route itself runs independently on Vercel.
          signal: ctrl.signal,
        });
        // Abort the tracking just 500 ms after send — the actual /process function
        // keeps running in its own invocation regardless.
        setTimeout(() => ctrl.abort(), 500);
        await _ .catch(() => {}); // swallow abort error
      } catch {
        // Non-fatal — job stays PROCESSING; operator can manually re-trigger
      }
    });

    return NextResponse.json({
      jobId: job.id,
      channelName,
    });
  } catch (error: any) {
    console.error('[I2I start] error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
