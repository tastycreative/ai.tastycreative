import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { broadcastToScheduler } from '@/lib/ably-server';
import { diffTaskChanges } from '@/lib/scheduler/history-utils';
import { getSchedulerTodayKey } from '@/lib/scheduler/rotation';

// PATCH /api/scheduler/[id] — update a task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, currentOrganizationId: true, name: true },
  });
  if (!user?.currentOrganizationId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 });
  }

  const orgId = user.currentOrganizationId;

  const member = await prisma.teamMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!member || !['OWNER', 'ADMIN', 'MANAGER'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { taskName, taskType, status, startTime, endTime, notes, fields, sortOrder, tabId } = body;

  // Fetch current state before update for history diffing
  const oldTask = await prisma.schedulerTask.findUnique({
    where: { id, organizationId: orgId },
  });
  if (!oldTask) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // ── Edit locking: tasks in the past cannot be edited (except status changes to DONE/SKIPPED) ──
  const schedulerToday = getSchedulerTodayKey();
  const wsDate = oldTask.weekStartDate instanceof Date
    ? oldTask.weekStartDate
    : new Date(String(oldTask.weekStartDate).split('T')[0] + 'T00:00:00Z');
  const taskDate = new Date(wsDate);
  taskDate.setUTCDate(taskDate.getUTCDate() + oldTask.dayOfWeek);
  const taskDateKey = taskDate.toISOString().split('T')[0];

  const isLocked = taskDateKey < schedulerToday;
  const isStatusChangeOnly = status !== undefined &&
    ['DONE', 'SKIPPED'].includes(status) &&
    Object.keys(body).filter((k) => !['tabId', 'status'].includes(k)).length === 0;

  if (isLocked && !isStatusChangeOnly) {
    return NextResponse.json(
      { error: 'Task is locked. Queue an update for a future week.' },
      { status: 409 },
    );
  }

  const task = await prisma.schedulerTask.update({
    where: { id, organizationId: orgId },
    data: {
      ...(taskName !== undefined && { taskName }),
      ...(taskType !== undefined && { taskType }),
      ...(status !== undefined && { status }),
      ...(startTime !== undefined && { startTime: startTime ? new Date(startTime) : null }),
      ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
      ...(notes !== undefined && { notes }),
      ...(fields !== undefined && { fields }),
      ...(sortOrder !== undefined && { sortOrder }),
      updatedBy: user.name || userId,
    },
  });

  // Record activity + field-level history
  const changes = diffTaskChanges(
    oldTask as unknown as Record<string, unknown>,
    body,
    user.id,
    task.id,
  );

  const hasStatusChange = changes.some((c) => c.field === 'status');
  const activityLog = await prisma.schedulerActivityLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      taskId: task.id,
      action: hasStatusChange ? 'STATUS_CHANGED' : 'UPDATED',
      summary: `Updated ${task.slotLabel} on day ${task.dayOfWeek}`,
    },
  });

  if (changes.length > 0) {
    await prisma.schedulerTaskHistory.createMany({
      data: changes.map((c) => ({
        taskId: task.id,
        userId: user.id,
        action: c.action,
        field: c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
        activityLogId: activityLog.id,
      })),
    });
  }

  // Broadcast real-time update
  await broadcastToScheduler(orgId, {
    type: 'task.updated',
    taskId: task.id,
    dayOfWeek: task.dayOfWeek,
    slotLabel: task.slotLabel,
    tabId: tabId || '__server__',
  });

  return NextResponse.json(task);
}

// DELETE /api/scheduler/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, currentOrganizationId: true },
  });
  if (!user?.currentOrganizationId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 });
  }

  const orgId = user.currentOrganizationId;

  const member = await prisma.teamMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!member || !['OWNER', 'ADMIN', 'MANAGER'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  // Fetch task info before deleting for activity log
  const taskToDelete = await prisma.schedulerTask.findUnique({
    where: { id, organizationId: orgId },
    select: { slotLabel: true, dayOfWeek: true, taskType: true },
  });

  const task = await prisma.schedulerTask.delete({
    where: { id, organizationId: orgId },
  });

  // Log deletion activity (taskId null since task is deleted)
  await prisma.schedulerActivityLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      taskId: null,
      action: 'DELETED',
      summary: `Deleted ${taskToDelete?.slotLabel || 'task'} (${taskToDelete?.taskType || ''}) on day ${taskToDelete?.dayOfWeek ?? ''}`,
    },
  });

  await broadcastToScheduler(orgId, {
    type: 'task.deleted',
    taskId: id,
    tabId: body.tabId || '__server__',
  });

  return NextResponse.json({ success: true, id: task.id });
}
