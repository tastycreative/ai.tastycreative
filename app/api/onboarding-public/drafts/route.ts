import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { headers } from 'next/headers';

/**
 * Get existing public onboarding draft by token
 * GET /api/onboarding-public/drafts?token=xxx
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

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

    // Find existing draft for this invitation
    const draft = await prisma.modelOnboardingDraft.findFirst({
      where: {
        invitationId: invitation.id,
        status: 'DRAFT',
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!draft) {
      return NextResponse.json(
        { error: 'No draft found' },
        { status: 404 }
      );
    }

    return NextResponse.json(draft);
  } catch (error) {
    console.error('Error fetching draft:', error);
    return NextResponse.json(
      { error: 'Failed to fetch draft' },
      { status: 500 }
    );
  }
}

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

    // Filter out contactEmail and other unknown fields (contactEmail should be in modelBible.preferredEmail)
    const { contactEmail, ...validDraftData } = draftData;

    // Check if a draft already exists for this invitation
    const existingDraft = await prisma.modelOnboardingDraft.findFirst({
      where: {
        invitationId: invitation.id,
        status: 'DRAFT',
      },
    });

    let draft;
    if (existingDraft) {
      // Update existing draft instead of creating a new one
      draft = await prisma.modelOnboardingDraft.update({
        where: { id: existingDraft.id },
        data: {
          ...validDraftData,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create a new draft
      draft = await prisma.modelOnboardingDraft.create({
        data: {
          ...validDraftData,
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
    }

    return NextResponse.json(draft);
  } catch (error) {
    console.error('Error creating public draft:', error);
    return NextResponse.json(
      { error: 'Failed to create draft' },
      { status: 500 }
    );
  }
}
