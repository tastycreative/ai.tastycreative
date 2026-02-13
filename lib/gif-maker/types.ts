import { z } from "zod";

// Preview types
export type PreviewType = "video-to-gif" | "clip-editor";

// Platform presets
export type PlatformPreset =
  | "of-standard"
  | "ig-post"
  | "ig-story"
  | "twitter"
  | "custom";

export const PLATFORM_DIMENSIONS: Record<
  Exclude<PlatformPreset, "custom">,
  { width: number; height: number; label: string }
> = {
  "of-standard": { width: 1200, height: 1600, label: "OnlyFans (3:4)" },
  "ig-post": { width: 1080, height: 1350, label: "Instagram Post (4:5)" },
  "ig-story": { width: 1080, height: 1920, label: "Instagram Story (9:16)" },
  twitter: { width: 1200, height: 675, label: "Twitter (16:9)" },
};

// Blur region interface (percentage-based coordinates)
export interface BlurRegion {
  id: string;
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  width: number; // 0-100 percentage
  height: number; // 0-100 percentage
}

// Output format options
export type OutputFormat = "gif" | "png" | "jpg";

// Render request schema
export const RenderRequestSchema = z.object({
  compositionId: z.string(),
  outputFormat: z.enum(["gif"]),
  props: z.record(z.unknown()),
  width: z.number().optional(),
  height: z.number().optional(),
  fps: z.number().optional(),
  durationInFrames: z.number().optional(),
});

export type RenderRequest = z.infer<typeof RenderRequestSchema>;

// Render response
export interface RenderResponse {
  success: boolean;
  url?: string;
  error?: string;
  jobId?: string;
}

// ─── Video Editor Types ─────────────────────────────────────────────

// Position for clips in collage slots (percentage-based)
export interface ClipPosition {
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  width: number; // 0-100 percentage
  height: number; // 0-100 percentage
}

// ─── Collage Layout System ──────────────────────────────────────────

export type CollageLayout =
  | "split-h-50"
  | "split-v-50"
  | "split-h-70-30"
  | "split-h-30-70"
  | "3-col"
  | "1-top-2-bottom"
  | "2-left-1-right"
  | "grid-2x2"
  | "pip-top-left"
  | "pip-top-right"
  | "pip-bottom-left"
  | "pip-bottom-right";

export interface CollagePreset {
  label: string;
  category: "split" | "grid" | "pip";
  slotCount: number;
  slots: ClipPosition[];
}

export const COLLAGE_PRESETS: Record<CollageLayout, CollagePreset> = {
  // 2-slot splits
  "split-h-50": {
    label: "Split H 50/50",
    category: "split",
    slotCount: 2,
    slots: [
      { x: 0, y: 0, width: 50, height: 100 },
      { x: 50, y: 0, width: 50, height: 100 },
    ],
  },
  "split-v-50": {
    label: "Split V 50/50",
    category: "split",
    slotCount: 2,
    slots: [
      { x: 0, y: 0, width: 100, height: 50 },
      { x: 0, y: 50, width: 100, height: 50 },
    ],
  },
  "split-h-70-30": {
    label: "Split H 70/30",
    category: "split",
    slotCount: 2,
    slots: [
      { x: 0, y: 0, width: 70, height: 100 },
      { x: 70, y: 0, width: 30, height: 100 },
    ],
  },
  "split-h-30-70": {
    label: "Split H 30/70",
    category: "split",
    slotCount: 2,
    slots: [
      { x: 0, y: 0, width: 30, height: 100 },
      { x: 30, y: 0, width: 70, height: 100 },
    ],
  },

  // 3-slot layouts
  "3-col": {
    label: "3 Columns",
    category: "grid",
    slotCount: 3,
    slots: [
      { x: 0, y: 0, width: 33.33, height: 100 },
      { x: 33.33, y: 0, width: 33.34, height: 100 },
      { x: 66.67, y: 0, width: 33.33, height: 100 },
    ],
  },
  "1-top-2-bottom": {
    label: "1 Top, 2 Bottom",
    category: "grid",
    slotCount: 3,
    slots: [
      { x: 0, y: 0, width: 100, height: 50 },
      { x: 0, y: 50, width: 50, height: 50 },
      { x: 50, y: 50, width: 50, height: 50 },
    ],
  },
  "2-left-1-right": {
    label: "2 Left, 1 Right",
    category: "grid",
    slotCount: 3,
    slots: [
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 0, y: 50, width: 50, height: 50 },
      { x: 50, y: 0, width: 50, height: 100 },
    ],
  },

  // 4-slot grid
  "grid-2x2": {
    label: "Grid 2x2",
    category: "grid",
    slotCount: 4,
    slots: [
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 50, y: 0, width: 50, height: 50 },
      { x: 0, y: 50, width: 50, height: 50 },
      { x: 50, y: 50, width: 50, height: 50 },
    ],
  },

  // PiP (2-slot, slot 0 = full, slot 1 = small)
  "pip-top-left": {
    label: "PiP Top Left",
    category: "pip",
    slotCount: 2,
    slots: [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 3, y: 3, width: 30, height: 30 },
    ],
  },
  "pip-top-right": {
    label: "PiP Top Right",
    category: "pip",
    slotCount: 2,
    slots: [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 67, y: 3, width: 30, height: 30 },
    ],
  },
  "pip-bottom-left": {
    label: "PiP Bottom Left",
    category: "pip",
    slotCount: 2,
    slots: [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 3, y: 67, width: 30, height: 30 },
    ],
  },
  "pip-bottom-right": {
    label: "PiP Bottom Right",
    category: "pip",
    slotCount: 2,
    slots: [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 67, y: 67, width: 30, height: 30 },
    ],
  },
};

