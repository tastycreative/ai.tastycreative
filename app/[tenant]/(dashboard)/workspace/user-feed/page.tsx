'use client';

import React, { useState, useEffect } from 'react';
import ProfileOverview from '@/components/social-media/ProfileOverview';
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

  // Listen for open create post event from ProfileOverview
  useEffect(() => {
    const handleOpenCreatePost = () => {
      setShowPostModal(true);
    };

    window.addEventListener('openCreatePost', handleOpenCreatePost);
    return () => window.removeEventListener('openCreatePost', handleOpenCreatePost);
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
    <div className="min-h-screen bg-background">
      <div className="h-full w-full">
        {/* 3-Column Layout with mobile responsiveness */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 p-2 sm:p-4 lg:p-6 h-full">
          {/* Left Sidebar - Profile Overview (Hidden on small screens, shown on large) */}
          <aside className="hidden lg:block lg:col-span-3">
            <ProfileOverview />
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
