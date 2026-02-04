"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import {
  PreviewPlayer,
  type PreviewPlayerRef,
  type VideoToGifProps,
} from "./PreviewPlayer";
import { VideoUploader, type VideoInfo } from "./VideoUploader";
import { BlurRegionEditor } from "./BlurRegionEditor";
import {
  type PlatformPreset,
  type BlurRegion,
  PLATFORM_DIMENSIONS,
} from "@/lib/gif-maker/types";
import {
  captureCanvasAnimation,
  renderFramesToGif,
  downloadBlob,
  type GifRenderProgress,
} from "@/lib/gif-maker/gif-renderer";
import {
  Download,
  Settings2,
  Film,
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  Scissors,
} from "lucide-react";

const FPS = 30;

export function GifMaker() {
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] =
    useState<GifRenderProgress | null>(null);
  const playerRef = useRef<PreviewPlayerRef>(null);

  // Platform settings
  const [platform, setPlatform] = useState<PlatformPreset>("of-standard");

  // Trim settings (in seconds)
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(5);

  // Blur settings
  const [fullBlurIntensity, setFullBlurIntensity] = useState(0);
  const [blurRegions, setBlurRegions] = useState<BlurRegion[]>([]);
  const [regionBlurIntensity, setRegionBlurIntensity] = useState(10);

  const dimensions =
    PLATFORM_DIMENSIONS[platform as Exclude<PlatformPreset, "custom">];

  // When video changes, reset trim to video bounds
  const handleVideoChange = useCallback((v: VideoInfo | null) => {
    setVideo(v);
    if (v) {
      setTrimStart(0);
      setTrimEnd(Math.min(v.duration, 10)); // Default max 10s for GIF
    } else {
      setTrimStart(0);
      setTrimEnd(5);
      setBlurRegions([]);
    }
  }, []);

  // Trim in frames
  const trimStartFrame = Math.round(trimStart * FPS);
  const trimEndFrame = Math.round(trimEnd * FPS);
  const durationInFrames = Math.max(1, trimEndFrame - trimStartFrame);

  const previewProps = useMemo(
    (): VideoToGifProps => ({
      videoSrc: video?.url || "",
      fullBlurIntensity,
      blurRegions,
      regionBlurIntensity,
      trimStartFrame,
      trimEndFrame,
    }),
    [
      video?.url,
      fullBlurIntensity,
      blurRegions,
      regionBlurIntensity,
      trimStartFrame,
      trimEndFrame,
    ]
  );

  const [renderMessage, setRenderMessage] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const getFilename = useCallback(() => {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    return `gif-${timestamp}.gif`;
  }, []);

  const handleRender = useCallback(async () => {
    if (!video || !playerRef.current) return;

    setIsRendering(true);
    setRenderMessage(null);
    setRenderProgress(null);

    try {
      const player = playerRef.current;
      player.pause();

      const totalFrames = player.getTotalFrames();
      const everyNthFrame = 2; // 30fps -> 15fps GIF

      setRenderMessage({
        type: "info",
        message: "Capturing frames...",
      });

      const frames = await captureCanvasAnimation(
        () => player.getCanvas(),
        (frame) => player.seekToFrame(frame),
        {
          totalFrames,
          width: dimensions.width,
          height: dimensions.height,
          everyNthFrame,
        },
        (progress) => setRenderProgress(progress)
      );

      if (frames.length === 0) {
        throw new Error("No frames captured");
      }

      setRenderMessage({
        type: "info",
        message: "Encoding GIF...",
      });

      const gifBlob = await renderFramesToGif(
        frames,
        {
          width: dimensions.width,
          height: dimensions.height,
          fps: 15,
          quality: 10,
        },
        (progress) => setRenderProgress(progress)
      );

      downloadBlob(gifBlob, getFilename());

      setRenderMessage({
        type: "success",
        message: `GIF exported! (${(gifBlob.size / 1024 / 1024).toFixed(2)} MB)`,
      });

      player.seekToFrame(0);
    } catch (error) {
      console.error("Render error:", error);
      setRenderMessage({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Export failed. Please try again.",
      });
    } finally {
      setIsRendering(false);
      setRenderProgress(null);
    }
  }, [video, dimensions, getFilename]);

  const maxDuration = video ? video.duration : 10;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
      {/* Left Panel - Settings */}
      <div className="space-y-6">
        {/* Video Upload */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Film className="h-4 w-4" />
            Video
          </h3>
          <VideoUploader video={video} onVideoChange={handleVideoChange} />
        </div>

        {video && (
          <>
            {/* Trim Controls */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Scissors className="h-4 w-4" />
                Trim
              </h3>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Start: {trimStart.toFixed(1)}s
                </label>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, trimEnd - 0.1)}
                  step={0.1}
                  value={trimStart}
                  onChange={(e) => setTrimStart(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  End: {trimEnd.toFixed(1)}s
                </label>
                <input
                  type="range"
                  min={Math.min(maxDuration, trimStart + 0.1)}
                  max={maxDuration}
                  step={0.1}
                  value={trimEnd}
                  onChange={(e) => setTrimEnd(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Duration: {(trimEnd - trimStart).toFixed(1)}s ({durationInFrames}{" "}
                frames)
              </p>
            </div>

            {/* Blur Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Blur
              </h3>

              {/* Full Frame Blur */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Full-Frame Blur: {fullBlurIntensity}px
                </label>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={fullBlurIntensity}
                  onChange={(e) =>
                    setFullBlurIntensity(Number(e.target.value))
                  }
                  className="w-full"
                />
              </div>

              {/* Region Blur */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Region Blur Intensity: {regionBlurIntensity}px
                </label>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={regionBlurIntensity}
                  onChange={(e) =>
                    setRegionBlurIntensity(Number(e.target.value))
                  }
                  className="w-full"
                />
              </div>

              <BlurRegionEditor
                regions={blurRegions}
                onRegionsChange={setBlurRegions}
                containerWidth={dimensions.width}
                containerHeight={dimensions.height}
              />
            </div>
          </>
        )}

        {/* Settings Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Settings
          </h3>

          {/* Platform Select */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              Platform Size
            </label>
            <select
              value={platform}
              onChange={(e) =>
                setPlatform(e.target.value as PlatformPreset)
              }
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
            >
              {Object.entries(PLATFORM_DIMENSIONS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label} ({value.width}x{value.height})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Export Button */}
        <button
          onClick={handleRender}
          disabled={!video || isRendering}
          className={`
            w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium
            ${
              !video || isRendering
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }
          `}
        >
          {isRendering ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {renderProgress
                ? `${renderProgress.phase === "capturing" ? "Capturing" : "Encoding"}... ${renderProgress.progress}%`
                : "Processing..."}
            </>
          ) : (
            <>
              <Download className="h-5 w-5" />
              Export GIF
            </>
          )}
        </button>

        {/* Progress Bar */}
        {isRendering && renderProgress && (
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-200"
              style={{ width: `${renderProgress.progress}%` }}
            />
          </div>
        )}

        {/* Render Message */}
        {renderMessage && (
          <div
            className={`
              p-3 rounded-lg text-sm flex items-start gap-2
              ${
                renderMessage.type === "success"
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : renderMessage.type === "error"
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              }
            `}
          >
            {renderMessage.type === "success" ? (
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            )}
            <span>{renderMessage.message}</span>
          </div>
        )}
      </div>

      {/* Right Panel - Preview */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Preview</h3>
        <div className="sticky top-6">
          <div className="relative">
            <PreviewPlayer
              ref={playerRef}
              type="video-to-gif"
              props={previewProps}
              width={dimensions.width}
              height={dimensions.height}
              fps={FPS}
              durationInFrames={durationInFrames}
              className="w-full"
            />
          </div>

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="text-sm font-medium mb-2">Output Info</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                Dimensions: {dimensions.width}x{dimensions.height}
              </div>
              <div>Format: GIF</div>
              <div>
                Duration: {(trimEnd - trimStart).toFixed(1)}s
              </div>
              <div>
                Blur regions: {blurRegions.length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
