import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import type { TextOverlay, TextAnimation } from "@/lib/gif-maker/types";

interface TextOverlayRendererProps {
  overlay: TextOverlay;
}

function getAnimationStyle(
  animation: TextAnimation,
  frame: number,
  fps: number,
  durationFrames: number
): React.CSSProperties {
  const progress = Math.min(frame / Math.max(1, durationFrames), 1);

  switch (animation) {
    case "fade-in": {
      const opacity = interpolate(frame, [0, durationFrames], [0, 1], {
        extrapolateRight: "clamp",
      });
      return { opacity };
    }
    case "slide-up": {
      const translateY = interpolate(
        frame,
        [0, durationFrames],
        [30, 0],
        { extrapolateRight: "clamp" }
      );
      const opacity = interpolate(frame, [0, durationFrames * 0.5], [0, 1], {
        extrapolateRight: "clamp",
      });
      return { transform: `translateY(${translateY}px)`, opacity };
    }
    case "typewriter": {
      // Handled via text clipping in render
      return {};
    }
    case "scale-in": {
      const scale = spring({
        frame,
        fps,
        config: { damping: 12, stiffness: 200 },
      });
      return { transform: `scale(${scale})` };
    }
    case "none":
    default:
      return {};
  }
}

export const TextOverlayRenderer: React.FC<TextOverlayRendererProps> = ({
  overlay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const animStyle = getAnimationStyle(
    overlay.animation,
    frame,
    fps,
    overlay.animationDurationFrames
  );

  // For typewriter effect, progressively reveal characters
  let displayText = overlay.text;
  if (overlay.animation === "typewriter") {
    const progress = Math.min(
      frame / Math.max(1, overlay.animationDurationFrames),
      1
    );
    const charCount = Math.floor(progress * overlay.text.length);
    displayText = overlay.text.slice(0, charCount);
  }

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
        justifyContent:
          overlay.textAlign === "left"
            ? "flex-start"
            : overlay.textAlign === "right"
              ? "flex-end"
              : "center",
        ...animStyle,
      }}
    >
      <div
        style={{
          fontSize: overlay.fontSize,
          fontFamily: overlay.fontFamily,
          fontWeight: overlay.fontWeight,
          color: overlay.color,
          backgroundColor: overlay.backgroundColor,
          textAlign: overlay.textAlign,
          padding: "4px 12px",
          borderRadius: 4,
          lineHeight: 1.3,
          wordBreak: "break-word",
          maxWidth: "100%",
        }}
      >
        {displayText}
      </div>
    </div>
  );
};
