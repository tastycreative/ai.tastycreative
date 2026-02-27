'use client';

import { useState, useRef, useMemo, useEffect, useCallback, memo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createSubmissionWithComponentsSchema } from '@/lib/validations/content-submission';
import type { CreateSubmissionWithComponents } from '@/lib/validations/content-submission';
import { useCreateBoardItem } from '@/lib/hooks/useBoardItems.query';
import { useMultiSpaceBoards } from '@/lib/hooks/useBoards.query';
import { useCreateSubmission } from '@/lib/hooks/useContentSubmission.query';
import type { Space } from '@/lib/hooks/useSpaces.query';
import { getMetadataDefaults } from '@/lib/spaces/template-metadata';
import { generateSteps, ensureValidStep } from '@/lib/content-submission/step-generator';
import { ProgressIndicator } from './ProgressIndicator';
import { useKeyboardShortcut } from '@/lib/hooks/useKeyboardShortcut';
import { Loader2, Check, ChevronRight, ChevronLeft, Sparkles, AlertTriangle, Upload, X, Image as ImageIcon, Video as VideoIcon, File as FileIcon, FileText } from 'lucide-react';
import { useSpaceMembers } from '@/lib/hooks/useSpaceMembers.query';
import { useQuery } from '@tanstack/react-query';
import type { UseFormWatch } from 'react-hook-form';

// Lazy load heavy components
import dynamic from 'next/dynamic';

const ContentDetailsFields = dynamic(() =>
  import('./ContentDetailsFields').then((mod) => mod.ContentDetailsFields)
);

const SpacePicker = dynamic(() =>
  import('./SpacePicker').then((mod) => mod.SpacePicker)
);

const ContentStyleSelector = dynamic(() =>
  import('./ContentStyleSelector').then((mod) => mod.ContentStyleSelector)
);

