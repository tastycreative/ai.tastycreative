import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    if (!query.trim()) {
      return NextResponse.json([]);
    }

    // Search for Instagram profiles
    const profiles = await prisma.instagramProfile.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { instagramUsername: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        instagramUsername: true,
        description: true,
        profileImageUrl: true,
      },
      take: 10,
    });

    // Format results
    const profileResults = profiles.map(profile => ({
      type: 'profile' as const,
      id: profile.id,
      title: profile.name,
      subtitle: profile.instagramUsername ? `@${profile.instagramUsername}` : profile.description?.substring(0, 50),
      imageUrl: profile.profileImageUrl,
    }));

    return NextResponse.json(profileResults);
  } catch (error) {
    console.error('Error searching:', error);
    return NextResponse.json(
      { error: 'Failed to search' },
      { status: 500 }
    );
  }
}
