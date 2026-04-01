import type { Prize, WheelTheme } from './types';

interface WheelRenderOptions {
  ctx: CanvasRenderingContext2D;
  cx: number;
  cy: number;
  outerRadius: number;
  prizes: Prize[];
  theme: WheelTheme;
  rotation?: number;
}

export function renderWheel({
  ctx,
  cx,
  cy,
  outerRadius,
  prizes,
  theme,
  rotation = 0,
}: WheelRenderOptions): void {
  if (!prizes.length) return;

  const rimWidth = outerRadius * 0.085;
  const innerR = outerRadius - rimWidth;
  const n = prizes.length;
  const arc = (Math.PI * 2) / n;

  // Segments
  for (let i = 0; i < n; i++) {
    const a1 = rotation - Math.PI / 2 + i * arc;
    const a2 = a1 + arc;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, innerR, a1, a2);
    ctx.closePath();
    ctx.fillStyle =
      prizes[i].tier === 'bonus'
        ? theme.accent
        : theme.colors[i % theme.colors.length];
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Labels — font calculated once, shadow set once via save/restore
  const labelFontSize = Math.max(8, Math.min(16, 280 / n));
  const labelFont = `bold ${labelFontSize}px "Impact", "Arial Black", sans-serif`;
  for (let i = 0; i < n; i++) {
    const mid = rotation - Math.PI / 2 + i * arc + arc / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(mid);
    ctx.textAlign = 'right';
    ctx.font = labelFont;
    ctx.fillStyle = prizes[i].tier === 'bonus' ? '#111' : '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(prizes[i].label, innerR - 14, labelFontSize / 3);
    ctx.restore();
  }

  // Inner border
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Outer dark rim
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
  ctx.strokeStyle = '#0c0c0c';
  ctx.lineWidth = rimWidth;
  ctx.stroke();

  // Accent borders
  [innerR + 1.5, outerRadius - 1.5].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Bulb lights — use save/restore to batch shadow resets
  const nLights = Math.max(20, Math.round(outerRadius * 0.12));
  const lightR = (innerR + outerRadius) / 2;
  const bulbSize = Math.max(3, outerRadius * 0.018);
  ctx.save();
  ctx.shadowBlur = 8;
  for (let i = 0; i < nLights; i++) {
    const a = (i / nLights) * Math.PI * 2;
    const lx = cx + lightR * Math.cos(a);
    const ly = cy + lightR * Math.sin(a);
    const even = i % 2 === 0;
    ctx.beginPath();
    ctx.arc(lx, ly, bulbSize, 0, Math.PI * 2);
    ctx.fillStyle = even ? theme.accent : '#e8e8e8';
    ctx.shadowColor = even ? theme.accent : 'rgba(255,255,255,0.6)';
    ctx.fill();
  }
  ctx.restore();

  // Hub center
  const hubR = outerRadius * 0.085;
  const hg = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, hubR);
  hg.addColorStop(0, '#444');
  hg.addColorStop(1, '#0f0f0f');
  ctx.beginPath();
  ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${hubR * 0.7}px "Arial", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Spin', cx, cy);

  // Pointer teardrop at top
  ctx.save();
  const tipY = cy - innerR + 2;
  const baseY = cy - outerRadius - outerRadius * 0.04;
  const pWidth = outerRadius * 0.04;
  ctx.beginPath();
  ctx.moveTo(cx, tipY);
  ctx.lineTo(cx - pWidth, baseY);
  ctx.lineTo(cx + pWidth, baseY);
  ctx.closePath();
  ctx.fillStyle = theme.accent;
  ctx.shadowColor = theme.accent;
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