const TEMPLATE_LABELS: Record<string, string> = {
  OTP_PTR: 'OTP / PTR',
  WALL_POST: 'Wall Post',
  SEXTING_SETS: 'Sexting Sets',
};

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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileUploadStep, setFileUploadStep] = useState<{ current: number; total: number } | null>(null);
  const [selectedTemplateType, setSelectedTemplateType] = useState<'OTP_PTR' | 'WALL_POST' | 'SEXTING_SETS' | null>(null);
  const [selectedSpaces, setSelectedSpaces] = useState<Map<string, Space>>(new Map());
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined);
  const [contentStyle, setContentStyle] = useState<string>('normal');

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
      submissionType: 'OTP_PTR',
      priority: 'normal',
      selectedComponents: [],
      contentTags: [],
      internalModelTags: [],
      contentType: undefined,
      contentLength: '',
      contentCount: '',
      externalCreatorTags: '',
      metadata: {},
    },
  });

  const submissionType = watch('submissionType') as 'OTP_PTR' | 'WALL_POST' | 'SEXTING_SETS';

  const steps = useMemo(() => generateSteps(submissionType), [submissionType]);

  // Derived multi-space helpers
  const selectedSpaceIds = useMemo(() => new Set(selectedSpaces.keys()), [selectedSpaces]);
  const selectedSpacesArray = useMemo(() => Array.from(selectedSpaces.values()), [selectedSpaces]);
  const primarySpace = selectedSpacesArray[0] ?? null;

  // Derive boards for all selected spaces
  const boardQueries = useMultiSpaceBoards(selectedSpacesArray.map((s) => s.id));
  const boardsLoading = boardQueries.some((q) => q.isLoading);

  const spaceTargets = useMemo(() => {
    const targets = new Map<string, { boardId: string; columnId: string }>();
    selectedSpacesArray.forEach((space, idx) => {
      const board = boardQueries[idx]?.data?.boards?.[0];
      const column = board?.columns?.[0];
      if (board && column) targets.set(space.id, { boardId: board.id, columnId: column.id });
    });
    return targets;
  }, [selectedSpacesArray, boardQueries]);

  const hasTarget = spaceTargets.size > 0;
  const targetLoading = selectedSpaces.size > 0 && boardsLoading;

  // For the primary space, use the hook-based createItem (for cache invalidation)
  const primaryTarget = primarySpace ? spaceTargets.get(primarySpace.id) : undefined;
  const createItem = useCreateBoardItem(primarySpace?.id ?? '', primaryTarget?.boardId ?? '');
  const createSubmission = useCreateSubmission();

  const handleTemplateTypeChange = useCallback(
    (type: 'OTP_PTR' | 'WALL_POST' | 'SEXTING_SETS') => {
      setSelectedTemplateType(type);
      setSelectedSpaces(new Map());
      setValue('submissionType', type);
      const defaults = getMetadataDefaults(type as any);
      setValue('metadata', defaults);
    },
    [setValue]
  );

  const handleToggleSpace = useCallback(
    (space: Space) => {
      setSelectedSpaces((prev) => {
        const next = new Map(prev);
        if (next.has(space.id)) {
          next.delete(space.id);
        } else {
          next.set(space.id, space);
        }
        return next;
      });
    },
    []
  );

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
      setSubmitError(null);
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, steps.length]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setSubmitError(null);
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

  const PRIORITY_MAP: Record<string, string> = {
    low: 'LOW',
    normal: 'MEDIUM',
    high: 'HIGH',
    urgent: 'URGENT',
  };

  const TYPE_MAP: Record<string, string> = {
    OTP_PTR: 'REQUEST',
    WALL_POST: 'POST',
    SEXTING_SETS: 'SET',
  };

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);

    if (!hasTarget || spaceTargets.size === 0) {
      setSubmitError('No matching space/board found. Please select a space first.');
      return;
    }

    try {
      const meta = (data.metadata ?? {}) as Record<string, unknown>;

      // Title: use model/buyer from metadata, fall back to template label
      const title =
        (meta.model as string)?.trim() ||
        (meta.buyer as string)?.trim() ||
        TEMPLATE_LABELS[data.submissionType] ||
        data.submissionType;

      // Due date: pull from template metadata date fields
      const rawDue =
        (meta.scheduledDate as string) ||
        (meta.deadline as string) ||
        null;

      const itemPayload = {
        title,
        type: TYPE_MAP[data.submissionType] ?? 'TASK',
        priority: PRIORITY_MAP[data.priority ?? 'normal'] ?? 'MEDIUM',
        dueDate: rawDue ? new Date(rawDue).toISOString() : undefined,
        assigneeId: assigneeId || undefined,
        metadata: {
          submissionType: data.submissionType,
          contentStyle,
          pricingCategory: data.pricingCategory,
          pageType: (meta as Record<string, unknown>).pageType || 'ALL_PAGES',
          contentType: data.contentType,
          contentTypeOptionId: data.contentTypeOptionId,
          contentTags: data.contentTags,
          internalModelTags: data.internalModelTags,
          externalCreatorTags: data.externalCreatorTags,
          ...meta,
        },
      };

      // 1. Create BoardItem in EACH selected space
      const createdItems: { spaceId: string; boardId: string; itemId: string }[] = [];

      for (const [sId, target] of spaceTargets.entries()) {
        try {
          // Use hook-based mutation for primary space (cache invalidation)
          if (sId === primarySpace?.id) {
            const result = await createItem.mutateAsync({
              ...itemPayload,
              columnId: target.columnId,
            });
            createdItems.push({ spaceId: sId, boardId: target.boardId, itemId: result.id });
          } else {
            // Direct fetch for additional spaces
            const res = await fetch(`/api/spaces/${sId}/boards/${target.boardId}/items`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...itemPayload, columnId: target.columnId }),
            });
            if (!res.ok) throw new Error(`Failed to create item in space ${sId}`);
            const result = await res.json();
            createdItems.push({ spaceId: sId, boardId: target.boardId, itemId: result.id });
          }
        } catch (err) {
          console.error(`Board item creation failed for space ${sId}:`, err);
        }
      }

      if (createdItems.length === 0) {
        setSubmitError('Failed to create board items in any space.');
        return;
      }

      const primaryItem = createdItems[0];

      // 2. Create content_submission record linked to the primary space
      let contentSubmissionId: string | null = null;
      try {
        const submission = await createSubmission.mutateAsync({
          ...data,
          workspaceId: primaryItem.spaceId,
          metadata: {
            ...meta,
            contentStyle,
            boardItemId: primaryItem.itemId,
            targetSpaces: createdItems.map((i) => ({ spaceId: i.spaceId, boardId: i.boardId, itemId: i.itemId })),
            submitStatus: 'SUBMITTED',
          },
        });
        contentSubmissionId = submission?.id ?? null;
      } catch (err) {
        console.error('Content submission record creation failed:', err);
      }

      // 3. Upload files once, create media records in ALL board items
      if (pendingFiles.length > 0) {
        for (let i = 0; i < pendingFiles.length; i++) {
          const file = pendingFiles[i];
          setFileUploadStep({ current: i + 1, total: pendingFiles.length });
          try {
            // Presign via the primary item
            const primaryMediaBase = `/api/spaces/${primaryItem.spaceId}/boards/${primaryItem.boardId}/items/${primaryItem.itemId}/media`;
            const presignRes = await fetch(primaryMediaBase, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'presign', fileName: file.name, fileType: file.type }),
            });
            if (!presignRes.ok) throw new Error('Failed to get upload URL');
            const presigned = await presignRes.json();

            // Upload directly to S3 (once)
            await fetch(presigned.uploadUrl, {
              method: 'PUT',
              body: file,
              headers: { 'Content-Type': file.type },
            });

            // Create media record in primary item
            await fetch(primaryMediaBase, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'record',
                url: presigned.fileUrl,
                type: file.type,
                name: file.name,
                size: file.size,
              }),
            });

            // Create media records in additional items (link same S3 URL)
            for (let j = 1; j < createdItems.length; j++) {
              const item = createdItems[j];
              try {
                await fetch(`/api/spaces/${item.spaceId}/boards/${item.boardId}/items/${item.itemId}/media`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'record',
                    url: presigned.fileUrl,
                    type: file.type,
                    name: file.name,
                    size: file.size,
                  }),
                });
              } catch (linkErr) {
                console.error(`Media link failed for space ${item.spaceId}:`, file.name, linkErr);
              }
            }

            // Dual-write to content_submission_files
            if (contentSubmissionId) {
              const fileCategory = file.type.startsWith('image/')
                ? 'image'
                : file.type.startsWith('video/')
                  ? 'video'
                  : file.type.startsWith('application/pdf') || file.type.startsWith('text/')
                    ? 'document'
                    : 'other';

              try {
                await fetch(`/api/content-submissions/${contentSubmissionId}/files`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    awsS3Key: presigned.s3Key,
                    awsS3Url: presigned.fileUrl,
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                    fileCategory,
                    order: i,
                  }),
                });
              } catch (dualWriteErr) {
                console.error('Dual-write to content_submission_files failed:', file.name, dualWriteErr);
              }
            }
          } catch (err) {
            console.error('File upload failed:', file.name, err);
          }
        }
        setFileUploadStep(null);
      }

      setShowSuccess(true);

      setTimeout(() => {
        if (onSuccess) {
          onSuccess(primaryItem.itemId);
        } else {
          setShowSuccess(false);
          setCurrentStep(0);
          setSelectedTemplateType(null);
          setSelectedSpaces(new Map());
          reset();
        }
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Submission failed. Please try again.';
      setSubmitError(message);
      console.error('Submission failed:', error);
    }
  };

  const currentStepInfo = steps[currentStep];

  return (
    <div className="min-h-screen bg-[#0a0a0b] pb-16">
      {/* Success Celebration — lightweight CSS-only */}
      {showSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in">
            <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-800 border-2 border-green-500/50 rounded-2xl p-12 max-w-md text-center shadow-2xl animate-scale-in">
              {/* CSS confetti — 10 lightweight particles */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                {[...Array(10)].map((_, i) => (
                  <span
                    key={i}
                    className="submission-confetti"
                    style={{
                      '--confetti-color': ['#F774B9', '#E1518E', '#5DC3F8', '#EC67A1'][i % 4],
                      '--confetti-x': `${(Math.random() - 0.5) * 160}px`,
                      '--confetti-delay': `${Math.random() * 0.4}s`,
                      left: `${10 + Math.random() * 80}%`,
                    } as React.CSSProperties}
                  />
                ))}
              </div>

              <div className="relative animate-scale-in" style={{ animationDelay: '0.15s' }}>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 mb-4">
                  <Check className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  Submission Created!
                </h2>
                <p className="text-zinc-400">
                  Your content has been successfully submitted for review.
                </p>
              </div>
            </div>
          </div>
        )}

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Progress Indicator */}
        <ProgressIndicator
          steps={steps}
          currentStep={currentStep}
          onStepClick={(index) => setCurrentStep(index)}
          allowStepNavigation={true}
        />

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Step Content — CSS transitions instead of spring physics */}
          <div
            key={currentStepInfo?.id}
            className="relative z-10 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-8 sm:p-12 mb-8 animate-step-in"
          >
            {/* Decorative gradient */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-light-pink to-transparent opacity-60 rounded-t-2xl" />

            <div className="relative">
              {/* Select Space Step */}
              {currentStepInfo?.id === 'space' && (
                <StepContent title="Type & Spaces" subtitle="Choose submission type and select target spaces">
                  <SpacePicker
                    selectedTemplateType={selectedTemplateType}
                    onTemplateTypeChange={handleTemplateTypeChange}
                    selectedSpaceIds={selectedSpaceIds}
                    onToggleSpace={handleToggleSpace}
                  />
                </StepContent>
              )}

              {/* Content Style Step */}
              {currentStepInfo?.id === 'contentStyle' && (
                <StepContent title="Select Content Style" subtitle="Choose the format for your content">
                  <ContentStyleSelector
                    value={contentStyle}
                    onChange={setContentStyle}
                    submissionType={submissionType === 'OTP_PTR' ? 'otp' : 'ptr'}
                  />
                </StepContent>
              )}

              {/* Content Details Step */}
              {currentStepInfo?.id === 'details' && (
                <StepContent title="Content Details">
                  <ContentDetailsFields
                    register={register}
                    setValue={setValue}
                    watch={watch}
                    errors={errors}
                    readOnlyType={selectedTemplateType ?? undefined}
                    spaceId={primarySpace?.id}
                    assigneeId={assigneeId}
                    onAssigneeChange={setAssigneeId}
                  />
                </StepContent>
              )}

              {/* File Upload Step */}
              {currentStepInfo?.id === 'files' && (
                <StepContent title="Upload Files" subtitle="Add images or videos — they'll be attached when you submit">
                  <LocalFilePicker files={pendingFiles} onChange={setPendingFiles} />
                </StepContent>
              )}

              {/* Review & Submit Step */}
              {currentStepInfo?.id === 'review' && (
                <StepContent title="Review & Submit" subtitle="Review your submission details before finalizing">
                  <ReviewStep
                    selectedSpaces={selectedSpacesArray}
                    submissionType={submissionType}
                    watch={watch}
                    hasTarget={hasTarget}
                    assigneeId={assigneeId}
                    spaceId={primarySpace?.id}
                    pendingFilesCount={pendingFiles.length}
                    contentStyle={contentStyle}
                  />
                </StepContent>
              )}
            </div>
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="mb-4 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-300">{submitError}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-colors duration-150"
            >
              Cancel
            </button>

            <div className="flex items-center space-x-3">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="group inline-flex items-center gap-2 px-6 py-3 bg-zinc-800/50 border border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 rounded-xl transition-all duration-150 active:scale-[0.97]"
                >
                  <ChevronLeft className="w-4 h-4 transition-transform duration-150 group-hover:-translate-x-1" />
                  <span>Back</span>
                </button>
              )}

              {currentStep < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={currentStepInfo?.id === 'space' && selectedSpaces.size === 0}
                  className="group relative inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-brand-light-pink to-brand-dark-pink text-white font-medium overflow-hidden shadow-lg shadow-brand-light-pink/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 hover:shadow-xl hover:shadow-brand-light-pink/30 active:scale-[0.97]"
                >
                  <span className="relative">Next</span>
                  <ChevronRight className="relative w-4 h-4 transition-transform duration-150 group-hover:translate-x-1" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting || targetLoading || !hasTarget}
                  className="group relative inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-brand-light-pink to-brand-dark-pink text-white font-medium overflow-hidden shadow-lg shadow-brand-light-pink/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 hover:shadow-xl hover:shadow-brand-light-pink/30 active:scale-[0.97]"
                >
                  {(isSubmitting || targetLoading) && (
                    <Loader2 className="relative w-4 h-4 animate-spin" />
                  )}
                  <span className="relative">
                    {fileUploadStep
                      ? `Uploading ${fileUploadStep.current}/${fileUploadStep.total}...`
                      : 'Submit'}
                  </span>
                  {!fileUploadStep && <Sparkles className="relative w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
});

