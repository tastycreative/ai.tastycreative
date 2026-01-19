"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import {
  AlertCircle,
  Archive,
  ChevronDown,
  Clock,
  Download,
  Film,
  Folder,
  Info,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Settings,
  Sparkles,
  Video,
  Zap,
  X,
  Wand2,
  Camera,
} from "lucide-react";

interface InstagramProfile {
  id: string;
  name: string;
  instagramUsername?: string | null;
  isDefault?: boolean;
}

interface VaultFolder {
  id: string;
  name: string;
  profileId: string;
  isDefault?: boolean;
}

type FolderType = "s3" | "vault";

interface GeneratedVideo {
  id: string;
  videoUrl: string;
  prompt: string;
  model: string;
  duration: string;
  aspectRatio: string;
  createdAt: string;
  status: "completed" | "processing" | "failed";
}

// Kling model options with feature support flags
const MODEL_OPTIONS = [
  { value: "kling-v1", label: "Kling V1", description: "Standard quality", supportsSound: false, supportsCfgScale: true, supportsCameraControl: false },
  { value: "kling-v1-6", label: "Kling V1.6", description: "Enhanced V1", supportsSound: false, supportsCfgScale: true, supportsCameraControl: true },
  { value: "kling-v2-master", label: "Kling V2 Master", description: "V2 high quality", supportsSound: false, supportsCfgScale: false, supportsCameraControl: true },
  { value: "kling-v2-1-master", label: "Kling V2.1 Master", description: "V2.1 improved", supportsSound: false, supportsCfgScale: false, supportsCameraControl: true },
  { value: "kling-v2-5-turbo", label: "Kling V2.5 Turbo", description: "Fast V2.5", supportsSound: false, supportsCfgScale: false, supportsCameraControl: true },
  { value: "kling-v2-6", label: "Kling V2.6", description: "Latest with audio", supportsSound: true, supportsCfgScale: false, supportsCameraControl: true },
] as const;

// Mode options
const MODE_OPTIONS = [
  { value: "std", label: "Standard", description: "Faster generation" },
  { value: "pro", label: "Professional", description: "Higher quality" },
] as const;

// Duration options
const DURATION_OPTIONS = [
  { value: "5", label: "5 seconds", description: "Quick clip" },
  { value: "10", label: "10 seconds", description: "Extended clip" },
] as const;

// Aspect ratio options
const ASPECT_RATIO_OPTIONS = [
  { value: "16:9", label: "16:9", description: "Landscape (HD)" },
  { value: "9:16", label: "9:16", description: "Portrait (Stories/Reels)" },
  { value: "1:1", label: "1:1", description: "Square" },
] as const;

// Camera control options
const CAMERA_CONTROL_TYPE_OPTIONS = [
  { value: "simple", label: "Simple (6-axis)", description: "Custom 6-axis control" },
  { value: "down_back", label: "Down & Back", description: "Pan down and zoom out" },
  { value: "forward_up", label: "Forward & Up", description: "Zoom in and pan up" },
  { value: "right_turn_forward", label: "Right Turn Forward", description: "Rotate right and advance" },
  { value: "left_turn_forward", label: "Left Turn Forward", description: "Rotate left and advance" },
] as const;

// 6-axis camera config options (for simple type)
const CAMERA_AXIS_OPTIONS = [
  { key: "horizontal", label: "Horizontal", description: "Left/Right movement", min: -10, max: 10 },
  { key: "vertical", label: "Vertical", description: "Up/Down movement", min: -10, max: 10 },
  { key: "pan", label: "Pan", description: "Up/Down rotation", min: -10, max: 10 },
  { key: "tilt", label: "Tilt", description: "Left/Right rotation", min: -10, max: 10 },
  { key: "roll", label: "Roll", description: "Clockwise/Counter rotation", min: -10, max: 10 },
  { key: "zoom", label: "Zoom", description: "Focal length change", min: -10, max: 10 },
] as const;

