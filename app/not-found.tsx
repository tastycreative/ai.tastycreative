import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center space-y-6 p-8">
        <div className="space-y-2">
          <h1 className="text-9xl font-bold text-gray-900">404</h1>
          <h2 className="text-3xl font-semibold text-gray-800">Page Not Found</h2>
          <p className="text-lg text-gray-600">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="pt-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
