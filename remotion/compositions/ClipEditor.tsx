import React from "react";
import { z } from "zod";
import {
  AbsoluteFill,
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
  VideoClip,
  Transition,
  Overlay,
  TransitionType,
} from "@/lib/gif-maker/types";

// ─── Schema ──────────────────────────────────────────

const VideoClipSchema = z.object({
  id: z.string(),
  src: z.string(),
  name: z.string(),
  durationInFrames: z.number(),
  trimStartFrame: z.number(),
  trimEndFrame: z.number(),
  startFrame: z.number(),
  volume: z.number(),
});

const TransitionSchema = z.object({
  id: z.string(),
  type: z.enum(["none", "fade", "slide-left", "slide-right", "wipe", "crossfade"]),
  durationInFrames: z.number(),
  clipAId: z.string(),
  clipBId: z.string(),
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
    animation: z.enum(["none", "fade-in", "slide-up", "typewriter", "scale-in"]),
    animationDurationFrames: z.number(),
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
  clips: z.array(VideoClipSchema),
  transitions: z.array(TransitionSchema),
  overlays: z.array(OverlaySchema),
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

// ─── Clip Renderer ───────────────────────────────────

const ClipWithTransition: React.FC<{
  clip: VideoClip;
  transitionIn?: Transition;
  transitionOut?: Transition;
}> = ({ clip, transitionIn, transitionOut }) => {
  const frame = useCurrentFrame();
  const clipDuration = clip.trimEndFrame - clip.trimStartFrame;

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

  return (
    <AbsoluteFill
      style={{
        ...inStyle,
        ...outStyle,
      }}
    >
      {clip.src ? (
        <Video
          src={clip.src}
          startFrom={clip.trimStartFrame}
          volume={clip.volume}
          crossOrigin="anonymous"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      ) : (
        <AbsoluteFill
          style={{
            backgroundColor: "#1a1a2e",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div style={{ color: "#fff", fontSize: 24, fontFamily: "system-ui" }}>
            No video source
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ─── Overlay Renderer ────────────────────────────────

const OverlayRenderer: React.FC<{
  overlay: Overlay;
  clips: VideoClip[];
}> = ({ overlay, clips }) => {
  switch (overlay.type) {
    case "text":
      return <TextOverlayRenderer overlay={overlay} />;
    case "blur":
      return <BlurOverlayRenderer overlay={overlay} clips={clips} />;
    case "sticker":
      return <StickerOverlayRenderer overlay={overlay} />;
    case "shape":
      return <ShapeOverlayRenderer overlay={overlay} />;
    default:
      return null;
  }
};

// ─── Main Composition ────────────────────────────────

export const ClipEditor: React.FC<ClipEditorProps> = ({
  clips,
  transitions,
  overlays,
}) => {
  if (clips.length === 0 && overlays.length === 0) {
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

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Render clips as sequences */}
      {clips.map((clip) => {
        const clipDuration = clip.trimEndFrame - clip.trimStartFrame;
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
            />
          </Sequence>
        );
      })}

      {/* Render overlays as sequences */}
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
