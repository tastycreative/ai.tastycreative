import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const TIMEZONE_PRESETS = [
  { label: 'Auto-detect', value: 'AUTO' },
  { label: 'Pacific Time (Los Angeles)', value: 'America/Los_Angeles' },
  { label: 'Eastern Time (New York)', value: 'America/New_York' },
  { label: 'Central Time (Chicago)', value: 'America/Chicago' },
  { label: 'London', value: 'Europe/London' },
  { label: 'Manila', value: 'Asia/Manila' },
  { label: 'Tokyo', value: 'Asia/Tokyo' },
  { label: 'Sydney', value: 'Australia/Sydney' },
  { label: 'UTC', value: 'UTC' },
] as const;

interface TimezoneState {
  selectedTimezone: string; // 'AUTO' | IANA string
  setTimezone: (tz: string) => void;
  getResolvedTimezone: () => string;
}

export const useTimezoneStore = create<TimezoneState>()(
  persist(
    (set, get) => ({
      selectedTimezone: 'AUTO',
      setTimezone: (tz) => set({ selectedTimezone: tz }),
      getResolvedTimezone: () => {
        const tz = get().selectedTimezone;
        if (tz === 'AUTO') {
          return Intl.DateTimeFormat().resolvedOptions().timeZone;
        }
        return tz;
      },
    }),
    {
      name: 'timezone-storage',
      partialize: (state) => ({ selectedTimezone: state.selectedTimezone }),
    },
  ),
);
