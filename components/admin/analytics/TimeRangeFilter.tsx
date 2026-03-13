'use client';

import type { TimeRange } from '@/lib/hooks/useAdminAnalytics.query';

interface TimeRangeFilterProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

const options: { label: string; value: TimeRange }[] = [
  { label: 'Today', value: 'today' },
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
  { label: 'All Time', value: 'all' },
];

export default function TimeRangeFilter({ value, onChange }: TimeRangeFilterProps) {
  return (
    <div className="inline-flex items-center bg-card border border-border rounded-lg p-1 gap-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            value === option.value
              ? 'bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white shadow-md shadow-[#EC67A1]/25'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
