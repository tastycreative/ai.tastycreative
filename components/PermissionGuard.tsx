'use client';

import { usePathname, useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/hooks/usePermissions.query';
import { canAccessRoute } from '@/lib/permissions/routePermissions';
import { AlertCircle, Lock } from 'lucide-react';

interface PermissionGuardProps {
  children: React.ReactNode;
}

export function PermissionGuard({ children }: PermissionGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { permissions, loading, subscriptionInfo } = usePermissions();

  // Show loading state while checking permissions
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Check if user has permission
  if (!canAccessRoute(pathname, permissions)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
          <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full">
            <Lock className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>

          <h1 className="mt-6 text-2xl font-bold text-center text-gray-900 dark:text-white">
            Access Denied
          </h1>

          <p className="mt-4 text-center text-gray-600 dark:text-gray-400">
            {subscriptionInfo?.planDisplayName === 'No Organization' ? (
              <>
                You need to create or join an organization to access this feature.
              </>
            ) : (
              <>
                Your current plan ({subscriptionInfo?.planDisplayName}) does not include access to this feature.
              </>
            )}
          </p>

          <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  Upgrade Required
                </h3>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  {subscriptionInfo?.planDisplayName === 'No Organization' ? (
                    'Create an organization and subscribe to a plan to unlock all features.'
                  ) : (
                    'Upgrade your subscription to access this feature and more.'
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => router.push('/billing')}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              View Plans
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
