import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET - Check if organization slug is available
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug || slug.length < 3) {
      return NextResponse.json({ available: false, error: 'Slug must be at least 3 characters' });
    }

    // Check if slug exists
    const existingOrg = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });

    return NextResponse.json({ available: !existingOrg });
  } catch (error) {
    console.error('Error checking slug:', error);
    return NextResponse.json(
      { error: 'Failed to check slug availability' },
      { status: 500 }
    );
  }
}
