import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/**
 * Get a specific invitation
 * GET /api/onboarding-invitations/[invitationId]
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invitationId } = await params;

    const invitation = await prisma.onboardingInvitation.findUnique({
      where: {
        id: invitationId,
        createdByClerkId: userId,
      },
      include: {
        drafts: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            submittedAt: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.json({
      ...invitation,
      url: `${baseUrl}/onboarding/public?token=${invitation.token}`,
    });
  } catch (error) {
    console.error('Error fetching invitation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitation' },
      { status: 500 }
    );
  }
}

/**
 * Update invitation (e.g., revoke/activate)
 * PATCH /api/onboarding-invitations/[invitationId]
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invitationId } = await params;
    const body = await request.json();

    // Check ownership
    const existing = await prisma.onboardingInvitation.findUnique({
      where: {
        id: invitationId,
        createdByClerkId: userId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    const invitation = await prisma.onboardingInvitation.update({
      where: {
        id: invitationId,
      },
      data: {
        email: body.email,
        modelName: body.modelName,
        notes: body.notes,
        isActive: body.isActive,
        maxUses: body.maxUses,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
    });

    return NextResponse.json(invitation);
  } catch (error) {
    console.error('Error updating invitation:', error);
    return NextResponse.json(
      { error: 'Failed to update invitation' },
      { status: 500 }
    );
  }
}

/**
 * Delete invitation
 * DELETE /api/onboarding-invitations/[invitationId]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invitationId } = await params;

    // Check ownership
    const existing = await prisma.onboardingInvitation.findUnique({
      where: {
        id: invitationId,
        createdByClerkId: userId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    await prisma.onboardingInvitation.delete({
      where: {
        id: invitationId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting invitation:', error);
    return NextResponse.json(
      { error: 'Failed to delete invitation' },
      { status: 500 }
    );
  }
}
