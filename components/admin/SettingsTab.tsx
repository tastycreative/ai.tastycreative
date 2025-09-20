'use client';

export default function SettingsTab() {
  return (
    <div className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900/30 dark:to-gray-800/20 border border-gray-200/50 dark:border-gray-700/30 rounded-xl p-6 shadow-lg backdrop-blur-sm">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Settings</h3>
      <div className="space-y-6">
        {/* System Settings */}
        <div>
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">System Configuration</h4>
          <div className="bg-gray-50/50 dark:bg-gray-800/20 border border-gray-200/50 dark:border-gray-700/30 rounded-lg p-4">
            <p className="text-gray-600 dark:text-gray-300 text-center py-8">
              System settings management coming soon...
              <br />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Configure application settings, API limits, and system preferences
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}