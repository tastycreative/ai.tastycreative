"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Pause,
  Download, 
  Volume2, 
  Loader2,
  RefreshCw,
  ChevronDown,
  Sparkles,
  Trash2,
  SlidersHorizontal,
  RotateCcw,
  Zap,
  AudioWaveform,
  DollarSign,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useCredits } from '@/lib/hooks/useCredits.query';
import { CreditCalculator } from "@/components/credits/CreditCalculator";
import { StorageFullBanner, useCanGenerate } from "@/components/generate-content/shared/StorageFullBanner";
import SalesTab from "./SalesTab";

interface Voice {
  id: string;
  name: string;
  description: string | null;
  elevenlabsVoiceId: string;
  previewUrl: string | null;
  category: string | null;
  gender: string | null;
  age: string | null;
  accent: string | null;
  language: string | null;
  labels: Record<string, string> | null;
  settings: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
    speed?: number;
  } | null;
}

interface VoiceSettings {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
  speed: number;
}

interface GeneratedAudio {
  id: string;
  text: string;
  voiceName: string;
  voiceAccountId: string;
  audioUrl: string | null;
  characterCount: number;
  createdAt: Date;
  outputFormat: string;
  modelId: string;
  voiceSettings: VoiceSettings | null;
  audioSize: number | null;
}

const OUTPUT_FORMATS = [
  { value: "mp3_44100_128", label: "MP3 128kbps" },
  { value: "mp3_44100_192", label: "MP3 192kbps" },
  { value: "mp3_22050_32", label: "MP3 32kbps" },
  { value: "pcm_16000", label: "PCM 16kHz" },
  { value: "pcm_22050", label: "PCM 22kHz" },
  { value: "pcm_24000", label: "PCM 24kHz" },
  { value: "pcm_44100", label: "PCM 44kHz" },
];

const MODELS = [
  { value: "eleven_multilingual_v2", label: "Multilingual v2" },
  { value: "eleven_v3", label: "Eleven v3" },
];

const DEFAULT_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: true,
  speed: 1.0,
};

