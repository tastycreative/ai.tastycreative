import { NextRequest, NextResponse } from 'next/server';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { prisma } from '@/lib/database';
import { trackStorageUpload } from '@/lib/storageEvents';
import { convertS3ToCdnUrl } from '@/lib/cdnUtils';
import { publishToUser } from '@/lib/ably-server';

/**
 * POST /api/generate/seedream-image-to-image/process
 *
 * Background worker invoked by the /start route via `after()`.
 * Gets its own 300-second serverless execution window on Vercel.
 *
 * KEY DESIGN: instead of one sequential BytePlus call for N images
 * (which can take N×60 s and exceed the 300 s limit), this route fires
 * N **parallel** single-image requests.  Each individual call takes ~30-60 s;
 * parallel execution means total wall-clock time ≈ max(single call) ≈ 60 s,
 * regardless of batch size up to 10+.
 *
 * Flow:
 *  1. Verify internal API key header.
 *  2. Load job + params from DB.
 *  3. Read temp reference images uploaded by /start from S3.
 *  4. Fire `maxImages` parallel BytePlus requests (1 output image each).
 *  5. Download each generated image → upload to final S3 destination.
 *  6. Persist to GeneratedImage or VaultItem depending on saveToVault flag.
 *  7. Mark job COMPLETED; publish Ably event; clean up temp S3 objects.
 */
export const runtime = 'nodejs';
export const maxDuration = 300; // full 5-minute window for this worker
export const dynamic = 'force-dynamic';

const BYTEPLUS_API_KEY = process.env.ARK_API_KEY!;
const BYTEPLUS_API_URL =
  'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations';

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || '';

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Download an S3 object and return it as a Buffer. */
async function downloadS3Object(key: string): Promise<Buffer> {
  const cmd = new GetObjectCommand({ Bucket: AWS_S3_BUCKET, Key: key });
  const response = await s3Client.send(cmd);
  const stream = response.Body as NodeJS.ReadableStream;
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on('data', (c: Uint8Array) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/** Delete an S3 object (used to clean up temp reference images). */
async function deleteS3Object(key: string): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: AWS_S3_BUCKET, Key: key }),
    );
  } catch (err) {
    console.warn(`[process] Failed to delete temp S3 key ${key}:`, err);
  }
}

