// app/api/instagram/workflow/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// Helper function to check if user has access to a profile (owner or shared via organization)
async function hasAccessToProfile(userId: string, profileId: string): Promise<{hasAccess: boolean, profile: any}> {
  const profile = await prisma.instagramProfile.findUnique({
    where: { id: profileId },
  });

  if (!profile) return { hasAccess: false, profile: null };

  // Check if user owns the profile
  if (profile.clerkId === userId) {
    return { hasAccess: true, profile };
  }

  // Check if profile is shared via organization
  if (profile.organizationId) {
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, currentOrganizationId: true },
    });

    if (currentUser) {
      if (currentUser.currentOrganizationId === profile.organizationId) {
        return { hasAccess: true, profile };
      }

      const membership = await prisma.teamMember.findFirst({
        where: {
          userId: currentUser.id,
          organizationId: profile.organizationId,
        },
      });

      if (membership) {
        return { hasAccess: true, profile };
      }
    }
  }

  return { hasAccess: false, profile: null };
}

// Helper to get all accessible profile IDs for a user
async function getAccessibleProfileIds(userId: string): Promise<string[]> {
  // Get user's own profiles
  const ownProfiles = await prisma.instagramProfile.findMany({
    where: { clerkId: userId },
    select: { id: true },
  });

  // Get user from database to check organization memberships
  const currentUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, currentOrganizationId: true },
  });

  let organizationIds: string[] = [];

  if (currentUser) {
    // Get all organizations the user is a member of
    const memberships = await prisma.teamMember.findMany({
      where: { userId: currentUser.id },
      select: { organizationId: true },
    });

    organizationIds = memberships
      .map(m => m.organizationId)
      .filter((id): id is string => id !== null);

    // Add current organization if set
    if (currentUser.currentOrganizationId && !organizationIds.includes(currentUser.currentOrganizationId)) {
      organizationIds.push(currentUser.currentOrganizationId);
    }
  }
  
  const sharedProfiles = organizationIds.length > 0
    ? await prisma.instagramProfile.findMany({
        where: {
          organizationId: { in: organizationIds },
          clerkId: { not: userId }, // Exclude own profiles to avoid duplicates
        },
        select: { id: true },
      })
    : [];

  return [...ownProfiles, ...sharedProfiles].map(p => p.id);
}

// GET: Fetch user's workflow phases and items
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    const isAllProfiles = !profileId || profileId === "all";

    // Get all accessible profile IDs (owned + shared)
    const accessibleProfileIds = await getAccessibleProfileIds(userId);

    // If specific profile requested, verify access
    if (profileId && profileId !== "all") {
      const { hasAccess } = await hasAccessToProfile(userId, profileId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Unauthorized to access this profile" }, { status: 403 });
      }
    }

    const whereClause: any = {
      profileId: profileId && profileId !== "all" 
        ? profileId 
        : { in: accessibleProfileIds },
    };

    // If fetching all profiles, build a profile map for names
    let profileMap: Record<string, string> = {};
    if (isAllProfiles) {
      const profiles = await prisma.instagramProfile.findMany({
        where: { id: { in: accessibleProfileIds } },
        select: { id: true, name: true },
      });
      profileMap = profiles.reduce((acc, profile) => {
        acc[profile.id] = profile.name;
        return acc;
      }, {} as Record<string, string>);
    }

    const phases = await prisma.workflowPhase.findMany({
      where: whereClause,
      include: {
        items: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    });

    // Add profileName to each phase if in all profiles mode
    const phasesWithProfile = isAllProfiles
      ? phases.map((phase) => ({
          ...phase,
          profileName: profileMap[phase.profileId] || "Unknown Profile",
        }))
      : phases;

    return NextResponse.json({ phases: phasesWithProfile });
  } catch (error) {
    console.error("Error fetching workflow:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflow" },
      { status: 500 }
    );
  }
}

// POST: Create a new workflow phase
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, icon, color, order, profileId } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // Determine the target clerkId - if this is a shared profile, use the profile owner's clerkId
    let targetClerkId = userId;
    if (profileId) {
      const { hasAccess, profile } = await hasAccessToProfile(userId, profileId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Unauthorized to access this profile" }, { status: 403 });
      }
      // Use the profile owner's clerkId for data association
      targetClerkId = profile.clerkId;
    }

    const phase = await prisma.workflowPhase.create({
      data: {
        clerkId: targetClerkId,
        profileId: profileId || "",
        name,
        description,
        icon: icon || "Circle",
        color: color || "blue",
        order: order ?? 0,
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({ phase }, { status: 201 });
  } catch (error) {
    console.error("Error creating workflow phase:", error);
    return NextResponse.json(
      { error: "Failed to create workflow phase" },
      { status: 500 }
    );
  }
}
