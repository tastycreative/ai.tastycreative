import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/database';
import { buildHeaderRow, buildDayRows, type ExportableTask } from '@/lib/scheduler/sheet-export';

const SLOT_LABELS = ['1A', '1B', '1C', '1D', '1E', '1F', '1G'];

// MM header formula matching the original Google Sheet (cell B1)
const MM_HEADER_FORMULA =
  '="MM Schedule: " & COUNTIF(B2:B995, "*") & ":" & (COUNTIF(B2:B995, "*") - 2 * COUNTIF(I2:I995, "<>")) & ":" & COUNTIF(I2:I995, "<>")';

/**
 * POST /api/scheduler/export-to-sheets
 *
 * Creates a new Google Sheet from scheduler task data and returns SSE
 * progress events + the final sheet URL.
 *
 * Body: { weekStart, platform, profileId?, profileName, dayOfWeek? }
 * Reads Google OAuth token from httpOnly cookie.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, currentOrganizationId: true },
  });
  if (!user?.currentOrganizationId) {
    return new Response(JSON.stringify({ error: 'No organization selected' }), { status: 400 });
  }

  const orgId = user.currentOrganizationId;
  const member = await prisma.teamMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!member) {
    return new Response(JSON.stringify({ error: 'Not a member' }), { status: 403 });
  }

  // Google OAuth token from cookie
  const accessToken = request.cookies.get('gdrive_access_token')?.value;
  const refreshToken = request.cookies.get('gdrive_refresh_token')?.value;

  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'Google account not connected. Please sign in.' }), { status: 401 });
  }

  const body = await request.json();
  const { weekStart, platform, profileId, profileName, dayOfWeek } = body as {
    weekStart: string;
    platform: string;
    profileId?: string | null;
    profileName: string;
    dayOfWeek?: number;
  };

  if (!weekStart) {
    return new Response(JSON.stringify({ error: 'weekStart required' }), { status: 400 });
  }

  // SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // Step 1: Fetch tasks
        send('progress', { step: 'fetching', progress: 5, message: 'Fetching scheduler tasks...' });

        const where = {
          organizationId: orgId,
          weekStartDate: new Date(weekStart),
          ...(profileId && { profileId }),
          ...(platform && { platform }),
          ...(dayOfWeek != null && { dayOfWeek }),
        };

        const tasks = await prisma.schedulerTask.findMany({
          where,
          orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
        });

        const exportTasks: (ExportableTask & { dayOfWeek: number })[] = tasks.map((t) => ({
          taskType: t.taskType,
          fields: (t.fields as Record<string, string>) ?? null,
          dayOfWeek: t.dayOfWeek,
        }));

        send('progress', { step: 'fetched', progress: 20, message: `Found ${exportTasks.length} tasks` });

        // Step 2: Set up Google Sheets API
        send('progress', { step: 'auth', progress: 25, message: 'Connecting to Google Sheets...' });

        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_OAUTH_CLIENT_ID,
          process.env.GOOGLE_OAUTH_CLIENT_SECRET,
          process.env.GOOGLE_OAUTH_REDIRECT_URI,
        );
        oauth2Client.setCredentials({
          access_token: accessToken,
          refresh_token: refreshToken ?? undefined,
        });

        const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

        // Step 3: Create the spreadsheet
        const platformLabel = platform
          ? platform.charAt(0).toUpperCase() + platform.slice(1)
          : 'Schedule';

        // Compute week date range for the title (e.g. "Mar 29 – Apr 4")
        const wsDate = new Date(weekStart + 'T00:00:00Z');
        const weDate = new Date(wsDate);
        weDate.setUTCDate(weDate.getUTCDate() + 6);
        const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        const weekRange = `${fmt(wsDate)} – ${fmt(weDate)}`;

        // Single day: use that day's date; full week: use the range
        const isSingleDay = dayOfWeek != null;
        const dayDate = new Date(wsDate);
        if (isSingleDay) dayDate.setUTCDate(dayDate.getUTCDate() + dayOfWeek);
        const title = isSingleDay
          ? `${profileName} ${platformLabel} Schedule ${fmt(dayDate)}`
          : `${profileName} ${platformLabel} Schedule ${weekRange}`;

        send('progress', { step: 'creating', progress: 30, message: 'Creating Google Sheet...' });

        // Build sheet tabs
        const sheetProperties = isSingleDay
          ? [{ properties: { title: `Schedule #${SLOT_LABELS[dayOfWeek]}` } }]
          : SLOT_LABELS.map((slot) => ({ properties: { title: `Schedule #${slot}` } }));

        const spreadsheet = await sheets.spreadsheets.create({
          requestBody: {
            properties: { title },
            sheets: sheetProperties,
          },
        });

        const spreadsheetId = spreadsheet.data.spreadsheetId!;
        const spreadsheetUrl = spreadsheet.data.spreadsheetUrl!;

        send('progress', { step: 'created', progress: 40, message: 'Sheet created, populating data...' });

        // Step 4: Populate data
        if (isSingleDay) {
          // Single day
          const header = buildHeaderRow();
          const dataRows = buildDayRows(exportTasks);
          const allRows = [header, ...dataRows];
          const tabName = `Schedule #${SLOT_LABELS[dayOfWeek]}`;

          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${tabName}'!A1`,
            valueInputOption: 'RAW',
            requestBody: { values: allRows },
          });

          // Write MM header formula to B1 (USER_ENTERED so Sheets interprets it)
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${tabName}'!B1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[MM_HEADER_FORMULA]] },
          });

          send('progress', { step: 'populated', progress: 80, message: 'Data populated' });
        } else {
          // Full week — 7 tabs
          const tasksByDay = new Map<number, ExportableTask[]>();
          for (let d = 0; d < 7; d++) tasksByDay.set(d, []);
          for (const t of exportTasks) {
            tasksByDay.get(t.dayOfWeek)?.push(t);
          }

          const totalDays = 7;
          for (let day = 0; day < totalDays; day++) {
            const dayTasks = tasksByDay.get(day) ?? [];
            const header = buildHeaderRow();
            const dataRows = buildDayRows(dayTasks);
            const allRows = [header, ...dataRows];

            const tabName = `Schedule #${SLOT_LABELS[day]}`;

            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `'${tabName}'!A1`,
              valueInputOption: 'RAW',
              requestBody: { values: allRows },
            });

            // Write MM header formula to B1 (USER_ENTERED so Sheets interprets it)
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `'${tabName}'!B1`,
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: [[MM_HEADER_FORMULA]] },
            });

            const dayProgress = 40 + Math.round(((day + 1) / totalDays) * 45);
            send('progress', {
              step: 'populating',
              progress: dayProgress,
              message: `Populated ${tabName} (${dayTasks.length} tasks)`,
            });
          }
        }

        // Step 5: Apply formatting
        send('progress', { step: 'formatting', progress: 88, message: 'Applying formatting...' });

        const formatRequests = buildFormatRequests(spreadsheet.data.sheets ?? []);
        if (formatRequests.length > 0) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests: formatRequests },
          });
        }

        send('progress', { step: 'done', progress: 100, message: 'Export complete!' });
        send('complete', { url: spreadsheetUrl, spreadsheetId, title });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[export-to-sheets] Error:', message);
        send('error', { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/** Build batchUpdate requests for basic formatting (bold header, column widths). */
function buildFormatRequests(sheetsMeta: { properties?: { sheetId?: number | null } | null }[]) {
  const requests: object[] = [];

  for (const sheet of sheetsMeta) {
    const sheetId = sheet.properties?.sheetId;
    if (sheetId == null) continue;

    // Bold header row
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 10 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            backgroundColor: { red: 0.72, green: 0.72, blue: 0.72 },
          },
        },
        fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment,backgroundColor)',
      },
    });

    // Freeze header row
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    });

    // Auto-resize columns
    requests.push({
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: 24,
        },
      },
    });
  }

  return requests;
}
