import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// POST /api/vault/confirm-upload - Confirm upload and create vault item record
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { s3Key, awsS3Url, fileName, fileType, fileSize, profileId, folderId } = await request.json();

    if (!s3Key || !awsS3Url || !fileName || !fileType || !profileId || !folderId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify folder ownership
    const folder = await prisma.vaultFolder.findFirst({
      where: {
        id: folderId,
        clerkId: userId,
        profileId,
      },
    });

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found or access denied" },
        { status: 404 }
      );
    }

    // Create vault item in database
    const vaultItem = await prisma.vaultItem.create({
      data: {
        clerkId: userId,
        profileId,
        folderId,
        fileName,
        fileType,
        fileSize: fileSize || 0,
        awsS3Key: s3Key,
        awsS3Url,
      },
    });

    return NextResponse.json(vaultItem);
  } catch (error) {
    console.error("Error confirming upload:", error);
    return NextResponse.json(
      { error: "Failed to confirm upload" },
      { status: 500 }
    );
  }
}
