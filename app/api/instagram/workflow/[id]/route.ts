// app/api/instagram/workflow/[id]/route.ts
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

// PATCH: Update a workflow phase
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, icon, color, order } = body;

    // Derive id from the request URL
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1];

    // Verify access via profile
    const existingPhase = await prisma.workflowPhase.findUnique({
      where: { id },
    });

    if (!existingPhase) {
      return NextResponse.json(
        { error: "Workflow phase not found" },
        { status: 404 }
      );
    }

    // Check access through the phase's profile
    if (existingPhase.profileId) {
      const { hasAccess } = await hasAccessToProfile(userId, existingPhase.profileId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (existingPhase.clerkId !== userId) {
      // Fallback to clerkId check for phases without profileId
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedPhase = await prisma.workflowPhase.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        description: description !== undefined ? description : undefined,
        icon: icon !== undefined ? icon : undefined,
        color: color !== undefined ? color : undefined,
        order: order !== undefined ? order : undefined,
        updatedAt: new Date(),
      },
      include: {
        items: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({ phase: updatedPhase });
  } catch (error) {
    console.error("Error updating workflow phase:", error);
    return NextResponse.json(
      { error: "Failed to update workflow phase" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a workflow phase
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Derive id from the request URL
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1];

    // Verify access via profile
    const existingPhase = await prisma.workflowPhase.findUnique({
      where: { id },
    });

    if (!existingPhase) {
      return NextResponse.json(
        { error: "Workflow phase not found" },
        { status: 404 }
      );
    }

    // Check access through the phase's profile
    if (existingPhase.profileId) {
      const { hasAccess } = await hasAccessToProfile(userId, existingPhase.profileId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (existingPhase.clerkId !== userId) {
      // Fallback to clerkId check for phases without profileId
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.workflowPhase.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Workflow phase deleted successfully" });
  } catch (error) {
    console.error("Error deleting workflow phase:", error);
    return NextResponse.json(
      { error: "Failed to delete workflow phase" },
      { status: 500 }
    );
  }
}
