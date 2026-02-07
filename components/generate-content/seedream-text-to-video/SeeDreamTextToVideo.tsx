"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import { useCredits } from '@/lib/hooks/useCredits.query';
import { CreditCalculator } from "@/components/credits/CreditCalculator";
import VaultFolderDropdown, { VaultFolder } from "@/components/generate-content/shared/VaultFolderDropdown";
import {
  AlertCircle,
  Archive,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Film,
  Info,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Settings,
  Sparkles,
  Video,
  Zap,
  FolderOpen,
  X,
} from "lucide-react";

interface GeneratedVideo {
  id: string;
  videoUrl: string;
  prompt: string;
  modelVersion: string;
  duration: number;
  cameraFixed: boolean;
  createdAt: string;
  status: "completed" | "processing" | "failed";
  profileName?: string | null;
  metadata?: {
    resolution?: string;
    ratio?: string;
    generateAudio?: boolean;
    cameraFixed?: boolean;
    profileId?: string;
  };
}

interface PromptTemplate {
  name: string;
  description: string;
  prompt: string;
}

interface UserPreset {
  id: string;
  name: string;
  resolution: "720p" | "1080p";
  aspectRatio: "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9" | "adaptive";
  duration: number;
  cameraFixed: boolean;
  generateAudio: boolean;
  createdAt: number;
}

const RESOLUTION_DIMENSIONS = {
  "720p": {
    "16:9": "1280×720",
    "4:3": "1112×834",
    "1:1": "960×960",
    "3:4": "834×1112",
    "9:16": "720×1280",
    "21:9": "1470×630",
    adaptive: "Auto",
  },
  "1080p": {
    "16:9": "1920×1080",
    "4:3": "1440×1080",
    "1:1": "1080×1080",
    "3:4": "1080×1440",
    "9:16": "1080×1920",
    "21:9": "2520×1080",
    adaptive: "Auto",
  },
} as const;

const ASPECT_RATIOS = [
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
  "21:9",
  "adaptive",
] as const;

const sliderToDuration = (value: number) => (value === 0 ? -1 : value + 3);

