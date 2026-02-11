import { useEffect, useRef, useState } from 'react';
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
  delay = 2000,
  enabled = true,
}: UseAutoSaveOptions<T>) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const debouncedData = useDebounce(data, delay);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip first render to avoid saving initial values
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!enabled) return;

    const save = async () => {
      setIsSaving(true);
      setError(null);

      try {
        await onSave(debouncedData);
        setLastSaved(new Date());
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsSaving(false);
      }
    };

    save();
  }, [debouncedData, enabled, onSave]);

  return {
    isSaving,
    lastSaved,
    error,
  };
}
