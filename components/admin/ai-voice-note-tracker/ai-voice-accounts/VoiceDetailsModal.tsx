"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Play, Pause, Copy, Check, Volume2, Settings, Tag } from "lucide-react";

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

interface VoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  voice: AIVoiceAccount | null;
}

export function VoiceDetailsModal({
  isOpen,
  onClose,
  voice,
}: VoiceDetailsModalProps) {
  const [playing, setPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handlePlayPreview = () => {
    if (!voice?.previewUrl) return;

    if (playing) {
      audioElement?.pause();
      setPlaying(false);
      setAudioElement(null);
    } else {
      const audio = new Audio(voice.previewUrl);
      audio.onended = () => {
        setPlaying(false);
        setAudioElement(null);
      };
      audio.play();
      setPlaying(true);
      setAudioElement(audio);
    }
  };

  const handleCopy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleClose = () => {
    audioElement?.pause();
    setPlaying(false);
    setAudioElement(null);
    onClose();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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

  if (!isOpen || !voice) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-4">
            <button
              onClick={handlePlayPreview}
              disabled={!voice.previewUrl}
              className={`p-3 rounded-xl transition-all ${
                voice.previewUrl
                  ? "bg-gradient-to-br from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"
              }`}
            >
              {playing ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6" />
              )}
            </button>
            <div>
              <h2 className="text-xl font-bold text-white">{voice.name}</h2>
              <div className="flex items-center space-x-2 mt-1">
                <span
                  className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${getCategoryColor(
                    voice.category
                  )}`}
                >
                  {voice.category || "Unknown"}
                </span>
                <span
                  className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                    voice.isActive
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {voice.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Description */}
          {voice.description && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Description
              </h3>
              <p className="text-gray-300">{voice.description}</p>
            </div>
          )}

          {/* Voice ID */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              ElevenLabs Voice ID
            </h3>
            <div className="flex items-center space-x-2">
              <code className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-300 font-mono text-sm">
                {voice.elevenlabsVoiceId}
              </code>
              <button
                onClick={() =>
                  handleCopy(voice.elevenlabsVoiceId, "voiceId")
                }
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                {copiedField === "voiceId" ? (
                  <Check className="h-5 w-5 text-green-400" />
                ) : (
                  <Copy className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* Voice Details Grid */}
          <div>
            <h3 className="flex items-center space-x-2 text-sm font-medium text-gray-400 mb-3">
              <Tag className="h-4 w-4" />
              <span>Voice Details</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {voice.gender && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Gender</p>
                  <p className="text-white capitalize">{voice.gender}</p>
                </div>
              )}
              {voice.age && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Age</p>
                  <p className="text-white capitalize">{voice.age}</p>
                </div>
              )}
              {voice.accent && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Accent</p>
                  <p className="text-white capitalize">{voice.accent}</p>
                </div>
              )}
              {voice.language && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Language</p>
                  <p className="text-white uppercase">{voice.language}</p>
                </div>
              )}
            </div>
          </div>

          {/* Labels */}
          {voice.labels && Object.keys(voice.labels).length > 0 && (
            <div>
              <h3 className="flex items-center space-x-2 text-sm font-medium text-gray-400 mb-3">
                <Volume2 className="h-4 w-4" />
                <span>Labels</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(voice.labels).map(([key, value]) => (
                  <span
                    key={key}
                    className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                  >
                    <span className="text-gray-500">{key}:</span>{" "}
                    <span className="text-gray-300">{value}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Voice Settings */}
          {voice.settings && Object.keys(voice.settings).length > 0 && (
            <div>
              <h3 className="flex items-center space-x-2 text-sm font-medium text-gray-400 mb-3">
                <Settings className="h-4 w-4" />
                <span>Voice Settings</span>
              </h3>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 space-y-3">
                {Object.entries(voice.settings).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-gray-400 capitalize">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="text-white">
                      {typeof value === "boolean"
                        ? value
                          ? "Yes"
                          : "No"
                        : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Usage Stats */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">
              Usage Statistics
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Total Usage</p>
                <p className="text-2xl font-bold text-orange-400">
                  {voice.usageCount}
                </p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Last Used</p>
                <p className="text-white">
                  {voice.lastUsedAt
                    ? formatDate(voice.lastUsedAt)
                    : "Never"}
                </p>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="pt-4 border-t border-slate-700">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Created</p>
                <p className="text-gray-300">{formatDate(voice.createdAt)}</p>
              </div>
              <div>
                <p className="text-gray-500">Last Updated</p>
                <p className="text-gray-300">{formatDate(voice.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-slate-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
