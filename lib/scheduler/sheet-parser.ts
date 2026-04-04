/**
 * Google Sheets CSV parser for scheduler import.
 * Parses weekly schedule tabs (1A–1G) where columns are grouped by task type.
 *
 * Column layout per tab (0-indexed):
 *   Col 0:      empty (A)
 *   Col 1–8:    MM  → type, time, contentPreview, paywallContent, tag, caption, captionGuide, price
 *   Col 9:      empty separator
 *   Col 10–15:  WP  → postSchedule, time, contentFlyer, paywallContent, caption, priceInfo
 *   Col 16:     empty separator
 *   Col 17–18:  ST  → storyPostSchedule, contentFlyer
 *   Col 19:     empty separator
 *   Col 20–23:  SP  → subscriberPromoSchedule, contentFlyer, time, caption
 */

export interface ParsedTask {
  taskType: string;
  taskName: string;
  fields: Record<string, string>;
}

// Column-to-field mapping for each task type
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

// The first meaningful field for each type determines taskName
const TASK_NAME_KEYS: Record<string, string> = {
  MM: 'type',
  WP: 'type',
  ST: 'storyPostSchedule',
  SP: 'type',
};

/**
 * Check if a cell value is meaningful (not a placeholder).
 * Sheets use "." as an empty placeholder — treat it as empty.
 */
function isMeaningful(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== '' && trimmed !== '.';
}

/**
 * Normalize Unicode Mathematical Bold to ASCII for pattern matching.
 * Bold capitals: U+1D400-U+1D419 → A-Z
 * Bold smalls:   U+1D41A-U+1D433 → a-z
 */
function normalizeBoldUnicode(str: string): string {
  return str
    .replace(/[\u{1D400}-\u{1D419}]/gu, (ch) =>
      String.fromCharCode(ch.codePointAt(0)! - 0x1D400 + 65),
    )
    .replace(/[\u{1D41A}-\u{1D433}]/gu, (ch) =>
      String.fromCharCode(ch.codePointAt(0)! - 0x1D41A + 97),
    );
}

/** Known follow-up sub-type patterns (matched against normalized text) */
const FOLLOW_UP_SUB_TYPE_MAP: { pattern: RegExp; subType: string }[] = [
  { pattern: /og\s*flyer/i, subType: 'OG Flyer ⬆' },
  { pattern: /no\s*flyer/i, subType: 'No Flyer ⬆' },
  { pattern: /universal\s*flyer/i, subType: 'Universal Flyer ⬆' },
];

/**
 * Check if a contentPreview value is a follow-up sub-type indicator.
 * Returns the normalized sub-type string or null.
 */
function detectFollowUpSubType(value: string): string | null {
  if (!value || !value.includes('⬆')) return null;
  const normalized = normalizeBoldUnicode(value);
  for (const { pattern, subType } of FOLLOW_UP_SUB_TYPE_MAP) {
    if (pattern.test(normalized)) return subType;
  }
  return null;
}

/**
 * Check if a task name indicates a "Follow up" type (case-insensitive).
 */
function isFollowUpType(typeName: string): boolean {
  const lower = normalizeBoldUnicode(typeName).toLowerCase();
  return lower.includes('follow up') || lower.includes('follow-up');
}

/**
 * Check if a task name indicates an "Unlock" type (case-insensitive).
 */
function isUnlockType(typeName: string): boolean {
  const lower = normalizeBoldUnicode(typeName).toLowerCase();
  return lower.includes('unlock');
}

/** Known MM sub-type keywords (case-insensitive, after Unicode normalization) */
const MM_TYPE_KEYWORDS = ['unlock', 'follow up', 'follow-up', 'photo bump'];

/**
 * Check if a value is a recognized MM type (Unlock, Follow Up, Photo Bump).
 */
