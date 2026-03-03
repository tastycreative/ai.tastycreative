import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { canCreateQueue, type OrgRole } from '@/lib/rbac';
import { broadcastToOrg, broadcastToBoard } from '@/lib/ably-server';
import {
  OTP_PTR_CAPTION_STATUS,
  parseDriveLink,
} from '@/lib/otp-ptr-caption-status';

/**
 * POST /api/caption-queue/from-otp-ptr-item
 *
 * Atomically pushes an OTP/PTR board item to the Caption Workspace.
 *
 * Key differences from the Wall Post flow:
 *  - workflowType = 'otp_ptr'
 *  - A single ticket-level caption is expected (not per-item)
 *  - Content items are created from the Google Drive link (display-only,
 *    requiresCaption = false — the Drive link serves as context)
 *  - board item metadata uses `otpPtrCaptionStatus` instead of `wallPostStatus`
 *
 * Body:
 *   boardItemId              – required
 *   assignedCreatorClerkIds  – optional string[], creators to assign
 *   urgency                  – optional, defaults to 'medium'
 *   releaseDate              – optional, defaults to now
 *   description              – optional
 */

async function resolveUserContext(clerkId: string) {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, currentOrganizationId: true },
  });
  if (!user) return null;

  const membership = user.currentOrganizationId
    ? await prisma.teamMember.findFirst({
        where: { userId: user.id, organizationId: user.currentOrganizationId },
        select: { role: true },
      })
    : null;

  return {
    userId: user.id,
    clerkId,
    organizationId: user.currentOrganizationId ?? null,
    role: (membership?.role ?? null) as OrgRole | null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await resolveUserContext(clerkId);
    if (!ctx) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!ctx.organizationId || !canCreateQueue(ctx.role)) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Only Owners, Admins, and Managers can push to Caption Workspace',
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      boardItemId,
      assignedCreatorClerkIds = [] as string[],
      urgency = 'medium',
      releaseDate,
      description: bodyDescription,
    } = body;

    if (!boardItemId) {
      return NextResponse.json(
        { error: 'boardItemId is required' },
        { status: 400 },
      );
    }

    // ── Fetch board item ──────────────────────────────────────────────
    const boardItem = await prisma.boardItem.findUnique({
      where: { id: boardItemId },
      include: {
        column: { select: { boardId: true } },
      },
    });

    if (!boardItem) {
      return NextResponse.json(
        { error: 'Board item not found' },
        { status: 404 },
      );
    }

    if (boardItem.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const metadata = (boardItem.metadata as Record<string, unknown>) ?? {};

    // ── Idempotency: prevent duplicate pushes ─────────────────────────
    if (metadata.captionTicketId) {
      const existingTicket = await prisma.captionQueueTicket.findUnique({
        where: { id: metadata.captionTicketId as string },
        select: { id: true, status: true, workflowType: true },
      });
      if (existingTicket) {
        return NextResponse.json(
          {
            error: 'This OTP/PTR ticket already has an active caption ticket',
            ticketId: existingTicket.id,
            ticketStatus: existingTicket.status,
          },
          { status: 409 },
        );
      }
      // Ticket was deleted — allow re-push
    }

    // ── Parse & validate Google Drive link ───────────────────────────
    const driveLink = (metadata.driveLink as string) || '';
    const parsedDrive = driveLink ? parseDriveLink(driveLink) : null;

    // ── Validate assignees ────────────────────────────────────────────
    if ((assignedCreatorClerkIds as string[]).length > 0) {
      const assigneeUsers = await prisma.user.findMany({
        where: { clerkId: { in: assignedCreatorClerkIds } },
        select: { id: true },
      });

      const validCreatorCount = await prisma.teamMember.count({
        where: {
          organizationId: ctx.organizationId,
          role: 'CREATOR',
          userId: { in: assigneeUsers.map((u) => u.id) },
        },
      });

      if (validCreatorCount !== assigneeUsers.length) {
        return NextResponse.json(
          {
            error:
              'One or more assignees are not CREATOR-role members of this organization',
          },
          { status: 400 },
        );
      }
    }

    // ── Resolve model / profile info ─────────────────────────────────
    let profileId: string | null =
      (metadata.profileId as string) ||
      (metadata.modelId as string) ||
      null;
    let resolvedModelName =
      (metadata.model as string) || boardItem.title || 'Unknown Model';
    let resolvedAvatar = resolvedModelName.substring(0, 2).toUpperCase();
    let resolvedImageUrl = (metadata.profileImageUrl as string) || null;

    if (profileId) {
      const profile = await prisma.instagramProfile.findUnique({
        where: { id: profileId },
        select: { name: true, profileImageUrl: true },
      });
      if (profile) {
        resolvedModelName = profile.name || resolvedModelName;
        resolvedAvatar = resolvedModelName.substring(0, 2).toUpperCase();
        resolvedImageUrl = profile.profileImageUrl || resolvedImageUrl;
      }
    }

    if (
      !profileId &&
      resolvedModelName !== 'Unknown Model' &&
      ctx.organizationId
    ) {
      const profileByName = await prisma.instagramProfile.findFirst({
        where: {
          name: { equals: resolvedModelName, mode: 'insensitive' },
          organizationId: ctx.organizationId,
        },
        select: { id: true, name: true, profileImageUrl: true },
      });
      if (profileByName) {
        profileId = profileByName.id;
        resolvedModelName = profileByName.name;
        resolvedAvatar = profileByName.name.substring(0, 2).toUpperCase();
        resolvedImageUrl =
          profileByName.profileImageUrl || resolvedImageUrl;
      }
    }

    const modelName = resolvedModelName;
    const modelAvatar = resolvedAvatar;
    const profileImageUrl = resolvedImageUrl;

    const description =
      bodyDescription ||
      (metadata.description as string) ||
      boardItem.description ||
      `OTP/PTR caption for ${modelName}`;

    const messageTypes = ['otp_ptr'];
    const contentTypes = (metadata.contentType as string)
      ? [(metadata.contentType as string)]
      : ['content'];

    // ── Atomic transaction ────────────────────────────────────────────
    const ticket = await prisma.$transaction(async (tx) => {
      // 1. Create caption ticket (workflowType = 'otp_ptr')
      const newTicket = await tx.captionQueueTicket.create({
        data: {
          clerkId,
          organizationId: ctx.organizationId!,
          profileId,
          modelName,
          modelAvatar,
          profileImageUrl,
          description,
          contentTypes,
          messageTypes,
          urgency,
          releaseDate: releaseDate ? new Date(releaseDate) : new Date(),
          status: 'pending',
          boardItemId,
          workflowType: 'otp_ptr',
          // Store the raw drive link for reference in the workspace
          contentUrl: driveLink || null,
          contentSourceType: parsedDrive ? 'gdrive' : null,
        },
      });

      // 2. Assign creators
      if ((assignedCreatorClerkIds as string[]).length > 0) {
        await tx.captionQueueAssignee.createMany({
          data: (assignedCreatorClerkIds as string[]).map((cId: string) => ({
            ticketId: newTicket.id,
            clerkId: cId,
          })),
        });
      }

      // 3. Create a single content item representing the Drive link.
      //    requiresCaption = false — the captioner writes ONE ticket-level
      //    caption; these items are display-only context.
      if (driveLink) {
        await tx.captionQueueContentItem.create({
          data: {
            ticketId: newTicket.id,
            url: driveLink,
            sourceType: 'gdrive',
            fileName: parsedDrive
              ? parsedDrive.type === 'folder'
                ? 'Google Drive Folder'
                : 'Google Drive File'
              : 'Google Drive Link',
            fileType: null,
            sortOrder: 0,
            requiresCaption: false,
            captionStatus: 'not_required',
          },
        });
      }

      // 4. Update board item metadata with status + ticket link
      const prevMeta = (boardItem.metadata as Record<string, unknown>) ?? {};
      await tx.boardItem.update({
        where: { id: boardItemId },
        data: {
          metadata: {
            ...prevMeta,
            captionTicketId: newTicket.id,
            captionStatus: 'pending',
            otpPtrCaptionStatus: OTP_PTR_CAPTION_STATUS.IN_CAPTION,
          },
          updatedAt: new Date(),
        },
      });

      // Return full ticket with relations
      return tx.captionQueueTicket.findUnique({
        where: { id: newTicket.id },
        include: {
          assignees: { select: { clerkId: true } },
          contentItems: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              url: true,
              sourceType: true,
              fileName: true,
              fileType: true,
              sortOrder: true,
              captionText: true,
              requiresCaption: true,
              captionStatus: true,
              qaRejectionReason: true,
              revisionCount: true,
            },
          },
        },
      });
    });

    // ── Real-time broadcasts ──────────────────────────────────────────
    if (ticket && ctx.organizationId) {
      await broadcastToOrg(ctx.organizationId, {
        type: 'NEW_TICKET',
        ticketId: ticket.id,
        orgId: ctx.organizationId,
        senderClerkId: clerkId,
        assignedCreatorClerkIds: ticket.assignees.map((a) => a.clerkId),
      });

      const boardId = boardItem.column?.boardId;
      if (boardId) {
        await broadcastToBoard(boardId, boardItemId);
      }
    }

    return NextResponse.json(
      {
        item: ticket,
        boardItemId,
        otpPtrCaptionStatus: OTP_PTR_CAPTION_STATUS.IN_CAPTION,
        driveLink: driveLink || null,
        driveLinkType: parsedDrive?.type ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error pushing OTP/PTR board item to caption queue:', error);
    return NextResponse.json(
      { error: 'Failed to push to Caption Workspace' },
      { status: 500 },
    );
  }
}
