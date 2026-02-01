import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// Helper to get all accessible clerkIds for a user (self + organization members who share profiles)
async function getAccessibleClerkIds(userId: string): Promise<string[]> {
  const clerkIds = [userId];
  
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
  
  if (organizationIds.length > 0) {
    // Get unique clerkIds from profiles shared with the user's organizations
    const sharedProfiles = await prisma.instagramProfile.findMany({
      where: {
        organizationId: { in: organizationIds },
        clerkId: { not: userId },
      },
      select: { clerkId: true },
      distinct: ['clerkId'],
    });
    
    sharedProfiles.forEach(p => {
      if (!clerkIds.includes(p.clerkId)) {
        clerkIds.push(p.clerkId);
      }
    });
  }

  return clerkIds;
}

// GET all hashtag sets for the user (includes shared organization members' sets)
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get accessible clerkIds (self + org members who share profiles)
    const accessibleClerkIds = await getAccessibleClerkIds(userId);

    const sets = await prisma.hashtagSet.findMany({
      where: { clerkId: { in: accessibleClerkIds } },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ sets });
  } catch (error) {
    console.error("Error fetching hashtag sets:", error);
    return NextResponse.json(
      { error: "Failed to fetch hashtag sets" },
      { status: 500 }
    );
  }
}

// POST new hashtag set
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, category, description, icon, color, hashtags, order } = body;

    if (!name || !category) {
      return NextResponse.json(
        { error: "Name and category are required" },
        { status: 400 }
      );
    }

    const set = await prisma.hashtagSet.create({
      data: {
        clerkId: userId,
        name,
        category,
        description,
        icon: icon || "Hash",
        color: color || "blue",
        hashtags: hashtags || [],
        order: order ?? 0,
      },
    });

    return NextResponse.json({ set });
  } catch (error) {
    console.error("Error creating hashtag set:", error);
    return NextResponse.json(
      { error: "Failed to create hashtag set" },
      { status: 500 }
    );
  }
}
