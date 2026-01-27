// app/api/instagram/workflow/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// GET: Fetch user's workflow phases and items
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    const isAllProfiles = !profileId || profileId === "all";

    const whereClause: any = {
      clerkId: user.id,
    };

    if (profileId && profileId !== "all") {
      whereClause.profileId = profileId;
    }

    // If fetching all profiles, build a profile map for names
    let profileMap: Record<string, string> = {};
    if (isAllProfiles) {
      const profiles = await prisma.instagramProfile.findMany({
        where: { clerkId: user.id },
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
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, icon, color, order, profileId } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const phase = await prisma.workflowPhase.create({
      data: {
        clerkId: user.id,
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
