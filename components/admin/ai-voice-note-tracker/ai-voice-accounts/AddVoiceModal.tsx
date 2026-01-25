"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Search, Loader2, Plus, Volume2, Play, Pause } from "lucide-react";

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  description?: string;
  preview_url?: string;
  category?: string;
  labels?: {
    gender?: string;
    age?: string;
    accent?: string;
    description?: string;
    use_case?: string;
  };
}

interface AddVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (voiceData: {
    elevenlabsVoiceId: string;
    name?: string;
    description?: string;
    customApiKey?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export function AddVoiceModal({ isOpen, onClose, onAdd }: AddVoiceModalProps) {
  const [mode, setMode] = useState<"search" | "manual">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<ElevenLabsVoice | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Manual entry fields
  const [manualVoiceId, setManualVoiceId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");

  const fetchVoices = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      params.set("pageSize", "50");

      const response = await fetch(
        `/api/admin/ai-voice-accounts/elevenlabs?${params.toString()}`
      );

      if (response.ok) {
        const data = await response.json();
        setVoices(data.voices || []);
      } else {
        setError("Failed to fetch voices from ElevenLabs");
      }
    } catch (err) {
      console.error("Error fetching voices:", err);
      setError("Failed to fetch voices");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (isOpen && mode === "search") {
      fetchVoices();
    }
  }, [isOpen, mode, fetchVoices]);

  const handlePlayPreview = (voice: ElevenLabsVoice) => {
    if (!voice.preview_url) return;

    if (playingId === voice.voice_id) {
      audioElement?.pause();
      setPlayingId(null);
      setAudioElement(null);
    } else {
      audioElement?.pause();
      const audio = new Audio(voice.preview_url);
      audio.onended = () => {
        setPlayingId(null);
        setAudioElement(null);
      };
      audio.play();
      setPlayingId(voice.voice_id);
      setAudioElement(audio);
    }
  };

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);

    try {
      let voiceData;

      if (mode === "search" && selectedVoice) {
        voiceData = {
          elevenlabsVoiceId: selectedVoice.voice_id,
          name: selectedVoice.name,
          description: selectedVoice.description,
        };
      } else if (mode === "manual" && manualVoiceId) {
        voiceData = {
          elevenlabsVoiceId: manualVoiceId,
          name: manualName || undefined,
          description: manualDescription || undefined,
          customApiKey: customApiKey || undefined,
        };
      } else {
        setError("Please select or enter a voice");
        setSubmitting(false);
        return;
      }

      const result = await onAdd(voiceData);

      if (result.success) {
        handleClose();
      } else {
        setError(result.error || "Failed to add voice");
      }
    } catch (err) {
      console.error("Error adding voice:", err);
      setError("Failed to add voice");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    audioElement?.pause();
    setPlayingId(null);
    setAudioElement(null);
    setSelectedVoice(null);
    setSearchQuery("");
    setManualVoiceId("");
    setManualName("");
    setManualDescription("");
    setCustomApiKey("");
    setError("");
    setMode("search");
    onClose();
  };

  if (!isOpen) return null;

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
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-red-600 to-orange-600 rounded-lg">
              <Plus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Add Voice Account</h2>
              <p className="text-sm text-gray-400">
                Add an ElevenLabs voice to your account
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setMode("search")}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              mode === "search"
                ? "text-white border-b-2 border-red-500 bg-slate-800/50"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Search Voices
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              mode === "manual"
                ? "text-white border-b-2 border-red-500 bg-slate-800/50"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Enter Voice ID
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {mode === "search" ? (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search voices by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchVoices()}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              {/* Voice List */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 text-red-500 animate-spin" />
                </div>
              ) : voices.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Volume2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No voices found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {voices.map((voice) => (
                    <div
                      key={voice.voice_id}
                      onClick={() => setSelectedVoice(voice)}
                      className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedVoice?.voice_id === voice.voice_id
                          ? "border-red-500 bg-red-500/10"
                          : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/50"
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayPreview(voice);
                        }}
                        disabled={!voice.preview_url}
                        className={`p-2 rounded-lg ${
                          voice.preview_url
                            ? "bg-red-500/20 hover:bg-red-500/30 text-red-400"
                            : "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        {playingId === voice.voice_id ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white">{voice.name}</p>
                        <div className="flex items-center space-x-2 text-xs text-gray-400">
                          {voice.category && <span>{voice.category}</span>}
                          {voice.labels?.gender && (
                            <>
                              <span>•</span>
                              <span>{voice.labels.gender}</span>
                            </>
                          )}
                          {voice.labels?.accent && (
                            <>
                              <span>•</span>
                              <span>{voice.labels.accent}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {selectedVoice?.voice_id === voice.voice_id && (
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ElevenLabs Voice ID *
                </label>
                <input
                  type="text"
                  placeholder="e.g., 21m00Tcm4TlvDq8ikWAM"
                  value={manualVoiceId}
                  onChange={(e) => setManualVoiceId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Find the Voice ID in your ElevenLabs dashboard
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Display Name (optional)
                </label>
                <input
                  type="text"
                  placeholder="Custom name for this voice"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  placeholder="Describe this voice..."
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Custom API Key (optional)
                </label>
                <input
                  type="password"
                  placeholder="Leave empty to use default API key"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Use a dedicated API key for this voice account
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              submitting ||
              (mode === "search" && !selectedVoice) ||
              (mode === "manual" && !manualVoiceId)
            }
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Add Voice</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
