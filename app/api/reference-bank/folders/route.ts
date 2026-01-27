import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET - List all folders for the user
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const folders = await prisma.reference_folders.findMany({
      where: {
        clerkId: userId,
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({ folders });
  } catch (error) {
    console.error("Error fetching folders:", error);
    return NextResponse.json(
      { error: "Failed to fetch folders" },
      { status: 500 }
    );
  }
}

// POST - Create a new folder
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, color, icon, parentId } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    // Check if folder with same name exists at the same level
    const existingFolder = await prisma.reference_folders.findFirst({
      where: {
        clerkId: userId,
        name: name.trim(),
        parentId: parentId || null,
      },
    });

    if (existingFolder) {
      return NextResponse.json(
        { error: "A folder with this name already exists" },
        { status: 400 }
      );
    }

    // If parentId is provided, verify it belongs to the user
    if (parentId) {
      const parentFolder = await prisma.reference_folders.findFirst({
        where: {
          id: parentId,
          clerkId: userId,
        },
      });

      if (!parentFolder) {
        return NextResponse.json(
          { error: "Parent folder not found" },
          { status: 404 }
        );
      }
    }

    const folder = await prisma.reference_folders.create({
      data: {
        clerkId: userId,
        name: name.trim(),
        description: description || null,
        color: color || "#8B5CF6",
        icon: icon || "folder",
        parentId: parentId || null,
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json(folder, { status: 201 });
  } catch (error) {
    console.error("Error creating folder:", error);
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}
