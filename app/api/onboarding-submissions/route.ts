import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/**
 * Get all pending onboarding submissions
 * GET /api/onboarding-submissions?status=PENDING
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reviewStatus = searchParams.get('status') || 'PENDING';

    const where: any = {};

    // For pending submissions, filter by AWAITING_REVIEW status
    if (reviewStatus === 'PENDING') {
      where.status = 'AWAITING_REVIEW';
      where.reviewStatus = 'PENDING';
    } 
    // For approved/rejected, don't filter by status (they might be COMPLETED)
    else if (reviewStatus !== 'ALL') {
      where.reviewStatus = reviewStatus;
    }
    // For ALL, no status filter needed

    const submissions = await prisma.modelOnboardingDraft.findMany({
      where,
      include: {
        invitation: true,
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    // Calculate stats
    const stats = {
      pending: await prisma.modelOnboardingDraft.count({
        where: {
          status: 'AWAITING_REVIEW',
          reviewStatus: 'PENDING',
        },
      }),
      approved: await prisma.modelOnboardingDraft.count({
        where: {
          reviewStatus: 'APPROVED',
        },
      }),
      rejected: await prisma.modelOnboardingDraft.count({
        where: {
          reviewStatus: 'REJECTED',
        },
      }),
    };

    return NextResponse.json({
      submissions,
      stats,
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}
