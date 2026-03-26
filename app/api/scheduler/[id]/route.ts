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

  // Allow flag-only field changes on locked tasks
  const isFlagChangeOnly = fields !== undefined &&
    Object.keys(body).filter((k) => !['tabId', 'fields', 'mergeFields'].includes(k)).length === 0 &&
    (() => {
      const oldFields = (oldTask.fields || {}) as Record<string, unknown>;
      const newFields = fields as Record<string, unknown>;
      const allKeys = new Set([...Object.keys(oldFields), ...Object.keys(newFields)]);
      for (const key of allKeys) {
        if (key === 'flagged') continue;
        if (String(oldFields[key] ?? '') !== String(newFields[key] ?? '')) return false;
      }
      return true;
    })();

  if (isLocked && !isStatusChangeOnly && !isFlagChangeOnly) {
    return NextResponse.json(
      { error: 'Task is locked. Queue an update for a future week.' },
      { status: 409 },
    );
  }

  // Merge fields: if `mergeFields` is true, shallow-merge incoming fields into
  // existing fields instead of replacing. This prevents rapid concurrent updates
  // (e.g. flagging multiple tasks quickly) from overwriting each other.
  const mergeFields = body.mergeFields === true;
  let resolvedFields = fields;
  if (fields !== undefined && mergeFields) {
    const existingFields = (oldTask.fields as Record<string, unknown>) || {};
    resolvedFields = { ...existingFields, ...fields };
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
      ...(resolvedFields !== undefined && { fields: resolvedFields }),
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

  // ── Auto-create gallery item when status transitions to DONE ──
  if (status === 'DONE' && oldTask.status !== 'DONE') {
    try {
      const { buildGalleryItemFromTask } = await import(
        '@/lib/scheduler/gallery-integration'
      );
      const galleryPayload = buildGalleryItemFromTask(
        {
          id: task.id,
          organizationId: orgId,
          taskType: task.taskType,
          taskName: task.taskName,
          platform: task.platform,
          profileId: task.profileId,
          endTime: task.endTime?.toISOString() ?? null,
          fields: task.fields as Record<string, string> | null,
        },
        userId,
      );

      if (galleryPayload) {
        // Unique constraint on schedulerTaskId prevents duplicates
        await prisma.gallery_items.create({ data: galleryPayload });
      }
    } catch (galleryErr) {
      // P2002 = unique constraint violation (gallery item already exists) — safe to ignore
      const prismaErr = galleryErr as { code?: string };
      if (prismaErr.code !== 'P2002') {
        console.error('[scheduler] Failed to create gallery item on DONE:', { taskId: task.id, orgId, taskType: task.taskType }, galleryErr);
      }
    }
  }

  // ── Remove gallery item if status reverts from DONE ──
  if (oldTask.status === 'DONE' && status !== undefined && status !== 'DONE') {
    try {
      await prisma.gallery_items.deleteMany({
        where: { schedulerTaskId: task.id },
      });
    } catch (cleanupErr) {
      console.error('[scheduler] Failed to remove gallery item on status revert:', { taskId: task.id, orgId }, cleanupErr);
    }
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

  // Clean up linked gallery item before deleting the task
  await prisma.gallery_items.deleteMany({
    where: { schedulerTaskId: id },
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
