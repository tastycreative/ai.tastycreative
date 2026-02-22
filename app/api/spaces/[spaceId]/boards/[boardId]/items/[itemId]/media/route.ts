import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { generatePresignedUploadUrl } from '@/lib/s3-submission-uploads';

type Params = { params: Promise<{ spaceId: string; boardId: string; itemId: string }> };

/* ------------------------------------------------------------------ */
/*  GET /api/spaces/:spaceId/boards/:boardId/items/:itemId/media       */
/* ------------------------------------------------------------------ */

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { itemId } = await params;

    const media = await prisma.boardItemMedia.findMany({
      where: { itemId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ media });
  } catch (error) {
    console.error('Error fetching board item media:', error);
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/spaces/:spaceId/boards/:boardId/items/:itemId/media      */
/*                                                                     */
/*  Two actions:                                                       */
/*    { action: 'presign', fileName, fileType }                        */
/*      → returns S3 presigned URL for direct upload                   */
/*    { action: 'record', url, type, name?, size? }                    */
/*      → creates a BoardItemMedia row after successful S3 upload      */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { itemId } = await params;
    const body = await req.json().catch(() => null);

    if (!body || !body.action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    /* ── presign ─────────────────────────────────────────────────── */
    if (body.action === 'presign') {
      if (!body.fileName || !body.fileType) {
        return NextResponse.json(
          { error: 'fileName and fileType are required' },
          { status: 400 },
        );
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { currentOrganizationId: true },
      });

      const orgId = user?.currentOrganizationId ?? 'unknown';

      const presigned = await generatePresignedUploadUrl(
        body.fileName,
        body.fileType,
        orgId,
        `board-items/${itemId}`,
      );

      return NextResponse.json(presigned);
    }

    /* ── record ──────────────────────────────────────────────────── */
    if (body.action === 'record') {
      if (!body.url || !body.type) {
        return NextResponse.json(
          { error: 'url and type are required' },
          { status: 400 },
        );
      }

      const media = await prisma.boardItemMedia.create({
        data: {
          itemId,
          url: body.url,
          type: body.type,
          name: body.name ?? null,
          size: typeof body.size === 'number' ? body.size : null,
        },
      });

      return NextResponse.json(media, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in board item media:', error);
    return NextResponse.json({ error: 'Failed to process media request' }, { status: 500 });
  }
}
