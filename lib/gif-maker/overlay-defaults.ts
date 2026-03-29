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
    x: 5,
    y: 55,
    width: 90,
    height: 30,
    text: "YOUR TEXT HERE",
    fontSize: 56,
    fontFamily: "Impact",
    fontWeight: 400,
    color: "#ffffff",
    backgroundColor: "transparent",
    textAlign: "center",
    animation: "none",
    animationDurationFrames: 15,
    letterSpacing: 1,
    lineHeight: 1.2,
    textTransform: "uppercase",
    opacity: 1,
    borderRadius: 0,
    backgroundOpacity: 0,
    strokeWidth: 3,
    strokeColor: "#000000",
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    shadowBlur: 4,
    shadowColor: "rgba(0,0,0,0.8)",
    useGradient: false,
    gradientColors: ["#FF6B35", "#FFD700"],
    gradientAngle: 180,
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

export function createDefaultPaintBlurOverlay(
  partial: Partial<BlurOverlay> & { trackId: string }
): BlurOverlay {
  return createDefaultBlurOverlay({
    ...partial,
    shape: "paint",
    brushSize: 3,
    paintPath: [],
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
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
    animation: "none",
    animationDurationFrames: 30,
    flipH: false,
    flipV: false,
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
