import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'path parameter is required' }, { status: 400 });
    }

    console.log('🔍 Feature pricing lookup for path:', path);

    // Get all active features and find a match
    const allFeatures = await prisma.featureCreditPricing.findMany({
      where: { isActive: true },
      select: {
        id: true,
        featureKey: true,
        featureName: true,
        category: true,
        credits: true,
        description: true,
        isActive: true,
      },
    });

    // Find feature that matches the URL path
    // Try multiple matching strategies:
    // 1. Direct match with underscores (seedream_image_to_image)
    // 2. Match with hyphens converted to underscores (seedream-image-to-image -> seedream_image_to_image)
    // 3. Case-insensitive partial match
    const featurePricing = allFeatures.find(feature => {
      const key = feature.featureKey.toLowerCase();
      const searchPath = path.toLowerCase();
      const pathWithUnderscores = searchPath.replace(/-/g, '_');

      return key === pathWithUnderscores ||
             key === searchPath ||
             key.includes(pathWithUnderscores) ||
             pathWithUnderscores.includes(key);
    });

    if (!featurePricing) {
      console.log('❌ Feature pricing not found for path:', path);
      console.log('Available features:', allFeatures.map(f => f.featureKey));
      return NextResponse.json({ error: 'Feature pricing not found' }, { status: 404 });
    }

    console.log('✅ Feature pricing found:', featurePricing);
    return NextResponse.json(featurePricing);
  } catch (error) {
    console.error('❌ Error fetching feature pricing:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feature pricing' },
      { status: 500 }
    );
  }
}
