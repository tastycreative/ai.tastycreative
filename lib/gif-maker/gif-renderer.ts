"use client";

import GIF from "gif.js";
import html2canvas from "html2canvas";

export interface GifRenderOptions {
  width: number;
  height: number;
  fps: number;
  quality?: number; // 1-30, lower is better quality
  workerScript?: string;
}

export interface GifRenderProgress {
  phase: "capturing" | "encoding" | "complete";
  progress: number; // 0-100
  currentFrame?: number;
  totalFrames?: number;
}

/**
 * Render frames to GIF using gif.js (client-side)
 */
export async function renderFramesToGif(
  frames: ImageData[] | HTMLCanvasElement[],
  options: GifRenderOptions,
  onProgress?: (progress: GifRenderProgress) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const workerCount = Math.min(
      4,
      typeof navigator !== "undefined" ? (navigator.hardwareConcurrency || 2) : 2
    );
    const gif = new GIF({
      workers: workerCount,
      quality: options.quality || 10,
      width: options.width,
      height: options.height,
      workerScript: options.workerScript || "/gif.worker.js",
    });

    const frameDelay = Math.round(1000 / options.fps);
    const PROGRESS_BATCH = 5;

    // Add frames
    frames.forEach((frame, index) => {
      if (frame instanceof HTMLCanvasElement) {
        gif.addFrame(frame, { delay: frameDelay, copy: true });
      } else {
        // ImageData - need to create canvas
        const canvas = document.createElement("canvas");
        canvas.width = options.width;
        canvas.height = options.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.putImageData(frame, 0, 0);
          gif.addFrame(canvas, { delay: frameDelay, copy: true });
        }
      }

      const isLastFrame = index === frames.length - 1;
      if (onProgress && (index % PROGRESS_BATCH === 0 || isLastFrame)) {
        onProgress({
          phase: "capturing",
          progress: Math.round(((index + 1) / frames.length) * 50),
          currentFrame: index + 1,
          totalFrames: frames.length,
        });
      }
    });

    gif.on("progress", (p: number) => {
      onProgress?.({
        phase: "encoding",
        progress: 50 + Math.round(p * 50),
      });
    });

    gif.on("finished", (blob: Blob) => {
      onProgress?.({
        phase: "complete",
        progress: 100,
      });
      resolve(blob);
    });

    gif.on("error", (error: Error) => {
      reject(error);
    });

    gif.render();
  });
}

/**
 * Capture frames from a video element
 */
export function captureVideoFrames(
  video: HTMLVideoElement,
  options: {
    fps: number;
    duration: number; // in seconds
    width: number;
    height: number;
  },
  onProgress?: (progress: GifRenderProgress) => void
): Promise<HTMLCanvasElement[]> {
  return new Promise((resolve) => {
    const frames: HTMLCanvasElement[] = [];
    const totalFrames = Math.ceil(options.fps * options.duration);
    const frameInterval = 1000 / options.fps;
    let currentFrame = 0;

    const captureFrame = () => {
      if (currentFrame >= totalFrames) {
        resolve(frames);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = options.width;
      canvas.height = options.height;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(video, 0, 0, options.width, options.height);
        frames.push(canvas);
      }

      currentFrame++;
      onProgress?.({
        phase: "capturing",
        progress: Math.round((currentFrame / totalFrames) * 50),
        currentFrame,
        totalFrames,
      });

      // Seek to next frame time
      const nextTime = (currentFrame * frameInterval) / 1000;
      if (nextTime < video.duration) {
        video.currentTime = nextTime;
      } else {
        resolve(frames);
      }
    };

    video.onseeked = captureFrame;
    video.currentTime = 0;
  });
}

/**
 * Capture frames from a canvas element over time
 * This is useful for capturing from Remotion Player
 */
