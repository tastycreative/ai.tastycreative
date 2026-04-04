import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { read, utils, type WorkBook } from "xlsx";

/**
 * CST - Post Generation Harvest Caption Bank
 * All sheets: Col D (index 3) = Edited Caption, Col B (index 1) = Label
 * Row 0 = title, Row 1 = headers, Row 2+ = data
 */

interface SheetConfig {
  sheetName: string;
  /** Display name for captionTypes */
  displayName: string;
  /** Column index for caption text (0-based) */
  captionCol: number | number[];
  /** Column index for label (0-based) */
  labelCol?: number;
  /** Row to start reading data (0-based, skipping headers) */
  dataStartRow: number;
}

// Sheets to skip (non-content)
const SKIP_SHEETS = new Set([
  "⚙️ Settings",
  "Tracker",
  "Label Status Tracker",
  "Restricted Words & Emojis",
  "TEMPLATE",
]);

const SHEET_CONFIGS: SheetConfig[] = [
  "Short", "Descriptive", "Bundle", "Winner", "List", "Holiday",
  "Short (GF)", "Descriptive (GF)", "Bundle (GF)", "List (GF)", "Winner (GF)",
  "Tip Me CTA", "Tip Me Post", "New Sub", "Expired Sub",
  "Livestream", "VIP Membership", "Holiday Non-PPV", "1 Fan Tip Campaign", "Games",
  "DM Funnel", "GIF Bumps", "Renew Post",
  "Holiday (GF)", "Tip Me Post (GF)", "Tip Me CTA (GF)", "Livestream (GF)",
  "GIF Bump (GF)", "Holiday Non-PPV (GF)", "Renew Post (GF)",
  "New Sub (GF)", "Expired Sub (GF)",
  "GF Non-Explicit", "Public Captions", "Timebound", "SOP Captions",
].map((name) => ({
  sheetName: name,
  displayName: name,
  captionCol: 3, // Col D = Edited Caption
  labelCol: 1,   // Col B = Label
  dataStartRow: 2, // Row 0 = title, Row 1 = headers, Row 2+ = data
}));

function extractCaptionsFromSheet(
  workbook: WorkBook,
  config: SheetConfig,
): Array<{ caption: string; label: string; sheetName: string }> {
  const sheet = workbook.Sheets[config.sheetName];
  if (!sheet) return [];

  const rows: unknown[][] = utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  const results: Array<{ caption: string; label: string; sheetName: string }> = [];

  for (let i = config.dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const cols = Array.isArray(config.captionCol) ? config.captionCol : [config.captionCol];

    for (const col of cols) {
      const rawText = row[col];
      if (rawText == null) continue;
      const text = String(rawText).trim();
      if (!text || text.length < 5) continue; // Skip very short/empty entries

      const label = config.labelCol != null ? String(row[config.labelCol] || "").trim() : "";

      results.push({
        caption: text,
        label,
        sheetName: config.displayName,
      });
    }
  }

  return results;
}

// POST - Import captions from xlsx file
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Get user and org context
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, clerkId: true, currentOrganizationId: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Parse xlsx
    const arrayBuffer = await file.arrayBuffer();
    const workbook = read(arrayBuffer, { type: "array" });

    // Build configs: use predefined + auto-detect remaining content sheets
    const configMap = new Map(SHEET_CONFIGS.map((c) => [c.sheetName, c]));
    const allConfigs = [...SHEET_CONFIGS];

    for (const name of workbook.SheetNames) {
      if (SKIP_SHEETS.has(name) || configMap.has(name)) continue;
      // Auto-detect: check if row 1 has "EDITED CAPTION" in col D
      const sheet = workbook.Sheets[name];
      if (!sheet) continue;
      const rows: unknown[][] = utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
      const headerRow = rows[1];
      if (headerRow && String(headerRow[3] || "").toUpperCase().includes("EDITED CAPTION")) {
        allConfigs.push({ sheetName: name, displayName: name, captionCol: 3, labelCol: 1, dataStartRow: 2 });
      }
    }

    // Extract captions from all target sheets
    const allCaptions: Array<{ caption: string; label: string; sheetName: string }> = [];
    const sheetStats: Record<string, number> = {};

    for (const config of allConfigs) {
      const sheetCaptions = extractCaptionsFromSheet(workbook, config);
      sheetStats[config.displayName] = sheetCaptions.length;
      allCaptions.push(...sheetCaptions);
    }

    if (allCaptions.length === 0) {
      return NextResponse.json({
        success: true,
        imported: 0,
        duplicatesSkipped: 0,
        totalProcessed: 0,
        sheetStats,
        message: "No captions found in the expected sheets",
      });
    }

    // Get existing imported captions for deduplication (org-scoped)
    const existingCaptions = await prisma.caption.findMany({
      where: {
        sourceType: "spreadsheet_import",
        ...(user.currentOrganizationId
          ? { organizationId: user.currentOrganizationId }
          : { clerkId: userId }),
      },
      select: { caption: true },
    });
    const existingSet = new Set(
      existingCaptions.map((c) => c.caption.trim().toLowerCase()),
    );

    // Also deduplicate within the import itself
    const seenInImport = new Set<string>();
    const newCaptions: Array<{ caption: string; label: string; sheetName: string }> = [];
    let duplicateCount = 0;

    for (const item of allCaptions) {
      const normalized = item.caption.trim().toLowerCase();
      if (existingSet.has(normalized) || seenInImport.has(normalized)) {
        duplicateCount++;
        continue;
      }
      seenInImport.add(normalized);
      newCaptions.push(item);
    }

    // Batch insert (Prisma createMany has a limit, so chunk at 500)
    const BATCH_SIZE = 500;
    let totalInserted = 0;

    for (let i = 0; i < newCaptions.length; i += BATCH_SIZE) {
      const batch = newCaptions.slice(i, i + BATCH_SIZE);
      const result = await prisma.caption.createMany({
        data: batch.map((item) => ({
          clerkId: userId,
          organizationId: user.currentOrganizationId || undefined,
          caption: item.caption.trim(),
          captionCategory: item.label || item.sheetName,
          captionTypes: item.sheetName,
          captionBanks: "CST - Post Generation Harvest Caption Bank",
          sourceType: "spreadsheet_import",
          notes: `Imported from sheet: ${item.sheetName}`,
        })),
      });
      totalInserted += result.count;
    }

    return NextResponse.json({
      success: true,
      imported: totalInserted,
      duplicatesSkipped: duplicateCount,
      totalProcessed: allCaptions.length,
      sheetStats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[captions/import-xlsx] Error:", message, stack);
    return NextResponse.json(
      { error: "Failed to import xlsx", details: message },
      { status: 500 },
    );
  }
}
