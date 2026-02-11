'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createSubmissionWithComponentsSchema } from '@/lib/validations/content-submission';
import type { CreateSubmissionWithComponents, ComponentModule } from '@/lib/validations/content-submission';
import { useCreateSubmission, useUpdateSubmission } from '@/lib/hooks/useContentSubmission.query';
import { generateSteps, ensureValidStep } from '@/lib/content-submission/step-generator';
import { getRecommendations, isComponentForced } from '@/lib/content-submission/recommendations';
import { SubmissionTypeSelector } from './SubmissionTypeSelector';
import { ContentStyleSelector } from './ContentStyleSelector';
import { PlatformSelector } from './PlatformSelector';
import { ComponentSelector } from './ComponentSelector';
import { ContentDetailsFields } from './ContentDetailsFields';
import { FileUploadZone } from './FileUploadZone';
import { Loader2, Check, ChevronRight } from 'lucide-react';

type FormData = CreateSubmissionWithComponents;

interface SubmissionFormProps {
  submissionId?: string;
  initialData?: Partial<FormData>;
  onSuccess?: (submissionId: string) => void;
  onCancel?: () => void;
}

export function SubmissionForm({
  submissionId,
  initialData,
  onSuccess,
  onCancel,
}: SubmissionFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
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
  const isPTR = submissionType === 'ptr';

  // Generate dynamic steps based on selections
  const steps = useMemo(
    () => generateSteps(submissionType, contentStyle, selectedComponents),
    [submissionType, contentStyle, selectedComponents]
  );

  // Get smart recommendations
  const recommendations = useMemo(
    () => getRecommendations(submissionType, contentStyle),
    [submissionType, contentStyle]
  );

  // Get forced components (cannot be disabled)
  const forcedComponents = useMemo(
    () => recommendations.filter((comp) => isComponentForced(comp, submissionType)),
    [recommendations, submissionType]
  );

  // Auto-apply recommendations when submission type or content style changes
  useEffect(() => {
    const currentComponents = selectedComponents;
    const needsUpdate = recommendations.some(
      (rec) => !currentComponents.includes(rec)
    );

    if (needsUpdate && recommendations.length > 0) {
      // Merge recommendations with current selection
      const updated = Array.from(
        new Set([...currentComponents, ...recommendations])
      );
      setValue('selectedComponents', updated);
    }
  }, [recommendations, selectedComponents, setValue]);

  // Ensure current step is valid after step changes
  useEffect(() => {
    const validStep = ensureValidStep(currentStep, steps);
    if (validStep !== currentStep) {
      setCurrentStep(validStep);
    }
  }, [steps, currentStep]);

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
        setCurrentStep(0);
        reset();
      }, 3000);
    } catch (error) {
      console.error('Submission failed:', error);
      alert('Failed to save submission');
    }
  };

  // Get current step info for rendering
  const currentStepInfo = steps[currentStep];

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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/3 rounded-full blur-[200px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Progress Indicator */}
        <div className="mb-12">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  {/* Step Circle */}
                  <div className={`
                    relative flex items-center justify-center w-12 h-12 rounded-full border-2 font-semibold text-sm transition-all duration-500
                    ${index < currentStep
                      ? 'border-brand-light-pink bg-brand-light-pink text-white shadow-lg shadow-brand-light-pink/30'
                      : index === currentStep
                      ? 'border-brand-light-pink bg-transparent text-brand-light-pink shadow-lg shadow-brand-light-pink/20 ring-4 ring-brand-light-pink/10'
                      : 'border-zinc-700 bg-zinc-900/50 text-zinc-500'
                    }
                  `}>
                    {index < currentStep ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>

                  {/* Step Title */}
                  <div className={`
                    mt-3 text-xs font-medium text-center transition-colors duration-300 hidden sm:block
                    ${index <= currentStep ? 'text-zinc-300' : 'text-zinc-600'}
                  `}>
                    {step.title}
                  </div>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2 -mt-6">
                    <div className={`
                      h-full transition-all duration-500
                      ${index < currentStep
                        ? 'bg-gradient-to-r from-brand-light-pink to-brand-dark-pink'
                        : 'bg-zinc-800'
                      }
                    `} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Step Content Card */}
          <div className="relative bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-8 sm:p-12 overflow-hidden mb-8">
            {/* Accent gradient overlay */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-light-pink to-transparent opacity-60" />

            {/* Floating decorative elements */}
            <div className="absolute top-8 right-8 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-8 left-8 w-40 h-40 bg-fuchsia-500/5 rounded-full blur-3xl" />

            <div className="relative">
              {/* Platform & Type Step (Combined) */}
              {currentStepInfo?.id === 'platform-type' && (
                <div className="space-y-8 animate-fade-in-up">
                  {/* Platform Selection */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
                        Platform Selection
                      </h2>
                      <p className="text-lg text-zinc-400 font-light">
                        Choose your target platform
                      </p>
                    </div>
                    <PlatformSelector
                      value={platform}
                      onChange={(value) => setValue('platform', value)}
                    />
                  </div>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-800/50"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-[#0a0a0b] text-zinc-500">and</span>
                    </div>
                  </div>

                  {/* Submission Type */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
                        Submission Type
                      </h2>
                      <p className="text-lg text-zinc-400 font-light">
                        Choose between one-time post or pay-to-release content
                      </p>
                    </div>
                    <SubmissionTypeSelector
                      value={submissionType}
                      onChange={(value) => setValue('submissionType', value)}
                    />
                  </div>
                </div>
              )}

              {/* Style & Components Step (Combined) */}
              {currentStepInfo?.id === 'style-components' && (
                <div className="space-y-8 animate-fade-in-up">
                  {/* Content Style */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
                        Content Style
                      </h2>
                      <p className="text-lg text-zinc-400 font-light">
                        What type of content are you submitting?
                      </p>
                    </div>
                    <ContentStyleSelector
                      value={contentStyle}
                      onChange={(value) => setValue('contentStyle', value as any)}
                      submissionType={submissionType}
                    />
                  </div>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-800/50"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-[#0a0a0b] text-zinc-500">then</span>
                    </div>
                  </div>

                  {/* Component Selection */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
                        Add Components
                      </h2>
                      <p className="text-lg text-zinc-400 font-light">
                        Customize your submission with optional modules
                      </p>
                    </div>
                    <ComponentSelector
                      selected={selectedComponents}
                      onChange={(components) => setValue('selectedComponents', components)}
                      recommendations={recommendations}
                      disabled={forcedComponents}
                    />
                  </div>
                </div>
              )}

              {/* Content Details Step */}
              {currentStepInfo?.id === 'details' && (
                <div className="space-y-8 animate-fade-in-up">
                  <div className="space-y-2">
                    <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
                      Content Details
                    </h2>
                    <p className="text-lg text-zinc-400 font-light">
                      Provide details about your {contentStyle === 'poll' ? 'poll' : contentStyle === 'game' ? 'game' : contentStyle === 'bundle' ? 'bundle' : 'content'}
                    </p>
                  </div>

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

                  {/* Enhanced Content Details Fields */}
                  <div className="border-t border-zinc-700/50 pt-6">
                    <ContentDetailsFields
                      register={register}
                      setValue={setValue}
                      watch={watch}
                      errors={errors}
                    />
                  </div>

                  {/* Style-Specific Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {contentStyle === 'poll' && (
                      <>
                        <div className="sm:col-span-2">
                          <div className="border-t border-zinc-700/50 pt-6 mb-4">
                            <h3 className="text-xl font-medium text-white mb-1">Poll Configuration</h3>
                            <p className="text-sm text-zinc-400">Set up your poll options and duration</p>
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Poll Question
                          </label>
                          <input
                            {...register('metadata.pollQuestion' as any)}
                            type="text"
                            placeholder="What question do you want to ask?"
                            className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Poll Duration (hours)
                          </label>
                          <input
                            {...register('metadata.pollDuration' as any, { valueAsNumber: true })}
                            type="number"
                            min="1"
                            max="168"
                            placeholder="24"
                            className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                          />
                        </div>
                      </>
                    )}

                    {contentStyle === 'game' && (
                      <>
                        <div className="sm:col-span-2">
                          <div className="border-t border-zinc-700/50 pt-6 mb-4">
                            <h3 className="text-xl font-medium text-white mb-1">Game Configuration</h3>
                            <p className="text-sm text-zinc-400">Define your interactive game details</p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Game Type
                          </label>
                          <select
                            {...register('metadata.gameType' as any)}
                            className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                          >
                            <option value="">Select type...</option>
                            <option value="trivia">Trivia</option>
                            <option value="challenge">Challenge</option>
                            <option value="prediction">Prediction</option>
                            <option value="other">Other</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Prize Description
                          </label>
                          <input
                            {...register('metadata.prizeDescription' as any)}
                            type="text"
                            placeholder="What can they win?"
                            className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Game Rules
                          </label>
                          <textarea
                            {...register('metadata.gameRules' as any)}
                            rows={3}
                            placeholder="Explain how to play..."
                            className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Entry Cost <span className="text-zinc-500 text-xs">(Optional)</span>
                          </label>
                          <input
                            {...register('metadata.entryCost' as any, { valueAsNumber: true })}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                          />
                        </div>
                      </>
                    )}

                    {contentStyle === 'bundle' && (
                      <>
                        <div className="sm:col-span-2">
                          <div className="border-t border-zinc-700/50 pt-6 mb-4">
                            <h3 className="text-xl font-medium text-white mb-1">Bundle Configuration</h3>
                            <p className="text-sm text-zinc-400">Package multiple items together</p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Bundle Items Count
                          </label>
                          <input
                            {...register('metadata.bundleItemsCount' as any, { valueAsNumber: true })}
                            type="number"
                            min="2"
                            placeholder="5"
                            className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Bundle Description
                          </label>
                          <textarea
                            {...register('metadata.bundleDescription' as any)}
                            rows={3}
                            placeholder="Describe what's included in this bundle..."
                            className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all resize-none"
                          />
                        </div>
                      </>
                    )}

                    {/* Common fields for all styles */}
                    {/* Drive Link */}
                    <div className="sm:col-span-2">
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

                    {/* Notes */}
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        Notes <span className="text-zinc-500 text-xs">(Optional)</span>
                      </label>
                      <textarea
                        {...register('notes')}
                        rows={3}
                        placeholder="Any additional notes or instructions..."
                        className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white placeholder-zinc-500 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Release Schedule Step */}
              {currentStepInfo?.id === 'schedule' && (
                <div className="space-y-8 animate-fade-in-up">
                  <div className="space-y-2">
                    <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
                      Release Schedule
                    </h2>
                    <p className="text-lg text-zinc-400 font-light">
                      Set when this content should be released
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Release Date */}
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

                    {/* Release Time */}
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

                    {/* Timezone */}
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
                </div>
              )}

              {/* Pricing Step */}
              {currentStepInfo?.id === 'pricing' && (
                <div className="space-y-8 animate-fade-in-up">
                  <div className="space-y-2">
                    <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
                      Pricing
                    </h2>
                    <p className="text-lg text-zinc-400 font-light">
                      Set pricing for this content
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Minimum Price */}
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

                    {/* Pricing Type */}
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

                    {/* Pricing Notes */}
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
                </div>
              )}

              {/* File Upload Step */}
              {currentStepInfo?.id === 'files' && (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="space-y-2">
                    <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
                      Upload Files
                    </h2>
                    <p className="text-lg text-zinc-400 font-light">
                      Upload images, videos, or other files for this submission
                    </p>
                  </div>

                  {submissionId ? (
                    <FileUploadZone submissionId={submissionId} />
                  ) : (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6">
                      <p className="text-sm text-amber-200/80 font-light">
                        Save the submission first to upload files
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Review & Submit Step */}
              {currentStepInfo?.id === 'review' && (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="space-y-2">
                    <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
                      Review & Submit
                    </h2>
                    <p className="text-lg text-zinc-400 font-light">
                      Review your submission details before finalizing
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Submission Type & Style */}
                    <div className="bg-zinc-800/30 rounded-xl p-6 border border-zinc-700/30">
                      <h3 className="text-sm font-medium text-zinc-400 mb-3">Submission Overview</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">Type</p>
                          <p className="text-white font-medium">{submissionType === 'otp' ? 'One-Time Post (OTP)' : 'Pay-to-Release (PTR)'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">Content Style</p>
                          <p className="text-white font-medium capitalize">{contentStyle}</p>
                        </div>
                      </div>
                    </div>

                    {/* Content Details */}
                    <div className="bg-zinc-800/30 rounded-xl p-6 border border-zinc-700/30">
                      <h3 className="text-sm font-medium text-zinc-400 mb-3">Content Details</h3>
                      <div className="space-y-3">
                        {watch('modelName') && (
                          <div>
                            <p className="text-xs text-zinc-500 mb-1">Model/Influencer</p>
                            <p className="text-white">{watch('modelName')}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-zinc-500 mb-1">Priority</p>
                            <p className="text-white capitalize">{watch('priority')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 mb-1">Platform</p>
                            <p className="text-white capitalize">{watch('platform')}</p>
                          </div>
                        </div>
                        {watch('caption') && (
                          <div>
                            <p className="text-xs text-zinc-500 mb-1">Caption</p>
                            <p className="text-white text-sm line-clamp-3">{watch('caption')}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Release Schedule (PTR only) */}
                    {isPTR && watch('releaseSchedule.releaseDate') && (
                      <div className="bg-zinc-800/30 rounded-xl p-6 border border-zinc-700/30">
                        <h3 className="text-sm font-medium text-zinc-400 mb-3">Release Schedule</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-zinc-500 mb-1">Release Date</p>
                            <p className="text-white">{watch('releaseSchedule.releaseDate')?.toString()}</p>
                          </div>
                          {watch('releaseSchedule.releaseTime') && (
                            <div>
                              <p className="text-xs text-zinc-500 mb-1">Release Time</p>
                              <p className="text-white">{watch('releaseSchedule.releaseTime')?.toString()}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Pricing (PTR/PPV) */}
                    {(isPTR || contentStyle === 'ppv') && watch('pricing.minimumPrice') && (
                      <div className="bg-zinc-800/30 rounded-xl p-6 border border-zinc-700/30">
                        <h3 className="text-sm font-medium text-zinc-400 mb-3">Pricing</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-zinc-500 mb-1">Minimum Price</p>
                            <p className="text-white">${watch('pricing.minimumPrice')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 mb-1">Pricing Type</p>
                            <p className="text-white capitalize">{watch('pricing.pricingType')}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ready to Submit */}
                    <div className="bg-gradient-to-r from-brand-light-pink/10 to-brand-dark-pink/10 border border-brand-light-pink/20 rounded-xl p-6">
                      <p className="text-white font-medium mb-1">Ready to submit?</p>
                      <p className="text-sm text-zinc-400">
                        Click Submit below to create your {submissionType === 'otp' ? 'OTP' : 'PTR'} submission.
                        {!submissionId && ' Files can be uploaded after creation.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-all duration-200"
            >
              Cancel
            </button>

            <div className="flex items-center space-x-3">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-6 py-3 bg-zinc-800/50 border border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 rounded-xl transition-all duration-200"
                >
                  Back
                </button>
              )}

              {currentStep < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="group inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-brand-light-pink to-brand-dark-pink hover:from-brand-dark-pink hover:to-brand-light-pink text-white font-medium transition-all duration-300 shadow-lg shadow-brand-light-pink/20 hover:shadow-brand-light-pink/40 hover:scale-105"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-brand-light-pink to-brand-dark-pink hover:from-brand-dark-pink hover:to-brand-light-pink text-white font-medium transition-all duration-300 shadow-lg shadow-brand-light-pink/20 hover:shadow-brand-light-pink/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{isEditMode ? 'Update' : 'Submit'}</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