export async function captureCanvasAnimation(
  getCanvas: () => HTMLCanvasElement | null,
  seekToFrame: (frame: number) => void,
  options: {
    totalFrames: number;
    width: number;
    height: number;
    everyNthFrame?: number; // Skip frames for smaller GIF
  },
  onProgress?: (progress: GifRenderProgress) => void
): Promise<HTMLCanvasElement[]> {
  const frames: HTMLCanvasElement[] = [];
  const step = options.everyNthFrame || 1;

  for (let frame = 0; frame < options.totalFrames; frame += step) {
    // Seek to frame
    seekToFrame(frame);

    // Small delay to let the frame render
    await new Promise((r) => setTimeout(r, 50));

    const sourceCanvas = getCanvas();
    if (sourceCanvas) {
      const canvas = document.createElement("canvas");
      canvas.width = options.width;
      canvas.height = options.height;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(sourceCanvas, 0, 0, options.width, options.height);
        frames.push(canvas);
      }
    }

    const capturedFrameIndex = Math.floor(frame / step);
    const totalCaptureFrames = Math.ceil(options.totalFrames / step);

    onProgress?.({
      phase: "capturing",
      progress: Math.round((capturedFrameIndex / totalCaptureFrames) * 50),
      currentFrame: capturedFrameIndex + 1,
      totalFrames: totalCaptureFrames,
    });
  }

  return frames;
}

/**
 * Capture frames from a Remotion Player by drawing its media elements to canvas.
 * Works with any content type (videos, images, mixed, collages).
 * Unlike captureCanvasAnimation, this does NOT rely on a <canvas> element existing
 * in the DOM — it finds all <video> and <img> elements and draws them directly.
 * Pre-fetches media as same-origin blobs to avoid CORS canvas tainting.
 */
