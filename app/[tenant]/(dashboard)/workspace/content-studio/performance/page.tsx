'use client';

import ContentStudioLayout from '@/components/social-media/ContentStudioLayout';
import PerformanceTrackerView from '@/components/social-media/PerformanceTrackerView';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';

export default function PerformancePage() {
  const { profileId } = useInstagramProfile();

  return (
    <ContentStudioLayout
      title="Performance Tracker"
      description="Track and analyze your content performance"
    >
      <PerformanceTrackerView profileId={profileId} />
    </ContentStudioLayout>
  );
}
