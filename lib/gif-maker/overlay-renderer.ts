"use client";

import type {
  Overlay,
  TextOverlay,
  TextAnimation,
  StickerOverlay,
  ShapeOverlay,
  BlurOverlay,
} from "./types";

// ─── Animation Helpers (canvas equivalents of Remotion interpolate/spring) ───

/** Clamp-extrapolated linear interpolation. */
function interpolate(
  value: number,
  inputRange: [number, number],
  outputRange: [number, number]
): number {
  const [inMin, inMax] = inputRange;
  const [outMin, outMax] = outputRange;
  const t = Math.max(0, Math.min(1, (value - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}

/** Simple spring physics simulation matching Remotion's spring() output. */
function springValue(
  frame: number,
  fps: number,
  config: { damping: number; stiffness: number; mass?: number }
): number {
  const { damping, stiffness, mass = 1 } = config;
  const omega = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const t = frame / fps;

  if (zeta < 1) {
    // Under-damped
    const omegaD = omega * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * omega * t) * (Math.cos(omegaD * t) + (zeta * omega / omegaD) * Math.sin(omegaD * t));
  }
  // Critically/over-damped
  return 1 - (1 + omega * t) * Math.exp(-omega * t);
}

interface AnimationTransform {
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
  blur: number;
  glowSize: number;
}

function getCanvasAnimation(
  animation: TextAnimation,
  relativeFrame: number,
  fps: number,
  durationFrames: number
): AnimationTransform {
  const result: AnimationTransform = {
    opacity: 1, translateX: 0, translateY: 0, scale: 1, blur: 0, glowSize: 0,
  };

  switch (animation) {
    case "fade-in":
      result.opacity = interpolate(relativeFrame, [0, durationFrames], [0, 1]);
      break;
    case "slide-up":
      result.translateY = interpolate(relativeFrame, [0, durationFrames], [30, 0]);
      result.opacity = interpolate(relativeFrame, [0, durationFrames * 0.5], [0, 1]);
      break;
    case "slide-down":
      result.translateY = interpolate(relativeFrame, [0, durationFrames], [-30, 0]);
      result.opacity = interpolate(relativeFrame, [0, durationFrames * 0.5], [0, 1]);
      break;
    case "slide-left":
      result.translateX = interpolate(relativeFrame, [0, durationFrames], [30, 0]);
      result.opacity = interpolate(relativeFrame, [0, durationFrames * 0.5], [0, 1]);
      break;
    case "slide-right":
      result.translateX = interpolate(relativeFrame, [0, durationFrames], [-30, 0]);
      result.opacity = interpolate(relativeFrame, [0, durationFrames * 0.5], [0, 1]);
      break;
    case "scale-in":
      result.scale = springValue(relativeFrame, fps, { damping: 12, stiffness: 200 });
      break;
    case "bounce": {
      result.scale = springValue(relativeFrame, fps, { damping: 8, stiffness: 300, mass: 0.5 });
      result.translateY = interpolate(
        relativeFrame,
        [0, durationFrames * 0.3],
        [-20, 0]
      );
      break;
    }
    case "blur-in":
      result.blur = interpolate(relativeFrame, [0, durationFrames], [10, 0]);
      result.opacity = interpolate(relativeFrame, [0, durationFrames], [0, 1]);
      break;
    case "glow": {
      const progress = Math.min(relativeFrame / Math.max(1, durationFrames), 1);
      result.opacity = interpolate(progress, [0, 0.3], [0, 1]);
      result.glowSize = interpolate(progress, [0, 0.5], [0, 20]);
      if (progress > 0.5) result.glowSize = interpolate(progress, [0.5, 1], [20, 10]);
      break;
    }
    case "pop":
      result.scale = springValue(relativeFrame, fps, { damping: 6, stiffness: 400, mass: 0.4 });
      break;
    case "typewriter":
    case "none":
    default:
      break;
  }

  return result;
}

/**
 * Render all visible overlays onto a canvas frame.
 * Called during GIF export to composite text, stickers, and shapes
 * that would otherwise be lost (they're DOM-only in the editor).
 */
export function renderOverlaysToCanvas(
  ctx: CanvasRenderingContext2D,
  overlays: Overlay[],
  canvasWidth: number,
  canvasHeight: number,
  currentFrame: number,
  fps: number = 30
): void {
  for (const overlay of overlays) {
    // Skip overlays not visible at this frame
    if (
      currentFrame < overlay.startFrame ||
      currentFrame >= overlay.startFrame + overlay.durationInFrames
    ) {
      continue;
    }

    // Skip blur overlays — handled separately by the blur pipeline
    if (overlay.type === "blur") continue;

    ctx.save();

    switch (overlay.type) {
      case "text":
        renderTextOverlay(ctx, overlay, canvasWidth, canvasHeight, currentFrame, fps);
        break;
      case "sticker":
        renderStickerOverlay(ctx, overlay, canvasWidth, canvasHeight);
        break;
      case "shape":
        renderShapeOverlay(ctx, overlay, canvasWidth, canvasHeight);
        break;
    }

    ctx.restore();
  }
}

// ─── Text Overlay ────────────────────────────────────────────────

function renderTextOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay,
  canvasWidth: number,
  canvasHeight: number,
  currentFrame: number,
  fps: number
): void {
  const x = (overlay.x / 100) * canvasWidth;
  const y = (overlay.y / 100) * canvasHeight;
  const w = (overlay.width / 100) * canvasWidth;
  const h = (overlay.height / 100) * canvasHeight;

  // Scale fontSize relative to canvas size (overlays are designed for ~1200px wide)
  const fontScale = canvasWidth / 1200;
  const fontSize = overlay.fontSize * fontScale;

  const textTransform = overlay.textTransform ?? "none";
  const textOpacity = overlay.opacity ?? 1;
  const strokeWidth = overlay.strokeWidth ?? 0;
  const strokeColor = overlay.strokeColor ?? "#000000";
  const lineHeightVal = overlay.lineHeight ?? 1.3;
  const backgroundOpacity = overlay.backgroundOpacity ?? 0;
  const borderRadius = overlay.borderRadius ?? 4;
  const rotation = overlay.rotation ?? 0;
  const fontStyleVal = overlay.fontStyle ?? "normal";

  // Shadow
  const shadowOffsetX = overlay.shadowOffsetX ?? 0;
  const shadowOffsetY = overlay.shadowOffsetY ?? 0;
  const shadowBlurVal = overlay.shadowBlur ?? 0;
  const shadowColor = overlay.shadowColor ?? "rgba(0,0,0,0.5)";

  // Gradient — text and background independent
  const useGradient = overlay.useGradient ?? false;
  const textGradEnabled = useGradient && (overlay.textGradientEnabled ?? false);
  const bgGradEnabled = useGradient && (overlay.bgGradientEnabled ?? false);
  const textGradColors = overlay.textGradientColors ?? ["#00D4FF", "#0077FF"];
  const textGradAngle = overlay.textGradientAngle ?? 180;
  const bgGradColors = overlay.bgGradientColors ?? ["#FF6B35", "#FFD700"];
  const bgGradAngle = overlay.bgGradientAngle ?? 180;

  // ── Animation ──
  const relativeFrame = currentFrame - overlay.startFrame;
  const animDuration = overlay.animationDurationFrames || 30;
  const anim = getCanvasAnimation(overlay.animation, relativeFrame, fps, animDuration);

  // Resolve display text (typewriter animation)
  let displayText = overlay.text;
  if (overlay.animation === "typewriter") {
    const progress = Math.min(relativeFrame / Math.max(1, animDuration), 1);
    const charCount = Math.floor(progress * overlay.text.length);
    displayText = overlay.text.slice(0, charCount);
  }

  if (!displayText) return;

  // Apply text transform
  if (textTransform === "uppercase") displayText = displayText.toUpperCase();
  else if (textTransform === "lowercase") displayText = displayText.toLowerCase();

  // Combine base opacity with animation opacity
  ctx.globalAlpha = textOpacity * anim.opacity;

  // If animation makes it fully transparent, skip rendering
  if (ctx.globalAlpha <= 0) return;

  // Apply blur-in via canvas filter
  if (anim.blur > 0) {
    ctx.filter = `blur(${anim.blur * fontScale}px)`;
  }

  // Apply rotation + animation transforms around overlay center
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  const hasRotation = rotation !== 0;
  const hasAnimTransform = anim.scale !== 1 || anim.translateX !== 0 || anim.translateY !== 0;

  if (hasRotation || hasAnimTransform) {
    ctx.translate(centerX, centerY);
    if (anim.scale !== 1) ctx.scale(anim.scale, anim.scale);
    if (hasRotation) ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
    if (anim.translateX !== 0 || anim.translateY !== 0) {
      ctx.translate(anim.translateX * fontScale, anim.translateY * fontScale);
    }
  }

  // Font setup
  const fontWeight = overlay.fontWeight >= 700 ? "bold" : "normal";
  const italic = fontStyleVal === "italic" ? "italic " : "";
  ctx.font = `${italic}${fontWeight} ${fontSize}px ${overlay.fontFamily}, Impact, sans-serif`;
  ctx.textBaseline = "top";

  // Text alignment
  let textAlignX: number;
  if (overlay.textAlign === "left") {
    ctx.textAlign = "left";
    textAlignX = x + 12 * fontScale; // padding
  } else if (overlay.textAlign === "right") {
    ctx.textAlign = "right";
    textAlignX = x + w - 12 * fontScale;
  } else {
    ctx.textAlign = "center";
    textAlignX = x + w / 2;
  }

  // Word wrap
  const maxTextWidth = w - 24 * fontScale; // padding on both sides
  const lines = wrapText(ctx, displayText, maxTextWidth);
  const lineHeight = fontSize * lineHeightVal;
  const totalTextHeight = lines.length * lineHeight;

  // Vertically center text within the overlay box
  const textStartY = y + (h - totalTextHeight) / 2;

  // Draw background — gradient background or solid color
  if (bgGradEnabled && bgGradColors.length >= 2) {
    ctx.save();
    ctx.globalAlpha = textOpacity;
    const bgGrad = createAngledGradient(ctx, bgGradAngle, x, y, w, h);
    bgGrad.addColorStop(0, bgGradColors[0]);
    bgGrad.addColorStop(1, bgGradColors[1]);
    ctx.fillStyle = bgGrad;
    roundRect(ctx, x, y, w, h, borderRadius * fontScale);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = textOpacity;
  } else if (backgroundOpacity > 0 && overlay.backgroundColor && overlay.backgroundColor !== "transparent") {
    ctx.save();
    ctx.globalAlpha = textOpacity * backgroundOpacity;
    ctx.fillStyle = overlay.backgroundColor;
    roundRect(ctx, x, y, w, h, borderRadius * fontScale);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = textOpacity;
  }

  // Set shadow (combine with glow animation if active)
  if (shadowOffsetX !== 0 || shadowOffsetY !== 0 || shadowBlurVal !== 0) {
    ctx.shadowOffsetX = shadowOffsetX * fontScale;
    ctx.shadowOffsetY = shadowOffsetY * fontScale;
    ctx.shadowBlur = shadowBlurVal * fontScale;
    ctx.shadowColor = shadowColor;
  }
  if (anim.glowSize > 0) {
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = anim.glowSize * fontScale;
    ctx.shadowColor = overlay.color;
  }

  // Draw each line
  for (let i = 0; i < lines.length; i++) {
    const lineY = textStartY + i * lineHeight;
    const line = lines[i];

    // Stroke first (behind fill) — drawn without shadow to avoid double shadow
    if (strokeWidth > 0) {
      ctx.save();
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth * fontScale * 2; // CSS stroke is half inside, half outside
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeText(line, textAlignX, lineY);
      ctx.restore();
      // Re-apply shadow for fill
      if (shadowOffsetX !== 0 || shadowOffsetY !== 0 || shadowBlurVal !== 0) {
        ctx.shadowOffsetX = shadowOffsetX * fontScale;
        ctx.shadowOffsetY = shadowOffsetY * fontScale;
        ctx.shadowBlur = shadowBlurVal * fontScale;
        ctx.shadowColor = shadowColor;
      }
    }

    // Fill with gradient text or solid color
    if (textGradEnabled && textGradColors.length >= 2) {
      const grad = createAngledGradient(
        ctx,
        textGradAngle,
        textAlignX - maxTextWidth / 2,
        lineY,
        maxTextWidth,
        lineHeight
      );
      grad.addColorStop(0, textGradColors[0]);
      grad.addColorStop(1, textGradColors[1]);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = overlay.color;
    }

    ctx.fillText(line, textAlignX, lineY);
  }

  ctx.globalAlpha = 1;
}

// ─── Sticker/Emoji Overlay ───────────────────────────────────────

// Pre-loaded sticker images for export
const stickerImageCache = new Map<string, HTMLImageElement>();

/**
 * Pre-load all sticker image URLs before export starts.
 * Call this before the frame capture loop.
 */
export async function preloadStickerImages(overlays: Overlay[]): Promise<void> {
  const stickers = overlays.filter(
    (o): o is StickerOverlay => o.type === "sticker" && !o.isEmoji
  );

  const promises = stickers
    .filter((s) => s.src && !stickerImageCache.has(s.src))
    .map(
      (s) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            stickerImageCache.set(s.src, img);
            resolve();
          };
          img.onerror = () => resolve(); // Skip failed loads
          img.src = s.src;
        })
    );

  await Promise.all(promises);
}

function renderStickerOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: StickerOverlay,
  canvasWidth: number,
  canvasHeight: number
): void {
  const x = (overlay.x / 100) * canvasWidth;
  const y = (overlay.y / 100) * canvasHeight;
  const w = (overlay.width / 100) * canvasWidth;
  const h = (overlay.height / 100) * canvasHeight;

  ctx.globalAlpha = overlay.opacity ?? 1;

  // Apply rotation around center
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  if (overlay.rotation) {
    ctx.translate(centerX, centerY);
    ctx.rotate((overlay.rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
  }

  // Apply flip
  if (overlay.flipH || overlay.flipV) {
    ctx.translate(centerX, centerY);
    ctx.scale(overlay.flipH ? -1 : 1, overlay.flipV ? -1 : 1);
    ctx.translate(-centerX, -centerY);
  }

  if (overlay.isEmoji) {
    // Draw emoji as text — use the overlay size to determine font size
    const emojiFontSize = Math.min(w, h) * 0.85;
    ctx.font = `${emojiFontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(overlay.src, centerX, centerY);
  } else {
    // Draw image sticker
    const img = stickerImageCache.get(overlay.src);
    if (img) {
      ctx.drawImage(img, x, y, w, h);
    }
  }

  ctx.globalAlpha = 1;
}

// ─── Shape Overlay ───────────────────────────────────────────────

function renderShapeOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: ShapeOverlay,
  canvasWidth: number,
  canvasHeight: number
): void {
  const x = (overlay.x / 100) * canvasWidth;
  const y = (overlay.y / 100) * canvasHeight;
  const w = (overlay.width / 100) * canvasWidth;
  const h = (overlay.height / 100) * canvasHeight;

  ctx.globalAlpha = overlay.opacity ?? 1;

  // Apply rotation around center
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  if (overlay.rotation) {
    ctx.translate(centerX, centerY);
    ctx.rotate((overlay.rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
  }

  ctx.fillStyle = overlay.fill || "transparent";
  ctx.strokeStyle = overlay.stroke || "transparent";
  ctx.lineWidth = overlay.strokeWidth || 1;

  switch (overlay.shapeType) {
    case "rect":
      if (overlay.fill && overlay.fill !== "transparent") ctx.fillRect(x, y, w, h);
      if (overlay.stroke && overlay.stroke !== "transparent") ctx.strokeRect(x, y, w, h);
      break;
    case "circle":
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, w / 2, h / 2, 0, 0, Math.PI * 2);
      if (overlay.fill && overlay.fill !== "transparent") ctx.fill();
      if (overlay.stroke && overlay.stroke !== "transparent") ctx.stroke();
      break;
    case "line":
      ctx.beginPath();
      ctx.moveTo(x, centerY);
      ctx.lineTo(x + w, centerY);
      ctx.stroke();
      break;
    case "arrow":
      ctx.beginPath();
      ctx.moveTo(x, centerY);
      ctx.lineTo(x + w - 10, centerY);
      ctx.stroke();
      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(x + w, centerY);
      ctx.lineTo(x + w - 12, centerY - 6);
      ctx.lineTo(x + w - 12, centerY + 6);
      ctx.closePath();
      ctx.fillStyle = overlay.stroke || "#ffffff";
      ctx.fill();
      break;
  }

  ctx.globalAlpha = 1;
}

// ─── Utility Functions ───────────────────────────────────────────

/**
 * Word-wrap text to fit within maxWidth using canvas measureText.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (maxWidth <= 0) return [text];

  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    // Handle explicit newlines
    const parts = word.split("\n");
    for (let p = 0; p < parts.length; p++) {
      if (p > 0) {
        lines.push(currentLine);
        currentLine = "";
      }
      const testLine = currentLine ? `${currentLine} ${parts[p]}` : parts[p];
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = parts[p];
      } else {
        currentLine = testLine;
      }
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.length > 0 ? lines : [""];
}

/**
 * Create a linear gradient at an arbitrary angle within a bounding box.
 */
function createAngledGradient(
  ctx: CanvasRenderingContext2D,
  angleDeg: number,
  x: number,
  y: number,
  w: number,
  h: number
): CanvasGradient {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const len = Math.max(w, h) / 2;
  const dx = Math.cos(angleRad) * len;
  const dy = Math.sin(angleRad) * len;
  return ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
}

/**
 * Draw a rounded rectangle path.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
