'use client';

import { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Image,
  MessageSquare,
  DollarSign,
  ArrowDown,
  ArrowUp,
  Minus,
  Zap,
  Check,
  ChevronDown,
  User as UserIcon,
  X,
  Search,
  Loader2,
} from 'lucide-react';
import type { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from 'react-hook-form';
import type { CreateSubmissionWithComponents } from '@/lib/validations/content-submission';
import {
  getMetadataDefaults,
  getMetadataFields,
  type MetadataFieldDescriptor,
} from '@/lib/spaces/template-metadata';
import { SearchableDropdown } from '@/components/ui/SearchableDropdown';
import { useSpaceMembers } from '@/lib/hooks/useSpaceMembers.query';
import { useContentTypeOptions, formatContentTypePrice, type ContentTypeOption } from '@/lib/hooks/useContentTypeOptions.query';
import { useInstagramProfiles } from '@/lib/hooks/useInstagramProfiles.query';
import { useQuery } from '@tanstack/react-query';
import { CONTENT_TAGS } from '@/lib/constants/contentTags';

type SubmissionTemplateType = 'OTP_PTR' | 'WALL_POST' | 'SEXTING_SETS';

const TEMPLATE_OPTIONS: {
  value: SubmissionTemplateType;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    value: 'OTP_PTR',
    label: 'OTP / PTR',
    description: 'Custom paid requests',
    icon: DollarSign,
  },
  {
    value: 'WALL_POST',
    label: 'Wall Post',
    description: 'Post photos & captions',
    icon: Image,
  },
  {
    value: 'SEXTING_SETS',
    label: 'Sexting Sets',
    description: 'Adult content sets',
    icon: MessageSquare,
  },
];

const PRIORITY_OPTIONS: {
  value: string;
  label: string;
  icon: React.ElementType;
  selectedClass: string;
}[] = [
  {
    value: 'low',
    label: 'Low',
    icon: ArrowDown,
    selectedClass:
      'bg-emerald-500/15 border-emerald-500/50 text-emerald-400 shadow-sm shadow-emerald-500/10',
  },
  {
    value: 'normal',
    label: 'Normal',
    icon: Minus,
    selectedClass: 'bg-sky-500/15 border-sky-500/50 text-sky-400 shadow-sm shadow-sky-500/10',
  },
  {
    value: 'high',
    label: 'High',
    icon: ArrowUp,
    selectedClass:
      'bg-amber-500/15 border-amber-500/50 text-amber-400 shadow-sm shadow-amber-500/10',
  },
  {
    value: 'urgent',
    label: 'Urgent',
    icon: Zap,
    selectedClass: 'bg-rose-500/15 border-rose-500/50 text-rose-400 shadow-sm shadow-rose-500/10',
  },
];

const PRICING_TIER_OPTIONS = [
  { value: 'PORN_ACCURATE', label: 'Porn Accurate' },
  { value: 'PORN_SCAM', label: 'Porn Scam' },
  { value: 'GF_ACCURATE', label: 'GF Accurate' },
  { value: 'GF_SCAM', label: 'GF Scam' },
];

const PAGE_TYPE_OPTIONS = [
  { value: 'ALL_PAGES', label: 'All Pages' },
  { value: 'FREE', label: 'Free' },
  { value: 'PAID', label: 'Paid' },
  { value: 'VIP', label: 'VIP' },
];

interface ContentDetailsFieldsProps {
  register: UseFormRegister<CreateSubmissionWithComponents>;
  setValue: UseFormSetValue<CreateSubmissionWithComponents>;
  watch: UseFormWatch<CreateSubmissionWithComponents>;
  errors: FieldErrors<CreateSubmissionWithComponents>;
  readOnlyType?: SubmissionTemplateType;
  spaceId?: string;
  assigneeId?: string;
  onAssigneeChange?: (userId: string | undefined) => void;
}

