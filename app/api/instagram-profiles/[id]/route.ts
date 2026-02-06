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

    // Verify profile exists and check permissions
    const existingProfile = await prisma.instagramProfile.findUnique({
      where: { id },
      select: { 
        clerkId: true,
        organizationId: true,
      },
    });

    if (!existingProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Check if user is the owner
    const isOwner = existingProfile.clerkId === userId;
    
    // Check if user has elevated role in the organization (for shared profiles)
    let canEdit = isOwner;
    
    if (!isOwner && existingProfile.organizationId) {
      // Get user's database ID
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { 
          id: true,
          currentOrganizationId: true,
        },
      });

      // Verify the profile is in the user's current organization
      if (user?.currentOrganizationId === existingProfile.organizationId) {
        // Check user's role in the organization
        const teamMembership = await prisma.teamMember.findUnique({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: existingProfile.organizationId,
            },
          },
          select: { role: true },
        });

        // Allow OWNER, ADMIN, and MANAGER to edit
        const elevatedRoles = ["OWNER", "ADMIN", "MANAGER"];
        canEdit = teamMembership ? elevatedRoles.includes(teamMembership.role) : false;
      }
    }

    if (!canEdit) {
      return NextResponse.json(
        { error: "You don't have permission to edit this profile" },
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
      tags,
      isFavorite,
    } = body;

    // Only profile owners can set as default or change sharing settings
    if (!isOwner && (isDefault !== undefined || shareWithOrganization !== undefined)) {
      return NextResponse.json(
        { error: "Only the profile owner can change default status or sharing settings" },
        { status: 403 }
      );
    }

    // If setting as default, unset other defaults first
    if (isDefault && isOwner) {
      await prisma.instagramProfile.updateMany({
        where: {
          clerkId: userId,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    // Handle organization sharing (only for owners)
    let organizationId = undefined;
    if (shareWithOrganization !== undefined && isOwner) {
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
    if (tags !== undefined) updateData.tags = tags;
    if (isFavorite !== undefined) updateData.isFavorite = isFavorite;
    
    // Only allow owners to update these fields
    if (isOwner) {
      if (isDefault !== undefined) updateData.isDefault = isDefault;
      if (organizationId !== undefined) updateData.organizationId = organizationId;
    }

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
      { error: "Failed to update profile", details: error instanceof Error ? error.message : String(error) },
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

    // Verify profile exists
    const existingProfile = await prisma.instagramProfile.findUnique({
      where: { id },
      select: { 
        clerkId: true, 
        isDefault: true,
        organizationId: true,
      },
    });

    if (!existingProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Check if user is the owner
    const isOwner = existingProfile.clerkId === userId;
    
    // Check if user has elevated role in the organization (for shared profiles)
    let canDelete = isOwner;
    
    if (!isOwner && existingProfile.organizationId) {
      // Get user's database ID and current organization
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { 
          id: true,
          currentOrganizationId: true,
        },
      });

      // Verify the profile is in the user's current organization
      if (user?.currentOrganizationId === existingProfile.organizationId) {
        // Check user's role in the organization
        const teamMembership = await prisma.teamMember.findUnique({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: existingProfile.organizationId,
            },
          },
          select: { role: true },
        });

        // Allow OWNER, ADMIN, and MANAGER to delete shared profiles
        const elevatedRoles = ["OWNER", "ADMIN", "MANAGER"];
        canDelete = teamMembership ? elevatedRoles.includes(teamMembership.role) : false;
      }
    }

    if (!canDelete) {
      return NextResponse.json(
        { error: "You don't have permission to delete this profile" },
        { status: 403 }
      );
    }

    // Delete the profile
    await prisma.instagramProfile.delete({
      where: { id },
    });

    // If this was the default profile for the owner, set another one as default
    if (existingProfile.isDefault && isOwner) {
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
