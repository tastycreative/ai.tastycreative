import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET /api/vault/items - Get all items for a folder or all items for a profile
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 }
      );
    }

    // If folderId is provided, get items for that folder only
    // If not, get all items for the profile (for "All Media" view)
    const items = await prisma.vaultItem.findMany({
      where: {
        clerkId: userId,
        profileId,
        ...(folderId ? { folderId } : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching vault items:", error);
    return NextResponse.json(
      { error: "Failed to fetch items" },
      { status: 500 }
    );
  }
}

// POST /api/vault/items - Create a new vault item (after file upload)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { profileId, folderId, fileName, fileType, fileSize, awsS3Key, awsS3Url } = body;

    if (!profileId || !folderId || !fileName || !fileType || !fileSize || !awsS3Key || !awsS3Url) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const item = await prisma.vaultItem.create({
      data: {
        clerkId: userId,
        profileId,
        folderId,
        fileName,
        fileType,
        fileSize,
        awsS3Key,
        awsS3Url,
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error creating vault item:", error);
    return NextResponse.json(
      { error: "Failed to create item" },
      { status: 500 }
    );
  }
}
