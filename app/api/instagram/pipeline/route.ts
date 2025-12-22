// app/api/instagram/pipeline/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// GET: Fetch all pipeline items with filters
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const contentType = searchParams.get("contentType");
    const profileId = searchParams.get("profileId");

    const whereClause: any = {
      clerkId: user.id,
    };

    if (status && status !== "all") {
      whereClause.status = status;
    }

    if (contentType && contentType !== "all") {
      whereClause.contentType = contentType;
    }

    // Build profile filter for related slots
    const profileFilter = profileId && profileId !== "all" ? { profileId } : {};

    const items = await prisma.contentPipelineItem.findMany({
      where: whereClause,
      include: {
        linkedPost: {
          select: {
            id: true,
            fileName: true,
            awsS3Url: true,
            driveFileUrl: true,
            caption: true,
            status: true,
            postType: true,
            scheduledDate: true,
          },
        },
        storySlot: profileId && profileId !== "all" ? {
          where: profileFilter,
          include: {
            linkedPost: {
              select: {
                id: true,
                fileName: true,
                awsS3Url: true,
                driveFileUrl: true,
              },
            },
          },
        } : {
          include: {
            linkedPost: {
              select: {
                id: true,
                fileName: true,
                awsS3Url: true,
                driveFileUrl: true,
              },
            },
          },
        },
        reelSlot: profileId && profileId !== "all" ? {
          where: profileFilter,
        } : true,
        feedPostSlot: profileId && profileId !== "all" ? {
          where: profileFilter,
        } : true,
      },
      orderBy: [
        { updatedAt: "desc" },
      ],
    });

    // Filter items to only include those with slots matching the profile
    const filteredItems = profileId && profileId !== "all" 
      ? items.filter(item => item.storySlot || item.reelSlot || item.feedPostSlot)
      : items;

    return NextResponse.json({ items: filteredItems });
  } catch (error) {
    console.error("Error fetching pipeline items:", error);
    return NextResponse.json(
      { error: "Failed to fetch pipeline items" },
      { status: 500 }
    );
  }
}

// POST: Create a new pipeline item
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      contentId,
      title,
      contentType,
      status = "IDEA",
      notes,
      dateCreated,
      linkedPostId,
    } = body;

    if (!contentId || !title || !contentType) {
      return NextResponse.json(
        { error: "contentId, title, and contentType are required" },
        { status: 400 }
      );
    }

    // Check if contentId already exists
    const existing = await prisma.contentPipelineItem.findUnique({
      where: { contentId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Content ID already exists" },
        { status: 409 }
      );
    }

    const now = new Date();
    const stageData: any = {};

    // Set stage timestamps based on status
    if (status === "IDEA") stageData.ideaDate = now;
    if (status === "FILMING") stageData.filmingDate = now;
    if (status === "EDITING") stageData.editingDate = now;
    if (status === "REVIEW") stageData.reviewDate = now;
    if (status === "APPROVED") stageData.approvedDate = now;
    if (status === "SCHEDULED") stageData.scheduledDate = now;
    if (status === "POSTED") {
      stageData.datePosted = now;
    }

    const item = await prisma.contentPipelineItem.create({
      data: {
        clerkId: user.id,
        contentId,
        title,
        contentType,
        status,
        notes,
        dateCreated: dateCreated ? new Date(dateCreated) : now,
        linkedPostId,
        ...stageData,
      },
      include: {
        linkedPost: {
          select: {
            id: true,
            fileName: true,
            awsS3Url: true,
            driveFileUrl: true,
            caption: true,
            status: true,
            postType: true,
            scheduledDate: true,
          },
        },
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Error creating pipeline item:", error);
    return NextResponse.json(
      { error: "Failed to create pipeline item" },
      { status: 500 }
    );
  }
}
