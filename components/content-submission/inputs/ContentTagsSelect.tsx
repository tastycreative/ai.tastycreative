'use client';

import { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { X, Search, ChevronDown, Check } from 'lucide-react';
import { CONTENT_TAGS } from '@/lib/constants/contentTags';

export interface ContentTagsSelectProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export const ContentTagsSelect = memo(function ContentTagsSelect({
  selectedTags,
  onChange,
}: ContentTagsSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () =>
      search
        ? CONTENT_TAGS.filter((tag) =>
            tag.toLowerCase().includes(search.toLowerCase())
          )
        : [...CONTENT_TAGS],
    [search]
  );

  const allSelected = selectedTags.length === CONTENT_TAGS.length;

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

  const toggleTag = useCallback(
    (tag: string) => {
      if (selectedTags.includes(tag)) {
        onChange(selectedTags.filter((t) => t !== tag));
      } else {
        onChange([...selectedTags, tag]);
      }
    },
    [selectedTags, onChange]
  );

  const toggleAll = useCallback(() => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange([...CONTENT_TAGS]);
    }
  }, [allSelected, onChange]);

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
        <span className={`flex-1 text-sm truncate ${selectedTags.length > 0 ? 'text-white' : 'text-zinc-500'}`}>
          {selectedTags.length > 0
            ? selectedTags.length <= 3
              ? selectedTags.join(', ')
              : `${selectedTags.slice(0, 3).join(', ')} +${selectedTags.length - 3} more`
            : 'Select content tags...'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Selected chips */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className="group inline-flex items-center gap-1 px-2 py-0.5 bg-brand-mid-pink/10 border border-brand-mid-pink/20 text-brand-mid-pink rounded-md text-xs font-medium hover:bg-brand-mid-pink/20 hover:border-brand-mid-pink/40 transition-all"
            >
              {tag}
              <X className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-2 w-full bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Search */}
          <div className="p-2 border-b border-zinc-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-zinc-800/80 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-brand-light-pink/50 focus:ring-1 focus:ring-brand-light-pink/20"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-56 overflow-y-auto overscroll-contain custom-scrollbar">
            <div className="p-1">
              {/* Select All */}
              {!search && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors ${
                    allSelected
                      ? 'bg-brand-light-pink/15 text-brand-light-pink'
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      allSelected
                        ? 'bg-brand-light-pink border-brand-light-pink'
                        : 'border-zinc-600'
                    }`}
                  >
                    {allSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="font-medium">(Select All)</span>
                </button>
              )}

              {filtered.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-brand-light-pink/10 text-brand-light-pink'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-brand-light-pink border-brand-light-pink'
                          : 'border-zinc-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span>{tag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-600">
            <span>{selectedTags.length} of {CONTENT_TAGS.length} selected</span>
            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
