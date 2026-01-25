import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET - List all reference items for a profile
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { error: "Profile ID is required" },
        { status: 400 }
      );
    }

    // Verify the profile belongs to the user
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        clerkId: userId,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    const items = await prisma.reference_items.findMany({
      where: {
        clerkId: userId,
        profileId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching reference items:", error);
    return NextResponse.json(
      { error: "Failed to fetch reference items" },
      { status: 500 }
    );
  }
}

// POST - Create a new reference item
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      profileId,
      name,
      description,
      tags,
      fileType,
      mimeType,
      fileSize,
      awsS3Key,
      width,
      height,
      duration,
    } = body;

    if (!profileId || !name || !fileType || !mimeType || !awsS3Key) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify the profile belongs to the user
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        clerkId: userId,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Construct the S3 URL
    const bucket = process.env.AWS_S3_BUCKET || "tastycreative";
    const region = process.env.AWS_REGION || "us-east-1";
    const awsS3Url = `https://${bucket}.s3.${region}.amazonaws.com/${awsS3Key}`;

    const item = await prisma.reference_items.create({
      data: {
        clerkId: userId,
        profileId,
        name,
        description: description || null,
        tags: tags || [],
        fileType,
        mimeType,
        fileSize: fileSize || 0,
        awsS3Key,
        awsS3Url,
        width: width || null,
        height: height || null,
        duration: duration || null,
      } as any,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Error creating reference item:", error);
    return NextResponse.json(
      { error: "Failed to create reference item" },
      { status: 500 }
    );
  }
}
