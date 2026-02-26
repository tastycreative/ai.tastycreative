'use client';

import { useState, useRef, useMemo, useEffect, useCallback, memo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createSubmissionWithComponentsSchema } from '@/lib/validations/content-submission';
import type { CreateSubmissionWithComponents } from '@/lib/validations/content-submission';
import { useCreateBoardItem } from '@/lib/hooks/useBoardItems.query';
import { useBoards } from '@/lib/hooks/useBoards.query';
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
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined);

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

  const steps = useMemo(() => generateSteps(), []);

  const submissionType = watch('submissionType') as 'OTP_PTR' | 'WALL_POST' | 'SEXTING_SETS';

  // Derive board/column from selected space
  const { data: boardsData, isLoading: boardsLoading } = useBoards(selectedSpace?.id);
  const board = boardsData?.boards?.[0];
  const column = board?.columns?.[0];

  const spaceId = selectedSpace?.id;
  const boardId = board?.id;
  const columnId = column?.id;
  const hasTarget = !!(spaceId && boardId && columnId);
  const targetLoading = !!spaceId && boardsLoading;

  const createItem = useCreateBoardItem(spaceId ?? '', boardId ?? '');
  const createSubmission = useCreateSubmission();

  const TEMPLATE_TO_SUBMISSION: Record<string, 'OTP_PTR' | 'WALL_POST' | 'SEXTING_SETS'> = {
    OTP_PTR: 'OTP_PTR',
    WALL_POST: 'WALL_POST',
    SEXTING_SETS: 'SEXTING_SETS',
  };

  const handleSpaceSelect = useCallback(
    (space: Space) => {
      setSelectedSpace(space);
      const mappedType = TEMPLATE_TO_SUBMISSION[space.templateType];
      if (mappedType) {
        setValue('submissionType', mappedType);
        const defaults = getMetadataDefaults(space.templateType as any);
        setValue('metadata', defaults);
      }
    },
    [setValue]
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

    if (!hasTarget || !columnId || !spaceId) {
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

      // 1. Create BoardItem in the selected space
      const result = await createItem.mutateAsync({
        title,
        columnId,
        type: TYPE_MAP[data.submissionType] ?? 'TASK',
        priority: PRIORITY_MAP[data.priority ?? 'normal'] ?? 'MEDIUM',
        dueDate: rawDue ? new Date(rawDue).toISOString() : undefined,
        assigneeId: assigneeId || undefined,
        metadata: {
          submissionType: data.submissionType,
          ...meta,
        },
      });

      // 2. Create content_submission record linked to the space
      try {
        await createSubmission.mutateAsync({
          ...data,
          workspaceId: spaceId,
          metadata: {
            ...meta,
            boardItemId: result.id,
            submitStatus: 'SUBMITTED',
          },
        });
      } catch (err) {
        console.error('Content submission record creation failed:', err);
        // Board item was created successfully — don't block the flow
      }

      // 3. Upload any pending files to the board item's media
      if (pendingFiles.length > 0 && boardId) {
        const mediaBase = `/api/spaces/${spaceId}/boards/${boardId}/items/${result.id}/media`;
        for (let i = 0; i < pendingFiles.length; i++) {
          const file = pendingFiles[i];
          setFileUploadStep({ current: i + 1, total: pendingFiles.length });
          try {
            // Get presigned URL
            const presignRes = await fetch(mediaBase, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'presign', fileName: file.name, fileType: file.type }),
            });
            if (!presignRes.ok) throw new Error('Failed to get upload URL');
            const presigned = await presignRes.json();

            // Upload directly to S3
            await fetch(presigned.uploadUrl, {
              method: 'PUT',
              body: file,
              headers: { 'Content-Type': file.type },
            });

            // Create media record
            await fetch(mediaBase, {
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
          } catch (err) {
            console.error('File upload failed:', file.name, err);
          }
        }
        setFileUploadStep(null);
      }

      setShowSuccess(true);

      setTimeout(() => {
        if (onSuccess) {
          onSuccess(result.id);
        } else {
          setShowSuccess(false);
          setCurrentStep(0);
          setSelectedSpace(null);
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
            className="relative bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-8 sm:p-12 mb-8 animate-step-in"
          >
            {/* Decorative gradient */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-light-pink to-transparent opacity-60 rounded-t-2xl" />

            <div className="relative">
              {/* Select Space Step */}
              {currentStepInfo?.id === 'space' && (
                <StepContent title="Select Space" subtitle="Choose which space this submission belongs to">
                  <SpacePicker
                    selectedSpaceId={selectedSpace?.id}
                    onSelect={handleSpaceSelect}
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
                    readOnlyType={selectedSpace ? (TEMPLATE_TO_SUBMISSION[selectedSpace.templateType] as any) : undefined}
                    spaceId={selectedSpace?.id}
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
                    selectedSpace={selectedSpace}
                    submissionType={submissionType}
                    watch={watch}
                    hasTarget={hasTarget}
                    assigneeId={assigneeId}
                    spaceId={selectedSpace?.id}
                    pendingFilesCount={pendingFiles.length}
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
                  disabled={currentStepInfo?.id === 'space' && !selectedSpace}
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
  selectedSpace,
  submissionType,
  watch,
  hasTarget,
  assigneeId,
  spaceId,
  pendingFilesCount,
}: {
  selectedSpace: Space | null;
  submissionType: string;
  watch: UseFormWatch<FormData>;
  hasTarget: boolean;
  assigneeId?: string;
  spaceId?: string;
  pendingFilesCount: number;
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
          {selectedSpace && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Space</p>
              <p className="text-white font-medium">{selectedSpace.name}</p>
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
            <p className="text-amber-200 font-medium mb-1">No space selected</p>
            <p className="text-sm text-amber-200/70">
              Go back to Step 1 and select a space before submitting.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-brand-light-pink/10 to-brand-dark-pink/10 border border-brand-light-pink/20 rounded-xl p-6">
          <p className="text-white font-medium mb-1">Ready to submit?</p>
          <p className="text-sm text-zinc-400">
            Click Submit below to add this to your{' '}
            <span className="text-brand-light-pink">{selectedSpace?.name}</span> board.
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
