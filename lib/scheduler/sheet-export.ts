/**
 * Export builder for scheduler data.
 * Produces xlsx/csv matching the exact column layout used by the import parser
 * (sheet-parser.ts) so exported data round-trips correctly.
 *
 * Column layout per tab (0-indexed):
 *   Col 0:      empty (A)
 *   Col 1-8:    MM  -> type, time, contentPreview, paywallContent, tag, caption, captionGuide, price
 *   Col 9:      empty separator
 *   Col 10-15:  WP  -> type, time, contentFlyer, paywallContent, caption, priceInfo
 *   Col 16:     empty separator
 *   Col 17-18:  ST  -> storyPostSchedule, contentFlyer
 *   Col 19:     empty separator
 *   Col 20-23:  SP  -> type, contentFlyer, time, caption
 */

import ExcelJS from 'exceljs';
import { SLOT_TO_DAY } from './sheet-parser';

const TOTAL_COLUMNS = 24;

// Column-to-field mapping mirroring COLUMN_MAP in sheet-parser.ts
const COLUMN_MAP: { type: string; startCol: number; fields: string[] }[] = [
  {
    type: 'MM',
    startCol: 1,
    fields: ['type', 'time', 'contentPreview', 'paywallContent', 'tag', 'caption', 'captionGuide', 'price'],
  },
  {
    type: 'WP',
    startCol: 10,
    fields: ['type', 'time', 'contentFlyer', 'paywallContent', 'caption', 'priceInfo'],
  },
  {
    type: 'ST',
    startCol: 17,
    fields: ['storyPostSchedule', 'contentFlyer'],
  },
  {
    type: 'SP',
    startCol: 20,
    fields: ['type', 'contentFlyer', 'time', 'caption'],
  },
];

// Header labels matching the original Google Sheet
const HEADER_LABELS: Record<string, Record<string, string>> = {
  MM: {
    type: '', // replaced with formula in styleDaySheet
    time: 'Time (PST)',
    contentPreview: 'Content/Preview',
    paywallContent: 'Paywall Content',
    tag: 'Tag',
    caption: 'Caption',
    captionGuide: 'Caption Guide',
    price: 'Price',
  },
  WP: {
    type: 'Post Schedule',
    time: 'Time (PST)',
    contentFlyer: 'Content/Flyer',
    paywallContent: 'Paywall Content',
    caption: 'Caption',
    priceInfo: 'Price/Info',
  },
  ST: {
    storyPostSchedule: 'Story Post Schedule',
    contentFlyer: 'Content/Flyer',
  },
  SP: {
    type: 'Subscriber Promo Schedule',
    contentFlyer: 'Content/Flyer',
    time: 'Time (PST)',
    caption: 'Caption',
  },
};

// Task type header colors (matches TASK_TYPE_COLORS in shared.tsx)
const TYPE_COLORS: Record<string, string> = {
  MM: 'F472B6', // pink
  WP: '38BDF8', // blue
  ST: 'C084FC', // purple
  SP: 'FB923C', // orange
};

/** Check if a task type name indicates a Follow Up task. */
function isFollowUpType(typeName: string): boolean {
  const lower = typeName.toLowerCase();
  return lower.includes('follow up') || lower.includes('follow-up');
}

export interface ExportableTask {
  taskType: string;
  fields: Record<string, string> | null;
}

/** Build the header row as a 24-element array. */
export function buildHeaderRow(): string[] {
  const row = new Array<string>(TOTAL_COLUMNS).fill('');
  for (const mapping of COLUMN_MAP) {
    const labels = HEADER_LABELS[mapping.type];
    for (let f = 0; f < mapping.fields.length; f++) {
      const fieldKey = mapping.fields[f];
      row[mapping.startCol + f] = labels[fieldKey] ?? fieldKey;
    }
  }
  return row;
}

/**
 * Build data rows for a single day's tasks.
 * Groups tasks by taskType, then interleaves row-by-row into the
 * 24-column layout so each row can have one task per type group.
 */
export function buildDayRows(tasks: ExportableTask[]): string[][] {
  const grouped: Record<string, ExportableTask[]> = { MM: [], WP: [], ST: [], SP: [] };
  for (const task of tasks) {
    if (!grouped[task.taskType]) continue;
    // Skip MM tasks with no type value
    if (task.taskType === 'MM' && !task.fields?.type) continue;
    grouped[task.taskType].push(task);
  }

  const maxRows = Math.max(
    0,
    grouped.MM.length,
    grouped.WP.length,
    grouped.ST.length,
    grouped.SP.length,
  );

  const rows: string[][] = [];

  for (let r = 0; r < maxRows; r++) {
    const row = new Array<string>(TOTAL_COLUMNS).fill('');
    for (const mapping of COLUMN_MAP) {
      const task = grouped[mapping.type]?.[r];
      if (!task?.fields) continue;
      for (let f = 0; f < mapping.fields.length; f++) {
        const fieldKey = mapping.fields[f];
        // For MM Follow Up tasks, write subType back into the contentPreview column
        // (mirrors the import parser which extracts subType from that column)
        if (
          mapping.type === 'MM' &&
          fieldKey === 'contentPreview' &&
          task.fields.subType &&
          isFollowUpType(task.fields.type || '')
        ) {
          row[mapping.startCol + f] = task.fields.subType;
        } else {
          row[mapping.startCol + f] = task.fields[fieldKey] ?? '';
        }
      }
    }
    rows.push(row);
  }

  return rows;
}

