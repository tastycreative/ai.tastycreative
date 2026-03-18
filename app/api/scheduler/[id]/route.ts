import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { broadcastToScheduler } from '@/lib/ably-server';

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
  const { taskName, taskType, status, startTime, endTime, notes, tabId } = body;

  const task = await prisma.schedulerTask.update({
    where: { id, organizationId: orgId },
    data: {
      ...(taskName !== undefined && { taskName }),
      ...(taskType !== undefined && { taskType }),
      ...(status !== undefined && { status }),
      ...(startTime !== undefined && { startTime: startTime ? new Date(startTime) : null }),
      ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
      ...(notes !== undefined && { notes }),
      updatedBy: user.name || userId,
    },
  });

  // Log activity
  await prisma.trackerActivityLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      action: 'UPDATED',
      entityType: 'pod-task',
      entityId: task.id,
      entityName: task.slotLabel,
      details: `Updated ${task.slotLabel} on day ${task.dayOfWeek}`,
    },
  });

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

  const task = await prisma.schedulerTask.delete({
    where: { id, organizationId: orgId },
  });

  await broadcastToScheduler(orgId, {
    type: 'task.deleted',
    taskId: id,
    tabId: body.tabId || '__server__',
  });

  return NextResponse.json({ success: true, id: task.id });
}
