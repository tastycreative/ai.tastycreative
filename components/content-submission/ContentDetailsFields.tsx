'use client';

import { X } from 'lucide-react';
import type { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from 'react-hook-form';
import type { CreateSubmissionWithComponents } from '@/lib/validations/content-submission';
import { PricingTierSelector } from './PricingTierSelector';

const CONTENT_TYPES = [
  { value: 'photo', label: 'Photo' },
  { value: 'video', label: 'Video' },
  { value: 'photo_set', label: 'Photo Set' },
  { value: 'video_set', label: 'Video Set' },
  { value: 'mixed', label: 'Mixed (Photos + Videos)' },
  { value: 'gif', label: 'GIF' },
  { value: 'livestream', label: 'Livestream' },
  { value: 'audio', label: 'Audio' },
  { value: 'text', label: 'Text Only' },
] as const;

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

  // Parse @ mentions from external tags
  const parsedExternalTags = externalCreatorTags
    .match(/@\w+/g)
    ?.map((tag) => tag.substring(1)) || [];

  // For demo, using static model list. In production, fetch from API
  const availableModels = [
    { id: '1', name: 'Model Alpha' },
    { id: '2', name: 'Model Beta' },
    { id: '3', name: 'Model Gamma' },
    { id: '4', name: 'Model Delta' },
  ];

  const addInternalTag = (modelName: string) => {
    if (!internalModelTags.includes(modelName)) {
      setValue('internalModelTags', [...internalModelTags, modelName]);
    }
  };

  const removeInternalTag = (modelName: string) => {
    setValue(
      'internalModelTags',
      internalModelTags.filter((tag) => tag !== modelName)
    );
  };

  return (
    <div className="space-y-6">
      {/* Content Type */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Content Type
          <span className="text-zinc-500 text-xs ml-1">(Optional)</span>
        </label>
        <select
          {...register('contentType')}
          className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
        >
          <option value="">Select content type...</option>
          {CONTENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        {errors.contentType && (
          <p className="text-sm text-red-400 mt-1">{errors.contentType.message}</p>
        )}
      </div>

      {/* Pricing Tier */}
      <PricingTierSelector
        value={pricingCategory}
        onChange={(value) => setValue('pricingCategory', value as any)}
      />

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

        {/* Display parsed tags */}
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

      {/* Internal Model Tags */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Internal Model Tags
          <span className="text-zinc-500 text-xs ml-1">(Optional)</span>
        </label>

        {/* Simple dropdown for demo - can be upgraded to Combobox */}
        <select
          onChange={(e) => {
            if (e.target.value) {
              addInternalTag(e.target.value);
              e.target.value = '';
            }
          }}
          className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
        >
          <option value="">Select models to tag...</option>
          {availableModels
            .filter((model) => !internalModelTags.includes(model.name))
            .map((model) => (
              <option key={model.id} value={model.name}>
                {model.name}
              </option>
            ))}
        </select>

        <p className="text-xs text-zinc-500 mt-1">
          Tag related internal models for cross-promotion
        </p>

        {/* Selected Tags */}
        {internalModelTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {internalModelTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => removeInternalTag(tag)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-light-pink/20 border border-brand-light-pink/30 text-brand-light-pink rounded-lg text-sm font-medium hover:bg-brand-light-pink/30 transition-colors"
              >
                {tag}
                <X className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        )}

        {errors.internalModelTags && (
          <p className="text-sm text-red-400 mt-1">
            {errors.internalModelTags.message}
          </p>
        )}
      </div>
    </div>
  );
}
