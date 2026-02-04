// Remotion entry point
export { RemotionRoot } from "./Root";

// Export composition components
export { VideoToGif, VideoToGifSchema } from "./compositions/VideoToGif";
export { ClipEditor, ClipEditorSchema } from "./compositions/ClipEditor";

// Composition IDs for reference
export const COMPOSITION_IDS = {
  VIDEO_TO_GIF: "VideoToGif",
  CLIP_EDITOR: "ClipEditor",
} as const;
