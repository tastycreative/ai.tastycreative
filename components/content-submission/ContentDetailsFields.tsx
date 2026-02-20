'use client';

import { useCallback, useMemo, useState } from 'react';
import { User, RefreshCw, Calendar, Clock, Globe } from 'lucide-react';
import type { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from 'react-hook-form';
import type { CreateSubmissionWithComponents } from '@/lib/validations/content-submission';
import { PricingTierSelector } from './PricingTierSelector';
import {
  useContentTypeOptions,
  type ContentTypeOption,
} from '@/lib/hooks/useContentTypeOptions.query';
import { useInstagramProfiles } from '@/lib/hooks/useInstagramProfiles.query';
import { SearchableSelect } from './inputs/SearchableSelect';
import type { SearchableSelectItem } from './inputs/SearchableSelect';
import { SearchableMultiSelect } from './inputs/SearchableMultiSelect';
import { ContentTagsSelect } from './inputs/ContentTagsSelect';
import { ContentTypeSelect } from './inputs/ContentTypeSelect';

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

interface ContentDetailsFieldsProps {
  register: UseFormRegister<CreateSubmissionWithComponents>;
  setValue: UseFormSetValue<CreateSubmissionWithComponents>;
  watch: UseFormWatch<CreateSubmissionWithComponents>;
  errors: FieldErrors<CreateSubmissionWithComponents>;
}

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

  const [selectedContentTypeOptionId, setSelectedContentTypeOptionId] = useState('');

  // Fetch profiles via TanStack Query hook
  const { data: profilesData = [], isLoading: loadingProfiles } = useInstagramProfiles();

  const profiles: SearchableSelectItem[] = useMemo(
    () => profilesData.map((p) => ({ id: p.id, name: p.name, type: 'of_model' })),
    [profilesData]
  );

  const ofModelProfiles = useMemo(
    () => profiles.filter((p) => p.type === 'of_model'),
    [profiles]
  );

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
          items={profiles}
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
