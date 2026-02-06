"use client";

import { useVideoEditorStore } from "@/stores/video-editor-store";
import { COLLAGE_PRESETS, type CollageLayout } from "@/lib/gif-maker/types";
import { X } from "lucide-react";

const SLOT_COLORS = ["#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#a855f7"];

const CATEGORIES: { key: string; label: string; layouts: CollageLayout[] }[] = [
  {
    key: "split",
    label: "Split Screen",
    layouts: ["split-h-50", "split-v-50", "split-h-70-30", "split-h-30-70"],
  },
  {
    key: "grid",
    label: "Grid",
    layouts: ["3-col", "1-top-2-bottom", "2-left-1-right", "grid-2x2"],
  },
  {
    key: "pip",
    label: "Picture-in-Picture",
    layouts: ["pip-top-left", "pip-top-right", "pip-bottom-left", "pip-bottom-right"],
  },
];

function MiniPreview({ layout, isActive }: { layout: CollageLayout; isActive: boolean }) {
  const preset = COLLAGE_PRESETS[layout];

  return (
    <div
      className={`w-full aspect-[3/4] rounded-md border-2 relative overflow-hidden transition-all duration-150 ${
        isActive
          ? "border-blue-400 bg-blue-500/10 shadow-[0_0_8px_rgba(59,130,246,0.3)]"
          : "border-[#252640] bg-[#0e0f1a] hover:border-[#354065]"
      }`}
    >
      {preset.slots.map((slot, i) => (
        <div
          key={i}
          className="absolute rounded-[2px]"
          style={{
            left: `${slot.x + 2}%`,
            top: `${slot.y + 2}%`,
            width: `${slot.width - 4}%`,
            height: `${slot.height - 4}%`,
            backgroundColor: `${SLOT_COLORS[i]}25`,
            border: `1.5px solid ${SLOT_COLORS[i]}50`,
          }}
        >
          <span
            className="absolute inset-0 flex items-center justify-center text-[8px] font-bold"
            style={{ color: `${SLOT_COLORS[i]}90` }}
          >
            {i + 1}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LayoutPicker() {
  const activeLayout = useVideoEditorStore((s) => s.settings.activeCollageLayout);
  const setCollageLayout = useVideoEditorStore((s) => s.setCollageLayout);

  return (
    <div className="flex flex-col h-full">
      {/* No Layout option */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={() => setCollageLayout(null)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
            activeLayout === null
              ? "bg-blue-500/15 text-blue-400 border border-blue-400/30"
              : "text-[#8490b0] hover:text-[#e6e8f0] hover:bg-[#1e2038] border border-transparent"
          }`}
        >
          <X className="h-3.5 w-3.5" />
          No Layout
          <span className="text-[10px] text-[#4d5578] ml-auto">Single track</span>
        </button>
      </div>

      {/* Layout categories */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {CATEGORIES.map((cat) => (
          <div key={cat.key} className="mb-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-[#4d5578] mb-2">
              {cat.label}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {cat.layouts.map((layoutKey) => {
                const preset = COLLAGE_PRESETS[layoutKey];
                const isActive = activeLayout === layoutKey;
                return (
                  <button
                    key={layoutKey}
                    onClick={() => setCollageLayout(layoutKey)}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <MiniPreview layout={layoutKey} isActive={isActive} />
                    <span
                      className={`text-[9px] font-medium transition-colors ${
                        isActive ? "text-blue-400" : "text-[#4d5578] group-hover:text-[#8490b0]"
                      }`}
                    >
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
