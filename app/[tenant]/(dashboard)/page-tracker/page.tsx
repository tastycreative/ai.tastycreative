"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  usePageTracker,
  useCreateTrackerEntry,
  useUpdateTrackerEntry,
  useDeleteTrackerEntry,
  useCreateTrackerTeam,
  useUpdateTrackerTeam,
  useDeleteTrackerTeam,
  useUpdateTrackerConfig,
  useTrackerActivityLog,
  exportTrackerCSV,
  DEFAULT_STATUSES,
  DEFAULT_PLATFORMS,
  DEFAULT_SYSTEMS,
  type TrackerEntry,
  type TrackerTeam,
  type UnassignedProfile,
} from "@/lib/hooks/usePageTracker.query";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  X,
  Settings,
  Filter,
  LayoutGrid,
  List,
  Download,
  Clock,
  MessageSquare,
  FileText,
  Pause,
} from "lucide-react";
import { CONTENT_STYLES } from "@/components/content-submission/ContentStyleSelector";

// ─── Status badge colors ────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE: { bg: "bg-emerald-500/10 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  "ON PAUSE": { bg: "bg-amber-500/10 dark:bg-amber-500/20", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  LAUNCHING: { bg: "bg-blue-500/10 dark:bg-blue-500/20", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
};

const TEAM_COLORS = [
  "#EC67A1", "#5DC3F8", "#F774B9", "#10B981", "#F59E0B",
  "#8B5CF6", "#EF4444", "#06B6D4", "#F97316", "#6366F1",
];

function getStatusStyle(status: string) {
  return STATUS_COLORS[status] || {
    bg: "bg-gray-500/10 dark:bg-gray-500/20",
    text: "text-gray-700 dark:text-gray-400",
    dot: "bg-gray-500",
  };
}

// ─── Escape Key Hook ────────────────────────────────────────────────────────

function useEscapeKey(onEscape: () => void, active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onEscape, active]);
}

// ─── Add Entry Modal ────────────────────────────────────────────────────────

