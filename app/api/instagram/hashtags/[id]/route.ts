import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// PATCH update hashtag set
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, category, description, icon, color, hashtags, order } = body;

    // Verify ownership
    const existingSet = await prisma.hashtagSet.findUnique({
      where: { id: params.id },
    });

    if (!existingSet || existingSet.clerkId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const set = await prisma.hashtagSet.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(description !== undefined && { description }),
        ...(icon && { icon }),
        ...(color && { color }),
        ...(hashtags && { hashtags }),
        ...(order !== undefined && { order }),
      },
    });

    return NextResponse.json({ set });
  } catch (error) {
    console.error("Error updating hashtag set:", error);
    return NextResponse.json(
      { error: "Failed to update hashtag set" },
      { status: 500 }
    );
  }
}

// DELETE hashtag set
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const existingSet = await prisma.hashtagSet.findUnique({
      where: { id: params.id },
    });

    if (!existingSet || existingSet.clerkId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.hashtagSet.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting hashtag set:", error);
    return NextResponse.json(
      { error: "Failed to delete hashtag set" },
      { status: 500 }
    );
  }
}
