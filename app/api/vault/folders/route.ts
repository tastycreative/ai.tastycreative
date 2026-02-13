import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// Helper function to check if user has access to a profile (own profile or shared via organization)
async function hasAccessToProfile(userId: string, profileId: string): Promise<{ hasAccess: boolean; profile: any | null }> {
  // First check if it's the user's own profile
  const ownProfile = await prisma.instagramProfile.findFirst({
    where: {
      id: profileId,
      clerkId: userId,
    },
  });

  if (ownProfile) {
    return { hasAccess: true, profile: ownProfile };
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
      return { hasAccess: true, profile: orgProfile };
    }
  }

  return { hasAccess: false, profile: null };
}

// GET /api/vault/folders - Get all folders for a profile (or all folders if no profileId)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const organizationSlug = searchParams.get("organizationSlug");

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    // If organizationSlug is provided, verify user has access to this organization
    let validatedOrgSlug: string | null = null;
    if (organizationSlug) {
      const org = await prisma.organization.findUnique({
        where: { slug: organizationSlug },
        select: { id: true, slug: true },
      });
      
      if (org) {
        // Check if user is a member of this organization
        const membership = await prisma.teamMember.findFirst({
          where: {
            organizationId: org.id,
            user: { clerkId: userId },
          },
        });
        
        if (membership || user?.currentOrganizationId === org.id) {
          validatedOrgSlug = org.slug;
        }
      }
    }

    // Handle "all" profiles case - return folders from all profiles with profile names
    if (profileId === "all") {
      // Get all profiles for the user (own + organization)
      const whereCondition: any = {
        OR: [
          { clerkId: userId },
        ],
      };
      if (user?.currentOrganizationId) {
        whereCondition.OR.push({ organizationId: user.currentOrganizationId });
      }

      const userProfiles = await prisma.instagramProfile.findMany({
        where: whereCondition,
        select: { 
          id: true, 
          name: true, 
          instagramUsername: true, 
          clerkId: true,
          user: {
            select: { 
              clerkId: true,
              firstName: true,
              lastName: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Create a map of profile IDs to profile info (including owner clerkId and name)
      const profileMap = Object.fromEntries(
        userProfiles.map((p) => {
          const isOwned = p.clerkId === userId;
          // Build owner display name for shared profiles
          let ownerName = null;
          if (!isOwned && p.user) {
            if (p.user.firstName && p.user.lastName) {
              ownerName = `${p.user.firstName} ${p.user.lastName}`;
            } else if (p.user.firstName) {
              ownerName = p.user.firstName;
            } else if (p.user.name) {
              ownerName = p.user.name;
            } else if (p.user.email) {
              ownerName = p.user.email.split('@')[0];
            }
          }
          return [p.id, { 
            name: p.name, 
            username: p.instagramUsername, 
            clerkId: p.clerkId || p.user?.clerkId,
            isOwned,
            ownerName,
          }];
        })
      );

      // Build OR conditions for folders - for each profile, get folders owned by that profile's owner
      const folderOrConditions: { profileId: string; clerkId: string }[] = [];
      for (const profile of userProfiles) {
        const ownerClerkId = profile.clerkId || profile.user?.clerkId;
        if (ownerClerkId) {
          folderOrConditions.push({
            profileId: profile.id,
            clerkId: ownerClerkId,
          });
        }
      }

      // If no valid conditions, return empty array
      if (folderOrConditions.length === 0) {
        return NextResponse.json([]);
      }

      // Build the where clause with optional organizationSlug filter
      const folderWhereClause: any = {
        OR: folderOrConditions,
      };
      
      // If organizationSlug is provided, filter folders by organization
      if (validatedOrgSlug) {
        folderWhereClause.organizationSlug = validatedOrgSlug;
      }

      // Get all folders for these profiles (only from profile owners)
      const folders = await prisma.vaultFolder.findMany({
        where: folderWhereClause,
        include: {
          _count: {
            select: { items: true },
          },
          subfolders: {
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      // Add profile name to each folder and sort: owned profiles first, then by profile name
      const foldersWithProfileName = folders.map((folder) => ({
        ...folder,
        profileName: profileMap[folder.profileId]?.name || "Unknown Profile",
        profileUsername: profileMap[folder.profileId]?.username || null,
        isOwnedProfile: profileMap[folder.profileId]?.isOwned || false,
        ownerName: profileMap[folder.profileId]?.ownerName || null,
      }));

      // Sort: owned profiles first, then alphabetically by profile name, then by folder creation date
      foldersWithProfileName.sort((a, b) => {
        // Owned profiles first
        if (a.isOwnedProfile && !b.isOwnedProfile) return -1;
        if (!a.isOwnedProfile && b.isOwnedProfile) return 1;
        
        // Then by profile name
        const nameCompare = (a.profileName || '').localeCompare(b.profileName || '');
        if (nameCompare !== 0) return nameCompare;
        
        // Then by folder creation date
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      return NextResponse.json(foldersWithProfileName);
    }

    // For specific profile, check if user has access
    if (profileId) {
      const { hasAccess, profile } = await hasAccessToProfile(userId, profileId);
      
      if (!hasAccess) {
        return NextResponse.json({ error: "Access denied to this profile" }, { status: 403 });
      }

      // Determine the profile owner's clerkId
      // For shared organization profiles, show the owner's folders
      // For own profiles, show the current user's folders
      const profileOwnerClerkId = profile?.clerkId || profile?.user?.clerkId;
      
      // If we can't determine the owner, return empty array
      if (!profileOwnerClerkId) {
        return NextResponse.json([]);
      }
      
      // Build where clause with optional organizationSlug filter
      const specificProfileWhereClause: any = {
        profileId: profileId,
        // Only show folders created by the profile owner
        clerkId: profileOwnerClerkId,
      };
      
      if (validatedOrgSlug) {
        specificProfileWhereClause.organizationSlug = validatedOrgSlug;
      }
      
      const folders = await prisma.vaultFolder.findMany({
        where: specificProfileWhereClause,
        include: {
          _count: {
            select: { items: true },
          },
          subfolders: {
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return NextResponse.json(folders);
    }

    // No profileId provided - get all folders for user's own profiles only
    // Build where clause with optional organizationSlug filter
    const noProfileWhereClause: any = { clerkId: userId };
    if (validatedOrgSlug) {
      noProfileWhereClause.organizationSlug = validatedOrgSlug;
    }
    
    const folders = await prisma.vaultFolder.findMany({
      where: noProfileWhereClause,
      include: {
        _count: {
          select: { items: true },
        },
        subfolders: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(folders);
  } catch (error) {
    console.error("Error fetching vault folders:", error);
    return NextResponse.json(
      { error: "Failed to fetch folders" },
      { status: 500 }
    );
  }
}

// POST /api/vault/folders - Create a new folder
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { profileId, name, isDefault, parentId, organizationSlug } = body;

    if (!profileId || !name) {
      return NextResponse.json(
        { error: "profileId and name are required" },
        { status: 400 }
      );
    }

    // Check if user has access to this profile
    const { hasAccess, profile } = await hasAccessToProfile(userId, profileId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this profile" },
        { status: 403 }
      );
    }

    // If parentId is provided, verify it exists and user has access
    if (parentId) {
      const parentFolder = await prisma.vaultFolder.findUnique({
        where: {
          id: parentId,
        },
      });

      if (!parentFolder) {
        return NextResponse.json(
          { error: "Parent folder not found" },
          { status: 404 }
        );
      }

      // Verify user has access to the parent folder's profile
      const { hasAccess: hasParentAccess } = await hasAccessToProfile(userId, parentFolder.profileId);
      if (!hasParentAccess) {
        return NextResponse.json(
          { error: "Access denied to parent folder" },
          { status: 403 }
        );
      }

      // Verify parent folder is in the same profile
      if (parentFolder.profileId !== profileId) {
        return NextResponse.json(
          { error: "Parent folder must be in the same profile" },
          { status: 400 }
        );
      }
    }

    // Determine the profile owner's clerkId
    // For shared organization profiles, use the profile owner's clerkId
    // For own profiles, use the current user's clerkId
    const profileOwnerClerkId = profile?.clerkId || profile?.user?.clerkId || userId;

    const folder = await prisma.vaultFolder.create({
      data: {
        clerkId: profileOwnerClerkId,
        profileId,
        name,
        isDefault: isDefault || false,
        parentId: parentId || null,
        organizationSlug: organizationSlug || null,
      },
    });

    return NextResponse.json(folder);
  } catch (error) {
    console.error("Error creating vault folder:", error);
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}
