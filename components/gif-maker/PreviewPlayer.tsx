"use client";

import { Player, PlayerRef } from "@remotion/player";
import {
  useRef,
  useState,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { VideoToGif } from "@/remotion/compositions/VideoToGif";
import { ClipEditor } from "@/remotion/compositions/ClipEditor";
import type { PreviewType } from "@/lib/gif-maker/types";
import type { BlurRegion } from "@/lib/gif-maker/types";
import type { ClipEditorInputProps } from "./EditorPreview";

export interface VideoToGifProps {
  videoSrc: string;
  fullBlurIntensity: number;
  blurRegions: BlurRegion[];
  regionBlurIntensity: number;
  trimStartFrame: number;
  trimEndFrame: number;
}

type PlayerProps = VideoToGifProps | ClipEditorInputProps;

interface PreviewPlayerProps {
  type: PreviewType;
  props: PlayerProps;
  width: number;
  height: number;
  fps?: number;
  durationInFrames?: number;
  className?: string;
  /** Callback fired on every frame update from the Remotion Player */
  onFrameUpdate?: (frame: number) => void;
  /** Callback fired when play state changes */
  onPlayingChange?: (isPlaying: boolean) => void;
  /** Render prop for overlay layer, called with the Player container's pixel dimensions */
  overlaySlot?: (containerWidth: number, containerHeight: number) => React.ReactNode;
}

// Methods exposed via ref for GIF capture
export interface PreviewPlayerRef {
  seekToFrame: (frame: number) => void;
  getCanvas: () => HTMLCanvasElement | null;
  getVideoElement: () => HTMLVideoElement | null;
  play: () => void;
  pause: () => void;
  getCurrentFrame: () => number;
  getTotalFrames: () => number;
  getContainerElement: () => HTMLDivElement | null;
}

export const PreviewPlayer = forwardRef<PreviewPlayerRef, PreviewPlayerProps>(
  function PreviewPlayer(
    {
      type,
      props,
      width,
      height,
      fps = 30,
      durationInFrames = 150,
      className,
      onFrameUpdate,
      onPlayingChange,
      overlaySlot,
    },
    ref
  ) {
    const playerRef = useRef<PlayerRef>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });

    const actualDuration = Math.max(1, durationInFrames);

    // Measure the Player's container for overlay positioning
    useEffect(() => {
      const el = containerRef.current;
      if (!el || !overlaySlot) return;
      const measure = () => {
        const rect = el.getBoundingClientRect();
        setOverlaySize({ width: rect.width, height: rect.height });
      };
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      return () => observer.disconnect();
    }, [overlaySlot]);

    // Whether this is an editor mode (no native controls, no built-in buttons)
    const isEditorMode = type === "clip-editor";

    // Sync frame updates from Remotion Player → parent
    useEffect(() => {
      const player = playerRef.current;
      if (!player || !onFrameUpdate) return;

      const handler = (e: { detail: { frame: number } }) => {
        onFrameUpdate(e.detail.frame);
      };

      player.addEventListener("frameupdate", handler as never);
      return () => {
        player.removeEventListener("frameupdate", handler as never);
      };
    }, [onFrameUpdate]);

    // Sync play/pause state from Remotion Player → parent
    useEffect(() => {
      const player = playerRef.current;
      if (!player) return;

      const handlePlay = () => {
        setIsPlaying(true);
        onPlayingChange?.(true);
      };
      const handlePause = () => {
        setIsPlaying(false);
        onPlayingChange?.(false);
      };

      player.addEventListener("play", handlePlay);
      player.addEventListener("pause", handlePause);
      return () => {
        player.removeEventListener("play", handlePlay);
        player.removeEventListener("pause", handlePause);
      };
    }, [onPlayingChange]);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        seekToFrame: (frame: number) => {
          playerRef.current?.seekTo(frame);
        },
        getCanvas: () => {
          const container = containerRef.current;
          if (!container) return null;
          return container.querySelector("canvas");
        },
        getVideoElement: () => {
          const container = containerRef.current;
          if (!container) return null;
          return container.querySelector("video");
        },
        play: () => {
          playerRef.current?.play();
          setIsPlaying(true);
        },
        pause: () => {
          playerRef.current?.pause();
          setIsPlaying(false);
        },
        getCurrentFrame: () => {
          return playerRef.current?.getCurrentFrame() || 0;
        },
        getTotalFrames: () => {
          return actualDuration;
        },
        getContainerElement: () => {
          return containerRef.current;
        },
      }),
      [actualDuration]
    );

    const togglePlay = useCallback(() => {
      if (playerRef.current) {
        if (isPlaying) {
          playerRef.current.pause();
        } else {
          playerRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    }, [isPlaying]);

    const restart = useCallback(() => {
      if (playerRef.current) {
        playerRef.current.seekTo(0);
        playerRef.current.play();
        setIsPlaying(true);
      }
    }, []);

    const renderPlayer = () => {
      switch (type) {
        case "video-to-gif":
          return (
            <Player
              ref={playerRef}
              component={VideoToGif}
              inputProps={props as VideoToGifProps}
              durationInFrames={actualDuration}
              fps={fps}
              compositionWidth={width}
              compositionHeight={height}
              style={{
                width: "100%",
                aspectRatio: `${width} / ${height}`,
              }}
              controls
              loop
              autoPlay={false}
            />
          );
        case "clip-editor":
          return (
            <Player
              ref={playerRef}
              component={ClipEditor}
              inputProps={props as ClipEditorInputProps}
              durationInFrames={actualDuration}
              fps={fps}
              compositionWidth={width}
              compositionHeight={height}
              style={{
                width: "100%",
                aspectRatio: `${width} / ${height}`,
              }}
              loop
              autoPlay={false}
            />
          );
      }
    };

    return (
      <div className={className}>
        <div
          ref={containerRef}
          className="relative rounded-lg overflow-hidden bg-black"
        >
          {renderPlayer()}
          {overlaySlot && overlaySize.width > 0 &&
            overlaySlot(overlaySize.width, overlaySize.height)}
        </div>

        {/* Only show built-in Play/Restart buttons for non-editor modes */}
        {!isEditorMode && (
          <div className="flex gap-2 mt-3 justify-center">
            <button
              onClick={togglePlay}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              onClick={restart}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Restart
            </button>
          </div>
        )}
      </div>
    );
  }
);
