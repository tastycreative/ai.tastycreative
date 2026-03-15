"use client";

import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useVideoEditorStore } from "@/stores/video-editor-store";
import { useShallow } from "zustand/react/shallow";
import { useInstagramProfiles, type InstagramProfile } from "@/lib/hooks/useInstagramProfiles.query";
import { EditorToolbar } from "@/components/gif-maker/EditorToolbar";
import { EditorPreview } from "@/components/gif-maker/EditorPreview";
import { OverlayPanel } from "@/components/gif-maker/panels/OverlayPanel";
import { PropertiesPanel } from "@/components/gif-maker/panels/PropertiesPanel";
import { Timeline } from "@/components/gif-maker/timeline/Timeline";
import { ModelVaultBrowser } from "./ModelVaultBrowser";
import { WorkspaceClipPanel } from "./WorkspaceClipPanel";
import type { PreviewPlayerRef } from "@/components/gif-maker/PreviewPlayer";
import {
  Film,
  Layers,
  LayoutGrid,
  Sparkles,
  BookOpen,
  Search,
  User,
  ChevronDown,
  X,
} from "lucide-react";

const LayoutPicker = lazy(() =>
  import("@/components/gif-maker/panels/LayoutPicker").then((m) => ({
    default: m.LayoutPicker,
  }))
);
const EffectsPanel = lazy(() =>
  import("@/components/gif-maker/panels/EffectsPanel").then((m) => ({
    default: m.EffectsPanel,
  }))
);
const TemplateLibrary = lazy(() =>
  import("@/components/gif-maker/panels/TemplateLibrary").then((m) => ({
    default: m.TemplateLibrary,
  }))
);

