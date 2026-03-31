import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { canManageQueue, type OrgRole } from '@/lib/rbac';

/**
 * GET /api/qa-queue/scheduler
 *
 * Fetch scheduler tasks with captionQAStatus = 'sent_to_qa'.
 * Returns items shaped for the QA workspace queue panel.
 */
export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, currentOrganizationId: true },
    });

    if (!user || !user.currentOrganizationId) {
      return NextResponse.json({ error: 'No organization context' }, { status: 403 });
    }

    const orgId = user.currentOrganizationId;

    // Permission check — same as content QA
    const membership = await prisma.teamMember.findFirst({
      where: { userId: user.id, organizationId: orgId },
      select: { role: true },
    });
    const role = (membership?.role ?? null) as OrgRole | null;
    if (!canManageQueue(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Query scheduler tasks where fields->captionQAStatus = 'sent_to_qa'
    // Using raw query since Prisma doesn't support JSON field filtering well on all DBs
    const tasks = await prisma.schedulerTask.findMany({
      where: {
        organizationId: orgId,
        fields: {
          path: ['captionQAStatus'],
          equals: 'sent_to_qa',
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Collect profile IDs for enrichment
    const profileIds = [...new Set(tasks.map((t) => t.profileId).filter(Boolean))] as string[];

    const profiles = profileIds.length > 0
      ? await prisma.instagramProfile.findMany({
          where: {
            id: { in: profileIds },
            organizationId: orgId,
          },
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
            pageStrategy: true,
            modelBible: true,
          },
        })
      : [];

    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    // Build response items
    const items = tasks.map((task) => {
      const fields = (task.fields ?? {}) as Record<string, unknown>;
      const profile = task.profileId ? profileMap.get(task.profileId) : null;

      // Compute task date from weekStartDate + dayOfWeek
      const wsDate = task.weekStartDate instanceof Date
        ? task.weekStartDate
        : new Date(String(task.weekStartDate).split('T')[0] + 'T00:00:00Z');
      const taskDate = new Date(wsDate);
      taskDate.setUTCDate(taskDate.getUTCDate() + task.dayOfWeek);

      return {
        id: task.id,
        source: 'scheduler' as const,
        taskType: task.taskType,
        slotLabel: task.slotLabel,
        platform: task.platform,
        profileId: task.profileId,
        profileName: profile?.name ?? 'Unknown',
        profileImage: profile?.profileImageUrl ?? null,
        caption: (fields.captionBankText as string) || (fields.caption as string) || '',
        previousCaption: (fields._previousCaption as string) || undefined,
        taskDate: taskDate.toISOString().split('T')[0],
        weekStartDate: String(task.weekStartDate).split('T')[0],
        dayOfWeek: task.dayOfWeek,
        fields,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        modelProfile: profile
          ? {
              id: profile.id,
              name: profile.name,
              profileImageUrl: profile.profileImageUrl,
              pageStrategy: profile.pageStrategy,
              modelBible: profile.modelBible,
            }
          : null,
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('[QA Queue Scheduler GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
