import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/**
 * GET /api/notifications - Get notifications for current user scoped to their active organization
 * Query params:
 *   - unreadOnly: boolean - Only return unread notifications
 *   - limit: number - Max notifications to return (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, email: true, role: true, currentOrganizationId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Sync pending org invitations as notifications (Case 1: user signed up after invite)
    try {
      if (user.email) {
        const pendingInvites = await prisma.organizationInvite.findMany({
          where: {
            email: user.email.toLowerCase(),
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
          include: {
            organization: { select: { name: true } },
          },
        });

        if (pendingInvites.length > 0) {
          // Find which invites already have notifications
          const existingNotifications = await prisma.notification.findMany({
            where: {
              userId: user.id,
              type: 'ORG_INVITATION',
            },
            select: { metadata: true },
          });

          const existingInviteIds = new Set(
            existingNotifications
              .map((n) => (n.metadata as any)?.inviteId)
              .filter(Boolean)
          );

          // Create notifications for invites that don't have one yet
          const newInviteNotifications = pendingInvites.filter(
            (inv) => !existingInviteIds.has(inv.id)
          );

          if (newInviteNotifications.length > 0) {
            await prisma.notification.createMany({
              data: newInviteNotifications.map((inv) => ({
                userId: user.id,
                type: 'ORG_INVITATION' as const,
                title: `You've been invited to ${inv.organization.name}`,
                message: `You have a pending invitation to join ${inv.organization.name} as a ${inv.role}`,
                link: `/invite/${inv.token}`,
                metadata: { inviteId: inv.id },
                organizationId: null,
              })),
            });
          }
        }
      }
    } catch (syncError) {
      // Non-fatal: sync failure shouldn't break notification fetch
      console.error('Error syncing invite notifications:', syncError);
    }

    const searchParams = request.nextUrl.searchParams;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    // Filter by current org (also include notifications with no org for backwards compat)
    const orgFilter = user.currentOrganizationId
      ? { OR: [{ organizationId: user.currentOrganizationId }, { organizationId: null }] }
      : {};

    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        ...orgFilter,
        ...(unreadOnly && { read: false }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: user.id,
        ...orgFilter,
        read: false,
      },
    });

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/notifications - Mark notification(s) as read
 * Body: { notificationId?: string, markAllRead?: boolean }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, currentOrganizationId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { notificationId, markAllRead } = body;

    // Scope "mark all" to current org
    const orgFilter = user.currentOrganizationId
      ? { OR: [{ organizationId: user.currentOrganizationId }, { organizationId: null }] }
      : {};

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          ...orgFilter,
          read: false,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    } else if (notificationId) {
      const notification = await prisma.notification.update({
        where: {
          id: notificationId,
          userId: user.id,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, notification });
    } else {
      return NextResponse.json(
        { error: 'Must provide notificationId or markAllRead' },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 },
    );
  }
}