export async function capturePlayerFrames(
  getContainer: () => HTMLElement | null,
  seekToFrame: (frame: number) => void,
  options: {
    totalFrames: number;
    width: number;
    height: number;
    everyNthFrame?: number;
    fps?: number;
  },
  onProgress?: (progress: GifRenderProgress) => void
): Promise<HTMLCanvasElement[]> {
  const frames: HTMLCanvasElement[] = [];
  const step = options.everyNthFrame || 1;
  const { width, height } = options;
  const fps = options.fps || 30;
  const totalCaptureFrames = Math.ceil(options.totalFrames / step);

  const container = getContainer();
  if (!container) return frames;

  // ── Pre-fetch all media sources as blobs to avoid CORS tainting ──
  const blobCache = new Map<
    string,
    { blobUrl: string; element: HTMLVideoElement | HTMLImageElement }
  >();
  const cleanupUrls: string[] = [];

  const initialMediaElements = container.querySelectorAll<
    HTMLVideoElement | HTMLImageElement
  >("video, img");

  for (const el of initialMediaElements) {
    const src = el.src;
    if (!src || blobCache.has(src)) continue;

    // Try direct CORS fetch first, then fall back to server-side proxy
    let blob: Blob | null = null;

    try {
      const response = await fetch(src, { mode: "cors" });
      if (response.ok) {
        blob = await response.blob();
      }
    } catch {
      // Direct CORS fetch blocked — try server proxy
    }

    if (!blob) {
      try {
        const proxyUrl = `/api/media-proxy?url=${encodeURIComponent(src)}`;
        const response = await fetch(proxyUrl);
        if (response.ok) {
          blob = await response.blob();
        }
      } catch {
        // Proxy also failed — skip this source
      }
    }

    if (!blob) continue;

    try {
      const blobUrl = URL.createObjectURL(blob);
      cleanupUrls.push(blobUrl);

      if (el instanceof HTMLVideoElement) {
        const video = document.createElement("video");
        video.src = blobUrl;
        video.muted = true;
        video.playsInline = true;
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error("Failed to load video blob"));
          video.load();
        });
        blobCache.set(src, { blobUrl, element: video });
      } else {
        const img = new Image();
        img.src = blobUrl;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load image blob"));
        });
        blobCache.set(src, { blobUrl, element: img });
      }
    } catch {
      // Element creation failed — skip
    }
  }

  try {
    for (let frame = 0; frame < options.totalFrames; frame += step) {
      seekToFrame(frame);
      // Wait for the Remotion Player to render the new frame
      await new Promise((r) => setTimeout(r, 100));

      const currentContainer = getContainer();
      if (!currentContainer) continue;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      // Fill black background
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      const containerRect = currentContainer.getBoundingClientRect();
      if (containerRect.width === 0 || containerRect.height === 0) continue;

      // Find all video and image elements in the player container
      const mediaElements = currentContainer.querySelectorAll<
        HTMLVideoElement | HTMLImageElement
      >("video, img");

      for (const el of mediaElements) {
        const rect = el.getBoundingClientRect();
        // Skip hidden or zero-size elements
        if (rect.width === 0 || rect.height === 0) continue;
        // Skip elements outside the container
        if (
          rect.right < containerRect.left ||
          rect.left > containerRect.right ||
          rect.bottom < containerRect.top ||
          rect.top > containerRect.bottom
        )
          continue;

        try {
          const isVideo = el instanceof HTMLVideoElement;
          const src = el.src;

          // Use the blob-cached element for drawing (same-origin, no taint)
          let drawSource: HTMLVideoElement | HTMLImageElement = el;
          const cached = blobCache.get(src);

          if (cached) {
            // For videos, seek the blob copy to the correct time
            if (isVideo && cached.element instanceof HTMLVideoElement) {
              const timeInSeconds = frame / fps;
              cached.element.currentTime = timeInSeconds;
              await new Promise<void>((resolve) => {
                const onSeeked = () => {
                  (cached.element as HTMLVideoElement).removeEventListener(
                    "seeked",
                    onSeeked
                  );
                  resolve();
                };
                cached.element.addEventListener("seeked", onSeeked);
                setTimeout(resolve, 150);
              });
              if (cached.element.readyState < 2) continue;
            }
            drawSource = cached.element;
          } else {
            // No blob available — use original (may taint canvas)
            if (isVideo && el.readyState < 2) continue;
          }

          const isVideoSource = drawSource instanceof HTMLVideoElement;
          const naturalW = isVideoSource
            ? (drawSource as HTMLVideoElement).videoWidth
            : (drawSource as HTMLImageElement).naturalWidth;
          const naturalH = isVideoSource
            ? (drawSource as HTMLVideoElement).videoHeight
            : (drawSource as HTMLImageElement).naturalHeight;
          if (!naturalW || !naturalH) continue;

          // Scale from container coordinates to output canvas coordinates
          const scaleX = width / containerRect.width;
          const scaleY = height / containerRect.height;
          const x = (rect.left - containerRect.left) * scaleX;
          const y = (rect.top - containerRect.top) * scaleY;
          const w = rect.width * scaleX;
          const h = rect.height * scaleY;

          const style = window.getComputedStyle(el);
          const objectFit = style.objectFit || "fill";

          if (objectFit === "cover") {
            const contentAspect = naturalW / naturalH;
            const boxAspect = w / h;
            let sx = 0,
              sy = 0,
              sw = naturalW,
              sh = naturalH;
            if (contentAspect > boxAspect) {
              sw = naturalH * boxAspect;
              sx = (naturalW - sw) / 2;
            } else {
              sh = naturalW / boxAspect;
              sy = (naturalH - sh) / 2;
            }
            ctx.drawImage(drawSource, sx, sy, sw, sh, x, y, w, h);
          } else if (objectFit === "contain") {
            const contentAspect = naturalW / naturalH;
            const boxAspect = w / h;
            let drawW = w,
              drawH = h,
              drawX = x,
              drawY = y;
            if (contentAspect > boxAspect) {
              drawH = w / contentAspect;
              drawY = y + (h - drawH) / 2;
            } else {
              drawW = h * contentAspect;
              drawX = x + (w - drawW) / 2;
            }
            ctx.drawImage(drawSource, drawX, drawY, drawW, drawH);
          } else {
            ctx.drawImage(drawSource, x, y, w, h);
          }
        } catch {
          // Skip elements that cause errors
        }
      }

      frames.push(canvas);

      const capturedFrameIndex = Math.floor(frame / step);
      onProgress?.({
        phase: "capturing",
        progress: Math.round(
          ((capturedFrameIndex + 1) / totalCaptureFrames) * 100
        ),
        currentFrame: capturedFrameIndex + 1,
        totalFrames: totalCaptureFrames,
      });
    }
  } finally {
    // Clean up blob URLs to free memory
    for (const url of cleanupUrls) {
      URL.revokeObjectURL(url);
    }
  }

  return frames;
}

