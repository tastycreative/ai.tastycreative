'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ContentStudioLayout from '@/components/social-media/ContentStudioLayout';
import InstagramStagingTool from '@/components/social-media/InstagramStagingTool';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';

function StagingContent() {
  const searchParams = useSearchParams();
  const postIdFromUrl = searchParams.get('post');
  const { profileId } = useInstagramProfile();

  return (
    <ContentStudioLayout
      title="Instagram Staging"
      description="Stage and manage your Instagram posts"
    >
      <InstagramStagingTool highlightPostId={postIdFromUrl} profileId={profileId} />
    </ContentStudioLayout>
  );
}

export default function StagingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <StagingContent />
    </Suspense>
  );
}