export default function KlingTextToVideo() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();

  // Form state
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [model, setModel] = useState<string>("kling-v1-6");
  const [mode, setMode] = useState<string>("std");
  const [duration, setDuration] = useState<string>("5");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [cfgScale, setCfgScale] = useState<number>(0.5);
  const [sound, setSound] = useState<"on" | "off">("off");
  const [useCameraControl, setUseCameraControl] = useState(false);
  const [cameraControlType, setCameraControlType] = useState<string>("simple");
  const [cameraConfig, setCameraConfig] = useState<Record<string, number>>({
    horizontal: 0,
    vertical: 0,
    pan: 0,
    tilt: 0,
    roll: 0,
    zoom: 0,
  });
  const [selectedCameraAxis, setSelectedCameraAxis] = useState<string>("zoom");

  // Check model feature support
  const currentModel = MODEL_OPTIONS.find(m => m.value === model);
  const currentModelSupportsSound = currentModel?.supportsSound ?? false;
  const currentModelSupportsCfgScale = currentModel?.supportsCfgScale ?? true;
  const currentModelSupportsCameraControl = currentModel?.supportsCameraControl ?? false;

  // Folder state
  const [targetFolder, setTargetFolder] = useState<string>("");

  // Vault folder state
  const [vaultProfiles, setVaultProfiles] = useState<InstagramProfile[]>([]);
  const [vaultFoldersByProfile, setVaultFoldersByProfile] = useState<Record<string, VaultFolder[]>>({});
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);

  // Generation state
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [generationHistory, setGenerationHistory] = useState<GeneratedVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

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

  // Load vault profiles and folders
  const loadVaultData = useCallback(async () => {
    if (!apiClient || !user) return;
    setIsLoadingVaultData(true);
    try {
      const profilesResponse = await apiClient.get("/api/instagram/profiles");
      if (profilesResponse.ok) {
        const profilesData = await profilesResponse.json();
        const profiles: InstagramProfile[] = profilesData.profiles || [];
        setVaultProfiles(profiles);

        const foldersByProfile: Record<string, VaultFolder[]> = {};
        for (const profile of profiles) {
          try {
            const foldersResponse = await apiClient.get(
              `/api/vault/folders?profileId=${profile.id}`
            );
            if (foldersResponse.ok) {
              const foldersData = await foldersResponse.json();
              foldersByProfile[profile.id] = Array.isArray(foldersData) ? foldersData : (foldersData.folders || []);
            }
          } catch (err) {
            console.error(`Failed to load folders for profile ${profile.id}:`, err);
            foldersByProfile[profile.id] = [];
          }
        }
        setVaultFoldersByProfile(foldersByProfile);
      }
    } catch (err) {
      console.error("Failed to load vault data:", err);
    } finally {
      setIsLoadingVaultData(false);
    }
  }, [apiClient, user]);

  // Parse the target folder value to determine type and IDs
  const parseTargetFolder = (value: string): { type: FolderType; profileId?: string; folderId?: string; prefix?: string } => {
    if (value.startsWith("vault:")) {
      const parts = value.split(":");
      return {
        type: "vault",
        profileId: parts[1],
        folderId: parts[2],
      };
    }
    return {
      type: "s3",
      prefix: value,
    };
  };

  // Get display name for selected folder
  const getSelectedFolderDisplay = (): string => {
    if (!targetFolder) return "Please select a vault folder to save your video";
    
    const parsed = parseTargetFolder(targetFolder);
    if (parsed.type === "vault" && parsed.profileId && parsed.folderId) {
      const profile = vaultProfiles.find((p) => p.id === parsed.profileId);
      const folders = vaultFoldersByProfile[parsed.profileId] || [];
      const folder = folders.find((f) => f.id === parsed.folderId);
      if (profile && folder) {
        const profileDisplay = profile.instagramUsername ? `@${profile.instagramUsername}` : profile.name;
        return `Videos save to vault: ${profileDisplay} / ${folder.name}`;
      }
    }
    return "Please select a vault folder";
  };

  const loadGenerationHistory = useCallback(async () => {
    if (!apiClient) return;
    setIsLoadingHistory(true);
    try {
      console.log("[Kling T2V Frontend] Loading generation history...");
      const response = await apiClient.get(
        "/api/generate/kling-text-to-video?history=true"
      );
      if (response.ok) {
        const data = await response.json();
        const videos = data.videos || [];
        console.log("[Kling T2V Frontend] Loaded videos:", videos.length);
        console.log("[Kling T2V Frontend] Video URLs present:", videos.filter((v: any) => !!v.videoUrl).length);
        setGenerationHistory(videos);
      } else {
        console.error("[Kling T2V Frontend] Failed to load history, status:", response.status);
      }
    } catch (err) {
      console.error("[Kling T2V Frontend] Failed to load generation history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [apiClient]);

  useEffect(() => {
    if (apiClient) {
      loadVaultData();
      loadGenerationHistory();
    }
  }, [apiClient, loadVaultData, loadGenerationHistory]);

  const pollTaskStatus = (taskId: string, localTaskId: string) => {
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
            `/api/generate/kling-text-to-video?taskId=${taskId}`
          );
          if (!response) throw new Error("API client not available");
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to check task status");
          }

          const data = await response.json();

          if (data.status === "completed" && data.videos && data.videos.length > 0) {
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

          if (data.status === "processing" || data.status === "submitted") {
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
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("Submitting task...");
    const localTaskId = `kling-t2v-${Date.now()}`;

    try {
      updateGlobalProgress({
        isGenerating: true,
        progress: 0,
        stage: "starting",
        message: "Starting Kling Text-to-Video generation...",
        generationType: "image-to-video",
        jobId: localTaskId,
      });

      // Parse target folder for vault vs S3
      const parsedFolder = parseTargetFolder(targetFolder);
      
      const payload: any = {
        prompt: prompt.trim(),
        negative_prompt: negativePrompt.trim() || undefined,
        model_name: model, // API uses model_name, not model
        mode,
        duration,
        aspect_ratio: aspectRatio,
      };

      // Add CFG scale only for V1 models that support it
      if (currentModelSupportsCfgScale) {
        payload.cfg_scale = cfgScale;
      }

      // Add sound parameter (only for V2.6+ models)
      if (currentModelSupportsSound) {
        payload.sound = sound;
      }

      // Add camera control if enabled and model supports it
      if (useCameraControl && currentModelSupportsCameraControl) {
        if (cameraControlType === "simple") {
          // For simple type, build config with the selected axis value
          const config: Record<string, number> = {};
          // Only include the selected axis with non-zero value
          if (cameraConfig[selectedCameraAxis] !== 0) {
            config[selectedCameraAxis] = cameraConfig[selectedCameraAxis];
          }
          payload.camera_control = {
            type: "simple",
            config: Object.keys(config).length > 0 ? config : undefined,
          };
        } else {
          // For predefined types (down_back, forward_up, etc.), config must be empty
          payload.camera_control = {
            type: cameraControlType,
          };
        }
      }

      // Add folder params based on type
      if (parsedFolder.type === "vault" && parsedFolder.profileId && parsedFolder.folderId) {
        payload.saveToVault = true;
        payload.vaultProfileId = parsedFolder.profileId;
        payload.vaultFolderId = parsedFolder.folderId;
      } else if (parsedFolder.prefix) {
        payload.targetFolder = parsedFolder.prefix;
      }

      const response = await apiClient.post(
        "/api/generate/kling-text-to-video",
        payload
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.details?.message || errorData.error || "Generation failed";
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.status === "completed" && data.videos && data.videos.length > 0) {
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
    setNegativePrompt("");
    setModel("kling-v1-6");
    setMode("std");
    setDuration("5");
    setAspectRatio("16:9");
    setCfgScale(0.5);
    setSound("off");
    setUseCameraControl(false);
    setCameraControlType("simple");
    setCameraConfig({
      horizontal: 0,
      vertical: 0,
      pan: 0,
      tilt: 0,
      roll: 0,
      zoom: 0,
    });
    setSelectedCameraAxis("zoom");
    setTargetFolder("");
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("");
  };

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
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute inset-x-10 top-20 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header Section */}
        <div className="grid gap-4 md:grid-cols-[2fr_1fr] items-start">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-violet-900/30 backdrop-blur">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-600 shadow-lg shadow-violet-900/50">
                <Film className="w-6 h-6 text-white" />
                <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Motion Studio</p>
                <h1 className="text-3xl sm:text-4xl font-black text-white">Kling AI — Text to Video</h1>
              </div>
            </div>
            <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed">
              Create stunning AI-generated videos from text prompts using Kling AI&apos;s powerful models. 
              Supports professional mode, camera controls, and multiple aspect ratios.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Duration</p>
                  <p className="text-sm font-semibold text-white">5s or 10s</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20 text-pink-200">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Camera</p>
                  <p className="text-sm font-semibold text-white">AI Controls</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Model</p>
                  <p className="text-sm font-semibold text-white">Kling V1.6</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="group inline-flex items-center gap-2 rounded-full bg-white text-slate-900 px-4 py-2 text-sm font-semibold shadow-lg shadow-violet-900/20 transition hover:-translate-y-0.5 hover:shadow-xl"
                title="View Help & Tips"
              >
                <Info className="w-4 h-4" />
                Quick Guide
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-pink-500/10 p-4 shadow-2xl shadow-violet-900/20 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Current setup</p>
                  <p className="text-sm font-semibold text-white">
                    {MODEL_OPTIONS.find(m => m.value === model)?.label} · {mode === "pro" ? "Professional" : "Standard"} · {duration}s
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-200/80">
                  <span className="rounded-full bg-white/10 px-3 py-1">{aspectRatio}</span>
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
                <div className="mt-3 flex items-center gap-2 text-sm text-violet-100">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{pollingStatus}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-[420px_1fr] items-start">
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-violet-900/40 backdrop-blur space-y-6">
              {/* Prompt Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-100">Prompt *</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    "Describe the video you want to create...\n\nExample: A beautiful sunset over the ocean, golden light reflecting on gentle waves, seabirds flying in slow motion across the sky."
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent disabled:opacity-50"
                  rows={5}
                  disabled={isGenerating}
                />
                <p className="text-xs text-slate-300">Be descriptive for best results. Include motion, style, and atmosphere details.</p>
              </div>

              {/* Negative Prompt */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-100">Negative Prompt (Optional)</label>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="What to avoid: blurry, distorted, low quality..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent disabled:opacity-50"
                  rows={2}
                  disabled={isGenerating}
                />
              </div>

              {/* Model Selection */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-100">Model</label>
                <div className="grid grid-cols-2 gap-2">
                  {MODEL_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setModel(option.value);
                        // Auto-enable sound and pro mode for V2.6 (audio only works in pro mode)
                        if (option.supportsSound) {
                          setSound("on");
                          setMode("pro");
                        } else {
                          // Reset sound if switching to a model that doesn't support it
                          setSound("off");
                        }
                        // Reset camera control if switching to a model that doesn't support it
                        if (!option.supportsCameraControl) {
                          setUseCameraControl(false);
                        }
                      }}
                      className={`rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                        model === option.value
                          ? "border-violet-400/70 bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-pink-500/10 text-white shadow-violet-900/40"
                          : "border-white/10 bg-white/5 text-slate-100/90"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{option.label}</p>
                        {option.supportsSound && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">🔊</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound Toggle (only for V2.6+ in Pro mode) */}
              {currentModelSupportsSound && (
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-100">Audio Generation</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSound("off")}
                      className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                        sound === "off"
                          ? "border-violet-400/70 bg-violet-500/10 text-white shadow-violet-900/30"
                          : "border-white/10 bg-white/5 text-slate-200"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <p className="text-sm font-semibold">🔇 No Audio</p>
                      <p className="text-xs text-slate-300">Video only</p>
                    </button>
                    <button
                      onClick={() => {
                        setSound("on");
                        // Sound only works in Pro mode for V2.6
                        if (mode === "std") {
                          setMode("pro");
                        }
                      }}
                      className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                        sound === "on"
                          ? "border-emerald-400/70 bg-emerald-500/10 text-white shadow-emerald-900/30"
                          : "border-white/10 bg-white/5 text-slate-200"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <p className="text-sm font-semibold">🔊 With Audio</p>
                      <p className="text-xs text-slate-300">Pro mode only</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Mode Selection */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-100">Quality Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  {MODE_OPTIONS.map((option) => {
                    // Standard mode is disabled when sound is on (V2.6 constraint)
                    const isStdDisabledDueToSound = option.value === "std" && sound === "on" && currentModelSupportsSound;
                    const isDisabled = isGenerating || isStdDisabledDueToSound;
                    
                    return (
                      <button
                        key={option.value}
                        onClick={() => {
                          setMode(option.value);
                          // If switching to std mode and sound is on, turn sound off
                          if (option.value === "std" && sound === "on") {
                            setSound("off");
                          }
                        }}
                        className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                          mode === option.value
                            ? "border-violet-400/70 bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-pink-500/10 text-white shadow-violet-900/40"
                            : "border-white/10 bg-white/5 text-slate-100/90"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        disabled={isDisabled}
                        title={isStdDisabledDueToSound ? "Standard mode doesn't support audio generation" : undefined}
                      >
                        <p className="text-sm font-semibold">{option.label}</p>
                        <p className="text-xs text-slate-300">
                          {isStdDisabledDueToSound ? "No audio support" : option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duration Selection */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-100">Duration</label>
                <div className="grid grid-cols-2 gap-3">
                  {DURATION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setDuration(option.value)}
                      className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                        duration === option.value
                          ? "border-violet-400/70 bg-violet-500/10 text-white shadow-violet-900/30"
                          : "border-white/10 bg-white/5 text-slate-200"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="text-xs text-slate-300">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio Selection */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-100">Aspect Ratio</label>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECT_RATIO_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAspectRatio(option.value)}
                      className={`rounded-xl border px-3 py-2 text-center transition hover:-translate-y-0.5 ${
                        aspectRatio === option.value
                          ? "border-violet-400/70 bg-violet-500/10 text-white shadow-violet-900/30"
                          : "border-white/10 bg-white/5 text-slate-200"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="text-xs text-slate-400">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* CFG Scale - Only for V1 models */}
              {currentModelSupportsCfgScale && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-100">Creativity (CFG Scale)</label>
                    <span className="text-xs text-slate-300">{cfgScale.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={cfgScale}
                    onChange={(e) => setCfgScale(Number(e.target.value))}
                    className="w-full accent-violet-400"
                    disabled={isGenerating}
                  />
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>More Creative</span>
                    <span>More Accurate</span>
                  </div>
                </div>
              )}

              {/* Camera Control - Only for V1.6+ models */}
              {currentModelSupportsCameraControl && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setUseCameraControl(!useCameraControl)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                      useCameraControl
                        ? "border-pink-400/70 bg-pink-500/10 text-white shadow-pink-900/30"
                        : "border-white/10 bg-white/5 text-slate-200"
                    } disabled:opacity-50`}
                    disabled={isGenerating}
                  >
                    <div className="flex items-center gap-3">
                      <Camera className="w-5 h-5" />
                      <div>
                        <p className="text-sm font-semibold">Camera Control</p>
                        <p className="text-xs text-slate-300">
                          {useCameraControl ? "AI camera movements enabled" : "Click to enable camera movements"}
                        </p>
                      </div>
                    </div>
                  </button>

                {useCameraControl && (
                  <div className="space-y-4 pl-2">
                    {/* Camera Control Type Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-200">Movement Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {CAMERA_CONTROL_TYPE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setCameraControlType(option.value)}
                            className={`rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 ${
                              cameraControlType === option.value
                                ? "border-pink-400/70 bg-pink-500/10 text-white"
                                : "border-white/10 bg-white/5 text-slate-200"
                            } disabled:opacity-50`}
                            disabled={isGenerating}
                          >
                            <p className="text-xs font-semibold">{option.label}</p>
                            <p className="text-[10px] text-slate-400">{option.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 6-Axis Config (only for simple type) */}
                    {cameraControlType === "simple" && (
                      <div className="space-y-3 border-t border-white/10 pt-3">
                        <label className="text-xs font-semibold text-slate-200">6-Axis Configuration</label>
                        <p className="text-[10px] text-slate-400">Select one axis and set its value. Only one axis can be non-zero.</p>
                        
                        {/* Axis Selection */}
                        <div className="grid grid-cols-3 gap-1">
                          {CAMERA_AXIS_OPTIONS.map((axis) => (
                            <button
                              key={axis.key}
                              onClick={() => {
                                setSelectedCameraAxis(axis.key);
                                // Reset all other axes to 0
                                setCameraConfig({
                                  horizontal: 0,
                                  vertical: 0,
                                  pan: 0,
                                  tilt: 0,
                                  roll: 0,
                                  zoom: 0,
                                  [axis.key]: cameraConfig[axis.key] || 0,
                                });
                              }}
                              className={`rounded-lg border px-2 py-1.5 text-center transition ${
                                selectedCameraAxis === axis.key
                                  ? "border-pink-400/70 bg-pink-500/10 text-white"
                                  : "border-white/10 bg-white/5 text-slate-300"
                              } disabled:opacity-50`}
                              disabled={isGenerating}
                            >
                              <p className="text-[10px] font-semibold">{axis.label}</p>
                            </button>
                          ))}
                        </div>

                        {/* Selected Axis Slider */}
                        {selectedCameraAxis && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-300">
                                {CAMERA_AXIS_OPTIONS.find(a => a.key === selectedCameraAxis)?.description}
                              </span>
                              <span className="text-xs font-mono text-pink-300">
                                {cameraConfig[selectedCameraAxis]?.toFixed(0) || 0}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={-10}
                              max={10}
                              step={1}
                              value={cameraConfig[selectedCameraAxis] || 0}
                              onChange={(e) => {
                                const newValue = Number(e.target.value);
                                setCameraConfig({
                                  horizontal: 0,
                                  vertical: 0,
                                  pan: 0,
                                  tilt: 0,
                                  roll: 0,
                                  zoom: 0,
                                  [selectedCameraAxis]: newValue,
                                });
                              }}
                              className="w-full accent-pink-400"
                              disabled={isGenerating}
                            />
                            <div className="flex justify-between text-[10px] text-slate-500">
                              <span>-10</span>
                              <span>0</span>
                              <span>+10</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* Folder Selection */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-violet-300" />
                  <p className="text-sm font-semibold text-white">Save to Vault</p>
                  {isLoadingVaultData && (
                    <Loader2 className="w-3 h-3 animate-spin text-violet-300" />
                  )}
                </div>
                <select
                  value={targetFolder}
                  onChange={(e) => setTargetFolder(e.target.value)}
                  disabled={isLoadingVaultData || isGenerating}
                  className="w-full rounded-2xl border border-white/10 bg-slate-800/90 px-4 py-3 text-sm text-slate-100 transition focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent disabled:opacity-50 [&>option]:bg-slate-800 [&>option]:text-slate-100 [&>optgroup]:bg-slate-900 [&>optgroup]:text-violet-300 [&>optgroup]:font-semibold"
                >
                  <option value="" className="bg-slate-800 text-slate-100">Select a vault folder...</option>
                  {vaultProfiles.map((profile) => {
                    const folders = (vaultFoldersByProfile[profile.id] || []).filter(f => !f.isDefault);
                    if (folders.length === 0) return null;
                    const profileDisplay = profile.instagramUsername
                      ? `@${profile.instagramUsername}`
                      : profile.name;
                    return (
                      <optgroup key={profile.id} label={`🔒 ${profileDisplay}`} className="bg-slate-900 text-violet-300">
                        {folders.map((folder) => (
                          <option
                            key={`vault:${profile.id}:${folder.id}`}
                            value={`vault:${profile.id}:${folder.id}`}
                            className="bg-slate-800 text-slate-100 py-2"
                          >
                            {folder.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                <p className="text-xs text-slate-400">
                  {getSelectedFolderDisplay()}
                </p>
              </div>

              {/* Error Display */}
              {error && (
                <div className="flex items-center gap-2 rounded-2xl border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 via-purple-500 to-pink-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60"
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

          {/* Right Panel - Results */}
          <div className="space-y-6">
            {/* Generated Videos */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl shadow-violet-900/30 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Latest output</p>
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
                          {video.duration}s · {video.aspectRatio}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(video.videoUrl, `kling-${video.id}.mp4`);
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

            {/* Generation History */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl shadow-violet-900/30 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Library</p>
                  <h2 className="text-lg font-semibold text-white">Recent generations</h2>
                </div>
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

              {generationHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-slate-300">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm">No history yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[320px] overflow-y-auto pr-1">
                  {generationHistory.map((video) => (
                    <div
                      key={video.id}
                      role="button"
                      aria-label="Open video"
                      tabIndex={0}
                      onClick={() => video.videoUrl && openVideoModal(video)}
                      className="group overflow-hidden rounded-xl border border-white/10 bg-white/5 cursor-pointer max-w-[180px]"
                    >
                      {video.videoUrl ? (
                        <video
                          data-role="preview"
                          preload="metadata"
                          src={video.videoUrl}
                          className="w-full h-24 object-cover pointer-events-none"
                          controlsList="nodownload noplaybackrate noremoteplayback"
                        />
                      ) : (
                        <div className="w-full h-24 flex items-center justify-center bg-slate-800/50">
                          <div className="text-center text-slate-400">
                            <Video className="w-5 h-5 mx-auto mb-1 opacity-50" />
                            <span className="text-[10px]">Unavailable</span>
                          </div>
                        </div>
                      )}
                      <div className="px-2 py-2 text-[10px] text-slate-200">
                        <p className="font-medium text-white truncate text-xs">{video.prompt}</p>
                        <p className="text-slate-400 truncate">
                          {video.duration}s · {video.model}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Video Modal */}
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
                className="w-full h-auto max-h-[70vh] object-contain bg-black rounded-3xl"
              />
              <div className="p-4 text-sm text-slate-200">
                <p className="font-semibold text-white mb-1">{selectedVideo.prompt}</p>
                <p className="text-slate-400">
                  {selectedVideo.duration}s · {selectedVideo.aspectRatio} · {selectedVideo.model}
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Help Modal */}
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
                  <Info className="w-5 h-5 text-violet-400" />
                  <h3 className="text-xl font-semibold">Kling AI Text-to-Video Guide</h3>
                </div>
                
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-4">
                    <p className="font-semibold text-emerald-100 mb-2">✓ Do</p>
                    <ul className="text-sm space-y-1 text-emerald-50 list-disc list-inside">
                      <li>Be specific about subject, action, and setting</li>
                      <li>Describe camera movements explicitly</li>
                      <li>Include lighting and atmosphere details</li>
                      <li>Use Professional mode for complex scenes</li>
                    </ul>
                  </div>
                  <div className="bg-red-500/10 border border-red-400/30 rounded-2xl p-4">
                    <p className="font-semibold text-red-100 mb-2">✗ Avoid</p>
                    <ul className="text-sm space-y-1 text-red-50 list-disc list-inside">
                      <li>Vague or single-word prompts</li>
                      <li>Contradictory instructions</li>
                      <li>Too many simultaneous actions</li>
                      <li>Overly complex scene changes</li>
                    </ul>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-violet-400" />
                      Parameters
                    </h4>
                    <ul className="text-sm space-y-1 text-slate-200 list-disc list-inside">
                      <li><strong>Model:</strong> V1.6 is latest, V1.5 is stable</li>
                      <li><strong>Mode:</strong> Pro for quality, Std for speed</li>
                      <li><strong>Duration:</strong> 5s quick, 10s extended</li>
                      <li><strong>Aspect:</strong> 16:9 landscape, 9:16 portrait</li>
                      <li><strong>CFG:</strong> Lower = more creative</li>
                    </ul>
                  </div>
                  <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-violet-400" />
                      Camera Controls
                    </h4>
                    <ul className="text-sm space-y-1 text-slate-200 list-disc list-inside">
                      <li><strong>Zoom In/Out:</strong> Gradual focal changes</li>
                      <li><strong>Down & Back:</strong> Pull away motion</li>
                      <li><strong>Forward & Up:</strong> Push in motion</li>
                      <li><strong>Turn Forward:</strong> Pan while moving</li>
                    </ul>
                  </div>
                </div>

                <div className="border border-amber-400/30 bg-amber-500/10 rounded-2xl p-4">
                  <h4 className="font-semibold flex items-center gap-2 text-amber-100">
                    <AlertCircle className="w-4 h-4" />
                    Tips
                  </h4>
                  <ul className="text-sm space-y-1 text-amber-50 list-disc list-inside">
                    <li>Generation typically takes 2-5 minutes depending on duration and mode</li>
                    <li>Professional mode produces higher quality but takes longer</li>
                    <li>Use negative prompts to avoid common issues like blur or distortion</li>
                    <li>Videos are automatically saved to your S3 storage or Vault</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
