import { create } from "zustand";
import type {
  VideoClip,
  ImageClip,
  Clip,
  CollageLayout,
  Transition,
  Overlay,
  Track,
  EditorSettings,
  ExportState,
  TransitionType,
  PlatformPreset,
} from "@/lib/gif-maker/types";
import { PLATFORM_DIMENSIONS, COLLAGE_PRESETS } from "@/lib/gif-maker/types";
import {
  computeClipStartFrames,
  computeTotalDuration,
} from "@/lib/gif-maker/timeline-utils";

interface VideoEditorState {
  // Data
  clips: Clip[];
  transitions: Transition[];
  overlays: Overlay[];
  tracks: Track[];

  // Playback
  isPlaying: boolean;
  currentFrame: number;
  fps: number;
  totalDurationInFrames: number;

  // Selection
  selectedClipId: string | null;
  selectedOverlayId: string | null;

  // Settings
  settings: EditorSettings;

  // Export
  exportState: ExportState;

  // ─── Clip Actions ──────────────────
  addClip: (clip: Omit<VideoClip, "startFrame"> | Omit<ImageClip, "startFrame">) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<VideoClip> | Partial<ImageClip>) => void;
  reorderClips: (fromIndex: number, toIndex: number) => void;

  // ─── Transition Actions ────────────
  setTransition: (
    clipAId: string,
    clipBId: string,
    type: TransitionType,
    durationInFrames: number
  ) => void;
  removeTransition: (transitionId: string) => void;

  // ─── Overlay Actions ───────────────
  addOverlay: (overlay: Overlay) => void;
  removeOverlay: (overlayId: string) => void;
  updateOverlay: (overlayId: string, updates: Partial<Overlay>) => void;

  // ─── Track Actions ─────────────────
  addTrack: (track: Track) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;

  // ─── Collage Actions ────────────────
  setCollageLayout: (layout: CollageLayout | null) => void;
  moveClipToSlot: (clipId: string, slotIndex: number) => void;
  getEffectiveTracks: () => Track[];

  // ─── Playback Actions ──────────────
  setPlaying: (playing: boolean) => void;
  setCurrentFrame: (frame: number) => void;
  togglePlayback: () => void;

  // ─── Selection Actions ─────────────
  selectClip: (clipId: string | null) => void;
  selectOverlay: (overlayId: string | null) => void;
  clearSelection: () => void;

  // ─── Settings Actions ──────────────
  setPlatform: (platform: PlatformPreset) => void;
  setTimelineZoom: (zoom: number) => void;
  setSnapEnabled: (enabled: boolean) => void;
  updateSettings: (updates: Partial<EditorSettings>) => void;

  // ─── Export Actions ────────────────
  setExportState: (updates: Partial<ExportState>) => void;

  // ─── Timeline Recalculation ────────
  recalculateTimeline: () => void;
}

const DEFAULT_SETTINGS: EditorSettings = {
  platform: "of-standard",
  width: 1200,
  height: 1600,
  fps: 30,
  timelineZoom: 2,
  snapEnabled: true,
  snapThresholdFrames: 5,
  activeCollageLayout: null,
};

const DEFAULT_EXPORT_STATE: ExportState = {
  isExporting: false,
  progress: 0,
  phase: "idle",
  message: "",
};

let clipCounter = 0;
function generateClipId(): string {
  return `clip-${Date.now()}-${++clipCounter}`;
}

let transitionCounter = 0;
function generateTransitionId(): string {
  return `trans-${Date.now()}-${++transitionCounter}`;
}

let trackCounter = 0;
function generateTrackId(): string {
  return `track-${Date.now()}-${++trackCounter}`;
}

