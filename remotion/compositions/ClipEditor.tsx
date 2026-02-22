import React from "react";
import { z } from "zod";
import {
  AbsoluteFill,
  Img,
  Sequence,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { TextOverlayRenderer } from "./overlays/TextOverlayRenderer";
import { BlurOverlayRenderer } from "./overlays/BlurOverlayRenderer";
import { StickerOverlayRenderer } from "./overlays/StickerOverlayRenderer";
import { ShapeOverlayRenderer } from "./overlays/ShapeOverlayRenderer";
import type {
  Clip,
  VideoClip,
  ImageClip,
  ClipPosition,
  CollageLayout,
  Transition,
  Overlay,
  TransitionType,
  OverlayKeyframe,
} from "@/lib/gif-maker/types";
import { COLLAGE_PRESETS } from "@/lib/gif-maker/types";

// ─── Schema ──────────────────────────────────────────

const CollageLayoutSchema = z.enum([
  "split-h-50", "split-v-50", "split-h-70-30", "split-h-30-70",
  "3-col", "1-top-2-bottom", "2-left-1-right",
  "grid-2x2",
  "pip-top-left", "pip-top-right", "pip-bottom-left", "pip-bottom-right",
]).nullable().optional();

const ClipZoomSchema = z.object({
  scale: z.number(),
  x: z.number(),
  y: z.number(),
});

const VideoClipSchema = z.object({
  type: z.literal("video"),
  id: z.string(),
  src: z.string(),
  name: z.string(),
  durationInFrames: z.number(),
  trimStartFrame: z.number(),
  trimEndFrame: z.number(),
  startFrame: z.number(),
  volume: z.number(),
  slotIndex: z.number().optional(),
  speed: z.number().optional(),
  zoom: ClipZoomSchema.optional(),
});

const ImageClipSchema = z.object({
  type: z.literal("image"),
  id: z.string(),
  src: z.string(),
  name: z.string(),
  displayDurationInFrames: z.number(),
  startFrame: z.number(),
  objectFit: z.enum(["contain", "cover"]),
  slotIndex: z.number().optional(),
  speed: z.number().optional(),
  zoom: ClipZoomSchema.optional(),
});

const ClipSchema = z.discriminatedUnion("type", [VideoClipSchema, ImageClipSchema]);

const TransitionSchema = z.object({
  id: z.string(),
  type: z.enum(["none", "fade", "slide-left", "slide-right", "wipe", "crossfade"]),
  durationInFrames: z.number(),
  clipAId: z.string(),
  clipBId: z.string(),
});

const OverlayKeyframeSchema = z.object({
  frame: z.number(),
  x: z.number(),
  y: z.number(),
  opacity: z.number().optional(),
});

const OverlayBaseSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "blur", "sticker", "shape"]),
  startFrame: z.number(),
  durationInFrames: z.number(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  trackId: z.string(),
  keyframes: z.array(OverlayKeyframeSchema).optional(),
});

const OverlaySchema = z.union([
  OverlayBaseSchema.extend({
    type: z.literal("text"),
    text: z.string(),
    fontSize: z.number(),
    fontFamily: z.string(),
    fontWeight: z.number(),
    color: z.string(),
    backgroundColor: z.string(),
    textAlign: z.enum(["left", "center", "right"]),
    animation: z.enum([
      "none", "fade-in", "slide-up", "slide-down", "slide-left", "slide-right",
      "typewriter", "scale-in", "bounce", "blur-in", "glow", "pop",
    ]),
    animationDurationFrames: z.number(),
    letterSpacing: z.number().optional(),
    lineHeight: z.number().optional(),
    textTransform: z.enum(["none", "uppercase", "lowercase"]).optional(),
    opacity: z.number().optional(),
    borderRadius: z.number().optional(),
    backgroundOpacity: z.number().optional(),
    strokeWidth: z.number().optional(),
    strokeColor: z.string().optional(),
    shadowOffsetX: z.number().optional(),
    shadowOffsetY: z.number().optional(),
    shadowBlur: z.number().optional(),
    shadowColor: z.string().optional(),
  }),
  OverlayBaseSchema.extend({
    type: z.literal("blur"),
    intensity: z.number(),
    blurMode: z.enum(["gaussian", "pixelate", "solid", "heavy"]),
    shape: z.enum(["rectangle", "ellipse", "rounded-rect"]),
    rotation: z.number(),
    feather: z.number(),
    borderRadius: z.number(),
    fillColor: z.string(),
  }),
  OverlayBaseSchema.extend({
    type: z.literal("sticker"),
    src: z.string(),
    isEmoji: z.boolean(),
    rotation: z.number(),
    opacity: z.number(),
    animation: z.enum(["none", "bounce", "spin", "pulse", "wobble", "float"]).optional(),
    animationDurationFrames: z.number().optional(),
    flipH: z.boolean().optional(),
    flipV: z.boolean().optional(),
  }),
  OverlayBaseSchema.extend({
    type: z.literal("shape"),
    shapeType: z.enum(["rect", "circle", "line", "arrow"]),
    fill: z.string(),
    stroke: z.string(),
    strokeWidth: z.number(),
    rotation: z.number(),
    opacity: z.number(),
  }),
]);

