'use client';

import { useWheelCreatorStore } from '@/stores/wheel-creator-store';
import { THEMES } from '@/lib/wheel-creator/constants';
import type { ThemeKey } from '@/lib/wheel-creator/types';

export function WheelCreatorHeader() {
  const themeKey = useWheelCreatorStore((s) => s.themeKey);
  const setThemeKey = useWheelCreatorStore((s) => s.setThemeKey);
  const theme = THEMES[themeKey];

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900/80 border-b border-gray-800 shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-xl">🎡</span>
        <h1 className="text-lg font-bold tracking-wider text-white" style={{ fontFamily: "'Impact', 'Arial Black', sans-serif" }}>
          SPIN THE WHEEL CREATOR
        </h1>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider"
          style={{
            background: `${theme.accent}20`,
            color: theme.accent,
            border: `1px solid ${theme.accent}40`,
          }}
        >
          TASTYY.AI
        </span>
      </div>
      <div className="flex gap-1.5">
        {(Object.entries(THEMES) as [ThemeKey, typeof theme][]).map(([key, t]) => (
          <button
            key={key}
            onClick={() => setThemeKey(key)}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer"
            style={{
              background: themeKey === key ? t.accent : '#141420',
              color: themeKey === key ? '#000' : '#666',
              border: `1px solid ${themeKey === key ? t.accent : '#252540'}`,
            }}
          >
            {t.displayName}
          </button>
        ))}
      </div>
    </div>
  );
}
