import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAccess } from '@/lib/adminAuth';
import { prisma } from '@/lib/database';
import { currentUser } from '@clerk/nextjs/server';

// Input validation
interface AssignCreatorRequest {
  profileIds: string[];
  creatorClerkId: string;
}

function validateInput(body: unknown): body is AssignCreatorRequest {
  if (!body || typeof body !== 'object') return false;
  const obj = body as Record<string, unknown>;
  if (!Array.isArray(obj.profileIds)) return false;
  if (obj.profileIds.length === 0) return false;
  if (obj.profileIds.length > 100) return false; // Limit bulk operations
  if (!obj.profileIds.every((id) => typeof id === 'string' && id.length > 0)) return false;
  if (typeof obj.creatorClerkId !== 'string' || obj.creatorClerkId.length === 0) return false;
  return true;
}

/**
 * POST /api/admin/models/assign-creator
 * Assign models/profiles to a creator
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminAccess();

    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    if (!validateInput(body)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input. Expected profileIds as a non-empty array of strings (max 100 items) and creatorClerkId as a non-empty string.',
        },
        { status: 400 }
      );
    }

    const { profileIds, creatorClerkId } = body;

    // Verify the creator exists and has CREATOR role
    const creator = await prisma.user.findUnique({
      where: { clerkId: creatorClerkId },
      select: {
        id: true,
        clerkId: true,
        firstName: true,
        lastName: true,
        email: true,
        teamMemberships: {
          where: { role: 'CREATOR' },
          select: { id: true, role: true },
        },
      },
    });

    if (!creator) {
      return NextResponse.json(
        { success: false, error: 'Creator user not found' },
        { status: 404 }
      );
    }

    // Verify the user has CREATOR role in at least one organization
    if (creator.teamMemberships.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User does not have CREATOR role in any organization' },
        { status: 400 }
      );
    }

    // Verify all profiles exist
    const existingProfiles = await prisma.instagramProfile.findMany({
      where: { id: { in: profileIds } },
      select: { id: true, name: true, clerkId: true },
    });

    if (existingProfiles.length !== profileIds.length) {
      const foundIds = new Set(existingProfiles.map((p) => p.id));
      const missingIds = profileIds.filter((id) => !foundIds.has(id));
      return NextResponse.json(
        {
          success: false,
          error: 'Some profiles were not found',
          missingIds,
        },
        { status: 404 }
      );
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create ProfileAssignment records for each profile
      // Use createMany with skipDuplicates to handle already-assigned profiles
      const assignmentsCreated = await tx.profileAssignment.createMany({
        data: profileIds.map((profileId) => ({
          profileId,
          assignedToClerkId: creatorClerkId,
          assignedBy: user.id,
        })),
        skipDuplicates: true,
      });

      return assignmentsCreated;
    });

    console.log(
      `[assign-creator] Admin ${user.id} assigned ${result.count} profiles to creator ${creatorClerkId} (${creator.firstName} ${creator.lastName}):`,
      profileIds
    );

    return NextResponse.json({
      success: true,
      data: {
        assignedCount: result.count,
        assignedIds: profileIds,
        creator: {
          clerkId: creator.clerkId,
          firstName: creator.firstName,
          lastName: creator.lastName,
          email: creator.email,
        },
      },
      message: `Successfully assigned ${result.count} model(s) to ${creator.firstName || ''} ${creator.lastName || creator.email || 'creator'}`,
    });
  } catch (error: any) {
    console.error('Error in assign creator:', error);

    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }

    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to assign models. Please try again.' },
      { status: 500 }
    );
  }
}
