'use client';

import { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { X, Search, ChevronDown, Check, Loader2 } from 'lucide-react';

export interface SearchableSelectItem {
  id: string;
  name: string;
  type: string;
}

export interface SearchableSelectProps {
  items: SearchableSelectItem[];
  value: string;
  onChange: (id: string, name: string) => void;
  placeholder?: string;
  loading?: boolean;
  icon?: React.ElementType;
}

export const SearchableSelect = memo(function SearchableSelect({
  items,
  value,
  onChange,
  placeholder = 'Select...',
  loading = false,
  icon: Icon,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedItem = items.find((i) => i.id === value);

  const filtered = useMemo(
    () =>
      search
        ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
        : items,
    [items, search]
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
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-4 py-3 border rounded-xl bg-zinc-800/50 text-left transition-all ${
          open
            ? 'border-brand-light-pink ring-2 ring-brand-light-pink/20'
            : 'border-zinc-700/50 hover:border-zinc-600'
        }`}
      >
        {Icon && (
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-light-pink/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-brand-light-pink" />
          </div>
        )}
        <span className={`flex-1 text-sm truncate ${selectedItem ? 'text-white' : 'text-zinc-500'}`}>
          {selectedItem ? selectedItem.name : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

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
                placeholder="Search models..."
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-zinc-800/80 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-brand-light-pink/50 focus:ring-1 focus:ring-brand-light-pink/20"
              />
            </div>
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
                No models found
              </div>
            ) : (
              <div className="p-1">
                {/* Clear selection option */}
                {value && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange('', '');
                      setOpen(false);
                      setSearch('');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Clear selection
                  </button>
                )}
                {filtered.map((item) => {
                  const isSelected = item.id === value;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onChange(item.id, item.name);
                        setOpen(false);
                        setSearch('');
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-brand-light-pink/15 text-brand-light-pink'
                          : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                          isSelected
                            ? 'bg-brand-light-pink/20 text-brand-light-pink'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 text-left truncate">{item.name}</span>
                      {item.type !== 'of_model' && (
                        <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 uppercase tracking-wider">
                          {item.type}
                        </span>
                      )}
                      {isSelected && <Check className="w-4 h-4 flex-shrink-0 text-brand-light-pink" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer count */}
          <div className="px-3 py-2 border-t border-zinc-800 text-[11px] text-zinc-600">
            {filtered.length} model{filtered.length !== 1 ? 's' : ''} available
          </div>
        </div>
      )}
    </div>
  );
});
