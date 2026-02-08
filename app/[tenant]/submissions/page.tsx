import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default async function SubmissionsPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Content Submissions
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your OTP and PTR content submissions
          </p>
        </div>

        <Link
          href="submissions/new"
          className="inline-flex items-center space-x-2 px-6 py-3 bg-brand-light-pink hover:bg-brand-dark-pink text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>New Submission</span>
        </Link>
      </div>

      {/* Client component for the list will go here */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8">
        <p className="text-center text-gray-500 dark:text-gray-400 py-12">
          Submissions list coming soon...
        </p>
      </div>
    </div>
  );
}
