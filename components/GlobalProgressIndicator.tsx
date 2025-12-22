"use client";

import React from 'react';
import { useGenerationProgress } from '@/lib/generationContext';
import { Loader2, Wand2, ImageIcon, Video, Shuffle, Sparkles } from 'lucide-react';

export function GlobalProgressIndicator() {
  const { globalProgress } = useGenerationProgress();

  if (!globalProgress.isGenerating) {
    return null;
  }

  // Get appropriate icon for generation type
  const getGenerationIcon = () => {
    switch (globalProgress.generationType) {
      case 'text-to-image':
        return ImageIcon;
      case 'style-transfer':
        return Wand2;
      case 'image-to-video':
        return Video;
      case 'face-swap':
        return Shuffle;
      case 'skin-enhancer':
        return Sparkles;
      default:
        return Loader2;
    }
  };

  // Get generation type display name
  const getGenerationDisplayName = () => {
    switch (globalProgress.generationType) {
      case 'text-to-image':
        return 'Text to Image';
      case 'style-transfer':
        return 'Style Transfer';
      case 'image-to-video':
        return 'Image to Video';
      case 'face-swap':
        return 'Face Swap';
      case 'skin-enhancer':
        return 'Skin Enhancer';
      default:
        return 'AI Generation';
    }
  };

  // Get stage-specific icon for progress
  const getStageIcon = () => {
    const stage = globalProgress.stage;
    if (stage === 'starting') return '🚀';
    if (stage === 'loading_models') return '📦';
    if (stage === 'processing_prompt') return '📝';
    if (stage === 'processing_image') return '🖼️';
    if (stage === 'generating') return '🎨';
    if (stage === 'saving') return '💾';
    if (stage === 'completed') return '✅';
    if (stage === 'failed') return '❌';
    return '🎨';
  };

  const GenerationIcon = getGenerationIcon();
  const progress = Math.round(globalProgress.progress || 0);

  return (
    <div className="flex items-center space-x-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-200/50 dark:border-purple-700/30 px-3 py-2 rounded-lg shadow-sm animate-pulse">
      {/* Generation Icon */}
      <GenerationIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
      
      {/* Progress Info */}
      <div className="flex items-center space-x-2">
        {/* Stage Icon */}
        <span className="text-sm">{getStageIcon()}</span>
        
        {/* Progress Text */}
        <div className="flex flex-col">
          <div className="flex items-center space-x-1">
            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
              {getGenerationDisplayName()}
            </span>
            <span className="text-xs font-bold text-purple-800 dark:text-purple-200">
              {progress}%
            </span>
          </div>
          
          {/* Stage and Time Info */}
          <div className="flex items-center space-x-2 text-xs text-purple-600 dark:text-purple-400">
            {globalProgress.stage && (
              <span className="capitalize">
                {globalProgress.stage.replace(/_/g, ' ')}
              </span>
            )}
            {globalProgress.estimatedTimeRemaining && globalProgress.estimatedTimeRemaining > 0 && (
              <span>
                • {Math.round(globalProgress.estimatedTimeRemaining)}s left
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mini Progress Bar */}
      <div className="w-16 h-2 bg-purple-200 dark:bg-purple-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Spinning Loading Icon */}
      <Loader2 className="w-3 h-3 text-purple-600 dark:text-purple-400 animate-spin" />
    </div>
  );
}
