import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAccess } from '@/lib/adminAuth';
import { prisma } from '@/lib/database';
import { currentUser } from '@clerk/nextjs/server';

// Input validation
interface BulkDeleteRequest {
  profileIds: string[];
}

function validateInput(body: unknown): body is BulkDeleteRequest {
  if (!body || typeof body !== 'object') return false;
  const obj = body as Record<string, unknown>;
  if (!Array.isArray(obj.profileIds)) return false;
  if (obj.profileIds.length === 0) return false;
  if (obj.profileIds.length > 100) return false; // Limit bulk operations
  return obj.profileIds.every((id) => typeof id === 'string' && id.length > 0);
}

/**
 * POST /api/admin/models/bulk-delete
 * Bulk delete models/profiles
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
          error: 'Invalid input. Expected profileIds as a non-empty array of strings (max 100 items).',
        },
        { status: 400 }
      );
    }

    const { profileIds } = body;

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
      // Delete related records first (cascade should handle most, but be explicit)
      
      // Delete vault folders associated with these profiles
      await tx.vaultFolder.deleteMany({
        where: { profileId: { in: profileIds } },
      });

      // Delete vault folder shares associated with these profiles
      await tx.vaultFolderShare.deleteMany({
        where: { folder: { profileId: { in: profileIds } } },
      });

      // Delete profile group memberships
      await tx.profileGroupMember.deleteMany({
        where: { profileId: { in: profileIds } },
      });

      // Delete profile pins
      await tx.profilePin.deleteMany({
        where: { profileId: { in: profileIds } },
      });

      // Delete the profiles
      const deleteResult = await tx.instagramProfile.deleteMany({
        where: { id: { in: profileIds } },
      });

      return deleteResult;
    });

    console.log(`[bulk-delete] Admin ${user.id} deleted ${result.count} profiles:`, profileIds);

    return NextResponse.json({
      success: true,
      data: {
        deletedCount: result.count,
        deletedIds: profileIds,
      },
      message: `Successfully deleted ${result.count} model(s)`,
    });
  } catch (error: any) {
    console.error('Error in bulk delete:', error);

    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }

    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete models. Please try again.' },
      { status: 500 }
    );
  }
}
