import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/flyer-assets — List flyer assets for a profile
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');

    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId is required' },
        { status: 400 }
      );
    }

    // Get user's current org
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    if (!user?.currentOrganizationId) {
      return NextResponse.json(
        { error: 'No active organization' },
        { status: 400 }
      );
    }

    const assets = await prisma.flyerAsset.findMany({
      where: {
        organizationId: user.currentOrganizationId,
        profileId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ assets });
  } catch (error) {
    console.error('Error fetching flyer assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flyer assets' },
      { status: 500 }
    );
  }
}

// POST /api/flyer-assets — Create a flyer asset record (metadata only, no file upload)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { profileId, fileName, fileType, url, s3Key, fileSize, boardItemId } =
      body;

    if (!profileId || !fileName || !fileType || !url || !s3Key) {
      return NextResponse.json(
        { error: 'profileId, fileName, fileType, url, and s3Key are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    if (!user?.currentOrganizationId) {
      return NextResponse.json(
        { error: 'No active organization' },
        { status: 400 }
      );
    }

    const asset = await prisma.flyerAsset.create({
      data: {
        organizationId: user.currentOrganizationId,
        profileId,
        clerkId: userId,
        boardItemId: boardItemId || null,
        fileName,
        fileType,
        url,
        s3Key,
        fileSize: fileSize || null,
      },
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    console.error('Error creating flyer asset:', error);
    return NextResponse.json(
      { error: 'Failed to create flyer asset' },
      { status: 500 }
    );
  }
}
