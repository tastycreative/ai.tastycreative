'use client';

import { useRouter, useParams } from 'next/navigation';
import { SubmissionForm } from '@/components/content-submission/SubmissionForm';

export default function NewSubmissionPage() {
  const router = useRouter();
  const params = useParams();
  const tenant = params.tenant as string;

  return (
    <SubmissionForm
      onSuccess={(id) => {
        // Redirect to submissions list page (detail page not yet implemented)
        router.push(`/${tenant}/submissions`);
      }}
      onCancel={() => {
        router.push(`/${tenant}/submissions`);
      }}
    />
  );
}
