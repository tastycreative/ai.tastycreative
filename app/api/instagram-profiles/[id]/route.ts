import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { deleteProfileVaultFiles } from "@/lib/s3-cleanup";

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
    let hasElevatedRole = false;
    
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
        hasElevatedRole = teamMembership ? elevatedRoles.includes(teamMembership.role) : false;
        canEdit = hasElevatedRole;
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
      pageStrategy,
      customStrategies,
      selectedContentTypes,
      customContentTypes,
      type,
      status,
    } = body;

    // Only profile owners or users with elevated roles (OWNER, ADMIN, MANAGER) can change sharing settings
    // Only profile owners can set as default
    const canChangeSharing = isOwner || hasElevatedRole;
    
    if (!isOwner && isDefault !== undefined) {
      return NextResponse.json(
        { error: "Only the profile owner can change default status" },
        { status: 403 }
      );
    }
    
    if (!canChangeSharing && shareWithOrganization !== undefined) {
      return NextResponse.json(
        { error: "Only the profile owner or organization admins can change sharing settings" },
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

    // Handle organization sharing (for owners and elevated role users)
    let organizationId = undefined;
    if (shareWithOrganization !== undefined && canChangeSharing) {
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
    if (pageStrategy !== undefined) updateData.pageStrategy = pageStrategy;
    if (customStrategies !== undefined) updateData.customStrategies = customStrategies;
    if (selectedContentTypes !== undefined) updateData.selectedContentTypes = selectedContentTypes;
    if (customContentTypes !== undefined) updateData.customContentTypes = customContentTypes;
    if (type !== undefined) updateData.type = type;
    if (status !== undefined) updateData.status = status;
    
    // Only allow owners to update isDefault
    if (isOwner && isDefault !== undefined) {
      updateData.isDefault = isDefault;
    }
    
    // Allow owners and elevated role users to update organizationId (sharing)
    if (canChangeSharing && organizationId !== undefined) {
      updateData.organizationId = organizationId;
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

    console.log(`🗑️ Starting comprehensive profile deletion for: ${id}`);

    // STEP 1: Delete all vault files from S3
    console.log(`📦 Step 1: Deleting vault files from S3...`);
    try {
      const { deletedCount, failedCount } = await deleteProfileVaultFiles(id);
      console.log(`✅ S3 cleanup: ${deletedCount} deleted, ${failedCount} failed`);
      
      if (failedCount > 0) {
        console.warn(`⚠️ Warning: ${failedCount} files could not be deleted from S3`);
      }
    } catch (error) {
      console.error('❌ Error during S3 cleanup:', error);
      // Continue with deletion even if S3 cleanup fails
    }

    // STEP 2: Delete database records
    // With CASCADE enabled in schema, the following will auto-delete:
    // - VaultFolder (and their subfolders)
    // - VaultItem
    // - InstagramPost
    // - FeedPost
    // - Caption
    // - Friendship requests
    // - Likes, comments, bookmarks
    console.log(`🗄️ Step 2: Deleting profile from database (CASCADE will clean related data)...`);
    
    await prisma.instagramProfile.delete({
      where: { id },
    });

    console.log(`✅ Profile deleted successfully: ${id}`);

    // STEP 3: If this was the default profile for the owner, set another one as default
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
        console.log(`✅ Set new default profile: ${anotherProfile.id}`);
      }
    }

    return NextResponse.json({ 
      success: true,
      message: "Profile and all associated data deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting profile:", error);
    return NextResponse.json(
      { error: "Failed to delete profile" },
      { status: 500 }
    );
  }
}
