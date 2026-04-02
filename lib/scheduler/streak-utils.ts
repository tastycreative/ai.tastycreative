/**
 * Streak computation for scheduler task lineages.
 *
 * A "streak" counts consecutive weeks of unchanged cloning.
 * The original (imported) task always has streak = 0.
 * Each subsequent clone that matches the previous task's content fields
 * increments the streak; any field change resets it to 0.
 */

/** Metadata fields excluded from content comparison */
export const STREAK_EXCLUDED_FIELDS = new Set([
  'flagged',
  'captionQAStatus',
  'captionId',
  'captionBankText',
  'flyerAssetId',
  'flyerAssetUrl',
  'finalAmount',
  '_previousCaption',
]);

/** Extract only content-relevant fields from a task's fields JSON */
export function extractContentFields(
  fields: Record<string, unknown> | null | undefined,
): Record<string, string> {
  if (!fields) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (STREAK_EXCLUDED_FIELDS.has(key)) continue;
    const str = value == null ? '' : String(value);
    result[key] = str;
  }
  return result;
}

/** Compare two field records — treats undefined/'' as equal */
export function fieldsMatch(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeys) {
    const va = a[key] || '';
    const vb = b[key] || '';
    if (va !== vb) return false;
  }
  return true;
}

interface TaskLike {
  id: string;
  fields: Record<string, unknown> | null;
}

/**
 * Given a chronologically-sorted array of tasks sharing a lineageId,
 * returns a Map<taskId, streakCount>.
 *
 * - First task (original/imported) always gets streak = 0
 * - Each subsequent task: if fields match previous → streak = prev + 1, else 0
 */
export function computeStreaks(tasks: TaskLike[]): Map<string, number> {
  const result = new Map<string, number>();
  if (tasks.length === 0) return result;

  // First task is the original — always streak 0
  result.set(tasks[0].id, 0);
  let prevFields = extractContentFields(tasks[0].fields);
  let prevStreak = 0;

  for (let i = 1; i < tasks.length; i++) {
    const currentFields = extractContentFields(tasks[i].fields);
    if (fieldsMatch(prevFields, currentFields)) {
      prevStreak += 1;
    } else {
      prevStreak = 0;
    }
    result.set(tasks[i].id, prevStreak);
    prevFields = currentFields;
  }

  return result;
}
