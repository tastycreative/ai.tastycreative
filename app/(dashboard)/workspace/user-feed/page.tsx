'use client';

import React, { useState, useEffect } from 'react';
import ProfilesSidebar from '@/components/social-media/ProfilesSidebar';
import FeedContent from '@/components/social-media/FeedContent';
import SearchAndEvents from '@/components/social-media/SearchAndEvents';
import CreatePostModal from '@/components/social-media/CreatePostModal';
import CommentsModal from '@/components/social-media/CommentsModal';
import { Post } from '@/components/social-media/types';

export default function UserFeedPage() {
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
  const [currentImageIndexes, setCurrentImageIndexes] = useState<Record<string, number>>({});
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [scheduledPostData, setScheduledPostData] = useState<any>(null);

  // Listen for profile selection changes
  useEffect(() => {
    const handleProfileChanged = (event: any) => {
      setSelectedProfileId(event.detail.profileId);
    };

    window.addEventListener('profileChanged', handleProfileChanged);
    return () => window.removeEventListener('profileChanged', handleProfileChanged);
  }, []);

  const handlePostCreated = (newPost: Post) => {
    // The FeedContent component will handle adding the new post
    // We could use a context or callback here if needed
    window.dispatchEvent(new CustomEvent('postCreated', { detail: { post: newPost } }));
  };

  const handleOpenComments = (post: Post) => {
    setSelectedPostForComments(post);
  };

  const handleCloseComments = () => {
    setSelectedPostForComments(null);
  };

  const handleOpenScheduledPost = (postData: any) => {
    setScheduledPostData(postData);
    setShowPostModal(true);
  };

  const handleClosePostModal = () => {
    setShowPostModal(false);
    setScheduledPostData(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/30 dark:from-gray-950 dark:via-purple-950/20 dark:to-blue-950/20">
      <div className="h-full w-full">
        {/* Mobile Profile Selector - Only visible on small/medium screens */}
        <div className="lg:hidden sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-purple-200/50 dark:border-purple-800/50 p-3 shadow-lg">
          <ProfilesSidebar />
        </div>

        {/* 3-Column Layout with mobile responsiveness */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 p-2 sm:p-4 lg:p-6 h-full">
          {/* Left Sidebar - Profiles (Hidden on small screens, shown on large) */}
          <aside className="hidden lg:block lg:col-span-3">
            <ProfilesSidebar />
          </aside>

          {/* Middle - Feed Content (Full width on mobile, 6 cols on large) */}
          <main className="lg:col-span-6 w-full">
            <FeedContent
              onOpenCreatePost={() => setShowPostModal(true)}
              onOpenComments={handleOpenComments}
              currentImageIndexes={currentImageIndexes}
              setCurrentImageIndexes={setCurrentImageIndexes}
            />
          </main>

          {/* Right Sidebar - Search & Events (Hidden on small/medium, shown on large) */}
          <aside className="hidden lg:block lg:col-span-3">
            <SearchAndEvents 
              selectedProfileId={selectedProfileId}
              onOpenScheduledPost={handleOpenScheduledPost}
            />
          </aside>
        </div>
      </div>

      {/* Modals */}
      <CreatePostModal
        isOpen={showPostModal}
        onClose={handleClosePostModal}
        onPostCreated={handlePostCreated}
        profileId={selectedProfileId}
        scheduledData={scheduledPostData}
      />

      <CommentsModal
        isOpen={!!selectedPostForComments}
        post={selectedPostForComments}
        onClose={handleCloseComments}
        currentImageIndexes={currentImageIndexes}
        setCurrentImageIndexes={setCurrentImageIndexes}
        selectedProfileId={selectedProfileId}
      />
    </div>
  );
}
