import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/**
 * Create a new onboarding invitation link
 * POST /api/onboarding-invitations
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      email,
      modelName,
      notes,
      expiresInDays = 7,
      maxUses = 1,
    } = body;

    // Calculate expiration date
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const invitation = await prisma.onboardingInvitation.create({
      data: {
        email,
        modelName,
        notes,
        expiresAt,
        maxUses,
        createdByClerkId: userId,
      },
    });

    // Generate the public URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const invitationUrl = `${baseUrl}/onboarding/public?token=${invitation.token}`;

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        token: invitation.token,
        url: invitationUrl,
        email: invitation.email,
        modelName: invitation.modelName,
        expiresAt: invitation.expiresAt,
        maxUses: invitation.maxUses,
        usedCount: invitation.usedCount,
        isActive: invitation.isActive,
        createdAt: invitation.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}

/**
 * List all invitations created by the current user
 * GET /api/onboarding-invitations
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: any = {
      createdByClerkId: userId,
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    const invitations = await prisma.onboardingInvitation.findMany({
      where,
      include: {
        _count: {
          select: {
            drafts: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Generate URLs for each invitation
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const invitationsWithUrls = invitations.map((inv) => ({
      ...inv,
      url: `${baseUrl}/onboarding/public?token=${inv.token}`,
      draftsCount: inv._count.drafts,
    }));

    return NextResponse.json(invitationsWithUrls);
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    );
  }
}
