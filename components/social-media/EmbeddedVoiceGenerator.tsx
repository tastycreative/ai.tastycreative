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
  Sparkles,
  SlidersHorizontal,
  RotateCcw,
  Zap,
  AudioWaveform,
  Save,
  Check
} from "lucide-react";
import { createPortal } from "react-dom";

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

const OUTPUT_FORMATS = [
  { value: "mp3_44100_128", label: "MP3 128kbps" },
  { value: "mp3_44100_192", label: "MP3 192kbps" },
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

interface EmbeddedVoiceGeneratorProps {
  setId: string | null;
  onSaveToSet?: (audioBlob: Blob, filename: string) => Promise<void>;
  onSaveComplete?: () => void;
}

export default function EmbeddedVoiceGenerator({ 
  setId, 
  onSaveToSet,
  onSaveComplete 
}: EmbeddedVoiceGeneratorProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [outputFormat, setOutputFormat] = useState("mp3_44100_128");
  const [modelId, setModelId] = useState("eleven_multilingual_v2");
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);
  
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
  const [voiceDropdownPosition, setVoiceDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const voiceSelectorRef = useRef<HTMLButtonElement>(null);
  
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchVoices();
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
      setError("Failed to load voices.");
    } finally {
      setIsLoadingVoices(false);
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

    setIsLoading(true);
    setError(null);
    setSuccess(null);

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
      
      // Clean up previous audio URL
      if (generatedAudioUrl) {
        URL.revokeObjectURL(generatedAudioUrl);
      }
      
      const audioUrl = URL.createObjectURL(audioBlob);
      setGeneratedAudioUrl(audioUrl);
      
      // Play the audio
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setIsPlaying(true);
      }

      // Save to set if callback provided and set is selected
      if (onSaveToSet && setId) {
        const extension = data.mimeType.includes("mpeg") ? "mp3" : "wav";
        const filename = `voice-${selectedVoice.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.${extension}`;
        await onSaveToSet(audioBlob, filename);
        setSuccess(`Voice note saved to set!`);
        
        if (onSaveComplete) {
          onSaveComplete();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate speech");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current || !generatedAudioUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
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

  const handleDownload = () => {
    if (!generatedAudioUrl || !selectedVoice) return;
    const link = document.createElement("a");
    link.href = generatedAudioUrl;
    const extension = outputFormat.startsWith("mp3") ? "mp3" : "wav";
    link.download = `voice-${selectedVoice.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    return () => {
      if (generatedAudioUrl) {
        URL.revokeObjectURL(generatedAudioUrl);
      }
    };
  }, [generatedAudioUrl]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-voice-dropdown-embedded]") && !target.closest("[data-voice-selector-embedded]")) {
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

  return (
    <div className="space-y-4">
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />
      <audio ref={previewAudioRef} onEnded={() => setPreviewPlaying(false)} className="hidden" />

      {/* Voice Selection */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-medium text-gray-300">Voice</span>
          </div>
          {selectedVoice?.previewUrl && (
            <button
              onClick={() => selectedVoice && handlePreviewVoice(selectedVoice)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg transition-all"
            >
              <Volume2 className="w-3 h-3" />
              Preview
            </button>
          )}
        </div>
        
        <button
          ref={voiceSelectorRef}
          onClick={openVoiceDropdown}
          disabled={isLoadingVoices}
          data-voice-selector-embedded
          className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-lg text-left hover:border-violet-500/30 transition-all duration-200"
        >
          {isLoadingVoices ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
              <span className="text-gray-400 text-sm">Loading voices...</span>
            </div>
          ) : selectedVoice ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                {selectedVoice?.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-white text-sm">{selectedVoice?.name}</p>
                <p className="text-xs text-gray-500">
                  {[selectedVoice?.gender, selectedVoice?.accent].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          ) : (
            <span className="text-gray-500 text-sm">Select a voice</span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isVoiceDropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Voice Dropdown Portal */}
        {isVoiceDropdownOpen && typeof document !== "undefined" && createPortal(
          <div
            data-voice-dropdown-embedded
            className="fixed z-[9999] bg-gray-800 border border-gray-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden"
            style={{
              top: voiceDropdownPosition.top,
              left: voiceDropdownPosition.left,
              width: voiceDropdownPosition.width,
              maxHeight: "300px",
            }}
          >
            <div className="overflow-y-auto max-h-[300px]">
              {Object.entries(groupedVoices).map(([category, categoryVoices]) => (
                <div key={category}>
                  <div className="px-3 py-2 bg-gray-900 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0">
                    {category}
                  </div>
                  {categoryVoices.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => handleVoiceSelect(voice)}
                      className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700/50 transition-colors ${
                        selectedVoice?.id === voice.id ? "bg-violet-500/10 border-l-2 border-violet-500" : "border-l-2 border-transparent"
                      }`}
                    >
                      <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg flex items-center justify-center text-white font-medium text-xs">
                        {voice.name.charAt(0)}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-white text-sm">{voice.name}</p>
                        <p className="text-xs text-gray-500">
                          {[voice.gender, voice.accent].filter(Boolean).join(" · ")}
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
                          className="p-1.5 text-gray-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
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

      {/* Text Input */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-medium text-gray-300">Text to Speech</span>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            text.length > 5000 
              ? "bg-red-500/20 text-red-400" 
              : text.length > 4000 
                ? "bg-amber-500/20 text-amber-400"
                : "bg-gray-700 text-gray-400"
          }`}>
            {text.length.toLocaleString()} / 5,000
          </span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter the text you want to convert to speech..."
          className="w-full h-32 px-3 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/30 resize-none text-sm"
          maxLength={5000}
        />
      </div>

      {/* Settings */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-700/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-medium text-gray-300">Settings</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showSettings ? "rotate-180" : ""}`} />
        </button>
        
        {showSettings && (
          <div className="px-4 pb-4 space-y-4 border-t border-gray-700/50">
            {/* Model & Format Row */}
            <div className="grid grid-cols-2 gap-3 pt-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Model</label>
                <select
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500/30 transition-colors appearance-none cursor-pointer"
                >
                  {MODELS.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Format</label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  className="w-full px-2.5 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500/30 transition-colors appearance-none cursor-pointer"
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400">Voice Parameters</span>
                <button
                  onClick={() => setVoiceSettings(DEFAULT_SETTINGS)}
                  className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>

              {/* Speed */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-gray-500">Speed</label>
                  <span className="text-xs font-mono text-white bg-gray-900 px-1.5 py-0.5 rounded">{voiceSettings.speed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.2"
                  step="0.01"
                  value={voiceSettings.speed}
                  onChange={(e) => setVoiceSettings(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-violet-500"
                />
              </div>

              {/* Stability */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-gray-500">Stability</label>
                  <span className="text-xs font-mono text-white bg-gray-900 px-1.5 py-0.5 rounded">{Math.round(voiceSettings.stability * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={voiceSettings.stability}
                  onChange={(e) => setVoiceSettings(prev => ({ ...prev, stability: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-violet-500"
                />
              </div>

              {/* Similarity */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-gray-500">Similarity</label>
                  <span className="text-xs font-mono text-white bg-gray-900 px-1.5 py-0.5 rounded">{Math.round(voiceSettings.similarityBoost * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={voiceSettings.similarityBoost}
                  onChange={(e) => setVoiceSettings(prev => ({ ...prev, similarityBoost: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-violet-500"
                />
              </div>

              {/* Speaker Boost Toggle */}
              <label className="flex items-center justify-between py-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-sm text-gray-400">Speaker Boost</span>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={voiceSettings.useSpeakerBoost}
                    onChange={(e) => setVoiceSettings(prev => ({ ...prev, useSpeakerBoost: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-700 rounded-full peer-checked:bg-violet-600 transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-gray-400 rounded-full peer-checked:bg-white peer-checked:translate-x-4 transition-all" />
                </div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Generated Audio Playback */}
      {generatedAudioUrl && (
        <div className="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handlePlayPause}
                className="w-10 h-10 bg-violet-500 hover:bg-violet-600 rounded-full flex items-center justify-center text-white transition-colors"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <div>
                <p className="text-sm font-medium text-white">Generated Audio</p>
                <p className="text-xs text-gray-400">{selectedVoice?.name}</p>
              </div>
            </div>
            <button
              onClick={handleDownload}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isLoading || !selectedVoice || !text.trim() || text.length > 5000 || !setId}
        className="w-full flex items-center justify-center gap-2.5 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Generating...</span>
          </>
        ) : (
          <>
            <AudioWaveform className="w-5 h-5" />
            <span>{setId ? "Generate & Save to Set" : "Select a Set First"}</span>
          </>
        )}
      </button>

      {!setId && (
        <p className="text-xs text-amber-400 text-center">
          Please select a set from the Sets tab to save your voice notes
        </p>
      )}

      {/* Status Messages */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          {success}
        </div>
      )}
    </div>
  );
}
