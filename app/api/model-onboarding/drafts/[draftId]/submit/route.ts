import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { draftId } = await params;

    // Fetch the draft
    const draft = await prisma.modelOnboardingDraft.findUnique({
      where: {
        id: draftId,
        clerkId: userId,
      },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    // Validate required fields
    if (!draft.name || !draft.profileImageUrl || !draft.type) {
      return NextResponse.json(
        { error: "Missing required fields: name, profileImageUrl, type" },
        { status: 400 }
      );
    }

    if (!draft.selectedContentTypes || draft.selectedContentTypes.length === 0) {
      return NextResponse.json(
        { error: "At least one content type is required" },
        { status: 400 }
      );
    }

    // Build modelBible from draft data
    const modelBible: any = {};

    // Basic Info
    if (draft.age) modelBible.age = draft.age;
    if (draft.birthday) modelBible.birthday = draft.birthday;
    if (draft.location) modelBible.location = draft.location;
    if (draft.nationality) modelBible.nationality = draft.nationality;
    if (draft.ethnicity) modelBible.ethnicity = draft.ethnicity;
    if (draft.occupation) modelBible.occupation = draft.occupation;
    if (draft.relationshipStatus) modelBible.relationshipStatus = draft.relationshipStatus;
    
    // Background
    if (draft.backstory) modelBible.backstory = draft.backstory;
    if (draft.interests) modelBible.interests = draft.interests;
    
    // Content
    if (draft.primaryNiche) modelBible.primaryNiche = draft.primaryNiche;
    if (draft.feedAesthetic) modelBible.feedAesthetic = draft.feedAesthetic;
    if (draft.commonThemes) modelBible.commonThemes = draft.commonThemes;
    if (draft.uniqueHook) modelBible.uniqueHook = draft.uniqueHook;
    
    // Pricing
    if (draft.platformPricing) modelBible.platformPricing = draft.platformPricing;
    
    // Platforms
    if (draft.platforms) modelBible.platforms = draft.platforms;
    if (draft.socials) modelBible.socials = draft.socials;
    
    // Additional
    if (draft.restrictions) modelBible.restrictions = draft.restrictions;
    if (draft.schedule) modelBible.schedule = draft.schedule;
    if (draft.internalNotes) modelBible.internalNotes = draft.internalNotes;

    // Merge with any additional modelBible data from draft
    if (draft.modelBible) {
      Object.assign(modelBible, draft.modelBible);
    }

    // Create the InstagramProfile
    const profile = await prisma.instagramProfile.create({
      data: {
        clerkId: userId,
        name: draft.name,
        description: draft.description || undefined,
        instagramUsername: draft.instagramUsername || undefined,
        profileImageUrl: draft.profileImageUrl,
        type: draft.type,
        selectedContentTypes: draft.selectedContentTypes,
        customContentTypes: draft.customContentTypes,
        modelBible: Object.keys(modelBible).length > 0 ? modelBible : undefined,
        status: "active",
        isDefault: false,
      },
    });

    // Update draft status
    await prisma.modelOnboardingDraft.update({
      where: {
        id: draft.id,
      },
      data: {
        status: "COMPLETED",
        submittedAt: new Date(),
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ profileId: profile.id });
  } catch (error) {
    console.error("Error submitting draft:", error);
    return NextResponse.json(
      { error: "Failed to submit draft" },
      { status: 500 }
    );
  }
}
