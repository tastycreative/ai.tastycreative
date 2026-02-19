import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const drafts = await prisma.modelOnboardingDraft.findMany({
      where: {
        clerkId: userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json(drafts);
  } catch (error) {
    console.error("Error fetching drafts:", error);
    return NextResponse.json(
      { error: "Failed to fetch drafts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Calculate completion percentage
    let completionPercentage = 0;
    if (body.name && body.profileImageUrl && body.type) completionPercentage += 50;
    if (body.selectedContentTypes && body.selectedContentTypes.length > 0) completionPercentage += 30;
    if (body.backstory) completionPercentage += 10;
    if (body.platformPricing) completionPercentage += 10;

    const draft = await prisma.modelOnboardingDraft.create({
      data: {
        clerkId: userId,
        createdByClerkId: userId,
        status: body.status || "DRAFT",
        currentStep: body.currentStep || 1,
        completionPercentage,
        
        // Basic Info
        name: body.name,
        description: body.description,
        instagramUsername: body.instagramUsername,
        profileImageUrl: body.profileImageUrl,
        type: body.type || "real",
        
        // Background
        age: body.age,
        birthday: body.birthday,
        location: body.location,
        nationality: body.nationality,
        ethnicity: body.ethnicity,
        occupation: body.occupation,
        relationshipStatus: body.relationshipStatus,
        backstory: body.backstory,
        interests: body.interests || [],
        
        // Content
        selectedContentTypes: body.selectedContentTypes || [],
        customContentTypes: body.customContentTypes || [],
        primaryNiche: body.primaryNiche,
        feedAesthetic: body.feedAesthetic,
        commonThemes: body.commonThemes,
        uniqueHook: body.uniqueHook,
        
        // Pricing & Platforms
        platformPricing: body.platformPricing,
        platforms: body.platforms,
        socials: body.socials,
        
        // Additional
        modelBible: body.modelBible,
        restrictions: body.restrictions,
        schedule: body.schedule,
        internalNotes: body.internalNotes,
      },
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error("Error creating draft:", error);
    return NextResponse.json(
      { error: "Failed to create draft" },
      { status: 500 }
    );
  }
}
