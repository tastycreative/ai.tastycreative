"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface GenerationProgress {
  isGenerating: boolean;
  progress: number;
  stage: string;
  message: string;
  generationType: 'text-to-image' | 'style-transfer' | 'image-to-video' | 'face-swap' | 'skin-enhancer' | null;
  jobId: string | null;
  elapsedTime?: number;
  estimatedTimeRemaining?: number;
}

interface GenerationContextType {
  globalProgress: GenerationProgress;
  updateGlobalProgress: (progress: Partial<GenerationProgress>) => void;
  clearGlobalProgress: () => void;
}

const GenerationContext = createContext<GenerationContextType | undefined>(undefined);

const initialProgress: GenerationProgress = {
  isGenerating: false,
  progress: 0,
  stage: '',
  message: '',
  generationType: null,
  jobId: null,
  elapsedTime: 0,
  estimatedTimeRemaining: 0,
};

export function GenerationProvider({ children }: { children: React.ReactNode }) {
  const [globalProgress, setGlobalProgress] = useState<GenerationProgress>(initialProgress);

  // Check for active generations on mount and periodically
  useEffect(() => {
    const checkActiveGenerations = () => {
      if (typeof window === 'undefined') return;

      // Check all possible generation types
      const generationTypes = [
        'text-to-image',
        'style-transfer',
        'image-to-video',
        'face-swap',
        'skin-enhancer'
      ];

      let foundActiveGeneration = false;

      for (const type of generationTypes) {
        const isGenerating = localStorage.getItem(`${type}-is-generating`) === 'true';
        const currentJob = localStorage.getItem(`${type}-current-job`);
        const progressData = localStorage.getItem(`${type}-progress-data`);

        if (isGenerating && currentJob) {
          try {
            const job = JSON.parse(currentJob);
            const progress = progressData ? JSON.parse(progressData) : {};

            // Only show if job is still pending or processing
            if (job.status === 'pending' || job.status === 'processing') {
              setGlobalProgress({
                isGenerating: true,
                progress: progress.progress || 0,
                stage: progress.stage || '',
                message: progress.message || `${type.replace('-', ' ')} in progress...`,
                generationType: type as any,
                jobId: job.id,
                elapsedTime: progress.elapsedTime,
                estimatedTimeRemaining: progress.estimatedTimeRemaining,
              });
              foundActiveGeneration = true;
              break; // Show only the first active generation found
            }
          } catch (error) {
            console.error(`Error parsing ${type} generation data:`, error);
          }
        }
      }

      if (!foundActiveGeneration && globalProgress.isGenerating) {
        // Clear if no active generations found
        setGlobalProgress(initialProgress);
      }
    };

    // Check immediately
    checkActiveGenerations();

    // Check every 2 seconds for changes
    const interval = setInterval(checkActiveGenerations, 2000);

    return () => clearInterval(interval);
  }, [globalProgress.isGenerating]);

  const updateGlobalProgress = useCallback((progress: Partial<GenerationProgress>) => {
    setGlobalProgress(prev => ({ ...prev, ...progress }));
  }, []);

  const clearGlobalProgress = useCallback(() => {
    setGlobalProgress(initialProgress);
  }, []);

  return (
    <GenerationContext.Provider value={{
      globalProgress,
      updateGlobalProgress,
      clearGlobalProgress,
    }}>
      {children}
    </GenerationContext.Provider>
  );
}

export function useGenerationProgress() {
  const context = useContext(GenerationContext);
  if (context === undefined) {
    throw new Error('useGenerationProgress must be used within a GenerationProvider');
  }
  return context;
}
