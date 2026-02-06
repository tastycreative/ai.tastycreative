import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET - List all feature pricing
export async function GET() {
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

    const pricing = await prisma.featureCreditPricing.findMany({
      orderBy: [
        { category: 'asc' },
        { featureName: 'asc' },
      ],
    });

    return NextResponse.json({ pricing });
  } catch (error: unknown) {
    console.error('Error fetching feature pricing:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feature pricing' },
      { status: 500 }
    );
  }
}

// POST - Create new feature pricing
export async function POST(req: NextRequest) {
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

    const { featureKey, featureName, category, credits, description, isActive } = await req.json();

    if (!featureKey || !featureName || !category || credits === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: featureKey, featureName, category, credits' },
        { status: 400 }
      );
    }

    // Check if feature key already exists
    const existing = await prisma.featureCreditPricing.findUnique({
      where: { featureKey },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Feature key already exists' },
        { status: 400 }
      );
    }

    const pricing = await prisma.featureCreditPricing.create({
      data: {
        featureKey,
        featureName,
        category,
        credits: parseInt(credits),
        description,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({ pricing }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating feature pricing:', error);
    return NextResponse.json(
      { error: 'Failed to create feature pricing' },
      { status: 500 }
    );
  }
}
