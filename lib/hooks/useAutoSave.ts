import { useEffect, useRef, useState, useCallback } from 'react';
import { useDebounce } from './useDebounce';

interface UseAutoSaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<void>;
  delay?: number;
  enabled?: boolean;
}

export function useAutoSave<T>({
  data,
  onSave,
  delay = 3000,
  enabled = true,
}: UseAutoSaveOptions<T>) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const debouncedData = useDebounce(data, delay);
  const isFirstRender = useRef(true);
  const lastSavedData = useRef<T | null>(null);
  const onSaveRef = useRef(onSave);
  const isMounted = useRef(true);
  const hasFailedRef = useRef(false);

  // Keep onSave ref updated without triggering effect
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Track mounted state
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Reset failure state when enabled changes (e.g., new ticket selected)
  useEffect(() => {
    hasFailedRef.current = false;
  }, [enabled]);

  useEffect(() => {
    // Skip first render to avoid saving initial values
    if (isFirstRender.current) {
      isFirstRender.current = false;
      lastSavedData.current = debouncedData;
      return;
    }

    if (!enabled) return;

    // Stop auto-saving if a previous save failed (e.g., 404)
    if (hasFailedRef.current) return;

    // Skip if data hasn't actually changed
    if (JSON.stringify(debouncedData) === JSON.stringify(lastSavedData.current)) {
      return;
    }

    const save = async () => {
      if (!isMounted.current) return;
      
      setIsSaving(true);
      setError(null);

      try {
        await onSaveRef.current(debouncedData);
        if (isMounted.current) {
          lastSavedData.current = debouncedData;
          setLastSaved(new Date());
        }
      } catch (err) {
        if (isMounted.current) {
          setError(err as Error);
          // Stop future auto-saves on error (likely 404 or server error)
          hasFailedRef.current = true;
        }
      } finally {
        if (isMounted.current) {
          setIsSaving(false);
        }
      }
    };

    save();
  }, [debouncedData, enabled]);

  // Reset function to clear failure state and retry
  const reset = useCallback(() => {
    hasFailedRef.current = false;
    setError(null);
  }, []);

  return {
    isSaving,
    lastSaved,
    error,
    reset,
  };
}
