'use client';

import { ReactNode } from 'react';
import InstagramProfileSelector from '@/components/social-media/InstagramProfileSelector';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';

interface ContentStudioLayoutProps {
  children: ReactNode;
  title: string;
  description: string;
}

export default function ContentStudioLayout({ children, title, description }: ContentStudioLayoutProps) {
  const { profileId } = useInstagramProfile();

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{description}</p>
          </div>
          <InstagramProfileSelector />
        </div>
      </div>

      <div className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900/30 dark:to-gray-800/20 border border-gray-200/50 dark:border-gray-700/30 rounded-xl shadow-lg backdrop-blur-sm overflow-hidden">
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
