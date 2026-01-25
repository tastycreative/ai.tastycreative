import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get details for an OF model (accessible by anyone authenticated)
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify model exists
    const model = await prisma.ofModel.findUnique({
      where: { id },
      include: { details: true },
    });

    if (!model) {
      return NextResponse.json(
        { error: "OF model not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: model.details });
  } catch (error) {
    console.error("Error fetching OF model details:", error);
    return NextResponse.json(
      { error: "Failed to fetch details" },
      { status: 500 }
    );
  }
}

// PATCH - Update or create details for an OF model (accessible by anyone authenticated)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Verify model exists
    const model = await prisma.ofModel.findUnique({
      where: { id },
      include: { details: true },
    });

    if (!model) {
      return NextResponse.json(
        { error: "OF model not found" },
        { status: 404 }
      );
    }

    // Build update data
    const detailsData: any = {};
    const allowedFields = [
      "fullName",
      "age",
      "birthday",
      "height",
      "weight",
      "ethnicity",
      "timezone",
      "currentCity",
      "interests",
      "favoriteColors",
      "favoriteEmojis",
      "contentOffered",
      "customMinPrice",
      "videoCallMinPrice",
      "limitations",
      "verbiageRestrictions",
      "amazonWishlist",
      "onboardingCompleted",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "birthday") {
          detailsData[field] = body[field] ? new Date(body[field]) : null;
        } else {
          detailsData[field] = body[field];
        }
      }
    }

    // Upsert details
    const details = await prisma.ofModelDetails.upsert({
      where: { creatorId: id },
      update: detailsData,
      create: {
        creatorId: id,
        ...detailsData,
      },
    });

    return NextResponse.json({ data: details });
  } catch (error) {
    console.error("Error updating OF model details:", error);
    return NextResponse.json(
      { error: "Failed to update details" },
      { status: 500 }
    );
  }
}
