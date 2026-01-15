'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ContentStudioLayout from '@/components/social-media/ContentStudioLayout';
import StoriesPlannerView from '@/components/social-media/StoriesPlannerView';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';

function StoriesContent() {
  const searchParams = useSearchParams();
  const dateFromUrl = searchParams.get('date');
  const { profileId } = useInstagramProfile();

  return (
    <ContentStudioLayout
      title="Stories Planner"
      description="Plan and schedule your Instagram stories"
    >
      <StoriesPlannerView profileId={profileId} />
    </ContentStudioLayout>
  );
}

export default function StoriesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <StoriesContent />
    </Suspense>
  );
}
