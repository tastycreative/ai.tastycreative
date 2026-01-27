'use client';

import { Suspense } from 'react';
import ContentStudioLayout from '@/components/social-media/ContentStudioLayout';
import FeedPostPlannerView from '@/components/social-media/FeedPostPlannerView';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';

function FeedPostsContent({ profileId }: { profileId: string | null }) {
  return <FeedPostPlannerView profileId={profileId} />;
}

export default function FeedPostsPage() {
  const { profileId } = useInstagramProfile();

  return (
    <ContentStudioLayout
      title="Feed Posts"
      description="Plan and manage your Instagram feed posts"
    >
      <Suspense fallback={<div className="flex items-center justify-center p-8">Loading...</div>}>
        <FeedPostsContent profileId={profileId} />
      </Suspense>
    </ContentStudioLayout>
  );
}
