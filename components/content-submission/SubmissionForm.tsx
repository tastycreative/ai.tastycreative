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
import { Loader2, Check, ChevronRight, ChevronLeft, Sparkles, AlertTriangle, Upload, X, Image as ImageIcon, Video as VideoIcon, File as FileIcon, FileText, Gamepad2, DollarSign, Link2, FolderOpen, Plus } from 'lucide-react';
import type { ContentStyleFields } from './ContentStyleSelector';
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

/** A resolved file entry from a Google Drive link */
interface DriveFileEntry {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  thumbnailLink: string | null;
}

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
  const [uploadMode, setUploadMode] = useState<'upload' | 'drive' | 'both'>('upload');
  const [driveFiles, setDriveFiles] = useState<DriveFileEntry[]>([]);
  const [selectedTemplateType, setSelectedTemplateType] = useState<'OTP_PTR' | 'WALL_POST' | 'SEXTING_SETS' | null>(null);
  const [selectedSpaces, setSelectedSpaces] = useState<Map<string, Space>>(new Map());
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined);
  const [contentStyle, setContentStyle] = useState<string>('normal');
  const [styleFields, setStyleFields] = useState<ContentStyleFields>({
    gameType: '',
    gifUrl: '',
    gameNotes: '',
    originalPollReference: '',
  });

  const handleStyleFieldsChange = useCallback((fields: Partial<ContentStyleFields>) => {
    setStyleFields((prev) => ({ ...prev, ...fields }));
  }, []);

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

  // Map contentStyle → postOrigin for the new unified field
  // 'normal'/'poll' keep the metadata's postOrigin (user-selected, default 'OTP')
  // Others map directly to their postOrigin equivalent
  const CONTENT_STYLE_TO_POST_ORIGIN: Record<string, string> = {
    game: 'GAME',
    ppv: 'PPV',
    bundle: 'PPV',
    vip: 'VIP',
  };

  const buildMetadata = useCallback((
    data: FormData,
    meta: Record<string, unknown>,
    extraFields?: Record<string, unknown>,
  ) => {
    // Derive postOrigin: contentStyle override takes priority, then metadata's postOrigin, then 'OTP'
    const derivedPostOrigin =
      CONTENT_STYLE_TO_POST_ORIGIN[contentStyle] ??
      (meta.postOrigin as string) ??
      'OTP';

    return {
      // Spread raw metadata first so explicit fields below take priority
      ...meta,
      submissionType: data.submissionType,
      contentStyle,        // Keep for backward compat
      postOrigin: derivedPostOrigin, // NEW: unified post origin field
      // Game-specific fields
      ...(contentStyle === 'game' ? {
        gameType: styleFields.gameType || undefined,
        gifUrl: styleFields.gifUrl || undefined,
        gameNotes: styleFields.gameNotes || undefined,
      } : {}),
      // PPV/Bundle-specific fields
      ...(contentStyle === 'ppv' || contentStyle === 'bundle' ? {
        originalPollReference: styleFields.originalPollReference || undefined,
      } : {}),
      pricingCategory: data.pricingCategory,
      pageType: (meta as Record<string, unknown>).pageType || 'ALL_PAGES',
      contentType: data.contentType,
      contentTypeOptionId: data.contentTypeOptionId,
      contentTags: data.contentTags,
      internalModelTags: data.internalModelTags,
      externalCreatorTags: data.externalCreatorTags,
      // Hoist top-level form fields into metadata so board items can access them
      modelId: data.modelId ?? null,
      platforms: data.platform ?? ['onlyfans'],
      // Wall post workflow: set initial status so it appears in Caption Workspace flow
      ...(data.submissionType === 'WALL_POST' ? { wallPostStatus: 'PENDING_CAPTION' } : {}),
      ...extraFields,
    };
  }, [contentStyle, styleFields]);

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);

    if (!hasTarget || spaceTargets.size === 0) {
      setSubmitError('No matching space/board found. Please select a space first.');
      return;
    }

    try {
      const meta = (data.metadata ?? {}) as Record<string, unknown>;

      // Title: use model name from metadata, fall back to template label
      const title =
        (meta.model as string)?.trim() ||
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
        metadata: buildMetadata(data, meta),
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
          metadata: buildMetadata(data, meta, {
            boardItemId: primaryItem.itemId,
            targetSpaces: createdItems.map((i) => ({ spaceId: i.spaceId, boardId: i.boardId, itemId: i.itemId })),
            submitStatus: 'SUBMITTED',
          }),
        });
        contentSubmissionId = submission?.id ?? null;
      } catch (err) {
        console.error('Content submission record creation failed:', err);
      }

      // 3. Upload files: presign + S3 upload in parallel, then record
      //    calls sequentially so the first triggers caption ticket creation
      //    and subsequent ones find the existing ticket (avoids duplicate tickets).
      if (pendingFiles.length > 0) {
        const totalFiles = pendingFiles.length;
        let completedFiles = 0;
        setFileUploadStep({ current: 0, total: totalFiles });

        const primaryMediaBase = `/api/spaces/${primaryItem.spaceId}/boards/${primaryItem.boardId}/items/${primaryItem.itemId}/media`;

        // Phase 1: Presign + S3 upload all files in parallel (fast)
        const s3Results = await Promise.allSettled(
          pendingFiles.map(async (file) => {
            const presignRes = await fetch(primaryMediaBase, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'presign', fileName: file.name, fileType: file.type }),
            });
            if (!presignRes.ok) throw new Error('Failed to get upload URL');
            const presigned = await presignRes.json();

            await fetch(presigned.uploadUrl, {
              method: 'PUT',
              body: file,
              headers: { 'Content-Type': file.type },
            });

            return presigned;
          })
        );

        // Phase 2: Record calls sequentially (first one creates caption ticket,
        // subsequent ones append to it via the existing captionTicketId in metadata)
        for (let i = 0; i < pendingFiles.length; i++) {
          const result = s3Results[i];
          if (result.status === 'rejected') {
            console.error('File upload failed:', pendingFiles[i].name, result.reason);
            completedFiles++;
            setFileUploadStep({ current: completedFiles, total: totalFiles });
            continue;
          }
          const presigned = result.value;
          const file = pendingFiles[i];

          try {
            // Create primary media record (triggers caption ticket sync)
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
            if (createdItems.length > 1) {
              await Promise.allSettled(
                createdItems.slice(1).map((item) =>
                  fetch(`/api/spaces/${item.spaceId}/boards/${item.boardId}/items/${item.itemId}/media`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'record',
                      url: presigned.fileUrl,
                      type: file.type,
                      name: file.name,
                      size: file.size,
                    }),
                  }).catch((linkErr) => {
                    console.error(`Media link failed for space ${item.spaceId}:`, file.name, linkErr);
                  })
                )
              );
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
          } catch (recordErr) {
            console.error('Record failed:', file.name, recordErr);
          }

          completedFiles++;
          setFileUploadStep({ current: completedFiles, total: totalFiles });
        }

        setFileUploadStep(null);
      }

      // 4. Google Drive files — save file IDs to DB and use Google Drive's
      //    direct serving URL. No S3 download, no proxy needed.
      //    Record calls are sequential so the first triggers caption ticket creation
      //    and subsequent ones append to the existing ticket.
      if (driveFiles.length > 0) {
        const primaryMediaBase = `/api/spaces/${primaryItem.spaceId}/boards/${primaryItem.boardId}/items/${primaryItem.itemId}/media`;

        for (let i = 0; i < driveFiles.length; i++) {
          const df = driveFiles[i];
          try {
            // Store as standard Drive URL so all Drive-aware components can extract the file ID
            const mediaUrl = `https://drive.google.com/file/d/${df.id}/view`;

            // Create primary media record (sequential to avoid duplicate caption tickets)
            await fetch(primaryMediaBase, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'record',
                url: mediaUrl,
                type: df.mimeType,
                name: df.name,
                size: df.size,
              }),
            });

            // Link to additional spaces
            if (createdItems.length > 1) {
              await Promise.allSettled(
                createdItems.slice(1).map((item) =>
                  fetch(`/api/spaces/${item.spaceId}/boards/${item.boardId}/items/${item.itemId}/media`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'record',
                      url: mediaUrl,
                      type: df.mimeType,
                      name: df.name,
                      size: df.size,
                    }),
                  }).catch((linkErr) => {
                    console.error(`Drive media link failed for space ${item.spaceId}:`, df.name, linkErr);
                  })
                )
              );
            }

            // Dual-write to content_submission_files
            if (contentSubmissionId) {
              const fileCategory = df.mimeType.startsWith('image/')
                ? 'image'
                : df.mimeType.startsWith('video/')
                  ? 'video'
                  : 'other';

              try {
                await fetch(`/api/content-submissions/${contentSubmissionId}/files`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    awsS3Key: `gdrive:${df.id}`,
                    awsS3Url: mediaUrl,
                    fileName: df.name,
                    fileSize: df.size,
                    fileType: df.mimeType,
                    fileCategory,
                    order: pendingFiles.length + i,
                  }),
                });
              } catch (dualWriteErr) {
                console.error('Dual-write content_submission_files (drive) failed:', df.name, dualWriteErr);
              }
            }
          } catch (recordErr) {
            console.error('Drive file record failed:', df.name, recordErr);
          }
        }
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

        <form
          onSubmit={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            // Prevent Enter key from triggering any implicit form submission
            if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
              e.preventDefault();
            }
          }}
        >
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
                    styleFields={styleFields}
                    onStyleFieldsChange={handleStyleFieldsChange}
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

                  {/* File Uploads section */}
                  <div className="mt-8 pt-8 border-t border-zinc-700/50">
                    <div className="mb-5">
                      <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        <Upload className="w-4 h-4 text-brand-light-pink" />
                        Attachments
                      </h3>
                      <p className="text-sm text-zinc-400 mt-1">Upload reference images or paste a Google Drive link</p>
                    </div>
                    <FileUploadStep
                      mode={uploadMode}
                      onModeChange={setUploadMode}
                      files={pendingFiles}
                      onFilesChange={setPendingFiles}
                      driveFiles={driveFiles}
                      onDriveFilesChange={setDriveFiles}
                      submissionType={submissionType}
                    />
                  </div>
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
                    driveFilesCount={driveFiles.length}
                    contentStyle={contentStyle}
                    styleFields={styleFields}
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
                  type="button"
                  onClick={handleSubmit(onSubmit)}
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
            {dragActive ? 'Drop files here' : 'Drop files here or click to browse'}
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            Max {maxFiles} files, {maxFileSizeMB}MB each
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

