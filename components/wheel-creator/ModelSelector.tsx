'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { useOfModels, type OfModel } from '@/lib/hooks/useOfModels.query';

interface ModelSelectorProps {
  selectedModelId: string | null;
  onSelect: (model: OfModel) => void;
}

export function ModelSelector({ selectedModelId, onSelect }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const { data: response, isLoading } = useOfModels({ status: 'ACTIVE' });
  const models = response?.data ?? [];
  const selected = models.find((m) => m.id === selectedModelId);

  const filtered = models.filter((m) =>
    m.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    m.name?.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm bg-gray-900 border border-gray-800 hover:border-gray-600 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {selected?.profileImageUrl && (
            <img
              src={selected.profileImageUrl}
              alt=""
              className="w-6 h-6 rounded-full object-cover shrink-0"
            />
          )}
          <span className="truncate text-gray-200">
            {selected?.displayName || selected?.name || 'Select a model...'}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-800">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-800/50 rounded-md">
              <Search className="w-3.5 h-3.5 text-gray-500" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="bg-transparent text-sm text-gray-200 outline-none w-full placeholder:text-gray-600"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {isLoading && (
              <div className="px-3 py-4 text-center text-xs text-gray-500">Loading models...</div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-gray-500">No models found</div>
            )}
            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => { onSelect(m); setOpen(false); setSearch(''); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-800 transition-colors text-left"
              >
                {m.profileImageUrl ? (
                  <img src={m.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400 shrink-0">
                    {(m.displayName || m.name)?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-gray-200 truncate">{m.displayName || m.name}</div>
                  {m.displayName && m.displayName !== m.name && (
                    <div className="text-[10px] text-gray-500 truncate">{m.name}</div>
                  )}
                </div>
                {m.id === selectedModelId && (
                  <span className="ml-auto text-brand-light-pink text-xs">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
