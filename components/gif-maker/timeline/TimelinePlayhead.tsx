"use client";

import { memo } from "react";
import { framesToPixels } from "@/lib/gif-maker/timeline-utils";

interface TimelinePlayheadProps {
  frame: number;
  zoom: number;
  height: number;
}

export const TimelinePlayhead = memo(function TimelinePlayhead({ frame, zoom, height }: TimelinePlayheadProps) {
  const x = framesToPixels(frame, zoom);

  return (
    <div
      className="absolute top-0 pointer-events-none z-30"
      style={{ left: x, height }}
    >
      {/* Playhead notch — diamond shape */}
      <svg
        width="14"
        height="22"
        viewBox="0 0 14 22"
        className="absolute -top-[22px] -translate-x-1/2"
      >
        <defs>
          <linearGradient id="playhead-grad" x1="0" y1="0" x2="14" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
        <path d="M0 0H14L7 8Z" fill="url(#playhead-grad)" />
        <rect x="6" y="8" width="2" height="14" fill="url(#playhead-grad)" rx="1" />
      </svg>

      {/* Vertical line with gradient fade */}
      <div
        className="w-px h-full -translate-x-1/2"
        style={{
          background:
            "linear-gradient(180deg, #6366f1 0%, rgba(99,102,241,0.2) 100%)",
        }}
      />

      {/* Ambient glow */}
      <div
        className="absolute top-0 -translate-x-1/2 w-6 h-full pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(99,102,241,0.12) 0%, transparent 50%)",
        }}
      />
    </div>
  );
});
