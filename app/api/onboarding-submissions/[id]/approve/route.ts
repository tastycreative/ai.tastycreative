import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/**
 * Approve an onboarding submission and create InstagramProfile
 * POST /api/onboarding-submissions/[id]/approve
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch the submission
    const draft = await prisma.modelOnboardingDraft.findUnique({
      where: { id },
    });

    if (!draft) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    if (draft.reviewStatus === 'APPROVED') {
      return NextResponse.json(
        { error: 'This submission has already been approved' },
        { status: 400 }
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

    // Create the InstagramProfile
    const profile = await prisma.instagramProfile.create({
      data: {
        clerkId: draft.createdByClerkId,
        name: draft.name,
        description: draft.description || undefined,
        instagramUsername: draft.instagramUsername || undefined,
        profileImageUrl: draft.profileImageUrl,
        type: draft.type,
        selectedContentTypes: draft.selectedContentTypes,
        customContentTypes: draft.customContentTypes,
        modelBible: Object.keys(modelBible).length > 0 ? modelBible : undefined,
        status: 'active',
        isDefault: false,
      },
    });

    // Update draft with approval details
    await prisma.modelOnboardingDraft.update({
      where: { id: draft.id },
      data: {
        status: 'COMPLETED',
        reviewStatus: 'APPROVED',
        reviewedBy: userId,
        reviewedAt: new Date(),
        completedAt: new Date(),
        createdProfileId: profile.id,
      },
    });

    return NextResponse.json({
      success: true,
      profileId: profile.id,
      message: 'Submission approved and profile created successfully!',
    });
  } catch (error) {
    console.error('Error approving submission:', error);
    return NextResponse.json(
      { error: 'Failed to approve submission' },
      { status: 500 }
    );
  }
}
