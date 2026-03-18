/**
 * Time helpers for Scheduler.
 * Uses the shared timezone-utils for timezone-aware formatting.
 * Reset time: 5:00 PM LA time (always LA regardless of user tz selection).
 */

import { formatInTimezone, getTimezoneAbbreviation } from '@/lib/timezone-utils';

const RESET_TZ = 'America/Los_Angeles';
const RESET_HOUR = 17; // 5 PM

/**
 * Format a date as a time string in the given timezone (e.g. "2:30 PM").
 */
export function formatTimeInTz(date: Date | string, timeZone: string): string {
  return formatInTimezone(date, timeZone, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Get the current time display string for the given timezone.
 * e.g. "2:30 PM PDT"
 */
export function getCurrentTimeDisplay(timeZone: string): string {
  const now = new Date();
  const time = formatTimeInTz(now, timeZone);
  const abbr = getTimezoneAbbreviation(timeZone, now);
  return `${time} ${abbr}`;
}

/**
 * Format duration between two dates as "Xh Ym".
 */
export function formatDuration(start: Date | string, end: Date | string): string {
  const s = typeof start === 'string' ? new Date(start) : start;
  const e = typeof end === 'string' ? new Date(end) : end;
  const diffMs = e.getTime() - s.getTime();
  if (diffMs <= 0) return '0s';
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  const seconds = Math.floor((diffMs % 60_000) / 1_000);
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

/**
 * Daily reset time: 5:00 PM LA time.
 * Returns the next reset as a UTC Date, regardless of user's browser timezone.
 */
export function getNextResetTime(now: Date = new Date()): Date {
  // Get today's date in LA as YYYY-MM-DD
  const todayLA = new Intl.DateTimeFormat('en-CA', { timeZone: RESET_TZ }).format(now);

  // Build 5 PM as a UTC base, then shift by LA's UTC offset
  // Using Date.UTC avoids browser local timezone parsing issues
  const year = parseInt(todayLA.slice(0, 4));
  const month = parseInt(todayLA.slice(5, 7)) - 1;
  const day = parseInt(todayLA.slice(8, 10));
  const baseDateUtc = Date.UTC(year, month, day, RESET_HOUR, 0, 0);

  // LA is behind UTC, so add offset to convert "17:00 LA" → UTC
  const laOffset = getLAOffsetMinutes(now);
  const resetUtc = new Date(baseDateUtc + laOffset * 60_000);

  if (now.getTime() < resetUtc.getTime()) return resetUtc;
  // Past 5 PM LA — next reset is tomorrow
  return new Date(resetUtc.getTime() + 86_400_000);
}

/**
 * Get countdown string until next 5 PM LA reset (e.g. "3h 24m").
 */
export function getCountdownToReset(now: Date = new Date()): string {
  const reset = getNextResetTime(now);
  return formatDuration(now, reset);
}

/** Get the LA timezone offset in minutes for DST-aware calculations. */
function getLAOffsetMinutes(date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const laStr = date.toLocaleString('en-US', { timeZone: RESET_TZ });
  return (new Date(utcStr).getTime() - new Date(laStr).getTime()) / 60_000;
}
