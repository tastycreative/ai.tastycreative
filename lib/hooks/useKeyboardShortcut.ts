import { useEffect, useCallback } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

export function useKeyboardShortcut(
  config: ShortcutConfig,
  callback: () => void,
  enabled: boolean = true
) {
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const { key, ctrl, shift, alt, meta } = config;

      const matches =
        event.key.toLowerCase() === key.toLowerCase() &&
        (ctrl === undefined || event.ctrlKey === ctrl) &&
        (shift === undefined || event.shiftKey === shift) &&
        (alt === undefined || event.altKey === alt) &&
        (meta === undefined || event.metaKey === meta);

      if (matches) {
        event.preventDefault();
        callback();
      }
    },
    [config, callback, enabled]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);
}
