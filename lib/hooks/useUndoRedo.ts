import { useState, useCallback, useRef, useEffect } from 'react';

interface UseUndoRedoOptions<T> {
  maxHistorySize?: number;
  onStateChange?: (state: T) => void;
}

interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useUndoRedo<T>(
  initialState: T,
  options: UseUndoRedoOptions<T> = {}
) {
  const { maxHistorySize = 50, onStateChange } = options;

  const [state, setState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const isUndoingRef = useRef(false);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  // Set a new state
  const set = useCallback(
    (newState: T) => {
      if (isUndoingRef.current) return;

      setState((currentState) => {
        const newPast = [
          ...currentState.past,
          currentState.present,
        ].slice(-maxHistorySize);

        return {
          past: newPast,
          present: newState,
          future: [], // Clear future when new state is set
        };
      });

      if (onStateChange) {
        onStateChange(newState);
      }
    },
    [maxHistorySize, onStateChange]
  );

  // Undo
  const undo = useCallback(() => {
    if (!canUndo) return;

    isUndoingRef.current = true;

    setState((currentState) => {
      const newPast = [...currentState.past];
      const newPresent = newPast.pop()!;

      return {
        past: newPast,
        present: newPresent,
        future: [currentState.present, ...currentState.future],
      };
    });

    setTimeout(() => {
      isUndoingRef.current = false;
    }, 0);
  }, [canUndo]);

  // Redo
  const redo = useCallback(() => {
    if (!canRedo) return;

    isUndoingRef.current = true;

    setState((currentState) => {
      const newFuture = [...currentState.future];
      const newPresent = newFuture.shift()!;

      return {
        past: [...currentState.past, currentState.present],
        present: newPresent,
        future: newFuture,
      };
    });

    setTimeout(() => {
      isUndoingRef.current = false;
    }, 0);
  }, [canRedo]);

  // Reset to initial state
  const reset = useCallback(() => {
    setState({
      past: [],
      present: initialState,
      future: [],
    });
  }, [initialState]);

  // Clear history but keep current state
  const clearHistory = useCallback(() => {
    setState((currentState) => ({
      past: [],
      present: currentState.present,
      future: [],
    }));
  }, []);

  return {
    state: state.present,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    clearHistory,
    historySize: state.past.length,
  };
}
