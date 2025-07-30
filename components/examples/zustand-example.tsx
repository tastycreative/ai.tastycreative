'use client';

import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';

export function ZustandExample() {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, theme, toggleSidebar, setTheme } = useUIStore();

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-md space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">Zustand State Example</h2>
      
      <div>
        <h3 className="text-lg font-semibold">Auth State:</h3>
        {user ? (
          <div>
            <p>Welcome, {user.name}!</p>
            <p>Email: {user.email}</p>
            <button
              onClick={logout}
              className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        ) : (
          <p>Not logged in</p>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold">UI State:</h3>
        <p>Sidebar: {sidebarOpen ? 'Open' : 'Closed'}</p>
        <p>Theme: {theme}</p>
        
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
            className="px-3 py-2 border border-gray-300 rounded"
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