/**
 * Blur region definition for canvas-based blur
 */
export interface BlurRegionDef {
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  height: number; // percentage
  intensity: number; // blur pixels
  shape: "rectangle" | "ellipse" | "rounded-rect";
  borderRadius?: number;
  blurMode?: "gaussian" | "heavy" | "pixelate" | "solid";
  fillColor?: string;
}

/**
 * Fast frame capture using direct video-to-canvas drawing
 * Much faster than html2canvas - draws video directly and applies blur with canvas filters
 */
export async function captureVideoWithBlur(
  getVideoElement: () => HTMLVideoElement | null,
  seekToFrame: (frame: number) => void,
  options: {
    totalFrames: number;
    width: number;
    height: number;
    everyNthFrame?: number;
    blurRegions?: BlurRegionDef[];
    fps: number;
  },
  onProgress?: (progress: GifRenderProgress) => void
): Promise<HTMLCanvasElement[]> {
  const frames: HTMLCanvasElement[] = [];
  const step = options.everyNthFrame || 1;
  const totalCaptureFrames = Math.ceil(options.totalFrames / step);
  const { width, height, blurRegions = [] } = options;

  // Get video element and convert to blob URL to avoid CORS issues
  const originalVideo = getVideoElement();
  if (!originalVideo?.src) {
    throw new Error("No video element found");
  }

  // Create a new video element with blob URL for CORS-free capture
  let videoToCapture = originalVideo;
  let blobUrl: string | null = null;

  try {
    // Try direct CORS fetch first, then server-side proxy
    let blob: Blob | null = null;

    try {
      const response = await fetch(originalVideo.src, { mode: "cors" });
      if (response.ok) {
        blob = await response.blob();
      }
    } catch {
      // Direct CORS fetch blocked
    }

    if (!blob) {
      try {
        const proxyUrl = `/api/media-proxy?url=${encodeURIComponent(originalVideo.src)}`;
        const response = await fetch(proxyUrl);
        if (response.ok) {
          blob = await response.blob();
        }
      } catch {
        // Proxy also failed
      }
    }

    if (!blob) {
      console.warn("Could not fetch video via CORS or proxy, deferring to fallback");
      return frames;
    }

    blobUrl = URL.createObjectURL(blob);

    // Create new video with blob URL
    videoToCapture = document.createElement("video");
    videoToCapture.src = blobUrl;
    videoToCapture.muted = true;
    videoToCapture.playsInline = true;

    // Wait for video to load
    await new Promise<void>((resolve, reject) => {
      videoToCapture.onloadeddata = () => resolve();
      videoToCapture.onerror = () => reject(new Error("Failed to load video blob"));
      videoToCapture.load();
    });
  } catch {
    // Can't create blob video — return empty so the fallback capture path is used
    console.warn("Could not create blob video, deferring to fallback capture");
    return frames;
  }

  try {
    // Pre-compute blur region pixel coordinates and allocate reusable canvases
    const precomputedRegions = blurRegions.map((region) => {
      const rx = (region.x / 100) * width;
      const ry = (region.y / 100) * height;
      const rw = (region.width / 100) * width;
      const rh = (region.height / 100) * height;
      const intensity = region.blurMode === "heavy"
        ? region.intensity * 3
        : region.blurMode === "pixelate"
        ? Math.max(8, region.intensity * 1.2)
        : region.intensity;
      const scale = Math.max(1, Math.min(intensity / 2, 10));
      const smallW = Math.max(1, Math.floor(rw / scale));
      const smallH = Math.max(1, Math.floor(rh / scale));

      // Pre-allocate reusable canvases for non-solid regions
      let smallCanvas: HTMLCanvasElement | null = null;
      let smallCtx: CanvasRenderingContext2D | null = null;
      let blurCanvas: HTMLCanvasElement | null = null;
      let blurCtx: CanvasRenderingContext2D | null = null;

      if (!(region.blurMode === "solid" && region.fillColor) && rw > 0 && rh > 0) {
        smallCanvas = document.createElement("canvas");
        smallCanvas.width = smallW;
        smallCanvas.height = smallH;
        smallCtx = smallCanvas.getContext("2d");

        blurCanvas = document.createElement("canvas");
        blurCanvas.width = Math.ceil(rw);
        blurCanvas.height = Math.ceil(rh);
        blurCtx = blurCanvas.getContext("2d");
        if (blurCtx) {
          blurCtx.filter = `blur(${Math.max(2, intensity / 4)}px)`;
        }
      }

      return {
        ...region, rx, ry, rw, rh, intensity, scale, smallW, smallH,
        smallCanvas, smallCtx, blurCanvas, blurCtx,
      };
    });

    // Pre-compute video aspect ratio (constant across all frames)
    let drawWidth = width, drawHeight = height, drawX = 0, drawY = 0;
    if (videoToCapture.videoWidth > 0) {
      const videoAspect = videoToCapture.videoWidth / videoToCapture.videoHeight;
      const canvasAspect = width / height;
      if (videoAspect > canvasAspect) {
        drawWidth = width;
        drawHeight = width / videoAspect;
        drawX = 0;
        drawY = (height - drawHeight) / 2;
      } else {
        drawHeight = height;
        drawWidth = height * videoAspect;
        drawX = (width - drawWidth) / 2;
        drawY = 0;
      }
    }

    for (let frame = 0; frame < options.totalFrames; frame += step) {
      // Seek both videos to keep them in sync
      seekToFrame(frame);

      // Calculate time for our blob video
      const timeInSeconds = frame / options.fps;
      if (blobUrl && videoToCapture !== originalVideo) {
        videoToCapture.currentTime = timeInSeconds;
        // Wait for seek to complete
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            videoToCapture.removeEventListener("seeked", onSeeked);
            resolve();
          };
          videoToCapture.addEventListener("seeked", onSeeked);
          // Timeout fallback
          setTimeout(resolve, 100);
        });
      } else {
        // Short delay for original video to seek
        await new Promise((r) => setTimeout(r, 50));
      }

      if (videoToCapture.readyState < 2) {
        // Skip if video not ready
        continue;
      }

      // Create output canvas
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      // Fill background
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      // Draw video frame (using pre-computed aspect ratio)
      ctx.drawImage(videoToCapture, drawX, drawY, drawWidth, drawHeight);

      // Apply blur regions using pre-computed coordinates and reusable canvases
      for (const region of precomputedRegions) {
        const { rx, ry, rw, rh } = region;

        // Skip invalid regions
        if (rw <= 0 || rh <= 0) continue;

        if (region.blurMode === "solid" && region.fillColor) {
          // Solid fill
          ctx.fillStyle = region.fillColor;
          if (region.shape === "ellipse") {
            ctx.beginPath();
            ctx.ellipse(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, 0, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(rx, ry, rw, rh);
          }
        } else {
          const { smallCanvas, smallCtx, blurCanvas, blurCtx, smallW, smallH } = region;
          if (!smallCtx || !blurCtx || !smallCanvas || !blurCanvas) continue;

          // Clear and draw scaled down (this blurs via downsampling)
          smallCtx.clearRect(0, 0, smallW, smallH);
          smallCtx.drawImage(
            canvas,
            rx, ry, rw, rh,
            0, 0, smallW, smallH
          );

          // Clear and scale back up with blur filter (filter already set on ctx)
          blurCtx.clearRect(0, 0, rw, rh);
          blurCtx.drawImage(smallCanvas, 0, 0, smallW, smallH, 0, 0, rw, rh);

          // Draw blurred result back to main canvas with shape clipping
          ctx.save();
          ctx.beginPath();
          if (region.shape === "ellipse") {
            ctx.ellipse(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, 0, 0, Math.PI * 2);
          } else if (region.shape === "rounded-rect" && region.borderRadius) {
            const r = (region.borderRadius / 100) * Math.min(rw, rh);
            ctx.roundRect(rx, ry, rw, rh, r);
          } else {
            ctx.rect(rx, ry, rw, rh);
          }
          ctx.clip();

          // Draw the blurred region
          ctx.drawImage(blurCanvas, 0, 0, rw, rh, rx, ry, rw, rh);
          ctx.restore();
        }
      }

      frames.push(canvas);

      const capturedFrameIndex = Math.floor(frame / step);
      onProgress?.({
        phase: "capturing",
        progress: Math.round(((capturedFrameIndex + 1) / totalCaptureFrames) * 100),
        currentFrame: capturedFrameIndex + 1,
        totalFrames: totalCaptureFrames,
      });
    }

    return frames;
  } finally {
    // Clean up blob URL to free memory
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
  }
}

