"use client";

import { useVideoEditorStore } from "@/stores/video-editor-store";
import { framesToTime } from "@/lib/gif-maker/timeline-utils";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
} from "lucide-react";
import { useState } from "react";

interface TimelineControlsProps {
  onFrameChange: (frame: number) => void;
  onTogglePlayback: () => void;
}

export function TimelineControls({ onFrameChange, onTogglePlayback }: TimelineControlsProps) {
  const isPlaying = useVideoEditorStore((s) => s.isPlaying);
  const currentFrame = useVideoEditorStore((s) => s.currentFrame);
  const totalDurationInFrames = useVideoEditorStore(
    (s) => s.totalDurationInFrames
  );
  const fps = useVideoEditorStore((s) => s.settings.fps);
  const setCurrentFrame = useVideoEditorStore((s) => s.setCurrentFrame);
  const [loopEnabled, setLoopEnabled] = useState(true);

  const handleSkipBack = () => {
    setCurrentFrame(0);
    onFrameChange(0);
  };

  const handleSkipForward = () => {
    const end = Math.max(0, totalDurationInFrames - 1);
    setCurrentFrame(end);
    onFrameChange(end);
  };

  return (
    <div className="flex items-center gap-1 px-3 h-10 bg-[#1a1b2e] border-b border-[#252640] flex-shrink-0">
      {/* Transport Buttons */}
      <div className="flex items-center bg-[#141524] rounded-lg overflow-hidden">
        <button
          onClick={handleSkipBack}
          className="h-8 w-8 flex items-center justify-center text-[#8490b0] hover:text-[#e6e8f0] hover:bg-[#1e2038] active:bg-[#1e2038] transition-colors duration-100"
          title="Go to start (Home)"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          onClick={onTogglePlayback}
          className="h-8 w-10 flex items-center justify-center text-[#e6e8f0] hover:text-white hover:bg-blue-500/15 active:bg-blue-500/25 transition-colors duration-100"
          title="Play/Pause (Space)"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </button>
        <button
          onClick={handleSkipForward}
          className="h-8 w-8 flex items-center justify-center text-[#8490b0] hover:text-[#e6e8f0] hover:bg-[#1e2038] active:bg-[#1e2038] transition-colors duration-100"
          title="Go to end (End)"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      {/* Loop Toggle */}
      <button
        onClick={() => setLoopEnabled(!loopEnabled)}
        className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors duration-100 ${
          loopEnabled
            ? "text-purple-400 bg-purple-500/12"
            : "text-[#8490b0] hover:text-[#e6e8f0] hover:bg-[#1e2038]"
        }`}
        title="Loop"
      >
        <Repeat className="h-4 w-4" />
      </button>

      <div className="w-px h-5 bg-[#252640] mx-1" />

      {/* Timecode Display */}
      <div className="flex items-center gap-1.5 px-3 h-8 bg-[#141524] rounded-lg font-mono text-xs select-none">
        <span className="text-[#e6e8f0] tabular-nums">
          {framesToTime(currentFrame, fps)}
        </span>
        <span className="text-[#354065]">/</span>
        <span className="text-[#4d5578] tabular-nums">
          {framesToTime(totalDurationInFrames, fps)}
        </span>
      </div>

      <span className="text-[10px] font-mono text-[#4d5578] ml-1 tabular-nums">
        F{currentFrame}
      </span>

      {/* Keyboard Shortcuts */}
      <div className="flex items-center gap-3 ml-auto">
        <ShortcutHint keys={["Space"]} label="Play" />
        <ShortcutHint keys={["J", "K", "L"]} label="Shuttle" />
        <ShortcutHint keys={["\u2190", "\u2192"]} label="Frame" />
      </div>
    </div>
  );
}

function ShortcutHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center gap-1 text-[10px] text-[#4d5578]">
      {keys.map((key) => (
        <kbd
          key={key}
          className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded bg-[#252640] text-[9px] font-mono text-[#8490b0]"
        >
          {key}
        </kbd>
      ))}
      <span>{label}</span>
    </div>
  );
}
