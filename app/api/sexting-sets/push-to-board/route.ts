import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { publishBoardEvent } from '@/lib/ably';

/**
 * POST /api/sexting-sets/push-to-board
 *
 * Push a sexting set from the organizer to a Sexting Sets board.
 * Creates a BoardItem + BoardItemMedia rows from the set's images.
 *
 * Body:
 *   setId       – required, the SextingSet to push
 *   spaceId     – required, target space (must be SEXTING_SETS template)
 *   boardId     – required, target board
 *   columnId    – required, target column
 *   category    – optional, override category
 *   model       – optional, model name
 *   quality     – optional, quality level
 *   contentGenTaskId – optional, link back to Content Gen task
 *   clientId    – optional, Instagram profile ID
 *   clientName  – optional, client display name
 */
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      setId,
      spaceId,
      boardId,
      columnId,
      category,
      model,
      quality,
      contentGenTaskId,
      clientId,
      clientName,
    } = body;

    if (!setId || !spaceId || !boardId || !columnId) {
      return NextResponse.json(
        { error: 'setId, spaceId, boardId, and columnId are required' },
        { status: 400 },
      );
    }

    // Validate workspace is SEXTING_SETS template
    const workspace = await prisma.workspace.findUnique({
      where: { id: spaceId },
      select: { organizationId: true, templateType: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (workspace.templateType !== 'SEXTING_SETS') {
      return NextResponse.json(
        { error: 'Target space must be a Sexting Sets board' },
        { status: 400 },
      );
    }

    // Validate user belongs to org
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, currentOrganizationId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.currentOrganizationId !== workspace.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the sexting set with images
    const sextingSet = await prisma.sextingSet.findUnique({
      where: { id: setId },
      include: {
        images: { orderBy: { sequence: 'asc' } },
      },
    });

    if (!sextingSet) {
      return NextResponse.json({ error: 'Sexting set not found' }, { status: 404 });
    }

    if (sextingSet.images.length === 0) {
      return NextResponse.json(
        { error: 'Sexting set has no images to push' },
        { status: 400 },
      );
    }

    // Validate column belongs to board
    const column = await prisma.boardColumn.findUnique({
      where: { id: columnId },
      select: { id: true, boardId: true },
    });

    if (!column || column.boardId !== boardId) {
      return NextResponse.json({ error: 'Column not found in target board' }, { status: 400 });
    }

    // Resolve profile info if clientId provided
    let resolvedClientName = clientName ?? '';
    let profileId = clientId ?? sextingSet.category ?? '';

    if (profileId && !resolvedClientName) {
      const profile = await prisma.instagramProfile.findUnique({
        where: { id: profileId },
        select: { name: true },
      });
      if (profile) resolvedClientName = profile.name;
    }

    // Get next itemNo
    const maxItem = await prisma.boardItem.findFirst({
      where: { organizationId: workspace.organizationId },
      orderBy: { itemNo: 'desc' },
      select: { itemNo: true },
    });
    const nextItemNo = (maxItem?.itemNo ?? 0) + 1;

    // Build image refs for metadata
    const imageRefs = sextingSet.images.map((img) => ({
      id: img.id,
      url: img.url,
      name: img.name,
      type: img.type,
      sequence: img.sequence,
    }));

    // Build metadata
    const metadata = {
      category: category ?? '',
      setSize: sextingSet.images.length,
      model: model ?? resolvedClientName,
      quality: quality ?? 'HD',
      watermarked: false,
      tags: [] as string[],
      sextingSetId: sextingSet.id,
      contentGenTaskId: contentGenTaskId ?? '',
      clientId: profileId,
      clientName: resolvedClientName,
      profileId,
      captionTicketId: '',
      captionStatus: '',
      sextingSetStatus: '',
      captionItems: [],
      images: imageRefs,
      _createdAt: new Date().toISOString(),
      _updatedAt: new Date().toISOString(),
    };

    // Atomic transaction: create board item + media rows
    const item = await prisma.$transaction(async (tx) => {
      // 1. Create the board item
      const newItem = await tx.boardItem.create({
        data: {
          organizationId: workspace.organizationId,
          itemNo: nextItemNo,
          columnId,
          title: sextingSet.name,
          description: `Sexting set with ${sextingSet.images.length} images`,
          type: 'TASK',
          priority: 'MEDIUM',
          position: 0,
          metadata,
          createdBy: clerkId,
        },
      });

      // 2. Create BoardItemMedia rows for each image
      await tx.boardItemMedia.createMany({
        data: sextingSet.images.map((img) => ({
          itemId: newItem.id,
          url: img.url,
          type: img.type,
          name: img.name,
          size: img.size,
        })),
      });

      // 3. Record history
      await tx.boardItemHistory.create({
        data: {
          itemId: newItem.id,
          userId: clerkId,
          action: 'CREATED',
          field: 'item',
          newValue: `Pushed from Sexting Set Organizer: ${sextingSet.name}`,
        },
      });

      return newItem;
    });

    // Mark the sexting set as pushed so it no longer appears in the organizer
    await prisma.sextingSet.update({
      where: { id: setId },
      data: { status: 'pushed' },
    });

    // Real-time broadcast
    try {
      publishBoardEvent(boardId, 'item.created', {
        userId: clerkId,
        entityId: item.id,
      });
    } catch {
      // Ably not configured — skip
    }

    return NextResponse.json(
      {
        item: {
          id: item.id,
          itemNo: item.itemNo,
          title: item.title,
        },
        spaceId,
        boardId,
        mediaCount: sextingSet.images.length,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error pushing sexting set to board:', error);
    return NextResponse.json(
      { error: 'Failed to push sexting set to board' },
      { status: 500 },
    );
  }
}
