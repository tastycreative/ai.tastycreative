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
    model?: string;
    mode?: string;
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
  getCompletedJobsForType: (generationType: GenerationJob['generationType']) => GenerationJob[]; // 🆕 Get ALL completed jobs
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

  // 🔥 SSE connection for real-time updates (replaces polling)
  useEffect(() => {
    console.log('📡 Establishing SSE connection for real-time updates...');
    
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;

      try {
        eventSource = new EventSource('/api/active-generations/stream');

        eventSource.onopen = () => {
          console.log('📡 SSE connection established');
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
              case 'connected':
                console.log('📡 SSE:', data.message);
                break;

              case 'initial':
                // Initial state from server
                if (data.jobs && Array.isArray(data.jobs)) {
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
                  
                  setActiveJobs(jobs);
                  setIsHydrated(true);
                  console.log(`📡 Loaded ${jobs.length} initial jobs via SSE`);
                }
                break;

              case 'job-update':
                // Real-time job update
                if (data.job) {
                  const job = data.job;
                  const updatedJob: GenerationJob = {
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
                  };

                  setActiveJobs(prev => {
                    const existingIndex = prev.findIndex(j => j.jobId === updatedJob.jobId);
                    if (existingIndex >= 0) {
                      const updated = [...prev];
                      updated[existingIndex] = updatedJob;
                      return updated;
                    } else {
                      return [...prev, updatedJob];
                    }
                  });
                }
                break;

              case 'job-deleted':
                // Job deletion
                if (data.jobId) {
                  setActiveJobs(prev => prev.filter(j => j.jobId !== data.jobId));
                  console.log(`📡 Job deleted: ${data.jobId}`);
                }
                break;

              case 'jobs-cleared':
                // Bulk job clearing
                if (data.generationType) {
                  setActiveJobs(prev => prev.filter(j => 
                    !(j.generationType === data.generationType && (j.status === 'completed' || j.status === 'failed'))
                  ));
                  console.log(`📡 Cleared ${data.count} completed jobs for ${data.generationType}`);
                } else {
                  setActiveJobs(prev => prev.filter(j => j.status === 'pending' || j.status === 'processing'));
                  console.log(`📡 Cleared ${data.count} completed jobs`);
                }
                break;
            }
          } catch (error) {
            console.error('Failed to parse SSE message:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('📡 SSE connection error:', error);
          eventSource?.close();
          
          // Reconnect after 3 seconds
          if (!isUnmounted) {
            console.log('📡 Reconnecting in 3 seconds...');
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };

      } catch (error) {
        console.error('Failed to establish SSE connection:', error);
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      }
    };

    // Initial connection
    connect();

    // Cleanup on unmount
    return () => {
      isUnmounted = true;
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      console.log('📡 SSE connection closed');
    };
  }, []);

  // ❌ REMOVED: Debounced save to database (SSE handles sync now)
  // ❌ REMOVED: Polling via useEffect (SSE replaces this)

  // ❌ REMOVED: Debounced save to database (SSE handles sync now)
  // ❌ REMOVED: Polling via useEffect (SSE replaces this)

  // ✅ KEPT: Update elapsed time for active jobs locally (client-side only, not saved)
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveJobs(prev => {
        const now = Date.now();
        let hasChanges = false;
        
        const updated = prev.map(job => {
          if (job.status === 'processing' || job.status === 'pending') {
            const elapsedTime = Math.floor((now - job.startedAt) / 1000);
            if (elapsedTime !== job.elapsedTime) {
              hasChanges = true;
              return { ...job, elapsedTime };
            }
          }
          // For completed/failed jobs without elapsedTime, calculate it from timestamps
          if ((job.status === 'completed' || job.status === 'failed') && !job.elapsedTime && job.completedAt) {
            const elapsedTime = Math.floor((job.completedAt - job.startedAt) / 1000);
            hasChanges = true;
            return { ...job, elapsedTime };
          }
          return job;
        });

        return hasChanges ? updated : prev; // Only update if something changed
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

  const addJob = useCallback(async (job: GenerationJob) => {
    // Update local state immediately (optimistic update)
    setActiveJobs(prev => {
      const exists = prev.some(j => j.jobId === job.jobId);
      if (exists) {
        return prev.map(j => j.jobId === job.jobId ? job : j);
      }
      return [...prev, job];
    });

    // 🔥 Sync to server (will broadcast via SSE to all clients)
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
      console.error('Failed to sync job to server:', job.jobId, error);
    }
  }, []);

  const updateJob = useCallback(async (jobId: string, updates: Partial<GenerationJob>) => {
    let updatedJob: GenerationJob | null = null;

    // Update local state immediately (optimistic update)
    setActiveJobs(prev => {
      return prev.map(job => {
        if (job.jobId === jobId) {
          const updated = { ...job, ...updates };
          // Auto-set completedAt if status changes to completed or failed
          if ((updates.status === 'completed' || updates.status === 'failed') && !updated.completedAt) {
            updated.completedAt = Date.now();
            updated.elapsedTime = Math.floor((updated.completedAt - job.startedAt) / 1000);
          }
          updatedJob = updated;
          return updated;
        }
        return job;
      });
    });

    // 🔥 Sync to server ONLY when status changes (completed/failed) or on first creation
    // Progress-only updates (progress/stage/message without status change) stay local-only
    // to prevent race conditions where a late-arriving progress update overwrites a completion
    const isStatusChange = updates.status === 'completed' || updates.status === 'failed';
    const shouldSyncToServer = isStatusChange;

    if (shouldSyncToServer && updatedJob) {
      try {
        const response = await fetch('/api/active-generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId: updatedJob.jobId,
            generationType: updatedJob.generationType.toUpperCase().replace(/-/g, '_'),
            progress: updatedJob.progress,
            stage: updatedJob.stage,
            message: updatedJob.message,
            status: updatedJob.status.toUpperCase(),
            startedAt: updatedJob.startedAt,
            completedAt: updatedJob.completedAt,
            elapsedTime: updatedJob.elapsedTime,
            estimatedTimeRemaining: updatedJob.estimatedTimeRemaining,
            metadata: updatedJob.metadata,
            results: updatedJob.results,
            error: updatedJob.error,
          }),
        });
        if (!response.ok) {
          console.error(`❌ Server rejected job update for ${jobId}: ${response.status}`);
        } else {
          console.log(`✅ Job ${jobId} synced to server with status: ${updatedJob.status}`);
        }
      } catch (error) {
        console.error('Failed to sync job update to server:', jobId, error);
      }
    } else if (isStatusChange && !updatedJob) {
      // Critical: Job completed but wasn't in local state - still sync to server
      console.warn(`⚠️ Job ${jobId} not found in local state but has completion status. Syncing directly to server...`);
      try {
        const response = await fetch('/api/active-generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            generationType: (updates as any).generationType?.toUpperCase().replace(/-/g, '_') || 'TEXT_TO_IMAGE',
            status: updates.status!.toUpperCase(),
            progress: updates.progress ?? 100,
            stage: updates.stage ?? 'completed',
            message: updates.message ?? 'Generation completed',
            completedAt: Date.now(),
            results: updates.results,
            error: updates.error,
          }),
        });
        if (!response.ok) {
          console.error(`❌ Server rejected direct sync for ${jobId}: ${response.status}`);
        } else {
          console.log(`✅ Job ${jobId} completion synced directly to server`);
        }
      } catch (error) {
        console.error('Failed to sync job completion to server:', jobId, error);
      }
    } else if (!shouldSyncToServer) {
      // Progress-only update - local state only, no server sync
      // This prevents race conditions with in-flight progress requests
    }
  }, []);

  const removeJob = useCallback(async (jobId: string) => {
    // Update local state immediately (optimistic update)
    setActiveJobs(prev => prev.filter(job => job.jobId !== jobId));

    // 🔥 Sync to server (will broadcast via SSE to all clients)
    try {
      await fetch(`/api/active-generations?jobId=${jobId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to delete job from server:', jobId, error);
    }
  }, []);

  const clearCompletedJobs = useCallback(async () => {
    // Update local state immediately (optimistic update)
    setActiveJobs(prev => prev.filter(job => 
      job.status === 'pending' || job.status === 'processing'
    ));

    // 🔥 Sync to server (will broadcast via SSE to all clients)
    try {
      await fetch('/api/active-generations?clearCompleted=true', {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to clear completed jobs from server:', error);
    }
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

  // 🆕 Get ALL completed jobs for a specific type (for history display)
  const getCompletedJobsForType = useCallback((generationType: GenerationJob['generationType']) => {
    return activeJobs
      .filter(job => 
        job.generationType === generationType && 
        job.status === 'completed' &&
        job.results // Only return jobs that have results
      )
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)); // Latest first
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
      getCompletedJobsForType, // 🆕 Export new function
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
