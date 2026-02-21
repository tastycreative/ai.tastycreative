import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { resendOnboardingInvitationEmail } from '@/lib/onboarding-email';

/**
 * Resend onboarding invitation email
 * POST /api/onboarding-invitations/[invitationId]/resend-email
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invitationId } = await params;

    // Resend the email
    const result = await resendOnboardingInvitationEmail(invitationId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to resend email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email resent successfully',
      emailId: result.emailId,
    });
  } catch (error) {
    console.error('Error resending invitation email:', error);
    return NextResponse.json(
      { error: 'Failed to resend invitation email' },
      { status: 500 }
    );
  }
}
