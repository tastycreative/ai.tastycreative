import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

/**
 * Validate an onboarding invitation token (public endpoint - no auth required)
 * GET /api/onboarding-invitations/validate?token=xxx
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { valid: false, reason: 'Token is required' },
        { status: 400 }
      );
    }

    const invitation = await prisma.onboardingInvitation.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        modelName: true,
        notes: true,
        isActive: true,
        expiresAt: true,
        maxUses: true,
        usedCount: true,
        createdByClerkId: true,
      },
    });

    if (!invitation) {
      return NextResponse.json({
        valid: false,
        reason: 'Invalid token',
      });
    }

    // Check if invitation is active
    if (!invitation.isActive) {
      return NextResponse.json({
        valid: false,
        reason: 'This invitation link has been deactivated',
      });
    }

    // Check expiration
    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json({
        valid: false,
        reason: 'This invitation link has expired',
      });
    }

    // Check usage limit
    if (invitation.usedCount >= invitation.maxUses) {
      return NextResponse.json({
        valid: false,
        reason: 'This invitation link has reached its usage limit',
      });
    }

    // Token is valid
    return NextResponse.json({
      valid: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        modelName: invitation.modelName,
        notes: invitation.notes,
        expiresAt: invitation.expiresAt,
        remainingUses: invitation.maxUses - invitation.usedCount,
      },
    });
  } catch (error) {
    console.error('Error validating token:', error);
    return NextResponse.json(
      { valid: false, reason: 'Failed to validate token' },
      { status: 500 }
    );
  }
}
