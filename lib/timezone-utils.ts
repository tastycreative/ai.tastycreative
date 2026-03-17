/**
 * Timezone-aware formatting and conversion utilities.
 * Uses native Intl.DateTimeFormat — no external dependencies.
 * DST is handled automatically by the Intl API's IANA timezone database.
 */

/** Format a date for display in a given IANA timezone. */
export function formatInTimezone(
  date: Date | string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', { timeZone, ...options }).format(d);
}

/** Get short timezone abbreviation like "PDT", "PHT", "EST" (DST-aware). */
export function getTimezoneAbbreviation(timeZone: string, date?: Date): string {
  const d = date ?? new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'short',
  }).formatToParts(d);
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? timeZone;
}

/**
 * Get the UTC offset in minutes for a timezone at a specific instant.
 * Positive = east of UTC, negative = west. e.g. PDT = -420, PHT = +480.
 * This accounts for DST automatically.
 */
function getTimezoneOffsetMinutes(timeZone: string, date: Date): number {
  // Format the date in the target timezone to extract its local parts
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0');

  // Reconstruct what the timezone thinks the local time is
  const tzYear = get('year');
  const tzMonth = get('month');
  const tzDay = get('day');
  const tzHour = get('hour');
  const tzMinute = get('minute');
  const tzSecond = get('second');

  // Build a UTC date from the timezone's local parts
  const tzAsUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, tzSecond);

  // The offset = (local time as UTC) - (actual UTC)
  return Math.round((tzAsUtc - date.getTime()) / 60000);
}

/**
 * Convert a `datetime-local` input value (interpreted as being in `tz`) to a UTC ISO string.
 * Handles DST correctly by computing the actual offset at the target time.
 *
 * e.g. datetimeLocalToUTC("2026-03-17T15:00", "Asia/Manila") → "2026-03-17T07:00:00.000Z"
 * e.g. datetimeLocalToUTC("2026-03-17T15:00", "America/Los_Angeles") → "2026-03-17T22:00:00.000Z" (PDT)
 */
export function datetimeLocalToUTC(value: string, timeZone: string): string {
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return new Date(value).toISOString();

  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);

  // Step 1: Make a rough UTC estimate by treating the local time as UTC
  const rough = new Date(Date.UTC(year, month - 1, day, hours, minutes));

  // Step 2: Get the offset at this rough estimate
  const offsetMin = getTimezoneOffsetMinutes(timeZone, rough);

  // Step 3: Adjust: UTC = local - offset
  const adjusted = new Date(rough.getTime() - offsetMin * 60000);

  // Step 4: The offset might differ at the adjusted time (DST boundary edge case),
  // so verify and re-adjust once more
  const offsetAtAdjusted = getTimezoneOffsetMinutes(timeZone, adjusted);
  if (offsetAtAdjusted !== offsetMin) {
    const final = new Date(rough.getTime() - offsetAtAdjusted * 60000);
    return final.toISOString();
  }

  return adjusted.toISOString();
}

/**
 * Convert a UTC ISO string to a `datetime-local` input value in the given timezone.
 * Handles DST correctly — e.g. midnight PDT is "00:00", not "23:00" PST.
 *
 * e.g. utcToDatetimeLocal("2026-03-17T07:00:00.000Z", "America/Los_Angeles") → "2026-03-17T00:00" (PDT)
 * e.g. utcToDatetimeLocal("2026-03-17T07:00:00.000Z", "Asia/Manila") → "2026-03-17T15:00"
 */
export function utcToDatetimeLocal(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23', // 0-23 cycle: midnight = 00, not 24
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** Format as "Mar 15" in the given timezone. */
export function formatShortDateInTz(date: Date | string, timeZone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/** Format as "March 2024" in the given timezone. */
export function formatMonthYearInTz(date: Date | string, timeZone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/**
 * Get today's date key (YYYY-MM-DD) in the given timezone.
 * When timezone is LA and it's still March 16 there, returns "2026-03-16" even if browser says March 17.
 */
export function getTodayKeyInTimezone(timeZone: string): string {
  return getDateKeyInTimezone(new Date(), timeZone);
}

/**
 * Get a local Date object representing the start of "today" in the given timezone.
 * Useful for timeline/gantt grids that position elements using local Date math.
 */
export function getTodayDateInTimezone(timeZone: string): Date {
  const key = getTodayKeyInTimezone(timeZone);
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Get the date string (YYYY-MM-DD) for a UTC date as seen in the given timezone.
 * Useful for calendar cell grouping.
 */
export function getDateKeyInTimezone(date: Date | string, timeZone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}