export function ContentDetailsFields({
  setValue,
  watch,
  errors,
  readOnlyType,
  spaceId,
  assigneeId,
  onAssigneeChange,
}: ContentDetailsFieldsProps) {
  const submissionType = (watch('submissionType') ?? 'OTP_PTR') as SubmissionTemplateType;
  const metadata = watch('metadata') || {};
  const priority = watch('priority') || 'normal';
  const pricingCategory = watch('pricingCategory') || 'PORN_ACCURATE';
  const selectedContentType = watch('contentType');

  // Content Type Options (OTP_PTR only)
  const [contentTypeOpen, setContentTypeOpen] = useState(false);
  const [contentTypeSearch, setContentTypeSearch] = useState('');
  const contentTypeRef = useRef<HTMLDivElement>(null);

  // Content Tags multi-select (OTP_PTR only)
  const [contentTagsOpen, setContentTagsOpen] = useState(false);
  const [contentTagsSearch, setContentTagsSearch] = useState('');
  const contentTagsRef = useRef<HTMLDivElement>(null);
  const selectedContentTags: string[] = watch('contentTags') || [];

  // Model selector (OTP_PTR only)
  const [manualModelEntry, setManualModelEntry] = useState(false);

  // Internal Models modal multi-select (OTP_PTR only)
  const [internalModelsModalOpen, setInternalModelsModalOpen] = useState(false);
  const [internalModelsSearch, setInternalModelsSearch] = useState('');
  const [internalModelsSelection, setInternalModelsSelection] = useState<string[]>([]);
  const selectedInternalModelTags: string[] = watch('internalModelTags') || [];

  const { data: contentTypeOptions, isLoading: contentTypeLoading } = useContentTypeOptions({
    category: pricingCategory,
    pageType: (metadata.pageType as string) || undefined,
    enabled: submissionType === 'OTP_PTR',
  });

  // Fetch influencer profiles for model selector & internal models
  const { data: influencerProfiles, isLoading: influencerProfilesLoading } = useInstagramProfiles();

  // Close content type dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contentTypeRef.current && !contentTypeRef.current.contains(e.target as Node)) {
        setContentTypeOpen(false);
        setContentTypeSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close content tags dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contentTagsRef.current && !contentTagsRef.current.contains(e.target as Node)) {
        setContentTagsOpen(false);
        setContentTagsSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Filtered content type options
  const filteredContentTypeOptions = useMemo(() => {
    if (!contentTypeOptions) return [];
    if (!contentTypeSearch.trim()) return contentTypeOptions;
    const q = contentTypeSearch.toLowerCase();
    return contentTypeOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        opt.description?.toLowerCase().includes(q)
    );
  }, [contentTypeOptions, contentTypeSearch]);

  // Find currently selected content type option
  const selectedContentTypeOption = useMemo(
    () => contentTypeOptions?.find((opt) => opt.value === selectedContentType) ?? null,
    [contentTypeOptions, selectedContentType]
  );

  // Filtered content tags
  const filteredContentTags = useMemo(() => {
    if (!contentTagsSearch.trim()) return CONTENT_TAGS;
    const q = contentTagsSearch.toLowerCase();
    return CONTENT_TAGS.filter((tag) => tag.toLowerCase().includes(q));
  }, [contentTagsSearch]);

  // Sorted & filtered influencer profiles for model selector & internal models modal
  const sortedProfiles = useMemo(() => {
    const profiles = influencerProfiles ?? [];
    return [...profiles].sort((a, b) => a.name.localeCompare(b.name));
  }, [influencerProfiles]);

  const filteredProfiles = useMemo(() => {
    if (!internalModelsSearch.trim()) return sortedProfiles;
    const q = internalModelsSearch.toLowerCase();
    return sortedProfiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.username?.toLowerCase().includes(q)
    );
  }, [sortedProfiles, internalModelsSearch]);

  const handleTemplateChange = useCallback(
    (type: SubmissionTemplateType) => {
      setValue('submissionType', type);
      const defaults = getMetadataDefaults(type);
      setValue('metadata', { ...defaults, ...metadata });
    },
    [setValue, metadata]
  );

  const handleMetadataChange = useCallback(
    (key: string, value: any) => {
      const current = watch('metadata') || {};
      setValue('metadata', { ...current, [key]: value }, { shouldDirty: true });
    },
    [setValue, watch]
  );

  const handleContentTypeSelect = useCallback(
    (opt: ContentTypeOption) => {
      setValue('contentType', opt.value);
      setValue('contentTypeOptionId', opt.id);
      handleMetadataChange('contentType', opt.label);
      setContentTypeOpen(false);
      setContentTypeSearch('');
    },
    [setValue, handleMetadataChange]
  );

  const templateFields = getMetadataFields(submissionType);

  return (
    <div className="space-y-8">
      {/* Template Type Selector */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-3">
          Submission Type <span className="text-brand-light-pink">*</span>
        </label>
        {readOnlyType ? (
          /* Read-only display when type is auto-determined from space */
          (() => {
            const opt = TEMPLATE_OPTIONS.find((t) => t.value === readOnlyType);
            if (!opt) return null;
            const Icon = opt.icon;
            return (
              <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800/40 border border-zinc-700/40 rounded-xl">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-light-pink/20">
                  <Icon className="w-4 h-4 text-brand-light-pink" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{opt.label}</p>
                  <p className="text-xs text-zinc-500">Auto-determined from selected space</p>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {TEMPLATE_OPTIONS.map(({ value, label, description, icon: Icon }) => {
              const isSelected = submissionType === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleTemplateChange(value)}
                  className={`relative flex flex-col items-start gap-3 p-5 rounded-xl border transition-all duration-200 text-left ${
                    isSelected
                      ? 'bg-gradient-to-br from-brand-light-pink/15 via-brand-mid-pink/5 to-transparent border-brand-light-pink shadow-lg shadow-brand-light-pink/10'
                      : 'border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800/60 hover:border-zinc-600'
                  }`}
                >
                  <div
                    className={`w-10 h-10 flex items-center justify-center rounded-lg ${
                      isSelected
                        ? 'bg-gradient-to-br from-brand-light-pink/30 to-brand-dark-pink/20'
                        : 'bg-zinc-700/40'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${isSelected ? 'text-brand-light-pink' : 'text-zinc-400'}`}
                    />
                  </div>
                  <div>
                    <p
                      className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-zinc-300'}`}
                    >
                      {label}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{description}</p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-brand-light-pink flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {errors.submissionType && (
          <p className="text-sm text-red-400 mt-1">{errors.submissionType.message}</p>
        )}
      </div>

      {/* Pricing & Distribution (OTP_PTR only) */}
      {submissionType === 'OTP_PTR' && (
        <div>
          <div className="flex items-center gap-3 my-2">
            <div className="h-px flex-1 bg-gradient-to-r from-brand-light-pink/30 to-transparent" />
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest px-3 py-1 rounded-full bg-zinc-800/60 border border-zinc-700/40">
              Pricing &amp; Distribution
            </span>
            <div className="h-px w-8 bg-zinc-800" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Pricing Tier <span className="text-brand-light-pink">*</span>
              </label>
              <SearchableDropdown
                options={PRICING_TIER_OPTIONS.map(o => o.label)}
                value={PRICING_TIER_OPTIONS.find(o => o.value === watch('pricingCategory'))?.label || 'Porn Accurate'}
                onChange={(label) => {
                  const opt = PRICING_TIER_OPTIONS.find(o => o.label === label);
                  if (opt) setValue('pricingCategory', opt.value as any);
                }}
                placeholder="Select pricing tier..."
                searchPlaceholder="Search tiers..."
              />
              <p className="text-[11px] text-zinc-500 mt-1">Determines available content types and pricing</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Page Type <span className="text-brand-light-pink">*</span>
              </label>
              <SearchableDropdown
                options={PAGE_TYPE_OPTIONS.map(o => o.label)}
                value={PAGE_TYPE_OPTIONS.find(o => o.value === (metadata.pageType || 'ALL_PAGES'))?.label || 'All Pages'}
                onChange={(label) => {
                  const opt = PAGE_TYPE_OPTIONS.find(o => o.label === label);
                  if (opt) handleMetadataChange('pageType', opt.value);
                }}
                placeholder="Select page type..."
                searchPlaceholder="Search page types..."
              />
              <p className="text-[11px] text-zinc-500 mt-1">Filter content types by distribution channel</p>
            </div>
          </div>

          {/* Model Selector */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Model <span className="text-brand-light-pink">*</span>
            </label>
            {manualModelEntry ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={(metadata.model as string) || ''}
                  onChange={(e) => handleMetadataChange('model', e.target.value)}
                  placeholder="Enter model name manually..."
                  className="w-full bg-zinc-900/60 border border-zinc-700/50 focus:border-brand-light-pink focus:ring-2 focus:ring-brand-light-pink/20 text-white placeholder-zinc-500 rounded-xl px-4 py-3 transition-all duration-150"
                />
                <button
                  type="button"
                  onClick={() => setManualModelEntry(false)}
                  className="text-[11px] text-brand-light-pink hover:text-brand-mid-pink transition-colors"
                >
                  Back to dropdown
                </button>
              </div>
            ) : (
              <SearchableDropdown
                options={
                  sortedProfiles.length > 0
                    ? [...sortedProfiles.map((p) => p.name), '+ Add model manually']
                    : ['+ Add model manually']
                }
                value={(metadata.model as string) || ''}
                onChange={(selected) => {
                  if (selected === '+ Add model manually') {
                    setManualModelEntry(true);
                  } else {
                    setManualModelEntry(false);
                    handleMetadataChange('model', selected);
                    const profile = sortedProfiles.find((p) => p.name === selected);
                    if (profile) setValue('modelId', profile.id);
                  }
                }}
                placeholder="Search influencer profiles..."
                searchPlaceholder="Type to search profiles..."
              />
            )}
            <p className="text-[11px] text-zinc-500 mt-1">Select the model associated with this content</p>
          </div>

          {/* Content Type Dropdown */}
          <div className="mt-4" ref={contentTypeRef}>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Content Type <span className="text-brand-light-pink">*</span>
            </label>
            <div className="relative">
              {/* Trigger button */}
              <button
                type="button"
                onClick={() => setContentTypeOpen((o) => !o)}
                className={[
                  'w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-sm transition-all duration-200 text-left outline-none',
                  contentTypeOpen
                    ? 'bg-zinc-900 border-brand-light-pink ring-2 ring-brand-light-pink/20 text-white'
                    : 'bg-zinc-900/60 border-zinc-700/50 text-white hover:border-zinc-500 hover:bg-zinc-900/80',
                ].join(' ')}
              >
                {contentTypeLoading ? (
                  <span className="flex items-center gap-2 text-zinc-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading content types...
                  </span>
                ) : selectedContentTypeOption ? (
                  <span className="flex-1 flex items-center justify-between min-w-0">
                    <span className="truncate font-medium text-white">
                      {selectedContentTypeOption.label}
                    </span>
                    <span className="shrink-0 ml-2 text-xs font-semibold text-brand-light-pink">
                      {formatContentTypePrice(selectedContentTypeOption)}
                    </span>
                  </span>
                ) : (
                  <span className="flex-1 text-zinc-500">Select content type...</span>
                )}
                <ChevronDown
                  className={`shrink-0 w-4 h-4 transition-all duration-200 ${
                    contentTypeOpen ? 'text-brand-light-pink rotate-180' : 'text-zinc-500'
                  }`}
                />
              </button>

              {/* Dropdown panel */}
              {contentTypeOpen && (
                <div
                  className="absolute z-50 left-0 right-0 mt-2 bg-zinc-950 border border-zinc-800/80 rounded-xl overflow-hidden shadow-2xl shadow-black/50"
                  style={{ borderTop: '2px solid #F774B9' }}
                >
                  {/* Search */}
                  <div className="p-2 border-b border-zinc-800/60">
                    <div className="relative flex items-center">
                      <Search className={`absolute left-3 w-3.5 h-3.5 pointer-events-none transition-colors ${contentTypeSearch ? 'text-brand-light-pink' : 'text-zinc-600'}`} />
                      <input
                        type="text"
                        value={contentTypeSearch}
                        onChange={(e) => setContentTypeSearch(e.target.value)}
                        placeholder="Search content types..."
                        className="w-full pl-8 pr-8 py-2 text-sm bg-zinc-900/80 border border-zinc-700/40 rounded-lg text-white placeholder-zinc-600 outline-none focus:border-brand-light-pink focus:ring-2 focus:ring-brand-light-pink/15 transition-all duration-150"
                        autoFocus
                      />
                      {contentTypeSearch && (
                        <button
                          type="button"
                          onClick={() => setContentTypeSearch('')}
                          className="absolute right-2 text-zinc-600 hover:text-brand-light-pink transition-colors p-0.5 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Options list */}
                  <div className="max-h-64 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                    {contentTypeLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                      </div>
                    ) : filteredContentTypeOptions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-2">
                        <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center">
                          <Search className="w-3.5 h-3.5 text-zinc-600" />
                        </div>
                        <span className="text-xs text-zinc-600">
                          {contentTypeSearch ? `No results for "${contentTypeSearch}"` : 'No content types available'}
                        </span>
                      </div>
                    ) : (
                      <div className="p-1.5 space-y-px">
                        {filteredContentTypeOptions.map((opt) => {
                          const isSelected = selectedContentType === opt.value;
                          const price = formatContentTypePrice(opt);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleContentTypeSelect(opt)}
                              className={[
                                'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-100 text-left border-l-2',
                                isSelected
                                  ? 'bg-brand-light-pink/10 text-white font-medium border-brand-light-pink'
                                  : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-white border-transparent',
                              ].join(' ')}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate">{opt.label}</span>
                                  <span
                                    className={`shrink-0 text-xs font-semibold ${
                                      opt.isFree
                                        ? 'text-emerald-400'
                                        : isSelected
                                          ? 'text-brand-light-pink'
                                          : 'text-zinc-400'
                                    }`}
                                  >
                                    {price}
                                  </span>
                                </div>
                                {opt.description && (
                                  <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">
                                    {opt.description}
                                  </p>
                                )}
                              </div>
                              {isSelected && (
                                <Check className="shrink-0 w-4 h-4 text-brand-light-pink mt-0.5" />
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
                      {filteredContentTypeOptions.length} {filteredContentTypeOptions.length !== 1 ? 'types' : 'type'}
                    </span>
                    {selectedContentTypeOption && (
                      <span className="text-[10px] text-brand-light-pink/60 truncate max-w-[180px] font-medium">
                        {selectedContentTypeOption.label}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Content type with pricing from the selected tier</p>
          </div>

          {/* Content Tags Multi-Select */}
          <div className="mt-4" ref={contentTagsRef}>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Content Tags
              <span className="text-[11px] text-zinc-500 font-normal ml-1.5">(Optional)</span>
            </label>
            <div className="relative">
              {/* Trigger button */}
              <button
                type="button"
                onClick={() => setContentTagsOpen((o) => !o)}
                className={[
                  'w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-sm transition-all duration-200 text-left outline-none',
                  contentTagsOpen
                    ? 'bg-zinc-900 border-brand-light-pink ring-2 ring-brand-light-pink/20 text-white'
                    : 'bg-zinc-900/60 border-zinc-700/50 text-white hover:border-zinc-500 hover:bg-zinc-900/80',
                ].join(' ')}
              >
                <span className="flex-1 text-zinc-500">
                  {selectedContentTags.length > 0
                    ? 'Content tags selected'
                    : 'Select content tags...'}
                </span>
                {selectedContentTags.length > 0 && (
                  <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-light-pink text-white text-[10px] font-bold">
                    {selectedContentTags.length}
                  </span>
                )}
                <ChevronDown
                  className={`shrink-0 w-4 h-4 transition-all duration-200 ${
                    contentTagsOpen ? 'text-brand-light-pink rotate-180' : 'text-zinc-500'
                  }`}
                />
              </button>

              {/* Dropdown panel */}
              {contentTagsOpen && (
                <div
                  className="absolute z-50 left-0 right-0 mt-2 bg-zinc-950 border border-zinc-800/80 rounded-xl overflow-hidden shadow-2xl shadow-black/50"
                  style={{ borderTop: '2px solid #F774B9' }}
                >
                  {/* Search */}
                  <div className="p-2 border-b border-zinc-800/60">
                    <div className="relative flex items-center">
                      <Search className={`absolute left-3 w-3.5 h-3.5 pointer-events-none transition-colors ${contentTagsSearch ? 'text-brand-light-pink' : 'text-zinc-600'}`} />
                      <input
                        type="text"
                        value={contentTagsSearch}
                        onChange={(e) => setContentTagsSearch(e.target.value)}
                        placeholder="Search tags..."
                        className="w-full pl-8 pr-8 py-2 text-sm bg-zinc-900/80 border border-zinc-700/40 rounded-lg text-white placeholder-zinc-600 outline-none focus:border-brand-light-pink focus:ring-2 focus:ring-brand-light-pink/15 transition-all duration-150"
                        autoFocus
                      />
                      {contentTagsSearch && (
                        <button
                          type="button"
                          onClick={() => setContentTagsSearch('')}
                          className="absolute right-2 text-zinc-600 hover:text-brand-light-pink transition-colors p-0.5 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Options list */}
                  <div className="max-h-64 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                    <div className="p-1.5 space-y-px">
                      {/* Select All */}
                      {!contentTagsSearch.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedContentTags.length === CONTENT_TAGS.length) {
                              setValue('contentTags', []);
                            } else {
                              setValue('contentTags', [...CONTENT_TAGS]);
                            }
                          }}
                          className={[
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-100 text-left border-b border-zinc-800/40 mb-1',
                            selectedContentTags.length === CONTENT_TAGS.length
                              ? 'text-brand-light-pink font-medium'
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60',
                          ].join(' ')}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all duration-150 ${
                              selectedContentTags.length === CONTENT_TAGS.length
                                ? 'bg-brand-light-pink border-brand-light-pink'
                                : selectedContentTags.length > 0
                                  ? 'border-brand-light-pink/50 bg-brand-light-pink/20'
                                  : 'border-zinc-600 bg-zinc-900'
                            }`}
                          >
                            {selectedContentTags.length === CONTENT_TAGS.length ? (
                              <Check className="w-3 h-3 text-white" strokeWidth={3} />
                            ) : selectedContentTags.length > 0 ? (
                              <Minus className="w-3 h-3 text-brand-light-pink" strokeWidth={3} />
                            ) : null}
                          </div>
                          <span className="italic">(Select All)</span>
                        </button>
                      )}

                      {/* Tag checkboxes */}
                      {filteredContentTags.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-2">
                          <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center">
                            <Search className="w-3.5 h-3.5 text-zinc-600" />
                          </div>
                          <span className="text-xs text-zinc-600">
                            No tags matching &quot;{contentTagsSearch}&quot;
                          </span>
                        </div>
                      ) : (
                        filteredContentTags.map((tag) => {
                          const isChecked = selectedContentTags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                const next = isChecked
                                  ? selectedContentTags.filter((t) => t !== tag)
                                  : [...selectedContentTags, tag];
                                setValue('contentTags', next);
                              }}
                              className={[
                                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-100 text-left',
                                isChecked
                                  ? 'bg-brand-light-pink/10 text-white font-medium'
                                  : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-white',
                              ].join(' ')}
                            >
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all duration-150 ${
                                  isChecked
                                    ? 'bg-brand-light-pink border-brand-light-pink'
                                    : 'border-zinc-600 bg-zinc-900'
                                }`}
                              >
                                {isChecked && (
                                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                )}
                              </div>
                              <span>{tag}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-3 py-1.5 border-t border-zinc-800/60 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-700 tracking-wide uppercase">
                      {selectedContentTags.length} of {CONTENT_TAGS.length} selected
                    </span>
                    {selectedContentTags.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setValue('contentTags', [])}
                        className="text-[10px] text-zinc-500 hover:text-brand-light-pink transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Selected tags as pills */}
            {selectedContentTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedContentTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-light-pink/10 border border-brand-light-pink/20 text-brand-light-pink rounded-lg text-[11px] font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() =>
                        setValue(
                          'contentTags',
                          selectedContentTags.filter((t) => t !== tag)
                        )
                      }
                      className="ml-0.5 hover:text-white transition-colors text-brand-mid-pink"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-[11px] text-zinc-500 mt-1">Categorize content for the QA review process</p>
          </div>

          {/* Internal Models Modal Multi-Select */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Internal Models
              <span className="text-[11px] text-zinc-500 font-normal ml-1.5">(Optional)</span>
            </label>
            {/* Trigger button */}
            <button
              type="button"
              onClick={() => {
                setInternalModelsSelection(selectedInternalModelTags);
                setInternalModelsSearch('');
                setInternalModelsModalOpen(true);
              }}
              className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-sm transition-all duration-200 text-left outline-none bg-zinc-900/60 border-zinc-700/50 text-white hover:border-zinc-500 hover:bg-zinc-900/80"
            >
              <span className="flex-1 text-zinc-500">
                {selectedInternalModelTags.length > 0
                  ? `Click to select models... (${selectedInternalModelTags.length} selected)`
                  : 'Select internal models...'}
              </span>
              {selectedInternalModelTags.length > 0 && (
                <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-light-pink text-white text-[10px] font-bold">
                  {selectedInternalModelTags.length}
                </span>
              )}
              <ChevronDown className="shrink-0 w-4 h-4 text-zinc-500" />
            </button>

            {/* Selected model names as pills */}
            {selectedInternalModelTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedInternalModelTags.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-light-pink/10 border border-brand-light-pink/20 text-brand-light-pink rounded-lg text-[11px] font-medium"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() =>
                        setValue(
                          'internalModelTags',
                          selectedInternalModelTags.filter((n) => n !== name)
                        )
                      }
                      className="ml-0.5 hover:text-white transition-colors text-brand-mid-pink"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-[11px] text-zinc-500 mt-1">Tag internal models associated with this content</p>

            {/* Modal Overlay */}
            {internalModelsModalOpen && typeof document !== 'undefined' && createPortal(
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center p-6"
              >
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => {
                    setInternalModelsModalOpen(false);
                    setInternalModelsSearch('');
                  }}
                />

                {/* Modal */}
                <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/60 flex flex-col max-h-[60vh]">
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                    <h3 className="text-sm font-semibold text-white">Select Internal Models</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setInternalModelsModalOpen(false);
                        setInternalModelsSearch('');
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Search */}
                  <div className="px-5 py-3 border-b border-zinc-800/60">
                    <div className="relative flex items-center">
                      <Search className={`absolute left-3 w-3.5 h-3.5 pointer-events-none transition-colors ${internalModelsSearch ? 'text-brand-light-pink' : 'text-zinc-600'}`} />
                      <input
                        type="text"
                        value={internalModelsSearch}
                        onChange={(e) => setInternalModelsSearch(e.target.value)}
                        placeholder="Search models..."
                        className="w-full pl-8 pr-8 py-2 text-sm bg-zinc-900/80 border border-zinc-700/40 rounded-lg text-white placeholder-zinc-600 outline-none focus:border-brand-light-pink focus:ring-2 focus:ring-brand-light-pink/15 transition-all duration-150"
                        autoFocus
                      />
                      {internalModelsSearch && (
                        <button
                          type="button"
                          onClick={() => setInternalModelsSearch('')}
                          className="absolute right-2 text-zinc-600 hover:text-brand-light-pink transition-colors p-0.5 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Model grid */}
                  <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-3 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                    {influencerProfilesLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                      </div>
                    ) : filteredProfiles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-2">
                        <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center">
                          <Search className="w-3.5 h-3.5 text-zinc-600" />
                        </div>
                        <span className="text-xs text-zinc-600">
                          {internalModelsSearch
                            ? `No models matching "${internalModelsSearch}"`
                            : 'No active models found'}
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {filteredProfiles.map((profile) => {
                          const displayName = profile.name;
                          const isChecked = internalModelsSelection.includes(displayName);
                          return (
                            <button
                              key={profile.id}
                              type="button"
                              onClick={() => {
                                setInternalModelsSelection((prev) =>
                                  isChecked
                                    ? prev.filter((n) => n !== displayName)
                                    : [...prev, displayName]
                                );
                              }}
                              className={[
                                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all duration-100 text-left border',
                                isChecked
                                  ? 'bg-brand-light-pink/10 border-brand-light-pink/30 text-white'
                                  : 'border-zinc-800 text-zinc-300 hover:bg-zinc-800/60 hover:text-white hover:border-zinc-700',
                              ].join(' ')}
                            >
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all duration-150 ${
                                  isChecked
                                    ? 'bg-brand-light-pink border-brand-light-pink'
                                    : 'border-zinc-600 bg-zinc-900'
                                }`}
                              >
                                {isChecked && (
                                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                )}
                              </div>
                              <span className="truncate">{displayName}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-zinc-800">
                    <span className="text-[11px] text-zinc-500">
                      {internalModelsSelection.length} selected
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setInternalModelsModalOpen(false);
                          setInternalModelsSearch('');
                        }}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setValue('internalModelTags', internalModelsSelection);
                          setInternalModelsModalOpen(false);
                          setInternalModelsSearch('');
                        }}
                        className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand-light-pink hover:bg-brand-dark-pink text-white transition-colors"
                      >
                        Save Selection ({internalModelsSelection.length})
                      </button>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>
        </div>
      )}

      {/* Template-specific metadata fields */}
      {templateFields.length > 0 && (
        <div className="space-y-4">
          {/* Section Divider */}
          <div className="flex items-center gap-3 my-2">
            <div className="h-px flex-1 bg-gradient-to-r from-brand-light-pink/30 to-transparent" />
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest px-3 py-1 rounded-full bg-zinc-800/60 border border-zinc-700/40">
              {TEMPLATE_OPTIONS.find((t) => t.value === submissionType)?.label} Details
            </span>
            <div className="h-px w-8 bg-zinc-800" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {templateFields.map((field) => (
              <MetadataFieldInput
                key={field.key}
                field={field}
                value={metadata[field.key]}
                onChange={(value) => handleMetadataChange(field.key, value)}
                profiles={field.key === 'model' ? sortedProfiles : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Priority & Assignee row */}
      <div className="pt-4 border-t border-zinc-800/60 space-y-6">
        {/* Priority */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-zinc-300">Priority</label>
            <span className="text-[11px] text-zinc-500">Affects board visibility</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {PRIORITY_OPTIONS.map(({ value, label, icon: PriorityIcon, selectedClass }) => {
              const isSelected = priority === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue('priority', value as any)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-semibold transition-all duration-150 ${
                    isSelected
                      ? selectedClass
                      : 'border-zinc-700/50 bg-zinc-800/30 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  <PriorityIcon className="w-4 h-4" />
                  {isSelected && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        value === 'low'
                          ? 'bg-emerald-400'
                          : value === 'normal'
                            ? 'bg-sky-400'
                            : value === 'high'
                              ? 'bg-amber-400'
                              : 'bg-rose-400'
                      }`}
                    />
                  )}
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Assignee Picker */}
        {spaceId && onAssigneeChange && (
          <AssigneePicker
            spaceId={spaceId}
            assigneeId={assigneeId}
            onAssigneeChange={onAssigneeChange}
          />
        )}
      </div>
    </div>
  );
}

// Dynamic metadata field renderer
function MetadataFieldInput({
  field,
  value,
  onChange,
  profiles,
}: {
  field: MetadataFieldDescriptor;
  value: any;
  onChange: (value: any) => void;
  profiles?: { id: string; name: string; username?: string | null }[];
}) {
  const inputClass =
    'w-full bg-zinc-900/60 border border-zinc-700/50 focus:border-brand-light-pink focus:ring-2 focus:ring-brand-light-pink/20 text-white placeholder-zinc-500 rounded-xl px-4 py-3 transition-all duration-150';

  const label = (
    <label className="block text-sm font-medium text-zinc-300 mb-2">
      {field.label}
      {field.required && <span className="text-brand-light-pink ml-1">*</span>}
      {!field.required && (
        <span className="text-[11px] text-zinc-500 font-normal ml-1.5">(Optional)</span>
      )}
    </label>
  );

  if (field.type === 'textarea') {
    return (
      <div className="sm:col-span-2">
        {label}
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>
    );
  }

  if (field.type === 'select' && field.options) {
    return (
      <div>
        {label}
        <SearchableDropdown
          options={field.options}
          value={value || ''}
          onChange={onChange}
          placeholder="Select..."
          searchPlaceholder={`Search ${field.label.toLowerCase()}...`}
        />
      </div>
    );
  }

  if (field.type === 'boolean') {
    return (
      <div className="sm:col-span-2 flex items-center justify-between px-4 py-3.5 rounded-xl bg-zinc-900/60 border border-zinc-700/40 transition-colors hover:border-zinc-600/60">
        <div>
          <p className="text-sm font-medium text-zinc-200">{field.label}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Toggle to mark as {field.label.toLowerCase()}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
            value ? 'bg-brand-light-pink' : 'bg-zinc-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block w-5 h-5 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
              value ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    );
  }

  if (field.type === 'tags' || field.type === 'multi-select') {
    const tags: string[] = Array.isArray(value) ? value : [];
    return (
      <div className="sm:col-span-2">
        {label}
        <TagInput tags={tags} onChange={onChange} placeholder={field.placeholder} />
      </div>
    );
  }

  // Model field with profiles → searchable dropdown
  if (field.key === 'model' && profiles && profiles.length > 0) {
    return (
      <div>
        {label}
        <SearchableDropdown
          options={profiles.map((p) => p.name)}
          value={(value as string) || ''}
          onChange={onChange}
          placeholder="Search models..."
          searchPlaceholder="Type to search models..."
        />
      </div>
    );
  }

  // text, number, date
  return (
    <div>
      {label}
      <input
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={value ?? ''}
        onChange={(e) =>
          onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)
        }
        placeholder={field.placeholder}
        className={`${inputClass} ${field.type === 'date' ? '[color-scheme:dark]' : ''}`}
      />
    </div>
  );
}

// ─── Assignee Picker ─────────────────────────────────────────────────────────

interface AssignableMember {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role?: string;
}

async function fetchOrgMembers(): Promise<AssignableMember[]> {
  const res = await fetch('/api/organization/members');
  if (!res.ok) return [];
  const data = await res.json();
  return (data as Array<{ id: string; firstName: string | null; lastName: string | null; email: string }>).map(
    (u) => ({
      id: u.id,
      userId: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
    })
  );
}

function useAssignableMembers(spaceId: string) {
  const spaceMembersQuery = useSpaceMembers(spaceId);
  const orgMembersQuery = useQuery({
    queryKey: ['org-members-assignee'],
    queryFn: fetchOrgMembers,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });

  // Normalize space members to AssignableMember shape
  const spaceMembers: AssignableMember[] = useMemo(() => {
    if (!spaceMembersQuery.data?.length) return [];
    return spaceMembersQuery.data.map((m) => ({
      id: m.id,
      userId: m.userId,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      email: m.user.email,
      role: m.role,
    }));
  }, [spaceMembersQuery.data]);

  // Use space members if available, otherwise fall back to org members
  const members = spaceMembers.length > 0 ? spaceMembers : (orgMembersQuery.data ?? []);
  const isLoading = spaceMembersQuery.isLoading || (spaceMembers.length === 0 && orgMembersQuery.isLoading);
  const source = spaceMembers.length > 0 ? 'space' : 'org';

  return { members, isLoading, source };
}

function AssigneePicker({
  spaceId,
  assigneeId,
  onAssigneeChange,
}: {
  spaceId: string;
  assigneeId?: string;
  onAssigneeChange: (userId: string | undefined) => void;
}) {
  const { members, isLoading, source } = useAssignableMembers(spaceId);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!members.length) return [];
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.firstName?.toLowerCase().includes(q) ||
        m.lastName?.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [members, search]);

  const selected = assigneeId
    ? members.find((m) => m.userId === assigneeId)
    : null;

  const getName = (m: AssignableMember) =>
    m.firstName
      ? `${m.firstName} ${m.lastName || ''}`.trim()
      : m.email;

  const getInitial = (m: AssignableMember) =>
    (m.firstName?.[0] || m.email[0]).toUpperCase();

  const ROLE_COLORS: Record<string, string> = {
    OWNER: 'text-amber-400 bg-amber-400/10',
    ADMIN: 'text-brand-blue bg-brand-blue/10',
    MEMBER: 'text-zinc-400 bg-zinc-700/40',
    VIEWER: 'text-zinc-500 bg-zinc-800/40',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-medium text-zinc-300">
          Assign To
          <span className="text-[11px] text-zinc-500 font-normal ml-1.5">(Optional)</span>
        </label>
        {selected && (
          <button
            type="button"
            onClick={() => {
              onAssigneeChange(undefined);
              setIsOpen(false);
            }}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Selected member display */}
      {selected && !isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-900/60 border border-brand-light-pink/30 rounded-xl transition-all duration-150 hover:border-brand-light-pink/50 text-left group"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-light-pink/30 to-brand-dark-pink/20 border border-brand-light-pink/30 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-brand-light-pink">
              {getInitial(selected)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {getName(selected)}
            </p>
            <p className="text-[11px] text-zinc-500 truncate">{selected.email}</p>
          </div>
          {selected.role && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[selected.role] || ROLE_COLORS.MEMBER}`}>
              {selected.role}
            </span>
          )}
        </button>
      ) : (
        /* Dropdown picker */
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={source === 'space' ? 'Search space members...' : 'Search team members...'}
              className="w-full bg-zinc-900/60 border border-zinc-700/50 focus:border-brand-light-pink focus:ring-2 focus:ring-brand-light-pink/20 text-white placeholder-zinc-500 rounded-xl pl-10 pr-4 py-3 transition-all duration-150"
            />
            {isOpen && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSearch('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isOpen && (
            <div className="absolute z-50 mt-2 w-full bg-zinc-900 border border-zinc-700/60 rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-fade-in">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <UserIcon className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">
                    {search ? 'No members found' : 'No team members available'}
                  </p>
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto py-1 scrollbar-thin">
                  {source === 'org' && (
                    <div className="px-4 py-1.5 border-b border-zinc-800/40">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Organization Members</p>
                    </div>
                  )}
                  {filtered.map((member) => {
                    const isActive = assigneeId === member.userId;
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          onAssigneeChange(member.userId);
                          setIsOpen(false);
                          setSearch('');
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 ${
                          isActive
                            ? 'bg-brand-light-pink/10'
                            : 'hover:bg-zinc-800/80'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                            isActive
                              ? 'bg-gradient-to-br from-brand-light-pink/30 to-brand-dark-pink/20 border-brand-light-pink/40'
                              : 'bg-zinc-800 border-zinc-700/60'
                          }`}
                        >
                          <span
                            className={`text-xs font-bold ${
                              isActive ? 'text-brand-light-pink' : 'text-zinc-400'
                            }`}
                          >
                            {getInitial(member)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${isActive ? 'text-white font-medium' : 'text-zinc-300'}`}>
                            {getName(member)}
                          </p>
                          <p className="text-[11px] text-zinc-600 truncate">{member.email}</p>
                        </div>
                        {member.role && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${ROLE_COLORS[member.role] || ROLE_COLORS.MEMBER}`}>
                            {member.role}
                          </span>
                        )}
                        {isActive && (
                          <Check className="w-4 h-4 text-brand-light-pink shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState('');

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder || 'Type and press Enter'}
          className="flex-1 bg-zinc-900/60 border border-zinc-700/50 focus:border-brand-light-pink focus:ring-2 focus:ring-brand-light-pink/20 text-white placeholder-zinc-500 rounded-xl px-4 py-3 transition-all duration-150"
        />
        <button
          type="button"
          onClick={addTag}
          className="px-4 py-3 bg-brand-light-pink/10 border border-brand-light-pink/30 text-brand-light-pink hover:bg-brand-light-pink/20 rounded-xl text-sm font-medium transition-colors"
        >
          Add
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-light-pink/10 border border-brand-light-pink/20 text-brand-light-pink rounded-lg text-xs font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="ml-0.5 hover:text-white transition-colors text-brand-mid-pink text-base leading-none"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
