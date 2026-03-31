import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { canManageQueue, type OrgRole } from '@/lib/rbac';
import { broadcastToScheduler } from '@/lib/ably-server';

/**
 * PATCH /api/qa-queue/scheduler/[id]/review
 *
 * Approve or reject a scheduler task's caption QA.
 *
 * Body:
 *   action: 'approve' | 'reject'
 *   reason?: string  (optional rejection reason)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, currentOrganizationId: true, name: true, firstName: true, lastName: true },
    });
    if (!user || !user.currentOrganizationId) {
      return NextResponse.json({ error: 'No organization context' }, { status: 403 });
    }
    const orgId = user.currentOrganizationId;

    // Permission check
    const membership = await prisma.teamMember.findFirst({
      where: { userId: user.id, organizationId: orgId },
      select: { role: true },
    });
    if (!canManageQueue((membership?.role ?? null) as OrgRole | null)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body as {
      action: 'approve' | 'reject';
      reason?: string;
    };

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject"' },
        { status: 400 },
      );
    }

    // Fetch the task
    const task = await prisma.schedulerTask.findUnique({
      where: { id, organizationId: orgId },
    });
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const fields = (task.fields ?? {}) as Record<string, unknown>;

    // Resolve reviewer display name
    const rawName = user.name && !user.name.startsWith('user_') ? user.name : null;
    let displayName = rawName || [user.firstName, user.lastName].filter(Boolean).join(' ') || '';
    if (!displayName) {
      const clerkUser = await currentUser();
      displayName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') || clerkId;
    }

    // Build updated fields
    const updatedFields = { ...fields };
    let historyAction: string;

    if (action === 'approve') {
      updatedFields.captionQAStatus = 'approved';
      updatedFields._qaRejectionReason = ''; // Clear any previous rejection reason
      historyAction = 'caption_qa_approved';
    } else {
      updatedFields.captionQAStatus = 'rejected';
      updatedFields.flagged = 'true'; // Re-flag on rejection
      updatedFields._qaRejectionReason = reason || '';
      historyAction = 'caption_qa_rejected';
    }

    // Update the task
    const updatedTask = await prisma.schedulerTask.update({
      where: { id, organizationId: orgId },
      data: {
        fields: updatedFields as any,
        updatedBy: displayName,
      },
    });

    // Record history entries
    const activityLog = await prisma.schedulerActivityLog.create({
      data: {
        organizationId: orgId,
        userId: user.id,
        taskId: task.id,
        action: historyAction.toUpperCase(),
        summary: `Caption QA ${action}ed for ${task.slotLabel}`,
      },
    });

    await prisma.schedulerTaskHistory.create({
      data: {
        taskId: task.id,
        userId: user.id,
        action: historyAction,
        field: 'captionQAStatus',
        oldValue: 'sent_to_qa',
        newValue: action === 'approve' ? 'approved' : 'rejected',
        activityLogId: activityLog.id,
      },
    });

    if (action === 'reject' && reason) {
      await prisma.schedulerTaskHistory.create({
        data: {
          taskId: task.id,
          userId: user.id,
          action: 'caption_qa_rejection_reason',
          field: 'qaRejectionReason',
          oldValue: null,
          newValue: reason,
          activityLogId: activityLog.id,
        },
      });
    }

    // Broadcast real-time update
    try {
      await broadcastToScheduler(orgId, {
        type: 'task.updated',
        taskId: task.id,
        dayOfWeek: task.dayOfWeek,
        slotLabel: task.slotLabel,
        tabId: '__qa_review__',
      });
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      task: updatedTask,
      action,
    });
  } catch (error) {
    console.error('[QA Scheduler Review PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
