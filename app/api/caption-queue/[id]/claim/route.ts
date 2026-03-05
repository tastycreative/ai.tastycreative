import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { canViewQueue, isCreatorRole, type OrgRole } from '@/lib/rbac';
import { broadcastToOrg } from '@/lib/ably-server';

const CLAIM_TTL_MS = 30 * 60 * 1000; // 30 minutes

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

// ---------------------------------------------------------------------------
// POST /api/caption-queue/[id]/claim
// Atomically claim a ticket. Returns 409 if already claimed by someone else.
// ---------------------------------------------------------------------------
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const ctx = await resolveUserContext(clerkId);
    if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!ctx.organizationId || !canViewQueue(ctx.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!isCreatorRole(ctx.role)) {
      return NextResponse.json(
        { error: 'Only users with the CREATOR role can claim tickets' },
        { status: 403 },
      );
    }

    const expiredBefore = new Date(Date.now() - CLAIM_TTL_MS);

    // Single atomic UPDATE — only succeeds if ticket is unclaimed or the previous claim expired.
    // The database applies row-level locking, so concurrent callers cannot both succeed.
    const result = await prisma.captionQueueTicket.updateMany({
      where: {
        id,
        organizationId: ctx.organizationId,
        OR: [
          { claimedBy: null },
          { claimedAt: { lt: expiredBefore } },
        ],
      },
      data: {
        claimedBy: clerkId,
        claimedAt: new Date(),
      },
    });

    if (result.count === 0) {
      // Check if already claimed by self (idempotent: extend instead)
      const existing = await prisma.captionQueueTicket.findFirst({
        where: { id, organizationId: ctx.organizationId, claimedBy: clerkId },
        select: { id: true, claimedBy: true, claimedAt: true },
      });
      if (existing) {
        // Extend TTL
        const extended = await prisma.captionQueueTicket.update({
          where: { id },
          data: { claimedAt: new Date() },
          select: { id: true, claimedBy: true, claimedAt: true },
        });
        return NextResponse.json({ ticket: extended });
      }
      return NextResponse.json(
        { error: 'Ticket is already claimed by another user' },
        { status: 409 },
      );
    }

    // Broadcast so every other connected client refreshes their queue
    await broadcastToOrg(ctx.organizationId, {
      type: 'TICKET_CLAIMED',
      ticketId: id,
      claimedBy: clerkId,
      senderClerkId: clerkId,
    });

    const updated = await prisma.captionQueueTicket.findUnique({
      where: { id },
      select: { id: true, claimedBy: true, claimedAt: true },
    });
    return NextResponse.json({ ticket: updated });
  } catch (err) {
    console.error('[claim] Error claiming ticket:', err);
    return NextResponse.json({ error: 'Failed to claim ticket' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/caption-queue/[id]/claim
// Heartbeat: extend the TTL of an active claim (called every ~5 min while editing).
// ---------------------------------------------------------------------------
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const ctx = await resolveUserContext(clerkId);
    if (!ctx || !ctx.organizationId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const result = await prisma.captionQueueTicket.updateMany({
      where: { id, organizationId: ctx.organizationId, claimedBy: clerkId },
      data: { claimedAt: new Date() },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Ticket not found or not claimed by you' },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[claim] Error extending claim:', err);
    return NextResponse.json({ error: 'Failed to extend claim' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/caption-queue/[id]/claim
// Release the claim (e.g. when user navigates away or explicitly un-claims).
// ---------------------------------------------------------------------------
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const ctx = await resolveUserContext(clerkId);
    if (!ctx || !ctx.organizationId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await prisma.captionQueueTicket.updateMany({
      where: { id, organizationId: ctx.organizationId, claimedBy: clerkId },
      data: { claimedBy: null, claimedAt: null },
    });

    await broadcastToOrg(ctx.organizationId, {
      type: 'TICKET_UNCLAIMED',
      ticketId: id,
      senderClerkId: clerkId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[claim] Error releasing claim:', err);
    return NextResponse.json({ error: 'Failed to release claim' }, { status: 500 });
  }
}
