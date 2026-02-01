import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET - Export gallery items as CSV
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    // Parse filters
    const modelId = searchParams.get("modelId");
    const contentType = searchParams.get("contentType");
    const platform = searchParams.get("platform");
    const isArchived = searchParams.get("isArchived") === "true";
    const format = searchParams.get("format") || "csv"; // csv or json

    // Build where clause
    const where: Record<string, unknown> = {};
    if (modelId) where.modelId = modelId;
    if (contentType && contentType !== "all") where.contentType = contentType;
    if (platform && platform !== "all") where.platform = platform;
    where.isArchived = isArchived;

    // Fetch all matching items
    const items = await prisma.gallery_items.findMany({
      where,
      include: {
        model: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
      orderBy: { postedAt: "desc" },
    });

    if (format === "json") {
      // Return as JSON with download headers
      return new NextResponse(JSON.stringify(items, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="gallery-export-${new Date().toISOString().split('T')[0]}.json"`,
        },
      });
    }

    // Generate CSV
    const headers = [
      "ID",
      "Title",
      "Model Name",
      "Content Type",
      "Platform",
      "Price",
      "Revenue",
      "Sales Count",
      "View Count",
      "Conversion Rate",
      "Posted At",
      "Preview URL",
      "Caption",
      "Tags",
      "Origin",
      "Is Archived",
      "Created At",
    ];

    const escapeCSV = (value: string | null | undefined): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      // If contains comma, newline, or quote, wrap in quotes and escape internal quotes
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const formatDate = (date: Date | string | null): string => {
      if (!date) return "";
      return new Date(date).toISOString();
    };

    const rows = items.map((item) => [
      item.id,
      escapeCSV(item.title),
      escapeCSV(item.model?.displayName || item.model?.name),
      item.contentType,
      item.platform,
      item.pricingAmount ? Number(item.pricingAmount).toFixed(2) : "",
      item.revenue ? Number(item.revenue).toFixed(2) : "0",
      item.salesCount || 0,
      item.viewCount || 0,
      item.conversionRate ? Number(item.conversionRate).toFixed(4) : "",
      formatDate(item.postedAt),
      escapeCSV(item.previewUrl),
      escapeCSV(item.captionUsed),
      escapeCSV(item.tags?.join(", ")),
      item.origin || "",
      item.isArchived ? "Yes" : "No",
      formatDate(item.createdAt),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Return as CSV with download headers
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gallery-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting gallery:", error);
    return NextResponse.json(
      { error: "Failed to export gallery" },
      { status: 500 }
    );
  }
}
