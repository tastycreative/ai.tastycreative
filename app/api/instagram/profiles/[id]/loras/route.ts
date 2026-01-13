import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET - Get LoRAs linked to this profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify profile belongs to user
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        id,
        clerkId: userId,
      },
      include: {
        linkedLoRAs: {
          select: {
            id: true,
            displayName: true,
            thumbnailUrl: true,
            fileName: true,
            isActive: true,
            syncStatus: true,
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      loras: profile.linkedLoRAs 
    });
  } catch (error) {
    console.error('Error fetching profile LoRAs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LoRAs' },
      { status: 500 }
    );
  }
}

// POST - Link a LoRA to this profile
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { loraId } = body;

    if (!loraId) {
      return NextResponse.json(
        { error: 'LoRA ID is required' },
        { status: 400 }
      );
    }

    // Verify profile belongs to user
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        id,
        clerkId: userId,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Verify LoRA belongs to user
    const lora = await prisma.influencerLoRA.findFirst({
      where: {
        id: loraId,
        clerkId: userId,
      },
    });

    if (!lora) {
      return NextResponse.json(
        { error: 'LoRA not found' },
        { status: 404 }
      );
    }

    // Update the LoRA to link it to this profile
    const updatedLoRA = await prisma.influencerLoRA.update({
      where: { id: loraId },
      data: { profileId: id },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'LoRA linked successfully',
      lora: updatedLoRA,
    });
  } catch (error) {
    console.error('Error linking LoRA:', error);
    return NextResponse.json(
      { error: 'Failed to link LoRA' },
      { status: 500 }
    );
  }
}

// DELETE - Unlink a LoRA from this profile
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const loraId = searchParams.get('loraId');

    if (!loraId) {
      return NextResponse.json(
        { error: 'LoRA ID is required' },
        { status: 400 }
      );
    }

    // Verify profile belongs to user
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        id,
        clerkId: userId,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Verify LoRA belongs to user and is linked to this profile
    const lora = await prisma.influencerLoRA.findFirst({
      where: {
        id: loraId,
        clerkId: userId,
        profileId: id,
      },
    });

    if (!lora) {
      return NextResponse.json(
        { error: 'LoRA not found or not linked to this profile' },
        { status: 404 }
      );
    }

    // Unlink the LoRA
    const updatedLoRA = await prisma.influencerLoRA.update({
      where: { id: loraId },
      data: { profileId: null },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'LoRA unlinked successfully',
      lora: updatedLoRA,
    });
  } catch (error) {
    console.error('Error unlinking LoRA:', error);
    return NextResponse.json(
      { error: 'Failed to unlink LoRA' },
      { status: 500 }
    );
  }
}
