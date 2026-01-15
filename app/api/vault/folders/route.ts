import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET /api/vault/folders - Get all folders for a profile (or all folders if no profileId)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    // Build where clause - if profileId provided, filter by it; otherwise get all user folders
    const whereClause: { clerkId: string; profileId?: string } = {
      clerkId: userId,
    };
    
    if (profileId) {
      whereClause.profileId = profileId;
    }

    const folders = await prisma.vaultFolder.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(folders);
  } catch (error) {
    console.error("Error fetching vault folders:", error);
    return NextResponse.json(
      { error: "Failed to fetch folders" },
      { status: 500 }
    );
  }
}

// POST /api/vault/folders - Create a new folder
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { profileId, name, isDefault } = body;

    if (!profileId || !name) {
      return NextResponse.json(
        { error: "profileId and name are required" },
        { status: 400 }
      );
    }

    const folder = await prisma.vaultFolder.create({
      data: {
        clerkId: userId,
        profileId,
        name,
        isDefault: isDefault || false,
      },
    });

    return NextResponse.json(folder);
  } catch (error) {
    console.error("Error creating vault folder:", error);
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}