export const ClipEditorSchema = z.object({
  clips: z.array(ClipSchema),
  transitions: z.array(TransitionSchema),
  overlays: z.array(OverlaySchema),
  activeCollageLayout: CollageLayoutSchema,
});

type ClipEditorProps = z.infer<typeof ClipEditorSchema>;

// ─── Transition Helpers ──────────────────────────────

function getTransitionStyle(
  type: TransitionType,
  progress: number, // 0 to 1, how far into the transition
  isOutgoing: boolean // true = clip A (fading out), false = clip B (fading in)
): React.CSSProperties {
  if (type === "none") return {};

  if (type === "fade" || type === "crossfade") {
    const opacity = isOutgoing
      ? interpolate(progress, [0, 1], [1, 0])
      : interpolate(progress, [0, 1], [0, 1]);
    return { opacity };
  }

  if (type === "slide-left") {
    const translateX = isOutgoing
      ? interpolate(progress, [0, 1], [0, -100])
      : interpolate(progress, [0, 1], [100, 0]);
    return { transform: `translateX(${translateX}%)` };
  }

  if (type === "slide-right") {
    const translateX = isOutgoing
      ? interpolate(progress, [0, 1], [0, 100])
      : interpolate(progress, [0, 1], [-100, 0]);
    return { transform: `translateX(${translateX}%)` };
  }

  if (type === "wipe") {
    if (isOutgoing) {
      const clipRight = interpolate(progress, [0, 1], [100, 0]);
      return { clipPath: `inset(0 ${100 - clipRight}% 0 0)` };
    }
    return {};
  }

  return {};
}

// ─── Keyframe Interpolation ──────────────────────────

function interpolateKeyframes(
  overlay: Overlay,
  absoluteFrame: number
): { x: number; y: number; opacity: number } {
  const keyframes = overlay.keyframes as OverlayKeyframe[] | undefined;
  const baseOpacity = (overlay as { opacity?: number }).opacity ?? 1;

  if (!keyframes || keyframes.length === 0) {
    return { x: overlay.x, y: overlay.y, opacity: baseOpacity };
  }

  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);

  if (absoluteFrame <= sorted[0].frame) {
    const kf = sorted[0];
    return { x: kf.x, y: kf.y, opacity: kf.opacity ?? baseOpacity };
  }

  if (absoluteFrame >= sorted[sorted.length - 1].frame) {
    const kf = sorted[sorted.length - 1];
    return { x: kf.x, y: kf.y, opacity: kf.opacity ?? baseOpacity };
  }

  let prevKf = sorted[0];
  let nextKf = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].frame <= absoluteFrame && absoluteFrame <= sorted[i + 1].frame) {
      prevKf = sorted[i];
      nextKf = sorted[i + 1];
      break;
    }
  }

  const t = (absoluteFrame - prevKf.frame) / (nextKf.frame - prevKf.frame);
  return {
    x: interpolate(t, [0, 1], [prevKf.x, nextKf.x]),
    y: interpolate(t, [0, 1], [prevKf.y, nextKf.y]),
    opacity: interpolate(
      t,
      [0, 1],
      [prevKf.opacity ?? baseOpacity, nextKf.opacity ?? baseOpacity]
    ),
  };
}

// ─── Clip Renderer ───────────────────────────────────

