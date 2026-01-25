export default function OfModelsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="h-9 w-40 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-2"></div>
          <div className="h-5 w-72 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
        </div>

        {/* Actions Bar Skeleton */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex gap-3 flex-1">
              <div className="h-10 flex-1 max-w-md bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse"></div>
              <div className="h-10 w-36 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse"></div>
            </div>
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          {/* Table Header */}
          <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
            <div className="flex gap-4">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ml-auto"></div>
            </div>
          </div>

          {/* Table Rows */}
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 last:border-0"
            >
              <div className="flex items-center gap-4">
                {/* Avatar and Name */}
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                  <div>
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1"></div>
                    <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </div>
                </div>

                {/* Social Links */}
                <div className="flex gap-2 w-24">
                  <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>

                {/* Status */}
                <div className="w-20">
                  <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                </div>

                {/* Launch Date */}
                <div className="w-24">
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>

                {/* Created */}
                <div className="w-24">
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
