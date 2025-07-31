export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-900/30 shadow-lg rounded-lg p-6 border border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Total Influencers</h3>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">12</p>
        </div>
        <div className="bg-white dark:bg-gray-900/30 shadow-lg rounded-lg p-6 border border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Generated Content</h3>
          <p className="text-3xl font-bold text-emerald-600 dark:text-green-400">48</p>
        </div>
        <div className="bg-white dark:bg-gray-900/30 shadow-lg rounded-lg p-6 border border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Social Posts</h3>
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">156</p>
        </div>
        <div className="bg-white dark:bg-gray-900/30 shadow-lg rounded-lg p-6 border border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Engagement Rate</h3>
          <p className="text-3xl font-bold text-orange-500 dark:text-orange-400">8.4%</p>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-900/30 shadow-lg rounded-lg p-6 border border-gray-200 dark:border-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
        <p className="text-gray-600 dark:text-gray-300">Your recent activities will appear here.</p>
      </div>
    </div>
  );
}
