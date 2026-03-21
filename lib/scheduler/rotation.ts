/**
 * Scheduler rotation algorithm.
 * Each day maps to one slot: Sun=1A, Mon=1B, ..., Sat=1G.
 * Teams are assigned relative to the "scheduler day" which resets at 5 PM LA.
 * After 5 PM LA, the scheduler day advances to the next calendar day.
 *
 *   teamNames[0] ("Running Queue") = current scheduler day
 *   teamNames[1] ("Upcoming Day")  = next day
 *   teamNames[2]                   = day after that
 *   ...
 *   teamNames[6] ("Not Running")   = previous day
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
 * Get the "scheduler today" key (YYYY-MM-DD) based on the 5 PM LA reset.
 * Before 5 PM LA → returns today's date in LA.
 * After 5 PM LA  → returns tomorrow's date in LA (the rotation has advanced).
 */
export function getSchedulerTodayKey(): string {
  const now = new Date();
  // Get current LA time components
  const laFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const parts = laFormatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  const hour = parseInt(get('hour'));

  // Get today's date in LA as YYYY-MM-DD
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayLA = dateFormatter.format(now);

  if (hour >= 17) {
    // Past 5 PM LA — scheduler day is tomorrow
    const tomorrow = new Date(now.getTime() + MS_PER_DAY);
    return dateFormatter.format(tomorrow);
  }

  return todayLA;
}

/**
 * Generate a unique slot label for a given day index.
 * Format: `1A-<random8chars>` where 1A is the slot for the day.
 */
export function generateSlotLabel(dayIndex: number): string {
  const base = SLOT_LABELS[dayIndex] ?? '1A';
  const rand = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `${base}-${rand}`;
}

/**
 * Format a date as YYYY-MM-DD for API use.
 */
export function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}
