import type {
  TextOverlay,
  BlurOverlay,
  StickerOverlay,
  ShapeOverlay,
} from "./types";

let overlayCounter = 0;
export function generateOverlayId(): string {
  return `overlay-${Date.now()}-${++overlayCounter}`;
}

export function createDefaultTextOverlay(
  partial: Partial<TextOverlay> & { trackId: string }
): TextOverlay {
  return {
    id: generateOverlayId(),
    type: "text",
    startFrame: 0,
    durationInFrames: 90,
    x: 10,
    y: 40,
    width: 80,
    height: 20,
    text: "Your text here",
    fontSize: 48,
    fontFamily: "system-ui",
    fontWeight: 700,
    color: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.5)",
    textAlign: "center",
    animation: "fade-in",
    animationDurationFrames: 15,
    ...partial,
  };
}

export function createDefaultBlurOverlay(
  partial: Partial<BlurOverlay> & { trackId: string }
): BlurOverlay {
  return {
    id: generateOverlayId(),
    type: "blur",
    startFrame: 0,
    durationInFrames: 90,
    x: 25,
    y: 25,
    width: 50,
    height: 50,
    intensity: 20,
    blurMode: "gaussian",
    shape: "rectangle",
    rotation: 0,
    feather: 0,
    borderRadius: 0,
    fillColor: "#000000",
    ...partial,
  };
}

export function createDefaultStickerOverlay(
  partial: Partial<StickerOverlay> & { trackId: string }
): StickerOverlay {
  return {
    id: generateOverlayId(),
    type: "sticker",
    startFrame: 0,
    durationInFrames: 90,
    x: 40,
    y: 40,
    width: 20,
    height: 20,
    src: "⭐",
    isEmoji: true,
    rotation: 0,
    opacity: 1,
    ...partial,
  };
}

export function createDefaultShapeOverlay(
  partial: Partial<ShapeOverlay> & { trackId: string }
): ShapeOverlay {
  return {
    id: generateOverlayId(),
    type: "shape",
    startFrame: 0,
    durationInFrames: 90,
    x: 20,
    y: 20,
    width: 30,
    height: 30,
    shapeType: "rect",
    fill: "rgba(255,0,0,0.3)",
    stroke: "#ff0000",
    strokeWidth: 2,
    rotation: 0,
    opacity: 1,
    ...partial,
  };
}
