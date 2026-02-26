'use client';

import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface SearchableDropdownProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Max height of the options list in px. Defaults to 220. */
  maxHeight?: number;
  /** Allow clearing the selection */
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
}

export const SearchableDropdown = memo(function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  maxHeight = 220,
  clearable = true,
  disabled = false,
  className = '',
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const filtered = useMemo(
    () =>
      search.trim()
        ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
        : options,
    [options, search],
  );

  useEffect(() => {
    setActiveIndex(-1);
  }, [search]);

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLButtonElement>('[data-option]');
    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const close = useCallback(() => {
    setOpen(false);
    setSearch('');
    setActiveIndex(-1);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [close]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const select = useCallback(
    (option: string) => {
      onChange(option);
      close();
    },
    [onChange, close],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && filtered[activeIndex]) {
            select(filtered[activeIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          close();
          break;
      }
    },
    [open, filtered, activeIndex, select, close],
  );

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={
          open && !disabled
            ? {
                borderColor: '#F774B9',
                boxShadow: '0 0 0 3px rgba(247,116,185,0.18), 0 2px 8px rgba(247,116,185,0.12)',
              }
            : undefined
        }
        className={[
          'w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-sm transition-all duration-200 text-left outline-none',
          disabled
            ? 'opacity-40 cursor-not-allowed bg-zinc-900/40 border-zinc-800 text-zinc-600'
            : open
              ? 'bg-zinc-900 border-brand-light-pink text-white'
              : 'bg-zinc-900/60 border-zinc-700/50 text-white hover:border-zinc-500 hover:bg-zinc-900/80',
        ].join(' ')}
      >
        {/* Value or placeholder */}
        <span
          className={`flex-1 truncate text-sm capitalize ${
            value ? 'text-white font-medium' : 'text-zinc-500 font-normal'
          }`}
        >
          {value || placeholder}
        </span>

        {/* Right controls */}
        {clearable && value && !disabled ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="shrink-0 text-zinc-600 hover:text-brand-light-pink transition-colors duration-150 p-0.5 rounded-md hover:bg-brand-light-pink/10"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        ) : (
          <ChevronDown
            className={`shrink-0 w-4 h-4 transition-all duration-200 ${
              open ? 'text-brand-light-pink rotate-180' : 'text-zinc-500'
            }`}
          />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            borderTop: '2px solid #F774B9',
            boxShadow:
              '0 4px 6px -1px rgba(0,0,0,0.5), 0 20px 40px -8px rgba(0,0,0,0.6), 0 0 0 1px rgba(247,116,185,0.12)',
          }}
          className={[
            'absolute z-50 left-0 right-0 mt-2',
            'bg-zinc-950 border border-zinc-800/80 rounded-xl',
            'overflow-hidden',
            'animate-in fade-in-0 zoom-in-[0.98] slide-in-from-top-1 duration-150',
          ].join(' ')}
        >
          {/* Search bar */}
          <div className="p-2 border-b border-zinc-800/60">
            <div className="relative flex items-center">
              <Search
                className={`absolute left-3 w-3.5 h-3.5 pointer-events-none transition-colors duration-150 ${
                  search ? 'text-brand-light-pink' : 'text-zinc-600'
                }`}
              />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                style={
                  search
                    ? {
                        borderColor: 'rgba(247,116,185,0.5)',
                        boxShadow: '0 0 0 2px rgba(247,116,185,0.12)',
                      }
                    : undefined
                }
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#F774B9';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(247,116,185,0.18)';
                }}
                onBlur={(e) => {
                  if (!search) {
                    e.currentTarget.style.borderColor = '';
                    e.currentTarget.style.boxShadow = '';
                  }
                }}
                className="w-full pl-8 pr-8 py-2 text-sm bg-zinc-900/80 border border-zinc-700/40 rounded-lg text-white placeholder-zinc-600 outline-none transition-all duration-150"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 text-zinc-600 hover:text-brand-light-pink transition-colors duration-150 p-0.5 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div
            ref={listRef}
            role="listbox"
            style={{ maxHeight }}
            className="overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
          >
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center">
                  <Search className="w-3.5 h-3.5 text-zinc-600" />
                </div>
                <span className="text-xs text-zinc-600">No results for &ldquo;{search}&rdquo;</span>
              </div>
            ) : (
              <div className="p-1.5 space-y-px">
                {filtered.map((option, idx) => {
                  const isSelected = option === value;
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={option}
                      type="button"
                      data-option
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => select(option)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      style={
                        isSelected
                          ? {
                              background:
                                'linear-gradient(90deg, rgba(247,116,185,0.15) 0%, rgba(247,116,185,0.05) 100%)',
                              borderLeftColor: '#F774B9',
                            }
                          : isActive
                            ? { borderLeftColor: 'rgba(247,116,185,0.35)' }
                            : undefined
                      }
                      className={[
                        'w-full flex items-center justify-between gap-2 pl-3 pr-3 py-2.5 rounded-lg text-sm transition-all duration-100 text-left border-l-2',
                        isSelected
                          ? 'text-brand-light-pink font-medium border-brand-light-pink'
                          : isActive
                            ? 'bg-zinc-800/60 text-white border-brand-light-pink/35'
                            : 'text-zinc-300 hover:bg-zinc-800/40 hover:text-white border-transparent',
                      ].join(' ')}
                    >
                      <span className="truncate capitalize">{option}</span>
                      {isSelected && (
                        <Check className="shrink-0 w-3.5 h-3.5 text-brand-light-pink" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-zinc-800/60 flex items-center justify-between">
            <span className="text-[10px] text-zinc-700 tracking-wide uppercase">
              {filtered.length} {filtered.length !== 1 ? 'options' : 'option'}
            </span>
            {value && (
              <span
                style={{ color: '#F774B9' }}
                className="text-[10px] opacity-60 truncate max-w-[130px] font-medium capitalize"
              >
                {value}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
