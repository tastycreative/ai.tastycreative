import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET - Fetch all content types
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentTypes = await prisma.captionContentType.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(contentTypes);
  } catch (error) {
    console.error("Error fetching content types:", error);
    return NextResponse.json(
      { error: "Failed to fetch content types" },
      { status: 500 }
    );
  }
}

// POST - Create a new content type
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
        { error: "Content type name is required" },
        { status: 400 }
      );
    }

    // Check if already exists
    const existing = await prisma.captionContentType.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Content type already exists" },
        { status: 400 }
      );
    }

    const contentType = await prisma.captionContentType.create({
      data: { name },
    });

    return NextResponse.json(contentType);
  } catch (error) {
    console.error("Error creating content type:", error);
    return NextResponse.json(
      { error: "Failed to create content type" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a content type
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
        { error: "Content type ID is required" },
        { status: 400 }
      );
    }

    // Check if any captions are using this content type via junction table
    const captionsCount = await prisma.captionToContentType.count({
      where: { contentTypeId: id },
    });

    if (captionsCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete content type. ${captionsCount} caption(s) are using it.`,
        },
        { status: 400 }
      );
    }

    await prisma.captionContentType.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting content type:", error);
    return NextResponse.json(
      { error: "Failed to delete content type" },
      { status: 500 }
    );
  }
}