/** Quote a field value for CSV if it contains commas, newlines, or quotes. */
export function escapeCSV(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('\n') || value.includes('\r') || value.includes('"')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/** Build a CSV string for a single day's tasks. */
export function buildDayCSV(tasks: ExportableTask[]): string {
  const header = buildHeaderRow();
  const dataRows = buildDayRows(tasks);
  return [header, ...dataRows]
    .map((row) => row.map(escapeCSV).join(','))
    .join('\n');
}

/** Day-of-week to slot label (0=1A, 1=1B, ..., 6=1G) */
const DAY_TO_SLOT = Object.fromEntries(
  Object.entries(SLOT_TO_DAY).map(([slot, day]) => [day, slot]),
);

// Empty/separator column indices (0-indexed column positions)
const EMPTY_COLS = new Set([0, 9, 16, 19]);

const GRAY_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFB7B7B7' },
};

/** Apply header styling and column widths to an ExcelJS worksheet. */
function styleDaySheet(ws: ExcelJS.Worksheet) {
  const headerRow = ws.getRow(1);
  headerRow.height = 28;

  // First: fill entire header row with #b7b7b7
  for (let c = 1; c <= TOTAL_COLUMNS; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = GRAY_FILL;
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  }

  // MM first column: formula matching the Google Sheet
  // Col B (ExcelJS col 2) = MM type, Col I (ExcelJS col 9) = MM price
  const mmCell = headerRow.getCell(2);
  mmCell.value = {
    formula: '"MM Schedule: " & COUNTIF(B2:B995, "*") & ":" & (COUNTIF(B2:B995, "*") - 2 * COUNTIF(I2:I995, "<>")) & ":" & COUNTIF(I2:I995, "<>")',
    result: 'MM Schedule',
  } as ExcelJS.CellFormulaValue;

  // Add borders to task type group header cells
  for (const mapping of COLUMN_MAP) {
    for (let f = 0; f < mapping.fields.length; f++) {
      const col = mapping.startCol + f + 1;
      const cell = headerRow.getCell(col);
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      };
    }
  }

  // Set column widths based on content type
  const colWidths: Record<number, number> = {};
  for (const mapping of COLUMN_MAP) {
    for (let f = 0; f < mapping.fields.length; f++) {
      const fieldKey = mapping.fields[f];
      const col = mapping.startCol + f + 1;
      if (fieldKey === 'caption' || fieldKey === 'captionGuide') {
        colWidths[col] = 35;
      } else if (fieldKey === 'contentPreview' || fieldKey === 'contentFlyer' || fieldKey === 'paywallContent') {
        colWidths[col] = 25;
      } else if (fieldKey === 'storyPostSchedule') {
        colWidths[col] = 20;
      } else {
        colWidths[col] = 14;
      }
    }
  }
  // Separator + empty columns — narrow
  for (const emptyCol of EMPTY_COLS) {
    colWidths[emptyCol + 1] = 3;
  }

  for (const [col, width] of Object.entries(colWidths)) {
    ws.getColumn(Number(col)).width = width;
  }

  // Style data rows + fill empty/separator columns with gray
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= TOTAL_COLUMNS; c++) {
      const cell = row.getCell(c);
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.font = { size: 10 };
      // Empty/separator columns get gray fill on all rows
      if (EMPTY_COLS.has(c - 1)) {
        cell.fill = GRAY_FILL;
      }
    }
  }
}

/**
 * Build a single .xlsx workbook buffer with 7 sheet tabs (Schedule #1A–#1G).
 * Each tab has colored headers matching task type colors and proper column widths.
 * Compatible with Google Sheets.
 */
export async function buildWeeklyXlsx(
  tasksByDay: Map<number, ExportableTask[]>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  for (let day = 0; day < 7; day++) {
    const slot = DAY_TO_SLOT[day] ?? `1${String.fromCharCode(65 + day)}`;
    const tabName = `Schedule #${slot}`;
    const dayTasks = tasksByDay.get(day) ?? [];

    const ws = wb.addWorksheet(tabName);
    const header = buildHeaderRow();
    const dataRows = buildDayRows(dayTasks);

    // Add header row
    ws.addRow(header);
    // Add data rows
    for (const row of dataRows) {
      ws.addRow(row);
    }

    styleDaySheet(ws);
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
