'use client';

import ContentStudioLayout from '@/components/social-media/ContentStudioLayout';
import CalendarView from '@/components/social-media/CalendarView';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';

export default function CalendarPage() {
  const { profileId } = useInstagramProfile();

  return (
    <ContentStudioLayout
      title="Calendar View"
      description="Plan and schedule your content on a calendar"
    >
      <CalendarView profileId={profileId} />
    </ContentStudioLayout>
  );
}
