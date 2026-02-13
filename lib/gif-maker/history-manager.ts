/**
 * History Manager for Undo/Redo functionality
 *
 * Manages a stack of editor states for undo/redo operations
 * with configurable limits and action filtering
 */

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface HistoryConfig {
  limit?: number; // Maximum history entries (default: 50)
  ignoreKeys?: string[]; // State keys to ignore in history
}

const DEFAULT_CONFIG: HistoryConfig = {
  limit: 50,
  ignoreKeys: [
    'isPlaying',
    'currentFrame',
    'exportState',
    // Don't track playback/UI state in history
  ],
};

/**
 * Creates a history-enabled state
 */
export function createHistoryState<T>(initialState: T): HistoryState<T> {
  return {
    past: [],
    present: initialState,
    future: [],
  };
}

/**
 * Filters state to only include relevant keys for history
 */
export function filterStateForHistory<T extends Record<string, any>>(
  state: T,
  config: HistoryConfig = DEFAULT_CONFIG
): Partial<T> {
  const { ignoreKeys = [] } = config;
  const filtered: Partial<T> = {};

  for (const key in state) {
    if (!ignoreKeys.includes(key)) {
      filtered[key] = state[key];
    }
  }

  return filtered;
}

/**
 * Adds a new state to history
 */
export function pushHistory<T>(
  history: HistoryState<T>,
  newState: T,
  config: HistoryConfig = DEFAULT_CONFIG
): HistoryState<T> {
  const { limit = 50 } = config;

  // Check if state actually changed
  if (JSON.stringify(history.present) === JSON.stringify(newState)) {
    return history;
  }

  const newPast = [...history.past, history.present];

  // Limit history size
  if (newPast.length > limit) {
    newPast.shift();
  }

  return {
    past: newPast,
    present: newState,
    future: [], // Clear future when new action is performed
  };
}

/**
 * Undo: Move back in history
 */
export function undo<T>(history: HistoryState<T>): HistoryState<T> {
  if (history.past.length === 0) {
    return history; // Nothing to undo
  }

  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, history.past.length - 1);

  return {
    past: newPast,
    present: previous,
    future: [history.present, ...history.future],
  };
}

/**
 * Redo: Move forward in history
 */
export function redo<T>(history: HistoryState<T>): HistoryState<T> {
  if (history.future.length === 0) {
    return history; // Nothing to redo
  }

  const next = history.future[0];
  const newFuture = history.future.slice(1);

  return {
    past: [...history.past, history.present],
    present: next,
    future: newFuture,
  };
}

/**
 * Check if undo is available
 */
export function canUndo<T>(history: HistoryState<T>): boolean {
  return history.past.length > 0;
}

/**
 * Check if redo is available
 */
export function canRedo<T>(history: HistoryState<T>): boolean {
  return history.future.length > 0;
}

/**
 * Clear all history
 */
export function clearHistory<T>(present: T): HistoryState<T> {
  return {
    past: [],
    present,
    future: [],
  };
}

/**
 * Get history stats
 */
export function getHistoryStats<T>(history: HistoryState<T>) {
  return {
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    undoCount: history.past.length,
    redoCount: history.future.length,
  };
}
