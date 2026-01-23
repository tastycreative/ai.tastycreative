/**
 * V1a Platform-Ready Export API
 *
 * POST /api/export/platform-ready
 *
 * Exports content with platform-specific formatting:
 * - Auto-resizes images for each platform's specs
 * - Replaces caption variables ({{model_name}}, {{price}}, etc.)
 * - Generates organized ZIP with platform folders
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { z } from 'zod';

import {
  PlatformId,
  PLATFORM_SPECS,
  getRecommendedDimension,
  PLATFORM_FOLDER_NAMES,
} from '@/lib/export/platform-specs';
import {
  formatCaption,
  CaptionVariables,
  generateCaptionFile,
} from '@/lib/export/caption-formatter';
import { resizeImage, ResizeOptions } from '@/lib/export/image-resizer';
import {
  generateExportZip,
  ExportContentItem,
  PlatformExportConfig,
} from '@/lib/export/zip-generator';

// Request validation schema
const ExportRequestSchema = z.object({
  // Content to export - either URLs or S3 keys
  images: z.array(
    z.object({
      url: z.string().optional(),
      s3Key: z.string().optional(),
      filename: z.string(),
      caption: z.string().optional(),
    })
  ).min(1, 'At least one image is required'),

  // Target platforms
  platforms: z.array(
    z.enum([
      'onlyfans',
      'fansly',
      'fanvue',
      'instagram-posts',
      'instagram-stories',
      'instagram-reels',
      'twitter',
      'tiktok',
    ])
  ).min(1, 'At least one platform is required'),

  // Caption template (optional - uses per-image captions if not provided)
  captionTemplate: z.string().optional(),

  // Variables for caption replacement
  variables: z.object({
    model_name: z.string().optional(),
    price: z.union([z.string(), z.number()]).optional(),
    platform: z.string().optional(),
    subscription_price: z.union([z.string(), z.number()]).optional(),
    bundle_price: z.union([z.string(), z.number()]).optional(),
    tip_amount: z.union([z.string(), z.number()]).optional(),
    username: z.string().optional(),
    link: z.string().optional(),
    date: z.string().optional(),
  }).optional(),

  // Export configuration
  exportName: z.string().default('export'),
  modelName: z.string().optional(),
  includeManifest: z.boolean().default(true),

  // Image options
  imageQuality: z.number().min(1).max(100).default(85),
  imageFormat: z.enum(['jpeg', 'png', 'webp']).default('jpeg'),
});

type ExportRequest = z.infer<typeof ExportRequestSchema>;

// Initialize S3 client
function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || '',
    },
  });
}

/**
 * Fetch image data from URL or S3
 */
async function fetchImageData(
  image: { url?: string; s3Key?: string; filename: string }
): Promise<Buffer> {
  // Try S3 first
  if (image.s3Key) {
    try {
      const s3Client = getS3Client();
      const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || '';

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: image.s3Key,
      });

      const response = await s3Client.send(command);

      if (response.Body) {
        const chunks: Uint8Array[] = [];
        // @ts-expect-error - Body is a readable stream
        for await (const chunk of response.Body) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      }
    } catch (error) {
      console.error(`Failed to fetch from S3: ${image.s3Key}`, error);
      // Fall through to URL fetch
    }
  }

  // Try URL
  if (image.url) {
    try {
      const response = await fetch(image.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error(`Failed to fetch from URL: ${image.url}`, error);
      throw error;
    }
  }

  throw new Error(`No valid source for image: ${image.filename}`);
}

