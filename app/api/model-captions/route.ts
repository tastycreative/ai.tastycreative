import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// Helper function to check if user has access to a profile
async function hasAccessToProfile(userId: string, profileId: string): Promise<boolean> {
  const profile = await prisma.instagramProfile.findFirst({
    where: {
      id: profileId,
      OR: [
        { clerkId: userId },
        {
          organizationId: {
            not: null,
          },
          organization: {
            members: {
              some: {
                userId: {
                  in: await prisma.user
                    .findUnique({
                      where: { clerkId: userId },
                      select: { id: true },
                    })
                    .then((u) => (u ? [u.id] : [])),
                },
              },
            },
          },
        },
      ],
    },
  });

  return !!profile;
}

// GET - Fetch captions for a specific model
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const contentTypeIds = searchParams.getAll("contentTypeId");
    const messageTypeIds = searchParams.getAll("messageTypeId");
    const search = searchParams.get("search");

    if (!profileId) {
      return NextResponse.json(
        { error: "Profile ID is required" },
        { status: 400 }
      );
    }

    // Check access
    const hasAccess = await hasAccessToProfile(userId, profileId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Profile not found or unauthorized" },
        { status: 404 }
      );
    }

    // Build where clause
    const where: any = {
      profileId,
    };

    // Filter by content types using the junction table
    if (contentTypeIds.length > 0) {
      where.contentTypes = {
        some: {
          contentTypeId: {
            in: contentTypeIds,
          },
        },
      };
    }

    // Filter by message types using the junction table
    if (messageTypeIds.length > 0) {
      where.messageTypes = {
        some: {
          messageTypeId: {
            in: messageTypeIds,
          },
        },
      };
    }

    if (search) {
      where.caption = {
        contains: search,
        mode: "insensitive",
      };
    }

    const captions = await prisma.caption.findMany({
      where,
      include: {
        contentTypes: {
          include: {
            contentType: true,
          },
        },
        messageTypes: {
          include: {
            messageType: true,
          },
        },
      },
      orderBy: [
        { isFavorite: "desc" },
        { createdAt: "desc" },
      ],
    });

    // Calculate average revenue per use for each caption
    const captionsWithAnalytics = captions.map((caption) => ({
      ...caption,
      averageRevenuePerUse:
        caption.usageCount > 0
          ? Number(caption.totalRevenue) / caption.usageCount
          : 0,
    }));

    return NextResponse.json(captionsWithAnalytics);
  } catch (error) {
    console.error("Error fetching model captions:", error);
    return NextResponse.json(
      { error: "Failed to fetch captions" },
      { status: 500 }
    );
  }
}

// POST - Create a new caption for a model
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      profileId,
      caption,
      contentTypeIds = [],
      messageTypeIds = [],
      originalModelName,
      notes,
    } = body;

    if (!profileId || !caption) {
      return NextResponse.json(
        { error: "Profile ID and caption text are required" },
        { status: 400 }
      );
    }

    // Check access
    const hasAccess = await hasAccessToProfile(userId, profileId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Profile not found or unauthorized" },
        { status: 404 }
      );
    }

    const newCaption = await prisma.caption.create({
      data: {
        clerkId: userId,
        profileId,
        caption,
        originalModelName,
        notes,
        captionCategory: contentTypeIds.length > 0 ? "categorized" : "general",
        captionTypes: messageTypeIds.length > 0 ? "typed" : "general",
        captionBanks: "model",
        contentTypes: {
          create: contentTypeIds.map((id: string) => ({
            contentTypeId: id,
          })),
        },
        messageTypes: {
          create: messageTypeIds.map((id: string) => ({
            messageTypeId: id,
          })),
        },
      },
      include: {
        contentTypes: {
          include: {
            contentType: true,
          },
        },
        messageTypes: {
          include: {
            messageType: true,
          },
        },
      },
    });

    return NextResponse.json(newCaption);
  } catch (error) {
    console.error("Error creating caption:", error);
    return NextResponse.json(
      { error: "Failed to create caption" },
      { status: 500 }
    );
  }
}

// PATCH - Update a caption
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      caption,
      contentTypeIds,
      messageTypeIds,
      originalModelName,
      notes,
      usageCount,
      totalRevenue,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Caption ID is required" },
        { status: 400 }
      );
    }

    // Check if caption exists and user has access
    const existingCaption = await prisma.caption.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!existingCaption) {
      return NextResponse.json({ error: "Caption not found" }, { status: 404 });
    }

    const hasAccess = await hasAccessToProfile(
      userId,
      existingCaption.profileId
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updateData: any = {};

    if (caption !== undefined) updateData.caption = caption;
    if (originalModelName !== undefined)
      updateData.originalModelName = originalModelName;
    if (notes !== undefined) updateData.notes = notes;
    if (usageCount !== undefined) {
      updateData.usageCount = usageCount;
      updateData.lastUsedAt = new Date();
    }
    if (totalRevenue !== undefined) updateData.totalRevenue = totalRevenue;

    // Handle content types update
    if (contentTypeIds !== undefined) {
      // Delete existing content type relations
      await prisma.captionToContentType.deleteMany({
        where: { captionId: id },
      });
      // Create new relations
      if (contentTypeIds.length > 0) {
        updateData.contentTypes = {
          create: contentTypeIds.map((typeId: string) => ({
            contentTypeId: typeId,
          })),
        };
      }
    }

    // Handle message types update
    if (messageTypeIds !== undefined) {
      // Delete existing message type relations
      await prisma.captionToMessageType.deleteMany({
        where: { captionId: id },
      });
      // Create new relations
      if (messageTypeIds.length > 0) {
        updateData.messageTypes = {
          create: messageTypeIds.map((typeId: string) => ({
            messageTypeId: typeId,
          })),
        };
      }
    }

    const updatedCaption = await prisma.caption.update({
      where: { id },
      data: updateData,
      include: {
        contentTypes: {
          include: {
            contentType: true,
          },
        },
        messageTypes: {
          include: {
            messageType: true,
          },
        },
      },
    });

    return NextResponse.json(updatedCaption);
  } catch (error) {
    console.error("Error updating caption:", error);
    return NextResponse.json(
      { error: "Failed to update caption" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a caption
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
        { error: "Caption ID is required" },
        { status: 400 }
      );
    }

    // Check if caption exists and user has access
    const existingCaption = await prisma.caption.findUnique({
      where: { id },
    });

    if (!existingCaption) {
      return NextResponse.json({ error: "Caption not found" }, { status: 404 });
    }

    const hasAccess = await hasAccessToProfile(
      userId,
      existingCaption.profileId
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.caption.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting caption:", error);
    return NextResponse.json(
      { error: "Failed to delete caption" },
      { status: 500 }
    );
  }
}