function isRecognizedMMType(value: string): boolean {
  if (!value) return false;
  const lower = normalizeBoldUnicode(value).toLowerCase();
  return MM_TYPE_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Check if a value looks like a time (e.g. "2:30 PM", "14:30", "3pm").
 * Used to distinguish real task rows from merged-cell notice text.
 */
function looksLikeTime(value: string): boolean {
  if (!value) return false;
  const v = value.trim();
  // Must contain a digit AND either a colon-digit pattern or AM/PM
  return /\d/.test(v) && (/:\d/.test(v) || /[ap]\.?m/i.test(v));
}

/**
 * Simple CSV parser that handles quoted fields with commas and newlines.
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ""
        if (i + 1 < text.length && text[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        cell += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        row.push(cell.trim());
        cell = '';
        i++;
      } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = '';
        i += ch === '\r' ? 2 : 1;
      } else if (ch === '\r') {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = '';
        i++;
      } else {
        cell += ch;
        i++;
      }
    }
  }

  // Flush last cell/row
  if (cell || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a CSV string from a scheduler sheet tab into tasks.
 * Row 0 = headers (skipped). Each subsequent row may produce up to 4 tasks
 * (one per type) if any non-empty value exists in that type's columns.
 */
export function parseSchedulerSheet(csvText: string): ParsedTask[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return []; // Need header + at least one data row

  const tasks: ParsedTask[] = [];

  // Start from row 1 (skip header)
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];

    for (const mapping of COLUMN_MAP) {
      const fields: Record<string, string> = {};
      let hasMeaningfulValue = false;

      for (let f = 0; f < mapping.fields.length; f++) {
        const colIndex = mapping.startCol + f;
        const value = colIndex < row.length ? row[colIndex] : '';
        if (value) {
          fields[mapping.fields[f]] = value;
          // Only count as real data if not just a "." placeholder
          if (isMeaningful(value)) {
            hasMeaningfulValue = true;
          }
        }
      }

      if (hasMeaningfulValue) {
        // Strip out fields that are just "." placeholders before emitting
        const cleanedFields: Record<string, string> = {};
        for (const [key, val] of Object.entries(fields)) {
          if (isMeaningful(val)) {
            cleanedFields[key] = val;
          }
        }

        // ── Filter out notice/header rows that aren't real tasks ──
        // Merged cells in Google Sheets CSV export can duplicate the notice
        // text across every column in the merge range, so counting fields
        // alone is not reliable. Instead, validate key field values.

        // MM: type must be a recognized sub-type (Unlock, Follow Up, Photo Bump).
        // Rows with empty type or unrecognized text are notices.
        if (mapping.type === 'MM' && !isRecognizedMMType(cleanedFields.type || '')) {
          continue;
        }

        // WP: must have a type AND a time that looks like a real time value.
        // Merged-cell notices will have sentence text in the time column.
        if (mapping.type === 'WP' &&
            (!isMeaningful(cleanedFields.type || '') || !looksLikeTime(cleanedFields.time || ''))) {
          continue;
        }

        // SP: must have a time that looks like a real time value.
        if (mapping.type === 'SP' && !looksLikeTime(cleanedFields.time || '')) {
          continue;
        }

        const nameKey = TASK_NAME_KEYS[mapping.type] ?? mapping.fields[0];
        tasks.push({
          taskType: mapping.type,
          taskName: cleanedFields[nameKey] ?? '',
          fields: cleanedFields,
        });
      }
    }
  }

  // ── Post-process: extract sub-types for Follow up MM tasks ──
  // For each Follow up, move the sub-type indicator from contentPreview to subType,
  // copy contentPreview from the preceding Unlock task, and propagate subType back
  // to the Unlock so both tasks display the same sub-type.
  const mmTasks = tasks.filter((t) => t.taskType === 'MM');
  let lastUnlockTask: ParsedTask | null = null;

  for (const task of mmTasks) {
    const typeName = task.fields.type || task.taskName || '';

    if (isUnlockType(typeName)) {
      lastUnlockTask = task;
    } else if (isFollowUpType(typeName)) {
      const subType = detectFollowUpSubType(task.fields.contentPreview || '');
      if (subType) {
        // Move sub-type indicator out of contentPreview
        task.fields.subType = subType;
        delete task.fields.contentPreview;
        // Also set subType on the preceding Unlock task
        if (lastUnlockTask) {
          lastUnlockTask.fields.subType = subType;
        }
      }
      // Inherit contentPreview from the preceding Unlock
      if (lastUnlockTask?.fields.contentPreview) {
        task.fields.contentPreview = lastUnlockTask.fields.contentPreview;
      }
    }
  }

  return tasks;
}

/**
 * Tab name variations to try for each slot (1A–1G).
 */
export function getTabNameVariations(slot: string): string[] {
  return [
    `Schedule #${slot}`,
    `Schedule #${slot}.`,
    slot,
  ];
}

/**
 * Extract Google Sheets ID from a URL.
 */
export function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

/**
 * Slot labels mapped to day of week. 1A=Sun(0), 1B=Mon(1), ..., 1G=Sat(6).
 */
export const SLOT_TO_DAY: Record<string, number> = {
  '1A': 0,
  '1B': 1,
  '1C': 2,
  '1D': 3,
  '1E': 4,
  '1F': 5,
  '1G': 6,
};
