import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET - Fetch all message types
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const messageTypes = await prisma.captionMessageType.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(messageTypes);
  } catch (error) {
    console.error("Error fetching message types:", error);
    return NextResponse.json(
      { error: "Failed to fetch message types" },
      { status: 500 }
    );
  }
}

// POST - Create a new message type
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Message type name is required" },
        { status: 400 }
      );
    }

    // Check if already exists
    const existing = await prisma.captionMessageType.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Message type already exists" },
        { status: 400 }
      );
    }

    const messageType = await prisma.captionMessageType.create({
      data: { name },
    });

    return NextResponse.json(messageType);
  } catch (error) {
    console.error("Error creating message type:", error);
    return NextResponse.json(
      { error: "Failed to create message type" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a message type
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Message type ID is required" },
        { status: 400 }
      );
    }

    // Check if any captions are using this message type
    const captionsCount = await prisma.caption.count({
      where: { messageTypeId: id },
    });

    if (captionsCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete message type. ${captionsCount} caption(s) are using it.`,
        },
        { status: 400 }
      );
    }

    await prisma.captionMessageType.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting message type:", error);
    return NextResponse.json(
      { error: "Failed to delete message type" },
      { status: 500 }
    );
  }
}
