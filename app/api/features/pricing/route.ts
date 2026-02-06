import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET - Get feature pricing by key (for checking costs before using a feature)
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const featureKey = searchParams.get('key');

    if (!featureKey) {
      return NextResponse.json({ error: 'Feature key is required' }, { status: 400 });
    }

    const pricing = await prisma.featureCreditPricing.findUnique({
      where: {
        featureKey,
        isActive: true,
      },
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
