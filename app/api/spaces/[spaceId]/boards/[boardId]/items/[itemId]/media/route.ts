import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { Prisma } from '@/lib/generated/prisma';
import { generatePresignedUploadUrl } from '@/lib/s3-submission-uploads';
import { deleteFromS3 } from '@/lib/s3-cleanup';
import { WALL_POST_STATUS } from '@/lib/wall-post-status';

const CDN_DOMAIN = process.env.CDN_DOMAIN || 'cdn.tastycreative.xyz';
const S3_BUCKET = process.env.AWS_S3_BUCKET || 'tastycreative';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

/** Extract the S3 key from a CDN or S3 URL. */
function extractS3Key(url: string): string | null {
  try {
    const parsed = new URL(url);
    // CDN URL: https://cdn.tastycreative.xyz/content-submissions/...
    if (parsed.hostname === CDN_DOMAIN) {
      return parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
    }
    // S3 URL: https://bucket.s3.region.amazonaws.com/key
    if (parsed.hostname.includes('.s3.') && parsed.hostname.includes('.amazonaws.com')) {
      return parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
    }
    return null;
  } catch {
    return null;
  }
}

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

    const { spaceId, boardId, itemId } = await params;
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

      // ── Sync / auto-push to Caption Queue ────────────────────
      // 1. If a ticket is already linked → add this file as a content item.
      //    Wall-post items get requiresCaption:true; OTP/PTR items are display-only.
      // 2. If no ticket exists yet AND this is a WALL_POST board → auto-create the
      //    ticket (first media upload triggers the push, subsequent ones sync via #1).
      try {
        const boardItem = await prisma.boardItem.findUnique({
          where: { id: itemId },
          select: { metadata: true },
        });
        const meta = (boardItem?.metadata as Record<string, unknown>) ?? {};
        const captionTicketId = meta.captionTicketId as string | undefined;

        // Derive fileType from MIME type (shared for both paths)
        const mimeType = (body.type as string).toLowerCase();
        const fileType = mimeType.startsWith('image/')
          ? 'image'
          : mimeType.startsWith('video/')
            ? 'video'
            : null;

        if (captionTicketId) {
          // ── Path A: ticket already exists — append content item ──
          const ticket = await prisma.captionQueueTicket.findUnique({
            where: { id: captionTicketId },
            select: { workflowType: true },
          });
          const isWallPost = !ticket?.workflowType || ticket.workflowType === 'wall_post';

          const existingCount = await prisma.captionQueueContentItem.count({
            where: { ticketId: captionTicketId },
          });

          await prisma.captionQueueContentItem.create({
            data: {
              ticketId: captionTicketId,
              url: body.url,
              sourceType: 'upload',
              fileName: body.name ?? null,
              fileType,
              sortOrder: existingCount,
              // Wall-post: each file needs its own caption; OTP/PTR: display-only
              requiresCaption: isWallPost,
              captionStatus: isWallPost ? 'pending' : 'not_required',
            },
          });
        } else {
          // ── Path B: no ticket yet — auto-push if this is a WALL_POST board ──
          const workspace = await prisma.workspace.findUnique({
            where: { id: spaceId },
            select: { organizationId: true, templateType: true },
          });

          if (workspace?.templateType === 'WALL_POST' && workspace.organizationId) {
            const orgId = workspace.organizationId;

            // Resolve model / profile info from board item metadata
            let profileId: string | null =
              (meta.profileId as string) || (meta.modelId as string) || null;
            let modelName = (meta.model as string) || 'Unknown Model';
            let modelAvatar = modelName.substring(0, 2).toUpperCase();
            let profileImageUrl = (meta.profileImageUrl as string) || null;

            if (profileId) {
              const profile = await prisma.instagramProfile.findUnique({
                where: { id: profileId },
                select: { name: true, profileImageUrl: true },
              });
              if (profile) {
                modelName = profile.name || modelName;
                modelAvatar = modelName.substring(0, 2).toUpperCase();
                profileImageUrl = profile.profileImageUrl || profileImageUrl;
              }
            }

            if (!profileId && modelName !== 'Unknown Model') {
              const profileByName = await prisma.instagramProfile.findFirst({
                where: {
                  name: { equals: modelName, mode: 'insensitive' },
                  organizationId: orgId,
                },
                select: { id: true, name: true, profileImageUrl: true },
              });
              if (profileByName) {
                profileId = profileByName.id;
                modelName = profileByName.name;
                modelAvatar = profileByName.name.substring(0, 2).toUpperCase();
                profileImageUrl = profileByName.profileImageUrl || profileImageUrl;
              }
            }

            const newTicket = await prisma.$transaction(async (tx) => {
              const created = await tx.captionQueueTicket.create({
                data: {
                  clerkId: userId,
                  organizationId: orgId,
                  profileId,
                  modelName,
                  modelAvatar,
                  profileImageUrl,
                  description:
                    (meta.description as string) ||
                    `Wall Post caption for ${modelName}`,
                  contentTypes: [fileType ?? 'image'],
                  messageTypes: ['wall_post'],
                  urgency: 'medium',
                  releaseDate: new Date(),
                  status: 'pending',
                  boardItemId: itemId,
                  // workflowType defaults to 'wall_post' in the schema
                },
              });

              // First content item (this file)
              await tx.captionQueueContentItem.create({
                data: {
                  ticketId: created.id,
                  url: body.url,
                  sourceType: 'upload',
                  fileName: body.name ?? null,
                  fileType,
                  sortOrder: 0,
                  requiresCaption: true,
                  captionStatus: 'pending',
                },
              });

              // Update board item metadata with ticket link + new status
              await tx.boardItem.update({
                where: { id: itemId },
                data: {
                  metadata: {
                    ...meta,
                    captionTicketId: created.id,
                    captionStatus: 'pending',
                    wallPostStatus: WALL_POST_STATUS.IN_CAPTION,
                  } as unknown as Prisma.InputJsonValue,
                  updatedAt: new Date(),
                },
              });

              return created;
            });

            // Real-time broadcast so Caption Workspace + board UI update
            try {
              const { broadcastToOrg, broadcastToBoard } = await import('@/lib/ably-server');
              await broadcastToOrg(orgId, {
                type: 'NEW_TICKET',
                ticketId: newTicket.id,
                orgId,
                senderClerkId: userId,
                assignedCreatorClerkIds: [],
                workflowType: 'wall_post',
              });
              await broadcastToBoard(boardId, itemId);
            } catch (_) {
              // Non-fatal
            }
          }
        }
      } catch (syncErr) {
        // Non-fatal – don't block the media record response
        console.error('Failed to sync media to caption queue:', syncErr);
      }

      return NextResponse.json(media, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in board item media:', error);
    return NextResponse.json({ error: 'Failed to process media request' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE /api/spaces/:spaceId/boards/:boardId/items/:itemId/media    */
/*                                                                     */
/*  Body: { mediaId: string }                                          */
/*  Deletes the BoardItemMedia row AND the file from S3.               */
/* ------------------------------------------------------------------ */

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { itemId } = await params;
    const body = await req.json().catch(() => null);

    if (!body?.mediaId) {
      return NextResponse.json({ error: 'mediaId is required' }, { status: 400 });
    }

    // Find the media record (ensure it belongs to this item)
    const media = await prisma.boardItemMedia.findFirst({
      where: { id: body.mediaId, itemId },
    });

    if (!media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Delete from S3
    const s3Key = extractS3Key(media.url);
    if (s3Key) {
      await deleteFromS3(s3Key);
    }

    // Delete from database
    await prisma.boardItemMedia.delete({ where: { id: media.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting board item media:', error);
    return NextResponse.json({ error: 'Failed to delete media' }, { status: 500 });
  }
}
