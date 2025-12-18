import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// POST: Create a new Instagram post record
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      fileName,
      awsS3Key,
      awsS3Url,
      mimeType,
      folder,
      status = 'DRAFT',
      postType = 'POST',
      caption = '',
      profileId,
    } = body;

    if (!fileName || !awsS3Key || !awsS3Url) {
      return NextResponse.json(
        { error: "fileName, awsS3Key, and awsS3Url are required" },
        { status: 400 }
      );
    }

    const post = await prisma.instagramPost.create({
      data: {
        clerkId: user.id,
        profileId: profileId || null,
        fileName,
        awsS3Key,
        awsS3Url,
        mimeType,
        folder: folder || 'STORIES',
        status,
        postType,
        caption,
        order: 0,
      },
    });

    console.log('✅ Instagram post created:', post.id);

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error("Error creating Instagram post:", error);
    return NextResponse.json(
      { error: "Failed to create Instagram post" },
      { status: 500 }
    );
  }
}
