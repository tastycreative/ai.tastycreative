import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/**
 * GET /api/scheduler/captions
 *
 * Returns captions from CaptionQueueTickets for a given profile.
 * Used by the scheduler caption picker to show workspace captions.
 *
 * Query params:
 *  - profileId (required): Instagram profile ID
 *  - search: text search in captionText
 */
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');
    const search = searchParams.get('search');

    if (!profileId) {
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
    }

    // Fetch caption queue tickets that have captionText for this profile
    const where: Record<string, unknown> = {
      profileId,
      organizationId: user.currentOrganizationId,
      captionText: { not: null },
    };

    if (search) {
      where.captionText = { contains: search, mode: 'insensitive', not: null };
    }

    const tickets = await prisma.captionQueueTicket.findMany({
      where,
      select: {
        id: true,
        captionText: true,
        modelName: true,
        status: true,
        contentSourceType: true,
        workflowType: true,
        contentTypes: true,
        messageTypes: true,
        profileId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    // Transform to a shape the caption picker can use
    const captions = tickets
      .filter((t) => t.captionText && t.captionText.trim().length > 0)
      .map((t) => ({
        id: t.id,
        caption: t.captionText!,
        captionCategory: t.workflowType || 'general',
        captionTypes: t.contentTypes?.join(',') || '',
        profileId: t.profileId || '',
        status: t.status,
        workflowType: t.workflowType,
        contentTypes: t.contentTypes || [],
        messageTypes: t.messageTypes || [],
        usageCount: 0,
        tags: null as string | null,
        createdAt: t.createdAt.toISOString(),
      }));

    return NextResponse.json(captions);
  } catch (error) {
    console.error('Error fetching scheduler captions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch captions' },
      { status: 500 },
    );
  }
}
