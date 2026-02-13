"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import {
  createHistoryState,
  pushHistory,
  undo as undoHistory,
  redo as redoHistory,
  canUndo as checkCanUndo,
  canRedo as checkCanRedo,
  type HistoryState,
} from "@/lib/gif-maker/history-manager";
import {
  startAutosave,
  stopAutosave,
  saveToLocalStorage,
  loadFromLocalStorage,
  hasAutosave,
  getAutosaveAge,
} from "@/lib/gif-maker/autosave-manager";

interface EditorHistoryState {
  clips: any[];
  overlays: any[];
  transitions: any[];
  settings: any;
}

/**
 * Custom hook for managing undo/redo and autosave in the GIF maker
 */
export function useEditorHistory() {
  const historyRef = useRef<HistoryState<EditorHistoryState> | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null);
  const [hasRestoredAutosave, setHasRestoredAutosave] = useState(false);

  // Get current store state
  const clips = useVideoEditorStore((s) => s.clips);
  const overlays = useVideoEditorStore((s) => s.overlays);
  const transitions = useVideoEditorStore((s) => s.transitions);
  const settings = useVideoEditorStore((s) => s.settings);

  // Initialize history on mount
  useEffect(() => {
    if (!historyRef.current) {
      const initialState: EditorHistoryState = {
        clips,
        overlays,
        transitions,
        settings,
      };
      historyRef.current = createHistoryState(initialState);
    }
  }, [clips, overlays, transitions, settings]);

  // Check for autosave on mount
  useEffect(() => {
    if (!hasRestoredAutosave && hasAutosave()) {
      const age = getAutosaveAge();
      if (age && age < 24 * 60 * 60 * 1000) {
        // Less than 24 hours old
        // Could show a prompt here to restore
        console.log(`Found autosave from ${Math.round(age / 1000 / 60)} minutes ago`);
      }
      setHasRestoredAutosave(true);
    }
  }, [hasRestoredAutosave]);

  // Start autosave on mount
  useEffect(() => {
    const getState = () => ({
      clips: useVideoEditorStore.getState().clips,
      overlays: useVideoEditorStore.getState().overlays,
      transitions: useVideoEditorStore.getState().transitions,
      settings: useVideoEditorStore.getState().settings,
    });

    startAutosave(getState, 30000); // Save every 30 seconds

    return () => {
      stopAutosave();
    };
  }, []);

  // Push to history when state changes
  const pushToHistory = useCallback(() => {
    if (!historyRef.current) return;

    const currentState: EditorHistoryState = {
      clips,
      overlays,
      transitions,
      settings,
    };

    historyRef.current = pushHistory(historyRef.current, currentState);
    setCanUndo(checkCanUndo(historyRef.current));
    setCanRedo(checkCanRedo(historyRef.current));
  }, [clips, overlays, transitions, settings]);

  // Debounced history push
  const debouncedPushRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debouncedPushRef.current) {
      clearTimeout(debouncedPushRef.current);
    }

    debouncedPushRef.current = setTimeout(() => {
      pushToHistory();
    }, 500); // Push to history 500ms after last change

    return () => {
      if (debouncedPushRef.current) {
        clearTimeout(debouncedPushRef.current);
      }
    };
  }, [clips, overlays, transitions, settings]);

  // Undo action
  const undo = useCallback(() => {
    if (!historyRef.current || !checkCanUndo(historyRef.current)) return;

    historyRef.current = undoHistory(historyRef.current);
    const state = historyRef.current.present;

    // Apply state to store
    const store = useVideoEditorStore.getState();
    store.clips.splice(0, store.clips.length, ...state.clips);
    store.overlays.splice(0, store.overlays.length, ...state.overlays);
    store.transitions.splice(0, store.transitions.length, ...state.transitions);
    store.updateSettings(state.settings);
    store.recalculateTimeline();

    setCanUndo(checkCanUndo(historyRef.current));
    setCanRedo(checkCanRedo(historyRef.current));
  }, []);

  // Redo action
  const redo = useCallback(() => {
    if (!historyRef.current || !checkCanRedo(historyRef.current)) return;

    historyRef.current = redoHistory(historyRef.current);
    const state = historyRef.current.present;

    // Apply state to store
    const store = useVideoEditorStore.getState();
    store.clips.splice(0, store.clips.length, ...state.clips);
    store.overlays.splice(0, store.overlays.length, ...state.overlays);
    store.transitions.splice(0, store.transitions.length, ...state.transitions);
    store.updateSettings(state.settings);
    store.recalculateTimeline();

    setCanUndo(checkCanUndo(historyRef.current));
    setCanRedo(checkCanRedo(historyRef.current));
  }, []);

  // Manual save
  const manualSave = useCallback(() => {
    const currentState = {
      clips,
      overlays,
      transitions,
      settings,
    };

    saveToLocalStorage(currentState);
    setLastSaveTime(Date.now());
  }, [clips, overlays, transitions, settings]);

  // Restore from autosave
  const restoreAutosave = useCallback(() => {
    const savedState = loadFromLocalStorage();
    if (!savedState) return false;

    // Apply state to store
    const store = useVideoEditorStore.getState();
    if (savedState.clips) {
      store.clips.splice(0, store.clips.length, ...savedState.clips);
    }
    if (savedState.overlays) {
      store.overlays.splice(0, store.overlays.length, ...savedState.overlays);
    }
    if (savedState.transitions) {
      store.transitions.splice(0, store.transitions.length, ...savedState.transitions);
    }
    if (savedState.settings) {
      store.updateSettings(savedState.settings);
    }
    store.recalculateTimeline();

    return true;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Ctrl+Z / Cmd+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z: Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }

      // Ctrl+S / Cmd+S: Manual save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        manualSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, manualSave]);

  return {
    undo,
    redo,
    canUndo,
    canRedo,
    manualSave,
    restoreAutosave,
    lastSaveTime,
    hasAutosave: hasAutosave(),
  };
}
