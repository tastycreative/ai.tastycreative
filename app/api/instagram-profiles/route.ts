import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get the user's current organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    // Get user's own profiles
    const ownProfiles = await prisma.instagramProfile.findMany({
      where: {
        clerkId: userId,
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
      include: {
        user: {
          select: {
            id: true,
            clerkId: true,
            name: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            email: true,
          },
        },
        linkedLoRAs: {
          select: {
            id: true,
            displayName: true,
            thumbnailUrl: true,
            fileName: true,
          },
        },
        _count: {
          select: {
            posts: true,
            feedPosts: true,
          },
        },
      },
    });

    // Get organization shared profiles (profiles shared with the user's org, but not owned by the user)
    const sharedProfiles = user?.currentOrganizationId
      ? await prisma.instagramProfile.findMany({
          where: {
            organizationId: user.currentOrganizationId,
            clerkId: { not: userId }, // Exclude own profiles to avoid duplicates
          },
          orderBy: [
            { name: 'asc' },
          ],
          include: {
            user: {
              select: {
                id: true,
                clerkId: true,
                name: true,
                firstName: true,
                lastName: true,
                imageUrl: true,
                email: true,
              },
            },
            linkedLoRAs: {
              select: {
                id: true,
                displayName: true,
                thumbnailUrl: true,
                fileName: true,
              },
            },
            _count: {
              select: {
                posts: true,
                feedPosts: true,
              },
            },
          },
        })
      : [];

    // Mark profiles as owned or shared
    const ownProfilesWithFlag = ownProfiles.map(p => ({ ...p, isShared: false }));
    const sharedProfilesWithFlag = sharedProfiles.map(p => ({ ...p, isShared: true }));

    // Combine and return all accessible profiles
    const allProfiles = [...ownProfilesWithFlag, ...sharedProfilesWithFlag];

    return NextResponse.json(allProfiles);
  } catch (error) {
    console.error("Error fetching Instagram profiles:", error);
    return NextResponse.json(
      { error: "Failed to fetch profiles" },
      { status: 500 }
    );
  }
}

// POST - Create a new profile
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const {
      name,
      description,
      instagramUsername,
      instagramAccountId,
      profileImageUrl,
      isDefault,
      shareWithOrganization,
      modelBible,
    } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Profile name is required" },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults first
    if (isDefault) {
      await prisma.instagramProfile.updateMany({
        where: {
          clerkId: userId,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    // Handle organization sharing
    let organizationId = null;
    if (shareWithOrganization) {
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { currentOrganizationId: true },
      });
      organizationId = user?.currentOrganizationId || null;
    }

    // Check if this is the first profile - make it default
    const existingProfileCount = await prisma.instagramProfile.count({
      where: { clerkId: userId },
    });

    const newProfile = await prisma.instagramProfile.create({
      data: {
        clerkId: userId,
        name: name.trim(),
        description: description || null,
        instagramUsername: instagramUsername || null,
        instagramAccountId: instagramAccountId || null,
        profileImageUrl: profileImageUrl || null,
        isDefault: isDefault || existingProfileCount === 0,
        organizationId,
        modelBible: modelBible || undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            clerkId: true,
            name: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            email: true,
          },
        },
        linkedLoRAs: {
          select: {
            id: true,
            displayName: true,
            thumbnailUrl: true,
            fileName: true,
          },
        },
        _count: {
          select: {
            posts: true,
            feedPosts: true,
          },
        },
      },
    });

    return NextResponse.json(newProfile, { status: 201 });
  } catch (error) {
    console.error("Error creating profile:", error);
    return NextResponse.json(
      { error: "Failed to create profile" },
      { status: 500 }
    );
  }
}
