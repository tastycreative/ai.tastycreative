'use client';

import Link from 'next/link';
import { useOrganization } from '@clerk/nextjs';

interface PaymentRequiredOverlayProps {
  tenant: string;
  isAdmin: boolean;
}

export function PaymentRequiredOverlay({ tenant, isAdmin }: PaymentRequiredOverlayProps) {
  const { organization } = useOrganization();

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <div className="max-w-md w-full mx-auto">
        <div className="bg-white dark:bg-gray-900/50 border border-red-200 dark:border-red-900/50 rounded-2xl p-8 shadow-xl">
          <div className="flex flex-col items-center text-center space-y-6">
            {/* Warning Icon */}
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 dark:text-brand-off-white">
              Payment Required
            </h2>

            {/* Description */}
            <p className="text-gray-600 dark:text-gray-400">
              Your organization's subscription payment is required to continue using our services. Please update your payment information to restore access.
            </p>

            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg">
              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                Status: {String((organization?.publicMetadata as { subscriptionStatus?: string })?.subscriptionStatus || 'UNKNOWN')}
              </span>
            </div>

            {/* CTA Button - Only for Admin/Owner */}
            {isAdmin && (
              <Link
                href={`/${tenant}/billing`}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-light-pink hover:bg-brand-mid-pink text-white font-medium rounded-xl transition-colors shadow-lg hover:shadow-xl"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
                Go to Billing
              </Link>
            )}

            {/* Help Text for Non-Admins */}
            {!isAdmin && (
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Please contact your organization administrator to update payment information.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