/** Convert a Buffer to a base64 data-URL. */
function bufferToDataUrl(buf: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buf.toString('base64')}`;
}

/**
 * Resolve vault folder for the current user (replicates the access-control
 * logic in the main route so we don't have a single source-of-truth drift).
 */
async function resolveVaultFolder(
  vaultFolderId: string,
  vaultProfileId: string,
  userId: string,
) {
  // 1. User owns the folder
  let folder = await prisma.vaultFolder.findFirst({
    where: { id: vaultFolderId, clerkId: userId, profileId: vaultProfileId },
  });
  if (folder) return folder;

  // 2. Access via organisation membership
  const currentUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, currentOrganizationId: true },
  });
  const profile = await prisma.instagramProfile.findUnique({
    where: { id: vaultProfileId },
    select: { id: true, clerkId: true, organizationId: true },
  });

  if (profile?.organizationId && currentUser) {
    let isOrgMember =
      currentUser.currentOrganizationId === profile.organizationId;
    if (!isOrgMember) {
      const membership = await prisma.teamMember.findFirst({
        where: { userId: currentUser.id, organizationId: profile.organizationId },
      });
      isOrgMember = !!membership;
    }
    if (isOrgMember) {
      folder = await prisma.vaultFolder.findFirst({
        where: { id: vaultFolderId, profileId: vaultProfileId },
      });
      if (folder) return folder;
    }
  }

  // 3. Explicitly shared with EDIT permission
  const sharedFolder = await prisma.vaultFolder.findFirst({
    where: {
      id: vaultFolderId,
      profileId: vaultProfileId,
      shares: { some: { sharedWithClerkId: userId } },
    },
    include: {
      shares: {
        where: { sharedWithClerkId: userId },
        select: { permission: true },
      },
    },
  });
  if (sharedFolder?.shares.some((s) => s.permission === 'EDIT')) {
    return sharedFolder;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Single-image BytePlus request
// ---------------------------------------------------------------------------

interface BytePlusImageResult {
  url?: string;
  b64_json?: string;
  size?: string;
}

/**
 * Hard timeout (ms) for a single BytePlus image generation request.
 * Set conservatively below Vercel's 300 s limit so the /process function
 * has time to save partial results and publish a completion event even if
 * some requests take longer than expected.
 */
const BYTEPLUS_REQUEST_TIMEOUT_MS = 240_000; // 240 s per image request

async function generateOneImage(params: {
  model: string;
  prompt: string;
  /** base64 data-URLs — primary image first, then additional references */
  imageDataUrls: string[];
  size: string;
  watermark: boolean;
}): Promise<BytePlusImageResult> {
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    image:
      params.imageDataUrls.length === 1
        ? params.imageDataUrls[0]
        : params.imageDataUrls,
    watermark: params.watermark,
    size: params.size,
    // sequential_image_generation intentionally omitted — we generate 1 image
    // per invocation and run N invocations in parallel instead.
  };

  // Hard per-request abort so a slow BytePlus response can never consume
  // the entire Vercel execution window.
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`BytePlus request timed out after ${BYTEPLUS_REQUEST_TIMEOUT_MS / 1000}s`)),
    BYTEPLUS_REQUEST_TIMEOUT_MS,
  );

  const res = await fetch(BYTEPLUS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BYTEPLUS_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));

  if (!res.ok) {
    const errText = await res.text();
    let parsed: any = {};
    try { parsed = JSON.parse(errText); } catch { /**/ }
    const message =
      parsed?.error?.message || parsed?.message || parsed?.error || errText;
    throw new Error(`BytePlus error ${res.status}: ${message}`);
  }

  const data = await res.json();
  const item = data?.data?.[0];
  if (!item) throw new Error('BytePlus returned no image data');
  return item as BytePlusImageResult;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Security gate: only allow invocations from /start (via after())
  const internalKey = process.env.INTERNAL_GENERATION_API_KEY ?? '';
  const providedKey = request.headers.get('x-internal-key') ?? '';
  if (!internalKey || providedKey !== internalKey) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { jobId } = await request.json();
  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  // 2. Load job from DB
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const clerkId = job.clerkId;
  const params = job.params as Record<string, any>;

  const {
    prompt,
    model = 'ep-20260103160511-gxx75',
    watermark = false,
    size = '2048x2048',
    organizationSlug,
    saveToVault = false,
    vaultProfileId,
    vaultFolderId,
    resolution,
    aspectRatio,
    referenceImageUrls = [],
    tempS3Keys = [],
    numReferenceImages = 1,
    sequential_image_generation_options,
  } = params;

  const maxImages: number =
    sequential_image_generation_options?.max_images ?? 1;

  // Helper to update job progress and optionally broadcast
  const updateJob = async (
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED',
    extra: Partial<{
      progress: number;
      stage: string;
      message: string;
      error: string;
      resultUrls: string[];
    }> = {},
  ) => {
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status, ...extra },
    });
  };

  try {
    // 3. Publish "processing" state so subscribed clients get immediate feedback
    await publishToUser(clerkId, {
      jobId,
      status: 'processing',
      progress: 5,
      stage: 'loading_references',
      message: 'Downloading reference images…',
    });

    // 4. Download temp reference images from S3 → data-URLs
    let imageDataUrls: string[] = [];

    if (tempS3Keys.length > 0) {
      const buffers = await Promise.all(
        (tempS3Keys as string[]).map(async (key) => {
          const buf = await downloadS3Object(key);
          const mime = key.endsWith('.png') ? 'image/png' : 'image/jpeg';
          return bufferToDataUrl(buf, mime);
        }),
      );
      imageDataUrls = buffers;
    }

    if (imageDataUrls.length === 0) {
      throw new Error('No reference images found in temp storage');
    }

    // 5. Resolve vault folder once (shared for all parallel writes)
    let vaultFolder: Awaited<ReturnType<typeof resolveVaultFolder>> = null;
    if (saveToVault && vaultProfileId && vaultFolderId) {
      vaultFolder = await resolveVaultFolder(vaultFolderId, vaultProfileId, clerkId);
      if (!vaultFolder) {
        throw new Error('Vault folder not found or access denied');
      }
    }

    await publishToUser(clerkId, {
      jobId,
      status: 'processing',
      progress: 15,
      stage: 'generating',
      message: `Generating ${maxImages} image${maxImages > 1 ? 's' : ''} in parallel…`,
    });

    await updateJob('PROCESSING', {
      progress: 15,
      stage: 'generating',
      message: `Generating ${maxImages} image${maxImages > 1 ? 's' : ''} in parallel…`,
    });

    // 6. Fire maxImages parallel BytePlus requests (1 image each).
    //    This replaces the single sequential call and keeps latency at ~60 s
    //    regardless of batch size, far under the 300 s Vercel limit.
    const generatePromises = Array.from({ length: maxImages }, (_, i) =>
      generateOneImage({
        model,
        prompt,
        imageDataUrls,
        size,
        watermark,
      }).catch((err) => {
        console.error(`[process] Image ${i + 1}/${maxImages} failed:`, err.message);
        return null; // partial failures are OK; we save what we get
      }),
    );

    const byteResults = await Promise.all(generatePromises);
    const successfulResults = byteResults.filter(
      (r): r is BytePlusImageResult => r !== null,
    );

    if (successfulResults.length === 0) {
      throw new Error('All BytePlus generation requests failed');
    }

    await publishToUser(clerkId, {
      jobId,
      status: 'processing',
      progress: 70,
      stage: 'saving',
      message: `Saving ${successfulResults.length} image${successfulResults.length > 1 ? 's' : ''}…`,
    });

    // 7. Download each result + upload to final S3 destination in parallel
    const savePromises = successfulResults.map(async (item, index) => {
      try {
        let imageBuffer: Buffer;

        if (item.url) {
          const imgRes = await fetch(item.url);
          if (!imgRes.ok) throw new Error(`Failed to download image ${index}`);
          imageBuffer = Buffer.from(await imgRes.arrayBuffer());
        } else if (item.b64_json) {
          imageBuffer = Buffer.from(item.b64_json, 'base64');
        } else {
          throw new Error(`Image ${index} has no URL or base64 data`);
        }

        const timestamp = Date.now();
        const filename = `seedream-i2i-${timestamp}-${index}.png`;

        let s3Key: string;
        if (saveToVault && vaultFolder) {
          s3Key = organizationSlug
            ? `organizations/${organizationSlug}/vault/${vaultFolder.clerkId}/${vaultProfileId}/${vaultFolderId}/${filename}`
            : `vault/${vaultFolder.clerkId}/${vaultProfileId}/${vaultFolderId}/${filename}`;
        } else {
          s3Key = `outputs/${clerkId}/${filename}`;
        }

        await s3Client.send(
          new PutObjectCommand({
            Bucket: AWS_S3_BUCKET,
            Key: s3Key,
            Body: imageBuffer,
            ContentType: 'image/png',
            CacheControl: 'public, max-age=31536000',
          }),
        );

        const publicUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

        const [width, height] = (item.size || size || '2048x2048')
          .split('x')
          .map(Number);

        const commonMetadata = {
          source: 'seedream-i2i',
          generationType: 'image-to-image',
          model,
          prompt,
          size: item.size || size,
          resolution: resolution ?? null,
          aspectRatio: aspectRatio ?? null,
          watermark,
          numReferenceImages,
          referenceImageUrls,
          generatedAt: new Date().toISOString(),
          generatedByClerkId: clerkId,
        };

        if (saveToVault && vaultFolder) {
          const vaultItem = await prisma.vaultItem.create({
            data: {
              clerkId: vaultFolder.clerkId,
              profileId: vaultProfileId,
              folderId: vaultFolderId,
              fileName: filename,
              fileType: 'image/png',
              fileSize: imageBuffer.length,
              awsS3Key: s3Key,
              awsS3Url: publicUrl,
              metadata: commonMetadata,
            },
          });

          if (imageBuffer.length > 0) {
            trackStorageUpload(vaultFolder.clerkId, imageBuffer.length).catch(
              (e) => console.error('[process] trackStorageUpload:', e),
            );
          }

          return {
            id: vaultItem.id,
            url: convertS3ToCdnUrl(publicUrl) || publicUrl,
            size: item.size || size,
            prompt,
            model,
            createdAt: vaultItem.createdAt.toISOString(),
            savedToVault: true,
            metadata: {
              resolution: resolution ?? '2K',
              aspectRatio: aspectRatio ?? null,
              watermark,
              numReferenceImages,
              referenceImageUrls,
              profileId: vaultProfileId ?? null,
            },
          };
        } else {
          const savedImage = await prisma.generatedImage.create({
            data: {
              clerkId,
              jobId,
              filename,
              subfolder: '',
              type: 'output',
              fileSize: imageBuffer.length,
              width,
              height,
              format: 'png',
              awsS3Key: s3Key,
              awsS3Url: publicUrl,
              metadata: {
                ...commonMetadata,
                vaultProfileId: vaultProfileId ?? null,
              },
            },
          });

          return {
            id: savedImage.id,
            url: convertS3ToCdnUrl(publicUrl) || publicUrl,
            imageUrl: convertS3ToCdnUrl(publicUrl) || publicUrl,
            size: item.size || size,
            prompt,
            model,
            createdAt: savedImage.createdAt.toISOString(),
            status: 'completed' as const,
            metadata: {
              resolution: resolution ?? '2K',
              aspectRatio: aspectRatio ?? null,
              watermark,
              numReferenceImages,
              referenceImageUrls,
              profileId: vaultProfileId ?? null,
            },
          };
        }
      } catch (err: any) {
        console.error(`[process] Failed to save image ${index}:`, err.message);
        return null;
      }
    });

    const savedResults = (await Promise.all(savePromises)).filter(
      (r): r is NonNullable<typeof r> => r !== null,
    );

    if (savedResults.length === 0) {
      throw new Error('Failed to save any generated images');
    }

    // 8. Mark job COMPLETED and persist result URLs
    const resultUrls = savedResults.map((r) => r.url);
    await updateJob('COMPLETED', {
      progress: 100,
      stage: 'completed',
      message: `Generated ${savedResults.length} image${savedResults.length > 1 ? 's' : ''} successfully`,
      resultUrls,
    });

    // 9. Notify the client with the full result payload
    await publishToUser(clerkId, {
      jobId,
      status: 'completed',
      progress: 100,
      stage: 'completed',
      message: 'Generation complete',
      images: savedResults,
    });

    // 10. Clean up temp S3 reference images (fire-and-forget)
    (tempS3Keys as string[]).forEach((key) => deleteS3Object(key));

    console.log(
      `[process] Job ${jobId} completed — ${savedResults.length} images saved`,
    );

    return NextResponse.json({ success: true, jobId, count: savedResults.length });
  } catch (err: any) {
    console.error(`[process] Job ${jobId} failed:`, err);

    await updateJob('FAILED', {
      progress: 0,
      stage: 'failed',
      message: err.message || 'Generation failed',
      error: err.message,
    }).catch(() => {});

    await publishToUser(clerkId, {
      jobId,
      status: 'failed',
      progress: 0,
      stage: 'failed',
      message: err.message || 'Generation failed',
      error: err.message,
    }).catch(() => {});

    // Still clean up temp images on failure
    (tempS3Keys as string[] ?? []).forEach((key) => deleteS3Object(key));

    return NextResponse.json(
      { error: err.message || 'Processing failed' },
      { status: 500 },
    );
  }
}
