'use client';

import { useRouter } from 'next/navigation';
import { SubmissionForm } from '@/components/content-submission/SubmissionForm';

export default function NewSubmissionPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          New Content Submission
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Create a new OTP or PTR content submission
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8">
        <SubmissionForm
          onSuccess={(id) => {
            router.push(`/submissions/${id}`);
          }}
          onCancel={() => {
            router.push('/submissions');
          }}
        />
      </div>
    </div>
  );
}
