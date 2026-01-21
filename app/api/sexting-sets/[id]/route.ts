import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// GET - Fetch a single sexting set with its images
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const set = await prisma.sextingSet.findFirst({
      where: { id, userId },
      include: {
        images: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    if (!set) {
      return NextResponse.json(
        { error: "Set not found or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json({ set });
  } catch (error) {
    console.error("Error fetching sexting set:", error);
    return NextResponse.json(
      { error: "Failed to fetch sexting set" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an image from a sexting set
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: setId } = await params;
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("imageId");

    if (!imageId) {
      return NextResponse.json(
        { error: "Image ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership of the set
    const existingSet = await prisma.sextingSet.findFirst({
      where: { id: setId, userId },
    });

    if (!existingSet) {
      return NextResponse.json(
        { error: "Set not found or unauthorized" },
        { status: 404 }
      );
    }

    // Find the image
    const image = await prisma.sextingImage.findFirst({
      where: { id: imageId, setId },
    });

    if (!image) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    // Extract S3 key from URL
    const bucket = process.env.AWS_S3_BUCKET!;
    const s3Key = image.url.replace(`https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/`, "");

    // Delete from S3
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: s3Key,
        })
      );
    } catch (s3Error) {
      console.error("Error deleting from S3:", s3Error);
      // Continue with database deletion even if S3 fails
    }

    // Delete from database
    await prisma.sextingImage.delete({
      where: { id: imageId },
    });

    // Re-sequence remaining images
    const remainingImages = await prisma.sextingImage.findMany({
      where: { setId },
      orderBy: { sequence: "asc" },
    });

    for (let i = 0; i < remainingImages.length; i++) {
      await prisma.sextingImage.update({
        where: { id: remainingImages[i].id },
        data: { sequence: i + 1 },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
