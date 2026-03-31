import type { Prize, WheelTheme, FlyerLayout } from './types';
import { renderWheel } from './wheel-renderer';
import { FLYER_LAYOUT } from './constants';

interface FlyerRenderOptions {
  canvas: HTMLCanvasElement;
  prizes: Prize[];
  theme: WheelTheme;
  modelPhoto: HTMLImageElement | null;
  modelName: string;
  layout?: FlyerLayout;
}

function fillGradientBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: WheelTheme
): void {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);

  const grd = ctx.createRadialGradient(w * 0.25, h * 0.2, 0, w * 0.5, h * 0.5, w * 0.7);
  grd.addColorStop(0, theme.colors[0] + '80');
  grd.addColorStop(0.5, theme.colors[1] + '40');
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  // Secondary glow
  const grd2 = ctx.createRadialGradient(w * 0.7, h * 0.6, 0, w * 0.7, h * 0.6, w * 0.4);
  grd2.addColorStop(0, theme.colors[2] + '30');
  grd2.addColorStop(1, 'transparent');
  ctx.fillStyle = grd2;
  ctx.fillRect(0, 0, w, h);
}

function drawTitle(
  ctx: CanvasRenderingContext2D,
  theme: WheelTheme,
  layout: FlyerLayout
): void {
  const { x, y } = layout.title;

  ctx.save();
  ctx.font = 'bold 90px "Impact", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 6;
  ctx.strokeText(theme.titleLine1, x, y);

  const grd = ctx.createLinearGradient(x - 200, y, x + 200, y + 80);
  grd.addColorStop(0, theme.accent);
  grd.addColorStop(0.5, '#fff');
  grd.addColorStop(1, theme.accent);
  ctx.fillStyle = grd;
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 12;
  ctx.fillText(theme.titleLine1, x, y);
  ctx.shadowBlur = 0;

  ctx.font = 'italic bold 70px "Georgia", serif';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8;
  ctx.fillText(theme.titleLine2, x, y + 95);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawCTA(
  ctx: CanvasRenderingContext2D,
  theme: WheelTheme,
  layout: FlyerLayout
): void {
  const { x, y, width, height } = layout.cta;

  const grd = ctx.createLinearGradient(x, y, x + width, y + height);
  grd.addColorStop(0, theme.accent);
  grd.addColorStop(1, theme.accent + 'cc');

  const r = 12;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
  ctx.fillStyle = grd;
  ctx.shadowColor = theme.accent;
  ctx.shadowBlur = 20;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#000';
  ctx.font = 'bold 32px "Impact", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SPIN NOW!', x + width / 2, y + height / 2);
}

function drawModelPhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  layout: FlyerLayout
): void {
  const { x, y, width, height } = layout.modelPhoto;

  ctx.save();
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const regionAspect = width / height;
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;

  if (imgAspect > regionAspect) {
    sw = img.naturalHeight * regionAspect;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / regionAspect;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, width, height);

  // Fade right edge
  const fadeGrd = ctx.createLinearGradient(x + width * 0.5, 0, x + width, 0);
  fadeGrd.addColorStop(0, 'transparent');
  fadeGrd.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = fadeGrd;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

export function renderFlyer({
  canvas,
  prizes,
  theme,
  modelPhoto,
  modelName,
  layout = FLYER_LAYOUT,
}: FlyerRenderOptions): void {
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, layout.width, layout.height);

  // Layer 1: Background
  fillGradientBackground(ctx, layout.width, layout.height, theme);

  // Layer 2: Model photo
  if (modelPhoto) {
    drawModelPhoto(ctx, modelPhoto, layout);
  }

  // Layer 3: Wheel
  if (prizes.length >= 2) {
    renderWheel({
      ctx,
      cx: layout.wheel.cx,
      cy: layout.wheel.cy,
      outerRadius: layout.wheel.radius,
      prizes,
      theme,
    });
  }

  // Layer 4: Title
  drawTitle(ctx, theme, layout);

  // Layer 5: CTA
  drawCTA(ctx, theme, layout);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Retry without crossOrigin — canvas will be tainted but image will render
      const fallback = new Image();
      fallback.onload = () => resolve(fallback);
      fallback.onerror = reject;
      fallback.src = src;
    };
    img.src = src;
  });
}

export async function exportFlyerAsPNG(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to export canvas as PNG'));
      },
      'image/png',
      1.0
    );
  });
}
