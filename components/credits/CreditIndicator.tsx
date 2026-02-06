'use client';

import { useCredits } from '@/lib/hooks/useCredits.query';
import { AlertTriangle, XCircle, Zap } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function CreditIndicator() {
  const { availableCredits, isLowCredits, isOutOfCredits, isLoading } = useCredits();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't show on billing page
  const isBillingPage = pathname?.includes('/billing');

  if (!mounted || isLoading || isBillingPage) {
    return null;
  }

  // Out of credits - show persistent warning banner
  if (isOutOfCredits) {
    return createPortal(
      <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Out of Credits</p>
                <p className="text-xs opacity-90">
                  You have 0 credits remaining. Purchase more credits to continue using AI features.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const tenant = pathname?.split('/')[1];
                router.push(`/${tenant}/billing`);
              }}
              className="px-4 py-2 bg-white text-red-600 rounded-lg font-semibold text-sm hover:bg-red-50 transition-colors whitespace-nowrap"
            >
              Buy Credits
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Low credits - show warning badge (collapsible)
  if (isLowCredits) {
    return createPortal(
      <div className="fixed top-4 right-4 z-[100]">
        {isExpanded ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 text-yellow-900 dark:text-yellow-200 rounded-lg shadow-lg p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Low Credits Warning</p>
                <p className="text-xs mt-1 opacity-90">
                  You have only <span className="font-bold">{availableCredits}</span> credits remaining.
                  Consider purchasing more to avoid interruptions.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      const tenant = pathname?.split('/')[1];
                      router.push(`/${tenant}/billing`);
                    }}
                    className="px-3 py-1.5 bg-yellow-600 text-white rounded-md text-xs font-semibold hover:bg-yellow-700 transition-colors"
                  >
                    Buy Credits
                  </button>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsExpanded(true)}
            className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 text-yellow-900 dark:text-yellow-200 rounded-full shadow-lg p-3 hover:scale-105 transition-transform"
            title="Low credits warning - Click for details"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-bold">{availableCredits}</span>
              <Zap className="w-4 h-4" />
            </div>
          </button>
        )}
      </div>,
      document.body
    );
  }

  return null;
}
