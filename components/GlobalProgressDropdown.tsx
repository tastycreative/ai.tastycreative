"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useGenerationProgress } from '@/lib/generationContext';
import { 
  Loader2, 
  Wand2, 
  ImageIcon, 
  Video, 
  Shuffle, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  ChevronDown,
  X,
  Clock,
  Zap
} from 'lucide-react';
import { createPortal } from 'react-dom';

export function GlobalProgressDropdown() {
  const { activeJobs, removeJob, clearCompletedJobs } = useGenerationProgress();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Don't close if clicking the trigger or inside the dropdown
      if (
        (triggerRef.current && triggerRef.current.contains(target)) ||
        (dropdownRef.current && dropdownRef.current.contains(target))
      ) {
        return;
      }
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Get appropriate icon for generation type
  const getGenerationIcon = (type: string) => {
    switch (type) {
      case 'text-to-image':
      case 'image-to-image':
        return ImageIcon;
      case 'style-transfer':
        return Wand2;
      case 'image-to-video':
      case 'text-to-video':
      case 'kling-text-to-video':
      case 'kling-image-to-video':
      case 'kling-multi-image-to-video':
      case 'kling-motion-control':
        return Video;
      case 'face-swap':
        return Shuffle;
      case 'skin-enhancer':
        return Sparkles;
      default:
        return Zap;
    }
  };

  // Get generation type display name
  const getGenerationDisplayName = (type: string) => {
    const names: Record<string, string> = {
      'text-to-image': 'SeeDream Text to Image',
      'image-to-image': 'SeeDream Image to Image',
      'text-to-video': 'SeeDream Text to Video',
      'image-to-video': 'SeeDream Image to Video',
      'style-transfer': 'Style Transfer',
      'face-swap': 'Face Swap',
      'skin-enhancer': 'Skin Enhancer',
      'kling-text-to-video': 'Kling Text to Video',
      'kling-image-to-video': 'Kling Image to Video',
      'kling-multi-image-to-video': 'Kling Multi Image to Video',
      'kling-motion-control': 'Kling Motion Control',
    };
    return names[type] || 'AI Generation';
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  // Format time
  const formatTime = (seconds: number | undefined) => {
    if (!seconds) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const activeProcessingJobs = activeJobs.filter(job => 
    job.status === 'processing' || job.status === 'pending'
  );
  
  const completedJobs = activeJobs.filter(job => 
    job.status === 'completed' || job.status === 'failed'
  );

  const hasActiveJobs = activeProcessingJobs.length > 0;
  const hasAnyJobs = activeJobs.length > 0;

  // Don't render if no jobs
  if (!hasAnyJobs) {
    return null;
  }

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-xl border shadow-sm transition-all duration-200
          ${hasActiveJobs 
            ? 'bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border-purple-200/50 dark:border-purple-700/30 hover:shadow-md' 
            : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'
          }
        `}
      >
        {/* Icon and Count */}
        <div className="flex items-center gap-2">
          {hasActiveJobs ? (
            <Loader2 className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
          )}
          
          <div className="flex flex-col items-start">
            <span className="text-xs font-medium text-sidebar-foreground">
              {hasActiveJobs ? `${activeProcessingJobs.length} Active` : 'All Complete'}
            </span>
            {hasActiveJobs && activeProcessingJobs[0] && (
              <span className="text-[10px] text-sidebar-foreground/60">
                {Math.round(activeProcessingJobs[0].progress)}%
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <ChevronDown className={`w-3 h-3 text-sidebar-foreground/60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && mounted && typeof window !== 'undefined' && document?.body && createPortal(
        <div
          className="fixed inset-0 z-[100]"
          style={{ pointerEvents: 'none' }}
        >
          <div
            ref={dropdownRef}
            className="absolute w-96 max-h-[500px] overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl shadow-[#EC67A1]/10"
            style={{
              pointerEvents: 'auto',
              top: triggerRef.current ? triggerRef.current.getBoundingClientRect().bottom + 8 : 0,
              left: triggerRef.current ? triggerRef.current.getBoundingClientRect().left : 0,
            }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#EC67A1]" />
                  <h3 className="font-semibold text-sm text-sidebar-foreground">
                    Generation Tasks
                  </h3>
                </div>
                {completedJobs.length > 0 && (
                  <button
                    onClick={clearCompletedJobs}
                    className="text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
                  >
                    Clear Completed
                  </button>
                )}
              </div>
            </div>

            {/* Jobs List */}
            <div className="overflow-y-auto max-h-[420px] custom-scrollbar">
              {/* Active/Processing Jobs */}
              {activeProcessingJobs.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-medium text-sidebar-foreground/60 px-2 py-1 mb-1">
                    Active ({activeProcessingJobs.length})
                  </div>
                  {activeProcessingJobs.map((job) => {
                    const Icon = getGenerationIcon(job.generationType);
                    return (
                      <div
                        key={job.jobId}
                        className="mb-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50"
                      >
                        {/* Job Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Icon className="w-4 h-4 text-[#5DC3F8] flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-sidebar-foreground truncate">
                                {getGenerationDisplayName(job.generationType)}
                              </div>
                              {job.metadata?.prompt && (
                                <div className="text-xs text-sidebar-foreground/60 truncate mt-0.5">
                                  {job.metadata.prompt}
                                </div>
                              )}
                            </div>
                          </div>
                          {getStatusBadge(job.status)}
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-xs text-sidebar-foreground/60 mb-1">
                            <span className="capitalize">{job.stage.replace(/_/g, ' ')}</span>
                            <span className="font-medium">{Math.round(job.progress)}%</span>
                          </div>
                          <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#5DC3F8] to-[#EC67A1] transition-all duration-500 ease-out"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        </div>

                        {/* Metadata */}
                        <div className="flex items-center justify-between text-xs text-sidebar-foreground/60">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(job.elapsedTime)}</span>
                            {job.estimatedTimeRemaining && job.estimatedTimeRemaining > 0 && (
                              <span className="text-sidebar-foreground/40">
                                • ~{formatTime(job.estimatedTimeRemaining)} left
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Completed Jobs */}
              {completedJobs.length > 0 && (
                <div className="p-2 border-t border-zinc-200 dark:border-zinc-700">
                  <div className="text-xs font-medium text-sidebar-foreground/60 px-2 py-1 mb-1">
                    Recent ({completedJobs.length})
                  </div>
                  {completedJobs.map((job) => {
                    const Icon = getGenerationIcon(job.generationType);
                    const isSuccess = job.status === 'completed';
                    return (
                      <div
                        key={job.jobId}
                        className="mb-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/30"
                      >
                        {/* Job Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Icon className="w-4 h-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-sidebar-foreground truncate">
                                {getGenerationDisplayName(job.generationType)}
                              </div>
                              {job.metadata?.prompt && (
                                <div className="text-xs text-sidebar-foreground/60 truncate mt-0.5">
                                  {job.metadata.prompt}
                                </div>
                              )}
                              {job.error && (
                                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                                  {job.error}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(job.status)}
                            <button
                              onClick={() => removeJob(job.jobId)}
                              className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                            >
                              <X className="w-3 h-3 text-sidebar-foreground/40" />
                            </button>
                          </div>
                        </div>

                        {/* Completion Time */}
                        <div className="flex items-center gap-2 text-xs text-sidebar-foreground/60 mt-2">
                          <Clock className="w-3 h-3" />
                          <span>Completed in {formatTime(job.elapsedTime)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
