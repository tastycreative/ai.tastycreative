// app/api/instagram/workflow/items/[id]/route.ts
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

// PATCH: Update a checklist item
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { text, order, checked } = body;

    // Derive id from request URL
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1];

    // Verify access through phase's profile
    const existingItem = await prisma.workflowCheckItem.findUnique({
      where: { id },
      include: { phase: true },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Checklist item not found" },
        { status: 404 }
      );
    }

    // Check access through the phase's profile
    if (existingItem.phase.profileId) {
      const { hasAccess } = await hasAccessToProfile(userId, existingItem.phase.profileId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (existingItem.phase.clerkId !== userId) {
      // Fallback to clerkId check for phases without profileId
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedItem = await prisma.workflowCheckItem.update({
      where: { id },
      data: {
        text: text !== undefined ? text : undefined,
        order: order !== undefined ? order : undefined,
        checked: checked !== undefined ? checked : undefined,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ item: updatedItem });
  } catch (error) {
    console.error("Error updating checklist item:", error);
    return NextResponse.json(
      { error: "Failed to update checklist item" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a checklist item
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Derive id from request URL
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1];

    // Verify access through phase's profile
    const existingItem = await prisma.workflowCheckItem.findUnique({
      where: { id },
      include: { phase: true },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Checklist item not found" },
        { status: 404 }
      );
    }

    // Check access through the phase's profile
    if (existingItem.phase.profileId) {
      const { hasAccess } = await hasAccessToProfile(userId, existingItem.phase.profileId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (existingItem.phase.clerkId !== userId) {
      // Fallback to clerkId check for phases without profileId
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.workflowCheckItem.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Checklist item deleted successfully" });
  } catch (error) {
    console.error("Error deleting checklist item:", error);
    return NextResponse.json(
      { error: "Failed to delete checklist item" },
      { status: 500 }
    );
  }
}
