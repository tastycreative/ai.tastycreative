'use client';

import { Suspense } from 'react';
import ContentStudioLayout from '@/components/social-media/ContentStudioLayout';
import ReelsPlannerView from '@/components/social-media/ReelsPlannerView';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';

function ReelsContent({ profileId }: { profileId: string | null }) {
  return <ReelsPlannerView profileId={profileId} />;
}

export default function ReelsPage() {
  const { profileId } = useInstagramProfile();

  return (
    <ContentStudioLayout
      title="Reels Planner"
      description="Plan and create engaging Instagram Reels"
    >
      <Suspense fallback={<div className="flex items-center justify-center p-8">Loading...</div>}>
        <ReelsContent profileId={profileId} />
      </Suspense>
    </ContentStudioLayout>
  );
}
