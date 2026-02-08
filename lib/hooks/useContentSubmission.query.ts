'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { trpc } from '../trpc-client';
import type {
  CreateSubmissionInput,
  UpdateSubmissionInput,
  ListSubmissionsInput,
} from '../validations/content-submission';

/**
 * List submissions with optional filters
 */
export function useContentSubmissions(input?: ListSubmissionsInput) {
  const { user } = useUser();

  return trpc.contentSubmission.list.useQuery(input || {}, {
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get single submission by ID
 */
export function useContentSubmission(id: string) {
  const { user } = useUser();

  return trpc.contentSubmission.getById.useQuery(
    { id },
    {
      enabled: !!user && !!id,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 5,
    }
  );
}

/**
 * Create new submission
 */
export function useCreateSubmission() {
  const queryClient = useQueryClient();

  return trpc.contentSubmission.create.useMutation({
    onSuccess: () => {
      // Invalidate submission list
      queryClient.invalidateQueries({ queryKey: ['contentSubmission', 'list'] });
    },
  });
}

/**
 * Update existing submission
 */
export function useUpdateSubmission() {
  const queryClient = useQueryClient();

  return trpc.contentSubmission.update.useMutation({
    onSuccess: (data) => {
      // Invalidate submission list
      queryClient.invalidateQueries({ queryKey: ['contentSubmission', 'list'] });
      // Update single submission cache
      queryClient.invalidateQueries({ queryKey: ['contentSubmission', 'getById', { id: data.id }] });
    },
  });
}

/**
 * Delete submission
 */
export function useDeleteSubmission() {
  const queryClient = useQueryClient();

  return trpc.contentSubmission.delete.useMutation({
    onSuccess: () => {
      // Invalidate submission list
      queryClient.invalidateQueries({ queryKey: ['contentSubmission', 'list'] });
    },
  });
}

/**
 * Get presigned URL for file upload
 */
export function useGetPresignedUrl() {
  return trpc.submissionFiles.getPresignedUrl.useMutation();
}

/**
 * Record uploaded file
 */
export function useRecordFileUpload() {
  const queryClient = useQueryClient();

  return trpc.submissionFiles.recordUpload.useMutation({
    onSuccess: (data) => {
      // Invalidate file list for this submission
      queryClient.invalidateQueries({
        queryKey: ['submissionFiles', 'list', { submissionId: data.submissionId }],
      });
    },
  });
}

/**
 * List files for a submission
 */
export function useSubmissionFiles(submissionId: string) {
  const { user } = useUser();

  return trpc.submissionFiles.list.useQuery(
    { submissionId },
    {
      enabled: !!user && !!submissionId,
      staleTime: 1000 * 60 * 2,
    }
  );
}

/**
 * Delete file
 */
export function useDeleteFile() {
  const queryClient = useQueryClient();

  return trpc.submissionFiles.delete.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissionFiles', 'list'] });
    },
  });
}

/**
 * Update file order
 */
export function useUpdateFileOrder() {
  const queryClient = useQueryClient();

  return trpc.submissionFiles.updateOrder.useMutation({
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['submissionFiles', 'list', { submissionId: variables.submissionId }],
      });
    },
  });
}

/**
 * Complete file upload flow (presigned URL + upload + record)
 */
export function useFileUpload() {
  const getPresignedUrl = useGetPresignedUrl();
  const recordUpload = useRecordFileUpload();

  const uploadFile = async (
    file: File,
    submissionId: string,
    options?: {
      onProgress?: (progress: number) => void;
    }
  ) => {
    try {
      // Step 1: Get presigned URL
      const presignedData = await getPresignedUrl.mutateAsync({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        submissionId,
      });

      // Step 2: Upload to S3
      const xhr = new XMLHttpRequest();

      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && options?.onProgress) {
            const progress = (e.loaded / e.total) * 100;
            options.onProgress(progress);
          }
        });

        xhr.addEventListener('load', async () => {
          if (xhr.status === 200) {
            // Step 3: Record file metadata
            try {
              // Determine file category
              let fileCategory: 'image' | 'video' | 'document' | 'other' = 'other';
              if (file.type.startsWith('image/')) fileCategory = 'image';
              else if (file.type.startsWith('video/')) fileCategory = 'video';
              else if (file.type.includes('pdf') || file.type.includes('document')) fileCategory = 'document';

              const fileRecord = await recordUpload.mutateAsync({
                submissionId,
                awsS3Key: presignedData.s3Key,
                awsS3Url: presignedData.fileUrl,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                fileCategory,
              });

              resolve(fileRecord);
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('PUT', presignedData.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  };

  return {
    uploadFile,
    isUploading: getPresignedUrl.isPending || recordUpload.isPending,
  };
}
