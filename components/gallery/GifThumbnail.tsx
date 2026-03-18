'use client';

import React, { useRef, useState, useEffect } from 'react';

interface GifThumbnailProps {
  src: string;
  alt: string;
  className?: string;
  onError?: () => void;
  /** Controlled from outside — true = play, false = freeze */
  playing?: boolean;
  /** When false, skip loading the GIF entirely (for lazy/viewport gating) */
  inView?: boolean;
}

/**
 * GIF thumbnail: GIF always visible as thumbnail.
 * When paused, a canvas overlay freezes the first frame on top.
 * When canvas is blocked (CORS), the animated GIF shows through — still a
 * valid thumbnail, just animated.
 * When playing, canvas hides and the GIF animates freely.
 */
export function GifThumbnail({ src, alt, className = '', onError, playing = false, inView = true }: GifThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasFailed, setCanvasFailed] = useState(false);

  useEffect(() => {
    setCanvasReady(false);
    setCanvasFailed(false);
  }, [src]);

  function drawToCanvas() {
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
      // cross-origin taint — fall back to showing the GIF directly
      setCanvasFailed(true);
    }
  }

  // Don't load GIF until the card is in the viewport
  if (!inView) {
    return (
      <div className={`relative w-full h-full overflow-hidden ${className}`}>
        <div className="absolute inset-0 bg-zinc-800/50 animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Hidden loader — draws first frame to canvas, never visible */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt=""
        aria-hidden
        loading="lazy"
        onLoad={drawToCanvas}
        onError={onError}
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
      />

      {/* Visible GIF — only mounted when playing OR when canvas failed (CORS) as fallback */}
      {(playing || (canvasReady === false && canvasFailed)) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Canvas: frozen first frame poster, visible when paused */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full ${
          canvasReady && !playing ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
