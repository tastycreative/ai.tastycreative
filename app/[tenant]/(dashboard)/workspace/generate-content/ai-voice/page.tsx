"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { 
  Mic, 
  Play, 
  Pause, 
  Download, 
  Volume2, 
  Loader2,
  RefreshCw,
  ChevronDown,
  Copy,
  Check,
  Sparkles,
  Trash2,
  Clock,
  SlidersHorizontal,
  RotateCcw,
  Zap,
  AudioWaveform,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useCredits } from '@/lib/hooks/useCredits.query';
import { CreditCalculator } from "@/components/credits/CreditCalculator";
import { StorageFullBanner, useCanGenerate } from "@/components/generate-content/shared/StorageFullBanner";

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
  audioUrl: string;
  mimeType: string;
  characterCount: number;
  createdAt: Date;
  outputFormat: string;
  isFromDb?: boolean;
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
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAudios, setGeneratedAudios] = useState<GeneratedAudio[]>([]);
  const [localAudioUrls, setLocalAudioUrls] = useState<Map<string, string>>(new Map());
  
  const [showSettings, setShowSettings] = useState(false);
  const [outputFormat, setOutputFormat] = useState("mp3_44100_128");
  const [modelId, setModelId] = useState("eleven_multilingual_v2");
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);
  
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
  const [voiceDropdownPosition, setVoiceDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const voiceSelectorRef = useRef<HTMLButtonElement>(null);
  
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
          if (data.voices[0].settings) {
            setVoiceSettings({
              stability: data.voices[0].settings.stability ?? 0.5,
              similarityBoost: data.voices[0].settings.similarityBoost ?? 0.75,
              style: data.voices[0].settings.style ?? 0,
              useSpeakerBoost: data.voices[0].settings.useSpeakerBoost ?? true,
              speed: data.voices[0].settings.speed ?? 1.0,
            });
          }
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
          characterCount: number;
          outputFormat: string;
          audioUrl: string | null;
          createdAt: string;
        }) => ({
          id: gen.id,
          text: gen.text,
          voiceName: gen.voiceName,
          audioUrl: gen.audioUrl || "",
          mimeType: gen.outputFormat.startsWith("mp3") ? "audio/mpeg" : "audio/wav",
          characterCount: gen.characterCount,
          createdAt: new Date(gen.createdAt),
          outputFormat: gen.outputFormat,
          isFromDb: true,
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
    if (voice.settings) {
      setVoiceSettings({
        stability: voice.settings.stability ?? 0.5,
        similarityBoost: voice.settings.similarityBoost ?? 0.75,
        style: voice.settings.style ?? 0,
        useSpeakerBoost: voice.settings.useSpeakerBoost ?? true,
        speed: voice.settings.speed ?? 1.0,
      });
    }
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

      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))],
        { type: data.mimeType }
      );
      const audioUrl = URL.createObjectURL(audioBlob);

      const newAudio: GeneratedAudio = {
        id: data.generationId || Date.now().toString(),
        text: text.trim(),
        voiceName: selectedVoice.name,
        audioUrl,
        mimeType: data.mimeType,
        characterCount: data.characterCount,
        createdAt: new Date(),
        outputFormat,
        isFromDb: false,
      };

      setLocalAudioUrls(prev => new Map(prev).set(newAudio.id, audioUrl));
      setGeneratedAudios(prev => [newAudio, ...prev]);

      // Refresh credits after successful generation
      refreshCredits();

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setPlayingAudioId(newAudio.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate speech");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = async (audio: GeneratedAudio) => {
    if (playingAudioId === audio.id) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      // First check if we have a local blob URL
      let audioUrl = localAudioUrls.get(audio.id);
      
      // If no local URL, fetch from ElevenLabs history via our API
      if (!audioUrl && audio.isFromDb) {
        try {
          const response = await fetch(`/api/ai-voice/history-audio?historyItemId=${audio.id}`);
          if (response.ok) {
            const blob = await response.blob();
            audioUrl = URL.createObjectURL(blob);
            // Cache it for future plays
            setLocalAudioUrls(prev => new Map(prev).set(audio.id, audioUrl!));
          } else {
            const errorData = await response.json().catch(() => ({}));
            setError(errorData.details || "Audio no longer available. ElevenLabs history items expire after 90 days.");
            return;
          }
        } catch (err) {
          console.error("Failed to fetch audio:", err);
          setError("Failed to load audio");
          return;
        }
      }
      
      if (audioRef.current && audioUrl) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setPlayingAudioId(audio.id);
      }
    }
  };

  const handlePreviewVoice = (voice: Voice, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!voice.previewUrl) return;
    
    if (previewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPreviewPlaying(false);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.src = voice.previewUrl;
      previewAudioRef.current.play();
      setPreviewPlaying(true);
    }
  };

  const handleDownload = async (audio: GeneratedAudio) => {
    try {
      // First check if we have a local blob URL
      let audioUrl = localAudioUrls.get(audio.id);
      
      // If no local URL, fetch from ElevenLabs history via our API
      if (!audioUrl) {
        const response = await fetch(`/api/ai-voice/history-audio?historyItemId=${audio.id}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          setError(errorData.details || "Audio no longer available. ElevenLabs history items expire after 90 days.");
          return;
        }
        const blob = await response.blob();
        audioUrl = URL.createObjectURL(blob);
        // Cache it
        setLocalAudioUrls(prev => new Map(prev).set(audio.id, audioUrl!));
      }
      
      const link = document.createElement("a");
      link.href = audioUrl;
      const extension = audio.mimeType.includes("mpeg") ? "mp3" : "wav";
      link.download = `voice-${audio.voiceName.toLowerCase().replace(/\s+/g, "-")}-${audio.id.slice(0, 8)}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download audio.");
    }
  };

  const handleDelete = async (audio: GeneratedAudio) => {
    try {
      const response = await fetch(`/api/ai-voice/generations?id=${audio.id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) throw new Error("Failed to delete");
      
      setGeneratedAudios(prev => prev.filter(a => a.id !== audio.id));
      
      const localUrl = localAudioUrls.get(audio.id);
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
        setLocalAudioUrls(prev => {
          const newMap = new Map(prev);
          newMap.delete(audio.id);
          return newMap;
        });
      }
    } catch (err) {
      console.error("Failed to delete generation:", err);
      setError("Failed to delete generation");
    }
  };

  const handleCopyText = useCallback((audio: GeneratedAudio) => {
    navigator.clipboard.writeText(audio.text);
    setCopiedId(audio.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  useEffect(() => {
    return () => {
      localAudioUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [localAudioUrls]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-voice-dropdown]") && !target.closest("[data-voice-selector]")) {
        setIsVoiceDropdownOpen(false);
      }
    };
    
    if (isVoiceDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isVoiceDropdownOpen]);

  const groupedVoices = voices.reduce((acc, voice) => {
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
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative max-h-[85vh] overflow-y-auto overflow-x-hidden bg-[#F8F8F8] dark:bg-[#0a0a0f] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl shadow-lg custom-scrollbar p-4 md:p-6 lg:p-8">
      <audio ref={audioRef} onEnded={() => setPlayingAudioId(null)} className="hidden" />
      <audio ref={previewAudioRef} onEnded={() => setPreviewPlaying(false)} className="hidden" />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-brand-mid-pink to-brand-blue rounded-2xl blur-xl opacity-50" />
              <div className="relative p-3.5 bg-gradient-to-br from-brand-mid-pink to-brand-blue rounded-2xl">
                <AudioWaveform className="w-7 h-7 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Voice Generator</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Transform text into natural speech with AI</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Main Content */}
          <div className="xl:col-span-8 space-y-5">
            {/* Voice Selection Card */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-mid-pink/20 to-brand-blue/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
              <div className="relative bg-[#F8F8F8] dark:bg-[#0a0a0f] border-2 border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-brand-mid-pink" />
                    <span className="text-sm font-medium text-foreground">Voice</span>
                  </div>
                  {selectedVoice?.previewUrl && (
                    <button
                      onClick={() => selectedVoice && handlePreviewVoice(selectedVoice)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-mid-pink hover:text-brand-light-pink bg-brand-mid-pink/10 hover:bg-brand-mid-pink/20 rounded-lg transition-all"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Preview
                    </button>
                  )}
                </div>
                
                <button
                  ref={voiceSelectorRef}
                  onClick={openVoiceDropdown}
                  disabled={isLoadingVoices}
                  data-voice-selector
                  className="w-full flex items-center justify-between px-4 py-3.5 bg-muted border border-border rounded-xl text-left hover:border-brand-mid-pink/30 hover:bg-accent transition-all duration-200"
                >
                  {isLoadingVoices ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-brand-mid-pink animate-spin" />
                      <span className="text-muted-foreground">Loading voices...</span>
                    </div>
                  ) : selectedVoice ? (
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-gradient-to-br from-brand-mid-pink to-brand-blue rounded-xl flex items-center justify-center text-white font-semibold text-lg shadow-lg shadow-brand-mid-pink/20">
                        {selectedVoice?.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{selectedVoice?.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[selectedVoice?.gender, selectedVoice?.age, selectedVoice?.accent].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Select a voice</span>
                  )}
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isVoiceDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Voice Dropdown Portal */}
                {isVoiceDropdownOpen && typeof document !== "undefined" && createPortal(
                  <div
                    data-voice-dropdown
                    className="fixed z-[9999] bg-[#F8F8F8] dark:bg-[#0a0a0f] border-2 border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl shadow-2xl shadow-black/20 dark:shadow-black/50 overflow-hidden"
                    style={{
                      top: voiceDropdownPosition.top,
                      left: voiceDropdownPosition.left,
                      width: voiceDropdownPosition.width,
                      maxHeight: "360px",
                    }}
                  >
                    <div className="overflow-y-auto max-h-[360px] custom-scrollbar">
                      {Object.entries(groupedVoices).map(([category, categoryVoices]) => (
                        <div key={category}>
                          <div className="px-4 py-2.5 bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 border-b border-border">
                            {category}
                          </div>
                          {categoryVoices.map((voice) => (
                            <button
                              key={voice.id}
                              onClick={() => handleVoiceSelect(voice)}
                              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors ${
                                selectedVoice?.id === voice.id ? "bg-brand-mid-pink/10 border-l-2 border-brand-mid-pink" : "border-l-2 border-transparent"
                              }`}
                            >
                              <div className="w-9 h-9 bg-gradient-to-br from-brand-mid-pink to-brand-blue rounded-lg flex items-center justify-center text-white font-medium text-sm">
                                {voice.name.charAt(0)}
                              </div>
                              <div className="flex-1 text-left">
                                <p className="font-medium text-foreground text-sm">{voice.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {[voice.gender, voice.age, voice.accent].filter(Boolean).join(" · ")}
                                </p>
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
                                  className="p-2 text-muted-foreground hover:text-brand-mid-pink hover:bg-brand-mid-pink/10 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Volume2 className="w-4 h-4" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            </div>

            {/* Text Input Card */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-mid-pink/20 to-brand-blue/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
              <div className="relative bg-[#F8F8F8] dark:bg-[#0a0a0f] border-2 border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-mid-pink" />
                    <span className="text-sm font-medium text-foreground">Text to Speech</span>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    text.length > 5000 
                      ? "bg-red-500/20 text-red-600 dark:text-red-400" 
                      : text.length > 4000 
                        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {text.length.toLocaleString()} / 5,000
                  </span>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter the text you want to convert to speech..."
                  className="w-full h-44 px-4 py-3.5 bg-muted border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-brand-mid-pink/30 focus:ring-2 focus:ring-brand-mid-pink/10 resize-none transition-all text-[15px] leading-relaxed"
                  maxLength={5000}
                />
              </div>
            </div>

            {/* Settings Card */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-mid-pink/20 to-brand-blue/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
              <div className="relative bg-[#F8F8F8] dark:bg-[#0a0a0f] border-2 border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-brand-mid-pink" />
                    <span className="text-sm font-medium text-foreground">Advanced Settings</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showSettings ? "rotate-180" : ""}`} />
                </button>
                
                {showSettings && (
                  <div className="px-5 pb-5 space-y-5 border-t border-border">
                    {/* Model & Format Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-5">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-2">Model</label>
                        <select
                          value={modelId}
                          onChange={(e) => setModelId(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm focus:outline-none focus:border-brand-mid-pink/30 transition-colors appearance-none cursor-pointer"
                        >
                          {MODELS.map((model) => (
                            <option key={model.value} value={model.value}>
                              {model.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-2">Output Format</label>
                        <select
                          value={outputFormat}
                          onChange={(e) => setOutputFormat(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm focus:outline-none focus:border-brand-mid-pink/30 transition-colors appearance-none cursor-pointer"
                        >
                          {OUTPUT_FORMATS.map((format) => (
                            <option key={format.value} value={format.value}>
                              {format.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Voice Settings */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Voice Parameters</span>
                        <button
                          onClick={() => setVoiceSettings(DEFAULT_SETTINGS)}
                          className="flex items-center gap-1.5 text-xs text-brand-mid-pink hover:text-brand-light-pink transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </button>
                      </div>

                      {/* Speed */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs text-muted-foreground">Speed</label>
                          <span className="text-xs font-mono text-foreground bg-muted px-2 py-0.5 rounded">{voiceSettings.speed.toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.7"
                          max="1.2"
                          step="0.01"
                          value={voiceSettings.speed}
                          onChange={(e) => setVoiceSettings(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                          className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer slider-thumb"
                        />
                      </div>

                      {/* Stability */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs text-muted-foreground">Stability</label>
                          <span className="text-xs font-mono text-foreground bg-muted px-2 py-0.5 rounded">{Math.round(voiceSettings.stability * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={voiceSettings.stability}
                          onChange={(e) => setVoiceSettings(prev => ({ ...prev, stability: parseFloat(e.target.value) }))}
                          className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer slider-thumb"
                        />
                      </div>

                      {/* Similarity */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs text-muted-foreground">Similarity</label>
                          <span className="text-xs font-mono text-foreground bg-muted px-2 py-0.5 rounded">{Math.round(voiceSettings.similarityBoost * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={voiceSettings.similarityBoost}
                          onChange={(e) => setVoiceSettings(prev => ({ ...prev, similarityBoost: parseFloat(e.target.value) }))}
                          className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer slider-thumb"
                        />
                      </div>

                      {/* Style Exaggeration */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs text-muted-foreground">Style Exaggeration</label>
                          <span className="text-xs font-mono text-foreground bg-muted px-2 py-0.5 rounded">{Math.round(voiceSettings.style * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={voiceSettings.style}
                          onChange={(e) => setVoiceSettings(prev => ({ ...prev, style: parseFloat(e.target.value) }))}
                          className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer slider-thumb"
                        />
                      </div>

                      {/* Speaker Boost Toggle */}
                      <label className="flex items-center justify-between py-2 cursor-pointer group/toggle">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-muted-foreground group-hover/toggle:text-brand-mid-pink transition-colors" />
                          <span className="text-sm text-muted-foreground group-hover/toggle:text-foreground transition-colors">Speaker Boost</span>
                        </div>
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={voiceSettings.useSpeakerBoost}
                            onChange={(e) => setVoiceSettings(prev => ({ ...prev, useSpeakerBoost: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-muted rounded-full peer-checked:bg-brand-mid-pink transition-colors" />
                          <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-muted-foreground rounded-full peer-checked:bg-white peer-checked:translate-x-5 transition-all" />
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Storage Warning */}
            <StorageFullBanner showWarning={true} />

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isLoading || !selectedVoice || !text.trim() || text.length > 5000 || !canGenerate}
              className="relative w-full group/btn disabled:cursor-not-allowed"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-mid-pink to-brand-blue rounded-xl blur opacity-60 group-hover/btn:opacity-100 transition duration-200 group-disabled/btn:opacity-20" />
              <div className="relative flex items-center justify-center gap-2.5 py-4 bg-gradient-to-r from-brand-mid-pink to-brand-blue text-white font-semibold rounded-xl transition-all disabled:opacity-50">
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Generate Speech</span>
                  </>
                )}
              </div>
            </button>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* History Sidebar */}
          <div className="xl:col-span-4">
            <div className="bg-[#F8F8F8] dark:bg-[#0a0a0f] border-2 border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl p-5 sticky top-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-mid-pink" />
                  <h2 className="text-sm font-semibold text-foreground">History</h2>
                </div>
                <button
                  onClick={fetchHistory}
                  disabled={isLoadingHistory}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? "animate-spin" : ""}`} />
                </button>
              </div>
              
              {isLoadingHistory ? (
                <div className="text-center py-16">
                  <Loader2 className="w-6 h-6 mx-auto text-brand-mid-pink animate-spin" />
                  <p className="text-xs text-muted-foreground mt-3">Loading history...</p>
                </div>
              ) : generatedAudios.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-12 h-12 mx-auto mb-3 bg-muted rounded-xl flex items-center justify-center">
                    <AudioWaveform className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm">No audio generated yet</p>
                  <p className="text-muted-foreground/70 text-xs mt-1">Your generations will appear here</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar pr-1">
                  {generatedAudios.map((audio) => (
                    <div
                      key={audio.id}
                      className="bg-muted border border-border rounded-xl p-3.5 hover:border-brand-mid-pink/20 transition-all group/item"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-brand-mid-pink/20 to-brand-blue/20">
                          <Mic className="w-4 h-4 text-brand-mid-pink" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{audio.voiceName}</p>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatTimeAgo(new Date(audio.createdAt))}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{audio.text}</p>
                          
                          <div className="flex items-center gap-1.5 mt-2.5">
                            <button
                              onClick={() => handlePlayPause(audio)}
                              className="p-1.5 text-muted-foreground hover:text-brand-mid-pink hover:bg-brand-mid-pink/10 rounded-md transition-colors"
                              title={playingAudioId === audio.id ? "Pause" : "Play"}
                            >
                              {playingAudioId === audio.id ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDownload(audio)}
                              className="p-1.5 text-muted-foreground hover:text-brand-mid-pink hover:bg-brand-mid-pink/10 rounded-md transition-colors"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCopyText(audio)}
                              className="p-1.5 text-muted-foreground hover:text-brand-mid-pink hover:bg-brand-mid-pink/10 rounded-md transition-colors"
                              title="Copy text"
                            >
                              {copiedId === audio.id ? (
                                <Check className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(audio)}
                              className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors opacity-0 group-hover/item:opacity-100"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(to right, #EC67A1, #5DC3F8);
          box-shadow: 0 4px 12px rgba(236, 103, 161, 0.3);
          cursor: pointer;
        }
        .slider-thumb::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(to right, #EC67A1, #5DC3F8);
          box-shadow: 0 4px 12px rgba(236, 103, 161, 0.3);
          cursor: pointer;
          border: none;
        }
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
