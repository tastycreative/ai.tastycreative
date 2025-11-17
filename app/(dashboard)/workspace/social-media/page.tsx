'use client';

import { useState, useEffect, Suspense } from 'react';
import { Instagram, Calendar, BarChart3, Settings } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import InstagramStagingTool from '@/components/social-media/InstagramStagingTool';
import CalendarView from '@/components/social-media/CalendarView';

const tabs = [
  { id: 'instagram-staging', label: 'Instagram Staging', icon: Instagram },
  { id: 'calendar', label: 'Calendar View', icon: Calendar },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function SocialMediaContent() {
  const searchParams = useSearchParams();
  const postIdFromUrl = searchParams.get('post');
  const [activeTab, setActiveTab] = useState('instagram-staging');

  // Auto-switch to instagram-staging tab when post ID is in URL
  useEffect(() => {
    if (postIdFromUrl) {
      setActiveTab('instagram-staging');
    }
  }, [postIdFromUrl]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'instagram-staging':
        return <InstagramStagingTool highlightPostId={postIdFromUrl} />;
      case 'calendar':
        return <CalendarView />;
      case 'analytics':
        return (
          <div className="bg-gradient-to-br from-white to-green-50/50 dark:from-gray-900/30 dark:to-green-900/20 shadow-lg rounded-lg p-8 border border-gray-200/50 dark:border-gray-700/30 backdrop-blur-sm">
            <p className="text-gray-600 dark:text-gray-300">Social media analytics coming soon...</p>
          </div>
        );
      case 'settings':
        return (
          <div className="bg-gradient-to-br from-white to-purple-50/50 dark:from-gray-900/30 dark:to-purple-900/20 shadow-lg rounded-lg p-8 border border-gray-200/50 dark:border-gray-700/30 backdrop-blur-sm">
            <p className="text-gray-600 dark:text-gray-300">Social media settings coming soon...</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="space-y-2 sm:space-y-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Social Media</h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Manage your social media content and posting schedule</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900/30 dark:to-gray-800/20 border border-gray-200/50 dark:border-gray-700/30 rounded-xl shadow-lg backdrop-blur-sm overflow-hidden">
        <div className="border-b border-gray-200/50 dark:border-gray-700/30">
          <nav className="flex gap-4 sm:gap-6 md:gap-8 px-4 sm:px-6 overflow-x-auto scrollbar-hide" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    isActive
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  } whitespace-nowrap border-b-2 py-3 sm:py-4 px-1 font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5 sm:gap-2 active:scale-95`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">{tab.label}</span>
                  <span className="xs:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 sm:p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

export default function SocialMediaPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SocialMediaContent />
    </Suspense>
  );
}