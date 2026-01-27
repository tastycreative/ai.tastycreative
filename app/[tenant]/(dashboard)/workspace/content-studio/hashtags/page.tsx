'use client';

import ContentStudioLayout from '@/components/social-media/ContentStudioLayout';
import HashtagBankView from '@/components/social-media/HashtagBankView';

export default function HashtagsPage() {
  return (
    <ContentStudioLayout
      title="Hashtag Bank"
      description="Manage and organize your hashtag collections"
    >
      <HashtagBankView />
    </ContentStudioLayout>
  );
}
