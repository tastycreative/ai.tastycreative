'use client';

import { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { X, ChevronDown, Loader2 } from 'lucide-react';
import {
  formatContentTypePrice,
  formatPageType,
  type ContentTypeOption,
} from '@/lib/hooks/useContentTypeOptions.query';

export interface ContentTypeSelectProps {
  value: string;
  onChange: (option: ContentTypeOption | null) => void;
  options: ContentTypeOption[];
  loading: boolean;
  onRefresh: () => void;
}

export const ContentTypeSelect = memo(function ContentTypeSelect({
  value,
  onChange,
  options,
  loading,
}: ContentTypeSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.id === value) || null,
    [options, value]
  );

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const displayText = useMemo(() => {
    if (!selectedOption) return null;
    const pageDisplay = formatPageType(selectedOption.pageType);
    const priceDisplay = formatContentTypePrice(selectedOption);
    return `${selectedOption.label} ${pageDisplay} - ${priceDisplay}`;
  }, [selectedOption]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-4 py-3 border rounded-xl bg-zinc-800/50 text-left transition-all ${
          open
            ? 'border-brand-light-pink ring-2 ring-brand-light-pink/20'
            : 'border-zinc-700/50 hover:border-zinc-600'
        }`}
      >
        <span className={`flex-1 text-sm truncate ${selectedOption ? 'text-white' : 'text-zinc-500'}`}>
          {displayText || 'Select content type...'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="max-h-72 overflow-y-auto overscroll-contain custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-zinc-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading content types...</span>
              </div>
            ) : options.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                No content types available
              </div>
            ) : (
              <div className="p-1">
                {/* Clear selection */}
                {value && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(null);
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Clear selection
                  </button>
                )}
                {options.map((option) => {
                  const isSelected = option.id === value;
                  const pageDisplay = formatPageType(option.pageType);
                  const priceDisplay = formatContentTypePrice(option);
                  const modelDisplay = option.model
                    ? ` [${option.model.displayName || option.model.name}]`
                    : '';

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        onChange(option);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-3 text-sm rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-brand-light-pink/15 text-brand-light-pink'
                          : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">
                          {option.label} {pageDisplay}
                        </span>
                        <span className={`flex-shrink-0 text-xs font-semibold ${
                          option.isFree ? 'text-green-400' : 'text-brand-mid-pink'
                        }`}>
                          {priceDisplay}
                        </span>
                      </div>
                      {(option.description || modelDisplay) && (
                        <p className="text-xs text-zinc-500 mt-0.5 truncate">
                          {option.description}{modelDisplay}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
