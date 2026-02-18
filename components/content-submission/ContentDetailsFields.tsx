'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { X, Search, ChevronDown, Check, User, Users, Loader2, RefreshCw, Calendar, Clock, Globe } from 'lucide-react';
import type { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from 'react-hook-form';
import type { CreateSubmissionWithComponents } from '@/lib/validations/content-submission';
import { PricingTierSelector } from './PricingTierSelector';
import { CONTENT_TAGS } from '@/lib/constants/contentTags';
import {
  useContentTypeOptions,
  formatContentTypePrice,
  formatPageType,
  type ContentTypeOption,
} from '@/lib/hooks/useContentTypeOptions.query';

interface ProfileItem {
  id: string;
  name: string;
  type: string;
}

// --- Searchable Single-Select Dropdown ---
function SearchableSelect({
  items,
  value,
  onChange,
  placeholder = 'Select...',
  loading = false,
  icon: Icon,
}: {
  items: ProfileItem[];
  value: string;
  onChange: (id: string, name: string) => void;
  placeholder?: string;
  loading?: boolean;
  icon?: React.ElementType;
}) {
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
}

// --- Searchable Multi-Select Dropdown ---
function SearchableMultiSelect({
  items,
  selectedValues,
  onAdd,
  onRemove,
  placeholder = 'Select...',
  loading = false,
}: {
  items: ProfileItem[];
  selectedValues: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  placeholder?: string;
  loading?: boolean;
}) {
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
}

// --- Content Tags Multi-Select (checkbox style with search and Select All) ---
function ContentTagsSelect({
  selectedTags,
  onChange,
}: {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}) {
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
}

// --- Content Type Select (with pricing info from API) ---
function ContentTypeSelect({
  value,
  onChange,
  options,
  loading,
  onRefresh,
}: {
  value: string;
  onChange: (option: ContentTypeOption | null) => void;
  options: ContentTypeOption[];
  loading: boolean;
  onRefresh: () => void;
}) {
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
}

// --- Main Component ---
interface ContentDetailsFieldsProps {
  register: UseFormRegister<CreateSubmissionWithComponents>;
  setValue: UseFormSetValue<CreateSubmissionWithComponents>;
  watch: UseFormWatch<CreateSubmissionWithComponents>;
  errors: FieldErrors<CreateSubmissionWithComponents>;
}

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC (GMT+0)' },
  { value: 'America/New_York', label: 'EST (GMT-5)' },
  { value: 'America/Chicago', label: 'CST (GMT-6)' },
  { value: 'America/Denver', label: 'MST (GMT-7)' },
  { value: 'America/Los_Angeles', label: 'PST (GMT-8)' },
  { value: 'Europe/London', label: 'GMT (GMT+0)' },
  { value: 'Europe/Paris', label: 'CET (GMT+1)' },
  { value: 'Europe/Bucharest', label: 'EET (GMT+2)' },
  { value: 'Asia/Tokyo', label: 'JST (GMT+9)' },
  { value: 'Australia/Sydney', label: 'AEST (GMT+10)' },
];

