// app/api/instagram/workflow/items/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// Helper function to check if user has access to a profile (owner or shared via organization)
async function hasAccessToProfile(userId: string, profileId: string): Promise<{hasAccess: boolean, profile: any}> {
  const user = await currentUser();
  if (!user) return { hasAccess: false, profile: null };

  const profile = await prisma.instagramProfile.findUnique({
    where: { id: profileId },
  });

  if (!profile) return { hasAccess: false, profile: null };

  // Check if user owns the profile
  if (profile.clerkId === userId) {
    return { hasAccess: true, profile };
  }

  // Check if profile is shared via organization
  if (profile.organizationId && user.organizationMemberships) {
    const userOrgIds = user.organizationMemberships.map((m: any) => m.organization.id);
    if (userOrgIds.includes(profile.organizationId)) {
      return { hasAccess: true, profile };
    }
  }

  return { hasAccess: false, profile: null };
}

// POST: Create a new checklist item
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { phaseId, text, order } = body;

    if (!phaseId || !text) {
      return NextResponse.json(
        { error: "phaseId and text are required" },
        { status: 400 }
      );
    }

    // Verify phase access via profile
    const phase = await prisma.workflowPhase.findUnique({
      where: { id: phaseId },
    });

    if (!phase) {
      return NextResponse.json(
        { error: "Phase not found" },
        { status: 404 }
      );
    }

    // Check access through the phase's profile
    if (phase.profileId) {
      const { hasAccess } = await hasAccessToProfile(user.id, phase.profileId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (phase.clerkId !== user.id) {
      // Fallback to clerkId check for phases without profileId
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const item = await prisma.workflowCheckItem.create({
      data: {
        phaseId,
        text,
        order: order ?? 0,
        checked: false,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Error creating checklist item:", error);
    return NextResponse.json(
      { error: "Failed to create checklist item" },
      { status: 500 }
    );
  }
}
