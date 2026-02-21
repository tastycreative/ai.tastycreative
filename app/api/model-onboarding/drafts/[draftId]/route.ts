import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { draftId } = await params;

    const draft = await prisma.modelOnboardingDraft.findUnique({
      where: {
        id: draftId,
        clerkId: userId,
      },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    return NextResponse.json(draft);
  } catch (error) {
    console.error("Error fetching draft:", error);
    return NextResponse.json(
      { error: "Failed to fetch draft" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { draftId } = await params;
    const body = await request.json();

    // Check ownership
    const existing = await prisma.modelOnboardingDraft.findUnique({
      where: {
        id: draftId,
        clerkId: userId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    // Calculate completion percentage
    let completionPercentage = 0;
    const name = body.name !== undefined ? body.name : existing.name;
    const profileImageUrl = body.profileImageUrl !== undefined ? body.profileImageUrl : existing.profileImageUrl;
    const type = body.type !== undefined ? body.type : existing.type;
    const selectedContentTypes = body.selectedContentTypes !== undefined ? body.selectedContentTypes : existing.selectedContentTypes;
    const backstory = body.backstory !== undefined ? body.backstory : existing.backstory;
    const platformPricing = body.platformPricing !== undefined ? body.platformPricing : existing.platformPricing;

    if (name && profileImageUrl && type) completionPercentage += 50;
    if (selectedContentTypes && selectedContentTypes.length > 0) completionPercentage += 30;
    if (backstory) completionPercentage += 10;
    if (platformPricing) completionPercentage += 10;

    // Filter out contactEmail and other unknown fields (contactEmail should be in modelBible.preferredEmail)
    const { contactEmail, ...validUpdateData } = body;

    const draft = await prisma.modelOnboardingDraft.update({
      where: {
        id: draftId,
      },
      data: {
        ...validUpdateData,
        completionPercentage,
        lastAutoSaveAt: body.lastAutoSaveAt ? new Date(body.lastAutoSaveAt) : undefined,
      },
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error("Error updating draft:", error);
    return NextResponse.json(
      { error: "Failed to update draft" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { draftId } = await params;

    // Check ownership
    const existing = await prisma.modelOnboardingDraft.findUnique({
      where: {
        id: draftId,
        clerkId: userId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    await prisma.modelOnboardingDraft.delete({
      where: {
        id: draftId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting draft:", error);
    return NextResponse.json(
      { error: "Failed to delete draft" },
      { status: 500 }
    );
  }
}
