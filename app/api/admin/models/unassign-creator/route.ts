import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAccess } from '@/lib/adminAuth';
import { prisma } from '@/lib/database';
import { currentUser } from '@clerk/nextjs/server';

// Input validation
interface UnassignCreatorRequest {
  profileIds: string[];
  creatorClerkId: string;
}

function validateInput(body: unknown): body is UnassignCreatorRequest {
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
 * DELETE /api/admin/models/unassign-creator
 * Remove profile assignments from a creator
 */
export async function DELETE(request: NextRequest) {
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

    // Delete the assignments
    const result = await prisma.profileAssignment.deleteMany({
      where: {
        profileId: { in: profileIds },
        assignedToClerkId: creatorClerkId,
      },
    });

    console.log(
      `[unassign-creator] Admin ${user.id} removed ${result.count} profile assignments from creator ${creatorClerkId}:`,
      profileIds
    );

    return NextResponse.json({
      success: true,
      data: {
        removedCount: result.count,
        profileIds,
      },
      message: `Successfully removed ${result.count} profile assignment(s)`,
    });
  } catch (error: any) {
    console.error('Error in unassign creator:', error);

    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }

    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to remove assignments. Please try again.' },
      { status: 500 }
    );
  }
}
