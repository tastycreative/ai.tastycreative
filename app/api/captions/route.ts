import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET - Fetch captions for a specific profile
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const favoritesOnly = searchParams.get("favoritesOnly") === "true";
    const sortBy = searchParams.get("sortBy") || "createdAt"; // createdAt, usageCount, lastUsedAt
    const sortOrder = searchParams.get("sortOrder") || "desc";

    if (!profileId) {
      return NextResponse.json(
        { error: "Profile ID is required" },
        { status: 400 }
      );
    }

    const isAllProfiles = profileId === "all";

    // Build profile map for All Profiles mode
    let profileMap: Record<string, string> = {};
    if (isAllProfiles) {
      const profiles = await prisma.instagramProfile.findMany({
        where: { clerkId: userId },
        select: { id: true, name: true },
      });
      profileMap = profiles.reduce((acc, profile) => {
        acc[profile.id] = profile.name;
        return acc;
      }, {} as Record<string, string>);
    } else {
      // Verify profile belongs to user
      const profile = await prisma.instagramProfile.findFirst({
        where: {
          id: profileId,
          clerkId: userId,
        },
      });

      if (!profile) {
        return NextResponse.json(
          { error: "Profile not found or unauthorized" },
          { status: 404 }
        );
      }
    }

    const where: {
      profileId?: string;
      clerkId: string;
      isFavorite?: boolean;
    } = {
      clerkId: userId,
    };

    if (!isAllProfiles) {
      where.profileId = profileId;
    }

    if (favoritesOnly) {
      where.isFavorite = true;
    }

    // Build orderBy based on sortBy parameter
    type SortableFields = 'createdAt' | 'usageCount' | 'lastUsedAt' | 'caption';
    const validSortFields: SortableFields[] = ['createdAt', 'usageCount', 'lastUsedAt', 'caption'];
    const orderByField = validSortFields.includes(sortBy as SortableFields) ? sortBy as SortableFields : 'createdAt';
    const orderByDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const captions = await prisma.caption.findMany({
      where,
      orderBy: [
        { isFavorite: 'desc' }, // Favorites first
        { [orderByField]: orderByDirection },
      ],
    });

    // Add profileName to each caption if in all profiles mode
    const captionsWithProfile = isAllProfiles
      ? captions.map((caption) => ({
          ...caption,
          profileName: profileMap[caption.profileId] || "Unknown Profile",
        }))
      : captions;

    return NextResponse.json(captionsWithProfile);
  } catch (error) {
    console.error("Error fetching captions:", error);
    return NextResponse.json(
      { error: "Failed to fetch captions" },
      { status: 500 }
    );
  }
}

// POST - Create a new caption
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { profileId, caption, captionCategory, captionTypes, captionBanks } = body;

    if (!profileId || !caption || !captionCategory || !captionTypes || !captionBanks) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify profile belongs to user
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        clerkId: userId,
      },
    });

    if (!profile) {
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
        captionCategory,
        captionTypes,
        captionBanks,
        isFavorite: body.isFavorite || false,
        notes: body.notes || null,
        tags: body.tags || null,
      },
    });

    return NextResponse.json(newCaption, { status: 201 });
  } catch (error) {
    console.error("Error creating caption:", error);
    return NextResponse.json(
      { error: "Failed to create caption" },
      { status: 500 }
    );
  }
}

// PUT - Update a caption
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, caption, captionCategory, captionTypes, captionBanks } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Caption ID is required" },
        { status: 400 }
      );
    }

    // Verify caption belongs to user
    const existingCaption = await prisma.caption.findFirst({
      where: {
        id,
        clerkId: userId,
      },
    });

    if (!existingCaption) {
      return NextResponse.json(
        { error: "Caption not found or unauthorized" },
        { status: 404 }
      );
    }

    const updatedCaption = await prisma.caption.update({
      where: { id },
      data: {
        caption,
        captionCategory,
        captionTypes,
        captionBanks,
        isFavorite: body.isFavorite,
        notes: body.notes,
        tags: body.tags,
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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Caption ID is required" },
        { status: 400 }
      );
    }

    // Verify caption belongs to user
    const existingCaption = await prisma.caption.findFirst({
      where: {
        id,
        clerkId: userId,
      },
    });

    if (!existingCaption) {
      return NextResponse.json(
        { error: "Caption not found or unauthorized" },
        { status: 404 }
      );
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
