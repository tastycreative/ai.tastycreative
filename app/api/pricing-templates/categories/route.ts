import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// GET - Get available categories and page types
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categories = [
      { value: "PORN_ACCURATE", label: "Porn Accurate", description: "Explicit content, straightforward pricing" },
      { value: "PORN_SCAM", label: "Porn Scam", description: "Explicit teasers, heavy paywalls" },
      { value: "GF_ACCURATE", label: "GF Accurate", description: "Girlfriend experience, authentic" },
      { value: "GF_SCAM", label: "GF Scam", description: "GF vibe with aggressive upselling" },
      { value: "BUNDLE_BASED", label: "Bundle Based", description: "Focus on content bundles" },
      { value: "CUSTOM", label: "Custom", description: "User-defined pricing category" },
    ];

    const pageTypes = [
      { value: "ALL_PAGES", label: "All Pages", description: "Applies to all page tiers" },
      { value: "FREE", label: "Free", description: "Free/freemium pages" },
      { value: "PAID", label: "Paid", description: "Standard paid subscription" },
      { value: "VIP", label: "VIP", description: "Premium/exclusive tier" },
    ];

    const priceTypes = [
      { value: "FIXED", label: "Fixed", description: "Single fixed price" },
      { value: "RANGE", label: "Range", description: "Price range (min to max)" },
      { value: "MINIMUM", label: "Minimum", description: "Starting from price" },
    ];

    return NextResponse.json({
      data: {
        categories,
        pageTypes,
        priceTypes,
      },
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