// ─── Upload Mode Selector + File Upload Step ────────────────────────────────

type UploadMode = 'upload' | 'drive' | 'both';

const UPLOAD_MODES: { value: UploadMode; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'upload',
    label: 'Upload Files',
    description: 'Drag & drop or browse',
    icon: <Upload className="w-4 h-4" />,
  },
  {
    value: 'drive',
    label: 'Google Drive Link',
    description: 'Paste a shared link',
    icon: <Link2 className="w-4 h-4" />,
  },
  {
    value: 'both',
    label: 'Both',
    description: 'Upload + Drive link',
    icon: <Plus className="w-4 h-4" />,
  },
];

const FileUploadStep = memo(function FileUploadStep({
  mode,
  onModeChange,
  files,
  onFilesChange,
  driveFiles,
  onDriveFilesChange,
  submissionType,
}: {
  mode: UploadMode;
  onModeChange: (m: UploadMode) => void;
  files: File[];
  onFilesChange: (f: File[]) => void;
  driveFiles: DriveFileEntry[];
  onDriveFilesChange: (f: DriveFileEntry[]) => void;
  submissionType?: string;
}) {
  // OTP/PTR: skip mode selector, show only the file picker
  if (submissionType === 'OTP_PTR') {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-zinc-300 mb-2">Reference Images (screenshots from OF vault)</p>
          <LocalFilePicker files={files} onChange={onFilesChange} />
          <p className="text-xs text-zinc-600 mt-1.5">
            Upload screenshots from OnlyFans vault for team reference
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mode selector */}
      <div className="grid gap-3 grid-cols-3">
        {UPLOAD_MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onModeChange(m.value)}
            className={[
              'relative flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-center transition-all duration-200',
              mode === m.value
                ? 'border-brand-light-pink bg-brand-light-pink/5 shadow-sm shadow-brand-light-pink/10'
                : 'border-zinc-700/60 bg-zinc-900/40 hover:border-zinc-600 hover:bg-zinc-800/40',
            ].join(' ')}
          >
            <div
              className={[
                'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
                mode === m.value
                  ? 'bg-brand-light-pink/15 text-brand-light-pink'
                  : 'bg-zinc-800/60 text-zinc-500',
              ].join(' ')}
            >
              {m.icon}
            </div>
            <div>
              <p className={`text-sm font-semibold ${mode === m.value ? 'text-white' : 'text-zinc-300'}`}>
                {m.label}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{m.description}</p>
            </div>
            {mode === m.value && (
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-light-pink" />
            )}
          </button>
        ))}
      </div>

      {/* Upload Files section */}
      {(mode === 'upload' || mode === 'both') && (
        <div>
          <p className="text-sm font-medium text-zinc-300 mb-2">Reference Images (screenshots from OF vault)</p>
          <LocalFilePicker files={files} onChange={onFilesChange} />
          <p className="text-xs text-zinc-600 mt-1.5">
            Upload screenshots from OnlyFans vault for team reference
          </p>
        </div>
      )}

      {/* Google Drive Link section */}
      {(mode === 'drive' || mode === 'both') && (
        <GoogleDriveLinkInput driveFiles={driveFiles} onChange={onDriveFilesChange} />
      )}
    </div>
  );
});

