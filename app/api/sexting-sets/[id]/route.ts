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

// Helper function to check if user has access to a profile (own profile or shared via organization)
async function hasAccessToProfile(userId: string, profileId: string): Promise<{ hasAccess: boolean; profile: any | null }> {
  // First check if it's the user's own profile
  const ownProfile = await prisma.instagramProfile.findFirst({
    where: {
      id: profileId,
      clerkId: userId,
    },
  });

  if (ownProfile) {
    return { hasAccess: true, profile: ownProfile };
  }

  // Check if it's a shared organization profile
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { currentOrganizationId: true },
  });

  if (user?.currentOrganizationId) {
    const orgProfile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        organizationId: user.currentOrganizationId,
      },
    });

    if (orgProfile) {
      return { hasAccess: true, profile: orgProfile };
    }
  }

  return { hasAccess: false, profile: null };
}

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
      where: { id },
      include: {
        images: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    if (!set) {
      return NextResponse.json(
        { error: "Set not found" },
        { status: 404 }
      );
    }

    // Verify access via the set's category (profileId)
    const { hasAccess } = await hasAccessToProfile(userId, set.category);

    // Also allow if user owns the set directly
    if (!hasAccess && set.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized to access this set" },
        { status: 403 }
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

    // Find the set
    const existingSet = await prisma.sextingSet.findFirst({
      where: { id: setId },
    });

    if (!existingSet) {
      return NextResponse.json(
        { error: "Set not found" },
        { status: 404 }
      );
    }

    // Verify access via the set's category (profileId)
    const { hasAccess } = await hasAccessToProfile(userId, existingSet.category);

    // Also allow if user owns the set directly
    if (!hasAccess && existingSet.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized to modify this set" },
        { status: 403 }
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

// PATCH - Update image metadata (rename)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: setId } = await params;
    const body = await request.json();
    const { imageId, newName } = body;

    if (!imageId || !newName) {
      return NextResponse.json(
        { error: "Image ID and new name are required" },
        { status: 400 }
      );
    }

    // Find the set
    const existingSet = await prisma.sextingSet.findFirst({
      where: { id: setId },
    });

    if (!existingSet) {
      return NextResponse.json(
        { error: "Set not found" },
        { status: 404 }
      );
    }

    // Verify access via the set's category (profileId)
    const { hasAccess } = await hasAccessToProfile(userId, existingSet.category);

    // Also allow if user owns the set directly
    if (!hasAccess && existingSet.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized to modify this set" },
        { status: 403 }
      );
    }

    // Find and update the image
    const image = await prisma.sextingImage.findFirst({
      where: { id: imageId, setId },
    });

    if (!image) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    // Sanitize the new name (preserve extension if not provided)
    const originalExtension = image.name.split('.').pop() || '';
    const newExtension = newName.split('.').pop() || '';
    const finalName = newExtension.toLowerCase() === originalExtension.toLowerCase() 
      ? newName 
      : `${newName}.${originalExtension}`;

    // Update the image name
    const updatedImage = await prisma.sextingImage.update({
      where: { id: imageId },
      data: { name: finalName },
    });

    return NextResponse.json({ 
      success: true, 
      image: updatedImage 
    });
  } catch (error) {
    console.error("Error updating image:", error);
    return NextResponse.json(
      { error: "Failed to update image" },
      { status: 500 }
    );
  }
}
