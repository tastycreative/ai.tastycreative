import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

type Params = {
  params: Promise<{ spaceId: string; boardId: string; itemId: string }>;
};

/* ------------------------------------------------------------------ */
/*  GET .../items/:itemId/history                                      */
/* ------------------------------------------------------------------ */

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { itemId } = await params;

    const history = await prisma.boardItemHistory.findMany({
      where: { itemId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Collect unique user IDs
    const userIds = [...new Set(history.map((h) => h.userId))];

    // Fetch user information for all unique user IDs
    const users = await prisma.user.findMany({
      where: { clerkId: { in: userIds } },
      select: { clerkId: true, firstName: true, lastName: true, email: true },
    });

    // Create a map of userId -> display name
    const userMap = new Map(
      users.map((u) => {
        const displayName = u.firstName && u.lastName
          ? `${u.firstName} ${u.lastName}`
          : u.firstName || u.lastName || u.email || 'Unknown User';
        return [u.clerkId, displayName];
      })
    );

    // Fields to hide from history (internal/noise)
    const isHiddenField = (field: string): boolean => {
      if (field === 'position') return true;
      const key = field.startsWith('metadata.') ? field.slice(9) : field;
      if (key.startsWith('_')) return true;
      if (key === 'fieldOrder' || key === 'fields') return true;
      // Hide internal IDs (captionTicketId, modelId, etc.) — not meaningful to users
      if (/Id$/.test(key) && key !== 'columnId' && key !== 'assigneeId') return true;
      return false;
    };

    // Humanize UPPER_SNAKE_CASE / snake_case → "Title Case"
    const humanizeStatus = (val: string): string =>
      val
        .split(/[_\s]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

    // Clean up raw history values (fixes legacy & current data)
    const formatValue = (field: string, val: string | null): string | null => {
      if (val == null || val === '') return null;
      // [object Object] from legacy String() on arrays
      if (val.includes('[object Object]')) {
        const count = val.split('[object Object]').length - 1;
        return `${count} item${count !== 1 ? 's' : ''}`;
      }
      // Clerk user IDs → resolve from userMap or show generic
      if (/^user_[a-zA-Z0-9]+$/.test(val)) {
        return userMap.get(val) || 'a user';
      }
      // ISO date strings → readable format
      if (/^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/.test(val)) {
        try {
          return new Date(val).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit',
          });
        } catch { return val; }
      }
      // UPPER_SNAKE_CASE status values (PENDING_CAPTION, COMPLETED, etc.)
      if (/^[A-Z][A-Z0-9_]+$/.test(val)) {
        return humanizeStatus(val);
      }
      // snake_case status values on status-like fields (in_progress, pending_qa, etc.)
      const fieldKey = field.startsWith('metadata.') ? field.slice(9) : field;
      if (/^[a-z][a-z0-9_]+$/.test(val) && (fieldKey.toLowerCase().includes('status') || fieldKey === 'captionStatus' || fieldKey === 'priority')) {
        return humanizeStatus(val);
      }
      // Boolean strings
      if (val === 'true') return 'Yes';
      if (val === 'false') return 'No';
      // Prisma cuid IDs — not useful to show
      if (/^c[a-z0-9]{20,}$/.test(val)) return null;
      return val;
    };

    const filtered = history.filter((h) => !isHiddenField(h.field));

    return NextResponse.json({
      history: filtered.map((h) => ({
        id: h.id,
        action: h.action,
        field: h.field,
        oldValue: formatValue(h.field, h.oldValue),
        newValue: formatValue(h.field, h.newValue),
        userId: h.userId,
        userName: userMap.get(h.userId) || 'Unknown User',
        createdAt: h.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