export const useVideoEditorStore = create<VideoEditorState>()((set, get) => ({
  // Initial state
  clips: [],
  transitions: [],
  overlays: [],
  tracks: [
    {
      id: "track-video",
      type: "video",
      label: "Video",
      locked: false,
      visible: true,
    },
    {
      id: "track-overlay-1",
      type: "overlay",
      label: "Overlay 1",
      locked: false,
      visible: true,
    },
  ],
  isPlaying: false,
  currentFrame: 0,
  fps: 30,
  totalDurationInFrames: 1,
  selectedClipId: null,
  selectedOverlayId: null,
  settings: DEFAULT_SETTINGS,
  exportState: DEFAULT_EXPORT_STATE,

  // ─── Clip Actions ──────────────────

  addClip: (clip) => {
    const id = clip.id || generateClipId();
    const slotIndex = clip.slotIndex ?? 0;
    const newClip: Clip = clip.type === "image"
      ? { ...clip, id, startFrame: 0, slotIndex } as ImageClip
      : { ...clip, type: "video" as const, id, startFrame: 0, slotIndex } as VideoClip;
    set((state) => ({
      clips: [...state.clips, newClip],
    }));
    get().recalculateTimeline();
  },

  removeClip: (clipId) => {
    set((state) => ({
      clips: state.clips.filter((c) => c.id !== clipId),
      transitions: state.transitions.filter(
        (t) => t.clipAId !== clipId && t.clipBId !== clipId
      ),
      selectedClipId:
        state.selectedClipId === clipId ? null : state.selectedClipId,
    }));
    get().recalculateTimeline();
  },

  updateClip: (clipId, updates) => {
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId ? ({ ...c, ...updates } as Clip) : c
      ),
    }));
    get().recalculateTimeline();
  },

  reorderClips: (fromIndex, toIndex) => {
    set((state) => {
      const newClips = [...state.clips];
      const [moved] = newClips.splice(fromIndex, 1);
      newClips.splice(toIndex, 0, moved);
      return { clips: newClips };
    });
    get().recalculateTimeline();
  },

  // ─── Transition Actions ────────────

  setTransition: (clipAId, clipBId, type, durationInFrames) => {
    set((state) => {
      const existing = state.transitions.find(
        (t) => t.clipAId === clipAId && t.clipBId === clipBId
      );
      if (existing) {
        return {
          transitions: state.transitions.map((t) =>
            t.id === existing.id ? { ...t, type, durationInFrames } : t
          ),
        };
      }
      return {
        transitions: [
          ...state.transitions,
          {
            id: generateTransitionId(),
            type,
            durationInFrames,
            clipAId,
            clipBId,
          },
        ],
      };
    });
    get().recalculateTimeline();
  },

  removeTransition: (transitionId) => {
    set((state) => ({
      transitions: state.transitions.filter((t) => t.id !== transitionId),
    }));
    get().recalculateTimeline();
  },

  // ─── Overlay Actions ───────────────

  addOverlay: (overlay) => {
    set((state) => ({ overlays: [...state.overlays, overlay] }));
  },

  removeOverlay: (overlayId) => {
    set((state) => ({
      overlays: state.overlays.filter((o) => o.id !== overlayId),
      selectedOverlayId:
        state.selectedOverlayId === overlayId
          ? null
          : state.selectedOverlayId,
    }));
  },

  updateOverlay: (overlayId, updates) => {
    set((state) => ({
      overlays: state.overlays.map((o) =>
        o.id === overlayId ? ({ ...o, ...updates } as Overlay) : o
      ),
    }));
  },

  // ─── Track Actions ─────────────────

  addTrack: (track) => {
    set((state) => ({
      tracks: [
        ...state.tracks,
        { ...track, id: track.id || generateTrackId() },
      ],
    }));
  },

  removeTrack: (trackId) => {
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== trackId),
      overlays: state.overlays.filter((o) => o.trackId !== trackId),
    }));
  },

  updateTrack: (trackId, updates) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, ...updates } : t
      ),
    }));
  },

  // ─── Collage Actions ────────────────

  setCollageLayout: (layout) => {
    set((state) => ({
      settings: { ...state.settings, activeCollageLayout: layout },
    }));
    // When switching to null (no layout), move all clips to slot 0
    if (layout === null) {
      set((state) => ({
        clips: state.clips.map((c) => ({ ...c, slotIndex: 0 }) as Clip),
      }));
    }
    get().recalculateTimeline();
  },

  moveClipToSlot: (clipId, slotIndex) => {
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId ? { ...c, slotIndex } as Clip : c
      ),
    }));
    get().recalculateTimeline();
  },

  // Cached effective tracks — only recomputed when layout or tracks change
  _cachedEffectiveTracks: null as Track[] | null,
  _cachedEffectiveTracksKey: "" as string,

  getEffectiveTracks: () => {
    const { settings, tracks } = get();
    const cacheKey = `${settings.activeCollageLayout ?? "none"}:${tracks.map((t) => t.id).join(",")}`;
    const state = get() as VideoEditorState & { _cachedEffectiveTracks: Track[] | null; _cachedEffectiveTracksKey: string };
    if (state._cachedEffectiveTracks && state._cachedEffectiveTracksKey === cacheKey) {
      return state._cachedEffectiveTracks;
    }
    let result: Track[];
    if (settings.activeCollageLayout) {
      const preset = COLLAGE_PRESETS[settings.activeCollageLayout];
      const slotTracks: Track[] = preset.slots.map((_, i) => ({
        id: `slot-${i}`,
        type: "slot" as const,
        label: `Slot ${i + 1}`,
        locked: false,
        visible: true,
      }));
      const overlayTracks = tracks.filter((t) => t.type === "overlay");
      result = [...slotTracks, ...overlayTracks];
    } else {
      result = tracks;
    }
    // Store in cache without triggering re-render (mutate directly)
    state._cachedEffectiveTracks = result;
    state._cachedEffectiveTracksKey = cacheKey;
    return result;
  },

  // ─── Playback Actions ──────────────

  setPlaying: (playing) => set({ isPlaying: playing }),

  setCurrentFrame: (frame) => set({ currentFrame: frame }),

  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),

  // ─── Selection Actions ─────────────

  selectClip: (clipId) =>
    set({ selectedClipId: clipId, selectedOverlayId: null }),

  selectOverlay: (overlayId) =>
    set({ selectedOverlayId: overlayId, selectedClipId: null }),

  clearSelection: () =>
    set({ selectedClipId: null, selectedOverlayId: null }),

  // ─── Settings Actions ──────────────

  setPlatform: (platform) => {
    if (platform === "custom") {
      set((state) => ({
        settings: { ...state.settings, platform },
      }));
      return;
    }
    const dims = PLATFORM_DIMENSIONS[platform];
    set((state) => ({
      settings: {
        ...state.settings,
        platform,
        width: dims.width,
        height: dims.height,
      },
    }));
  },

  setTimelineZoom: (zoom) => {
    set((state) => ({
      settings: {
        ...state.settings,
        timelineZoom: Math.max(0.5, Math.min(10, zoom)),
      },
    }));
  },

  setSnapEnabled: (enabled) => {
    set((state) => ({
      settings: { ...state.settings, snapEnabled: enabled },
    }));
  },

  updateSettings: (updates) => {
    set((state) => ({
      settings: { ...state.settings, ...updates },
    }));
  },

  // ─── Export Actions ────────────────

  setExportState: (updates) => {
    set((state) => ({
      exportState: { ...state.exportState, ...updates },
    }));
  },

  // ─── Timeline Recalculation ────────

  recalculateTimeline: () => {
    const { clips, transitions } = get();
    const updatedClips = computeClipStartFrames(clips, transitions);
    const total = computeTotalDuration(updatedClips, transitions);
    set({
      clips: updatedClips,
      totalDurationInFrames: Math.max(1, total),
    });
  },
}));
