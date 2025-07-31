'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/stores/ui-store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, setResolvedTheme } = useUIStore();

  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      
      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.remove('light', 'dark');
        root.classList.add(systemTheme);
        setResolvedTheme(systemTheme);
      } else {
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
        setResolvedTheme(theme);
      }
    };

    // Apply theme on mount and when theme changes
    applyTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [theme, setResolvedTheme]);

  // Set initial resolved theme based on what's already applied
  useEffect(() => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      setResolvedTheme('dark');
    } else if (root.classList.contains('light')) {
      setResolvedTheme('light');
    }
  }, [setResolvedTheme]);

  return <>{children}</>;
}