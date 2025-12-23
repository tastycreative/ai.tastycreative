import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// GET all hashtag sets for the user
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sets = await prisma.hashtagSet.findMany({
      where: { clerkId: userId },
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
