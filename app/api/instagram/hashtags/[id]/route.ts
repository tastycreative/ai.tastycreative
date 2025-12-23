import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// PATCH update hashtag set
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, category, description, icon, color, hashtags, order } = body;

    // Normalize params.id to a string
  // Derive id from the request URL instead of using the second param
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1];

    // Verify ownership
    const existingSet = await prisma.hashtagSet.findUnique({
      where: { id },
    });

    if (!existingSet || existingSet.clerkId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const set = await prisma.hashtagSet.update({
  where: { id },
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
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Normalize params.id to a string
  // Derive id from the request URL instead of using the second param
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1];

    // Verify ownership
    const existingSet = await prisma.hashtagSet.findUnique({
      where: { id },
    });

    if (!existingSet || existingSet.clerkId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.hashtagSet.delete({
      where: { id },
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
