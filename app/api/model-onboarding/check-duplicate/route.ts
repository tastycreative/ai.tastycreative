import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/**
 * Check if an Instagram username already exists in the system
 * GET /api/model-onboarding/check-duplicate?username=example&excludeDraftId=123
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const excludeDraftId = searchParams.get('excludeDraftId');

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Clean the username (remove @ if present, trim, lowercase)
    const cleanUsername = username.replace('@', '').trim().toLowerCase();

    if (cleanUsername.length === 0) {
      return NextResponse.json({ error: 'Invalid username' }, { status: 400 });
    }

    // Check in InstagramProfile table (active/production models)
    const existingProfile = await prisma.instagramProfile.findFirst({
      where: {
        instagramUsername: {
          equals: cleanUsername,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        instagramUsername: true,
      },
    });

    if (existingProfile) {
      return NextResponse.json({
        exists: true,
        duplicate: {
          id: existingProfile.id,
          name: existingProfile.name,
          username: existingProfile.instagramUsername,
          type: 'profile',
        },
      });
    }

    // Check in ModelOnboardingDraft table (pending onboarding)
    // Exclude the current draft if excludeDraftId is provided
    const draftQuery: any = {
      instagramUsername: {
        equals: cleanUsername,
        mode: 'insensitive',
      },
      status: {
        in: ['DRAFT', 'IN_PROGRESS', 'AWAITING_REVIEW'],
      },
    };

    if (excludeDraftId) {
      draftQuery.id = {
        not: excludeDraftId,
      };
    }

    const existingDraft = await prisma.modelOnboardingDraft.findFirst({
      where: draftQuery,
      select: {
        id: true,
        name: true,
        instagramUsername: true,
        status: true,
      },
    });

    if (existingDraft) {
      return NextResponse.json({
        exists: true,
        duplicate: {
          id: existingDraft.id,
          name: existingDraft.name,
          username: existingDraft.instagramUsername,
          status: existingDraft.status,
          type: 'draft',
        },
      });
    }

    // No duplicates found
    return NextResponse.json({
      exists: false,
      duplicate: null,
    });
  } catch (error) {
    console.error('Error checking duplicate:', error);
    return NextResponse.json(
      { error: 'Failed to check for duplicates' },
      { status: 500 }
    );
  }
}
