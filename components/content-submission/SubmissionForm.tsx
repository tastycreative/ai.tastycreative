'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createSubmissionWithPricingSchema } from '@/lib/validations/content-submission';
import { useCreateSubmission, useUpdateSubmission } from '@/lib/hooks/useContentSubmission.query';
import { SubmissionTypeSelector } from './SubmissionTypeSelector';
import { ContentStyleSelector } from './ContentStyleSelector';
import { FileUploadZone } from './FileUploadZone';
import { Loader2 } from 'lucide-react';

type FormData = z.infer<typeof createSubmissionWithPricingSchema>;

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
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createSubmissionWithPricingSchema),
    defaultValues: initialData || {
      submissionType: 'otp',
      contentStyle: 'normal',
      priority: 'normal',
      platform: 'onlyfans',
      contentTags: [],
      internalModelTags: [],
    },
  });

  const createSubmission = useCreateSubmission();
  const updateSubmission = useUpdateSubmission();

  const submissionType = watch('submissionType');
  const contentStyle = watch('contentStyle');
  const isPTR = submissionType === 'ptr';

  const onSubmit = async (data: FormData) => {
    try {
      if (isEditMode) {
        await updateSubmission.mutateAsync({
          id: submissionId,
          ...data,
        });
        onSuccess?.(submissionId);
      } else {
        const result = await createSubmission.mutateAsync(data);
        onSuccess?.(result.id);
      }
    } catch (error) {
      console.error('Submission failed:', error);
      alert('Failed to save submission');
    }
  };

  const steps = [
    { id: 'type', title: 'Submission Type' },
    { id: 'style', title: 'Content Style' },
    { id: 'details', title: 'Content Details' },
    ...(isPTR ? [{ id: 'schedule', title: 'Release Schedule' }] : []),
    ...(isPTR || contentStyle === 'ppv' ? [{ id: 'pricing', title: 'Pricing' }] : []),
    { id: 'files', title: 'File Uploads' },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className={`
              flex items-center justify-center w-10 h-10 rounded-full border-2 font-semibold
              ${index <= currentStep
                ? 'border-brand-light-pink bg-brand-light-pink text-white'
                : 'border-gray-300 dark:border-gray-700 text-gray-400'
              }
            `}>
              {index + 1}
            </div>
            {index < steps.length - 1 && (
              <div className={`
                h-0.5 w-16 mx-2
                ${index < currentStep ? 'bg-brand-light-pink' : 'bg-gray-300 dark:bg-gray-700'}
              `} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {currentStep === 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Select Submission Type
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Choose between one-time post or pay-to-release content
          </p>
          <SubmissionTypeSelector
            value={submissionType}
            onChange={(value) => setValue('submissionType', value)}
          />
        </div>
      )}

      {currentStep === 1 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Select Content Style
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            What type of content are you submitting?
          </p>
          <ContentStyleSelector
            value={contentStyle}
            onChange={(value) => setValue('contentStyle', value)}
            submissionType={submissionType}
          />
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Content Details
          </h2>

          {/* Model Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Model/Influencer Name
            </label>
            <input
              {...register('modelName')}
              type="text"
              placeholder="Enter model name"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            />
            {errors.modelName && (
              <p className="text-sm text-red-500 mt-1">{errors.modelName.message}</p>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Priority
            </label>
            <select
              {...register('priority')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Caption
            </label>
            <textarea
              {...register('caption')}
              rows={4}
              placeholder="Enter your caption..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            />
          </div>

          {/* Drive Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Drive Link (Optional)
            </label>
            <input
              {...register('driveLink')}
              type="url"
              placeholder="https://drive.google.com/..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            />
          </div>

          {/* Platform */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Platform
            </label>
            <select
              {...register('platform')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            >
              <option value="onlyfans">OnlyFans</option>
              <option value="fansly">Fansly</option>
              <option value="instagram">Instagram</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Any additional notes or instructions..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            />
          </div>
        </div>
      )}

      {currentStep === 3 && isPTR && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Release Schedule
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Set when this content should be released
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Release Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Release Date *
              </label>
              <input
                {...register('releaseSchedule.releaseDate')}
                type="date"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
              />
            </div>

            {/* Release Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Release Time
              </label>
              <input
                {...register('releaseSchedule.releaseTime')}
                type="time"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
              />
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Timezone
            </label>
            <select
              {...register('releaseSchedule.timezone')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
            </select>
          </div>
        </div>
      )}

      {currentStep === (isPTR ? 4 : 3) && (isPTR || contentStyle === 'ppv') && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Pricing
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Set pricing for this content
          </p>

          {/* Minimum Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Minimum Price ($)
            </label>
            <input
              {...register('pricing.minimumPrice', { valueAsNumber: true })}
              type="number"
              step="0.01"
              placeholder="0.00"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            />
          </div>

          {/* Pricing Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pricing Type
            </label>
            <select
              {...register('pricing.pricingType')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            >
              <option value="fixed">Fixed Price</option>
              <option value="range">Price Range</option>
              <option value="negotiable">Negotiable</option>
            </select>
          </div>

          {/* Pricing Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pricing Notes (Optional)
            </label>
            <textarea
              {...register('pricing.pricingNotes')}
              rows={3}
              placeholder="Any pricing details or notes..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink"
            />
          </div>
        </div>
      )}

      {currentStep === steps.length - 1 && submissionId && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Upload Files
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Upload images, videos, or other files for this submission
          </p>
          <FileUploadZone submissionId={submissionId} />
        </div>
      )}

      {currentStep === steps.length - 1 && !submissionId && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Save the submission first to upload files
          </p>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          Cancel
        </button>

        <div className="flex space-x-3">
          {currentStep > 0 && (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep - 1)}
              className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Back
            </button>
          )}

          {currentStep < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep + 1)}
              className="px-6 py-2 bg-brand-light-pink hover:bg-brand-dark-pink text-white rounded-lg transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-brand-light-pink hover:bg-brand-dark-pink text-white rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isEditMode ? 'Update' : 'Submit'}</span>
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
