import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/**
 * Reject an onboarding submission
 * POST /api/onboarding-submissions/[id]/reject
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
    const body = await request.json();
    const { reason } = body;

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
        { error: 'Cannot reject an already approved submission' },
        { status: 400 }
      );
    }

    // Update draft with rejection details
    await prisma.modelOnboardingDraft.update({
      where: { id: draft.id },
      data: {
        reviewStatus: 'REJECTED',
        reviewedBy: userId,
        reviewedAt: new Date(),
        rejectionReason: reason || 'No reason provided',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Submission rejected successfully',
    });
  } catch (error) {
    console.error('Error rejecting submission:', error);
    return NextResponse.json(
      { error: 'Failed to reject submission' },
      { status: 500 }
    );
  }
}
