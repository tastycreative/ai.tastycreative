'use client';

import { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useTimezoneStore, TIMEZONE_PRESETS } from '@/stores/timezone-store';
import { getTimezoneAbbreviation } from '@/lib/timezone-utils';

export function TimezonePicker() {
  const { selectedTimezone, setTimezone, getResolvedTimezone } = useTimezoneStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const resolvedTz = getResolvedTimezone();
  const abbr = getTimezoneAbbreviation(resolvedTz);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white border border-white/[0.08] rounded px-1.5 py-0.5 hover:bg-white/[0.06] transition-colors"
      >
        <Globe className="w-3 h-3" />
        <span className="font-semibold">{abbr}</span>
        <ChevronDown className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-white/[0.1] bg-[#1a2237] shadow-xl shadow-black/50 py-1">
          {TIMEZONE_PRESETS.map((preset) => {
            const isSelected = selectedTimezone === preset.value;
            const presetAbbr =
              preset.value === 'AUTO'
                ? getTimezoneAbbreviation(Intl.DateTimeFormat().resolvedOptions().timeZone)
                : getTimezoneAbbreviation(preset.value);

            return (
              <button
                key={preset.value}
                onClick={() => {
                  setTimezone(preset.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors ${
                  isSelected
                    ? 'text-brand-light-pink bg-brand-light-pink/10'
                    : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <Check className={`w-3 h-3 shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                <span className="truncate flex-1">
                  {preset.label}
                  {preset.value === 'AUTO' && (
                    <span className="text-gray-500 ml-1">
                      ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                    </span>
                  )}
                </span>
                <span className="text-[9px] text-gray-500 shrink-0">{presetAbbr}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
