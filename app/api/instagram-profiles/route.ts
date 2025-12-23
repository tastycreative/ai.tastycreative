import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const profiles = await prisma.instagramProfile.findMany({
      where: {
        clerkId: userId,
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        instagramUsername: true,
        profileImageUrl: true,
        isDefault: true,
      },
    });

    return NextResponse.json(profiles);
  } catch (error) {
    console.error("Error fetching Instagram profiles:", error);
    return NextResponse.json(
      { error: "Failed to fetch profiles" },
      { status: 500 }
    );
  }
}
