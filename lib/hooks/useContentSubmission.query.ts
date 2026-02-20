'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateSubmissionWithComponents,
  UpdateSubmissionInput,
  FileUploadInput,
} from '../validations/content-submission';

// ─── Types ──────────────────────────────────────────────────────────

interface SubmissionResponse {
  success: boolean;
  submission: any;
}

interface FilesResponse {
  success: boolean;
  files: any[];
}

interface PresignedUrlResponse {
  success: boolean;
  uploadUrl: string;
  fileUrl: string;
  s3Key: string;
  expiresIn: number;
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Strip incomplete nested objects that would fail server-side validation */
function cleanPayload(data: Record<string, any>): Record<string, any> {
  const cleaned = { ...data };

  // Strip releaseSchedule if releaseDate is missing
  if (cleaned.releaseSchedule && !cleaned.releaseSchedule.releaseDate) {
    delete cleaned.releaseSchedule;
  }

  // Strip pricing if no price values are set
  if (cleaned.pricing) {
    const p = cleaned.pricing;
    const hasValues = p.minimumPrice || p.suggestedPrice || p.finalPrice ||
      p.priceRangeMin || p.priceRangeMax;
    if (!hasValues) {
      delete cleaned.pricing;
    }
  }

  return cleaned;
}

// ─── Create Submission ──────────────────────────────────────────────

async function createSubmission(data: CreateSubmissionWithComponents) {
  const payload = cleanPayload(data);
  const response = await fetch('/api/content-submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create submission');
  }

  const result: SubmissionResponse = await response.json();
  return result.submission;
}

export function useCreateSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSubmission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contentSubmissions'] });
    },
  });
}

// ─── Update Submission ──────────────────────────────────────────────

async function updateSubmission({ id, ...data }: UpdateSubmissionInput & Record<string, any>) {
  const payload = cleanPayload(data);
  const response = await fetch(`/api/content-submissions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update submission');
  }

  const result: SubmissionResponse = await response.json();
  return result.submission;
}

export function useUpdateSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSubmission,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contentSubmissions'] });
      queryClient.invalidateQueries({ queryKey: ['contentSubmission', variables.id] });
    },
  });
}

// ─── File Upload ────────────────────────────────────────────────────

async function getPresignedUrl(
  submissionId: string,
  fileName: string,
  fileType: string,
  fileSize: number
): Promise<PresignedUrlResponse> {
  const response = await fetch(`/api/content-submissions/${submissionId}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, fileType, fileSize }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to get upload URL');
  }

  return response.json();
}

async function createFileRecord(
  submissionId: string,
  fileData: Omit<FileUploadInput, 'submissionId'>
) {
  const response = await fetch(`/api/content-submissions/${submissionId}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fileData),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create file record');
  }

  const result = await response.json();
  return result.file;
}

function getFileCategory(fileType: string): 'image' | 'video' | 'document' | 'other' {
  if (fileType.startsWith('image/')) return 'image';
  if (fileType.startsWith('video/')) return 'video';
  if (fileType.includes('pdf') || fileType.includes('document')) return 'document';
  return 'other';
}

export function useFileUpload() {
  const queryClient = useQueryClient();

  const uploadFile = async (
    file: File,
    submissionId: string,
    options?: { onProgress?: (progress: number) => void }
  ) => {
    // Step 1: Get presigned URL
    options?.onProgress?.(5);
    const presigned = await getPresignedUrl(
      submissionId,
      file.name,
      file.type,
      file.size
    );
    options?.onProgress?.(15);

    // Step 2: Upload to S3 using presigned URL
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presigned.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && options?.onProgress) {
          // Map upload progress to 15-85% range
          const pct = 15 + (e.loaded / e.total) * 70;
          options.onProgress(Math.round(pct));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`S3 upload failed with status ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('S3 upload failed'));
      xhr.send(file);
    });

    options?.onProgress?.(90);

    // Step 3: Create file record in database
    const fileRecord = await createFileRecord(submissionId, {
      awsS3Key: presigned.s3Key,
      awsS3Url: presigned.fileUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      fileCategory: getFileCategory(file.type),
      order: 0,
    });

    options?.onProgress?.(100);

    // Invalidate files query
    queryClient.invalidateQueries({
      queryKey: ['submissionFiles', submissionId],
    });

    return fileRecord;
  };

  return { uploadFile, isUploading: false };
}

// ─── List Files ─────────────────────────────────────────────────────

async function fetchSubmissionFiles(submissionId: string) {
  const response = await fetch(`/api/content-submissions/${submissionId}/files`);
  if (!response.ok) {
    throw new Error('Failed to fetch submission files');
  }
  const data: FilesResponse = await response.json();
  return data.files;
}

export function useSubmissionFiles(submissionId: string) {
  return useQuery({
    queryKey: ['submissionFiles', submissionId],
    queryFn: () => fetchSubmissionFiles(submissionId),
    enabled: !!submissionId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

// ─── Delete File ────────────────────────────────────────────────────

async function deleteFile({
  id,
  submissionId,
}: {
  id: string;
  submissionId: string;
}) {
  const response = await fetch(
    `/api/content-submissions/${submissionId}/files/${id}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete file');
  }

  return response.json();
}

export function useDeleteFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFile,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['submissionFiles', variables.submissionId],
      });
    },
  });
}