/**
 * POST /api/export/platform-ready
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    const validationResult = ExportRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      images,
      platforms,
      captionTemplate,
      variables = {},
      exportName,
      modelName,
      includeManifest,
      imageQuality,
      imageFormat,
    } = validationResult.data;

    console.log(`📦 Starting platform-ready export: ${images.length} images, ${platforms.length} platforms`);

    // Process each platform
    const platformConfigs: PlatformExportConfig[] = [];

    for (const platformId of platforms) {
      const dimension = getRecommendedDimension(platformId);
      if (!dimension) {
        console.warn(`Unknown platform: ${platformId}, skipping`);
        continue;
      }

      console.log(`📐 Processing platform: ${platformId} (${dimension.width}x${dimension.height})`);

      const platformItems: ExportContentItem[] = [];

      // Process each image for this platform
      for (const image of images) {
        try {
          // Fetch original image
          const originalData = await fetchImageData(image);

          // Resize for this platform
          const resizeOptions: ResizeOptions = {
            width: dimension.width,
            height: dimension.height,
            mode: 'cover',
            position: 'attention',
            format: imageFormat,
            quality: imageQuality,
          };

          const resized = await resizeImage(originalData, resizeOptions);

          // Format caption
          let caption = image.caption || captionTemplate || '';
          if (caption) {
            // Add platform to variables for this export
            const platformVariables: CaptionVariables = {
              ...variables,
              platform: PLATFORM_SPECS[platformId]?.name || platformId,
            };

            const formatted = formatCaption(caption, platformVariables, {
              platform: platformId,
              truncate: true,
              enforceHashtagLimit: true,
              removeEmptyVariables: true,
            });

            caption = formatted.text;
          }

          platformItems.push({
            filename: image.filename,
            data: resized.buffer,
            mimeType: resized.mimeType,
            caption,
          });

        } catch (error) {
          console.error(`Failed to process image ${image.filename} for ${platformId}:`, error);
          // Continue with other images
        }
      }

      if (platformItems.length > 0) {
        platformConfigs.push({
          platformId,
          items: platformItems,
        });
      }
    }

    if (platformConfigs.length === 0) {
      return NextResponse.json(
        { error: 'No images were successfully processed' },
        { status: 400 }
      );
    }

    // Generate ZIP
    console.log(`📦 Generating ZIP with ${platformConfigs.length} platforms`);

    const exportResult = await generateExportZip({
      name: exportName,
      platforms: platformConfigs,
      includeManifest,
      modelName,
    });

    console.log(`✅ Export complete: ${exportResult.filename} (${exportResult.fileCount} files, ${Math.round(exportResult.totalSize / 1024)}KB)`);

    // Return ZIP as download (convert Buffer to Uint8Array for proper BodyInit compatibility)
    return new NextResponse(new Uint8Array(exportResult.buffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
        'Content-Length': exportResult.buffer.length.toString(),
        'X-Export-File-Count': exportResult.fileCount.toString(),
        'X-Export-Platforms': exportResult.platforms.join(','),
      },
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      {
        error: 'Export failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/export/platform-ready
 *
 * Returns available platforms and their specs for UI
 * Note: This endpoint doesn't require auth since it just returns public config data
 */
export async function GET() {
  try {
    // Return platform specs for UI to display (no auth needed for config data)
    const platforms = Object.entries(PLATFORM_SPECS).map(([id, spec]) => ({
      id,
      name: spec.name,
      shortName: spec.shortName,
      icon: spec.icon,
      color: spec.color,
      dimensions: spec.dimensions,
      captionLimits: spec.captionLimits,
      folderName: PLATFORM_FOLDER_NAMES[id as PlatformId],
    }));

    return NextResponse.json({
      platforms,
      supportedVariables: [
        { key: 'model_name', description: 'Model/persona name' },
        { key: 'price', description: 'Generic price value' },
        { key: 'platform', description: 'Platform name (auto-set per platform)' },
        { key: 'subscription_price', description: 'Subscription price' },
        { key: 'bundle_price', description: 'Bundle price' },
        { key: 'tip_amount', description: 'Tip amount' },
        { key: 'username', description: 'Username/handle' },
        { key: 'link', description: 'Profile link' },
        { key: 'date', description: 'Current date' },
      ],
    });

  } catch (error) {
    console.error('Error fetching platform specs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platform specs' },
      { status: 500 }
    );
  }
}
