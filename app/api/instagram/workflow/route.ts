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

    const whereClause: any = {
      clerkId: user.id,
    };

    if (profileId && profileId !== "all") {
      whereClause.profileId = profileId;
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

    return NextResponse.json({ phases });
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