export function ContentDetailsFields({
  register,
  setValue,
  watch,
  errors,
}: ContentDetailsFieldsProps) {
  const internalModelTags = watch('internalModelTags') || [];
  const externalCreatorTags = watch('externalCreatorTags') || '';
  const pricingCategory = watch('pricingCategory') || 'PORN_ACCURATE';
  const modelId = watch('modelId') || '';
  const contentTags = watch('contentTags') || [];
  const releaseDate = watch('releaseSchedule.releaseDate');
  const releaseTime = watch('releaseSchedule.releaseTime');
  const releaseTimezone = watch('releaseSchedule.timezone') || '';

  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [selectedContentTypeOptionId, setSelectedContentTypeOptionId] = useState('');

  // Fetch content type options from API
  const {
    data: contentTypeOptions = [],
    isLoading: loadingContentTypes,
    refetch: refetchContentTypes,
  } = useContentTypeOptions({
    category: pricingCategory,
    modelId: modelId || undefined,
    fetchAll: !modelId,
  });

  useEffect(() => {
    async function fetchProfiles() {
      try {
        const response = await fetch('/api/instagram-profiles/list');
        if (response.ok) {
          const data = await response.json();
          setProfiles(data);
        }
      } catch (error) {
        console.error('Failed to fetch profiles:', error);
      } finally {
        setLoadingProfiles(false);
      }
    }
    fetchProfiles();
  }, []);

  const allProfiles = profiles;
  const ofModelProfiles = useMemo(
    () => profiles.filter((p) => p.type === 'of_model'),
    [profiles]
  );

  const parsedExternalTags = externalCreatorTags
    .match(/@\w+/g)
    ?.map((tag) => tag.substring(1)) || [];

  const addInternalTag = useCallback(
    (modelName: string) => {
      if (!internalModelTags.includes(modelName)) {
        setValue('internalModelTags', [...internalModelTags, modelName]);
      }
    },
    [internalModelTags, setValue]
  );

  const removeInternalTag = useCallback(
    (modelName: string) => {
      setValue(
        'internalModelTags',
        internalModelTags.filter((tag) => tag !== modelName)
      );
    },
    [internalModelTags, setValue]
  );

  const handleContentTypeChange = useCallback(
    (option: ContentTypeOption | null) => {
      if (option) {
        setValue('contentType', option.value as any);
        setValue('contentTypeOptionId', option.id);
        setSelectedContentTypeOptionId(option.id);
      } else {
        setValue('contentType', undefined);
        setValue('contentTypeOptionId', undefined);
        setSelectedContentTypeOptionId('');
      }
    },
    [setValue]
  );

  const handleContentTagsChange = useCallback(
    (tags: string[]) => {
      setValue('contentTags', tags);
    },
    [setValue]
  );

  return (
    <div className="space-y-6">
      {/* Model Dropdown - All profiles */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Model
          <span className="text-zinc-500 text-xs ml-1">(Optional)</span>
        </label>
        <SearchableSelect
          items={allProfiles}
          value={modelId}
          onChange={(id, name) => {
            setValue('modelId', id || undefined);
            setValue('modelName', name || undefined);
          }}
          placeholder="Search and select a model..."
          loading={loadingProfiles}
          icon={User}
        />
        <p className="text-xs text-zinc-500 mt-1.5">Select the model/influencer for this submission</p>
        {errors.modelName && (
          <p className="text-sm text-red-400 mt-1">{errors.modelName.message}</p>
        )}
      </div>

      {/* Content Type - Pricing-based from API */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-zinc-300">
            Content Type
            <span className="text-zinc-500 text-xs ml-1">(Optional)</span>
          </label>
          <button
            type="button"
            onClick={() => refetchContentTypes()}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Refresh content types"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingContentTypes ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <ContentTypeSelect
          value={selectedContentTypeOptionId}
          onChange={handleContentTypeChange}
          options={contentTypeOptions}
          loading={loadingContentTypes}
          onRefresh={() => refetchContentTypes()}
        />
        {errors.contentType && (
          <p className="text-sm text-red-400 mt-1">{errors.contentType.message}</p>
        )}
      </div>

      {/* Pricing Tier */}
      <PricingTierSelector
        value={pricingCategory}
        onChange={(value) => setValue('pricingCategory', value as any)}
      />

      {/* Content Tags - Multi-select with checkboxes */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Content Tags
          <span className="text-zinc-500 text-xs ml-1">(Optional)</span>
        </label>
        <ContentTagsSelect
          selectedTags={contentTags}
          onChange={handleContentTagsChange}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Content Length */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Content Length
            <span className="text-zinc-500 text-xs ml-1">(Optional)</span>
          </label>
          <input
            {...register('contentLength')}
            type="text"
            placeholder="8:43 or 8 mins 43 secs"
            className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
          />
          <p className="text-xs text-zinc-500 mt-1">Duration for videos/audio</p>
          {errors.contentLength && (
            <p className="text-sm text-red-400 mt-1">{errors.contentLength.message}</p>
          )}
        </div>

        {/* Content Count */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Content Count
            <span className="text-zinc-500 text-xs ml-1">(Optional)</span>
          </label>
          <input
            {...register('contentCount')}
            type="text"
            placeholder="1 Video, 3 Photos, etc."
            className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
          />
          <p className="text-xs text-zinc-500 mt-1">Number of items</p>
          {errors.contentCount && (
            <p className="text-sm text-red-400 mt-1">{errors.contentCount.message}</p>
          )}
        </div>
      </div>

      {/* External Creator Tags */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          External Creator Tags
          <span className="text-zinc-500 text-xs ml-1">(Optional)</span>
        </label>
        <input
          {...register('externalCreatorTags')}
          type="text"
          placeholder="@username @username2"
          className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
        />
        <p className="text-xs text-zinc-500 mt-1">
          Tag external collaborators with @ (e.g., @creator1 @creator2)
        </p>

        {parsedExternalTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {parsedExternalTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-blue/20 border border-brand-blue/30 text-brand-blue rounded-md text-sm"
              >
                @{tag}
              </span>
            ))}
          </div>
        )}

        {errors.externalCreatorTags && (
          <p className="text-sm text-red-400 mt-1">
            {errors.externalCreatorTags.message}
          </p>
        )}
      </div>

      {/* Internal Model Tags - OF Model profiles only, multi-select */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Internal Model Tags
          <span className="text-zinc-500 text-xs ml-1">(Optional)</span>
        </label>
        <SearchableMultiSelect
          items={ofModelProfiles}
          selectedValues={internalModelTags}
          onAdd={addInternalTag}
          onRemove={removeInternalTag}
          placeholder="Search and tag models..."
          loading={loadingProfiles}
        />
        <p className="text-xs text-zinc-500 mt-1.5">
          Tag related OF models for cross-promotion
        </p>
        {errors.internalModelTags && (
          <p className="text-sm text-red-400 mt-1">
            {errors.internalModelTags.message}
          </p>
        )}
      </div>

      {/* Release Schedule */}
      <div className="pt-4 border-t border-zinc-800/50">
        <h3 className="text-lg font-semibold text-white mb-1">Release Schedule</h3>
        <p className="text-sm text-zinc-400 mb-4">Set a release date and time for scheduled content</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Release Date */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                Release Date
              </span>
              <span className="text-zinc-500 text-xs ml-1">(Optional)</span>
            </label>
            <input
              type="date"
              value={releaseDate ? new Date(releaseDate).toISOString().split('T')[0] : ''}
              onChange={(e) => {
                if (e.target.value) {
                  setValue('releaseSchedule.releaseDate', new Date(e.target.value));
                } else {
                  setValue('releaseSchedule.releaseDate', undefined as any);
                }
              }}
              className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all [color-scheme:dark]"
            />
          </div>

          {/* Release Time */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                Release Time
              </span>
              <span className="text-zinc-500 text-xs ml-1">(Optional)</span>
            </label>
            <input
              type="time"
              value={releaseTime || ''}
              onChange={(e) => setValue('releaseSchedule.releaseTime', e.target.value || undefined)}
              className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all [color-scheme:dark]"
            />
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              <span className="inline-flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-zinc-400" />
                Timezone
              </span>
            </label>
            <select
              value={releaseTimezone}
              onChange={(e) => setValue('releaseSchedule.timezone', e.target.value)}
              className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all appearance-none cursor-pointer"
            >
              <option value="" className="bg-zinc-900 text-zinc-500">Select timezone...</option>
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value} className="bg-zinc-900 text-white">
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {errors.releaseSchedule && (
          <p className="text-sm text-red-400 mt-2">
            {(errors.releaseSchedule as any)?.releaseDate?.message || (errors.releaseSchedule as any)?.message}
          </p>
        )}
      </div>
    </div>
  );
}