export interface ClipEffects {
  brightness?: number; // 0-200, default 100
  contrast?: number; // 0-200, default 100
  saturation?: number; // 0-200, default 100
  blur?: number; // 0-20, default 0
  grayscale?: number; // 0-100, default 0
  sepia?: number; // 0-100, default 0
  hue?: number; // 0-360, default 0
  vignette?: number; // 0-100, default 0
}

export interface VideoClip {
  type: "video";
  id: string;
  src: string; // video URL or blob URL
  name: string;
  durationInFrames: number; // original duration in frames
  trimStartFrame: number; // trim start (relative to clip)
  trimEndFrame: number; // trim end (relative to clip)
  startFrame: number; // computed position on timeline
  volume: number; // 0-1
  slotIndex?: number; // which collage slot (0-based). undefined = slot 0
  effects?: ClipEffects; // visual effects
}

export interface ImageClip {
  type: "image";
  id: string;
  src: string; // image URL or blob URL
  name: string;
  displayDurationInFrames: number; // how long to show the image
  startFrame: number; // computed position on timeline
  objectFit: "contain" | "cover";
  slotIndex?: number; // which collage slot (0-based). undefined = slot 0
  effects?: ClipEffects; // visual effects
}

export type Clip = VideoClip | ImageClip;

export type TransitionType = "none" | "fade" | "slide-left" | "slide-right" | "wipe" | "crossfade";

export interface Transition {
  id: string;
  type: TransitionType;
  durationInFrames: number; // overlap duration between adjacent clips
  clipAId: string; // preceding clip
  clipBId: string; // following clip
}

export type OverlayType = "text" | "blur" | "sticker" | "shape";

export type TextAnimation =
  | "none"
  | "fade-in"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "typewriter"
  | "scale-in"
  | "bounce"
  | "blur-in"
  | "glow"
  | "pop";

export type StickerAnimation = "none" | "bounce" | "spin" | "pulse" | "wobble" | "float";

export interface OverlayBase {
  id: string;
  type: OverlayType;
  startFrame: number;
  durationInFrames: number;
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  width: number; // 0-100 percentage
  height: number; // 0-100 percentage
  trackId: string;
}

export interface TextOverlay extends OverlayBase {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  backgroundColor: string;
  textAlign: "left" | "center" | "right";
  animation: TextAnimation;
  animationDurationFrames: number;
  letterSpacing?: number;
  lineHeight?: number;
  textTransform?: "none" | "uppercase" | "lowercase";
  opacity?: number;
  borderRadius?: number;
  backgroundOpacity?: number;
  strokeWidth?: number;
  strokeColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowBlur?: number;
  shadowColor?: string;
}

export type BlurMode = "gaussian" | "pixelate" | "solid" | "heavy";
export type BlurShape = "rectangle" | "ellipse" | "rounded-rect";

export interface BlurOverlay extends OverlayBase {
  type: "blur";
  intensity: number; // blur px (gaussian/heavy) or pixel size (pixelate)
  blurMode: BlurMode;
  shape: BlurShape;
  rotation: number; // degrees
  feather: number; // 0-50 px soft edge
  borderRadius: number; // 0-50% for rounded-rect
  fillColor: string; // color for solid mode
}

export interface StickerOverlay extends OverlayBase {
  type: "sticker";
  src: string; // image URL or emoji
  isEmoji: boolean;
  rotation: number; // degrees
  opacity: number; // 0-1
  animation?: StickerAnimation;
  animationDurationFrames?: number;
  flipH?: boolean;
  flipV?: boolean;
}

export type ShapeType = "rect" | "circle" | "line" | "arrow";

export interface ShapeOverlay extends OverlayBase {
  type: "shape";
  shapeType: ShapeType;
  fill: string;
  stroke: string;
  strokeWidth: number;
  rotation: number;
  opacity: number;
}

export type Overlay = TextOverlay | BlurOverlay | StickerOverlay | ShapeOverlay;

export type TrackType = "video" | "slot" | "overlay";

export interface Track {
  id: string;
  type: TrackType;
  label: string;
  locked: boolean;
  visible: boolean;
}

export interface EditorSettings {
  platform: PlatformPreset;
  width: number;
  height: number;
  fps: number;
  timelineZoom: number; // pixels per frame
  snapEnabled: boolean;
  snapThresholdFrames: number;
  activeCollageLayout: CollageLayout | null; // null = no layout (single full-screen)
}

export interface ExportState {
  isExporting: boolean;
  progress: number; // 0-100
  phase: "idle" | "capturing" | "encoding" | "done" | "error";
  message: string;
}
