import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

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

    // Get the user's current organization
    console.log('🔍 [instagram-profiles] Fetching user organization...');
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });
    console.log('🔍 [instagram-profiles] User organization:', user?.currentOrganizationId || 'none');

    // Get user's own profiles
    console.log('🔍 [instagram-profiles] Fetching own profiles...');
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
    console.log('🔍 [instagram-profiles] Fetching shared profiles...');
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

    console.log('✅ [instagram-profiles] Own profiles count:', ownProfiles.length);
    console.log('✅ [instagram-profiles] Shared profiles count:', sharedProfiles.length);

    // Mark profiles as owned or shared
    const ownProfilesWithFlag = ownProfiles.map(p => ({ ...p, isShared: false }));
    const sharedProfilesWithFlag = sharedProfiles.map(p => ({ ...p, isShared: true }));

    // Combine and return all accessible profiles
    const allProfiles = [...ownProfilesWithFlag, ...sharedProfilesWithFlag];
    
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
