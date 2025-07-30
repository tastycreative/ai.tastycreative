'use client';

import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';

export function ZustandExample() {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, theme, toggleSidebar, setTheme } = useUIStore();

  return (
    <div className="p-6 max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md space-y-4">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Zustand State Example</h2>
      
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Auth State:</h3>
        {user ? (
          <div>
            <p className="text-gray-700 dark:text-gray-300">Welcome, {user.name}!</p>
            <p className="text-gray-600 dark:text-gray-400">Email: {user.email}</p>
            <button
              onClick={logout}
              className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">Not logged in</p>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">UI State:</h3>
        <p className="text-gray-700 dark:text-gray-300">Sidebar: {sidebarOpen ? 'Open' : 'Closed'}</p>
        <p className="text-gray-700 dark:text-gray-300">Theme: {theme}</p>
        
        <div className="space-x-2 mt-2">
          <button
            onClick={toggleSidebar}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Toggle Sidebar
          </button>
          
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>
      </div>
    </div>
  );
}