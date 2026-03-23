import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import {
  extractSheetId,
  getTabNameVariations,
  parseSchedulerSheet,
  SLOT_TO_DAY,
  type ParsedTask,
} from '@/lib/scheduler/sheet-parser';

const SLOTS = ['1A', '1B', '1C', '1D', '1E', '1F', '1G'] as const;

/**
 * POST /api/scheduler/import-sheet
 * Body: { sheetUrl: string }
 * Returns: { slots: Record<string, ParsedTask[]> }
 *
 * Fetches each slot tab (1A–1G) from a public Google Sheet as CSV,
 * parses columns into scheduler tasks.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, currentOrganizationId: true },
  });
  if (!user?.currentOrganizationId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 });
  }

  const member = await prisma.teamMember.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: user.currentOrganizationId,
      },
    },
  });
  if (!member || !['OWNER', 'ADMIN', 'MANAGER'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { sheetUrl } = body;

  if (!sheetUrl || typeof sheetUrl !== 'string') {
    return NextResponse.json({ error: 'sheetUrl is required' }, { status: 400 });
  }

  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) {
    return NextResponse.json(
      { error: 'Invalid Google Sheets URL. Expected a URL like https://docs.google.com/spreadsheets/d/...' },
      { status: 400 },
    );
  }

  const slots: Record<string, ParsedTask[]> = {};
  const errors: string[] = [];

  for (const slot of SLOTS) {
    const variations = getTabNameVariations(slot);
    let csvText: string | null = null;

    for (const tabName of variations) {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;

      try {
        const res = await fetch(csvUrl, { signal: AbortSignal.timeout(10_000) });
        if (res.ok) {
          csvText = await res.text();
          break;
        }
      } catch {
        // Try next variation
      }
    }

    if (csvText) {
      const tasks = parseSchedulerSheet(csvText);
      if (tasks.length > 0) {
        slots[slot] = tasks;
      }
    } else {
      errors.push(`Tab for ${slot} not found`);
    }
  }

  if (Object.keys(slots).length === 0) {
    return NextResponse.json(
      {
        error: 'No schedule tabs found. Make sure the sheet has tabs named "Schedule #1A" through "Schedule #1G" and is publicly accessible.',
        errors,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ slots, errors });
}