// ─── Local File Picker ────────────────────────────────────────────────────────

const LocalFilePicker = memo(function LocalFilePicker({
  files,
  onChange,
  maxFiles = 10,
  maxFileSizeMB = 100,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxFileSizeMB?: number;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (incoming: File[]) => {
      const maxBytes = maxFileSizeMB * 1024 * 1024;
      const valid = incoming.filter((f) => f.size <= maxBytes);
      if (valid.length < incoming.length) {
        setSizeError(`${incoming.length - valid.length} file(s) exceeded the ${maxFileSizeMB} MB limit and were skipped.`);
        setTimeout(() => setSizeError(null), 4000);
      }
      onChange([...files, ...valid].slice(0, maxFiles));
    },
    [files, onChange, maxFiles, maxFileSizeMB],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles],
  );

  const removeFile = (index: number) => onChange(files.filter((_, i) => i !== index));

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const getIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
    if (type.startsWith('video/')) return <VideoIcon className="w-4 h-4" />;
    return <FileIcon className="w-4 h-4" />;
  };

  const isFull = files.length >= maxFiles;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onDrop={handleDrop}
        onClick={() => !isFull && inputRef.current?.click()}
        style={dragActive ? { borderColor: '#F774B9', background: 'rgba(247,116,185,0.06)' } : undefined}
        className={`relative flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-2xl p-10 transition-all duration-200 cursor-pointer ${
          isFull
            ? 'opacity-40 pointer-events-none border-zinc-800'
            : 'border-zinc-700/60 hover:border-zinc-500 hover:bg-zinc-800/20'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
        />
        <div
          style={dragActive ? { background: 'rgba(247,116,185,0.15)', borderColor: 'rgba(247,116,185,0.4)' } : undefined}
          className="w-14 h-14 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center transition-all duration-200"
        >
          <Upload className={`w-6 h-6 transition-colors ${dragActive ? 'text-brand-light-pink' : 'text-zinc-500'}`} />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-300">
            {dragActive ? 'Drop files here' : 'Drop files or click to browse'}
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            Images & videos · Max {maxFileSizeMB} MB each · {files.length}/{maxFiles} files
          </p>
        </div>
      </div>

      {/* Size error */}
      {sizeError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {sizeError}
        </div>
      )}

      {/* Queued file list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest px-1">
            {files.length} file{files.length !== 1 ? 's' : ''} queued
          </p>
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 px-4 py-3 bg-zinc-900/60 border border-zinc-800/60 rounded-xl group"
            >
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-400">
                {getIcon(file.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{file.name}</p>
                <p className="text-xs text-zinc-600">{formatSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-brand-light-pink hover:bg-brand-light-pink/10 transition-all opacity-0 group-hover:opacity-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── Review Step ─────────────────────────────────────────────────────────────

const TEMPLATE_LABELS_REVIEW: Record<string, string> = {
  OTP_PTR: 'OTP / PTR',
  WALL_POST: 'Wall Post',
  SEXTING_SETS: 'Sexting Sets',
};

const ReviewStep = memo(function ReviewStep({
  selectedSpaces,
  submissionType,
  watch,
  hasTarget,
  assigneeId,
  spaceId,
  pendingFilesCount,
  contentStyle,
}: {
  selectedSpaces: Space[];
  submissionType: string;
  watch: UseFormWatch<FormData>;
  hasTarget: boolean;
  assigneeId?: string;
  spaceId?: string;
  pendingFilesCount: number;
  contentStyle: string;
}) {
  const { data: spaceMembers } = useSpaceMembers(spaceId);
  const { data: orgMembers } = useQuery({
    queryKey: ['org-members-assignee'],
    queryFn: async () => {
      const res = await fetch('/api/organization/members');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });

  const assignee = useMemo(() => {
    if (!assigneeId) return null;
    // Try space members first
    const spaceMember = spaceMembers?.find((m) => m.userId === assigneeId);
    if (spaceMember) {
      return { name: spaceMember.user.firstName ? `${spaceMember.user.firstName} ${spaceMember.user.lastName || ''}`.trim() : spaceMember.user.email, email: spaceMember.user.email, initial: (spaceMember.user.firstName?.[0] || spaceMember.user.email[0]).toUpperCase() };
    }
    // Fallback to org members
    const orgMember = orgMembers?.find((m: { id: string }) => m.id === assigneeId);
    if (orgMember) {
      return { name: orgMember.firstName ? `${orgMember.firstName} ${orgMember.lastName || ''}`.trim() : orgMember.email, email: orgMember.email, initial: (orgMember.firstName?.[0] || orgMember.email[0]).toUpperCase() };
    }
    return null;
  }, [assigneeId, spaceMembers, orgMembers]);

  const meta = watch('metadata') || {};
  const entries = Object.entries(meta).filter(
    ([key, v]) =>
      key !== 'submitStatus' &&
      key !== 'boardItemId' &&
      key !== 'contentStyle' &&
      key !== 'pageType' &&
      key !== 'contentType' &&
      v !== '' &&
      v !== null &&
      v !== undefined &&
      !(Array.isArray(v) && v.length === 0)
  );

  return (
    <div className="space-y-4">
      <div className="bg-zinc-800/30 rounded-xl p-6 border border-zinc-700/30">
        <h3 className="text-sm font-medium text-zinc-400 mb-3">Submission Overview</h3>
        <div className="grid grid-cols-2 gap-4">
          {selectedSpaces.length > 0 && (
            <div className="col-span-2">
              <p className="text-xs text-zinc-500 mb-2">Spaces ({selectedSpaces.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedSpaces.map((s) => (
                  <span
                    key={s.id}
                    className="px-2.5 py-1 bg-brand-light-pink/10 border border-brand-light-pink/20 text-brand-light-pink rounded-lg text-xs font-medium"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs text-zinc-500 mb-1">Submission Type</p>
            <p className="text-white font-medium">
              {TEMPLATE_LABELS_REVIEW[submissionType] ?? submissionType}
            </p>
          </div>
          {watch('priority') && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Priority</p>
              <p className="text-white font-medium capitalize">{watch('priority')}</p>
            </div>
          )}
          {assignee && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Assigned To</p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-light-pink/20 border border-brand-light-pink/30 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-brand-light-pink">
                    {assignee.initial}
                  </span>
                </div>
                <p className="text-white font-medium text-sm">
                  {assignee.name}
                </p>
              </div>
            </div>
          )}
          {pendingFilesCount > 0 && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Files</p>
              <div className="flex items-center gap-1.5 text-white font-medium text-sm">
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                {pendingFilesCount} file{pendingFilesCount !== 1 ? 's' : ''} attached
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Configuration for OTP/PTR */}
      {submissionType === 'OTP_PTR' && (
        <div className="bg-zinc-800/30 rounded-xl p-6 border border-zinc-700/30">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Content Configuration</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Content Style</p>
              <p className="text-white font-medium capitalize">{contentStyle}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Pricing Tier</p>
              <p className="text-white font-medium">
                {({'PORN_ACCURATE':'Porn Accurate','PORN_SCAM':'Porn Scam','GF_ACCURATE':'GF Accurate','GF_SCAM':'GF Scam'} as Record<string,string>)[watch('pricingCategory') || ''] || watch('pricingCategory') || 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Page Type</p>
              <p className="text-white font-medium">
                {({'ALL_PAGES':'All Pages','FREE':'Free','PAID':'Paid','VIP':'VIP'} as Record<string,string>)[(watch('metadata') as Record<string,any>)?.pageType || ''] || 'All Pages'}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Content Type</p>
              <p className="text-white font-medium">{watch('contentType') || 'Not selected'}</p>
            </div>
            {/* Content Tags */}
            <div className="col-span-2">
              <p className="text-xs text-zinc-500 mb-2">Content Tags</p>
              {(watch('contentTags') || []).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {(watch('contentTags') || []).map((tag: string) => (
                    <span key={tag} className="px-2 py-0.5 bg-brand-light-pink/10 border border-brand-light-pink/20 text-brand-light-pink rounded-md text-xs font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-white font-medium text-sm">None</p>
              )}
            </div>
            {/* Internal Models */}
            <div className="col-span-2">
              <p className="text-xs text-zinc-500 mb-1">Internal Models</p>
              <p className="text-white font-medium text-sm">
                {(watch('internalModelTags') || []).length > 0
                  ? (watch('internalModelTags') || []).join(', ')
                  : 'None'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Template metadata summary */}
      {entries.length > 0 && (
        <div className="bg-zinc-800/30 rounded-xl p-6 border border-zinc-700/30">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">
            {TEMPLATE_LABELS_REVIEW[submissionType]} Details
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {entries.map(([key, val]) => (
              <div key={key}>
                <p className="text-xs text-zinc-500 mb-0.5 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p className="text-white text-sm truncate">
                  {Array.isArray(val) ? val.join(', ') : String(val)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasTarget ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-amber-200 font-medium mb-1">No spaces selected</p>
            <p className="text-sm text-amber-200/70">
              Go back to Step 1 and select at least one space before submitting.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-brand-light-pink/10 to-brand-dark-pink/10 border border-brand-light-pink/20 rounded-xl p-6">
          <p className="text-white font-medium mb-1">Ready to submit?</p>
          <p className="text-sm text-zinc-400">
            Click Submit below to create board items in{' '}
            {selectedSpaces.length === 1 ? (
              <span className="text-brand-light-pink">{selectedSpaces[0].name}</span>
            ) : (
              <span className="text-brand-light-pink">{selectedSpaces.length} spaces</span>
            )}
            .
          </p>
        </div>
      )}
    </div>
  );
});

// Helper Components
const StepContent = memo(function StepContent({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="space-y-2">
        <h2 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-lg text-zinc-400 font-light">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
});
