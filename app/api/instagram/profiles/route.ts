import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET - List all profiles for the current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profiles = await prisma.instagramProfile.findMany({
      where: {
        clerkId: userId,
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' },
      ],
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, profiles });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profiles' },
      { status: 500 }
    );
  }
}

// POST - Create a new profile
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, instagramUsername, isDefault } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Profile name is required' },
        { status: 400 }
      );
    }

    // If this is set as default, unset all other defaults for this user
    if (isDefault) {
      await prisma.instagramProfile.updateMany({
        where: {
          clerkId: userId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const profile = await prisma.instagramProfile.create({
      data: {
        clerkId: userId,
        name: name.trim(),
        description: description?.trim() || null,
        instagramUsername: instagramUsername?.trim() || null,
        isDefault: isDefault || false,
      },
    });

    return NextResponse.json({ success: true, profile }, { status: 201 });
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 }
    );
  }
}
