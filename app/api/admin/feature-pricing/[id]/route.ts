import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET - Get single feature pricing by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const pricing = await prisma.featureCreditPricing.findUnique({
      where: { id },
    });

    if (!pricing) {
      return NextResponse.json({ error: 'Feature pricing not found' }, { status: 404 });
    }

    return NextResponse.json({ pricing });
  } catch (error: unknown) {
    console.error('Error fetching feature pricing:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feature pricing' },
      { status: 500 }
    );
  }
}

// PATCH - Update feature pricing
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is SUPER_ADMIN
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    });

    if (user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const data = await req.json();

    // Don't allow changing featureKey
    delete data.featureKey;

    const pricing = await prisma.featureCreditPricing.update({
      where: { id },
      data: {
        ...data,
        credits: data.credits !== undefined ? parseInt(data.credits) : undefined,
      },
    });

    return NextResponse.json({ pricing });
  } catch (error: unknown) {
    console.error('Error updating feature pricing:', error);
    return NextResponse.json(
      { error: 'Failed to update feature pricing' },
      { status: 500 }
    );
  }
}

// DELETE - Delete feature pricing
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is SUPER_ADMIN
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    });

    if (user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    await prisma.featureCreditPricing.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting feature pricing:', error);
    return NextResponse.json(
      { error: 'Failed to delete feature pricing' },
      { status: 500 }
    );
  }
}
