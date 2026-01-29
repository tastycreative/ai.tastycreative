'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';

export default function AccessDenied() {
  const params = useParams();
  const tenant = params.tenant as string;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-6 p-8">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-6">
            <ShieldAlert className="w-16 h-16 text-red-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-lg text-gray-600">
            You don't have permission to access this page.
          </p>
        </div>

        <div className="pt-4">
          <Link
            href={`/${tenant}/dashboard`}
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
