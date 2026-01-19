import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// POST - Bulk import captions from CSV/JSON
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { profileId, captions, format = "json" } = body;

    if (!profileId || !captions || !Array.isArray(captions)) {
      return NextResponse.json(
        { error: "Profile ID and captions array are required" },
        { status: 400 }
      );
    }

    // Verify profile belongs to user
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        clerkId: userId,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found or unauthorized" },
        { status: 404 }
      );
    }

    // Validate and transform captions
    const validCaptions = captions.filter((c: {
      caption?: string;
      captionCategory?: string;
      captionTypes?: string;
      captionBanks?: string;
    }) => 
      c.caption && c.captionCategory && c.captionTypes && c.captionBanks
    );

    if (validCaptions.length === 0) {
      return NextResponse.json(
        { error: "No valid captions found. Each caption must have: caption, captionCategory, captionTypes, captionBanks" },
        { status: 400 }
      );
    }

    // Check for duplicates
    const existingCaptions = await prisma.caption.findMany({
      where: {
        profileId,
        clerkId: userId,
      },
      select: {
        caption: true,
      },
    });

    const existingCaptionTexts = new Set(existingCaptions.map(c => c.caption.trim().toLowerCase()));
    
    const newCaptions = validCaptions.filter((c: { caption: string }) => 
      !existingCaptionTexts.has(c.caption.trim().toLowerCase())
    );

    const duplicateCount = validCaptions.length - newCaptions.length;

    // Create captions in bulk
    const createdCaptions = await prisma.caption.createMany({
      data: newCaptions.map((c: {
        caption: string;
        captionCategory: string;
        captionTypes: string;
        captionBanks: string;
        isFavorite?: boolean;
        notes?: string;
        tags?: string;
      }) => ({
        clerkId: userId,
        profileId,
        caption: c.caption.trim(),
        captionCategory: c.captionCategory,
        captionTypes: c.captionTypes,
        captionBanks: c.captionBanks,
        isFavorite: c.isFavorite || false,
        notes: c.notes || null,
        tags: c.tags || null,
      })),
    });

    return NextResponse.json({
      success: true,
      imported: createdCaptions.count,
      duplicatesSkipped: duplicateCount,
      totalProcessed: validCaptions.length,
    }, { status: 201 });
  } catch (error) {
    console.error("Error bulk importing captions:", error);
    return NextResponse.json(
      { error: "Failed to import captions" },
      { status: 500 }
    );
  }
}

// GET - Export captions as JSON/CSV
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const format = searchParams.get("format") || "json";
    const category = searchParams.get("category");
    const type = searchParams.get("type");
    const bank = searchParams.get("bank");
    const favoritesOnly = searchParams.get("favoritesOnly") === "true";

    if (!profileId) {
      return NextResponse.json(
        { error: "Profile ID is required" },
        { status: 400 }
      );
    }

    // Verify profile belongs to user
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        clerkId: userId,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found or unauthorized" },
        { status: 404 }
      );
    }

    // Build query filters
    const where: {
      profileId: string;
      clerkId: string;
      captionCategory?: string;
      captionTypes?: string;
      captionBanks?: string;
      isFavorite?: boolean;
    } = {
      profileId,
      clerkId: userId,
    };

    if (category && category !== "All") {
      where.captionCategory = category;
    }
    if (type && type !== "All") {
      where.captionTypes = type;
    }
    if (bank && bank !== "All") {
      where.captionBanks = bank;
    }
    if (favoritesOnly) {
      where.isFavorite = true;
    }

    const captions = await prisma.caption.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        caption: true,
        captionCategory: true,
        captionTypes: true,
        captionBanks: true,
        usageCount: true,
        isFavorite: true,
        lastUsedAt: true,
        notes: true,
        tags: true,
        createdAt: true,
      },
    });

    if (format === "csv") {
      // Generate CSV
      const headers = ["Caption", "Category", "Type", "Bank", "Usage Count", "Is Favorite", "Last Used", "Notes", "Tags", "Created At"];
      const csvRows = [
        headers.join(","),
        ...captions.map(c => [
          `"${c.caption.replace(/"/g, '""')}"`,
          `"${c.captionCategory}"`,
          `"${c.captionTypes}"`,
          `"${c.captionBanks}"`,
          c.usageCount,
          c.isFavorite,
          c.lastUsedAt ? new Date(c.lastUsedAt).toISOString() : "",
          `"${(c.notes || "").replace(/"/g, '""')}"`,
          `"${c.tags || ""}"`,
          new Date(c.createdAt).toISOString(),
        ].join(","))
      ];

      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="captions-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      profileName: profile.name,
      exportedAt: new Date().toISOString(),
      totalCaptions: captions.length,
      captions,
    });
  } catch (error) {
    console.error("Error exporting captions:", error);
    return NextResponse.json(
      { error: "Failed to export captions" },
      { status: 500 }
    );
  }
}