// ─── Google Drive Link Input ─────────────────────────────────────────────────

const GoogleDriveLinkInput = memo(function GoogleDriveLinkInput({
  driveFiles,
  onChange,
}: {
  driveFiles: DriveFileEntry[];
  onChange: (files: DriveFileEntry[]) => void;
}) {
  const [driveUrl, setDriveUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Check for Google Drive access token in URL (after OAuth callback) or localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('access_token');
    if (token) {
      setAccessToken(token);
      localStorage.setItem('googleDriveAccessToken', token);
      // Clean URL params
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      const saved = localStorage.getItem('googleDriveAccessToken');
      if (saved) setAccessToken(saved);
    }
  }, []);

  const connectGoogleDrive = useCallback(async () => {
    try {
      const currentPath = window.location.pathname + window.location.search;
      const res = await fetch(`/api/auth/google?redirect=${encodeURIComponent(currentPath)}`);
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch {
      setError('Failed to connect to Google Drive');
    }
  }, []);

  const disconnectGoogleDrive = useCallback(() => {
    setAccessToken(null);
    localStorage.removeItem('googleDriveAccessToken');
  }, []);

  const resolveLink = useCallback(async () => {
    const trimmed = driveUrl.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const body: Record<string, string> = { url: trimmed };
      if (accessToken) body.accessToken = accessToken;

      const res = await fetch('/api/google-drive/fetch-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle expired/invalid token
        if (data.authError) {
          setAccessToken(null);
          localStorage.removeItem('googleDriveAccessToken');
        }
        setError(data.error || 'Failed to fetch Google Drive contents');
        return;
      }

      if (!data.files || data.files.length === 0) {
        setError('No files found at this link. Make sure the folder contains files.');
        return;
      }

      onChange(data.files);
      setResolved(true);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }, [driveUrl, onChange, accessToken]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        resolveLink();
      }
    },
    [resolveLink],
  );

  const clearAll = useCallback(() => {
    onChange([]);
    setDriveUrl('');
    setResolved(false);
    setError(null);
  }, [onChange]);

  const removeFile = useCallback(
    (id: string) => {
      onChange(driveFiles.filter((f) => f.id !== id));
    },
    [driveFiles, onChange],
  );

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="space-y-4">
      {/* Link input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">Google Drive Link</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
              <Link2 className="w-4 h-4" />
            </div>
            <input
              type="url"
              value={driveUrl}
              onChange={(e) => {
                setDriveUrl(e.target.value);
                if (resolved) {
                  setResolved(false);
                  onChange([]);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="https://drive.google.com/drive/folders/... or .../file/d/..."
              disabled={loading}
              className="w-full rounded-xl bg-zinc-900/60 border border-zinc-700/60 pl-10 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-brand-light-pink/60 focus:outline-none transition-colors disabled:opacity-50"
            />
          </div>
          <button
            type="button"
            onClick={resolveLink}
            disabled={loading || !driveUrl.trim()}
            className="px-5 py-3 rounded-xl bg-brand-light-pink/10 border border-brand-light-pink/30 text-brand-light-pink text-sm font-medium hover:bg-brand-light-pink/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FolderOpen className="w-4 h-4" />
            )}
            {loading ? 'Loading...' : 'Fetch'}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-zinc-600">
            {accessToken
              ? 'Connected to Google Drive — paste any link you have access to.'
              : 'Paste a Google Drive link. Connect your Google account to access private files.'}
          </p>
          {accessToken ? (
            <button
              type="button"
              onClick={disconnectGoogleDrive}
              className="text-[11px] text-zinc-500 hover:text-red-400 transition-colors whitespace-nowrap ml-2"
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={connectGoogleDrive}
              className="text-[11px] text-brand-blue hover:text-brand-light-pink transition-colors whitespace-nowrap ml-2 font-medium"
            >
              Connect Google Drive
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Resolved file list */}
      {driveFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
              {driveFiles.length} file{driveFiles.length !== 1 ? 's' : ''} from Google Drive
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {driveFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 px-4 py-3 bg-zinc-900/60 border border-zinc-800/60 rounded-xl group"
              >
                {/* Thumbnail or icon */}
                {file.thumbnailLink ? (
                  <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                    <img
                      src={file.thumbnailLink}
                      alt=""
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-400">
                    {file.mimeType.startsWith('image/') ? (
                      <ImageIcon className="w-4 h-4" />
                    ) : file.mimeType.startsWith('video/') ? (
                      <VideoIcon className="w-4 h-4" />
                    ) : (
                      <FileIcon className="w-4 h-4" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{file.name}</p>
                  <p className="text-xs text-zinc-600">
                    {file.mimeType.split('/')[1]?.toUpperCase() || file.mimeType}
                    {file.size ? ` · ${formatSize(file.size)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-brand-light-pink hover:bg-brand-light-pink/10 transition-all opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Review Step ─────────────────────────────────────────────────────────────

const ReviewStep = memo(function ReviewStep({
  selectedSpaces,
  submissionType,
  watch,
  hasTarget,
  assigneeId,
  spaceId,
  pendingFilesCount,
  driveFilesCount = 0,
  contentStyle,
  styleFields,
}: {
  selectedSpaces: Space[];
  submissionType: string;
  watch: UseFormWatch<FormData>;
  hasTarget: boolean;
  assigneeId?: string;
  spaceId?: string;
  pendingFilesCount: number;
  driveFilesCount?: number;
  contentStyle: string;
  styleFields: ContentStyleFields;
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

  // Destructure watched fields once to avoid repeated watch() calls
  const priority = watch('priority');
  const contentTags = watch('contentTags') || [];
  const internalModelTags = watch('internalModelTags') || [];
  const contentType = watch('contentType');
  const pricingCategory = watch('pricingCategory');
  const metadata = watch('metadata') || {};

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

  const entries = Object.entries(metadata).filter(
    ([key, v]) =>
      key !== 'submitStatus' &&
      key !== 'boardItemId' &&
      key !== 'contentStyle' &&
      key !== 'postOrigin' &&
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
              {TEMPLATE_LABELS[submissionType] ?? submissionType}
            </p>
          </div>
          {priority && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Priority</p>
              <p className="text-white font-medium capitalize">{priority}</p>
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
          {(pendingFilesCount > 0 || (driveFilesCount ?? 0) > 0) && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Files</p>
              <div className="flex items-center gap-1.5 text-white font-medium text-sm">
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                {pendingFilesCount > 0 && (
                  <span>{pendingFilesCount} uploaded</span>
                )}
                {pendingFilesCount > 0 && (driveFilesCount ?? 0) > 0 && (
                  <span className="text-zinc-500">+</span>
                )}
                {(driveFilesCount ?? 0) > 0 && (
                  <span>{driveFilesCount} from Drive</span>
                )}
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
              <p className="text-xs text-zinc-500 mb-1">Post Origin</p>
              <p className="text-white font-medium">
                {(() => {
                  const STYLE_TO_ORIGIN: Record<string, string> = { game: 'GAME', ppv: 'PPV', bundle: 'PPV', vip: 'VIP' };
                  return (STYLE_TO_ORIGIN[contentStyle] ?? (metadata as Record<string, unknown>)?.postOrigin ?? 'OTP') as string;
                })()}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Content Style</p>
              <p className="text-white font-medium capitalize">{contentStyle}</p>
            </div>
            {/* Game-specific review fields */}
            {contentStyle === 'game' && (styleFields.gameType || styleFields.gifUrl || styleFields.gameNotes) && (
              <div className="col-span-2 bg-orange-500/5 border border-orange-500/20 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <Gamepad2 className="w-3.5 h-3.5 text-orange-400" />
                  <p className="text-xs font-medium text-orange-400">Game Post Details</p>
                </div>
                {styleFields.gameType && (
                  <div>
                    <p className="text-xs text-zinc-500">Game Type</p>
                    <p className="text-white text-sm">{styleFields.gameType}</p>
                  </div>
                )}
                {styleFields.gifUrl && (
                  <div>
                    <p className="text-xs text-zinc-500">GIF URL</p>
                    <p className="text-brand-blue text-sm truncate">{styleFields.gifUrl}</p>
                  </div>
                )}
                {styleFields.gameNotes && (
                  <div>
                    <p className="text-xs text-zinc-500">Notes</p>
                    <p className="text-white text-sm">{styleFields.gameNotes}</p>
                  </div>
                )}
              </div>
            )}
            {/* PPV/Bundle-specific review fields */}
            {(contentStyle === 'ppv' || contentStyle === 'bundle') && styleFields.originalPollReference && (
              <div className="col-span-2 bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <DollarSign className="w-3.5 h-3.5 text-purple-400" />
                  <p className="text-xs font-medium text-purple-400">PPV/Bundle Details</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Original Poll Reference</p>
                  <p className="text-white text-sm">{styleFields.originalPollReference}</p>
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-zinc-500 mb-1">Pricing Tier</p>
              <p className="text-white font-medium">
                {({'PORN_ACCURATE':'Porn Accurate','PORN_SCAM':'Porn Scam','GF_ACCURATE':'GF Accurate','GF_SCAM':'GF Scam'} as Record<string,string>)[pricingCategory || ''] || pricingCategory || 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Page Type</p>
              <p className="text-white font-medium">
                {({'ALL_PAGES':'All Pages','FREE':'Free','PAID':'Paid','VIP':'VIP'} as Record<string,string>)[(metadata as Record<string,any>)?.pageType || ''] || 'All Pages'}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Content Type</p>
              <p className="text-white font-medium">{contentType || 'Not selected'}</p>
            </div>
            {/* Content Tags */}
            <div className="col-span-2">
              <p className="text-xs text-zinc-500 mb-2">Content Tags</p>
              {contentTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {contentTags.map((tag: string) => (
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
                {internalModelTags.length > 0
                  ? internalModelTags.join(', ')
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
            {TEMPLATE_LABELS[submissionType]} Details
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
