'use client';

import { useFeaturePricing } from '@/lib/hooks/useFeaturePricing.query';
import { Zap, Loader2, Info } from 'lucide-react';

interface CreditCostBadgeProps {
  /** URL path segment (kebab-case) or feature key (snake_case) */
  path?: string;
  className?: string;
  showDescription?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
}

export function CreditCostBadge({
  path,
  className = '',
  showDescription = false,
  variant = 'default',
}: CreditCostBadgeProps) {
  const { featurePricing, isLoading } = useFeaturePricing(path);

  if (isLoading) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-600 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  if (!featurePricing) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 bg-brand-blue/10 dark:bg-brand-blue/20 rounded-md ${className}`}>
        <Zap className="w-3.5 h-3.5 text-brand-blue" />
        <span className="text-xs font-semibold text-brand-blue">{featurePricing.credits}</span>
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className={`flex flex-col gap-2 p-4 bg-gradient-to-br from-brand-blue/5 to-brand-light-pink/5 dark:from-brand-blue/10 dark:to-brand-light-pink/10 border border-brand-blue/20 dark:border-brand-blue/30 rounded-xl ${className}`}>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-brand-blue/10 dark:bg-brand-blue/20 rounded-lg">
            <Zap className="w-5 h-5 text-brand-blue" />
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {featurePricing.credits}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">credits per generation</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {featurePricing.featureName}
            </p>
          </div>
        </div>
        {showDescription && featurePricing.description && (
          <div className="flex items-start gap-2 pt-2 border-t border-brand-blue/10 dark:border-brand-blue/20">
            <Info className="w-4 h-4 text-brand-blue mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              {featurePricing.description}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 bg-brand-blue/10 dark:bg-brand-blue/20 border border-brand-blue/20 dark:border-brand-blue/30 rounded-lg ${className}`}>
      <Zap className="w-4 h-4 text-brand-blue" />
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-brand-blue">{featurePricing.credits}</span>
        <span className="text-sm text-gray-600 dark:text-gray-400">credits</span>
      </div>
    </div>
  );
}
