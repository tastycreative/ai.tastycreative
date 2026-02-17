import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET - Lightweight list of profiles (id, name, type) for dropdowns
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's current organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    // Fetch own profiles + org-shared profiles (lightweight)
    const profiles = await prisma.instagramProfile.findMany({
      where: {
        OR: [
          { clerkId: userId },
          ...(user?.currentOrganizationId
            ? [{ organizationId: user.currentOrganizationId }]
            : []),
        ],
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(profiles);
  } catch (error) {
    console.error("Error fetching profiles list:", error);
    return NextResponse.json(
      { error: "Failed to fetch profiles" },
      { status: 500 }
    );
  }
}
