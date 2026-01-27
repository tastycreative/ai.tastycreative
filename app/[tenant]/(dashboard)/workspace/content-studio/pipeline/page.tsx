'use client';

import ContentStudioLayout from '@/components/social-media/ContentStudioLayout';
import ContentPipelineView from '@/components/social-media/ContentPipelineView';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';

export default function PipelinePage() {
  const { profileId } = useInstagramProfile();

  return (
    <ContentStudioLayout
      title="Content Pipeline"
      description="Manage your content workflow from idea to publication"
    >
      <ContentPipelineView profileId={profileId} />
    </ContentStudioLayout>
  );
}
