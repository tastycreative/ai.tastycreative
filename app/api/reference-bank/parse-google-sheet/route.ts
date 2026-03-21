import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Read a public Google Sheet and extract Instagram URLs from it
// The sheet must be shared as "Anyone with the link can view"

const SHEETS_URL_PATTERN =
  /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;

const INSTAGRAM_URL_PATTERN =
  /https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p|reel|reels)\/[A-Za-z0-9_-]+\/?/g;

function extractSheetId(url: string): string | null {
  const match = url.match(SHEETS_URL_PATTERN);
  return match ? match[1] : null;
}

function extractGid(url: string): string {
  const match = url.match(/gid=(\d+)/);
  return match ? match[1] : "0";
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sheetUrl } = body as { sheetUrl: string };

    if (!sheetUrl) {
      return NextResponse.json(
        { error: "Google Sheet URL is required" },
        { status: 400 }
      );
    }

    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      return NextResponse.json(
        { error: "Invalid Google Sheets URL" },
        { status: 400 }
      );
    }

    const gid = extractGid(sheetUrl);

    // Use the public CSV export endpoint (works for publicly shared sheets)
    const csvUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=csv&gid=${encodeURIComponent(gid)}`;

    const csvResponse = await fetch(csvUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TastyCreativeBot/1.0)",
      },
      redirect: "follow",
    });

    if (!csvResponse.ok) {
      if (csvResponse.status === 404) {
        return NextResponse.json(
          { error: "Google Sheet not found. Make sure the URL is correct." },
          { status: 404 }
        );
      }
      if (csvResponse.status === 403 || csvResponse.status === 401) {
        return NextResponse.json(
          {
            error:
              'This sheet is not publicly accessible. Please set sharing to "Anyone with the link can view".',
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: `Failed to fetch sheet (HTTP ${csvResponse.status})` },
        { status: 502 }
      );
    }

    const csvText = await csvResponse.text();

    if (!csvText || csvText.length < 10) {
      return NextResponse.json(
        { error: "The sheet appears to be empty" },
        { status: 400 }
      );
    }

    // Extract all Instagram URLs from the CSV content
    const matches = csvText.match(INSTAGRAM_URL_PATTERN);

    if (!matches || matches.length === 0) {
      return NextResponse.json(
        {
          error:
            "No Instagram URLs found in this sheet. Make sure the sheet contains Instagram post or reel links.",
        },
        { status: 400 }
      );
    }

    // Deduplicate URLs (normalize trailing slashes)
    const seen = new Set<string>();
    const uniqueUrls: string[] = [];
    for (const rawUrl of matches) {
      const normalized = rawUrl.replace(/\/+$/, "");
      if (!seen.has(normalized)) {
        seen.add(normalized);
        uniqueUrls.push(normalized);
      }
    }

    return NextResponse.json({
      success: true,
      urls: uniqueUrls,
      total: uniqueUrls.length,
      sheetId,
    });
  } catch (error) {
    console.error("Error parsing Google Sheet:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to parse Google Sheet",
      },
      { status: 500 }
    );
  }
}
