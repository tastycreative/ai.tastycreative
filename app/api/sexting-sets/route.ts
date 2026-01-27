import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { S3Client, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// GET - Fetch all sexting sets for the user (optionally filtered by profileId)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const isAllProfiles = profileId === "all";

    // Build profile map for adding profile names when viewing all profiles
    let profileMap: Record<string, string> = {};
    if (isAllProfiles) {
      const profiles = await prisma.instagramProfile.findMany({
        where: { clerkId: userId },
        select: { id: true, name: true },
      });
      profileMap = profiles.reduce((acc, p) => {
        acc[p.id] = p.name;
        return acc;
      }, {} as Record<string, string>);
    }

    const sets = await prisma.sextingSet.findMany({
      where: {
        userId,
        // When viewing all profiles, don't filter by category
        ...(!isAllProfiles && profileId && { category: profileId }),
      },
      include: {
        images: {
          orderBy: { sequence: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Add profileName to each set when viewing all profiles
    const setsWithProfileName = sets.map((set) => ({
      ...set,
      profileName: isAllProfiles ? profileMap[set.category] || null : null,
    }));

    return NextResponse.json({ sets: setsWithProfileName });
  } catch (error) {
    console.error("Error fetching sexting sets:", error);
    return NextResponse.json(
      { error: "Failed to fetch sexting sets" },
      { status: 500 }
    );
  }
}

// POST - Create a new sexting set
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, category, profileId } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Set name is required" },
        { status: 400 }
      );
    }

    // Generate S3 folder path
    const s3FolderPath = `sexting-sets/${userId}/${profileId || "general"}/${Date.now()}-${name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;

    const set = await prisma.sextingSet.create({
      data: {
        userId,
        name,
        category: category || profileId || "general",
        s3FolderPath,
        status: "draft",
      },
      include: {
        images: true,
      },
    });

    return NextResponse.json({ set });
  } catch (error) {
    console.error("Error creating sexting set:", error);
    return NextResponse.json(
      { error: "Failed to create sexting set" },
      { status: 500 }
    );
  }
}

// PATCH - Update a sexting set
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, category, status, scheduledDate } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Set ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingSet = await prisma.sextingSet.findFirst({
      where: { id, userId },
    });

    if (!existingSet) {
      return NextResponse.json(
        { error: "Set not found or unauthorized" },
        { status: 404 }
      );
    }

    const set = await prisma.sextingSet.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(status && { status }),
        ...(scheduledDate !== undefined && { scheduledDate: scheduledDate ? new Date(scheduledDate) : null }),
      },
      include: {
        images: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    return NextResponse.json({ set });
  } catch (error) {
    console.error("Error updating sexting set:", error);
    return NextResponse.json(
      { error: "Failed to update sexting set" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a sexting set
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
        { error: "Set ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership and get images
    const existingSet = await prisma.sextingSet.findFirst({
      where: { id, userId },
      include: { images: true },
    });

    if (!existingSet) {
      return NextResponse.json(
        { error: "Set not found or unauthorized" },
        { status: 404 }
      );
    }

    // Delete files from S3
    const bucket = process.env.AWS_S3_BUCKET!;
    
    try {
      // First, list all objects in the set's S3 folder
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: existingSet.s3FolderPath,
      });
      
      const listedObjects = await s3Client.send(listCommand);
      
      if (listedObjects.Contents && listedObjects.Contents.length > 0) {
        // Delete all objects in the folder
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: listedObjects.Contents.map((obj) => ({ Key: obj.Key })),
            Quiet: true,
          },
        });
        
        await s3Client.send(deleteCommand);
      }
    } catch (s3Error) {
      console.error("Error deleting S3 files:", s3Error);
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete will cascade to images due to schema relation
    await prisma.sextingSet.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting sexting set:", error);
    return NextResponse.json(
      { error: "Failed to delete sexting set" },
      { status: 500 }
    );
  }
}
