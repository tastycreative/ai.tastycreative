'use client';

import ContentStudioLayout from '@/components/social-media/ContentStudioLayout';
import FeedPostPlannerView from '@/components/social-media/FeedPostPlannerView';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';

export default function FeedPostsPage() {
  const { profileId } = useInstagramProfile();

  return (
    <ContentStudioLayout
      title="Feed Posts"
      description="Plan and manage your Instagram feed posts"
    >
      <FeedPostPlannerView profileId={profileId} />
    </ContentStudioLayout>
  );
}