export default function SeeDreamTextToVideo() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();
  const { refreshCredits } = useCredits();

  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [aspectRatio, setAspectRatio] = useState<(typeof ASPECT_RATIOS)[number]>(
    "16:9"
  );
  const [duration, setDuration] = useState(4);
  const [durationSliderValue, setDurationSliderValue] = useState(1);
  const [cameraFixed, setCameraFixed] = useState(false);
  const [generateAudio, setGenerateAudio] = useState(true);

  const [targetFolder, setTargetFolder] = useState<string>("");

  // Prompt Templates & Presets
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [showFolderValidation, setShowFolderValidation] = useState(false);

  // Collapsible sections (mobile)
  const [sectionsCollapsed, setSectionsCollapsed] = useState({
    prompt: false,
    duration: false,
    framing: false,
    options: false,
    vault: false,
  });

  const promptTemplates: PromptTemplate[] = [
    {
      name: "Cinematic Sequence",
      description: "Multi-shot cinematic scene",
      prompt: "Multiple shots. A character walks through a dimly lit corridor. The camera follows smoothly. Cinematic lighting with dramatic shadows."
    },
    {
      name: "Product Showcase",
      description: "Professional product video",
      prompt: "Smooth camera movement around the product. Studio lighting with soft shadows. Clean white background. Professional photography style."
    },
    {
      name: "Nature Documentary",
      description: "Wildlife or landscape video",
      prompt: "Sweeping aerial view of the landscape. Golden hour lighting. Smooth, slow camera movement. Documentary film style with natural colors."
    },
    {
      name: "Action Scene",
      description: "Dynamic movement",
      prompt: "Fast-paced action sequence. Dynamic camera movements. High contrast lighting. Motion blur effects. Dramatic angles and composition."
    },
    {
      name: "Food & Beverage",
      description: "Appetizing food video",
      prompt: "Close-up of the dish. Rotating camera movement. Warm, appetizing lighting. Steam rising. Professional food photography style."
    },
    {
      name: "Tech Demo",
      description: "Technology showcase",
      prompt: "Sleek camera movements around the device. Futuristic lighting with blue tones. Clean, modern aesthetic. High-tech atmosphere."
    },
  ];

  // Use global profile from header
  const { profileId: globalProfileId, selectedProfile, isAllProfiles } = useInstagramProfile();

  // Hydration fix - track if component is mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check for reuse data from sessionStorage (from Vault)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const reuseDataStr = sessionStorage.getItem('seedream-t2v-reuse');
    if (reuseDataStr) {
      try {
        const reuseData = JSON.parse(reuseDataStr);
        
        // Populate form with reuse data
        if (reuseData.prompt) {
          setPrompt(reuseData.prompt);
        }
        if (reuseData.resolution) {
          setResolution(reuseData.resolution as "720p" | "1080p");
        }
        if (reuseData.ratio) {
          const validRatios = ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"];
          if (validRatios.includes(reuseData.ratio)) {
            setAspectRatio(reuseData.ratio as typeof aspectRatio);
          }
        }
        if (reuseData.duration !== undefined) {
          setDuration(reuseData.duration);
          // Convert duration to slider value (inverse of sliderToDuration)
          if (reuseData.duration === -1) {
            setDurationSliderValue(0);
          } else {
            setDurationSliderValue(Math.max(0, Math.min(9, reuseData.duration - 3)));
          }
        }
        if (reuseData.cameraFixed !== undefined) {
          setCameraFixed(reuseData.cameraFixed);
        }
        if (reuseData.generateAudio !== undefined) {
          setGenerateAudio(reuseData.generateAudio);
        }
        
        // Clear sessionStorage after use
        sessionStorage.removeItem('seedream-t2v-reuse');
      } catch (e) {
        console.error('Error parsing reuse data:', e);
        sessionStorage.removeItem('seedream-t2v-reuse');
      }
    }
  }, []);

  // Folder dropdown state
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);

  // localStorage: Load user presets per profile
  useEffect(() => {
    if (typeof window !== 'undefined' && globalProfileId) {
      const savedPresets = localStorage.getItem(`seedream-t2v-presets-${globalProfileId}`);
      if (savedPresets) {
        try {
          setUserPresets(JSON.parse(savedPresets));
        } catch (e) {
          console.error('Error loading T2V presets:', e);
        }
      }

      // Load last settings
      const savedSettings = localStorage.getItem(`seedream-t2v-settings-${globalProfileId}`);
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          if (settings.resolution) setResolution(settings.resolution);
          if (settings.aspectRatio) setAspectRatio(settings.aspectRatio);
          if (settings.duration !== undefined) {
            setDuration(settings.duration);
            if (settings.duration === -1) {
              setDurationSliderValue(0);
            } else {
              setDurationSliderValue(Math.max(0, Math.min(9, settings.duration - 3)));
            }
          }
          if (settings.cameraFixed !== undefined) setCameraFixed(settings.cameraFixed);
          if (settings.generateAudio !== undefined) setGenerateAudio(settings.generateAudio);
          if (settings.targetFolder) setTargetFolder(settings.targetFolder);
        } catch (e) {
          console.error('Error loading T2V settings:', e);
        }
      }
    }
  }, [globalProfileId]);

  // localStorage: Auto-save settings when they change
  useEffect(() => {
    if (typeof window !== 'undefined' && globalProfileId && mounted) {
      const settings = {
        resolution,
        aspectRatio,
        duration,
        cameraFixed,
        generateAudio,
        targetFolder,
      };
      localStorage.setItem(`seedream-t2v-settings-${globalProfileId}`, JSON.stringify(settings));
    }
  }, [resolution, aspectRatio, duration, cameraFixed, generateAudio, targetFolder, globalProfileId, mounted]);

  // Preset management functions
  const saveAsPreset = () => {
    if (!presetName.trim() || !globalProfileId) return;

    const newPreset: UserPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      resolution,
      aspectRatio,
      duration,
      cameraFixed,
      generateAudio,
      createdAt: Date.now(),
    };

    const updatedPresets = [...userPresets, newPreset];
    setUserPresets(updatedPresets);
    localStorage.setItem(`seedream-t2v-presets-${globalProfileId}`, JSON.stringify(updatedPresets));
    setShowPresetModal(false);
    setPresetName('');
  };

  const loadPreset = (preset: UserPreset) => {
    setResolution(preset.resolution);
    setAspectRatio(preset.aspectRatio);
    setDuration(preset.duration);
    if (preset.duration === -1) {
      setDurationSliderValue(0);
    } else {
      setDurationSliderValue(Math.max(0, Math.min(9, preset.duration - 3)));
    }
    setCameraFixed(preset.cameraFixed);
    setGenerateAudio(preset.generateAudio);
  };

  const deletePreset = (presetId: string) => {
    if (!globalProfileId) return;
    const updatedPresets = userPresets.filter(p => p.id !== presetId);
    setUserPresets(updatedPresets);
    localStorage.setItem(`seedream-t2v-presets-${globalProfileId}`, JSON.stringify(updatedPresets));
  };

  const applyTemplate = (template: PromptTemplate) => {
    setPrompt(template.prompt);
    setShowTemplates(false);
  };

  // Vault folder state - only for the selected profile
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);

  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [generationHistory, setGenerationHistory] = useState<GeneratedVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const pauseAllPreviews = () => {
    const previewVideos = document.querySelectorAll<HTMLVideoElement>("video[data-role='preview']");
    previewVideos.forEach((video) => {
      video.pause();
      video.currentTime = 0;
    });
  };

  const currentDimensions = useMemo(
    () => RESOLUTION_DIMENSIONS[resolution][aspectRatio],
    [resolution, aspectRatio]
  );

  const loadVaultData = useCallback(async () => {
    if (!apiClient || !globalProfileId) return;
    setIsLoadingVaultData(true);
    try {
      const foldersResponse = await fetch(`/api/vault/folders?profileId=${globalProfileId}`);
      if (foldersResponse.ok) {
        const folders = await foldersResponse.json();
        setVaultFolders(Array.isArray(folders) ? folders : (folders.folders || []));
      }
    } catch (err) {
      console.error("Failed to load vault folders:", err);
      setVaultFolders([]);
    } finally {
      setIsLoadingVaultData(false);
    }
  }, [apiClient, globalProfileId]);

  const loadGenerationHistory = useCallback(async () => {
    if (!apiClient) return;
    setIsLoadingHistory(true);
    try {
      // Add profileId to filter by selected profile
      const url = globalProfileId 
        ? `/api/generate/seedream-text-to-video?history=true&profileId=${globalProfileId}`
        : "/api/generate/seedream-text-to-video?history=true";
      const response = await apiClient.get(url);
      if (response.ok) {
        const data = await response.json();
        console.log('📋 Loaded T2V generation history:', data.videos?.length || 0, 'videos for profile:', globalProfileId);
        setGenerationHistory(data.videos || []);
      }
    } catch (err) {
      console.error("Failed to load T2V generation history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [apiClient, globalProfileId]);

  useEffect(() => {
    if (apiClient) {
      loadVaultData();
      loadGenerationHistory();
      // Clear selected folder when profile changes
      setTargetFolder("");
    }
  }, [apiClient, loadVaultData, loadGenerationHistory, globalProfileId]);

  const pollTaskStatus = (apiTaskId: string, localTaskId: string) => {
    const maxAttempts = 120;
    let attempts = 0;

    return new Promise<void>((resolve, reject) => {
      const poll = async () => {
        try {
          attempts++;
          const elapsedSeconds = attempts * 5;
          setPollingStatus(
            `Processing... (${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s)`
          );
          updateGlobalProgress({
            isGenerating: true,
            progress: Math.min(90, attempts * 2),
            stage: "processing",
            message: `Generating video... ${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`,
            generationType: "image-to-video",
            jobId: localTaskId,
          });

          const response = await apiClient?.get(
            `/api/generate/seedream-text-to-video?taskId=${apiTaskId}`
          );
          if (!response) throw new Error("API client not available");
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to check task status");
          }

          const data = await response.json();

          if (data.status === "completed" && data.videos && data.videos.length > 0) {
            // Refresh credit balance in the UI after successful generation
            refreshCredits();
            updateGlobalProgress({
              isGenerating: false,
              progress: 100,
              stage: "completed",
              message: "Video generation completed!",
              generationType: "image-to-video",
              jobId: localTaskId,
            });
            setGeneratedVideos(data.videos);
            setPollingStatus("");
            setIsGenerating(false);
            loadGenerationHistory();
            resolve();
            return;
          }

          if (data.status === "failed") {
            throw new Error(data.error || "Video generation failed");
          }

          if (data.status === "processing") {
            if (attempts < maxAttempts) {
              setTimeout(poll, 5000);
              return;
            }
            throw new Error("Video generation timed out");
          }

          if (attempts < maxAttempts) {
            setTimeout(poll, 5000);
            return;
          }

          throw new Error("Video generation timed out");
        } catch (err: any) {
          console.error("Polling error:", err);
          setError(err.message || "Failed to check generation status");
          updateGlobalProgress({
            isGenerating: false,
            progress: 0,
            stage: "failed",
            message: err.message || "Generation failed",
            generationType: "image-to-video",
            jobId: localTaskId,
          });
          setPollingStatus("");
          setIsGenerating(false);
          setTimeout(() => clearGlobalProgress(), 3000);
          reject(err);
        }
      };

      poll();
    });
  };

  const handleGenerate = async () => {
    if (!apiClient) {
      setError("API client not available");
      return;
    }
    if (!targetFolder) {
      setError("Please select a vault folder to save your video");
      setShowFolderValidation(true);
      // Scroll to folder section
      document.getElementById('folder-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setShowFolderValidation(false);
    setIsGenerating(true);
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("Submitting task...");
    const localTaskId = `seedream-t2v-${Date.now()}`;

    try {
      updateGlobalProgress({
        isGenerating: true,
        progress: 0,
        stage: "starting",
        message: "Starting SeeDream 4.5 Text-to-Video generation...",
        generationType: "image-to-video",
        jobId: localTaskId,
      });

      // Use the folder's profileId for proper association
      const folderProfileId = vaultFolders.find(f => f.id === targetFolder)?.profileId || globalProfileId;
      const payload: any = {
        prompt: prompt.trim(),
        model: "ep-20260105171451-cljlk",
        resolution,
        ratio: aspectRatio,
        duration,
        seed: -1,
        cameraFixed,
        watermark: false,
        generateAudio,
        // Always include profile ID for history filtering
        vaultProfileId: folderProfileId || null,
      };

      // Add vault folder params if selected
      if (targetFolder && folderProfileId) {
        payload.saveToVault = true;
        payload.vaultFolderId = targetFolder;
      }

      const response = await apiClient.post(
        "/api/generate/seedream-text-to-video",
        payload
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.details?.error?.message || errorData.error || "Generation failed";
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.status === "completed" && data.videos && data.videos.length > 0) {
        // Refresh credit balance in the UI after successful generation
        refreshCredits();
        updateGlobalProgress({
          isGenerating: false,
          progress: 100,
          stage: "completed",
          message: "Generation completed!",
          generationType: "image-to-video",
          jobId: localTaskId,
        });
        setGeneratedVideos(data.videos);
        setPollingStatus("");
        loadGenerationHistory();
        setIsGenerating(false);
      } else if (data.taskId) {
        await pollTaskStatus(data.taskId, localTaskId);
      }
    } catch (err: any) {
      console.error("Generation error:", err);
      setError(err.message || "Failed to generate video");
      updateGlobalProgress({
        isGenerating: false,
        progress: 0,
        stage: "failed",
        message: err.message || "Generation failed",
        generationType: "image-to-video",
        jobId: localTaskId,
      });
      setPollingStatus("");
      setTimeout(() => clearGlobalProgress(), 3000);
      setIsGenerating(false);
    }
  };

  const handleDownload = async (videoUrl: string, filename: string) => {
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const handleReset = () => {
    setPrompt("");
    setDuration(4);
    setDurationSliderValue(1);
    setResolution("720p");
    setAspectRatio("16:9");
    setCameraFixed(false);
    setGenerateAudio(true);
    setTargetFolder("");
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("");
  };

  // Reuse settings from a generated video
  const handleReuseSettings = (video: GeneratedVideo) => {
    // Set prompt
    if (video.prompt) {
      setPrompt(video.prompt);
    }
    
    // Set resolution from metadata
    if (video.metadata?.resolution) {
      const validResolutions = ["720p", "1080p"];
      if (validResolutions.includes(video.metadata.resolution)) {
        setResolution(video.metadata.resolution as "720p" | "1080p");
      }
    }
    
    // Set aspect ratio from metadata
    if (video.metadata?.ratio) {
      const validRatios = ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"];
      if (validRatios.includes(video.metadata.ratio)) {
        setAspectRatio(video.metadata.ratio as typeof aspectRatio);
      }
    }
    
    // Set duration
    if (video.duration !== undefined) {
      setDuration(video.duration);
      // Convert duration to slider value
      if (video.duration === -1) {
        setDurationSliderValue(0);
      } else {
        setDurationSliderValue(Math.max(0, Math.min(9, video.duration - 3)));
      }
    }
    
    // Set camera fixed from video or metadata
    if (video.metadata?.cameraFixed !== undefined) {
      setCameraFixed(video.metadata.cameraFixed);
    } else if (video.cameraFixed !== undefined) {
      setCameraFixed(video.cameraFixed);
    }
    
    // Set generate audio from metadata
    if (video.metadata?.generateAudio !== undefined) {
      setGenerateAudio(video.metadata.generateAudio);
    }
    
    // Close any open modals
    setShowVideoModal(false);
    setShowHistoryModal(false);
    setSelectedVideo(null);
    
    // Scroll to top to show the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setDuration(sliderToDuration(durationSliderValue));
  }, [durationSliderValue]);

  useEffect(() => {
    if (showVideoModal) {
      pauseAllPreviews();
    }
  }, [showVideoModal]);

  const openVideoModal = (video: GeneratedVideo) => {
    pauseAllPreviews();
    setSelectedVideo(video);
    setShowVideoModal(true);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowVideoModal(false);
        setShowHelpModal(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute inset-x-10 top-20 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr] items-start">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-900/30 backdrop-blur">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 shadow-lg shadow-cyan-900/50">
                <Film className="w-6 h-6 text-white" />
                <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Motion Studio</p>
                <h1 className="text-3xl sm:text-4xl font-black text-white">SeeDream 4.5 — Text to Video</h1>
              </div>
            </div>
            <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed">
              Turn scripts into finished shots with SeeDream 4.5. Dial in framing, duration, camera movement, and audio for cinematic clips.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-200">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Speed</p>
                  <p className="text-sm font-semibold text-white">Auto durations</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-200">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Framing</p>
                  <p className="text-sm font-semibold text-white">Smart ratios</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Output</p>
                  <p className="text-sm font-semibold text-white">720p / 1080p</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="group inline-flex items-center gap-2 rounded-full bg-white text-slate-900 px-4 py-2 text-sm font-semibold shadow-lg shadow-cyan-900/20 transition hover:-translate-y-0.5 hover:shadow-xl"
                title="View Help & Tips"
              >
                <Info className="w-4 h-4" />
                Quick Guide
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-indigo-500/10 p-4 shadow-2xl shadow-cyan-900/20 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Current setup</p>
                  <p className="text-sm font-semibold text-white">
                    {resolution} · {aspectRatio} · {duration === -1 ? "Auto" : `${duration}s`}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-200/80">
                  <span className="rounded-full bg-white/10 px-3 py-1">{currentDimensions}</span>
                  <span
                    className={`rounded-full px-3 py-1 ${
                      isGenerating
                        ? "bg-amber-400/20 text-amber-100"
                        : "bg-emerald-400/20 text-emerald-100"
                    }`}
                  >
                    {isGenerating ? "Rendering" : "Ready"}
                  </span>
                </div>
              </div>
              {pollingStatus && (
                <div className="mt-3 flex items-center gap-2 text-sm text-cyan-100">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{pollingStatus}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr] items-start">
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-cyan-900/40 backdrop-blur space-y-6">
              {/* Prompt Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between w-full group">
                  <label className="text-sm font-semibold text-slate-100">Prompt *</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTemplates(!showTemplates)}
                      className="rounded-full bg-indigo-500/20 hover:bg-indigo-500/30 px-3 py-1 text-[11px] font-semibold text-indigo-100 transition-colors flex items-center gap-1"
                      disabled={isGenerating}
                    >
                      <Sparkles className="w-3 h-3" />
                      Templates
                    </button>
                    <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-[11px] font-semibold text-cyan-100">Required</span>
                    <button
                      type="button"
                      onClick={() => setSectionsCollapsed(prev => ({ ...prev, prompt: !prev.prompt }))}
                      className="lg:hidden p-1 hover:bg-white/10 rounded-lg transition"
                    >
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${sectionsCollapsed.prompt ? '' : 'rotate-180'}`} />
                    </button>
                  </div>
                </div>

                <div className={`space-y-2 ${sectionsCollapsed.prompt ? 'hidden lg:block' : ''}`}>
                {/* Prompt Templates Dropdown */}
                {showTemplates && (
                  <div className="rounded-2xl border border-indigo-400/30 bg-indigo-950/40 backdrop-blur p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <p className="text-xs font-semibold text-indigo-200 mb-2">Video Templates:</p>
                    <div className="grid gap-2">
                      {promptTemplates.map((template, idx) => (
                        <button
                          key={idx}
                          onClick={() => applyTemplate(template)}
                          disabled={isGenerating}
                          className="w-full text-left p-3 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 hover:from-white/10 hover:border-indigo-300/40 transition-all disabled:opacity-50"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white mb-0.5">{template.name}</p>
                              <p className="text-xs text-slate-400">{template.description}</p>
                            </div>
                            <Sparkles className="w-4 h-4 text-indigo-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent" />
                  </div>
                )}

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    "Describe the video you want to create...\n\nExample: Multiple shots. A detective enters a dimly lit room. He examines the clues on the table and picks up an item from the surface."
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent disabled:opacity-50"
                  rows={6}
                  disabled={isGenerating}
                />
                
                <div className="flex items-center justify-between text-xs">
                  <p className="text-slate-300">Include movement, camera, and style cues for best results.</p>
                  <span className={`font-semibold ${
                    prompt.length > 600 ? 'text-red-400' : prompt.length > 400 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {prompt.length > 600 && '⚠️ '}{prompt.length} chars
                  </span>
                </div>

                {/* User Presets Display */}
                {userPresets.length > 0 && (
                  <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-xs font-semibold text-slate-300 mb-2">Your Presets:</p>
                    <div className="flex flex-wrap gap-2">
                      {userPresets.map((preset) => (
                        <div key={preset.id} className="group relative">
                          <button
                            onClick={() => loadPreset(preset)}
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-xs font-medium text-indigo-100 border border-indigo-500/30 transition-all disabled:opacity-50"
                          >
                            {preset.name}
                          </button>
                          <button
                            onClick={() => deletePreset(preset.id)}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete preset"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-100">Resolution</label>
                  <span className="text-xs text-slate-400">720p is faster; 1080p is sharper.</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(["720p", "1080p"] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setResolution(option)}
                      className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                        resolution === option
                          ? "border-cyan-400/70 bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-indigo-500/10 text-white shadow-cyan-900/40"
                          : "border-white/10 bg-white/5 text-slate-100/90"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <p className="text-sm font-semibold">{option}</p>
                      <p className="text-xs text-slate-300">{option === "720p" ? "HD" : "Full HD"}</p>
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-100">Aspect Ratio</label>
                  <div className="grid grid-cols-4 gap-2">
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition hover:-translate-y-0.5 ${
                          aspectRatio === ratio
                            ? "border-cyan-400/70 bg-cyan-500/10 text-white shadow-cyan-900/30"
                            : "border-white/10 bg-white/5 text-slate-200"
                        } disabled:opacity-50`}
                        disabled={isGenerating}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 flex items-center justify-between">
                  <span className="text-slate-300">Video dimensions</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                    {currentDimensions}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between w-full group">
                  <label className="text-sm font-semibold text-slate-100">Duration</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-300">Auto picks 4-12s based on prompt</span>
                    <button
                      type="button"
                      onClick={() => setSectionsCollapsed(prev => ({ ...prev, duration: !prev.duration }))}
                      className="lg:hidden p-1 hover:bg-white/10 rounded-lg transition"
                    >
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${sectionsCollapsed.duration ? '' : 'rotate-180'}`} />
                    </button>
                  </div>
                </div>

                <div className={`space-y-3 ${sectionsCollapsed.duration ? 'hidden lg:block' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-300 w-12">Auto</span>
                  <input
                    type="range"
                    min={0}
                    max={9}
                    step={1}
                    value={durationSliderValue}
                    onChange={(e) => setDurationSliderValue(Number(e.target.value))}
                    className="flex-1 accent-cyan-400"
                    disabled={isGenerating}
                  />
                  <span className="text-xs text-slate-300 w-12 text-right">12s</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Selected</span>
                  <span className="rounded-full bg-white/5 px-3 py-1 text-white">
                    {duration === -1 ? "Auto" : `${duration} seconds`}
                  </span>
                </div>
                </div>
              </div>

              {/* Camera & Audio Options */}
              <div className="space-y-3">
                <div className="flex items-center justify-between w-full group">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-cyan-300" />
                    <p className="text-sm font-semibold text-white">Options</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSectionsCollapsed(prev => ({ ...prev, options: !prev.options }))}
                    className="lg:hidden p-1 hover:bg-white/10 rounded-lg transition"
                  >
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${sectionsCollapsed.options ? '' : 'rotate-180'}`} />
                  </button>
                </div>

                <div className={`space-y-3 ${sectionsCollapsed.options ? 'hidden lg:block' : ''}`}>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCameraFixed((prev) => !prev)}
                  className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                    cameraFixed
                      ? "border-cyan-400/70 bg-cyan-500/10 text-white shadow-cyan-900/30"
                      : "border-white/10 bg-white/5 text-slate-200"
                  } disabled:opacity-50`}
                  disabled={isGenerating}
                >
                  <p className="text-sm font-semibold">Camera Fixed</p>
                  <p className="text-xs text-slate-300">
                    {cameraFixed ? "Static framing" : "Allow dynamic camera moves"}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setGenerateAudio((prev) => !prev)}
                  className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                    generateAudio
                      ? "border-emerald-400/70 bg-emerald-500/10 text-white shadow-emerald-900/30"
                      : "border-white/10 bg-white/5 text-slate-200"
                  } disabled:opacity-50`}
                  disabled={isGenerating}
                >
                  <p className="text-sm font-semibold">Generate Audio</p>
                  <p className="text-xs text-slate-300">
                    {generateAudio ? "Voices, foley, music" : "Video only"}
                  </p>
                </button>
              </div>
              </div>
              </div>

              {/* Save as Preset Button */}
              <button
                type="button"
                onClick={() => setShowPresetModal(true)}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-indigo-400/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200 font-semibold transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                Save Current Settings as Preset
              </button>

              {/* Folder Selection */}
              <div className="space-y-3" id="folder-section">
                <div className="flex items-center justify-between w-full group">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-cyan-300" />
                    <p className="text-sm font-semibold text-white">Save to Vault</p>
                    {!targetFolder && showFolderValidation && (
                      <span className="text-xs bg-red-500/20 text-red-200 px-2 py-1 rounded-full animate-pulse">⚠️ Required</span>
                    )}
                    {isLoadingVaultData && (
                      <Loader2 className="w-3 h-3 animate-spin text-cyan-300" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSectionsCollapsed(prev => ({ ...prev, vault: !prev.vault }))}
                    className="lg:hidden p-1 hover:bg-white/10 rounded-lg transition"
                  >
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${sectionsCollapsed.vault ? '' : 'rotate-180'}`} />
                  </button>
                </div>

                <div className={`space-y-3 ${sectionsCollapsed.vault ? 'hidden lg:block' : ''}`}>
                <VaultFolderDropdown
                  targetFolder={targetFolder}
                  setTargetFolder={setTargetFolder}
                  folderDropdownOpen={folderDropdownOpen}
                  setFolderDropdownOpen={setFolderDropdownOpen}
                  vaultFolders={vaultFolders}
                  isAllProfiles={isAllProfiles}
                  selectedProfile={selectedProfile}
                  mounted={mounted}
                  accentColor="cyan"
                  label="Save to Vault Folder"
                />
              </div>
            </div>

              {error && (
                <div className="flex items-center gap-2 rounded-2xl border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isGenerating ? "Generating..." : "Generate Video"}
                </button>
                <button
                  onClick={handleReset}
                  type="button"
                  disabled={isGenerating}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
                >
                  <RotateCcw className="w-4 h-4" /> Reset
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl shadow-cyan-900/30 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Latest output</p>
                  <h2 className="text-lg font-semibold text-white">Generated videos</h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Play className="w-4 h-4" />
                  {generatedVideos.length} clip{generatedVideos.length === 1 ? "" : "s"}
                </div>
              </div>

              {generatedVideos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-slate-300">
                  <Video className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm">Your generated videos will appear here.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {generatedVideos.map((video) => (
                    <div
                      key={video.id}
                      role="button"
                      aria-label="Open video"
                      tabIndex={0}
                      onClick={() => openVideoModal(video)}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 cursor-pointer"
                    >
                      <video
                        data-role="preview"
                        preload="metadata"
                        src={video.videoUrl}
                        className="w-full h-52 object-cover pointer-events-none"
                        controlsList="nodownload noplaybackrate noremoteplayback"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/0 to-transparent opacity-0 group-hover:opacity-100 transition" />
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
                        <span className="rounded-full bg-white/10 px-3 py-1">
                          {video.duration === -1 ? "Auto" : `${video.duration}s`} · {video.modelVersion}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(video.videoUrl, `${video.id}.mp4`);
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-[11px] font-semibold backdrop-blur"
                        >
                          <Download className="w-3 h-3" />
                          Save
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl shadow-cyan-900/30 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Library</p>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">Recent generations</h2>
                    {generationHistory.length > 0 && (
                      <span className="text-xs text-slate-400">({generationHistory.length})</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {generationHistory.length > 4 && (
                    <button
                      onClick={() => setShowHistoryModal(true)}
                      className="text-xs text-cyan-300 hover:text-cyan-200 transition flex items-center gap-1"
                    >
                      View All
                      <span className="bg-cyan-500/20 rounded-full px-2 py-0.5">{generationHistory.length}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={loadGenerationHistory}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white transition hover:-translate-y-0.5 hover:shadow"
                    disabled={isLoadingHistory}
                  >
                    {isLoadingHistory ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Refresh
                  </button>
                </div>
              </div>

              {generationHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-slate-300">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm">No history yet.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {generationHistory.slice(0, 4).map((video) => (
                    <div
                      key={video.id}
                      role="button"
                      aria-label="Open video"
                      tabIndex={0}
                      onClick={() => openVideoModal(video)}
                      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 cursor-pointer"
                    >
                      <video
                        data-role="preview"
                        preload="metadata"
                        src={video.videoUrl}
                        className="w-full h-40 object-cover pointer-events-none"
                        controlsList="nodownload noplaybackrate noremoteplayback"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/0 to-transparent opacity-0 group-hover:opacity-100 transition" />
                      <div className="px-4 py-3 flex items-center justify-between text-xs text-slate-200">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-white truncate">{video.prompt}</span>
                          <span className="text-slate-400">
                            {video.duration === -1 ? "Auto" : `${video.duration}s`} · {video.modelVersion}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(video.videoUrl, `${video.id}.mp4`);
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white transition hover:-translate-y-0.5"
                        >
                          <Download className="w-3 h-3" />
                          Save
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showVideoModal && selectedVideo &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowVideoModal(false);
            }}
          >
            <div
              className="relative w-full max-w-6xl max-h-[85vh] rounded-3xl border border-white/10 bg-slate-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-slate-100 hover:bg-white/20"
                onClick={() => setShowVideoModal(false)}
              >
                <span className="sr-only">Close</span>
                <X className="w-4 h-4" />
              </button>
              <video
                controls
                autoPlay
                playsInline
                src={selectedVideo.videoUrl}
                className="w-full h-auto max-h-[60vh] object-contain bg-black rounded-t-3xl"
              />
              <div className="p-4 text-sm text-slate-200 space-y-3">
                <div>
                  <p className="font-semibold text-white mb-1">{selectedVideo.prompt}</p>
                  <p className="text-slate-400">
                    {selectedVideo.duration === -1 ? "Auto" : `${selectedVideo.duration}s`} · {selectedVideo.modelVersion}
                  </p>
                </div>
                
                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleDownload(selectedVideo.videoUrl, `seedream-t2v-${selectedVideo.id}.mp4`)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/40 transition hover:-translate-y-0.5"
                  >
                    <Download className="w-4 h-4" />
                    Download video
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReuseSettings(selectedVideo)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-white/10 hover:-translate-y-0.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reuse settings
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showHelpModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
            <div className="relative max-w-3xl w-full rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-slate-100 hover:bg-white/20"
                onClick={() => setShowHelpModal(false)}
              >
                <span className="sr-only">Close</span>
                ×
              </button>

              <div className="space-y-6 text-slate-100">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-xl font-semibold">Prompting tips</h3>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-4">
                    <p className="font-semibold text-emerald-100 mb-2">✓ Do</p>
                    <ul className="text-sm space-y-1 text-emerald-50 list-disc list-inside">
                      <li>Describe subject, movement, and background</li>
                      <li>Call out camera moves (pan, dolly, zoom)</li>
                      <li>Specify duration or leave Auto</li>
                      <li>Include quotes for dialogue when audio is on</li>
                    </ul>
                  </div>
                  <div className="bg-red-500/10 border border-red-400/30 rounded-2xl p-4">
                    <p className="font-semibold text-red-100 mb-2">✗ Avoid</p>
                    <ul className="text-sm space-y-1 text-red-50 list-disc list-inside">
                      <li>Vague single-word prompts</li>
                      <li>Too many simultaneous actions</li>
                      <li>Contradictory camera or lighting</li>
                    </ul>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-cyan-400" />
                      Parameters
                    </h4>
                    <ul className="text-sm space-y-1 text-slate-200 list-disc list-inside">
                      <li>Resolution: 720p (faster) or 1080p (sharper)</li>
                      <li>Aspect: cinematic 16:9, vertical 9:16, square 1:1, adaptive auto</li>
                      <li>Duration: Auto 4-12s or fixed seconds</li>
                      <li>Camera Fixed: lock framing for static shots</li>
                      <li>Audio: generates voice/foley/music when enabled</li>
                    </ul>
                  </div>
                  <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      Examples
                    </h4>
                    <ul className="text-sm space-y-2 text-slate-200 list-disc list-inside">
                      <li>
                        "Multiple shots. Detective enters dimly lit room. Examines clues, picks up item. Camera cuts to him thinking." (Auto duration)
                      </li>
                      <li>
                        "Under a clear blue sky, vast white daisy fields stretch out. Slow dolly toward a single daisy with dew." (Camera fixed)
                      </li>
                      <li>
                        "A man stops a woman and says, \"Remember, never point your finger at the moon.\"" (Audio on)
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="border border-amber-400/30 bg-amber-500/10 rounded-2xl p-4">
                  <h4 className="font-semibold flex items-center gap-2 text-amber-100">
                    <AlertCircle className="w-4 h-4" />
                    Notes
                  </h4>
                  <ul className="text-sm space-y-1 text-amber-50 list-disc list-inside">
                    <li>Text-to-video is creative; results vary. For precision, generate an image first then use Image-to-Video.</li>
                    <li>Videos save to your S3 storage automatically.</li>
                    <li>Frame rate: 24 fps · Format: MP4.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* View All History Modal */}
      {showHistoryModal && typeof window !== 'undefined' && document?.body && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4"
          onClick={() => setShowHistoryModal(false)}
        >
          <div 
            className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-cyan-900/40 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/95 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                  <Film className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Generation History</h2>
                  <p className="text-xs text-slate-400">{generationHistory.length} videos generated</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid of all history videos */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {generationHistory.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {generationHistory.map((video) => (
                    <div
                      key={video.id}
                      role="button"
                      aria-label="Open video"
                      tabIndex={0}
                      onClick={() => {
                        setShowHistoryModal(false);
                        openVideoModal(video);
                      }}
                      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 cursor-pointer transition hover:-translate-y-1 hover:border-cyan-200/40"
                    >
                      <div className="relative">
                        <video
                          data-role="preview"
                          preload="metadata"
                          src={video.videoUrl}
                          className="w-full h-32 object-cover pointer-events-none"
                          controlsList="nodownload noplaybackrate noremoteplayback"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition">
                          <Play className="w-10 h-10 text-white" />
                        </div>
                        {/* Date badge */}
                        <div className="absolute top-2 right-2 text-[9px] text-slate-300 bg-black/50 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition">
                          {new Date(video.createdAt).toLocaleDateString()}
                        </div>
                        {/* Profile badge for all profiles view */}
                        {isAllProfiles && video.profileName && (
                          <div className="absolute top-2 left-2 text-[9px] text-violet-200 bg-violet-600/60 rounded px-1.5 py-0.5">
                            {video.profileName}
                          </div>
                        )}
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-sm font-medium text-white line-clamp-2 mb-1">{video.prompt}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="bg-white/10 rounded px-1.5 py-0.5">
                            {video.duration === -1 ? "Auto" : `${video.duration}s`}
                          </span>
                          <span className="bg-cyan-500/20 rounded px-1.5 py-0.5 text-cyan-300">
                            {video.modelVersion}
                          </span>
                          {isAllProfiles && video.profileName && (
                            <span className="bg-violet-500/30 text-violet-200 rounded px-1.5 py-0.5">{video.profileName}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Film className="w-12 h-12 mb-3 opacity-50" />
                  <p>No generation history yet</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Save Preset Modal */}
      {showPresetModal && typeof window !== 'undefined' && document?.body && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-700">
            <h3 className="text-xl font-semibold mb-4 text-white">Save Text-to-Video Preset</h3>
            
            <div className="space-y-4">
              {/* Preset Name Input */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Preset Name
                </label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g., My Cinematic Settings"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              {/* Current Settings Preview */}
              <div className="bg-slate-900 rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Settings to Save:
                </p>
                <div className="space-y-1.5 text-sm text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Resolution:</span>
                    <span className="font-medium">{resolution}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Aspect Ratio:</span>
                    <span className="font-medium">{aspectRatio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Duration:</span>
                    <span className="font-medium">{duration === -1 ? 'Auto' : `${duration}s`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Camera:</span>
                    <span className="font-medium">{cameraFixed ? 'Fixed' : 'Dynamic'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Audio:</span>
                    <span className="font-medium">{generateAudio ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPresetModal(false);
                    setPresetName('');
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAsPreset}
                  disabled={!presetName.trim()}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Preset
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Floating Credit Calculator */}
      <CreditCalculator
        modifiers={[
          ...(resolution === '1080p' ? [{
            label: '1080p Resolution',
            multiplier: 1.3,
            description: '1080p costs 30% more credits than 720p'
          }] : []),
          ...(duration > 4 ? [{
            label: `Extended Duration (${duration}s)`,
            multiplier: duration / 4,
            description: 'Longer videos cost more credits proportionally'
          }] : []),
        ]}
        position="bottom-right"
      />
    </div>
  );
}
