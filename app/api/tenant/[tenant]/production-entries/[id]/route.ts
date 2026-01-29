import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { requireOrganizationAdmin } from '@/lib/organizationAuth';

// Force Node.js runtime
export const runtime = 'nodejs';

// DELETE - Delete a production entry
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string; id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenant, id: entryId } = await params;

    // Check organization admin access
    await requireOrganizationAdmin(tenant);

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { slug: tenant },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Verify the entry belongs to a member of this organization
    const entry = await prisma.productionEntry.findFirst({
      where: {
        id: entryId,
        user: {
          teamMemberships: {
            some: {
              organizationId: organization.id,
            },
          },
        },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Production entry not found or access denied' }, { status: 404 });
    }

    // Delete the entry
    await prisma.productionEntry.delete({
      where: { id: entryId }
    });

    return NextResponse.json({ message: 'Production entry deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting production entry:', error);

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to delete production entry' },
      { status: 500 }
    );
  }
}

// PUT - Update a production entry
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string; id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenant, id: entryId } = await params;

    // Check organization admin access
    await requireOrganizationAdmin(tenant);

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { slug: tenant },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Verify the entry belongs to a member of this organization
    const entry = await prisma.productionEntry.findFirst({
      where: {
        id: entryId,
        user: {
          teamMemberships: {
            some: {
              organizationId: organization.id,
            },
          },
        },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Production entry not found or access denied' }, { status: 404 });
    }

    const body = await req.json();

    // Update the entry
    const updatedEntry = await prisma.productionEntry.update({
      where: { id: entryId },
      data: body
    });

    return NextResponse.json(updatedEntry);
  } catch (error: any) {
    console.error('Error updating production entry:', error);

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to update production entry' },
      { status: 500 }
    );
  }
}
