'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createSubmissionWithComponentsSchema } from '@/lib/validations/content-submission';
import type { CreateSubmissionWithComponents, ComponentModule } from '@/lib/validations/content-submission';
import { useCreateSubmission, useUpdateSubmission } from '@/lib/hooks/useContentSubmission.query';
import { getRecommendations, isComponentForced } from '@/lib/content-submission/recommendations';
import { PlatformSelector } from './PlatformSelector';
import { SubmissionTypeSelector } from './SubmissionTypeSelector';
import { ContentStyleSelector } from './ContentStyleSelector';
import { ComponentSelector } from './ComponentSelector';
import { ContentDetailsFields } from './ContentDetailsFields';
import { FileUploadZone } from './FileUploadZone';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

type FormData = CreateSubmissionWithComponents;

interface ClassicSubmissionFormProps {
  submissionId?: string;
  initialData?: Partial<FormData>;
  onSuccess?: (submissionId: string) => void;
  onCancel?: () => void;
}

export function ClassicSubmissionForm({
  submissionId,
  initialData,
  onSuccess,
  onCancel,
}: ClassicSubmissionFormProps) {
  const isEditMode = !!submissionId;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createSubmissionWithComponentsSchema),
    defaultValues: initialData || {
      submissionType: 'otp',
      contentStyle: 'normal',
      priority: 'normal',
      platform: 'onlyfans',
      selectedComponents: [],
      contentTags: [],
      internalModelTags: [],
      contentType: undefined,
      contentLength: '',
      contentCount: '',
      externalCreatorTags: '',
    },
  });

  const createSubmission = useCreateSubmission();
  const updateSubmission = useUpdateSubmission();

  const submissionType = watch('submissionType');
  const contentStyle = watch('contentStyle');
  const platform = watch('platform');
  const selectedComponents = watch('selectedComponents') || [];

  // Get smart recommendations
  const recommendations = useMemo(
    () => getRecommendations(submissionType, contentStyle),
    [submissionType, contentStyle]
  );

  // Get forced components
  const forcedComponents = useMemo(
    () => recommendations.filter((comp) => isComponentForced(comp, submissionType)),
    [recommendations, submissionType]
  );

  const [showSuccess, setShowSuccess] = useState(false);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEditMode) {
        await updateSubmission.mutateAsync({
          id: submissionId,
          ...data,
        });
      } else {
        await createSubmission.mutateAsync(data);
      }

      // Show success message
      setShowSuccess(true);

      // Reset form after delay
      setTimeout(() => {
        setShowSuccess(false);
        reset();
      }, 3000);
    } catch (error) {
      console.error('Submission failed:', error);
      alert('Failed to save submission');
    }
  };

  const hasComponent = (component: ComponentModule) =>
    selectedComponents.includes(component);

  return (
    <div className="min-h-screen bg-[#0a0a0b] pb-16">
      {/* Success Overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border-2 border-green-500/50 rounded-2xl p-12 max-w-md text-center shadow-2xl shadow-green-500/20 animate-scale-in">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 mb-4">
                <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Submission Created!</h2>
              <p className="text-zinc-400">
                Your content submission has been logged to the console. Check DevTools to see the data.
              </p>
            </div>
            <p className="text-sm text-zinc-500">
              This is design-only mode. No data was saved to a backend.
            </p>
          </div>
        </div>
      )}

      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/5 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Platform & Type Section */}
          <Section title="Platform & Submission Type">
            <div className="space-y-6">
              <PlatformSelector
                value={platform}
                onChange={(value) => setValue('platform', value)}
              />

              <div className="border-t border-zinc-700/50 pt-6">
                <h4 className="text-lg font-semibold text-white mb-4">Submission Type</h4>
                <SubmissionTypeSelector
                  value={submissionType}
                  onChange={(value) => setValue('submissionType', value)}
                />
              </div>

              <div className="border-t border-zinc-700/50 pt-6">
                <h4 className="text-lg font-semibold text-white mb-4">Content Style</h4>
                <ContentStyleSelector
                  value={contentStyle}
                  onChange={(value) => setValue('contentStyle', value as any)}
                  submissionType={submissionType}
                />
              </div>
            </div>
          </Section>

          {/* Component Modules Section */}
          <Section title="Component Modules">
            <ComponentSelector
              selected={selectedComponents}
              onChange={(components) => setValue('selectedComponents', components)}
              recommendations={recommendations}
              disabled={forcedComponents}
            />
          </Section>

          {/* Content Details Section */}
          <Section title="Content Details">
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Model Name */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Model/Influencer Name
                  </label>
                  <input
                    {...register('modelName')}
                    type="text"
                    placeholder="Enter model name"
                    className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                  />
                  {errors.modelName && (
                    <p className="text-sm text-red-400 mt-1">{errors.modelName.message}</p>
                  )}
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Priority
                  </label>
                  <select
                    {...register('priority')}
                    className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                {/* Drive Link */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Drive Link <span className="text-zinc-500 text-xs">(Optional)</span>
                  </label>
                  <input
                    {...register('driveLink')}
                    type="url"
                    placeholder="https://drive.google.com/..."
                    className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                  />
                </div>

                {/* Caption */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Caption
                  </label>
                  <textarea
                    {...register('caption')}
                    rows={4}
                    placeholder="Enter your caption..."
                    className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all resize-none"
                  />
                </div>
              </div>

              {/* Enhanced Content Details */}
              <div className="border-t border-zinc-700/50 pt-6">
                <h4 className="text-lg font-semibold text-white mb-4">Additional Details</h4>
                <ContentDetailsFields
                  register={register}
                  setValue={setValue}
                  watch={watch}
                  errors={errors}
                />
              </div>
            </div>
          </Section>

          {/* Release Schedule (if component selected) */}
          {hasComponent('release') && (
            <Section title="Release Schedule">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Release Date <span className="text-brand-light-pink">*</span>
                  </label>
                  <input
                    {...register('releaseSchedule.releaseDate')}
                    type="date"
                    className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Release Time
                  </label>
                  <input
                    {...register('releaseSchedule.releaseTime')}
                    type="time"
                    className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Timezone
                  </label>
                  <select
                    {...register('releaseSchedule.timezone')}
                    className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                  </select>
                </div>
              </div>
            </Section>
          )}

          {/* Pricing (if component selected) */}
          {hasComponent('pricing') && (
            <Section title="Pricing">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Minimum Price ($)
                  </label>
                  <input
                    {...register('pricing.minimumPrice', { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Pricing Type
                  </label>
                  <select
                    {...register('pricing.pricingType')}
                    className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                  >
                    <option value="fixed">Fixed Price</option>
                    <option value="range">Price Range</option>
                    <option value="negotiable">Negotiable</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Pricing Notes <span className="text-zinc-500 text-xs">(Optional)</span>
                  </label>
                  <textarea
                    {...register('pricing.pricingNotes')}
                    rows={3}
                    placeholder="Any pricing details or notes..."
                    className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all resize-none"
                  />
                </div>
              </div>
            </Section>
          )}

          {/* File Uploads (if component selected) */}
          {hasComponent('upload') && (
            <Section title="File Uploads">
              {submissionId ? (
                <FileUploadZone submissionId={submissionId} />
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6">
                  <p className="text-sm text-amber-200/80 font-light">
                    Save the submission first to upload files
                  </p>
                </div>
              )}
            </Section>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center justify-between pt-6">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-all duration-200"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="ml-auto group inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-brand-light-pink to-brand-dark-pink hover:from-brand-dark-pink hover:to-brand-light-pink text-white font-medium transition-all duration-300 shadow-lg shadow-brand-light-pink/20 hover:shadow-brand-light-pink/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isEditMode ? 'Update Submission' : 'Submit Content'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Section wrapper component
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 overflow-hidden">
      <CardHeader className="border-b border-zinc-800/50 pb-4">
        <h2 className="text-2xl font-semibold bg-gradient-to-r from-brand-light-pink to-brand-blue bg-clip-text text-transparent">
          {title}
        </h2>
      </CardHeader>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  );
}
