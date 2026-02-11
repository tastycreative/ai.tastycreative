'use client';

import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { createSubmissionWithComponentsSchema } from '@/lib/validations/content-submission';
import type {
  CreateSubmissionWithComponents,
  ComponentModule,
} from '@/lib/validations/content-submission';
import {
  useCreateSubmission,
  useUpdateSubmission,
} from '@/lib/hooks/useContentSubmission.query';
import { generateSteps, ensureValidStep } from '@/lib/content-submission/step-generator';
import { getRecommendations, isComponentForced } from '@/lib/content-submission/recommendations';
import { ProgressIndicator } from './ProgressIndicator';
import { AutoSaveIndicator } from './AutoSaveIndicator';
import { useAutoSave } from '@/lib/hooks/useAutoSave';
import { useKeyboardShortcut } from '@/lib/hooks/useKeyboardShortcut';
import { Loader2, Check, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';

// Lazy load heavy components
import dynamic from 'next/dynamic';

const SubmissionTypeSelector = dynamic(() =>
  import('./SubmissionTypeSelector').then((mod) => mod.SubmissionTypeSelector)
);
const ContentStyleSelector = dynamic(() =>
  import('./ContentStyleSelector').then((mod) => mod.ContentStyleSelector)
);
const PlatformSelector = dynamic(() =>
  import('./PlatformSelector').then((mod) => mod.PlatformSelector)
);
const ComponentSelector = dynamic(() =>
  import('./ComponentSelector').then((mod) => mod.ComponentSelector)
);
const ContentDetailsFields = dynamic(() =>
  import('./ContentDetailsFields').then((mod) => mod.ContentDetailsFields)
);
const FileUploadZone = dynamic(() =>
  import('./FileUploadZone').then((mod) => mod.FileUploadZone)
);

type FormData = CreateSubmissionWithComponents;

interface SubmissionFormProps {
  submissionId?: string;
  initialData?: Partial<FormData>;
  onSuccess?: (submissionId: string) => void;
  onCancel?: () => void;
}

export const SubmissionForm = memo(function SubmissionForm({
  submissionId,
  initialData,
  onSuccess,
  onCancel,
}: SubmissionFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const isEditMode = !!submissionId;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, dirtyFields },
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

  // Watch form values
  const submissionType = watch('submissionType');
  const contentStyle = watch('contentStyle');
  const platform = watch('platform');
  const selectedComponents = watch('selectedComponents') || [];
  const isPTR = submissionType === 'ptr';

  // Memoized computations
  const steps = useMemo(
    () => generateSteps(submissionType, contentStyle, selectedComponents),
    [submissionType, contentStyle, selectedComponents]
  );

  const recommendations = useMemo(
    () => getRecommendations(submissionType, contentStyle),
    [submissionType, contentStyle]
  );

  const forcedComponents = useMemo(
    () => recommendations.filter((comp) => isComponentForced(comp, submissionType)),
    [recommendations, submissionType]
  );

  // Auto-save functionality
  const formData = watch();
  const { isSaving, lastSaved, error: saveError } = useAutoSave({
    data: formData,
    onSave: async (data) => {
      // Simulate auto-save - replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log('Auto-saved:', data);
    },
    delay: 3000,
    enabled: isEditMode && Object.keys(dirtyFields).length > 0,
  });

  // Auto-apply recommendations
  useEffect(() => {
    const currentComponents = selectedComponents;
    const needsUpdate = recommendations.some(
      (rec) => !currentComponents.includes(rec)
    );

    if (needsUpdate && recommendations.length > 0) {
      const updated = Array.from(
        new Set([...currentComponents, ...recommendations])
      );
      setValue('selectedComponents', updated);
    }
  }, [recommendations, selectedComponents, setValue]);

  // Ensure valid step
  useEffect(() => {
    const validStep = ensureValidStep(currentStep, steps);
    if (validStep !== currentStep) {
      setCurrentStep(validStep);
    }
  }, [steps, currentStep]);

  // Keyboard navigation
  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, steps.length]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  useKeyboardShortcut(
    { key: 'ArrowRight', ctrl: true },
    handleNext,
    currentStep < steps.length - 1
  );

  useKeyboardShortcut(
    { key: 'ArrowLeft', ctrl: true },
    handlePrevious,
    currentStep > 0
  );

  const onSubmit = async (data: FormData) => {
    try {
      if (isEditMode) {
        await updateSubmission.mutateAsync({
          id: submissionId,
          ...data,
        });
      } else {
        const result = await createSubmission.mutateAsync(data);
        console.log('Submission created:', result);
      }

      // Show success animation
      setShowSuccess(true);

      // Navigate after celebration
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(submissionId || 'new');
        } else {
          setShowSuccess(false);
          setCurrentStep(0);
          reset();
        }
      }, 2000);
    } catch (error) {
      console.error('Submission failed:', error);
    }
  };

  const currentStepInfo = steps[currentStep];

  return (
    <div className="min-h-screen bg-[#0a0a0b] pb-16">
      {/* Success Celebration */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="relative bg-gradient-to-br from-zinc-900 to-zinc-800 border-2 border-green-500/50 rounded-2xl p-12 max-w-md text-center shadow-2xl"
            >
              {/* Confetti effect */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl">
                {[...Array(30)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      background: [
                        '#F774B9',
                        '#E1518E',
                        '#5DC3F8',
                        '#EC67A1',
                      ][i % 4],
                      left: `${Math.random() * 100}%`,
                      top: '-10%',
                    }}
                    animate={{
                      y: [0, 500],
                      x: [0, (Math.random() - 0.5) * 200],
                      rotate: [0, Math.random() * 360],
                      opacity: [1, 0],
                    }}
                    transition={{
                      duration: 2 + Math.random(),
                      delay: Math.random() * 0.5,
                      ease: 'easeOut',
                    }}
                  />
                ))}
              </div>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 200,
                  damping: 15,
                  delay: 0.2,
                }}
                className="relative"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 mb-4">
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                  >
                    <Check className="w-10 h-10 text-green-500" />
                  </motion.div>
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  Submission Created!
                </h2>
                <p className="text-zinc-400">
                  Your content has been successfully submitted for review.
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Auto-save Indicator */}
        {isEditMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-end mb-4"
          >
            <AutoSaveIndicator
              isSaving={isSaving}
              lastSaved={lastSaved}
              error={saveError}
            />
          </motion.div>
        )}

        {/* Progress Indicator */}
        <ProgressIndicator
          steps={steps}
          currentStep={currentStep}
          onStepClick={(index) => setCurrentStep(index)}
          allowStepNavigation={true}
        />

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Step Content with Animated Transitions */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepInfo?.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{
                type: 'spring',
                stiffness: 100,
                damping: 20,
              }}
              className="relative bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-8 sm:p-12 overflow-hidden mb-8"
            >
              {/* Decorative gradient */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-light-pink to-transparent opacity-60" />

              {/* Floating decorative elements */}
              <div className="absolute top-8 right-8 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl" />
              <div className="absolute bottom-8 left-8 w-40 h-40 bg-fuchsia-500/5 rounded-full blur-3xl" />

              <div className="relative">
                {/* Render step content based on currentStepInfo.id */}
                {currentStepInfo?.id === 'platform-type' && (
                  <StepContent title="Platform & Submission Type">
                    <div className="space-y-8">
                      <PlatformSelector
                        value={platform}
                        onChange={(value) => setValue('platform', value)}
                      />
                      <Divider />
                      <SubmissionTypeSelector
                        value={submissionType}
                        onChange={(value) => setValue('submissionType', value)}
                      />
                    </div>
                  </StepContent>
                )}

                {currentStepInfo?.id === 'style-components' && (
                  <StepContent title="Content Style & Components">
                    <div className="space-y-8">
                      <ContentStyleSelector
                        value={contentStyle}
                        onChange={(value) => setValue('contentStyle', value as any)}
                        submissionType={submissionType}
                      />
                      <Divider />
                      <ComponentSelector
                        selected={selectedComponents}
                        onChange={(components) =>
                          setValue('selectedComponents', components)
                        }
                        recommendations={recommendations}
                        disabled={forcedComponents}
                      />
                    </div>
                  </StepContent>
                )}

                {currentStepInfo?.id === 'details' && (
                  <StepContent title="Content Details">
                    <ContentDetailsFields
                      register={register}
                      setValue={setValue}
                      watch={watch}
                      errors={errors}
                    />
                  </StepContent>
                )}

                {/* Add other step renderings as needed */}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between">
            <motion.button
              type="button"
              onClick={onCancel}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-all duration-200"
            >
              Cancel
            </motion.button>

            <div className="flex items-center space-x-3">
              {currentStep > 0 && (
                <motion.button
                  type="button"
                  onClick={handlePrevious}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group inline-flex items-center gap-2 px-6 py-3 bg-zinc-800/50 border border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 rounded-xl transition-all duration-200"
                >
                  <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  <span>Back</span>
                </motion.button>
              )}

              {currentStep < steps.length - 1 ? (
                <motion.button
                  type="button"
                  onClick={handleNext}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-brand-light-pink to-brand-dark-pink text-white font-medium overflow-hidden shadow-lg shadow-brand-light-pink/20"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-brand-dark-pink to-brand-light-pink"
                    initial={{ x: '100%' }}
                    whileHover={{ x: 0 }}
                    transition={{ type: 'tween', duration: 0.3 }}
                  />
                  <span className="relative">Next</span>
                  <ChevronRight className="relative w-4 h-4 transition-transform group-hover:translate-x-1" />
                </motion.button>
              ) : (
                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
                  whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
                  className="group relative inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-brand-light-pink to-brand-dark-pink text-white font-medium overflow-hidden shadow-lg shadow-brand-light-pink/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting && (
                    <Loader2 className="relative w-4 h-4 animate-spin" />
                  )}
                  <span className="relative">
                    {isEditMode ? 'Update' : 'Submit'}
                  </span>
                  <Sparkles className="relative w-4 h-4" />
                </motion.button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
});

// Helper Components
const StepContent = memo(function StepContent({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="space-y-2">
        <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
});

const Divider = memo(function Divider() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-zinc-800/50"></div>
      </div>
      <div className="relative flex justify-center text-sm">
        <span className="px-4 bg-zinc-900/40 text-zinc-500">and</span>
      </div>
    </div>
  );
});
