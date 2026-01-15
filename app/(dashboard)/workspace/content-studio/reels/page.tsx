'use client';

import ContentStudioLayout from '@/components/social-media/ContentStudioLayout';
import ReelsPlannerView from '@/components/social-media/ReelsPlannerView';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';

export default function ReelsPage() {
  const { profileId } = useInstagramProfile();

  return (
    <ContentStudioLayout
      title="Reels Planner"
      description="Plan and create engaging Instagram Reels"
    >
      <ReelsPlannerView profileId={profileId} />
    </ContentStudioLayout>
  );
}
