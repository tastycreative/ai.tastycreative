import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { headers } from 'next/headers';

/**
 * Create a public onboarding draft (no auth required, token-based)
 * POST /api/onboarding-public/drafts
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, ...draftData } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    // Validate the token
    const invitation = await prisma.onboardingInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 404 }
      );
    }

    if (!invitation.isActive) {
      return NextResponse.json(
        { error: 'This invitation link has been deactivated' },
        { status: 403 }
      );
    }

    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'This invitation link has expired' },
        { status: 403 }
      );
    }

    if (invitation.usedCount >= invitation.maxUses) {
      return NextResponse.json(
        { error: 'This invitation link has reached its usage limit' },
        { status: 403 }
      );
    }

    // Get IP address for tracking
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for') || 
               headersList.get('x-real-ip') || 
               'unknown';

    // Create the draft
    const draft = await prisma.modelOnboardingDraft.create({
      data: {
        ...draftData,
        createdByClerkId: invitation.createdByClerkId,
        invitationId: invitation.id,
        isPublicSubmission: true,
        submitterIp: ip,
        clerkId: null, // No user account
        status: 'DRAFT',
        currentStep: 1,
        completionPercentage: 0,
      },
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error('Error creating public draft:', error);
    return NextResponse.json(
      { error: 'Failed to create draft' },
      { status: 500 }
    );
  }
}
