"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { TimelineHeader } from "./TimelineHeader";
import { TimelineTrack } from "./TimelineTrack";
import { TimelinePlayhead } from "./TimelinePlayhead";
import { TimelineControls } from "./TimelineControls";
import { framesToPixels, pixelsToFrames } from "@/lib/gif-maker/timeline-utils";

interface TimelineProps {
  onFrameChange: (frame: number) => void;
  onTogglePlayback: () => void;
}

export function Timeline({ onFrameChange, onTogglePlayback }: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tracks = useVideoEditorStore((s) => s.tracks);
  const totalDurationInFrames = useVideoEditorStore(
    (s) => s.totalDurationInFrames
  );
  const currentFrame = useVideoEditorStore((s) => s.currentFrame);
  const settings = useVideoEditorStore((s) => s.settings);
  const setCurrentFrame = useVideoEditorStore((s) => s.setCurrentFrame);

  const [isScrubbing, setIsScrubbing] = useState(false);
  const zoom = settings.timelineZoom;
  const totalWidth = framesToPixels(
    Math.max(totalDurationInFrames + 60, 300),
    zoom
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      if (!scrollRef.current) return;
      const scrollContainer = scrollRef.current;
      const rect = scrollContainer.getBoundingClientRect();
      const scrollLeft = scrollContainer.scrollLeft;
      const x = clientX - rect.left + scrollLeft;
      const frame = Math.max(
        0,
        Math.min(pixelsToFrames(x, zoom), totalDurationInFrames - 1)
      );
      setCurrentFrame(frame);
      onFrameChange(frame);
    },
    [zoom, totalDurationInFrames, setCurrentFrame, onFrameChange]
  );

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      seekFromClientX(e.clientX);
    },
    [seekFromClientX]
  );

  const handleScrubStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      seekFromClientX(e.clientX);
      setIsScrubbing(true);
    },
    [seekFromClientX]
  );

  // Global mouse move/up for scrubbing
  useEffect(() => {
    if (!isScrubbing) return;

    const handleMouseMove = (e: MouseEvent) => {
      seekFromClientX(e.clientX);
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isScrubbing, seekFromClientX]);

  const trackHeight = 40; // h-10

  return (
    <div className="flex flex-col h-full bg-[#0e0f1a]">
      {/* Timeline Controls */}
      <TimelineControls onFrameChange={onFrameChange} onTogglePlayback={onTogglePlayback} />

      {/* Scrollable Timeline Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Labels */}
        <div className="w-32 min-w-[128px] flex-shrink-0 bg-[#141524] border-r border-[#252640] flex flex-col">
          {/* Ruler spacer */}
          <div className="h-7 border-b border-[#252640] flex-shrink-0" />
          {tracks.map((track) => (
            <div
              key={track.id}
              className="h-10 flex items-center gap-2 px-3 border-b border-[#252640]/60 group hover:bg-[#1a1b2e] transition-colors duration-100"
            >
              <TrackIcon type={track.type} />
              <span className="text-[11px] font-medium text-[#8490b0] whitespace-nowrap overflow-hidden text-ellipsis">
                {track.label}
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable Content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-hidden"
        >
          <div style={{ width: totalWidth, position: "relative" }}>
            {/* Time Ruler — clickable for seeking */}
            <TimelineHeader
              totalWidth={totalWidth}
              zoom={zoom}
              fps={settings.fps}
              onMouseDown={handleScrubStart}
            />

            {/* Tracks — clickable for seeking */}
            <div
              className="relative cursor-crosshair"
              onClick={handleTimelineClick}
            >
              {tracks.map((track) => (
                <TimelineTrack
                  key={track.id}
                  track={track}
                  zoom={zoom}
                />
              ))}

              {/* Playhead */}
              <TimelinePlayhead
                frame={currentFrame}
                zoom={zoom}
                height={tracks.length * trackHeight}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Track Icon ──────────────────────────────────────

import { Film, Layers } from "lucide-react";
import type { TrackType } from "@/lib/gif-maker/types";

function TrackIcon({ type }: { type: TrackType }) {
  if (type === "video") {
    return <Film className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />;
  }
  return <Layers className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />;
}
