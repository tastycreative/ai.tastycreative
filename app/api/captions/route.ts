import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// Helper function to check if user has access to a profile (own profile or shared via organization)
async function hasAccessToProfile(userId: string, profileId: string): Promise<{ hasAccess: boolean; profile: any | null; isShared: boolean }> {
  // First check if it's the user's own profile
  const ownProfile = await prisma.instagramProfile.findFirst({
    where: {
      id: profileId,
      clerkId: userId,
    },
  });

  if (ownProfile) {
    return { hasAccess: true, profile: ownProfile, isShared: false };
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
      include: {
        user: {
          select: { clerkId: true },
        },
      },
    });

    if (orgProfile) {
      return { hasAccess: true, profile: orgProfile, isShared: true };
    }
  }

  return { hasAccess: false, profile: null, isShared: false };
}

// Helper function to get all accessible profile IDs for a user
async function getAccessibleProfileIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { currentOrganizationId: true },
  });

  const whereCondition: any = {
    OR: [
      { clerkId: userId },
    ],
  };

  if (user?.currentOrganizationId) {
    whereCondition.OR.push({ organizationId: user.currentOrganizationId });
  }

  const profiles = await prisma.instagramProfile.findMany({
    where: whereCondition,
    select: { id: true },
  });

  return profiles.map((p) => p.id);
}

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

    // Get user's organization for shared profile access
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    // Build profile map for All Profiles mode or for profile name lookups
    let profileMap: Record<string, { name: string; clerkId: string; isShared: boolean }> = {};
    let accessibleProfileIds: string[] = [];

    if (isAllProfiles) {
      // Get all profiles the user has access to (own + organization)
      const whereCondition: any = {
        OR: [
          { clerkId: userId },
        ],
      };
      if (user?.currentOrganizationId) {
        whereCondition.OR.push({ organizationId: user.currentOrganizationId });
      }

      const profiles = await prisma.instagramProfile.findMany({
        where: whereCondition,
        select: { id: true, name: true, clerkId: true },
      });

      profileMap = profiles.reduce((acc, profile) => {
        acc[profile.id] = {
          name: profile.name,
          clerkId: profile.clerkId,
          isShared: profile.clerkId !== userId,
        };
        return acc;
      }, {} as Record<string, { name: string; clerkId: string; isShared: boolean }>);

      accessibleProfileIds = profiles.map((p) => p.id);
    } else {
      // Verify profile access (own or shared via organization)
      const { hasAccess, profile, isShared } = await hasAccessToProfile(userId, profileId);

      if (!hasAccess || !profile) {
        return NextResponse.json(
          { error: "Profile not found or unauthorized" },
          { status: 404 }
        );
      }

      // Store profile info for potential use
      profileMap[profileId] = {
        name: profile.name,
        clerkId: profile.clerkId,
        isShared,
      };
    }

    // Build the where clause for captions
    // For shared profiles, we need to query by profileId instead of clerkId
    let captionsWhere: any = {};

    if (isAllProfiles) {
      // For all profiles mode, get captions from all accessible profiles
      captionsWhere = {
        profileId: { in: accessibleProfileIds },
      };
    } else {
      // For a specific profile, query by profileId
      captionsWhere = {
        profileId: profileId,
      };
    }

    if (favoritesOnly) {
      captionsWhere.isFavorite = true;
    }

    // Build orderBy based on sortBy parameter
    type SortableFields = 'createdAt' | 'usageCount' | 'lastUsedAt' | 'caption';
    const validSortFields: SortableFields[] = ['createdAt', 'usageCount', 'lastUsedAt', 'caption'];
    const orderByField = validSortFields.includes(sortBy as SortableFields) ? sortBy as SortableFields : 'createdAt';
    const orderByDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const captions = await prisma.caption.findMany({
      where: captionsWhere,
      orderBy: [
        { isFavorite: 'desc' }, // Favorites first
        { [orderByField]: orderByDirection },
      ],
    });

    // Add profileName and isShared to each caption
    const captionsWithProfile = captions.map((caption) => ({
      ...caption,
      profileName: profileMap[caption.profileId]?.name || "Unknown Profile",
      isSharedProfile: profileMap[caption.profileId]?.isShared || false,
    }));

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

    // Verify profile access (own or shared via organization)
    const { hasAccess, profile } = await hasAccessToProfile(userId, profileId);

    if (!hasAccess || !profile) {
      return NextResponse.json(
        { error: "Profile not found or unauthorized" },
        { status: 404 }
      );
    }

    // Use the profile owner's clerkId for the caption
    const captionOwnerId = profile.clerkId;

    const newCaption = await prisma.caption.create({
      data: {
        clerkId: captionOwnerId,
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

    // First, find the caption and its profile
    const existingCaption = await prisma.caption.findFirst({
      where: { id },
      include: {
        profile: {
          select: { id: true, clerkId: true, organizationId: true },
        },
      },
    });

    if (!existingCaption) {
      return NextResponse.json(
        { error: "Caption not found" },
        { status: 404 }
      );
    }

    // Verify user has access to the caption's profile
    const { hasAccess } = await hasAccessToProfile(userId, existingCaption.profileId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized to modify this caption" },
        { status: 403 }
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

    // First, find the caption and its profile
    const existingCaption = await prisma.caption.findFirst({
      where: { id },
      include: {
        profile: {
          select: { id: true, clerkId: true, organizationId: true },
        },
      },
    });

    if (!existingCaption) {
      return NextResponse.json(
        { error: "Caption not found" },
        { status: 404 }
      );
    }

    // Verify user has access to the caption's profile
    const { hasAccess } = await hasAccessToProfile(userId, existingCaption.profileId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized to delete this caption" },
        { status: 403 }
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
