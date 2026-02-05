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
export type OutputFormat = "gif";

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

export interface VideoClip {
  id: string;
  src: string; // video URL or blob URL
  name: string;
  durationInFrames: number; // original duration in frames
  trimStartFrame: number; // trim start (relative to clip)
  trimEndFrame: number; // trim end (relative to clip)
  startFrame: number; // computed position on timeline
  volume: number; // 0-1
}

export type TransitionType = "none" | "fade" | "slide-left" | "slide-right" | "wipe" | "crossfade";

export interface Transition {
  id: string;
  type: TransitionType;
  durationInFrames: number; // overlap duration between adjacent clips
  clipAId: string; // preceding clip
  clipBId: string; // following clip
}

export type OverlayType = "text" | "blur" | "sticker" | "shape";

export type TextAnimation = "none" | "fade-in" | "slide-up" | "typewriter" | "scale-in";

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

export type TrackType = "video" | "overlay";

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
}

export interface ExportState {
  isExporting: boolean;
  progress: number; // 0-100
  phase: "idle" | "capturing" | "encoding" | "done" | "error";
  message: string;
}
