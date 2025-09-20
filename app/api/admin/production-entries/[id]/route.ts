import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

// DELETE - Delete a production entry
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify that the requesting user is an admin
    const requestingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }
    });

    if (!requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { id: entryId } = await params;

    // Delete the entry
    await prisma.productionEntry.delete({
      where: { id: entryId }
    });

    return NextResponse.json({ message: 'Production entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting production entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete production entry' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT - Update a production entry
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify that the requesting user is an admin
    const requestingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }
    });

    if (!requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { id: entryId } = await params;
    const body = await request.json();

    // Update the entry
    const updatedEntry = await prisma.productionEntry.update({
      where: { id: entryId },
      data: body
    });

    return NextResponse.json(updatedEntry);
  } catch (error) {
    console.error('Error updating production entry:', error);
    return NextResponse.json(
      { error: 'Failed to update production entry' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}