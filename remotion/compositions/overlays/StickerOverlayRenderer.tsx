import React from "react";
import { Img } from "remotion";
import type { StickerOverlay } from "@/lib/gif-maker/types";

interface StickerOverlayRendererProps {
  overlay: StickerOverlay;
}

export const StickerOverlayRenderer: React.FC<StickerOverlayRendererProps> = ({
  overlay,
}) => {
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
        transform: `rotate(${overlay.rotation}deg)`,
        opacity: overlay.opacity,
      }}
    >
      {overlay.isEmoji ? (
        <span
          style={{
            fontSize: "min(100%, 80px)",
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
  );
};
