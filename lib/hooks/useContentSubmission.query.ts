'use client';

/**
 * DESIGN-ONLY MODE: Content Submission Hooks
 *
 * Pure design/UI hooks with no backend dependencies.
 * All data is logged to console for demonstration purposes.
 */

import { useState } from 'react';
import type { CreateSubmissionWithComponents } from '../validations/content-submission';

/**
 * Create new submission (DESIGN ONLY)
 * Returns mock mutation with async handler
 */
export function useCreateSubmission() {
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = async (data: CreateSubmissionWithComponents) => {
    setIsPending(true);
    console.log('📝 [DESIGN MODE] Content Submission Created:', data);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    setIsPending(false);

    // Return mock success response
    return {
      id: `mock-${Date.now()}`,
      ...data,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
    };
  };

  return {
    mutateAsync,
    isPending,
  };
}

/**
 * Update existing submission (DESIGN ONLY)
 */
export function useUpdateSubmission() {
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = async ({ id, ...data }: any) => {
    setIsPending(true);
    console.log('✏️ [DESIGN MODE] Content Submission Updated:', { id, ...data });

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    setIsPending(false);

    return {
      id,
      ...data,
      updatedAt: new Date().toISOString(),
    };
  };

  return {
    mutateAsync,
    isPending,
  };
}

/**
 * File upload hook (DESIGN ONLY - returns mock)
 */
export function useFileUpload() {
  const uploadFile = async (
    file: File,
    submissionId: string,
    options?: { onProgress?: (progress: number) => void }
  ) => {
    console.log('📁 [DESIGN MODE] File Upload:', { fileName: file.name, submissionId });

    // Simulate upload progress
    if (options?.onProgress) {
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        options.onProgress(i);
      }
    }

    return {
      id: `mock-file-${Date.now()}`,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    };
  };

  return {
    uploadFile,
    isUploading: false,
  };
}

/**
 * List files for submission (DESIGN ONLY - returns empty)
 */
export function useSubmissionFiles(submissionId: string) {
  return {
    data: [] as any[],
    isLoading: false,
    error: null,
    refetch: async () => ({ data: [] }),
  };
}

/**
 * Delete file (DESIGN ONLY)
 */
export function useDeleteFile() {
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = async (data: { id: string }) => {
    setIsPending(true);
    console.log('🗑️ [DESIGN MODE] File Deleted:', data.id);

    await new Promise(resolve => setTimeout(resolve, 300));

    setIsPending(false);

    return { success: true };
  };

  return {
    mutateAsync,
    isPending,
  };
}
