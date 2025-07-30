'use client';

import { useUIStore } from '@/stores/ui-store';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeDemo() {
  const { theme, resolvedTheme } = useUIStore();

  const getThemeIcon = (themeType: string) => {
    switch (themeType) {
      case 'light':
        return <Sun className="h-5 w-5 text-yellow-500" />;
      case 'dark':
        return <Moon className="h-5 w-5 text-blue-400" />;
      case 'system':
        return <Monitor className="h-5 w-5 text-gray-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md space-y-4">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Theme Demo</h2>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Current Theme</h3>
            <p className="text-gray-600 dark:text-gray-400">User preference</p>
          </div>
          <div className="flex items-center space-x-2">
            {getThemeIcon(theme)}
            <span className="text-gray-700 dark:text-gray-300 capitalize">{theme}</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Resolved Theme</h3>
            <p className="text-gray-600 dark:text-gray-400">Actually applied</p>
          </div>
          <div className="flex items-center space-x-2">
            {getThemeIcon(resolvedTheme)}
            <span className="text-gray-700 dark:text-gray-300 capitalize">{resolvedTheme}</span>
          </div>
        </div>

        <div className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-2">Theme Features:</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• Automatic system theme detection</li>
            <li>• Persistent theme preference</li>
            <li>• Smooth transitions</li>
            <li>• CSS variable based styling</li>
          </ul>
        </div>
      </div>
    </div>
  );
}