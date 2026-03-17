/**
 * POD Tracker rotation algorithm.
 * Each day maps to one slot: Sun=1A, Mon=1B, ..., Sat=1G.
 * Teams are assigned relative to TODAY:
 *   teamNames[0] ("Running Queue") = today
 *   teamNames[1] ("Upcoming Day")  = tomorrow
 *   teamNames[2]                   = day after tomorrow
 *   ...
 *   teamNames[6] ("Not Running")   = yesterday
 */

const MS_PER_DAY = 86_400_000;

export const SLOT_LABELS = ['1A', '1B', '1C', '1D', '1E', '1F', '1G'] as const;
export type SlotLabel = (typeof SLOT_LABELS)[number];

export const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
export const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Each day index maps 1:1 to a slot label. Sun=1A, Mon=1B, etc. */
export function getSlotForDay(dayIndex: number): SlotLabel {
  return SLOT_LABELS[dayIndex];
}

/**
 * Get the Sunday (week start) for a given date.
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

/**
 * Get all 7 days (Mon-Sun) for a given week start.
 */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
}

/**
 * Get which team is assigned to a given date.
 * Teams are relative to today: index 0 = today, index 1 = tomorrow, etc.
 * "Running Queue" (index 0) is always pinned to today.
 *
 * @param todayKey — YYYY-MM-DD string for "today" in the user's timezone
 *                   (use getTodayKeyInTimezone from timezone-utils)
 */
export function getTeamForDay(
  date: Date,
  teamNames: string[],
  todayKey: string,
  offset: number = 0,
): string {
  if (teamNames.length === 0) return '';

  // Parse todayKey into a midnight-UTC date
  const today = new Date(todayKey + 'T00:00:00Z');
  const target = new Date(date);
  target.setUTCHours(0, 0, 0, 0);

  // Days from today: 0 = today, 1 = tomorrow, -1 = yesterday
  const diffDays = Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
  const index = (((diffDays + offset) % teamNames.length) + teamNames.length) % teamNames.length;
  return teamNames[index];
}

/**
 * Format a date as YYYY-MM-DD for API use.
 */
export function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}
