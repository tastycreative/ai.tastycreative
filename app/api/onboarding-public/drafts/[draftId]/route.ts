import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

/**
 * Get a public draft by ID and token
 * GET /api/onboarding-public/drafts/[draftId]?token=xxx
 */
export async function GET(
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

    const draft = await prisma.modelOnboardingDraft.findFirst({
      where: {
        id: draftId,
        isPublicSubmission: true,
        invitation: {
          token,
        },
      },
    });

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json(draft);
  } catch (error) {
    console.error('Error fetching public draft:', error);
    return NextResponse.json(
      { error: 'Failed to fetch draft' },
      { status: 500 }
    );
  }
}

/**
 * Update a public draft
 * PATCH /api/onboarding-public/drafts/[draftId]?token=xxx
 */
export async function PATCH(
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

    const body = await request.json();

    // Verify draft belongs to this token
    const existing = await prisma.modelOnboardingDraft.findFirst({
      where: {
        id: draftId,
        isPublicSubmission: true,
        invitation: {
          token,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Calculate completion percentage
    let completionPercentage = 0;
    const name = body.name !== undefined ? body.name : existing.name;
    const profileImageUrl = body.profileImageUrl !== undefined ? body.profileImageUrl : existing.profileImageUrl;
    const type = body.type !== undefined ? body.type : existing.type;
    const selectedContentTypes = body.selectedContentTypes !== undefined ? body.selectedContentTypes : existing.selectedContentTypes;
    const backstory = body.backstory !== undefined ? body.backstory : existing.backstory;
    const platformPricing = body.platformPricing !== undefined ? body.platformPricing : existing.platformPricing;

    if (name && profileImageUrl && type) completionPercentage += 50;
    if (selectedContentTypes && selectedContentTypes.length > 0) completionPercentage += 30;
    if (backstory) completionPercentage += 10;
    if (platformPricing) completionPercentage += 10;

    const draft = await prisma.modelOnboardingDraft.update({
      where: {
        id: draftId,
      },
      data: {
        ...body,
        completionPercentage,
        lastAutoSaveAt: body.lastAutoSaveAt ? new Date(body.lastAutoSaveAt) : undefined,
      },
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error('Error updating public draft:', error);
    return NextResponse.json(
      { error: 'Failed to update draft' },
      { status: 500 }
    );
  }
}
