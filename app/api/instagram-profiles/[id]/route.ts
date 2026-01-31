import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET a single profile by ID
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

    const profile = await prisma.instagramProfile.findUnique({
      where: { id },
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

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Check access - user owns it or it's shared with their org
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    const isOwner = profile.clerkId === userId;
    const isSharedWithOrg =
      profile.organizationId &&
      user?.currentOrganizationId === profile.organizationId;

    if (!isOwner && !isSharedWithOrg) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({
      ...profile,
      isShared: !isOwner,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PATCH - Update a profile
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existingProfile = await prisma.instagramProfile.findUnique({
      where: { id },
      select: { clerkId: true },
    });

    if (!existingProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (existingProfile.clerkId !== userId) {
      return NextResponse.json(
        { error: "You can only edit your own profiles" },
        { status: 403 }
      );
    }

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

    // If setting as default, unset other defaults first
    if (isDefault) {
      await prisma.instagramProfile.updateMany({
        where: {
          clerkId: userId,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    // Handle organization sharing
    let organizationId = undefined;
    if (shareWithOrganization !== undefined) {
      if (shareWithOrganization) {
        // Get user's current organization
        const user = await prisma.user.findUnique({
          where: { clerkId: userId },
          select: { currentOrganizationId: true },
        });
        organizationId = user?.currentOrganizationId || null;
      } else {
        organizationId = null;
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (instagramUsername !== undefined)
      updateData.instagramUsername = instagramUsername;
    if (instagramAccountId !== undefined)
      updateData.instagramAccountId = instagramAccountId;
    if (profileImageUrl !== undefined)
      updateData.profileImageUrl = profileImageUrl;
    if (isDefault !== undefined) updateData.isDefault = isDefault;
    if (organizationId !== undefined) updateData.organizationId = organizationId;

    // Handle modelBible as JSON field
    if (modelBible !== undefined) {
      updateData.modelBible = modelBible;
    }

    const updatedProfile = await prisma.instagramProfile.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a profile
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existingProfile = await prisma.instagramProfile.findUnique({
      where: { id },
      select: { clerkId: true, isDefault: true },
    });

    if (!existingProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (existingProfile.clerkId !== userId) {
      return NextResponse.json(
        { error: "You can only delete your own profiles" },
        { status: 403 }
      );
    }

    // Delete the profile
    await prisma.instagramProfile.delete({
      where: { id },
    });

    // If this was the default profile, set another one as default
    if (existingProfile.isDefault) {
      const anotherProfile = await prisma.instagramProfile.findFirst({
        where: { clerkId: userId },
        orderBy: { createdAt: "asc" },
      });

      if (anotherProfile) {
        await prisma.instagramProfile.update({
          where: { id: anotherProfile.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting profile:", error);
    return NextResponse.json(
      { error: "Failed to delete profile" },
      { status: 500 }
    );
  }
}