export function GifMakerWorkspace() {
  const searchParams = useSearchParams();
  const initialProfileId = searchParams.get("profileId");
  const boardItemId = searchParams.get("boardItemId");

  const [selectedProfile, setSelectedProfile] = useState<InstagramProfile | null>(null);
  const { data: profiles, isLoading: loadingProfiles } = useInstagramProfiles();

  const playerRef = useRef<PreviewPlayerRef>(null);

  const { settings, clips, overlays, totalDurationInFrames } = useVideoEditorStore(
    useShallow((s) => ({
      settings: s.settings,
      clips: s.clips,
      overlays: s.overlays,
      totalDurationInFrames: s.totalDurationInFrames,
    }))
  );
  const setCurrentFrame = useVideoEditorStore((s) => s.setCurrentFrame);
  const setWorkspaceMode = useVideoEditorStore((s) => s.setWorkspaceMode);
  const clearWorkspaceMode = useVideoEditorStore((s) => s.clearWorkspaceMode);

  // Auto-select profile from URL params
  useEffect(() => {
    if (initialProfileId && profiles && !selectedProfile) {
      const profile = profiles.find((p) => p.id === initialProfileId);
      if (profile) setSelectedProfile(profile);
    }
  }, [initialProfileId, profiles, selectedProfile]);

  // Sync workspace mode with store
  useEffect(() => {
    if (selectedProfile) {
      setWorkspaceMode(selectedProfile.id, boardItemId);
    } else {
      clearWorkspaceMode();
    }
  }, [selectedProfile, boardItemId, setWorkspaceMode, clearWorkspaceMode]);

  // Clean up workspace mode on unmount
  useEffect(() => {
    return () => clearWorkspaceMode();
  }, [clearWorkspaceMode]);

  const handleFrameChange = useCallback(
    (frame: number) => {
      setCurrentFrame(frame);
      playerRef.current?.seekToFrame(frame);
    },
    [setCurrentFrame]
  );

  const handleTogglePlayback = useCallback(() => {
    const store = useVideoEditorStore.getState();
    if (store.isPlaying) {
      playerRef.current?.pause();
    } else {
      playerRef.current?.play();
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;

      const state = useVideoEditorStore.getState();
      const frame = state.currentFrame;
      const total = state.totalDurationInFrames;
      const frameFps = state.settings.fps;

      switch (e.code) {
        case "Space": {
          e.preventDefault();
          handleTogglePlayback();
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          handleFrameChange(Math.max(0, frame - 1));
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          handleFrameChange(Math.min(total - 1, frame + 1));
          break;
        }
        case "KeyJ": {
          e.preventDefault();
          handleFrameChange(Math.max(0, frame - frameFps));
          break;
        }
        case "KeyL": {
          e.preventDefault();
          handleFrameChange(Math.min(total - 1, frame + frameFps));
          break;
        }
        case "Home": {
          e.preventDefault();
          handleFrameChange(0);
          break;
        }
        case "End": {
          e.preventDefault();
          handleFrameChange(Math.max(0, total - 1));
          break;
        }
        case "Delete":
        case "Backspace": {
          if (state.selectedClipId) {
            state.removeClip(state.selectedClipId);
          } else if (state.selectedOverlayId) {
            state.removeOverlay(state.selectedOverlayId);
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFrameChange, handleTogglePlayback]);

  return (
    <>
      <style>{`
        .pro-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          background: rgba(39, 39, 42, 0.5);
          border-radius: 2px;
          outline: none;
          width: 100%;
        }
        .pro-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          background: linear-gradient(135deg, #F774B9 0%, #EC67A1 100%);
          border-radius: 50%;
          cursor: pointer;
          transition: box-shadow 0.2s ease;
        }
        .pro-slider::-webkit-slider-thumb:hover {
          box-shadow: 0 0 0 6px rgba(247, 116, 185, 0.2);
        }
        .pro-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          background: linear-gradient(135deg, #F774B9 0%, #EC67A1 100%);
          border-radius: 50%;
          cursor: pointer;
          border: none;
          transition: box-shadow 0.2s ease;
        }
        .pro-slider::-moz-range-thumb:hover {
          box-shadow: 0 0 0 6px rgba(247, 116, 185, 0.2);
        }
        .pro-slider::-moz-range-track {
          height: 4px;
          background: rgba(39, 39, 42, 0.5);
          border-radius: 2px;
        }
      `}</style>
      <div className="flex flex-col h-screen bg-[#0a0a0b] text-zinc-100 overflow-hidden relative">
        {/* Ambient background effects */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/5 rounded-full blur-[150px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/3 rounded-full blur-[200px]" />
        </div>

        {/* Model Selector Bar */}
        <div className="relative z-20">
          <ModelSelectorBar
            profiles={profiles ?? []}
            selectedProfile={selectedProfile}
            onSelect={setSelectedProfile}
            loading={loadingProfiles}
          />
        </div>

        {/* Top Toolbar */}
        <div className="relative z-10">
          <EditorToolbar playerRef={playerRef} />
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 min-h-0 overflow-hidden relative z-10">
          {/* Left Panel */}
          <div className="w-60 min-w-[240px] flex flex-col bg-zinc-900/40 backdrop-blur-xl border-r border-zinc-800/50">
            <WorkspaceLeftPanelTabs selectedProfileId={selectedProfile?.id ?? null} />
          </div>

          {/* Center: Preview Player */}
          <div className="flex-1 flex items-center justify-center p-6 min-w-0 bg-[#0a0a0b]/50 relative">
            <EditorPreview
              ref={playerRef}
              width={settings.width}
              height={settings.height}
              fps={settings.fps}
              durationInFrames={Math.max(1, totalDurationInFrames)}
            />
          </div>

          {/* Right Panel: Properties Inspector */}
          <div className="w-72 min-w-[280px] bg-zinc-900/40 backdrop-blur-xl border-l border-zinc-800/50 overflow-y-auto">
            <PropertiesPanel />
          </div>
        </div>

        {/* Resize handle */}
        <div className="h-1 w-full cursor-row-resize group flex-shrink-0 bg-[#0a0a0b] relative z-10">
          <div className="h-px w-full bg-zinc-800/50 group-hover:bg-gradient-to-r group-hover:from-brand-light-pink group-hover:via-brand-mid-pink group-hover:to-brand-blue transition-colors duration-150" />
        </div>

        {/* Bottom Timeline */}
        <div className="h-56 flex-shrink-0 relative z-10">
          <Timeline onFrameChange={handleFrameChange} onTogglePlayback={handleTogglePlayback} />
        </div>

        {/* Footer Status Bar */}
        <footer className="h-6 bg-zinc-900/80 backdrop-blur-sm border-t border-zinc-800/50 px-4 flex items-center justify-between text-[10px] text-zinc-500 font-medium flex-shrink-0 relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-blue shadow-[0_0_8px_rgba(93,195,248,0.5)]" />
              <span>System Ready</span>
            </div>
            <div className="h-3 w-px bg-zinc-800" />
            <span>GIF Maker Workspace v1.0</span>
            {selectedProfile && (
              <>
                <div className="h-3 w-px bg-zinc-800" />
                <span className="text-brand-light-pink">{selectedProfile.name}</span>
              </>
            )}
            {boardItemId && (
              <>
                <div className="h-3 w-px bg-zinc-800" />
                <span className="text-brand-blue">Board Item Linked</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>
              {clips.length} clip{clips.length !== 1 ? "s" : ""} | {overlays.length} overlay
              {overlays.length !== 1 ? "s" : ""}
            </span>
          </div>
        </footer>
      </div>
    </>
  );
}

// ─── Model Selector Bar ─────────────────────────────────

function ModelSelectorBar({
  profiles,
  selectedProfile,
  onSelect,
  loading,
}: {
  profiles: InstagramProfile[];
  selectedProfile: InstagramProfile | null;
  onSelect: (profile: InstagramProfile | null) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = profiles.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.username && p.username.toLowerCase().includes(search.toLowerCase()))
  );

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="h-12 bg-zinc-900/60 backdrop-blur-xl border-b border-zinc-800/50 px-4 flex items-center gap-3">
      {/* Label */}
      <div className="flex items-center gap-2 text-xs text-zinc-400 flex-shrink-0">
        <User className="w-4 h-4" />
        <span className="font-medium">Model:</span>
      </div>

      {/* Selector */}
      <div className="relative" ref={dropdownRef}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen(!open)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 hover:border-zinc-600/50 transition-colors min-w-[200px] cursor-pointer"
        >
          {selectedProfile ? (
            <>
              {selectedProfile.profileImageUrl ? (
                <img
                  src={selectedProfile.profileImageUrl}
                  alt={selectedProfile.name}
                  className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-light-pink to-brand-dark-pink flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-medium text-white">
                    {selectedProfile.name.charAt(0)}
                  </span>
                </div>
              )}
              <span className="text-xs font-medium text-zinc-100 truncate flex-1">
                {selectedProfile.name}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(null);
                    setOpen(false);
                  }}
                  className="p-1 rounded-md hover:bg-red-500/15 text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </div>
            </>
          ) : (
            <>
              <span className="text-xs text-zinc-500 flex-1">
                {loading ? "Loading..." : "Select a model..."}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-zinc-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </>
          )}
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute top-full left-0 mt-1 w-[300px] bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl overflow-hidden z-50">
            {/* Search */}
            <div className="p-2 border-b border-zinc-800/50">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search models..."
                  className="w-full pl-8 pr-3 py-1.5 bg-zinc-800/60 border border-zinc-700/30 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-brand-light-pink/50"
                  autoFocus
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-[300px] overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-zinc-500">
                  No models found
                </div>
              ) : (
                filtered.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => {
                      onSelect(profile);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-800/60 transition-colors ${
                      selectedProfile?.id === profile.id ? "bg-brand-light-pink/10" : ""
                    }`}
                  >
                    {profile.profileImageUrl ? (
                      <img
                        src={profile.profileImageUrl}
                        alt={profile.name}
                        className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-light-pink to-brand-dark-pink flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-medium text-white">
                          {profile.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-xs font-medium text-zinc-100 truncate">
                        {profile.name}
                      </div>
                      {profile.username && (
                        <div className="text-[10px] text-zinc-500">@{profile.username}</div>
                      )}
                    </div>
                    {selectedProfile?.id === profile.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-light-pink flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Board item indicator */}
      {useSearchParams().get("boardItemId") && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-blue/10 border border-brand-blue/20">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
          <span className="text-[10px] font-medium text-brand-blue">From Board</span>
        </div>
      )}
    </div>
  );
}

// ─── Workspace Left Panel Tabs ─────────────────────────────────

function WorkspaceLeftPanelTabs({ selectedProfileId }: { selectedProfileId: string | null }) {
  const [activeTab, setActiveTab] = useState<"clips" | "overlays" | "effects" | "layout" | "templates">("clips");

  return (
    <>
      <div className="grid grid-cols-5 h-11 bg-zinc-900/40 backdrop-blur-sm border-b border-zinc-800/50 flex-shrink-0">
        {[
          { key: "clips" as const, icon: Film, label: "Clips" },
          { key: "overlays" as const, icon: Layers, label: "Layers" },
          { key: "effects" as const, icon: Sparkles, label: "Effects" },
          { key: "templates" as const, icon: BookOpen, label: "Templates" },
          { key: "layout" as const, icon: LayoutGrid, label: "Layout" },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-all duration-150 relative px-1 ${
              activeTab === key
                ? "text-brand-light-pink"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="text-[10px] leading-none">{label}</span>
            {activeTab === key && (
              <span className="absolute bottom-0 left-1 right-1 h-[2px] bg-gradient-to-r from-brand-light-pink via-brand-mid-pink to-brand-dark-pink rounded-full" />
            )}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === "clips" ? (
          <WorkspaceClipPanel selectedProfileId={selectedProfileId} />
        ) : activeTab === "overlays" ? (
          <OverlayPanel />
        ) : activeTab === "effects" ? (
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs p-4">
                Loading...
              </div>
            }
          >
            <EffectsPanel />
          </Suspense>
        ) : activeTab === "templates" ? (
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs p-4">
                Loading...
              </div>
            }
          >
            <TemplateLibrary />
          </Suspense>
        ) : (
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs p-4">
                Loading...
              </div>
            }
          >
            <LayoutPicker />
          </Suspense>
        )}
      </div>
    </>
  );
}
