// app/api/instagram/workflow/init-template/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

const DEFAULT_TEMPLATE = [
  {
    name: "1. Idea & Planning",
    description: "Brainstorm and plan your content concept",
    icon: "Lightbulb",
    color: "yellow",
    order: 0,
    items: [
      "Define content goal and target audience",
      "Research trending topics in your niche",
      "Choose content format (Reel, Story, Feed Post)",
      "Write content brief or script outline",
      "Select hook and CTA from formulas",
      "Plan visual style and aesthetic",
      "Choose hashtags from Hashtag Bank",
    ],
  },
  {
    name: "2. Filming & Capture",
    description: "Shoot your content with proper setup",
    icon: "Video",
    color: "red",
    order: 1,
    items: [
      "Check lighting setup and adjust",
      "Test audio quality and reduce background noise",
      "Clean camera lens",
      "Record multiple takes and angles",
      "Capture B-roll footage",
      "Check footage quality before wrapping",
      "Backup raw files immediately",
    ],
  },
  {
    name: "3. Editing & Enhancement",
    description: "Edit and polish your content",
    icon: "Scissors",
    color: "purple",
    order: 2,
    items: [
      "Import footage and organize clips",
      "Cut and arrange timeline for pacing",
      "Add transitions and effects",
      "Add text overlays and captions",
      "Sync audio or add music",
      "Color correct and grade footage",
      "Export in correct format (1080x1920 for Reels)",
    ],
  },
  {
    name: "4. Review & Quality Check",
    description: "Review content for quality and compliance",
    icon: "Eye",
    color: "blue",
    order: 3,
    items: [
      "Watch full video without distractions",
      "Check audio sync and quality",
      "Verify text is readable on mobile",
      "Ensure branding is consistent",
      "Check for typos or errors",
      "Verify content aligns with brand guidelines",
      "Get team feedback if needed",
    ],
  },
  {
    name: "5. Approval & Finalization",
    description: "Get final approval and prepare caption",
    icon: "CheckCheck",
    color: "green",
    order: 4,
    items: [
      "Get approval from content lead/manager",
      "Write engaging caption",
      "Add relevant hashtags (10-15 recommended)",
      "Draft compelling CTA",
      "Tag relevant accounts if applicable",
      "Add location tag if relevant",
      "Save final version to content library",
    ],
  },
  {
    name: "6. Scheduling & Timing",
    description: "Schedule content for optimal posting time",
    icon: "Calendar",
    color: "orange",
    order: 5,
    items: [
      "Choose optimal posting time from best times",
      "Upload to scheduling tool or Instagram",
      "Add to Weekly Calendar view",
      "Set reminder for posting time",
      "Prepare first comment if needed",
      "Double-check scheduled date/time",
      "Update Content Pipeline status",
    ],
  },
  {
    name: "7. Posted & Engagement",
    description: "Post content and engage with audience",
    icon: "Send",
    color: "pink",
    order: 6,
    items: [
      "Confirm post went live successfully",
      "Share to Stories to boost reach",
      "Respond to early comments (first 30 mins critical)",
      "Engage with similar content to boost algorithm",
      "Monitor performance in first hour",
      "Track metrics in Performance Tracker",
      "Save high-performing content for future reference",
    ],
  },
];

// POST: Initialize user's workflow with default template
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get profileId from request body
    const body = await request.json();
    const profileId = body.profileId || "";

    // Check if user already has phases for this profile
    const whereClause = profileId && profileId !== "all"
      ? { clerkId: user.id, profileId }
      : { clerkId: user.id, profileId: "" };

    const existingPhases = await prisma.workflowPhase.findMany({
      where: whereClause,
    });

    if (existingPhases.length > 0) {
      return NextResponse.json(
        { error: "Workflow already exists for this profile" },
        { status: 400 }
      );
    }

    // Create phases with items
    for (const template of DEFAULT_TEMPLATE) {
      const phase = await prisma.workflowPhase.create({
        data: {
          clerkId: user.id,
          profileId: profileId || "",
          name: template.name,
          description: template.description,
          icon: template.icon,
          color: template.color,
          order: template.order,
        },
      });

      // Create items for this phase
      for (let i = 0; i < template.items.length; i++) {
        await prisma.workflowCheckItem.create({
          data: {
            phaseId: phase.id,
            text: template.items[i],
            order: i,
            checked: false,
          },
        });
      }
    }

    // Fetch the created workflow
    const phases = await prisma.workflowPhase.findMany({
      where: whereClause,
      include: {
        items: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ phases }, { status: 201 });
  } catch (error) {
    console.error("Error initializing workflow template:", error);
    return NextResponse.json(
      { error: "Failed to initialize workflow template" },
      { status: 500 }
    );
  }
}
