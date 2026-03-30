'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

interface GifThumbnailProps {
  src: string;
  alt: string;
  className?: string;
  onError?: () => void;
  /** Controlled from outside — true = play, false = freeze */
  playing?: boolean;
  /** When false, skip loading the GIF entirely (for lazy/viewport gating) */
  inView?: boolean;
  /** When false, GIF animation is paused even if playing=true (for off-screen cards) */
  visibleNow?: boolean;
}

/**
 * GIF thumbnail with optimised rendering:
 * - A hidden loader <img> downloads the GIF and captures frame 1 to canvas.
 * - When paused → canvas shows the frozen first frame (no GIF decode cost).
 * - When playing AND visible → a second <img> is mounted to animate.
 * - Off-screen cards show canvas only (no animation decode).
 * - If canvas capture fails (CORS), falls back to showing the GIF directly as thumbnail.
 */
export function GifThumbnail({
  src,
  alt,
  className = '',
  onError,
  playing = false,
  inView = true,
  visibleNow = true,
}: GifThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasFailed, setCanvasFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    setCanvasReady(false);
    setCanvasFailed(false);
    setImgLoaded(false);
  }, [src]);

  const drawToCanvas = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const container = canvas.parentElement;
    const cw = container?.offsetWidth || img.naturalWidth;
    const ch = container?.offsetHeight || img.naturalHeight;
    if (!cw || !ch) return;
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setCanvasFailed(true); return; }
    try {
      const { naturalWidth: iw, naturalHeight: ih } = img;
      if (!iw || !ih) { setCanvasFailed(true); return; }
      const scale = Math.max(cw / iw, ch / ih);
      const sw = iw * scale;
      const sh = ih * scale;
      ctx.drawImage(img, (cw - sw) / 2, (ch - sh) / 2, sw, sh);
      setCanvasReady(true);
    } catch {
      // cross-origin taint — canvas won't work, fall through to img fallback
      setCanvasFailed(true);
    }
  }, []);

  const handleLoad = useCallback(() => {
    setImgLoaded(true);
    drawToCanvas();
  }, [drawToCanvas]);

  // Don't load anything until the card enters the viewport region
  if (!inView) {
    return (
      <div className={`relative w-full h-full overflow-hidden ${className}`}>
        <div className="absolute inset-0 bg-zinc-800/50 animate-pulse" />
      </div>
    );
  }

  // Should we mount the animated playback <img>?
  const shouldAnimate = playing && visibleNow;

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Hidden loader — downloads the GIF once, captures first frame to canvas */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={onError}
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
      />

      {/* Canvas: frozen first frame — visible when paused or off-screen */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full transition-opacity duration-150 ${
          canvasReady && !shouldAnimate ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Animated GIF — only mounted when playing AND card is visible on screen */}
      {shouldAnimate && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="eager"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* CORS fallback: if canvas failed, show the GIF as a static-ish thumbnail when paused */}
      {canvasFailed && !shouldAnimate && imgLoaded && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Loading placeholder until canvas or image is ready */}
      {!canvasReady && !canvasFailed && !imgLoaded && (
        <div className="absolute inset-0 bg-zinc-800/50 animate-pulse" />
      )}
    </div>
  );
}
