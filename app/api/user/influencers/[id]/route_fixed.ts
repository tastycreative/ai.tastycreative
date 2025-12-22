import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Delete the influencer LoRA record
    await prisma.influencerLoRA.delete({
      where: {
        id: id,
        clerkId: userId, // Ensure user owns this record
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting influencer:", error);
    return NextResponse.json(
      { error: "Failed to delete influencer" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { displayName } = body;

    if (!displayName || displayName.trim().length === 0) {
      return NextResponse.json({ error: "Display name is required" }, { status: 400 });
    }

    // Update the influencer LoRA record
    const updatedInfluencer = await prisma.influencerLoRA.update({
      where: {
        id: id,
        clerkId: userId, // Ensure user owns this record
      },
      data: {
        displayName: displayName.trim(),
      },
    });

    return NextResponse.json({ success: true, influencer: updatedInfluencer });
  } catch (error) {
    console.error("Error updating influencer:", error);
    return NextResponse.json(
      { error: "Failed to update influencer" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the specific influencer LoRA record
    const influencer = await prisma.influencerLoRA.findFirst({
      where: {
        id: id,
        clerkId: userId, // Ensure user owns this record
      },
    });

    if (!influencer) {
      return NextResponse.json({ error: "Influencer not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, influencer });
  } catch (error) {
    console.error("Error fetching influencer:", error);
    return NextResponse.json(
      { error: "Failed to fetch influencer" },
      { status: 500 }
    );
  }
}
