'use client';

import { memo } from 'react';
import { Check, Circle } from 'lucide-react';

interface Step {
  id: string;
  title: string;
  description?: string;
}

interface ProgressIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  allowStepNavigation?: boolean;
}

export const ProgressIndicator = memo(function ProgressIndicator({
  steps,
  currentStep,
  onStepClick,
  allowStepNavigation = false,
}: ProgressIndicatorProps) {
  const progress = ((currentStep + 1) / steps.length) * 100;
  const lineProgress = (currentStep / (steps.length - 1)) * 100;

  return (
    <div className="w-full mb-12">
      {/* Progress Bar with Percentage */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-400">Progress</span>
            <span className="text-xs text-zinc-500">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>
          <span
            key={progress}
            className="text-2xl font-bold bg-gradient-to-r from-brand-light-pink via-brand-mid-pink to-brand-blue bg-clip-text text-transparent animate-fade-in"
          >
            {Math.round(progress)}%
          </span>
        </div>

        {/* Progress Bar — CSS transition instead of spring */}
        <div className="relative h-2 bg-zinc-800/50 rounded-full overflow-hidden border border-zinc-700/30">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-light-pink via-brand-mid-pink to-brand-blue shadow-lg shadow-brand-light-pink/20 rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          >
            {/* CSS shine effect — GPU accelerated */}
            <div className="absolute inset-0 progress-shine" />
          </div>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="relative">
        {/* Connection Line */}
        <div className="absolute top-6 left-0 right-0 h-[2px] bg-zinc-800/50" />
        <div
          className="absolute top-6 left-0 h-[2px] bg-gradient-to-r from-brand-light-pink to-brand-blue transition-[width] duration-500 ease-out"
          style={{ width: `${lineProgress}%` }}
        />

        {/* Steps */}
        <div className="relative flex items-start justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const isClickable = allowStepNavigation && index <= currentStep;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => isClickable && onStepClick?.(index)}
                disabled={!isClickable}
                className={`
                  group relative flex flex-col items-center gap-3 flex-1
                  ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                  animate-fade-in-up
                `}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                {/* Step Circle */}
                <div
                  className={`
                    relative flex items-center justify-center w-12 h-12 rounded-full
                    border-2 font-semibold text-sm z-10 transition-all duration-300
                    ${
                      isCompleted
                        ? 'border-brand-light-pink bg-gradient-to-br from-brand-light-pink to-brand-dark-pink text-white shadow-lg shadow-brand-light-pink/30'
                        : isCurrent
                        ? 'border-brand-light-pink bg-zinc-900 text-brand-light-pink shadow-lg shadow-brand-light-pink/20 ring-4 ring-brand-light-pink/10'
                        : 'border-zinc-700 bg-zinc-900/50 text-zinc-500'
                    }
                    ${isClickable ? 'hover:shadow-[0_0_20px_rgba(247,116,185,0.3)]' : ''}
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5 animate-scale-in" />
                  ) : isCurrent ? (
                    <Circle className="w-3 h-3 fill-current step-pulse" />
                  ) : (
                    <span>{index + 1}</span>
                  )}

                  {/* Glow effect for current step — CSS animation */}
                  {isCurrent && (
                    <div className="absolute inset-0 rounded-full bg-brand-light-pink/20 step-glow" />
                  )}
                </div>

                {/* Step Label */}
                <div className="text-center max-w-[120px]">
                  <p
                    className={`
                      text-xs font-medium transition-colors duration-300
                      ${
                        isCurrent
                          ? 'text-white'
                          : isCompleted
                          ? 'text-zinc-300'
                          : 'text-zinc-500'
                      }
                    `}
                  >
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-[10px] text-zinc-600 mt-1 hidden sm:block">
                      {step.description}
                    </p>
                  )}
                </div>

                {/* Hover tooltip for completed/clickable steps */}
                {isClickable && (
                  <div className="absolute top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-zinc-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                      {isCompleted ? 'Click to review' : 'Current step'}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
