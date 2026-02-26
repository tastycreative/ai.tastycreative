import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// Auto-create default folder structure for new profiles
async function createDefaultFolderStructure(profileId: string, clerkId: string) {
  try {
    console.log('📁 [instagram-profiles] Creating default folder structure for profile:', profileId);

    // Define the folder structure
    const parentFolders = [
      { name: "Raw Generations", order: 1 },
      { name: "Needs QA/Edits", order: 2 },
      { name: "Ready to upload", order: 3 },
    ];

    const subfolders = [
      "IG (SFW)",
      "IG REELS (SFW)",
      "X (SFW)",
      "X (NSFW)",
      "SEXTING SETS",
      "WALL POST",
      "PPV CONTENT",
      "NSFW MISC",
      "SFW MISC",
      "TESTING",
    ];

    // Create parent folders and their subfolders
    for (const parent of parentFolders) {
      // Create parent folder
      const parentFolder = await prisma.vaultFolder.create({
        data: {
          clerkId,
          profileId,
          name: parent.name,
          isDefault: false,
        },
      });

      console.log(`✅ Created parent folder: ${parent.name}`);

      // Create all subfolders for this parent
      for (const subfolderName of subfolders) {
        await prisma.vaultFolder.create({
          data: {
            clerkId,
            profileId,
            name: subfolderName,
            parentId: parentFolder.id,
            isDefault: false,
          },
        });
      }

      console.log(`✅ Created ${subfolders.length} subfolders for: ${parent.name}`);
    }

    // Create "All Media" folder (standalone, no subfolders)
    await prisma.vaultFolder.create({
      data: {
        clerkId,
        profileId,
        name: "All Media",
        isDefault: true,
      },
    });

    console.log('✅ Created standalone folder: All Media');
    console.log('✅ [instagram-profiles] Default folder structure created successfully');
  } catch (error) {
    console.error('❌ [instagram-profiles] Error creating default folder structure:', error);
    // Don't throw - we don't want folder creation failure to fail profile creation
  }
}

export async function GET(request: NextRequest) {
  let userId: string | null = null;
  try {
    console.log('🔍 [instagram-profiles] Starting GET request');
    console.log('🔍 [instagram-profiles] Request URL:', request.url);
    console.log('🔍 [instagram-profiles] Request headers:', Object.fromEntries(request.headers.entries()));
    
    const auth_result = await auth();
    userId = auth_result.userId;
    
    console.log('🔍 [instagram-profiles] Auth result:', { userId, sessionId: auth_result.sessionId });

    if (!userId) {
      console.log('❌ [instagram-profiles] No userId found, returning 401');
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    console.log('✅ [instagram-profiles] User authenticated:', userId);

    console.log('✅ [instagram-profiles] User authenticated:', userId);

    // Get the user's current organization and check if they have CREATOR role
    console.log('🔍 [instagram-profiles] Fetching user organization and role...');
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { 
        currentOrganizationId: true,
        teamMemberships: {
          select: {
            role: true,
          },
        },
      },
    });
    console.log('🔍 [instagram-profiles] User organization:', user?.currentOrganizationId || 'none');

    // Check if user has CREATOR role (they could be creator in multiple orgs)
    const isCreator = user?.teamMemberships?.some(
      (membership) => membership.role === 'CREATOR'
    ) || false;
    console.log('🔍 [instagram-profiles] Is creator:', isCreator);

    let ownProfiles: any[] = [];
    let sharedProfiles: any[] = [];
    let assignedProfiles: any[] = [];

    if (isCreator) {
      // CREATORS only see profiles assigned to them
      console.log('🔍 [instagram-profiles] Fetching assigned profiles for creator...');
      assignedProfiles = await prisma.instagramProfile.findMany({
        where: {
          assignments: {
            some: {
              assignedToClerkId: userId,
            },
          },
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
      console.log('✅ [instagram-profiles] Assigned profiles count:', assignedProfiles.length);
    } else {
      // Regular users see their own profiles + organization profiles + assigned profiles
      // Get user's own profiles
      console.log('🔍 [instagram-profiles] Fetching own profiles...');
      ownProfiles = await prisma.instagramProfile.findMany({
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
      console.log('🔍 [instagram-profiles] Fetching shared profiles...');
      sharedProfiles = user?.currentOrganizationId
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

      // Get assigned profiles (profiles assigned to this user)
      console.log('🔍 [instagram-profiles] Fetching assigned profiles...');
      assignedProfiles = await prisma.instagramProfile.findMany({
        where: {
          assignments: {
            some: {
              assignedToClerkId: userId,
            },
          },
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
      });

      console.log('✅ [instagram-profiles] Own profiles count:', ownProfiles.length);
      console.log('✅ [instagram-profiles] Shared profiles count:', sharedProfiles.length);
      console.log('✅ [instagram-profiles] Assigned profiles count:', assignedProfiles.length);
    }

    // Get user's organization role (if they're in an org)
    let userOrgRole: string | null = null;
    if (user?.currentOrganizationId && !isCreator) {
      const teamMembership = await prisma.teamMember.findUnique({
        where: {
          userId_organizationId: {
            userId: (await prisma.user.findUnique({
              where: { clerkId: userId },
              select: { id: true },
            }))!.id,
            organizationId: user.currentOrganizationId,
          },
        },
        select: { role: true },
      });
      userOrgRole = teamMembership?.role || null;
      console.log('🔍 [instagram-profiles] User org role:', userOrgRole);
    }

    // Mark profiles appropriately
    let allProfiles: any[] = [];

    if (isCreator) {
      // For creators, mark all profiles as shared (since they're assigned, not owned)
      allProfiles = assignedProfiles.map(p => ({ 
        ...p, 
        isShared: true, 
        currentUserOrgRole: null 
      }));
    } else {
      // For regular users, combine own, shared, and assigned profiles
      const ownProfilesWithFlag = ownProfiles.map(p => ({ 
        ...p, 
        isShared: false, 
        currentUserOrgRole: null 
      }));
      const sharedProfilesWithFlag = sharedProfiles.map(p => ({ 
        ...p, 
        isShared: true, 
        currentUserOrgRole: userOrgRole 
      }));
      const assignedProfilesWithFlag = assignedProfiles.map(p => ({ 
        ...p, 
        isShared: true, 
        currentUserOrgRole: null 
      }));
      
      allProfiles = [...ownProfilesWithFlag, ...sharedProfilesWithFlag, ...assignedProfilesWithFlag];
    }
    
    console.log('✅ [instagram-profiles] Total profiles:', allProfiles.length);
    console.log('✅ [instagram-profiles] Returning profiles');

    return NextResponse.json(allProfiles);
  } catch (error) {
    console.error("Error fetching Instagram profiles:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      userId,
    });
    return NextResponse.json(
      { 
        error: "Failed to fetch profiles",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// POST - Create a new profile
export async function POST(request: NextRequest) {
  let userId: string | null = null;
  try {
    const auth_result = await auth();
    userId = auth_result.userId;

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
      metadata,
      tags,
      type, // "real", "ai", or "of_model"
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
        metadata: metadata || undefined,
        tags: tags || [],
        type: type || "real", // Default to "real" if not specified
        status: "pending", // All new profiles start as pending
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

    // Auto-create default folder structure for the new profile
    await createDefaultFolderStructure(newProfile.id, userId);

    return NextResponse.json(newProfile, { status: 201 });
  } catch (error) {
    console.error("Error creating profile:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      userId,
    });
    return NextResponse.json(
      { 
        error: "Failed to create profile",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
