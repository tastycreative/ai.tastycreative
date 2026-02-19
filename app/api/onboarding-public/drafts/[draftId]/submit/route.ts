import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { headers } from 'next/headers';

/**
 * Submit a public onboarding draft for review (does not create InstagramProfile yet)
 * POST /api/onboarding-public/drafts/[draftId]/submit?token=xxx
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  try {
    const { draftId } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Fetch the draft and invitation
    const draft = await prisma.modelOnboardingDraft.findFirst({
      where: {
        id: draftId,
        isPublicSubmission: true,
        invitation: {
          token,
        },
      },
      include: {
        invitation: true,
      },
    });

    if (!draft || !draft.invitation) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Validate the invitation is still valid
    if (!draft.invitation.isActive) {
      return NextResponse.json(
        { error: 'This invitation link has been deactivated' },
        { status: 403 }
      );
    }

    if (draft.invitation.expiresAt && new Date(draft.invitation.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'This invitation link has expired' },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!draft.name || !draft.profileImageUrl || !draft.type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, profileImageUrl, type' },
        { status: 400 }
      );
    }

    if (!draft.selectedContentTypes || draft.selectedContentTypes.length === 0) {
      return NextResponse.json(
        { error: 'At least one content type is required' },
        { status: 400 }
      );
    }

    // Build modelBible from draft data
    const modelBible: any = {};

    if (draft.age) modelBible.age = draft.age;
    if (draft.birthday) modelBible.birthday = draft.birthday;
    if (draft.location) modelBible.location = draft.location;
    if (draft.nationality) modelBible.nationality = draft.nationality;
    if (draft.ethnicity) modelBible.ethnicity = draft.ethnicity;
    if (draft.occupation) modelBible.occupation = draft.occupation;
    if (draft.relationshipStatus) modelBible.relationshipStatus = draft.relationshipStatus;
    if (draft.backstory) modelBible.backstory = draft.backstory;
    if (draft.interests) modelBible.interests = draft.interests;
    if (draft.primaryNiche) modelBible.primaryNiche = draft.primaryNiche;
    if (draft.feedAesthetic) modelBible.feedAesthetic = draft.feedAesthetic;
    if (draft.commonThemes) modelBible.commonThemes = draft.commonThemes;
    if (draft.uniqueHook) modelBible.uniqueHook = draft.uniqueHook;
    if (draft.platformPricing) modelBible.platformPricing = draft.platformPricing;
    if (draft.platforms) modelBible.platforms = draft.platforms;
    if (draft.socials) modelBible.socials = draft.socials;
    if (draft.restrictions) modelBible.restrictions = draft.restrictions;
    if (draft.schedule) modelBible.schedule = draft.schedule;
    if (draft.internalNotes) modelBible.internalNotes = draft.internalNotes;

    if (draft.modelBible) {
      Object.assign(modelBible, draft.modelBible);
    }

    // Get IP address for tracking
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for') || 
               headersList.get('x-real-ip') || 
               'unknown';

    // Update draft status to AWAITING_REVIEW (no profile created yet)
    await prisma.modelOnboardingDraft.update({
      where: {
        id: draft.id,
      },
      data: {
        status: 'AWAITING_REVIEW',
        reviewStatus: 'PENDING',
        submittedAt: new Date(),
      },
    });

    // Update invitation usage
    const newIpAddresses = draft.invitation.ipAddresses.includes(ip)
      ? draft.invitation.ipAddresses
      : [...draft.invitation.ipAddresses, ip];

    await prisma.onboardingInvitation.update({
      where: {
        id: draft.invitation.id,
      },
      data: {
        usedCount: { increment: 1 },
        lastUsedAt: new Date(),
        ipAddresses: newIpAddresses,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Application submitted for review! You will be notified once approved.',
    });
  } catch (error) {
    console.error('Error submitting public draft:', error);
    return NextResponse.json(
      { error: 'Failed to submit draft' },
      { status: 500 }
    );
  }
}
