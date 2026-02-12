"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface GenerationJob {
  jobId: string;
  generationType: 'text-to-image' | 'image-to-image' | 'style-transfer' | 'image-to-video' | 'face-swap' | 'skin-enhancer' | 'text-to-video' | 'kling-text-to-video' | 'kling-image-to-video' | 'kling-multi-image-to-video' | 'kling-motion-control';
  progress: number;
  stage: string;
  message: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  elapsedTime?: number;
  estimatedTimeRemaining?: number;
  error?: string;
  metadata?: {
    prompt?: string;
    resolution?: string;
    aspectRatio?: string;
    profileName?: string;
    numReferenceImages?: number;
  };
  results?: any; // Store generated images/videos when job completes
}

interface GenerationProgress {
  isGenerating: boolean;
  progress: number;
  stage: string;
  message: string;
  generationType: 'text-to-image' | 'image-to-image' | 'style-transfer' | 'image-to-video' | 'face-swap' | 'skin-enhancer' | 'text-to-video' | 'kling-text-to-video' | 'kling-image-to-video' | 'kling-multi-image-to-video' | 'kling-motion-control' | null;
  jobId: string | null;
  elapsedTime?: number;
  estimatedTimeRemaining?: number;
}

interface GenerationContextType {
  globalProgress: GenerationProgress;
  activeJobs: GenerationJob[];
  updateGlobalProgress: (progress: Partial<GenerationProgress>) => void;
  clearGlobalProgress: () => void;
  addJob: (job: GenerationJob) => void;
  updateJob: (jobId: string, updates: Partial<GenerationJob>) => void;
  removeJob: (jobId: string) => void;
  clearCompletedJobs: () => void;
  clearCompletedJobsForType: (generationType: GenerationJob['generationType']) => Promise<void>;
  hasActiveGenerationForType: (generationType: GenerationJob['generationType']) => boolean;
  getLastCompletedJobForType: (generationType: GenerationJob['generationType']) => GenerationJob | null;
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
  const [activeJobs, setActiveJobs] = useState<GenerationJob[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate activeJobs from database on mount
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await fetch('/api/active-generations');
        if (response.ok) {
          const data = await response.json();
          if (data.jobs && Array.isArray(data.jobs)) {
            // Convert database format to local format
            const jobs: GenerationJob[] = data.jobs.map((job: any) => ({
              jobId: job.jobId,
              generationType: job.generationType.toLowerCase().replace(/_/g, '-') as GenerationJob['generationType'],
              progress: job.progress,
              stage: job.stage,
              message: job.message,
              status: job.status.toLowerCase() as GenerationJob['status'],
              startedAt: new Date(job.startedAt).getTime(),
              completedAt: job.completedAt ? new Date(job.completedAt).getTime() : undefined,
              elapsedTime: job.elapsedTime,
              estimatedTimeRemaining: job.estimatedTimeRemaining,
              metadata: job.metadata,
              results: job.results,
              error: job.error,
            }));
            
            // Check for stale jobs (pending/processing for more than 10 minutes)
            const now = Date.now();
            const staleThreshold = 10 * 60 * 1000; // 10 minutes
            
            const updatedJobs = jobs.map(job => {
              if ((job.status === 'pending' || job.status === 'processing')) {
                const age = now - job.startedAt;
                if (age > staleThreshold) {
                  // Mark as failed due to timeout/stale state
                  return {
                    ...job,
                    status: 'failed' as const,
                    message: 'Generation timed out or was interrupted',
                    error: 'Job exceeded maximum processing time or was interrupted by page refresh',
                    completedAt: now,
                  };
                }
              }
              return job;
            });
            
            setActiveJobs(updatedJobs);
          }
        }
      } catch (error) {
        console.error('Failed to fetch active generations:', error);
      } finally {
        setIsHydrated(true);
      }
    };

    fetchJobs();
  }, []);

  // Debounced save to database
  useEffect(() => {
    if (!isHydrated) return;

    // Debounce to avoid excessive API calls
    const timeoutId = setTimeout(async () => {
      // Save each job that has been modified
      for (const job of activeJobs) {
        try {
          await fetch('/api/active-generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobId: job.jobId,
              generationType: job.generationType.toUpperCase().replace(/-/g, '_'),
              progress: job.progress,
              stage: job.stage,
              message: job.message,
              status: job.status.toUpperCase(),
              startedAt: job.startedAt,
              completedAt: job.completedAt,
              elapsedTime: job.elapsedTime,
              estimatedTimeRemaining: job.estimatedTimeRemaining,
              metadata: job.metadata,
              results: job.results,
              error: job.error,
            }),
          });
        } catch (error) {
          console.error('Failed to save generation job:', job.jobId, error);
        }
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [activeJobs, isHydrated]);

  // Update elapsed time for active jobs every second
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveJobs(prev => {
        const now = Date.now();
        return prev.map(job => {
          if (job.status === 'processing' || job.status === 'pending') {
            const elapsedTime = Math.floor((now - job.startedAt) / 1000);
            return { ...job, elapsedTime };
          }
          // For completed/failed jobs without elapsedTime, calculate it from timestamps
          if ((job.status === 'completed' || job.status === 'failed') && !job.elapsedTime && job.completedAt) {
            const elapsedTime = Math.floor((job.completedAt - job.startedAt) / 1000);
            return { ...job, elapsedTime };
          }
          return job;
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Keep globalProgress in sync with the most recent active job
  useEffect(() => {
    const processingJob = activeJobs.find(job => job.status === 'processing');
    const pendingJob = activeJobs.find(job => job.status === 'pending');
    const mostRecentJob = processingJob || pendingJob;

    if (mostRecentJob) {
      setGlobalProgress({
        isGenerating: true,
        progress: mostRecentJob.progress,
        stage: mostRecentJob.stage,
        message: mostRecentJob.message,
        generationType: mostRecentJob.generationType,
        jobId: mostRecentJob.jobId,
        elapsedTime: mostRecentJob.elapsedTime,
        estimatedTimeRemaining: mostRecentJob.estimatedTimeRemaining,
      });
    } else {
      setGlobalProgress(initialProgress);
    }
  }, [activeJobs]);

  const updateGlobalProgress = useCallback((progress: Partial<GenerationProgress>) => {
    setGlobalProgress(prev => ({ ...prev, ...progress }));
    
    // Also update the corresponding job if it exists
    if (progress.jobId) {
      setActiveJobs(prev => {
        const existingJobIndex = prev.findIndex(job => job.jobId === progress.jobId);
        if (existingJobIndex !== -1) {
          const updatedJobs = [...prev];
          const currentJob = updatedJobs[existingJobIndex];
          const isCompleting = progress.isGenerating === false;
          const completedAt = isCompleting ? Date.now() : undefined;
          
          updatedJobs[existingJobIndex] = {
            ...currentJob,
            progress: progress.progress ?? currentJob.progress,
            stage: progress.stage ?? currentJob.stage,
            message: progress.message ?? currentJob.message,
            status: isCompleting 
              ? (progress.stage === 'failed' ? 'failed' : 'completed')
              : currentJob.status,
            elapsedTime: progress.elapsedTime ?? (isCompleting && completedAt ? Math.floor((completedAt - currentJob.startedAt) / 1000) : currentJob.elapsedTime),
            estimatedTimeRemaining: progress.estimatedTimeRemaining,
            ...(completedAt && { completedAt }),
          };
          return updatedJobs;
        }
        return prev;
      });
    }
  }, []);

  const clearGlobalProgress = useCallback(() => {
    setGlobalProgress(initialProgress);
  }, []);

  const addJob = useCallback((job: GenerationJob) => {
    setActiveJobs(prev => {
      // Check if job already exists
      const exists = prev.some(j => j.jobId === job.jobId);
      if (exists) {
        // Update existing job
        return prev.map(j => j.jobId === job.jobId ? job : j);
      }
      // Add new job
      return [...prev, job];
    });
  }, []);

  const updateJob = useCallback((jobId: string, updates: Partial<GenerationJob>) => {
    setActiveJobs(prev => {
      return prev.map(job => {
        if (job.jobId === jobId) {
          const updatedJob = { ...job, ...updates };
          // Auto-set completedAt if status changes to completed or failed
          if ((updates.status === 'completed' || updates.status === 'failed') && !updatedJob.completedAt) {
            updatedJob.completedAt = Date.now();
            // Calculate final elapsed time
            updatedJob.elapsedTime = Math.floor((updatedJob.completedAt - job.startedAt) / 1000);
          }
          return updatedJob;
        }
        return job;
      });
    });
  }, []);

  const removeJob = useCallback((jobId: string) => {
    setActiveJobs(prev => prev.filter(job => job.jobId !== jobId));
  }, []);

  const clearCompletedJobs = useCallback(() => {
    setActiveJobs(prev => prev.filter(job => 
      job.status === 'pending' || job.status === 'processing'
    ));
  }, []);

  const clearCompletedJobsForType = useCallback(async (generationType: GenerationJob['generationType']) => {
    // Clear from local state
    setActiveJobs(prev => prev.filter(job => 
      !(job.generationType === generationType && (job.status === 'completed' || job.status === 'failed'))
    ));

    // Clear from database
    try {
      const apiType = generationType.toUpperCase().replace(/-/g, '_');
      await fetch(`/api/active-generations?clearCompleted=true&type=${apiType}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to clear completed jobs from database:', error);
    }
  }, []);

  const hasActiveGenerationForType = useCallback((generationType: GenerationJob['generationType']) => {
    return activeJobs.some(job => 
      job.generationType === generationType && 
      (job.status === 'pending' || job.status === 'processing')
    );
  }, [activeJobs]);

  const getLastCompletedJobForType = useCallback((generationType: GenerationJob['generationType']) => {
    // Find the most recently completed job for this generation type
    const completedJobs = activeJobs
      .filter(job => 
        job.generationType === generationType && 
        job.status === 'completed' &&
        job.results // Only return jobs that have results
      )
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    
    return completedJobs[0] || null;
  }, [activeJobs]);

  return (
    <GenerationContext.Provider value={{
      globalProgress,
      activeJobs,
      updateGlobalProgress,
      clearGlobalProgress,
      addJob,
      updateJob,
      removeJob,
      clearCompletedJobs,
      clearCompletedJobsForType,
      hasActiveGenerationForType,
      getLastCompletedJobForType,
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
