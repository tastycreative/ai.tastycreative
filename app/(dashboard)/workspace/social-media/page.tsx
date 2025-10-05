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
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Social Media</h1>
          <p className="text-gray-600 dark:text-gray-300">Manage your social media content and posting schedule</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900/30 dark:to-gray-800/20 border border-gray-200/50 dark:border-gray-700/30 rounded-xl shadow-lg backdrop-blur-sm overflow-hidden">
        <div className="border-b border-gray-200/50 dark:border-gray-700/30">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
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
                  } whitespace-nowrap border-b-2 py-4 px-1 font-medium text-sm transition-colors flex items-center gap-2`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
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