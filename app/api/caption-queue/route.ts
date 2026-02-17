import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/caption-queue - List all queue items for current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const items = await prisma.captionQueueTicket.findMany({
      where: { clerkId: userId },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error fetching caption queue:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queue items' },
      { status: 500 }
    );
  }
}

// POST /api/caption-queue - Create new queue item
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      modelName,
      modelAvatar,
      profileImageUrl,
      description,
      contentTypes,
      messageTypes,
      urgency,
      releaseDate,
      profileId,
    } = body;

    // Validate required fields
    if (!modelName || !modelAvatar || !description || !contentTypes || !messageTypes || !releaseDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate arrays
    if (!Array.isArray(contentTypes) || contentTypes.length === 0) {
      return NextResponse.json(
        { error: 'At least one content type is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(messageTypes) || messageTypes.length === 0) {
      return NextResponse.json(
        { error: 'At least one message type is required' },
        { status: 400 }
      );
    }

    const item = await prisma.captionQueueTicket.create({
      data: {
        clerkId: userId,
        profileId: profileId || null,
        modelName,
        modelAvatar: modelAvatar.toUpperCase(),
        profileImageUrl: profileImageUrl || null,
        description,
        contentTypes,
        messageTypes,
        urgency: urgency || 'medium',
        releaseDate: new Date(releaseDate),
        status: 'pending',
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Error creating queue item:', error);
    return NextResponse.json(
      { error: 'Failed to create queue item' },
      { status: 500 }
    );
  }
}
