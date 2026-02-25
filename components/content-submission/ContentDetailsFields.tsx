'use client';

import { useCallback, useState } from 'react';
import {
  Image,
  MessageSquare,
  DollarSign,
  ArrowDown,
  ArrowUp,
  Minus,
  Zap,
  Check,
} from 'lucide-react';
import type { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from 'react-hook-form';
import type { CreateSubmissionWithComponents } from '@/lib/validations/content-submission';
import {
  getMetadataDefaults,
  getMetadataFields,
  type MetadataFieldDescriptor,
} from '@/lib/spaces/template-metadata';
import { SearchableDropdown } from '@/components/ui/SearchableDropdown';

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

interface ContentDetailsFieldsProps {
  register: UseFormRegister<CreateSubmissionWithComponents>;
  setValue: UseFormSetValue<CreateSubmissionWithComponents>;
  watch: UseFormWatch<CreateSubmissionWithComponents>;
  errors: FieldErrors<CreateSubmissionWithComponents>;
  readOnlyType?: SubmissionTemplateType;
}

export function ContentDetailsFields({
  setValue,
  watch,
  errors,
  readOnlyType,
}: ContentDetailsFieldsProps) {
  const submissionType = (watch('submissionType') ?? 'OTP_PTR') as SubmissionTemplateType;
  const metadata = watch('metadata') || {};
  const priority = watch('priority') || 'normal';

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
      setValue('metadata', { ...metadata, [key]: value });
    },
    [setValue, metadata]
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
              />
            ))}
          </div>
        </div>
      )}

      {/* Priority */}
      <div className="pt-4 border-t border-zinc-800/60">
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
    </div>
  );
}

// Dynamic metadata field renderer
function MetadataFieldInput({
  field,
  value,
  onChange,
}: {
  field: MetadataFieldDescriptor;
  value: any;
  onChange: (value: any) => void;
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
