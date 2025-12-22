import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";

// GET - Fetch all marketplace models (public endpoint for authenticated users)
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const models = await prisma.marketplaceModel.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Transform status to lowercase for frontend
    const transformedModels = models.map(model => ({
      ...model,
      status: model.status.toLowerCase(),
    }));

    return NextResponse.json(transformedModels);
  } catch (error) {
    console.error("Error fetching marketplace models:", error);
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}
