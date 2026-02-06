import React from "react";
import { Img, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import type { StickerOverlay, StickerAnimation } from "@/lib/gif-maker/types";

interface StickerOverlayRendererProps {
  overlay: StickerOverlay;
}

function getStickerAnimationStyle(
  animation: StickerAnimation,
  frame: number,
  fps: number,
  durationFrames: number
): React.CSSProperties {
  switch (animation) {
    case "bounce": {
      const t = (frame % durationFrames) / durationFrames;
      const bounce = Math.abs(Math.sin(t * Math.PI)) * 10;
      return { transform: `translateY(${-bounce}px)` };
    }
    case "spin": {
      const rotation = interpolate(
        frame % durationFrames,
        [0, durationFrames],
        [0, 360]
      );
      return { transform: `rotate(${rotation}deg)` };
    }
    case "pulse": {
      const t = (frame % durationFrames) / durationFrames;
      const scale = 1 + 0.15 * Math.sin(t * Math.PI * 2);
      return { transform: `scale(${scale})` };
    }
    case "wobble": {
      const t = (frame % durationFrames) / durationFrames;
      const rot = 5 * Math.sin(t * Math.PI * 2);
      return { transform: `rotate(${rot}deg)` };
    }
    case "float": {
      const t = (frame % durationFrames) / durationFrames;
      const y = 6 * Math.sin(t * Math.PI * 2);
      return { transform: `translateY(${y}px)` };
    }
    case "none":
    default:
      return {};
  }
}

export const StickerOverlayRenderer: React.FC<StickerOverlayRendererProps> = ({
  overlay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { width: compWidth, height: compHeight } = useVideoConfig();

  const animation = overlay.animation ?? "none";
  const animDuration = overlay.animationDurationFrames ?? 30;
  const flipH = overlay.flipH ?? false;
  const flipV = overlay.flipV ?? false;

  // Compute actual pixel size of the overlay box so emoji fills it
  const boxW = (overlay.width / 100) * compWidth;
  const boxH = (overlay.height / 100) * compHeight;
  const emojiSize = Math.min(boxW, boxH) * 0.85;

  const animStyle = getStickerAnimationStyle(animation, frame, fps, animDuration);

  // Build transform combining rotation, flip, and animation
  const flipTransform = [
    flipH ? "scaleX(-1)" : "",
    flipV ? "scaleY(-1)" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const baseTransform = `rotate(${overlay.rotation}deg) ${flipTransform}`.trim();

  // Animation transform is applied to the inner content
  const animTransform = animStyle.transform ?? "";

  return (
    <div
      style={{
        position: "absolute",
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        width: `${overlay.width}%`,
        height: `${overlay.height}%`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: baseTransform,
        opacity: overlay.opacity,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          transform: animTransform,
        }}
      >
        {overlay.isEmoji ? (
          <span
            style={{
              fontSize: emojiSize,
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            {overlay.src}
          </span>
        ) : (
          <Img
            src={overlay.src}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
          />
        )}
      </div>
    </div>
  );
};