/**
 * Capture frames from an HTML element using html2canvas (slow fallback)
 */
export async function captureElementAnimation(
  getElement: () => HTMLElement | null,
  seekToFrame: (frame: number) => void,
  options: {
    totalFrames: number;
    width: number;
    height: number;
    everyNthFrame?: number;
  },
  onProgress?: (progress: GifRenderProgress) => void
): Promise<HTMLCanvasElement[]> {
  const frames: HTMLCanvasElement[] = [];
  const step = options.everyNthFrame || 1;
  const totalCaptureFrames = Math.ceil(options.totalFrames / step);

  for (let frame = 0; frame < options.totalFrames; frame += step) {
    seekToFrame(frame);
    await new Promise((r) => setTimeout(r, 80));

    const element = getElement();
    if (element) {
      try {
        const canvas = await html2canvas(element, {
          width: options.width,
          height: options.height,
          scale: 1,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#000000",
          logging: false,
        });

        if (canvas.width !== options.width || canvas.height !== options.height) {
          const resizedCanvas = document.createElement("canvas");
          resizedCanvas.width = options.width;
          resizedCanvas.height = options.height;
          const ctx = resizedCanvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(canvas, 0, 0, options.width, options.height);
            frames.push(resizedCanvas);
          }
        } else {
          frames.push(canvas);
        }
      } catch (err) {
        console.warn("Frame capture failed:", err);
      }
    }

    const capturedFrameIndex = Math.floor(frame / step);
    onProgress?.({
      phase: "capturing",
      progress: Math.round(((capturedFrameIndex + 1) / totalCaptureFrames) * 100),
      currentFrame: capturedFrameIndex + 1,
      totalFrames: totalCaptureFrames,
    });
  }

  return frames;
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export canvas as PNG
 */
export function exportCanvasAsPng(
  canvas: HTMLCanvasElement,
  filename: string
): void {
  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, filename);
    }
  }, "image/png");
}

/**
 * Export canvas as JPG
 */
export function exportCanvasAsJpg(
  canvas: HTMLCanvasElement,
  filename: string,
  quality: number = 0.92
): void {
  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, filename);
    }
  }, "image/jpeg", quality);
}

/**
 * Export canvas as WebP
 */
export function exportCanvasAsWebP(
  canvas: HTMLCanvasElement,
  filename: string,
  quality: number = 0.92
): void {
  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, filename);
    }
  }, "image/webp", quality);
}