const ClipWithTransition: React.FC<{
  clip: Clip;
  transitionIn?: Transition;
  transitionOut?: Transition;
  inSlot?: boolean;
}> = ({ clip, transitionIn, transitionOut, inSlot }) => {
  const frame = useCurrentFrame();
  const speed = clip.speed ?? 1;
  const rawDuration =
    clip.type === "image"
      ? clip.displayDurationInFrames
      : clip.trimEndFrame - clip.trimStartFrame;
  const clipDuration = Math.max(1, Math.round(rawDuration / speed));

  // Calculate transition progress for incoming transition
  let inStyle: React.CSSProperties = {};
  if (transitionIn && transitionIn.type !== "none") {
    const transFrames = transitionIn.durationInFrames;
    if (frame < transFrames) {
      const progress = frame / transFrames;
      inStyle = getTransitionStyle(transitionIn.type, progress, false);
    }
  }

  // Calculate transition progress for outgoing transition
  let outStyle: React.CSSProperties = {};
  if (transitionOut && transitionOut.type !== "none") {
    const transFrames = transitionOut.durationInFrames;
    const outStart = clipDuration - transFrames;
    if (frame >= outStart) {
      const progress = (frame - outStart) / transFrames;
      outStyle = getTransitionStyle(transitionOut.type, progress, true);
    }
  }

  // Use "cover" when in a collage slot so it fills the area
  const fitMode = inSlot ? "cover" : "contain";

  // Zoom/pan transform
  const zoom = clip.zoom;
  const zoomStyle: React.CSSProperties =
    zoom && zoom.scale > 1
      ? {
          transform: `scale(${zoom.scale}) translate(${zoom.x}%, ${zoom.y}%)`,
          transformOrigin: "center center",
          width: "100%",
          height: "100%",
        }
      : { width: "100%", height: "100%" };

  const renderClipContent = () => {
    if (!clip.src) {
      return (
        <AbsoluteFill
          style={{
            backgroundColor: "#1a1a2e",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div style={{ color: "#fff", fontSize: 24, fontFamily: "system-ui" }}>
            No source
          </div>
        </AbsoluteFill>
      );
    }

    if (clip.type === "image") {
      return (
        <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
          <Img
            src={clip.src}
            style={{
              objectFit: clip.objectFit,
              ...zoomStyle,
            }}
          />
        </div>
      );
    }

    return (
      <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
        <Video
          src={clip.src}
          startFrom={clip.trimStartFrame}
          volume={clip.volume}
          playbackRate={speed}
          crossOrigin="anonymous"
          style={{
            objectFit: fitMode,
            ...zoomStyle,
          }}
        />
      </div>
    );
  };

  return (
    <AbsoluteFill
      style={{
        ...inStyle,
        ...outStyle,
      }}
    >
      {renderClipContent()}
    </AbsoluteFill>
  );
};

// ─── Empty Slot Placeholder ─────────────────────────

const EmptySlotPlaceholder: React.FC<{ index: number }> = ({ index }) => {
  const SLOT_COLORS = ["#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#a855f7"];
  const color = SLOT_COLORS[index % SLOT_COLORS.length];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: `${color}15`,
        border: `2px dashed ${color}40`,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          backgroundColor: `${color}25`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: `${color}90`,
          fontSize: 20,
          fontWeight: 700,
          fontFamily: "system-ui",
        }}
      >
        {index + 1}
      </div>
    </div>
  );
};

// ─── Overlay Renderer ────────────────────────────────

const OverlayRenderer: React.FC<{
  overlay: Overlay;
  clips: Clip[];
}> = ({ overlay, clips }) => {
  const localFrame = useCurrentFrame();
  const absoluteFrame = overlay.startFrame + localFrame;
  const hasKeyframes = overlay.keyframes && overlay.keyframes.length > 0;

  // Apply keyframe interpolation if keyframes are defined
  const effectiveOverlay = hasKeyframes
    ? { ...overlay, ...interpolateKeyframes(overlay, absoluteFrame) }
    : overlay;

  switch (effectiveOverlay.type) {
    case "text":
      return <TextOverlayRenderer overlay={effectiveOverlay as import("@/lib/gif-maker/types").TextOverlay} />;
    case "blur":
      return <BlurOverlayRenderer overlay={effectiveOverlay as import("@/lib/gif-maker/types").BlurOverlay} clips={clips} />;
    case "sticker":
      return <StickerOverlayRenderer overlay={effectiveOverlay as import("@/lib/gif-maker/types").StickerOverlay} />;
    case "shape":
      return <ShapeOverlayRenderer overlay={effectiveOverlay as import("@/lib/gif-maker/types").ShapeOverlay} />;
    default:
      return null;
  }
};

