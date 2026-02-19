'use client';

import { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { X, Search, ChevronDown, Loader2, Users } from 'lucide-react';
import type { SearchableSelectItem } from './SearchableSelect';

export interface SearchableMultiSelectProps {
  items: SearchableSelectItem[];
  selectedValues: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  placeholder?: string;
  loading?: boolean;
}

export const SearchableMultiSelect = memo(function SearchableMultiSelect({
  items,
  selectedValues,
  onAdd,
  onRemove,
  placeholder = 'Select...',
  loading = false,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const availableItems = useMemo(
    () => items.filter((i) => !selectedValues.includes(i.name)),
    [items, selectedValues]
  );

  const filtered = useMemo(
    () =>
      search
        ? availableItems.filter((i) =>
            i.name.toLowerCase().includes(search.toLowerCase())
          )
        : availableItems,
    [availableItems, search]
  );

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
      setSearch('');
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-4 py-3 border rounded-xl bg-zinc-800/50 text-left transition-all ${
          open
            ? 'border-brand-light-pink ring-2 ring-brand-light-pink/20'
            : 'border-zinc-700/50 hover:border-zinc-600'
        }`}
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-light-pink/10 flex items-center justify-center">
          <Users className="w-4 h-4 text-brand-light-pink" />
        </div>
        <span className="flex-1 text-sm text-zinc-500 truncate">
          {selectedValues.length > 0
            ? `${selectedValues.length} model${selectedValues.length !== 1 ? 's' : ''} selected`
            : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Selected chips */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {selectedValues.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onRemove(tag)}
              className="group inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-light-pink/10 border border-brand-light-pink/20 text-brand-light-pink rounded-lg text-xs font-medium hover:bg-brand-light-pink/20 hover:border-brand-light-pink/40 transition-all"
            >
              <span className="w-4 h-4 rounded-full bg-brand-light-pink/20 flex items-center justify-center text-[9px] font-bold">
                {tag.charAt(0).toUpperCase()}
              </span>
              {tag}
              <X className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}

      {/* Dropdown - opens upward to avoid clipping */}
      {open && (
        <div className="absolute z-50 bottom-full mb-2 w-full bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-150">
          {/* Footer */}
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between text-[11px] text-zinc-600">
            <span>
              {filtered.length} available
            </span>
            {selectedValues.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  selectedValues.forEach((v) => onRemove(v));
                  setSearch('');
                }}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Options */}
          <div className="max-h-56 overflow-y-auto overscroll-contain custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-zinc-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading models...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                {availableItems.length === 0 ? 'All models selected' : 'No models found'}
              </div>
            ) : (
              <div className="p-1">
                {filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onAdd(item.name);
                      setSearch('');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-lg transition-colors"
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-400">
                      {item.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 text-left truncate">{item.name}</span>
                    <div className="flex-shrink-0 w-5 h-5 rounded border border-zinc-700 flex items-center justify-center">
                      {/* empty checkbox */}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search at bottom for upward dropdown */}
          <div className="p-2 border-t border-zinc-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-zinc-800/80 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-brand-light-pink/50 focus:ring-1 focus:ring-brand-light-pink/20"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
