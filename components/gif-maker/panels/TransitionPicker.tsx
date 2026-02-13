"use client";

import { useState } from "react";
import {
  getAllTransitions,
  getTransitionCategories,
  getTransitionsByCategory,
  type TransitionType,
  type TransitionCategory,
  type TransitionDefinition,
} from "@/lib/gif-maker/transition-library";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { Zap, Check } from "lucide-react";

export function TransitionPicker() {
  const [selectedCategory, setSelectedCategory] = useState<TransitionCategory | "all">("all");
  const [selectedTransition, setSelectedTransition] = useState<TransitionType | null>(null);
  const [duration, setDuration] = useState(24);

  const clips = useVideoEditorStore((s) => s.clips);
  const selectedClipId = useVideoEditorStore((s) => s.selectedClipId);
  const setTransition = useVideoEditorStore((s) => s.setTransition);

  const categories = getTransitionCategories();

  // Get filtered transitions
  const transitions =
    selectedCategory === "all"
      ? getAllTransitions()
      : getTransitionsByCategory(selectedCategory);

  // Find selected clip index
  const selectedClipIndex = clips.findIndex((c) => c.id === selectedClipId);
  const canApplyTransition = selectedClipIndex > 0; // Need at least 2 clips

  const handleApplyTransition = (transitionType: TransitionType) => {
    if (!canApplyTransition || !selectedClipId) return;

    const prevClip = clips[selectedClipIndex - 1];
    setTransition(prevClip.id, selectedClipId, transitionType as any, duration);
    setSelectedTransition(transitionType);

    // Clear selection after 1.5s
    setTimeout(() => setSelectedTransition(null), 1500);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/50">
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-brand-light-pink" />
          Transitions
        </h3>
        <p className="text-xs text-zinc-500">
          {canApplyTransition
            ? "Select transition between clips"
            : "Select a clip with a previous clip to add transition"}
        </p>
      </div>

      {canApplyTransition && (
        <>
          {/* Duration Control */}
          <div className="p-4 border-b border-zinc-800/50">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-zinc-300">
                Duration
              </label>
              <span className="text-xs font-mono text-brand-light-pink">
                {(duration / 30).toFixed(2)}s ({duration} frames)
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={90}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="pro-slider w-full"
            />
            <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
              <span>Fast</span>
              <span>Medium</span>
              <span>Slow</span>
            </div>
          </div>

          {/* Categories */}
          <div className="p-4 border-b border-zinc-800/50">
            <div className="flex flex-wrap gap-2">
              <CategoryButton
                label="All"
                count={getAllTransitions().length}
                active={selectedCategory === "all"}
                onClick={() => setSelectedCategory("all")}
              />
              {categories.map((cat) => (
                <CategoryButton
                  key={cat.id}
                  label={cat.name}
                  count={cat.count}
                  active={selectedCategory === cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                />
              ))}
            </div>
          </div>

          {/* Transitions Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 gap-2">
              {transitions.map((transition) => (
                <TransitionCard
                  key={transition.id}
                  transition={transition}
                  onApply={handleApplyTransition}
                  isApplied={selectedTransition === transition.id}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {!canApplyTransition && (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div>
            <div className="p-4 rounded-full bg-zinc-800/30 mb-4 inline-block">
              <Zap className="w-8 h-8 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500 mb-2">No transition available</p>
            <p className="text-xs text-zinc-600">
              Add at least 2 clips and select the second clip
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════

interface CategoryButtonProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function CategoryButton({ label, count, active, onClick }: CategoryButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
        active
          ? "bg-brand-light-pink/15 text-brand-light-pink border border-brand-light-pink/30"
          : "bg-zinc-800/30 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600 hover:text-zinc-300"
      }`}
    >
      <span>{label}</span>
      <span
        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
          active ? "bg-brand-light-pink/20" : "bg-zinc-700/50"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

interface TransitionCardProps {
  transition: TransitionDefinition;
  onApply: (type: TransitionType) => void;
  isApplied: boolean;
}

function TransitionCard({ transition, onApply, isApplied }: TransitionCardProps) {
  return (
    <button
      onClick={() => onApply(transition.id)}
      disabled={isApplied}
      className={`group relative p-3 rounded-lg border transition-all duration-150 text-left ${
        isApplied
          ? "bg-brand-blue/10 border-brand-blue/30"
          : "bg-zinc-800/30 border-zinc-700/50 hover:border-brand-light-pink/30 hover:bg-zinc-800/50"
      }`}
    >
      {/* Preview Gradient */}
      <div
        className="h-12 rounded-lg mb-3 relative overflow-hidden"
        style={{ background: transition.previewGradient }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl opacity-50">{transition.icon}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-zinc-100 mb-0.5">
            {transition.name}
          </h4>
          <p className="text-xs text-zinc-500 leading-relaxed">
            {transition.description}
          </p>
        </div>
        {isApplied && (
          <div className="flex-shrink-0 p-1 rounded-full bg-brand-blue/20">
            <Check className="w-3.5 h-3.5 text-brand-blue" />
          </div>
        )}
      </div>

      {/* Duration Range */}
      <div className="flex items-center gap-2 text-[10px] text-zinc-600 mt-2">
        <span>Duration: {transition.duration.min}-{transition.duration.max} frames</span>
        <span className="px-1.5 py-0.5 bg-zinc-700/30 rounded">
          {transition.category}
        </span>
      </div>
    </button>
  );
}