// ─── Helper: group clips by slot ─────────────────────

function groupBySlot(clips: Clip[]): Map<number, Clip[]> {
  const groups = new Map<number, Clip[]>();
  for (const clip of clips) {
    const slot = clip.slotIndex ?? 0;
    const group = groups.get(slot) || [];
    group.push(clip);
    groups.set(slot, group);
  }
  return groups;
}

// ─── Main Composition ────────────────────────────────

export const ClipEditor: React.FC<ClipEditorProps> = ({
  clips,
  transitions,
  overlays,
  activeCollageLayout,
}) => {
  if (clips.length === 0 && overlays.length === 0) {
    // Show empty slot placeholders if a collage layout is active
    if (activeCollageLayout) {
      const preset = COLLAGE_PRESETS[activeCollageLayout];
      return (
        <AbsoluteFill style={{ backgroundColor: "#0f0f1a" }}>
          {preset.slots.map((slotPos, slotIdx) => (
            <div
              key={slotIdx}
              style={{
                position: "absolute",
                left: `${slotPos.x}%`,
                top: `${slotPos.y}%`,
                width: `${slotPos.width}%`,
                height: `${slotPos.height}%`,
                overflow: "hidden",
              }}
            >
              <EmptySlotPlaceholder index={slotIdx} />
            </div>
          ))}
        </AbsoluteFill>
      );
    }

    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#0f0f1a",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            color: "#666",
            fontSize: 28,
            fontFamily: "system-ui",
            textAlign: "center",
          }}
        >
          Add clips to get started
        </div>
      </AbsoluteFill>
    );
  }

  const renderClipSequence = (clip: Clip, inSlot?: boolean) => {
    const speed = clip.speed ?? 1;
    const rawDuration =
      clip.type === "image"
        ? clip.displayDurationInFrames
        : clip.trimEndFrame - clip.trimStartFrame;
    const clipDuration = Math.max(1, Math.round(rawDuration / speed));
    const transitionIn = transitions.find((t) => t.clipBId === clip.id);
    const transitionOut = transitions.find((t) => t.clipAId === clip.id);

    return (
      <Sequence
        key={clip.id}
        from={clip.startFrame}
        durationInFrames={clipDuration}
        layout="none"
      >
        <ClipWithTransition
          clip={clip}
          transitionIn={transitionIn}
          transitionOut={transitionOut}
          inSlot={inSlot}
        />
      </Sequence>
    );
  };

  // Collage layout active — render slots
  if (activeCollageLayout) {
    const preset = COLLAGE_PRESETS[activeCollageLayout];
    const slotGroups = groupBySlot(clips);

    return (
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        {/* Render each collage slot */}
        {preset.slots.map((slotPos, slotIdx) => {
          const slotClips = slotGroups.get(slotIdx) || [];

          return (
            <div
              key={slotIdx}
              style={{
                position: "absolute",
                left: `${slotPos.x}%`,
                top: `${slotPos.y}%`,
                width: `${slotPos.width}%`,
                height: `${slotPos.height}%`,
                overflow: "hidden",
              }}
            >
              {slotClips.length === 0 ? (
                <EmptySlotPlaceholder index={slotIdx} />
              ) : (
                slotClips.map((clip) => renderClipSequence(clip, true))
              )}
            </div>
          );
        })}

        {/* Overlays on top */}
        {overlays.map((overlay) => (
          <Sequence
            key={overlay.id}
            from={overlay.startFrame}
            durationInFrames={overlay.durationInFrames}
            layout="none"
          >
            <OverlayRenderer overlay={overlay} clips={clips} />
          </Sequence>
        ))}
      </AbsoluteFill>
    );
  }

  // No layout — single full-screen mode (all clips sequential in slot 0)
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {clips.map((clip) => renderClipSequence(clip))}

      {/* Overlays on top */}
      {overlays.map((overlay) => (
        <Sequence
          key={overlay.id}
          from={overlay.startFrame}
          durationInFrames={overlay.durationInFrames}
          layout="none"
        >
          <OverlayRenderer overlay={overlay} clips={clips} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
