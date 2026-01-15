'use client';

import ContentStudioLayout from '@/components/social-media/ContentStudioLayout';
import WorkflowChecklistView from '@/components/social-media/WorkflowChecklistView';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';

export default function WorkflowPage() {
  const { profileId } = useInstagramProfile();

  return (
    <ContentStudioLayout
      title="Workflow Checklist"
      description="Track your content creation workflow"
    >
      <WorkflowChecklistView profileId={profileId} />
    </ContentStudioLayout>
  );
}
