"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Play,
  Pause,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight,
  MoreVertical,
  Volume2,
  Copy,
  Check,
} from "lucide-react";

interface AIVoiceAccount {
  id: string;
  name: string;
  description: string | null;
  elevenlabsVoiceId: string;
  elevenlabsApiKey: string | null;
  previewUrl: string | null;
  category: string | null;
  gender: string | null;
  age: string | null;
  accent: string | null;
  language: string | null;
  labels: Record<string, string> | null;
  settings: Record<string, unknown> | null;
  isActive: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface AIVoiceAccountsTableProps {
  voices: AIVoiceAccount[];
  loading: boolean;
  onDelete: (id: string) => void;
  onToggleActive: (voice: AIVoiceAccount) => void;
  onViewDetails: (voice: AIVoiceAccount) => void;
}

export function AIVoiceAccountsTable({
  voices,
  loading,
  onDelete,
  onToggleActive,
  onViewDetails,
}: AIVoiceAccountsTableProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const dropdownButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openDropdown) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-dropdown-menu]') && !target.closest('[data-dropdown-trigger]')) {
          setOpenDropdown(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  const handleDropdownToggle = useCallback((voiceId: string, buttonElement: HTMLButtonElement | null) => {
    if (openDropdown === voiceId) {
      setOpenDropdown(null);
      setDropdownPosition(null);
    } else if (buttonElement) {
      const rect = buttonElement.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.right - 160, // 160px is the dropdown width (w-40)
      });
      setOpenDropdown(voiceId);
    }
  }, [openDropdown]);

  const handlePlayPreview = (voice: AIVoiceAccount) => {
    if (!voice.previewUrl) return;

    if (playingId === voice.id) {
      // Stop playing
      audioElement?.pause();
      setPlayingId(null);
      setAudioElement(null);
    } else {
      // Stop any currently playing audio
      audioElement?.pause();

      // Play new audio
      const audio = new Audio(voice.previewUrl);
      audio.onended = () => {
        setPlayingId(null);
        setAudioElement(null);
      };
      audio.play();
      setPlayingId(voice.id);
      setAudioElement(audio);
    }
  };

  const handleCopyId = async (voiceId: string) => {
    try {
      await navigator.clipboard.writeText(voiceId);
      setCopiedId(voiceId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getCategoryColor = (category: string | null) => {
    switch (category?.toLowerCase()) {
      case "professional":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "cloned":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "generated":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "premade":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
          <span className="ml-3 text-gray-400">Loading voices...</span>
        </div>
      </div>
    );
  }

  if (voices.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8">
        <div className="text-center">
          <Volume2 className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            No Voice Accounts Found
          </h3>
          <p className="text-gray-400">
            Add your first AI voice account to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">
                Voice
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">
                Voice ID
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">
                Category
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">
                Details
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">
                Status
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">
                Usage
              </th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">
                Added
              </th>
              <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {voices.map((voice) => (
              <tr
                key={voice.id}
                className="hover:bg-slate-700/30 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handlePlayPreview(voice)}
                      disabled={!voice.previewUrl}
                      className={`p-2 rounded-lg transition-all ${
                        voice.previewUrl
                          ? "bg-red-500/20 hover:bg-red-500/30 text-red-400"
                          : "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {playingId === voice.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                    <div>
                      <p className="font-medium text-white">{voice.name}</p>
                      {voice.description && (
                        <p className="text-xs text-gray-400 truncate max-w-[200px]">
                          {voice.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <code className="text-xs bg-slate-900/50 px-2 py-1 rounded text-gray-300 font-mono">
                      {voice.elevenlabsVoiceId.slice(0, 12)}...
                    </code>
                    <button
                      onClick={() => handleCopyId(voice.elevenlabsVoiceId)}
                      className="p-1 hover:bg-slate-700/50 rounded transition-colors"
                      title="Copy Voice ID"
                    >
                      {copiedId === voice.elevenlabsVoiceId ? (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getCategoryColor(
                      voice.category
                    )}`}
                  >
                    {voice.category || "Unknown"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-300 space-y-0.5">
                    {voice.gender && (
                      <p>
                        <span className="text-gray-500">Gender:</span>{" "}
                        {voice.gender}
                      </p>
                    )}
                    {voice.accent && (
                      <p>
                        <span className="text-gray-500">Accent:</span>{" "}
                        {voice.accent}
                      </p>
                    )}
                    {voice.age && (
                      <p>
                        <span className="text-gray-500">Age:</span> {voice.age}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => onToggleActive(voice)}
                    className="flex items-center space-x-2"
                  >
                    {voice.isActive ? (
                      <>
                        <ToggleRight className="h-6 w-6 text-green-400" />
                        <span className="text-sm text-green-400">Active</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="h-6 w-6 text-gray-500" />
                        <span className="text-sm text-gray-500">Inactive</span>
                      </>
                    )}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-300">{voice.usageCount}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-400">
                    {formatDate(voice.createdAt)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onViewDetails(voice)}
                      className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-gray-400 hover:text-white"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <div className="relative">
                      <button
                        ref={(el) => {
                          if (el) dropdownButtonRefs.current.set(voice.id, el);
                        }}
                        data-dropdown-trigger
                        onClick={() =>
                          handleDropdownToggle(voice.id, dropdownButtonRefs.current.get(voice.id) || null)
                        }
                        className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-gray-400 hover:text-white"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {openDropdown === voice.id && dropdownPosition && createPortal(
                        <div 
                          data-dropdown-menu
                          className="fixed w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-[100]"
                          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                        >
                          <button
                            onClick={() => {
                              onDelete(voice.id);
                              setOpenDropdown(null);
                            }}
                            className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>Delete</span>
                          </button>
                        </div>,
                        document.body
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