function AddEntryModal({
  profiles,
  teams,
  statuses,
  platforms,
  systems,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  profiles: UnassignedProfile[];
  teams: TrackerTeam[];
  statuses: string[];
  platforms: string[];
  systems: string[];
  onClose: () => void;
  onSubmit: (data: {
    profileId: string;
    teamId?: string;
    platformType?: string;
    managingSystem?: string;
    trackerStatus?: string;
    pausedContentStyles?: string[];
  }) => void;
  isSubmitting: boolean;
}) {
  const [profileId, setProfileId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [platformType, setPlatformType] = useState("");
  const [managingSystem, setManagingSystem] = useState("");
  const [trackerStatus, setTrackerStatus] = useState("ACTIVE");
  const [profileSearch, setProfileSearch] = useState("");
  const [pausedContentStyles, setPausedContentStyles] = useState<string[]>([]);

  const filteredProfiles = useMemo(() => {
    if (!profileSearch) return profiles;
    const q = profileSearch.toLowerCase();
    return profiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.instagramUsername?.toLowerCase().includes(q)
    );
  }, [profiles, profileSearch]);

  useEscapeKey(onClose);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add Page to Tracker
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Profile Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Select Model / Page *
            </label>
            <input
              type="text"
              placeholder="Search models..."
              value={profileSearch}
              onChange={(e) => setProfileSearch(e.target.value)}
              className="w-full px-3 py-2 mb-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-light-pink/50 focus:border-brand-light-pink outline-none"
            />
            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              {filteredProfiles.length === 0 ? (
                <div className="p-3 text-sm text-gray-500 text-center">
                  {profiles.length === 0
                    ? "All models are already in the tracker"
                    : "No matching models found"}
                </div>
              ) : (
                filteredProfiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProfileId(p.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      profileId === p.id
                        ? "bg-brand-light-pink/10 border-l-2 border-brand-light-pink"
                        : ""
                    }`}
                  >
                    {p.profileImageUrl ? (
                      <img
                        src={p.profileImageUrl}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-brand-light-pink/20 flex items-center justify-center text-brand-light-pink font-medium text-sm">
                        {p.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {p.name}
                      </div>
                      {p.instagramUsername && (
                        <div className="text-xs text-gray-500">
                          @{p.instagramUsername}
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Team */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Team
            </label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-light-pink/50 focus:border-brand-light-pink outline-none"
            >
              <option value="">Unassigned</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Platform Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Platform Type
            </label>
            <select
              value={platformType}
              onChange={(e) => setPlatformType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-light-pink/50 focus:border-brand-light-pink outline-none"
            >
              <option value="">Select platform...</option>
              {platforms.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Managing System */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Managing System
            </label>
            <select
              value={managingSystem}
              onChange={(e) => setManagingSystem(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-light-pink/50 focus:border-brand-light-pink outline-none"
            >
              <option value="">Select system...</option>
              {systems.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Status
            </label>
            <select
              value={trackerStatus}
              onChange={(e) => {
                const newStatus = e.target.value;
                setTrackerStatus(newStatus);
                if (newStatus === "ON PAUSE") {
                  setPausedContentStyles(CONTENT_STYLES.map((s) => s.id));
                } else {
                  setPausedContentStyles([]);
                }
              }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-light-pink/50 focus:border-brand-light-pink outline-none"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {trackerStatus === "ON PAUSE" && (
              <PausedContentStylesPicker
                selected={pausedContentStyles}
                onChange={setPausedContentStyles}
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!profileId) {
                toast.error("Please select a model/page");
                return;
              }
              onSubmit({
                profileId,
                teamId: teamId || undefined,
                platformType: platformType || undefined,
                managingSystem: managingSystem || undefined,
                trackerStatus,
                pausedContentStyles: trackerStatus === "ON PAUSE" ? pausedContentStyles : undefined,
              });
            }}
            disabled={!profileId || isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-light-pink hover:bg-brand-dark-pink rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Adding..." : "Add to Tracker"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Create Team Modal ──────────────────────────────────────────────────────

function CreateTeamModal({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void;
  onSubmit: (data: { name: string; color: string }) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(TEAM_COLORS[0]);

  useEscapeKey(onClose);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Team</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Team Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Alpha, Bravo, Charlie..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-light-pink/50 focus:border-brand-light-pink outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Team Color
            </label>
            <div className="flex flex-wrap gap-2">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c ? "border-gray-900 dark:border-white scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!name.trim()) {
                toast.error("Team name is required");
                return;
              }
              onSubmit({ name: name.trim(), color });
            }}
            disabled={!name.trim() || isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-light-pink hover:bg-brand-dark-pink rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Creating..." : "Create Team"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Settings Modal ─────────────────────────────────────────────────────────

function SettingsModal({
  config,
  onClose,
  onSave,
  isSaving,
}: {
  config: { customStatuses: string[]; customPlatforms: string[]; customSystems: string[] };
  onClose: () => void;
  onSave: (data: { customStatuses: string[]; customPlatforms: string[]; customSystems: string[] }) => void;
  isSaving: boolean;
}) {
  const [customStatuses, setCustomStatuses] = useState<string[]>(config.customStatuses);
  const [customPlatforms, setCustomPlatforms] = useState<string[]>(config.customPlatforms);
  const [customSystems, setCustomSystems] = useState<string[]>(config.customSystems);
  const [newStatus, setNewStatus] = useState("");
  const [newPlatform, setNewPlatform] = useState("");
  const [newSystem, setNewSystem] = useState("");

  useEscapeKey(onClose);

  const addItem = (list: string[], setList: (v: string[]) => void, value: string, setValue: (v: string) => void) => {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return;
    if (list.includes(trimmed)) {
      toast.error("Already exists");
      return;
    }
    setList([...list, trimmed]);
    setValue("");
  };

  const removeItem = (list: string[], setList: (v: string[]) => void, index: number) => {
    setList(list.filter((_, i) => i !== index));
  };

  const renderCustomList = (
    label: string,
    defaults: string[],
    custom: string[],
    setCustom: (v: string[]) => void,
    newValue: string,
    setNewValue: (v: string) => void
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {defaults.map((item) => (
          <span key={item} className="px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full">
            {item} (default)
          </span>
        ))}
        {custom.map((item, idx) => (
          <span key={item} className="px-2.5 py-1 text-xs font-medium bg-brand-light-pink/10 text-brand-dark-pink rounded-full flex items-center gap-1">
            {item}
            <button onClick={() => removeItem(custom, setCustom, idx)} className="hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem(custom, setCustom, newValue, setNewValue);
            }
          }}
          placeholder="Add custom option..."
          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-light-pink/50 focus:border-brand-light-pink outline-none"
        />
        <button
          onClick={() => addItem(custom, setCustom, newValue, setNewValue)}
          className="px-3 py-1.5 text-sm font-medium text-brand-light-pink bg-brand-light-pink/10 rounded-lg hover:bg-brand-light-pink/20"
        >
          Add
        </button>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tracker Settings
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          {renderCustomList("Statuses", DEFAULT_STATUSES, customStatuses, setCustomStatuses, newStatus, setNewStatus)}
          {renderCustomList("Platform Types", DEFAULT_PLATFORMS, customPlatforms, setCustomPlatforms, newPlatform, setNewPlatform)}
          {renderCustomList("Managing Systems", DEFAULT_SYSTEMS, customSystems, setCustomSystems, newSystem, setNewSystem)}
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ customStatuses, customPlatforms, customSystems })}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-light-pink hover:bg-brand-dark-pink rounded-lg disabled:opacity-50 transition-colors"
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Inline Edit Select ─────────────────────────────────────────────────────

function InlineSelect({
  value,
  options,
  onChange,
  placeholder,
  disabled,
}: {
  value: string | null;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-transparent border-0 text-sm text-gray-900 dark:text-white py-0.5 focus:ring-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option value="">{placeholder || "—"}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

// ─── Paused Content Styles Picker ────────────────────────────────────────────

function PausedContentStylesPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (styles: string[]) => void;
}) {
  const allIds = CONTENT_STYLES.map((s) => s.id);
  const allSelected = allIds.every((id) => selected.includes(id));

  return (
    <div className="mt-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <Pause className="w-3 h-3" />
          Paused Content Styles
        </span>
        <button
          type="button"
          onClick={() => onChange(allSelected ? [] : allIds)}
          className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline"
        >
          {allSelected ? "Deselect All" : "Select All"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CONTENT_STYLES.map((style) => {
          const isSelected = selected.includes(style.id);
          return (
            <button
              key={style.id}
              type="button"
              onClick={() => {
                onChange(
                  isSelected
                    ? selected.filter((s) => s !== style.id)
                    : [...selected, style.id]
                );
              }}
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border transition-all ${
                isSelected
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300"
                  : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-500"
              }`}
            >
              {isSelected && (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {style.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Entry Row ──────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  teams,
  statuses,
  platforms,
  systems,
  canEdit,
  onUpdate,
  onDelete,
}: {
  entry: TrackerEntry;
  teams: TrackerTeam[];
  statuses: string[];
  platforms: string[];
  systems: string[];
  canEdit: boolean;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setShowMenu(false), []);
  useEscapeKey(closeMenu, showMenu);
  const statusStyle = getStatusStyle(entry.trackerStatus);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(entry.notes || "");
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [showPausePicker, setShowPausePicker] = useState(false);

  useEffect(() => {
    setNotesValue(entry.notes || "");
  }, [entry.notes]);

  useEffect(() => {
    if (editingNotes && notesRef.current) {
      notesRef.current.focus();
      notesRef.current.style.height = 'auto';
      notesRef.current.style.height = notesRef.current.scrollHeight + 'px';
    }
  }, [editingNotes]);

  const saveNotes = () => {
    if (notesValue !== (entry.notes || "")) {
      onUpdate(entry.id, { notes: notesValue || null });
    }
    setEditingNotes(false);
  };

  return (
    <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group">
      {/* Model/Page Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {entry.profile.profileImageUrl ? (
            <img
              src={entry.profile.profileImageUrl}
              alt=""
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-brand-light-pink/20 flex items-center justify-center text-brand-light-pink font-medium text-xs shrink-0">
              {entry.profile.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {entry.profile.name}
            </div>
            {entry.profile.instagramUsername && (
              <div className="text-xs text-gray-500 truncate">
                @{entry.profile.instagramUsername}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Platform Type */}
      <td className="px-4 py-3">
        {canEdit ? (
          <InlineSelect
            value={entry.platformType}
            options={platforms}
            onChange={(v) => onUpdate(entry.id, { platformType: v || null })}
            placeholder="Select..."
          />
        ) : (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {entry.platformType || "—"}
          </span>
        )}
      </td>

      {/* Managing System */}
      <td className="px-4 py-3">
        {canEdit ? (
          <InlineSelect
            value={entry.managingSystem}
            options={systems}
            onChange={(v) => onUpdate(entry.id, { managingSystem: v || null })}
            placeholder="Select..."
          />
        ) : (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {entry.managingSystem || "—"}
          </span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <div>
          {canEdit ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <select
                value={entry.trackerStatus}
                onChange={(e) => {
                  const newStatus = e.target.value;
                  if (newStatus === "ON PAUSE") {
                    // Auto-select all content styles when switching to ON PAUSE
                    const allStyles = CONTENT_STYLES.map((s) => s.id);
                    onUpdate(entry.id, { trackerStatus: newStatus, pausedContentStyles: allStyles });
                    setShowPausePicker(true);
                  } else {
                    // Clear paused styles when switching away
                    onUpdate(entry.id, { trackerStatus: newStatus, pausedContentStyles: [] });
                    setShowPausePicker(false);
                  }
                }}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border-0 cursor-pointer focus:ring-0 ${statusStyle.bg} ${statusStyle.text}`}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {entry.trackerStatus === "ON PAUSE" && (
                <button
                  type="button"
                  onClick={() => setShowPausePicker(!showPausePicker)}
                  className="text-[10px] text-amber-500 hover:text-amber-400 transition-colors"
                  title="Edit paused content styles"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
              {entry.trackerStatus}
            </span>
          )}
          {/* Paused content style badges */}
          {entry.trackerStatus === "ON PAUSE" && entry.pausedContentStyles && entry.pausedContentStyles.length > 0 && !showPausePicker && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {entry.pausedContentStyles.map((styleId) => {
                const style = CONTENT_STYLES.find((s) => s.id === styleId);
                return (
                  <span
                    key={styleId}
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  >
                    {style?.name || styleId}
                  </span>
                );
              })}
            </div>
          )}
          {/* Inline paused content styles picker */}
          {showPausePicker && entry.trackerStatus === "ON PAUSE" && canEdit && (
            <PausedContentStylesPicker
              selected={entry.pausedContentStyles || []}
              onChange={(styles) => {
                onUpdate(entry.id, { pausedContentStyles: styles });
              }}
            />
          )}
        </div>
      </td>

      {/* Notes */}
      <td className="px-4 py-3">
        {editingNotes ? (
          <textarea
            ref={notesRef}
            value={notesValue}
            onChange={(e) => {
              setNotesValue(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            onBlur={saveNotes}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setNotesValue(entry.notes || ""); setEditingNotes(false); }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNotes(); }
            }}
            rows={1}
            className="w-full min-w-30 text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 border border-brand-light-pink/30 rounded-lg px-2.5 py-1.5 resize-none focus:ring-2 focus:ring-brand-light-pink/30 focus:border-brand-light-pink outline-none"
            placeholder="Add a note..."
          />
        ) : (
          <button
            onClick={() => {
              if (canEdit) setEditingNotes(true);
              else if (entry.notes) setNotesExpanded(!notesExpanded);
            }}
            className={`text-left text-xs max-w-45 group/notes ${canEdit ? 'cursor-text' : entry.notes ? 'cursor-pointer' : 'cursor-default'}`}
          >
            {entry.notes ? (
              <div className="flex items-start gap-1">
                <MessageSquare className="w-3 h-3 text-brand-light-pink shrink-0 mt-0.5" />
                <span className={`text-gray-600 dark:text-gray-400 ${notesExpanded ? '' : 'line-clamp-2'}`}>
                  {entry.notes}
                </span>
              </div>
            ) : canEdit ? (
              <span className="text-gray-400 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity italic">
                Add note...
              </span>
            ) : (
              <span className="text-gray-300 dark:text-gray-700">—</span>
            )}
          </button>
        )}
      </td>

      {/* Team */}
      <td className="px-4 py-3">
        {canEdit ? (
          <select
            value={entry.teamId || ""}
            onChange={(e) => onUpdate(entry.id, { teamId: e.target.value || null })}
            className="w-full bg-transparent border-0 text-sm text-gray-900 dark:text-white py-0.5 focus:ring-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
          >
            <option value="">Unassigned</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {entry.team?.name || "Unassigned"}
          </span>
        )}
      </td>

      {/* Actions */}
      {canEdit && (
        <td className="px-4 py-3 text-right">
          <div className="relative">
            <button
              ref={menuBtnRef}
              onClick={() => {
                if (!showMenu && menuBtnRef.current) {
                  const rect = menuBtnRef.current.getBoundingClientRect();
                  setMenuPos({ top: rect.bottom + window.scrollY + 4, left: rect.right + window.scrollX });
                }
                setShowMenu(!showMenu);
              }}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4 text-gray-400" />
            </button>
            {showMenu && createPortal(
              <>
                <div className="fixed inset-0 z-100" onClick={() => setShowMenu(false)} />
                <div
                  className="absolute z-101 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-35"
                  style={{ top: menuPos.top, left: menuPos.left, transform: 'translateX(-100%)' }}
                >
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(entry.id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                </div>
              </>,
              document.body
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

// ─── Team Group Section ─────────────────────────────────────────────────────

function TeamGroupSection({
  team,
  entries,
  teams,
  statuses,
  platforms,
  systems,
  canEdit,
  onUpdate,
  onDelete,
  onDeleteTeam,
  onRenameTeam,
}: {
  team: TrackerTeam | null;
  entries: TrackerEntry[];
  teams: TrackerTeam[];
  statuses: string[];
  platforms: string[];
  systems: string[];
  canEdit: boolean;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onDeleteTeam?: (id: string) => void;
  onRenameTeam?: (id: string, name: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showTeamMenu, setShowTeamMenu] = useState(false);
  const [teamMenuPos, setTeamMenuPos] = useState({ top: 0, left: 0 });
  const teamMenuBtnRef = useRef<HTMLButtonElement>(null);
  const closeTeamMenu = useCallback(() => setShowTeamMenu(false), []);
  useEscapeKey(closeTeamMenu, showTeamMenu);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(team?.name || "");

  const teamName = team?.name || "Unassigned";
  const teamColor = team?.color || "#6B7280";

  return (
    <div className="mb-6">
      {/* Team Header */}
      <div className="flex items-center gap-3 mb-2 px-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 group"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: teamColor }}
          />
          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => {
                if (renameValue.trim() && team && renameValue.trim() !== team.name) {
                  onRenameTeam?.(team.id, renameValue.trim());
                }
                setIsRenaming(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (renameValue.trim() && team && renameValue.trim() !== team.name) {
                    onRenameTeam?.(team.id, renameValue.trim());
                  }
                  setIsRenaming(false);
                }
                if (e.key === "Escape") {
                  setRenameValue(team?.name || "");
                  setIsRenaming(false);
                }
              }}
              autoFocus
              className="text-sm font-semibold text-gray-900 dark:text-white bg-transparent border-b border-brand-light-pink focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {teamName}
            </span>
          )}
          <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
            {entries.length}
          </span>
        </button>

        {canEdit && team && (
          <div className="relative ml-auto">
            <button
              ref={teamMenuBtnRef}
              onClick={() => {
                if (!showTeamMenu && teamMenuBtnRef.current) {
                  const rect = teamMenuBtnRef.current.getBoundingClientRect();
                  setTeamMenuPos({ top: rect.bottom + window.scrollY + 4, left: rect.right + window.scrollX });
                }
                setShowTeamMenu(!showTeamMenu);
              }}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4 text-gray-400" />
            </button>
            {showTeamMenu && createPortal(
              <>
                <div className="fixed inset-0 z-100" onClick={() => setShowTeamMenu(false)} />
                <div
                  className="absolute z-101 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-40"
                  style={{ top: teamMenuPos.top, left: teamMenuPos.left, transform: 'translateX(-100%)' }}
                >
                  <button
                    onClick={() => {
                      setShowTeamMenu(false);
                      setIsRenaming(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Pencil className="w-4 h-4" />
                    Rename Team
                  </button>
                  <button
                    onClick={() => {
                      setShowTeamMenu(false);
                      onDeleteTeam?.(team.id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Team
                  </button>
                </div>
              </>,
              document.body
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {!collapsed && (
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 rounded-xl overflow-hidden">
          {entries.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No pages assigned to this team
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model / Page</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">System</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                  {canEdit && <th className="px-4 py-2.5 w-12"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {entries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    teams={teams}
                    statuses={statuses}
                    platforms={platforms}
                    systems={systems}
                    canEdit={canEdit}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Activity Log Panel ─────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

const ACTION_STYLES: Record<string, { icon: string; color: string }> = {
  ADDED: { icon: "+", color: "text-emerald-500 bg-emerald-500/10" },
  CREATED: { icon: "+", color: "text-emerald-500 bg-emerald-500/10" },
  UPDATED: { icon: "~", color: "text-blue-500 bg-blue-500/10" },
  REMOVED: { icon: "-", color: "text-red-500 bg-red-500/10" },
  DELETED: { icon: "-", color: "text-red-500 bg-red-500/10" },
};

function ActivityLogPanel({ onClose }: { onClose: () => void }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useTrackerActivityLog();
  const scrollRef = useRef<HTMLDivElement>(null);
  useEscapeKey(onClose);

  const allItems = useMemo(() => {
    return data?.pages.flatMap((p) => p.items) || [];
  }, [data]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-light-pink/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-brand-light-pink" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Activity Log</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse flex gap-3">
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : allItems.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No activity yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {allItems.map((item) => {
                const style = ACTION_STYLES[item.action] || ACTION_STYLES.UPDATED;
                return (
                  <div key={item.id} className="flex gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${style.color}`}>
                      {style.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                        {item.details || `${item.action} ${item.entityType}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">
                          {item.user.firstName || item.user.email.split("@")[0]}
                        </span>
                        <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                        <span className="text-xs text-gray-400">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {hasNextPage && (
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="w-full py-2.5 text-xs font-medium text-brand-light-pink hover:text-brand-dark-pink transition-colors"
                >
                  {isFetchingNextPage ? "Loading..." : "Load more"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function PageTrackerPage() {
  const { data, isLoading, error } = usePageTracker();
  const { isAdmin } = useIsAdmin();

  const createEntry = useCreateTrackerEntry();
  const updateEntry = useUpdateTrackerEntry();
  const deleteEntry = useDeleteTrackerEntry();
  const createTeam = useCreateTrackerTeam();
  const updateTeam = useUpdateTrackerTeam();
  const deleteTeam = useDeleteTrackerTeam();
  const updateConfig = useUpdateTrackerConfig();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterSystem, setFilterSystem] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");

  // Merge default + custom options
  const allStatuses = useMemo(() => {
    const custom = data?.config?.customStatuses || [];
    return [...DEFAULT_STATUSES, ...custom];
  }, [data?.config?.customStatuses]);

  const allPlatforms = useMemo(() => {
    const custom = data?.config?.customPlatforms || [];
    return [...DEFAULT_PLATFORMS, ...custom];
  }, [data?.config?.customPlatforms]);

  const allSystems = useMemo(() => {
    const custom = data?.config?.customSystems || [];
    return [...DEFAULT_SYSTEMS, ...custom];
  }, [data?.config?.customSystems]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    if (!data?.entries) return [];
    let filtered = data.entries;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.profile.name.toLowerCase().includes(q) ||
          e.profile.instagramUsername?.toLowerCase().includes(q) ||
          e.team?.name.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== "ALL") {
      filtered = filtered.filter((e) => e.trackerStatus === filterStatus);
    }

    if (filterSystem !== "ALL") {
      filtered = filtered.filter((e) => e.managingSystem === filterSystem);
    }

    return filtered;
  }, [data?.entries, searchQuery, filterStatus, filterSystem]);

  // Group entries by team
  const groupedEntries = useMemo(() => {
    if (!data?.teams) return [];

    const teams = data.teams;
    const groups: { team: TrackerTeam | null; entries: TrackerEntry[] }[] = [];

    // Add each team group
    for (const team of teams) {
      groups.push({
        team,
        entries: filteredEntries.filter((e) => e.teamId === team.id),
      });
    }

    // Add unassigned group
    const unassigned = filteredEntries.filter((e) => !e.teamId);
    if (unassigned.length > 0 || groups.length === 0) {
      groups.push({ team: null, entries: unassigned });
    }

    return groups;
  }, [data?.teams, filteredEntries]);

  // Summary stats
  const stats = useMemo(() => {
    if (!data?.entries) return { total: 0, active: 0, paused: 0, launching: 0 };
    return {
      total: data.entries.length,
      active: data.entries.filter((e) => e.trackerStatus === "ACTIVE").length,
      paused: data.entries.filter((e) => e.trackerStatus === "ON PAUSE").length,
      launching: data.entries.filter((e) => e.trackerStatus === "LAUNCHING").length,
    };
  }, [data?.entries]);

  const handleUpdate = useCallback(
    async (id: string, updates: Record<string, unknown>) => {
      try {
        await updateEntry.mutateAsync({ id, ...updates } as Parameters<typeof updateEntry.mutateAsync>[0]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to update";
        toast.error(message);
      }
    },
    [updateEntry]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const entry = data?.entries.find((e) => e.id === id);
      const label = entry?.profile.name || "this page";
      if (!window.confirm(`Remove "${label}" from the tracker?`)) return;
      try {
        await deleteEntry.mutateAsync(id);
        toast.success("Removed from tracker");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to remove";
        toast.error(message);
      }
    },
    [deleteEntry, data?.entries]
  );

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-xl" />
              ))}
            </div>
            <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto text-center py-12">
          <p className="text-red-500">Failed to load tracker: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Schedulers/Account Managers Tracker
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Track which team manages each page, their platform, and current status
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowActivityLog(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Activity</span>
            </button>
            <button
              onClick={async () => {
                try {
                  setIsExporting(true);
                  await exportTrackerCSV();
                  toast.success("CSV exported");
                } catch {
                  toast.error("Failed to export CSV");
                } finally {
                  setIsExporting(false);
                }
              }}
              disabled={isExporting}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export"}</span>
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Settings</span>
                </button>
                <button
                  onClick={() => setShowCreateTeamModal(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">New Team</span>
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-linear-to-r from-brand-light-pink to-brand-dark-pink hover:from-brand-dark-pink hover:to-brand-light-pink rounded-lg transition-all shadow-sm shadow-brand-light-pink/20"
                >
                  <Plus className="w-4 h-4" />
                  Add Page
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
              <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <FileText className="w-4 h-4 text-gray-500" />
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">Total Pages</div>
          </div>
          <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-emerald-600">{stats.active}</div>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">Active</div>
          </div>
          <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-amber-600">{stats.paused}</div>
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">On Pause</div>
          </div>
          <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-blue-600">{stats.launching}</div>
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">Launching</div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search pages, teams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-light-pink/50 focus:border-brand-light-pink outline-none"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-light-pink/50 focus:border-brand-light-pink outline-none"
            >
              <option value="ALL">All Statuses</option>
              {allStatuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filterSystem}
              onChange={(e) => setFilterSystem(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-light-pink/50 focus:border-brand-light-pink outline-none"
            >
              <option value="ALL">All Systems</option>
              {allSystems.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grouped")}
                className={`p-2 ${viewMode === "grouped" ? "bg-brand-light-pink/10 text-brand-light-pink" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                title="Group by team"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("flat")}
                className={`p-2 ${viewMode === "flat" ? "bg-brand-light-pink/10 text-brand-light-pink" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                title="Flat list"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {data?.entries && data.entries.length > 0 && filteredEntries.length === 0 ? (
          <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 rounded-xl p-12 text-center">
            <Filter className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
              No matching pages
            </h3>
            <p className="text-sm text-gray-500">
              Try adjusting your search or filters
            </p>
          </div>
        ) : filteredEntries.length === 0 && data?.entries?.length === 0 ? (
          <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 rounded-xl p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-brand-light-pink/10 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-brand-light-pink" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No pages tracked yet
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Start by adding your models/pages to the tracker. They&apos;ll be pulled from your existing database — no duplicates.
            </p>
            {isAdmin && (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowCreateTeamModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <Users className="w-4 h-4" />
                  Create a Team
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-light-pink hover:bg-brand-dark-pink rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Add First Page
                </button>
              </div>
            )}
          </div>
        ) : viewMode === "grouped" ? (
          <div>
            {groupedEntries.map((group) => (
              <TeamGroupSection
                key={group.team?.id || "unassigned"}
                team={group.team}
                entries={group.entries}
                teams={data?.teams || []}
                statuses={allStatuses}
                platforms={allPlatforms}
                systems={allSystems}
                canEdit={isAdmin}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onDeleteTeam={async (id) => {
                  const team = data?.teams.find((t) => t.id === id);
                  if (!window.confirm(`Delete team "${team?.name || "this team"}"? Entries will become unassigned.`)) return;
                  try {
                    await deleteTeam.mutateAsync(id);
                    toast.success("Team deleted");
                  } catch {
                    toast.error("Failed to delete team");
                  }
                }}
                onRenameTeam={async (id, name) => {
                  try {
                    await updateTeam.mutateAsync({ id, name });
                    toast.success("Team renamed");
                  } catch {
                    toast.error("Failed to rename team");
                  }
                }}
              />
            ))}
          </div>
        ) : (
          /* Flat view */
          <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model / Page</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">System</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                  {isAdmin && <th className="px-4 py-2.5 w-12"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredEntries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    teams={data?.teams || []}
                    statuses={allStatuses}
                    platforms={allPlatforms}
                    systems={allSystems}
                    canEdit={isAdmin}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddEntryModal
          profiles={data?.unassignedProfiles || []}
          teams={data?.teams || []}
          statuses={allStatuses}
          platforms={allPlatforms}
          systems={allSystems}
          onClose={() => setShowAddModal(false)}
          isSubmitting={createEntry.isPending}
          onSubmit={async (formData) => {
            try {
              await createEntry.mutateAsync(formData);
              toast.success("Page added to tracker");
              setShowAddModal(false);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : "Failed to add page";
              toast.error(message);
            }
          }}
        />
      )}

      {showCreateTeamModal && (
        <CreateTeamModal
          onClose={() => setShowCreateTeamModal(false)}
          isSubmitting={createTeam.isPending}
          onSubmit={async (formData) => {
            try {
              await createTeam.mutateAsync(formData);
              toast.success("Team created");
              setShowCreateTeamModal(false);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : "Failed to create team";
              toast.error(message);
            }
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          config={{
            customStatuses: data?.config?.customStatuses || [],
            customPlatforms: data?.config?.customPlatforms || [],
            customSystems: data?.config?.customSystems || [],
          }}
          onClose={() => setShowSettings(false)}
          isSaving={updateConfig.isPending}
          onSave={async (configData) => {
            try {
              await updateConfig.mutateAsync(configData);
              toast.success("Settings saved");
              setShowSettings(false);
            } catch {
              toast.error("Failed to save settings");
            }
          }}
        />
      )}

      {showActivityLog && (
        <ActivityLogPanel onClose={() => setShowActivityLog(false)} />
      )}
    </div>
  );
}