export default function VoiceGeneratorPage() {
  const { refreshCredits } = useCredits();
  const { canGenerate, storageError } = useCanGenerate();
  const [activeTab, setActiveTab] = useState<"generator" | "sales">("generator");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAudios, setGeneratedAudios] = useState<GeneratedAudio[]>([]);
  const [expandedAudioId, setExpandedAudioId] = useState<string | null>(null);
  
  const [outputFormat, setOutputFormat] = useState("mp3_44100_128");
  const [modelId, setModelId] = useState("eleven_multilingual_v2");
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);

  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
  const [voiceDropdownPosition, setVoiceDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const voiceSelectorRef = useRef<HTMLButtonElement>(null);

  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);
  const [voiceSearch, setVoiceSearch] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newAudioId, setNewAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const historyListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchVoices();
    fetchHistory();
  }, []);

  const fetchVoices = async () => {
    setIsLoadingVoices(true);
    try {
      const response = await fetch("/api/ai-voice/voices");
      const data = await response.json();
      if (data.voices) {
        setVoices(data.voices);
        if (data.voices.length > 0 && !selectedVoice) {
          setSelectedVoice(data.voices[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch voices:", err);
      setError("Failed to load voices. Please refresh the page.");
    } finally {
      setIsLoadingVoices(false);
    }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch("/api/ai-voice/generations?limit=50");
      const data = await response.json();
      if (data.generations) {
        const historyAudios: GeneratedAudio[] = data.generations.map((gen: {
          id: string;
          text: string;
          voiceName: string;
          voiceAccountId: string;
          characterCount: number;
          outputFormat: string;
          modelId: string;
          audioUrl: string | null;
          audioSize: number | null;
          voiceSettings: VoiceSettings | null;
          createdAt: string;
        }) => ({
          id: gen.id,
          text: gen.text,
          voiceName: gen.voiceName,
          voiceAccountId: gen.voiceAccountId,
          audioUrl: gen.audioUrl,
          characterCount: gen.characterCount,
          createdAt: new Date(gen.createdAt),
          outputFormat: gen.outputFormat,
          modelId: gen.modelId,
          voiceSettings: gen.voiceSettings,
          audioSize: gen.audioSize,
        }));
        setGeneratedAudios(historyAudios);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleVoiceSelect = (voice: Voice) => {
    setSelectedVoice(voice);
    setIsVoiceDropdownOpen(false);
    setVoiceSearch("");
  };

  const openVoiceDropdown = () => {
    if (voiceSelectorRef.current) {
      const rect = voiceSelectorRef.current.getBoundingClientRect();
      setVoiceDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    }
    setIsVoiceDropdownOpen(true);
  };

  const handleGenerate = async () => {
    if (!selectedVoice || !text.trim()) return;

    // Check storage availability
    if (!canGenerate) {
      setError(storageError || "Storage is full. Please add more storage or free up space before generating.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai-voice/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: selectedVoice.elevenlabsVoiceId,
          text: text.trim(),
          modelId,
          outputFormat,
          voiceSettings,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate speech");
      }

      const newAudio: GeneratedAudio = {
        id: data.generationId || Date.now().toString(),
        text: text.trim(),
        voiceName: selectedVoice.name,
        voiceAccountId: selectedVoice.id,
        audioUrl: data.audioUrl || null,
        characterCount: data.characterCount,
        createdAt: new Date(),
        outputFormat,
        modelId,
        voiceSettings: { ...voiceSettings },
        audioSize: null,
      };

      setGeneratedAudios(prev => [newAudio, ...prev]);

      // Highlight new item and scroll history to top
      setNewAudioId(newAudio.id);
      setTimeout(() => setNewAudioId(null), 2200);
      if (historyListRef.current) historyListRef.current.scrollTop = 0;

      // Refresh credits after successful generation
      refreshCredits();

      // Auto-play the new generation
      if (audioRef.current && newAudio.audioUrl) {
        audioRef.current.src = newAudio.audioUrl;
        audioRef.current.play();
        setPlayingAudioId(newAudio.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate speech");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = (audio: GeneratedAudio) => {
    if (playingAudioId === audio.id) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (!audio.audioUrl) {
        setError("Audio not available for this generation.");
        return;
      }
      if (audioRef.current) {
        audioRef.current.src = audio.audioUrl;
        audioRef.current.play();
        setPlayingAudioId(audio.id);
      }
    }
  };

  const handlePreviewVoice = (voice: Voice, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!voice.previewUrl) return;

    if (previewVoiceId === voice.id && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPreviewVoiceId(null);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.src = voice.previewUrl;
      previewAudioRef.current.play();
      setPreviewVoiceId(voice.id);
    }
  };

  const handleDownload = async (audio: GeneratedAudio) => {
    if (!audio.audioUrl) {
      setError("Audio not available for download.");
      return;
    }
    try {
      const response = await fetch(audio.audioUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      const extension = audio.outputFormat.startsWith("mp3") ? "mp3" : "wav";
      link.download = `voice-${audio.voiceName.toLowerCase().replace(/\s+/g, "-")}-${audio.id.slice(0, 8)}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download audio.");
    }
  };

  const handleDelete = async (audio: GeneratedAudio) => {
    if (deleteConfirmId !== audio.id) {
      setDeleteConfirmId(audio.id);
      setTimeout(() => setDeleteConfirmId(prev => prev === audio.id ? null : prev), 3000);
      return;
    }
    setDeleteConfirmId(null);
    try {
      const response = await fetch(`/api/ai-voice/generations?id=${audio.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      setGeneratedAudios(prev => prev.filter(a => a.id !== audio.id));
      if (expandedAudioId === audio.id) setExpandedAudioId(null);
      if (playingAudioId === audio.id) {
        audioRef.current?.pause();
        setPlayingAudioId(null);
      }
    } catch (err) {
      console.error("Failed to delete generation:", err);
      setError("Failed to delete generation");
    }
  };

  const handleRestoreSettings = (audio: GeneratedAudio) => {
    // Restore text
    setText(audio.text);
    // Restore model
    setModelId(audio.modelId);
    // Restore voice
    const voice = voices.find(v => v.id === audio.voiceAccountId);
    if (voice) {
      setSelectedVoice(voice);
    }
    // Restore voice settings
    if (audio.voiceSettings) {
      setVoiceSettings(audio.voiceSettings);
    }
    // Restore output format
    setOutputFormat(audio.outputFormat);
    // Scroll voice selector into view
    voiceSelectorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-voice-dropdown]") && !target.closest("[data-voice-selector]")) {
        setIsVoiceDropdownOpen(false);
        setVoiceSearch("");
      }
    };
    
    if (isVoiceDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isVoiceDropdownOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isVoiceDropdownOpen) {
        setIsVoiceDropdownOpen(false);
        setVoiceSearch("");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVoiceDropdownOpen]);

  const filteredVoices = voiceSearch.trim()
    ? voices.filter(v => v.name.toLowerCase().includes(voiceSearch.toLowerCase()))
    : voices;

  const groupedVoices = filteredVoices.reduce((acc, voice) => {
    const category = voice.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(voice);
    return acc;
  }, {} as Record<string, Voice[]>);

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  const getModelLabel = (id: string) => MODELS.find(m => m.value === id)?.label || id;
  const getFormatLabel = (id: string) => OUTPUT_FORMATS.find(f => f.value === id)?.label || id;

  return (
    <div className="vg-root">
      <audio
        ref={audioRef}
        onEnded={() => { setPlayingAudioId(null); setAudioProgress(0); setAudioDuration(0); }}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setAudioProgress(audioRef.current.duration ? audioRef.current.currentTime / audioRef.current.duration : 0);
            setAudioDuration(audioRef.current.duration || 0);
          }
        }}
        className="hidden"
      />
      <audio ref={previewAudioRef} onEnded={() => setPreviewVoiceId(null)} className="hidden" />

      <div className="vg-app">
        {/* ── HEADER ── */}
        <header className="vg-header">
          <div className="flex items-center gap-3.5">
            <div className="vg-logo-icon">
              <AudioWaveform className="w-5.5 h-5.5 text-white" />
            </div>
            <div>
              <h1 className="vg-logo-title">Voice Generator</h1>
              <p className="vg-logo-sub">Text-to-speech · ElevenLabs</p>
            </div>
          </div>
          <div className="vg-badge">
            <div className="vg-pulse" />
            Live
          </div>
        </header>

        {/* ── TABS ── */}
        <div className="vg-tabs">
          <button
            className={`vg-tab${activeTab === "generator" ? " active" : ""}`}
            onClick={() => setActiveTab("generator")}
          >
            <AudioWaveform style={{ width: 14, height: 14 }} />
            Voice Generator
          </button>
          <button
            className={`vg-tab${activeTab === "sales" ? " active" : ""}`}
            onClick={() => setActiveTab("sales")}
          >
            <DollarSign style={{ width: 14, height: 14 }} />
            Sales
          </button>
        </div>

        {activeTab === "sales" ? (
          <SalesTab />
        ) : (
        <>
        {/* ── WORKSPACE: 3 columns ── */}
        <div className="vg-workspace">

          {/* ── COL 1: VOICE + SCRIPT ── */}
          <div className="vg-col-left">

            {/* Voice Card */}
            <div className="vg-card vg-voice-card">
              <div className="flex items-center justify-between mb-3">
                <div className="vg-card-header">
                  <div className="vg-card-dot" />
                  Voice
                </div>
                {selectedVoice?.previewUrl && (
                  <button
                    onClick={() => selectedVoice && handlePreviewVoice(selectedVoice)}
                    className={`vg-preview-btn ${previewVoiceId === selectedVoice?.id ? "active" : ""}`}
                  >
                    {previewVoiceId === selectedVoice?.id ? (
                      <Pause className="w-2.75 h-2.75" />
                    ) : (
                      <Volume2 className="w-2.75 h-2.75" />
                    )}
                    {previewVoiceId === selectedVoice?.id ? "Stop" : "Preview"}
                  </button>
                )}
              </div>

              <button
                ref={voiceSelectorRef}
                onClick={openVoiceDropdown}
                disabled={isLoadingVoices}
                data-voice-selector
                className="vg-voice-selector"
              >
                {isLoadingVoices ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-(--vg-accent) animate-spin" />
                    <span className="text-(--vg-text-dim)">Loading voices...</span>
                  </div>
                ) : selectedVoice ? (
                  <>
                    <div className="vg-voice-avatar">
                      {selectedVoice.name.charAt(0)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="vg-voice-name">{selectedVoice.name}</div>
                      <div className="vg-voice-meta">
                        {[selectedVoice.gender, selectedVoice.age, selectedVoice.accent].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </>
                ) : !isLoadingVoices && voices.length === 0 ? (
                  <span style={{ color: "#ff6060", fontSize: "13px" }}>No voices found — check your connection</span>
                ) : (
                  <span className="text-(--vg-text-dim)">Select a voice</span>
                )}
                <ChevronDown className={`w-3.75 h-3.75 text-(--vg-text-dim) shrink-0 transition-transform duration-200 ${isVoiceDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Voice Dropdown Portal */}
              {isVoiceDropdownOpen && typeof document !== "undefined" && createPortal(
                <div
                  data-voice-dropdown
                  className="vg-dropdown"
                  style={{
                    top: voiceDropdownPosition.top,
                    left: voiceDropdownPosition.left,
                    width: voiceDropdownPosition.width,
                    maxHeight: "360px",
                  }}
                >
                  <div className="vg-dd-search-wrap">
                    <input
                      type="text"
                      value={voiceSearch}
                      onChange={e => setVoiceSearch(e.target.value)}
                      placeholder="Search voices…"
                      className="vg-dd-search-input"
                      autoFocus
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                  <div className="overflow-y-auto max-h-90 vg-scrollbar">
                    {Object.entries(groupedVoices).length === 0 ? (
                      <div className="vg-dd-empty">No voices match &ldquo;{voiceSearch}&rdquo;</div>
                    ) : (
                      Object.entries(groupedVoices).map(([category, categoryVoices]) => (
                        <div key={category}>
                          <div className="vg-dd-category">{category}</div>
                          {categoryVoices.map((voice) => (
                            <button
                              key={voice.id}
                              onClick={() => handleVoiceSelect(voice)}
                              className={`vg-dd-voice ${selectedVoice?.id === voice.id ? "active" : ""}`}
                            >
                              <div className="vg-dd-avatar">{voice.name.charAt(0)}</div>
                              <div className="flex-1 text-left">
                                <div className="vg-dd-name">{voice.name}</div>
                                <div className="vg-dd-meta">
                                  {[voice.gender, voice.age, voice.accent].filter(Boolean).join(" · ")}
                                </div>
                              </div>
                              {voice.previewUrl && (
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => handlePreviewVoice(voice, e)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.stopPropagation();
                                      handlePreviewVoice(voice);
                                    }
                                  }}
                                  className={`vg-dd-preview-btn ${previewVoiceId === voice.id ? "active" : ""}`}
                                >
                                  {previewVoiceId === voice.id ? (
                                    <Pause className="w-3.25 h-3.25" />
                                  ) : (
                                    <Volume2 className="w-3.25 h-3.25" />
                                  )}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </div>,
                document.body
              )}
            </div>

            {/* Script Card */}
            <div className="vg-card vg-script-card">
              <div className="flex items-center justify-between mb-3">
                <div className="vg-card-header">
                  <div className="vg-card-dot" />
                  Script
                </div>
                <div className={`vg-char-badge ${text.length > 4500 ? (text.length > 5000 ? "text-[#ff6060]" : "text-[#ffb347]") : ""}`}>
                  {text.length.toLocaleString()} / 5,000
                </div>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter the text you want to convert to speech…"
                className="vg-textarea"
                maxLength={5000}
              />

              {/* Storage Warning */}
              <StorageFullBanner showWarning={!canGenerate} />

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isLoading || !selectedVoice || !text.trim() || text.length > 5000 || !canGenerate}
                className="vg-generate-btn"
              >
                {isLoading ? (
                  <>
                    <div className="vg-waveform">
                      <span /><span /><span /><span /><span /><span />
                    </div>
                    <span>Generating…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4.25 h-4.25" />
                    <span>Generate Speech</span>
                  </>
                )}
              </button>

              {error && (
                <div className="mt-3 p-3 rounded-xl text-sm" style={{ background: "rgba(255,60,60,0.08)", border: "1px solid rgba(255,60,60,0.18)", color: "#ff6060" }}>
                  {error}
                </div>
              )}
              {!isLoading && (text.length > 5000 || (!canGenerate && !!text.trim() && !!selectedVoice)) && (
                <p className="vg-btn-hint">
                  {text.length > 5000
                    ? `${(text.length - 5000).toLocaleString()} character${text.length - 5000 > 1 ? "s" : ""} over limit`
                    : "Storage full — free up space to generate"}
                </p>
              )}
            </div>
          </div>

          {/* ── COL 2: SETTINGS (always visible) ── */}
          <div className="vg-col-settings">
            <div className="vg-card vg-settings-card">
              <div className="flex items-center justify-between mb-5">
                <div className="vg-card-header">
                  <div className="vg-card-dot" />
                  Voice Settings
                </div>
                <button onClick={() => setVoiceSettings(DEFAULT_SETTINGS)} className="vg-reset-btn">
                  <RotateCcw className="w-2.75 h-2.75" />
                  Reset
                </button>
              </div>

              {/* Model Pills */}
              <div className="vg-sect-label">Model</div>
              <div className="vg-pill-group">
                {MODELS.map((model) => (
                  <button
                    key={model.value}
                    onClick={() => setModelId(model.value)}
                    className={`vg-pill ${modelId === model.value ? "active" : ""}`}
                  >
                    {model.label}
                  </button>
                ))}
              </div>

              {/* Format Pills grouped */}
              <div className="vg-sect-label">Output Format</div>
              <div className="flex flex-col gap-2 mb-5">
                <div>
                  <div className="vg-format-group-label">MP3</div>
                  <div className="vg-pill-group" style={{ marginBottom: 0 }}>
                    {OUTPUT_FORMATS.filter(f => f.value.startsWith("mp3")).map(format => (
                      <button
                        key={format.value}
                        onClick={() => setOutputFormat(format.value)}
                        className={`vg-pill ${outputFormat === format.value ? "active" : ""}`}
                      >
                        {format.label.replace("MP3 ", "")}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="vg-format-group-label">PCM</div>
                  <div className="vg-pill-group" style={{ marginBottom: 0 }}>
                    {OUTPUT_FORMATS.filter(f => f.value.startsWith("pcm")).map(format => (
                      <button
                        key={format.value}
                        onClick={() => setOutputFormat(format.value)}
                        className={`vg-pill ${outputFormat === format.value ? "active" : ""}`}
                      >
                        {format.label.replace("PCM ", "")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="vg-divider" />

              {/* Sliders */}
              <div className="flex flex-col gap-5">

                {/* Speed */}
                <div className="vg-slider-row">
                  <div className="vg-slider-top">
                    <div className="vg-slider-label">Speed</div>
                    <div className="vg-slider-val">{voiceSettings.speed.toFixed(2)}×</div>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.2"
                    step="0.01"
                    value={voiceSettings.speed}
                    onChange={(e) => setVoiceSettings(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                    className="vg-range"
                  />
                  <div className="vg-slider-hint">
                    <span>Slower</span><span>Faster</span>
                  </div>
                </div>

                {/* Stability */}
                <div className="vg-slider-row">
                  <div className="vg-slider-top">
                    <div className="vg-slider-label">Stability</div>
                    <div className="vg-slider-val">{Math.round(voiceSettings.stability * 100)}%</div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={voiceSettings.stability}
                    onChange={(e) => setVoiceSettings(prev => ({ ...prev, stability: parseFloat(e.target.value) }))}
                    className="vg-range"
                  />
                  <div className="vg-slider-hint">
                    <span>Variable</span><span>Stable</span>
                  </div>
                </div>

                {/* Similarity */}
                <div className="vg-slider-row">
                  <div className="vg-slider-top">
                    <div className="vg-slider-label">Similarity</div>
                    <div className="vg-slider-val">{Math.round(voiceSettings.similarityBoost * 100)}%</div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={voiceSettings.similarityBoost}
                    onChange={(e) => setVoiceSettings(prev => ({ ...prev, similarityBoost: parseFloat(e.target.value) }))}
                    className="vg-range"
                  />
                  <div className="vg-slider-hint">
                    <span>Low</span><span>High</span>
                  </div>
                </div>

                {/* Style Exaggeration */}
                <div className="vg-slider-row">
                  <div className="vg-slider-top">
                    <div className="vg-slider-label">Style Exaggeration</div>
                    <div className="vg-slider-val">{Math.round(voiceSettings.style * 100)}%</div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={voiceSettings.style}
                    onChange={(e) => setVoiceSettings(prev => ({ ...prev, style: parseFloat(e.target.value) }))}
                    className="vg-range"
                  />
                  <div className="vg-slider-hint">
                    <span>None</span><span>Exaggerated</span>
                  </div>
                </div>
              </div>

              {/* Speaker Boost Toggle */}
              <div className="vg-boost-row">
                <div>
                  <div className="vg-boost-label">
                    <Zap className="w-3.5 h-3.5 text-(--vg-accent-3)" />
                    Speaker Boost
                  </div>
                  <div className="vg-boost-desc">Enhances clarity and presence</div>
                </div>
                <label className="vg-toggle">
                  <input
                    type="checkbox"
                    checked={voiceSettings.useSpeakerBoost}
                    onChange={(e) => setVoiceSettings(prev => ({ ...prev, useSpeakerBoost: e.target.checked }))}
                  />
                  <div className="vg-toggle-track" />
                  <div className="vg-toggle-thumb" />
                </label>
              </div>
            </div>
          </div>

          {/* ── COL 3: HISTORY ── */}
          <div className="vg-col-history">
            <div className="vg-card vg-history-card">
              <div className="vg-history-header">
                <div className="vg-history-title">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--vg-accent)" }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  History
                  {generatedAudios.length > 0 && (
                    <div className="vg-history-count">{generatedAudios.length}</div>
                  )}
                </div>
                <button
                  onClick={fetchHistory}
                  disabled={isLoadingHistory}
                  className="vg-refresh-btn"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div ref={historyListRef} className="vg-history-list vg-scrollbar">
                {isLoadingHistory ? (
                  <div className="text-center py-16">
                    <Loader2 className="w-5 h-5 mx-auto text-(--vg-accent) animate-spin" />
                    <p className="text-xs mt-3" style={{ color: "var(--vg-text-dim)" }}>Loading history...</p>
                  </div>
                ) : generatedAudios.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ background: "var(--vg-surface-2)" }}>
                      <AudioWaveform className="w-6 h-6" style={{ color: "var(--vg-text-dim)" }} />
                    </div>
                    <p className="text-sm" style={{ color: "var(--vg-text-dim)" }}>No audio generated yet</p>
                    <p className="text-xs mt-1" style={{ color: "var(--vg-text-dim)", opacity: 0.6 }}>Your generations will appear here</p>
                  </div>
                ) : (
                  generatedAudios.map((audio) => {
                    const isExpanded = expandedAudioId === audio.id;
                    const isPlaying = playingAudioId === audio.id;
                    return (
                      <div key={audio.id} className={`vg-h-item${audio.id === newAudioId ? " vg-h-new" : ""}`}>
                        <div className="vg-h-row">
                          {/* Play button */}
                          <button
                            onClick={() => handlePlayPause(audio)}
                            className={`vg-play-btn ${isPlaying ? "playing" : ""}`}
                          >
                            {isPlaying ? (
                              <>
                                <div className="vg-playing-mini vg-play-default">
                                  <span /><span /><span /><span />
                                </div>
                                <Pause className="w-2.75 h-2.75 vg-play-hover" fill="currentColor" />
                              </>
                            ) : (
                              <Play className="w-2.75 h-2.75" fill="currentColor" />
                            )}
                          </button>

                          {/* Info */}
                          <div className="vg-h-info">
                            <div className="vg-h-voice">{audio.voiceName}</div>
                            <div className="vg-h-text">{audio.text}</div>
                          </div>

                          {/* Actions */}
                          <div className="vg-h-actions">
                            <span className="text-[9px] mr-1 hidden lg:inline" style={{ color: "var(--vg-text-dim)", fontFamily: "'DM Mono', monospace" }}>
                              {formatTimeAgo(new Date(audio.createdAt))}
                            </span>
                            <button
                              onClick={() => handleDownload(audio)}
                              className="vg-act-btn"
                              title="Download"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setExpandedAudioId(isExpanded ? null : audio.id)}
                              className={`vg-act-btn exp ${isExpanded ? "on" : ""}`}
                              title="Show details"
                            >
                              <SlidersHorizontal className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(audio)}
                              className={`vg-act-btn del${deleteConfirmId === audio.id ? " confirm" : ""}`}
                              title={deleteConfirmId === audio.id ? "Click again to confirm deletion" : "Delete"}
                            >
                              {deleteConfirmId === audio.id ? (
                                <span className="vg-del-confirm">?</span>
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        {isPlaying && (
                          <div className="vg-progress-bar">
                            <div className="vg-progress-fill" style={{ width: `${audioProgress * 100}%` }} />
                            <input
                              type="range" min={0} max={1} step={0.001}
                              value={audioProgress}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (audioRef.current && audioDuration) {
                                  audioRef.current.currentTime = v * audioDuration;
                                  setAudioProgress(v);
                                }
                              }}
                              className="vg-progress-seek"
                            />
                          </div>
                        )}

                        {/* Expandable detail */}
                        {isExpanded && (
                          <div className="vg-h-detail">
                            <div className="vg-detail-grid">
                              <div className="vg-detail-item">
                                <span>Model</span>
                                <span>{getModelLabel(audio.modelId)}</span>
                              </div>
                              <div className="vg-detail-item">
                                <span>Format</span>
                                <span>{getFormatLabel(audio.outputFormat)}</span>
                              </div>
                              <div className="vg-detail-item">
                                <span>Chars</span>
                                <span>{audio.characterCount.toLocaleString()}</span>
                              </div>
                              <div className="vg-detail-item">
                                <span>Speed</span>
                                <span>{audio.voiceSettings?.speed?.toFixed(2) ?? "1.00"}×</span>
                              </div>
                            </div>
                            <div className="vg-detail-text">{audio.text}</div>
                            <button onClick={() => handleRestoreSettings(audio)} className="vg-restore-btn">
                              <RotateCcw className="w-2.5 h-2.5" />
                              Restore settings
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
        </>
        )}
      </div>

      {/* ── STYLES ── */}
      <style jsx global>{`
        /* ── CSS Variables ── */
        /* Defined on :root so portal (createPortal → body) inherits them too */
        :root, .vg-root {
          --vg-bg: #080810;
          --vg-surface: #0e0e1a;
          --vg-surface-2: #13131f;
          --vg-border: rgba(255,255,255,0.06);
          --vg-border-glow: rgba(180,120,255,0.22);
          --vg-accent: #b47aff;
          --vg-accent-2: #ff6eb4;
          --vg-accent-3: #4fd1ff;
          --vg-text: #f0eeff;
          --vg-text-dim: rgba(240,238,255,0.42);
          --vg-text-mid: rgba(240,238,255,0.70);
          --vg-radius: 16px;
        }

        .vg-root {
          position: relative;
          background: var(--vg-bg);
          color: var(--vg-text);
          font-family: 'Cabinet Grotesk', system-ui, -apple-system, sans-serif;
          min-height: 100%;
          border-radius: 20px;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
        }

        .vg-root::before {
          content: '';
          position: absolute;
          top: -220px; left: 50%;
          transform: translateX(-50%);
          width: 1000px; height: 700px;
          background: radial-gradient(ellipse, rgba(130,70,255,0.11) 0%, transparent 68%);
          pointer-events: none; z-index: 0;
        }

        .vg-root::after {
          content: '';
          position: absolute;
          bottom: -80px; right: -80px;
          width: 500px; height: 500px;
          background: radial-gradient(ellipse, rgba(255,110,180,0.06) 0%, transparent 65%);
          pointer-events: none; z-index: 0;
        }

        .vg-app {
          position: relative; z-index: 1;
          max-width: 1260px;
          margin: 0 auto;
          padding: 32px 24px 80px;
        }

        /* ── HEADER ── */
        .vg-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 28px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--vg-border);
        }

        /* ── TABS ── */
        .vg-tabs {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px;
          background: var(--vg-surface);
          border: 1px solid var(--vg-border);
          border-radius: 12px;
          width: fit-content;
          margin-bottom: 28px;
        }
        .vg-tab {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 18px;
          border-radius: 9px;
          background: transparent;
          border: none;
          color: var(--vg-text-dim);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.18s;
          font-family: 'Cabinet Grotesk', system-ui, sans-serif;
        }
        .vg-tab svg { opacity: 0.6; }
        .vg-tab.active {
          background: var(--vg-surface-2);
          color: var(--vg-text);
          border: 1px solid var(--vg-border-glow);
          box-shadow: 0 2px 12px rgba(0,0,0,0.25);
        }
        .vg-tab.active svg { opacity: 1; color: var(--vg-accent); }
        .vg-tab:hover:not(.active) { color: var(--vg-text-mid); }

        .vg-logo-icon {
          width: 44px; height: 44px;
          background: linear-gradient(135deg, var(--vg-accent), var(--vg-accent-2));
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 28px rgba(180,120,255,0.3);
          flex-shrink: 0;
        }

        .vg-logo-title {
          font-family: 'Syne', system-ui, sans-serif;
          font-size: 20px; font-weight: 800; letter-spacing: -0.3px;
          background: linear-gradient(90deg, var(--vg-text) 0%, var(--vg-accent) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .vg-logo-sub {
          font-size: 12px; color: var(--vg-text-dim);
          font-family: 'DM Mono', monospace; letter-spacing: 0.02em; margin-top: 1px;
        }

        .vg-badge {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 16px;
          background: rgba(180,122,255,0.07);
          border: 1px solid rgba(180,122,255,0.18);
          border-radius: 100px;
          font-size: 12px; color: var(--vg-accent);
          font-family: 'DM Mono', monospace; letter-spacing: 0.05em;
        }

        .vg-pulse {
          width: 7px; height: 7px;
          background: var(--vg-accent); border-radius: 50%;
          animation: vg-pulse 2s ease-in-out infinite;
          box-shadow: 0 0 8px var(--vg-accent);
        }
        @keyframes vg-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:0.45; transform:scale(0.65); }
        }

        /* ── LAYOUT ── */
        .vg-workspace {
          display: grid;
          grid-template-columns: 260px 1fr 340px;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 1100px) {
          .vg-workspace { grid-template-columns: 1fr 1fr; }
          .vg-col-history { grid-column: 1 / -1; }
        }
        @media (max-width: 700px) {
          .vg-workspace { grid-template-columns: 1fr; }
        }

        /* ── CARD ── */
        .vg-card {
          background: var(--vg-surface);
          border: 1px solid var(--vg-border);
          border-radius: var(--vg-radius);
          transition: border-color 0.3s;
        }
        .vg-card:focus-within {
          border-color: var(--vg-border-glow);
          box-shadow: 0 8px 40px rgba(0,0,0,0.35);
        }

        .vg-card-header {
          display: flex; align-items: center; gap: 8px;
          font-size: 10px; font-family: 'DM Mono', monospace;
          color: var(--vg-text-dim); letter-spacing: 0.12em; text-transform: uppercase;
        }
        .vg-card-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--vg-accent); opacity: 0.8;
        }

        /* ── LEFT COL ── */
        .vg-col-left { display: flex; flex-direction: column; gap: 14px; }

        /* Voice Card */
        .vg-voice-card { padding: 16px 18px 18px; }

        .vg-preview-btn {
          padding: 6px 12px;
          background: rgba(180,120,255,0.09);
          border: 1px solid rgba(180,120,255,0.18);
          border-radius: 8px;
          color: var(--vg-accent); font-size: 11px;
          cursor: pointer; display: flex; align-items: center; gap: 5px;
          transition: all 0.2s; font-family: 'DM Mono', monospace;
        }
        .vg-preview-btn:hover { background: rgba(180,120,255,0.16); }

        .vg-voice-selector {
          width: 100%;
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px;
          background: var(--vg-surface-2);
          border: 1px solid var(--vg-border);
          border-radius: 12px;
          cursor: pointer; color: var(--vg-text);
          transition: all 0.2s;
        }
        .vg-voice-selector:hover {
          border-color: rgba(180,120,255,0.28);
          background: rgba(180,120,255,0.04);
        }

        .vg-voice-avatar {
          width: 40px; height: 40px;
          background: linear-gradient(135deg, var(--vg-accent), var(--vg-accent-2));
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 17px; color: white;
          flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(180,120,255,0.22);
        }
        .vg-voice-name { font-weight: 600; font-size: 14px; }
        .vg-voice-meta { font-size: 10px; color: var(--vg-text-dim); font-family: 'DM Mono', monospace; margin-top: 2px; }

        /* Dropdown */
        .vg-dropdown {
          position: fixed; z-index: 9999;
          background: var(--vg-surface-2);
          border: 1px solid rgba(180,120,255,0.18);
          border-radius: 12px; overflow: hidden;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          animation: vg-fadeSlide 0.18s ease;
        }
        @keyframes vg-fadeSlide { from { opacity:0; transform:translateY(-5px); } to { opacity:1; transform:translateY(0); } }

        .vg-dd-category {
          padding: 9px 14px 5px;
          font-size: 9px; font-family: 'DM Mono', monospace;
          color: var(--vg-text-dim); letter-spacing: 0.12em; text-transform: uppercase;
          border-bottom: 1px solid var(--vg-border); background: rgba(255,255,255,0.01);
          position: sticky; top: 0; z-index: 1;
        }

        .vg-dd-voice {
          width: 100%;
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; cursor: pointer;
          transition: background 0.15s;
          border-left: 2px solid transparent;
          background: transparent; border-top: none; border-bottom: none; border-right: none;
          color: var(--vg-text); text-align: left;
        }
        .vg-dd-voice:hover { background: rgba(180,120,255,0.05); }
        .vg-dd-voice.active { border-left-color: var(--vg-accent); background: rgba(180,120,255,0.07); }

        .vg-dd-avatar {
          width: 32px; height: 32px;
          background: linear-gradient(135deg, var(--vg-accent), var(--vg-accent-2));
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; color: white; flex-shrink: 0;
        }
        .vg-dd-name { font-size: 13px; font-weight: 600; }
        .vg-dd-meta { font-size: 10px; color: var(--vg-text-dim); font-family: 'DM Mono', monospace; margin-top: 1px; }

        .vg-dd-preview-btn {
          width: 26px; height: 26px; border-radius: 6px;
          background: transparent; border: none;
          color: var(--vg-text-dim); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; flex-shrink: 0;
        }
        .vg-dd-preview-btn:hover { background: rgba(180,120,255,0.12); color: var(--vg-accent); }

        /* Script Card */
        .vg-script-card { padding: 16px 18px 18px; }

        .vg-char-badge {
          font-size: 10px; font-family: 'DM Mono', monospace; color: var(--vg-text-dim);
          background: var(--vg-surface-2); border: 1px solid var(--vg-border);
          padding: 3px 9px; border-radius: 100px;
        }

        .vg-textarea {
          width: 100%; min-height: 190px;
          padding: 14px;
          background: var(--vg-surface-2);
          border: 1px solid var(--vg-border);
          border-radius: 12px;
          color: var(--vg-text); font-family: 'Cabinet Grotesk', system-ui, sans-serif;
          font-size: 14px; line-height: 1.7; resize: vertical; outline: none;
          caret-color: var(--vg-accent); transition: border-color 0.2s;
        }
        .vg-textarea::placeholder { color: rgba(240,238,255,0.18); }
        .vg-textarea:focus { border-color: rgba(180,120,255,0.28); box-shadow: 0 0 0 3px rgba(180,120,255,0.05); }

        /* Generate Button */
        .vg-generate-btn {
          width: 100%; padding: 15px;
          background: linear-gradient(135deg, var(--vg-accent) 0%, var(--vg-accent-2) 100%);
          border: none; border-radius: 13px;
          color: white; font-family: 'Syne', system-ui, sans-serif; font-size: 15px; font-weight: 700;
          letter-spacing: 0.02em; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 9px;
          transition: all 0.25s;
          box-shadow: 0 8px 28px rgba(180,120,255,0.22), 0 2px 8px rgba(0,0,0,0.3);
          margin-top: 12px; position: relative; overflow: hidden;
        }
        .vg-generate-btn::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
          opacity: 0; transition: opacity 0.2s;
        }
        .vg-generate-btn:hover::before { opacity: 1; }
        .vg-generate-btn:hover { transform: translateY(-1px); box-shadow: 0 14px 38px rgba(180,120,255,0.32), 0 4px 12px rgba(0,0,0,0.3); }
        .vg-generate-btn:active { transform: translateY(0); }
        .vg-generate-btn:disabled { opacity: 0.6; transform: none; cursor: not-allowed; }

        .vg-waveform { display: flex; align-items: center; gap: 3px; height: 18px; }
        .vg-waveform span { display: block; width: 3px; background: white; border-radius: 100px; animation: vg-wv 1.1s ease-in-out infinite; }
        .vg-waveform span:nth-child(1){height:6px;animation-delay:0s}
        .vg-waveform span:nth-child(2){height:13px;animation-delay:0.1s}
        .vg-waveform span:nth-child(3){height:18px;animation-delay:0.2s}
        .vg-waveform span:nth-child(4){height:10px;animation-delay:0.3s}
        .vg-waveform span:nth-child(5){height:16px;animation-delay:0.4s}
        .vg-waveform span:nth-child(6){height:7px;animation-delay:0.5s}
        @keyframes vg-wv {
          0%,100%{transform:scaleY(0.35);opacity:0.5}
          50%{transform:scaleY(1);opacity:1}
        }

        /* ── SETTINGS COL ── */
        .vg-settings-card { padding: 20px 22px 22px; }

        .vg-reset-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 11px;
          background: transparent;
          border: 1px solid var(--vg-border);
          border-radius: 8px;
          color: var(--vg-text-dim); font-size: 11px;
          font-family: 'DM Mono', monospace;
          cursor: pointer; transition: all 0.2s;
          letter-spacing: 0.04em;
        }
        .vg-reset-btn:hover { border-color: rgba(180,120,255,0.25); color: var(--vg-accent); }

        .vg-sect-label {
          font-size: 9px; font-family: 'DM Mono', monospace;
          color: var(--vg-text-dim); letter-spacing: 0.12em; text-transform: uppercase;
          margin-bottom: 9px;
        }

        .vg-pill-group {
          display: flex; flex-wrap: wrap; gap: 4px;
          margin-bottom: 22px;
        }

        .vg-pill {
          padding: 6px 13px;
          border-radius: 8px;
          background: var(--vg-surface-2);
          border: 1px solid var(--vg-border);
          color: var(--vg-text-dim); font-size: 11px;
          font-family: 'DM Mono', monospace;
          cursor: pointer; transition: all 0.18s;
          white-space: nowrap;
        }
        .vg-pill.active {
          background: rgba(180,120,255,0.15);
          border-color: rgba(180,120,255,0.35);
          color: var(--vg-accent);
          box-shadow: 0 0 10px rgba(180,120,255,0.1);
        }
        .vg-pill:hover:not(.active) { border-color: rgba(180,120,255,0.18); color: var(--vg-text-mid); }

        .vg-divider { height: 1px; background: var(--vg-border); margin: 20px 0; }

        /* Sliders */
        .vg-slider-row { display: flex; flex-direction: column; gap: 9px; }
        .vg-slider-top { display: flex; align-items: center; justify-content: space-between; }
        .vg-slider-label { font-size: 13px; color: var(--vg-text-mid); font-weight: 500; }
        .vg-slider-val {
          font-size: 11px; font-family: 'DM Mono', monospace;
          color: var(--vg-accent);
          background: rgba(180,120,255,0.1);
          border: 1px solid rgba(180,120,255,0.18);
          padding: 2px 9px; border-radius: 6px;
          min-width: 46px; text-align: center;
        }
        .vg-slider-hint {
          display: flex; justify-content: space-between;
          font-size: 9px; font-family: 'DM Mono', monospace;
          color: rgba(240,238,255,0.22); letter-spacing: 0.04em;
          margin-top: -2px;
        }

        .vg-range {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 4px;
          background: rgba(255,255,255,0.06);
          border-radius: 100px;
          outline: none; cursor: pointer;
        }
        .vg-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 17px; height: 17px;
          border-radius: 50%;
          background: white;
          border: 3px solid var(--vg-accent);
          box-shadow: 0 0 14px rgba(180,120,255,0.45);
          cursor: pointer; transition: box-shadow 0.2s;
        }
        .vg-range:hover::-webkit-slider-thumb { box-shadow: 0 0 22px rgba(180,120,255,0.65); }
        .vg-range::-moz-range-thumb {
          width: 17px; height: 17px;
          border-radius: 50%;
          background: white;
          border: 3px solid var(--vg-accent);
          box-shadow: 0 0 14px rgba(180,120,255,0.45);
          cursor: pointer; border: 3px solid var(--vg-accent);
        }

        /* Speaker Boost */
        .vg-boost-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 0 0;
          border-top: 1px solid var(--vg-border);
          margin-top: 4px;
        }
        .vg-boost-label {
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; font-weight: 500; color: var(--vg-text-mid);
        }
        .vg-boost-desc { font-size: 11px; color: var(--vg-text-dim); padding-left: 22px; }

        .vg-toggle { position: relative; width: 42px; height: 24px; flex-shrink: 0; cursor: pointer; display: block; }
        .vg-toggle input { display: none; }
        .vg-toggle-track {
          position: absolute; inset: 0;
          background: var(--vg-surface-2); border: 1px solid var(--vg-border);
          border-radius: 100px; cursor: pointer; transition: all 0.22s;
        }
        .vg-toggle input:checked + .vg-toggle-track {
          background: var(--vg-accent); border-color: var(--vg-accent);
          box-shadow: 0 0 18px rgba(180,120,255,0.28);
        }
        .vg-toggle-thumb {
          position: absolute; left: 4px; top: 4px;
          width: 14px; height: 14px;
          border-radius: 50%; background: var(--vg-text-dim);
          transition: all 0.22s; pointer-events: none;
        }
        .vg-toggle input:checked ~ .vg-toggle-thumb { left: 22px; background: white; }

        /* ── HISTORY COL ── */
        .vg-history-card {
          padding: 18px;
          position: sticky; top: 24px;
          max-height: calc(100vh - 120px);
          display: flex; flex-direction: column;
        }
        .vg-history-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 16px; flex-shrink: 0;
        }
        .vg-history-title {
          display: flex; align-items: center; gap: 8px;
          font-family: 'Syne', system-ui, sans-serif; font-size: 13px; font-weight: 700;
          color: var(--vg-text);
        }
        .vg-history-count {
          font-size: 10px; font-family: 'DM Mono', monospace;
          background: rgba(180,120,255,0.1); color: var(--vg-accent);
          border: 1px solid rgba(180,120,255,0.2);
          padding: 1px 8px; border-radius: 100px;
        }
        .vg-refresh-btn {
          width: 29px; height: 29px; border-radius: 8px;
          background: transparent; border: 1px solid var(--vg-border);
          color: var(--vg-text-dim); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .vg-refresh-btn:hover { border-color: rgba(180,120,255,0.28); color: var(--vg-accent); }

        .vg-history-list {
          overflow-y: auto; flex: 1;
          display: flex; flex-direction: column; gap: 2px;
          padding-right: 2px;
        }

        /* History item */
        .vg-h-item { border-radius: 10px; overflow: hidden; }
        .vg-h-row {
          display: flex; align-items: center; gap: 9px;
          padding: 9px; border-radius: 9px;
          transition: background 0.15s;
        }
        .vg-h-item:hover .vg-h-row { background: rgba(255,255,255,0.025); }

        .vg-play-btn {
          width: 30px; height: 30px; border-radius: 50%;
          background: var(--vg-surface-2); border: 1px solid var(--vg-border);
          color: var(--vg-text-mid);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0; transition: all 0.2s;
        }
        .vg-play-btn:hover, .vg-play-btn.playing {
          background: var(--vg-accent); border-color: var(--vg-accent); color: white;
          box-shadow: 0 0 16px rgba(180,120,255,0.38);
        }

        .vg-h-info { flex: 1; min-width: 0; }
        .vg-h-voice { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--vg-text); }
        .vg-h-text { font-size: 11px; color: var(--vg-text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }

        .vg-h-actions {
          display: flex; align-items: center; gap: 1px; flex-shrink: 0;
          opacity: 0; transition: opacity 0.15s;
        }
        .vg-h-item:hover .vg-h-actions { opacity: 1; }

        .vg-act-btn {
          width: 25px; height: 25px; border-radius: 6px;
          background: transparent; border: none;
          color: var(--vg-text-dim); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .vg-act-btn:hover { background: rgba(255,255,255,0.05); color: var(--vg-text); }
        .vg-act-btn.del:hover { background: rgba(255,60,60,0.1); color: #ff6060; }
        .vg-act-btn.exp:hover, .vg-act-btn.exp.on { background: rgba(180,120,255,0.1); color: var(--vg-accent); }

        /* Expanded detail */
        .vg-h-detail {
          margin: 0 6px 6px;
          padding: 13px; border-radius: 9px;
          background: var(--vg-surface-2); border: 1px solid var(--vg-border);
          animation: vg-fadeIn 0.18s ease;
        }
        @keyframes vg-fadeIn { from{opacity:0} to{opacity:1} }

        .vg-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-bottom: 11px; }
        .vg-detail-item span:first-child {
          display: block; font-size: 9px; font-family: 'DM Mono', monospace;
          color: var(--vg-text-dim); margin-bottom: 2px; letter-spacing: 0.05em;
        }
        .vg-detail-item span:last-child { font-size: 12px; font-weight: 600; color: var(--vg-text-mid); }

        .vg-detail-text {
          font-size: 11px; color: var(--vg-text-dim); line-height: 1.6;
          background: rgba(0,0,0,0.18); padding: 9px; border-radius: 7px;
          margin-bottom: 10px;
          max-height: 80px; overflow-y: auto;
        }

        .vg-restore-btn {
          width: 100%; padding: 8px;
          background: transparent;
          border: 1px solid rgba(180,120,255,0.18);
          border-radius: 8px; color: var(--vg-accent);
          font-size: 11px; font-family: 'DM Mono', monospace;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;
          transition: all 0.2s; letter-spacing: 0.04em;
        }
        .vg-restore-btn:hover { background: rgba(180,120,255,0.07); }

        /* Playing mini bars */
        .vg-playing-mini { display: flex; align-items: center; gap: 2px; height: 13px; }
        .vg-playing-mini span { display: block; width: 2px; background: white; border-radius: 100px; animation: vg-wv 0.8s ease-in-out infinite; }
        .vg-playing-mini span:nth-child(1){height:5px;animation-delay:0s}
        .vg-playing-mini span:nth-child(2){height:10px;animation-delay:0.12s}
        .vg-playing-mini span:nth-child(3){height:13px;animation-delay:0.24s}
        .vg-playing-mini span:nth-child(4){height:7px;animation-delay:0.36s}

        /* ── Pause on hover for playing button ── */
        .vg-play-btn .vg-play-hover { display: none; }
        .vg-play-btn.playing:hover .vg-play-default { display: none; }
        .vg-play-btn.playing:hover .vg-play-hover { display: flex; align-items: center; justify-content: center; }

        /* ── New item highlight ── */
        .vg-h-new .vg-h-row { animation: vg-highlight 2.2s ease forwards; }
        @keyframes vg-highlight {
          0% { background: rgba(180,120,255,0.2); }
          100% { background: transparent; }
        }

        /* ── Audio progress bar ── */
        .vg-progress-bar {
          position: relative; height: 3px;
          margin: 0 9px 7px;
          background: rgba(255,255,255,0.06);
          border-radius: 100px;
        }
        .vg-progress-fill {
          position: absolute; left: 0; top: 0;
          height: 100%; background: var(--vg-accent);
          border-radius: 100px; pointer-events: none;
          transition: width 0.08s linear;
        }
        .vg-progress-seek {
          position: absolute; left: 0; right: 0; top: -7px; bottom: -7px;
          width: 100%; height: 17px;
          opacity: 0; cursor: pointer;
          -webkit-appearance: none; appearance: none;
        }

        /* ── Voice dropdown search ── */
        .vg-dd-search-wrap {
          padding: 10px 10px 7px;
          border-bottom: 1px solid var(--vg-border);
          position: sticky; top: 0; z-index: 2;
          background: var(--vg-surface-2);
        }
        .vg-dd-search-input {
          width: 100%; padding: 7px 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--vg-border);
          border-radius: 8px;
          color: var(--vg-text); font-size: 13px;
          outline: none; transition: border-color 0.2s;
          font-family: 'Cabinet Grotesk', system-ui, sans-serif;
        }
        .vg-dd-search-input::placeholder { color: var(--vg-text-dim); }
        .vg-dd-search-input:focus { border-color: rgba(180,120,255,0.28); }
        .vg-dd-empty {
          padding: 24px 16px; text-align: center;
          font-size: 12px; color: var(--vg-text-dim);
          font-family: 'DM Mono', monospace;
        }

        /* ── Preview button active state ── */
        .vg-preview-btn.active {
          background: rgba(180,120,255,0.18);
          border-color: rgba(180,120,255,0.35);
          color: var(--vg-accent);
        }
        .vg-dd-preview-btn.active { background: rgba(180,120,255,0.12); color: var(--vg-accent); }

        /* ── Disabled button hint ── */
        .vg-btn-hint {
          text-align: center; font-size: 11px;
          color: rgba(255,100,100,0.75);
          font-family: 'DM Mono', monospace;
          margin-top: 7px; letter-spacing: 0.02em;
        }

        /* ── Format group sublabel ── */
        .vg-format-group-label {
          font-size: 8px; font-family: 'DM Mono', monospace;
          color: rgba(240,238,255,0.22); letter-spacing: 0.14em;
          text-transform: uppercase; margin-bottom: 5px;
        }

        /* ── Delete confirm state ── */
        .vg-act-btn.del.confirm { background: rgba(255,60,60,0.12) !important; color: #ff6060 !important; animation: vg-del-pulse 0.8s ease-in-out infinite; }
        @keyframes vg-del-pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }
        .vg-del-confirm { font-size: 13px; font-weight: 700; line-height: 1; font-family: 'Syne', sans-serif; }

        /* Scrollbar */
        .vg-scrollbar::-webkit-scrollbar { width: 3px; }
        .vg-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .vg-scrollbar::-webkit-scrollbar-thumb { background: var(--vg-border); border-radius: 100px; }

        /* Override parent dark/light — this page is always dark */
        .vg-root, .vg-root * { color-scheme: dark; }
      `}</style>

      {/* Credit Calculator */}
      <CreditCalculator
        path="ai-voice"
        modifiers={[
          ...(text.length > 500 ? [{
            label: `Long Text (${text.length} chars)`,
            multiplier: Math.ceil(text.length / 500),
            description: 'Credits scale with text length (per 500 characters)'
          }] : []),
          ...(modelId === 'eleven_turbo_v2_5' ? [{
            label: 'Turbo V2.5 Model',
            multiplier: 1.5,
            description: 'Turbo model costs 50% more credits for faster generation'
          }] : []),
        ]}
        position="bottom-right"
      />
    </div>
  );
}
