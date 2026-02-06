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
    const gif = new GIF({
      workers: 2,
      quality: options.quality || 10,
      width: options.width,
      height: options.height,
      workerScript: options.workerScript || "/gif.worker.js",
    });

    const frameDelay = Math.round(1000 / options.fps);

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

      onProgress?.({
        phase: "capturing",
        progress: Math.round(((index + 1) / frames.length) * 50),
        currentFrame: index + 1,
        totalFrames: frames.length,
      });
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
    // Try to fetch video as blob (works if server allows it or same-origin)
    const response = await fetch(originalVideo.src, { mode: "cors" });
    if (response.ok) {
      const blob = await response.blob();
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
    }
  } catch {
    // Fall back to original video if fetch fails
    console.warn("Could not fetch video as blob, using original (may have CORS issues)");
    videoToCapture = originalVideo;
  }

  try {
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

      // Calculate video dimensions to maintain aspect ratio (contain)
      const videoAspect = videoToCapture.videoWidth / videoToCapture.videoHeight;
      const canvasAspect = width / height;
      let drawWidth: number, drawHeight: number, drawX: number, drawY: number;

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

      // Fill background
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      // Draw video frame
      ctx.drawImage(videoToCapture, drawX, drawY, drawWidth, drawHeight);

      // Apply blur regions
      for (const region of blurRegions) {
        const rx = (region.x / 100) * width;
        const ry = (region.y / 100) * height;
        const rw = (region.width / 100) * width;
        const rh = (region.height / 100) * height;

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
          // Calculate blur intensity
          const intensity = region.blurMode === "heavy"
            ? region.intensity * 3
            : region.blurMode === "pixelate"
            ? Math.max(8, region.intensity * 1.2)
            : region.intensity;

          // Use StackBlur-like approach: draw scaled down then scaled up
          const scale = Math.max(1, Math.min(intensity / 2, 10));
          const smallW = Math.max(1, Math.floor(rw / scale));
          const smallH = Math.max(1, Math.floor(rh / scale));

          // Create small canvas
          const smallCanvas = document.createElement("canvas");
          smallCanvas.width = smallW;
          smallCanvas.height = smallH;
          const smallCtx = smallCanvas.getContext("2d");
          if (!smallCtx) continue;

          // Draw scaled down (this blurs via downsampling)
          smallCtx.drawImage(
            canvas,
            rx, ry, rw, rh,
            0, 0, smallW, smallH
          );

          // Apply additional CSS blur for smoother result
          const blurCanvas = document.createElement("canvas");
          blurCanvas.width = Math.ceil(rw);
          blurCanvas.height = Math.ceil(rh);
          const blurCtx = blurCanvas.getContext("2d");
          if (!blurCtx) continue;

          // Scale back up with blur filter
          blurCtx.filter = `blur(${Math.max(2, intensity / 4)}px)`;
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
