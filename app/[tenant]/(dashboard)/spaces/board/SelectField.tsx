'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';

interface SelectFieldProps {
  value: string;
  options: string[];
  onSave: (v: string) => void;
  renderOption?: (v: string) => React.ReactNode;
}

export function SelectField({
  value,
  options,
  onSave,
  renderOption,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="group/sf flex items-center gap-1.5 w-full text-left"
      >
        {renderOption ? (
          renderOption(value)
        ) : (
          <span className="text-sm text-gray-800 dark:text-brand-off-white">
            {value || <span className="text-gray-400 italic">None</span>}
          </span>
        )}
        <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover/sf:opacity-100 transition-opacity shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-full min-w-[140px] rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 bg-white dark:bg-gray-900 shadow-lg py-1">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onSave(opt);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-brand-light-pink/10 transition-colors ${
                opt === value
                  ? 'text-brand-light-pink font-medium'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {renderOption ? renderOption(opt) : opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
