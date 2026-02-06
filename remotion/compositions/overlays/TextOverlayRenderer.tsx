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
    case "slide-down": {
      const translateY = interpolate(
        frame,
        [0, durationFrames],
        [-30, 0],
        { extrapolateRight: "clamp" }
      );
      const opacity = interpolate(frame, [0, durationFrames * 0.5], [0, 1], {
        extrapolateRight: "clamp",
      });
      return { transform: `translateY(${translateY}px)`, opacity };
    }
    case "slide-left": {
      const translateX = interpolate(
        frame,
        [0, durationFrames],
        [30, 0],
        { extrapolateRight: "clamp" }
      );
      const opacity = interpolate(frame, [0, durationFrames * 0.5], [0, 1], {
        extrapolateRight: "clamp",
      });
      return { transform: `translateX(${translateX}px)`, opacity };
    }
    case "slide-right": {
      const translateX = interpolate(
        frame,
        [0, durationFrames],
        [-30, 0],
        { extrapolateRight: "clamp" }
      );
      const opacity = interpolate(frame, [0, durationFrames * 0.5], [0, 1], {
        extrapolateRight: "clamp",
      });
      return { transform: `translateX(${translateX}px)`, opacity };
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
    case "bounce": {
      const scale = spring({
        frame,
        fps,
        config: { damping: 8, stiffness: 300, mass: 0.5 },
      });
      const translateY = interpolate(
        frame,
        [0, durationFrames * 0.3, durationFrames],
        [-20, 0, 0],
        { extrapolateRight: "clamp" }
      );
      return { transform: `translateY(${translateY}px) scale(${scale})` };
    }
    case "blur-in": {
      const blur = interpolate(frame, [0, durationFrames], [10, 0], {
        extrapolateRight: "clamp",
      });
      const opacity = interpolate(frame, [0, durationFrames], [0, 1], {
        extrapolateRight: "clamp",
      });
      return { filter: `blur(${blur}px)`, opacity };
    }
    case "glow": {
      const progress = Math.min(frame / Math.max(1, durationFrames), 1);
      const glowSize = interpolate(progress, [0, 0.5, 1], [0, 20, 10]);
      const opacity = interpolate(progress, [0, 0.3, 1], [0, 1, 1]);
      return {
        opacity,
        textShadow: `0 0 ${glowSize}px currentColor, 0 0 ${glowSize * 2}px currentColor`,
      };
    }
    case "pop": {
      const scale = spring({
        frame,
        fps,
        config: { damping: 6, stiffness: 400, mass: 0.4 },
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

  // Resolve optional fields with defaults
  const letterSpacing = overlay.letterSpacing ?? 0;
  const lineHeightVal = overlay.lineHeight ?? 1.3;
  const textTransform = overlay.textTransform ?? "none";
  const textOpacity = overlay.opacity ?? 1;
  const borderRadius = overlay.borderRadius ?? 4;
  const backgroundOpacity = overlay.backgroundOpacity ?? 1;
  const strokeWidth = overlay.strokeWidth ?? 0;
  const strokeColor = overlay.strokeColor ?? "#000000";
  const shadowOffsetX = overlay.shadowOffsetX ?? 0;
  const shadowOffsetY = overlay.shadowOffsetY ?? 0;
  const shadowBlurVal = overlay.shadowBlur ?? 0;
  const shadowColor = overlay.shadowColor ?? "rgba(0,0,0,0.5)";

  // Compute background color with separate opacity
  let bgColor = overlay.backgroundColor;
  if (bgColor && bgColor !== "transparent" && backgroundOpacity < 1) {
    if (bgColor.startsWith("#")) {
      const r = parseInt(bgColor.slice(1, 3), 16);
      const g = parseInt(bgColor.slice(3, 5), 16);
      const b = parseInt(bgColor.slice(5, 7), 16);
      bgColor = `rgba(${r},${g},${b},${backgroundOpacity})`;
    } else if (bgColor.startsWith("rgba")) {
      // Replace existing alpha
      bgColor = bgColor.replace(/,[^,)]+\)$/, `,${backgroundOpacity})`);
    }
  } else if (backgroundOpacity === 0) {
    bgColor = "transparent";
  }

  // Build text shadow
  const hasShadow = shadowOffsetX !== 0 || shadowOffsetY !== 0 || shadowBlurVal !== 0;
  let textShadow: string | undefined;
  if (hasShadow) {
    textShadow = `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlurVal}px ${shadowColor}`;
  }

  // Merge glow animation's text-shadow with effect shadow
  const animTextShadow = (animStyle as any).textShadow;
  if (animTextShadow && textShadow) {
    textShadow = `${textShadow}, ${animTextShadow}`;
  } else if (animTextShadow) {
    textShadow = animTextShadow;
  }

  // Remove textShadow from animStyle to avoid double-apply
  const { textShadow: _removed, ...cleanAnimStyle } = animStyle as any;

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
        opacity: textOpacity,
        ...cleanAnimStyle,
      }}
    >
      <div
        style={{
          fontSize: overlay.fontSize,
          fontFamily: overlay.fontFamily,
          fontWeight: overlay.fontWeight,
          color: overlay.color,
          backgroundColor: bgColor,
          textAlign: overlay.textAlign,
          padding: "4px 12px",
          borderRadius,
          lineHeight: lineHeightVal,
          letterSpacing,
          textTransform: textTransform as any,
          wordBreak: "break-word",
          maxWidth: "100%",
          WebkitTextStroke:
            strokeWidth > 0
              ? `${strokeWidth}px ${strokeColor}`
              : undefined,
          textShadow,
        }}
      >
        {displayText}
      </div>
    </div>
  );
};
