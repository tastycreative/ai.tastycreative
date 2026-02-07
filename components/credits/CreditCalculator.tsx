'use client';

import { useState, useEffect } from 'react';
import { Zap, ChevronUp, ChevronDown, Info } from 'lucide-react';
import { useFeaturePricing } from '@/lib/hooks/useFeaturePricing.query';

interface CreditModifier {
  label: string;
  multiplier?: number;
  additionalCredits?: number;
  description?: string;
}

interface CreditCalculatorProps {
  /** URL path segment (kebab-case) or feature key (snake_case) */
  path?: string;
  /** Additional credit modifiers based on user selections */
  modifiers?: CreditModifier[];
  /** Position of the floating widget */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  className?: string;
}

/**
 * Floating credit calculator that shows real-time credit cost
 * based on feature pricing and user-selected options (resolution, batch size, etc.)
 */
export function CreditCalculator({
  path,
  modifiers = [],
  position = 'bottom-right',
  className = '',
}: CreditCalculatorProps) {
  const { featurePricing, isLoading } = useFeaturePricing(path);
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate total credits
  const baseCredits = featurePricing?.credits ?? 0;

  let totalCredits = baseCredits;

  // Apply modifiers
  modifiers.forEach(modifier => {
    if (modifier.multiplier) {
      totalCredits *= modifier.multiplier;
    }
    if (modifier.additionalCredits) {
      totalCredits += modifier.additionalCredits;
    }
  });

  // Round to nearest integer
  totalCredits = Math.round(totalCredits);

  // Don't render if no pricing found or still loading
  if (isLoading || !featurePricing) {
    return null;
  }

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  };

  return (
    <div
      className={`fixed z-50 ${positionClasses[position]} ${className}`}
    >
      <div className="bg-white dark:bg-gray-900 border-2 border-brand-blue/30 dark:border-brand-blue/40 rounded-2xl shadow-2xl shadow-brand-blue/20 backdrop-blur-xl overflow-hidden transition-all duration-300 ease-out">
        {/* Collapsed View - Always Visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-brand-blue/5 dark:hover:bg-brand-blue/10 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-blue/10 dark:bg-brand-blue/20 rounded-xl">
              <Zap className="w-5 h-5 text-brand-blue" />
            </div>
            <div className="text-left">
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Cost per generation</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-brand-blue">{totalCredits}</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">credits</span>
              </div>
            </div>
          </div>
          {modifiers.length > 0 && (
            <div className="flex items-center gap-1">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              )}
            </div>
          )}
        </button>

        {/* Expanded View - Breakdown */}
        {isExpanded && modifiers.length > 0 && (
          <div className="border-t border-brand-blue/10 dark:border-brand-blue/20 bg-gray-50/50 dark:bg-gray-800/50 px-4 py-3 animate-fadeIn">
            <div className="space-y-2 text-sm">
              {/* Base Price */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Base price</span>
                  <div className="group relative">
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-lg">
                      {featurePricing.featureName}
                    </div>
                  </div>
                </div>
                <span className="text-gray-600 dark:text-gray-400 font-semibold">{baseCredits}</span>
              </div>

              {/* Modifiers */}
              {modifiers.map((modifier, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-600 dark:text-gray-400">{modifier.label}</span>
                    {modifier.description && (
                      <div className="group relative">
                        <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-lg max-w-xs">
                          {modifier.description}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-gray-600 dark:text-gray-400">
                    {modifier.multiplier && `×${modifier.multiplier}`}
                    {modifier.additionalCredits && `+${modifier.additionalCredits}`}
                  </span>
                </div>
              ))}

              {/* Divider */}
              <div className="border-t border-brand-blue/10 dark:border-brand-blue/20 my-2" />

              {/* Total */}
              <div className="flex items-center justify-between">
                <span className="text-gray-900 dark:text-white font-bold">Total</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-brand-blue">{totalCredits}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">credits</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
