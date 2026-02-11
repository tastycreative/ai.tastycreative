'use client';

import { memo } from 'react';
import { Check, Circle } from 'lucide-react';
import { motion } from 'framer-motion';

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
          <motion.span
            key={progress}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-2xl font-bold bg-gradient-to-r from-brand-light-pink via-brand-mid-pink to-brand-blue bg-clip-text text-transparent"
          >
            {Math.round(progress)}%
          </motion.span>
        </div>

        {/* Animated Progress Bar */}
        <div className="relative h-2 bg-zinc-800/50 rounded-full overflow-hidden backdrop-blur-sm border border-zinc-700/30">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-light-pink via-brand-mid-pink to-brand-blue shadow-lg shadow-brand-light-pink/20"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{
              type: 'spring',
              stiffness: 100,
              damping: 20,
              mass: 1,
            }}
          >
            {/* Animated shine effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{
                x: ['-100%', '200%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </motion.div>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="relative">
        {/* Connection Line */}
        <div className="absolute top-6 left-0 right-0 h-[2px] bg-zinc-800/50" />
        <motion.div
          className="absolute top-6 left-0 h-[2px] bg-gradient-to-r from-brand-light-pink to-brand-blue"
          initial={{ width: 0 }}
          animate={{
            width: `${(currentStep / (steps.length - 1)) * 100}%`,
          }}
          transition={{
            type: 'spring',
            stiffness: 80,
            damping: 20,
          }}
        />

        {/* Steps */}
        <div className="relative flex items-start justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const isPending = index > currentStep;
            const isClickable = allowStepNavigation && index <= currentStep;

            return (
              <motion.button
                key={step.id}
                type="button"
                onClick={() => isClickable && onStepClick?.(index)}
                disabled={!isClickable}
                className={`
                  group relative flex flex-col items-center gap-3 flex-1
                  ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                `}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={isClickable ? { scale: 1.05 } : {}}
                whileTap={isClickable ? { scale: 0.95 } : {}}
              >
                {/* Step Circle */}
                <motion.div
                  className={`
                    relative flex items-center justify-center w-12 h-12 rounded-full
                    border-2 font-semibold text-sm transition-all z-10
                    ${
                      isCompleted
                        ? 'border-brand-light-pink bg-gradient-to-br from-brand-light-pink to-brand-dark-pink text-white shadow-lg shadow-brand-light-pink/30'
                        : isCurrent
                        ? 'border-brand-light-pink bg-zinc-900 text-brand-light-pink shadow-lg shadow-brand-light-pink/20 ring-4 ring-brand-light-pink/10'
                        : 'border-zinc-700 bg-zinc-900/50 text-zinc-500'
                    }
                  `}
                  whileHover={
                    isClickable
                      ? {
                          boxShadow: '0 0 20px rgba(247, 116, 185, 0.3)',
                        }
                      : {}
                  }
                >
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 200,
                        damping: 15,
                      }}
                    >
                      <Check className="w-5 h-5" />
                    </motion.div>
                  ) : isCurrent ? (
                    <motion.div
                      animate={{
                        scale: [1, 1.2, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    >
                      <Circle className="w-3 h-3 fill-current" />
                    </motion.div>
                  ) : (
                    <span>{index + 1}</span>
                  )}

                  {/* Glow effect for current step */}
                  {isCurrent && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-brand-light-pink/20"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 0, 0.5],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                  )}
                </motion.div>

                {/* Step Label */}
                <div className="text-center max-w-[120px]">
                  <motion.p
                    className={`
                      text-xs font-medium transition-colors
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
                  </motion.p>
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
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
