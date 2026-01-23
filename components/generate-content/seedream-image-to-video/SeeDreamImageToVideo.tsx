"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import {
  Video,
  Download,
  Loader2,
  AlertCircle,
  RotateCcw,
  Zap,
  Upload,
  Image as ImageIcon,
  X,
  Play,
  Clock,
  Folder,
  ChevronDown,
  RefreshCw,
  Info,
  Settings,
  Archive,
  FolderOpen,
  Check,
} from "lucide-react";

interface VaultFolder {
  id: string;
  name: string;
  profileId: string;
  isDefault?: boolean;
}

interface GeneratedVideo {
  id: string;
  videoUrl: string;
  prompt: string;
  modelVersion: string;
  duration: number;
  cameraFixed: boolean;
  createdAt: string;
  status: "completed" | "processing" | "failed";
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

export default function SeeDreamImageToVideo() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();

  const [prompt, setPrompt] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string>("");
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [aspectRatio, setAspectRatio] =
    useState<(typeof ASPECT_RATIOS)[number]>("16:9");
  const [duration, setDuration] = useState(4);
  const [durationSliderValue, setDurationSliderValue] = useState(1);
  const [cameraFixed, setCameraFixed] = useState(false);
  const [generateAudio, setGenerateAudio] = useState(true);

  const [targetFolder, setTargetFolder] = useState<string>("");

  // Use global profile from header
  const { profileId: globalProfileId, selectedProfile } = useInstagramProfile();

  // Hydration fix - track if component is mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Folder dropdown state
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const folderDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(event.target as Node)) {
        setFolderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Vault folder state - only for the selected profile
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);

  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [generationHistory, setGenerationHistory] = useState<GeneratedVideo[]>(
    []
  );
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(
    null
  );
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const pauseAllPreviews = () => {
    const previewVideos = document.querySelectorAll<HTMLVideoElement>(
      "video[data-role='preview']"
    );
    previewVideos.forEach((video) => {
      video.pause();
      video.currentTime = 0;
    });
  };

  const currentDimensions = useMemo(
    () => RESOLUTION_DIMENSIONS[resolution][aspectRatio],
    [resolution, aspectRatio]
  );

  // Load vault folders for the selected profile
  const loadVaultData = useCallback(async () => {
    if (!apiClient || !globalProfileId) return;
    setIsLoadingVaultData(true);
    try {
      const foldersResponse = await fetch(`/api/vault/folders?profileId=${globalProfileId}`);
      if (foldersResponse.ok) {
        const folders = await foldersResponse.json();
        setVaultFolders(Array.isArray(folders) ? folders : []);
      }
    } catch (err) {
      console.error("Failed to load vault folders:", err);
      setVaultFolders([]);
    } finally {
      setIsLoadingVaultData(false);
    }
  }, [apiClient, globalProfileId]);

  // Get display name for selected folder
  const getSelectedFolderDisplay = (): string => {
    if (!targetFolder || !globalProfileId) return "Select a vault folder to save videos";
    
    const folder = vaultFolders.find((f) => f.id === targetFolder);
    if (folder && selectedProfile) {
      const profileDisplay = selectedProfile.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile.name;
      return `Saving to Vault: ${profileDisplay} / ${folder.name}`;
    }
    return "Select a vault folder to save videos";
  };

  const loadGenerationHistory = useCallback(async () => {
    if (!apiClient) return;
    setIsLoadingHistory(true);
    try {
      const response = await apiClient.get(
        "/api/generate/seedream-image-to-video?history=true"
      );
      if (response.ok) {
        const data = await response.json();
        setGenerationHistory(data.videos || []);
      }
    } catch (err) {
      console.error("Failed to load generation history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [apiClient]);

  useEffect(() => {
    if (apiClient) {
      loadVaultData();
      loadGenerationHistory();
      // Clear selected folder when profile changes
      setTargetFolder("");
    }
  }, [apiClient, loadVaultData, loadGenerationHistory]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setUploadedImage(base64);
      setUploadedImageFile(file);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setUploadedImage("");
    setUploadedImageFile(null);
  };

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
            `/api/generate/seedream-image-to-video?taskId=${apiTaskId}`
          );
          if (!response) throw new Error("API client not available");
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to check task status");
          }

          const data = await response.json();

          if (
            data.status === "completed" &&
            data.videos &&
            data.videos.length > 0
          ) {
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
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }
    if (!uploadedImage) {
      setError("Please upload an image");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("Submitting task...");
    const localTaskId = `seedream-i2v-${Date.now()}`;

    try {
      updateGlobalProgress({
        isGenerating: true,
        progress: 0,
        stage: "starting",
        message: "Starting SeeDream 4.5 Image-to-Video generation...",
        generationType: "image-to-video",
        jobId: localTaskId,
      });

      const payload: any = {
        prompt: prompt.trim(),
        image: uploadedImage,
        model: "ep-20260105171451-cljlk",
        resolution,
        ratio: aspectRatio,
        duration,
        seed: -1,
        cameraFixed,
        watermark: false,
        generateAudio,
      };

      // Add vault folder params if selected
      if (targetFolder && globalProfileId) {
        payload.saveToVault = true;
        payload.vaultProfileId = globalProfileId;
        payload.vaultFolderId = targetFolder;
      }

      const response = await apiClient.post(
        "/api/generate/seedream-image-to-video",
        payload
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.details?.error?.message ||
          errorData.error ||
          "Generation failed";
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
    setUploadedImage("");
    setUploadedImageFile(null);
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
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute inset-x-10 top-20 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header Section */}
        <div className="grid gap-4 md:grid-cols-[2fr_1fr] items-start">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-900/30 backdrop-blur">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 shadow-lg shadow-cyan-900/50">
                <ImageIcon className="w-6 h-6 text-white" />
                <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
                  Motion Studio
                </p>
                <h1 className="text-3xl sm:text-4xl font-black text-white">
                  SeeDream 4.5 — Image to Video
                </h1>
              </div>
            </div>
            <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed">
              Transform your images into stunning AI-powered videos. Upload an
              image, describe the motion, and watch it come to life with
              cinematic quality.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-200">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Quality</p>
                  <p className="font-semibold text-white">Up to 1080p</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-200">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Duration</p>
                  <p className="font-semibold text-white">4-12 seconds</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Output</p>
                  <p className="font-semibold text-white">MP4 · 24fps</p>
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
                  <p className="text-xs text-slate-300">Status</p>
                  <p className="font-semibold text-white">
                    {isGenerating
                      ? "Generating..."
                      : generatedVideos.length > 0
                        ? "Ready"
                        : "Awaiting input"}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-200/80">
                  <span
                    className={`h-2 w-2 rounded-full ${isGenerating ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`}
                  />
                  {isGenerating ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Processing
                    </span>
                  ) : (
                    "Idle"
                  )}
                </div>
              </div>
              {pollingStatus && (
                <div className="mt-3 flex items-center gap-2 text-sm text-cyan-100">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {pollingStatus}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-[420px_1fr] items-start">
          {/* Input Panel */}
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-cyan-900/40 backdrop-blur space-y-6">
              {/* Image Upload */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-100">
                  Starting Image *
                </label>
                {!uploadedImage ? (
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                      disabled={isGenerating}
                    />
                    <label
                      htmlFor="image-upload"
                      className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/20 rounded-2xl cursor-pointer hover:border-cyan-400/50 transition-all duration-300 bg-white/5 hover:bg-white/10"
                    >
                      <Upload className="w-12 h-12 text-cyan-400 mb-3" />
                      <span className="text-sm font-medium text-slate-100">
                        Click to upload image
                      </span>
                      <span className="text-xs text-slate-400 mt-1">
                        PNG, JPG, WEBP up to 30MB
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="relative group">
                    <img
                      src={uploadedImage}
                      alt="Uploaded"
                      className="w-full h-48 object-contain rounded-2xl border-2 border-white/10 bg-black/30"
                    />
                    <button
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                      disabled={isGenerating}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-100">
                  Motion Description *
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    "Describe the motion you want...\n\nExample: Camera slowly zooms in, character opens eyes and smiles gently. Soft wind blows through hair."
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent disabled:opacity-50"
                  rows={5}
                  disabled={isGenerating}
                />
                <p className="text-xs text-slate-300">
                  Describe camera movement, subject actions, and style cues.
                </p>
              </div>

              {/* Resolution & Aspect Ratio */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-100">
                    Resolution
                  </label>
                  <span className="text-xs text-slate-400">
                    {currentDimensions}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(["720p", "1080p"] as const).map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setResolution(res)}
                      className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                        resolution === res
                          ? "border-cyan-400/70 bg-cyan-500/10 text-white shadow-cyan-900/30"
                          : "border-white/10 bg-white/5 text-slate-200"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <p className="font-semibold">{res}</p>
                      <p className="text-xs text-slate-400">
                        {res === "720p" ? "HD Quality" : "Full HD"}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-100">
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={`rounded-xl border px-2 py-2 text-xs font-semibold transition hover:-translate-y-0.5 ${
                          aspectRatio === ratio
                            ? "border-cyan-400/70 bg-cyan-500/10 text-white"
                            : "border-white/10 bg-white/5 text-slate-300"
                        } disabled:opacity-50`}
                        disabled={isGenerating}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 flex items-center justify-between">
                  <span className="text-slate-400">Output Dimensions</span>
                  <span className="font-semibold text-cyan-200">
                    {currentDimensions}
                  </span>
                </div>
              </div>

              {/* Duration Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-100">
                    Duration
                  </label>
                  <span className="text-xs text-cyan-200 font-semibold">
                    {duration === -1 ? "Auto" : `${duration}s`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-8">Auto</span>
                  <input
                    type="range"
                    min={0}
                    max={9}
                    step={1}
                    value={durationSliderValue}
                    onChange={(e) =>
                      setDurationSliderValue(Number(e.target.value))
                    }
                    className="flex-1 accent-cyan-400"
                    disabled={isGenerating}
                  />
                  <span className="text-xs text-slate-400 w-8">12s</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Model chooses optimal length</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {duration === -1 ? "4-12s range" : `Fixed ${duration}s`}
                  </span>
                </div>
              </div>

              {/* Toggle Buttons */}
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
                  <p className="font-semibold flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Fixed Camera
                  </p>
                  <p className="text-xs text-slate-400">
                    {cameraFixed ? "Static view" : "Dynamic movement"}
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
                  <p className="font-semibold flex items-center gap-2">
                    🎵 Generate Audio
                  </p>
                  <p className="text-xs text-slate-400">
                    {generateAudio ? "With sound" : "Silent video"}
                  </p>
                </button>
              </div>

              {/* Folder Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Archive className="w-4 h-4 text-purple-300" />
                  <p className="text-sm font-semibold text-white">Save to Vault</p>
                  {isLoadingVaultData && (
                    <Loader2 className="w-3 h-3 animate-spin text-purple-300" />
                  )}
                </div>
                
                {/* Modern Custom Dropdown */}
                <div ref={folderDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => !(!mounted || isGenerating || isLoadingVaultData || !globalProfileId) && setFolderDropdownOpen(!folderDropdownOpen)}
                    disabled={!mounted || isGenerating || isLoadingVaultData || !globalProfileId}
                    className={`
                      w-full flex items-center justify-between gap-3 px-4 py-3.5
                      rounded-2xl border transition-all duration-200
                      ${folderDropdownOpen 
                        ? 'border-purple-400 bg-purple-500/10 ring-2 ring-purple-400/30' 
                        : 'border-white/10 bg-slate-800/80 hover:border-purple-400/50 hover:bg-slate-800'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`
                        flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
                        ${targetFolder 
                          ? 'bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border border-purple-400/30' 
                          : 'bg-slate-700/50 border border-white/5'
                        }
                      `}>
                        <FolderOpen className={`w-4 h-4 ${targetFolder ? 'text-purple-300' : 'text-slate-400'}`} />
                      </div>
                      <div className="text-left min-w-0">
                        <p className={`text-sm font-medium truncate ${targetFolder ? 'text-white' : 'text-slate-400'}`}>
                          {targetFolder 
                            ? vaultFolders.find(f => f.id === targetFolder)?.name || 'Select folder...'
                            : 'Select a folder...'
                          }
                        </p>
                        {targetFolder && selectedProfile && (
                          <p className="text-[11px] text-purple-300/70 truncate">
                            {selectedProfile.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${folderDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {folderDropdownOpen && mounted && (
                    <div className="absolute z-50 w-full bottom-full mb-2 py-2 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
                      {/* Clear Selection Option */}
                      <button
                        type="button"
                        onClick={() => {
                          setTargetFolder('');
                          setFolderDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center">
                          <X className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-sm text-slate-400">No folder selected</span>
                        {!targetFolder && <Check className="w-4 h-4 text-purple-400 ml-auto" />}
                      </button>

                      {vaultFolders.filter(f => !f.isDefault).length > 0 && (
                        <div className="my-2 mx-3 h-px bg-white/5" />
                      )}

                      {/* Folder Options */}
                      <div className="max-h-[200px] overflow-y-auto">
                        {vaultFolders.filter(f => !f.isDefault).map((folder) => (
                          <button
                            key={folder.id}
                            type="button"
                            onClick={() => {
                              setTargetFolder(folder.id);
                              setFolderDropdownOpen(false);
                            }}
                            className={`
                              w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150
                              ${targetFolder === folder.id 
                                ? 'bg-purple-500/15' 
                                : 'hover:bg-white/5'
                              }
                            `}
                          >
                            <div className={`
                              w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                              ${targetFolder === folder.id 
                                ? 'bg-gradient-to-br from-purple-500/40 to-indigo-500/40 border border-purple-400/40' 
                                : 'bg-slate-700/50 border border-white/5'
                              }
                            `}>
                              <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? 'text-purple-300' : 'text-slate-400'}`} />
                            </div>
                            <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-white font-medium' : 'text-slate-200'}`}>
                              {folder.name}
                            </span>
                            {targetFolder === folder.id && (
                              <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>

                      {vaultFolders.filter(f => !f.isDefault).length === 0 && (
                        <div className="px-4 py-6 text-center">
                          <FolderOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                          <p className="text-sm text-slate-400">No folders available</p>
                          <p className="text-xs text-slate-500 mt-1">Create folders in the Vault tab</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Status Indicator */}
                {targetFolder && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <p className="text-xs text-purple-200 flex-1 truncate">
                      {getSelectedFolderDisplay()}
                    </p>
                  </div>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="flex items-center gap-2 rounded-2xl border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim() || !uploadedImage}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
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

          {/* Output Panel */}
          <div className="space-y-6">
            {/* Generated Videos */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl shadow-cyan-900/30 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Generated Videos</h2>
                  <p className="text-xs text-slate-400">Latest output</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Play className="w-4 h-4" />
                  {generatedVideos.length} clip{generatedVideos.length !== 1 && "s"}
                </div>
              </div>

              {generatedVideos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-slate-300">
                  <Video className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm">Your generated video will appear here</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {generatedVideos.map((video) => (
                    <div
                      key={video.id}
                      className="group relative rounded-2xl border border-white/10 bg-white/5 overflow-hidden hover:border-cyan-400/50 transition-all cursor-pointer"
                      onClick={() => openVideoModal(video)}
                    >
                      <div className="aspect-video relative bg-black">
                        <video
                          data-role="preview"
                          src={video.videoUrl}
                          className="w-full h-full object-cover pointer-events-none"
                          muted
                          playsInline
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-10 h-10 text-white" />
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        <p className="text-xs text-slate-200 line-clamp-2">
                          {video.prompt}
                        </p>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>
                            {video.duration === -1
                              ? "Auto"
                              : `${video.duration}s`}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(
                                video.videoUrl,
                                `seedream-i2v-${video.id}.mp4`
                              );
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white hover:bg-cyan-500/20 hover:border-cyan-400/50 transition"
                          >
                            <Download className="w-3 h-3" />
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Generations */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl shadow-cyan-900/30 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Recent Generations</h2>
                  <p className="text-xs text-slate-400">History</p>
                </div>
                <button
                  type="button"
                  onClick={loadGenerationHistory}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white transition hover:-translate-y-0.5 hover:shadow"
                  disabled={isLoadingHistory}
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isLoadingHistory ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>

              {generationHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-slate-300">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm">Recent generations will appear here</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {generationHistory.map((video) => (
                    <div
                      key={video.id}
                      className="group relative rounded-2xl border border-white/10 bg-white/5 overflow-hidden hover:border-cyan-400/50 transition-all cursor-pointer"
                      onClick={() => openVideoModal(video)}
                    >
                      <div className="aspect-video relative bg-black">
                        <video
                          data-role="preview"
                          src={video.videoUrl}
                          className="w-full h-full object-cover pointer-events-none"
                          muted
                          playsInline
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-10 h-10 text-white" />
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        <p className="text-xs text-slate-200 line-clamp-2">
                          {video.prompt}
                        </p>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {video.duration === -1
                              ? "Auto"
                              : `${video.duration}s`}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(
                                video.videoUrl,
                                `seedream-i2v-${video.id}.mp4`
                              );
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white hover:bg-cyan-500/20 hover:border-cyan-400/50 transition"
                          >
                            <Download className="w-3 h-3" />
                            Save
                          </button>
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

      {/* Video Modal */}
      {showVideoModal &&
        selectedVideo &&
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
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-slate-100 hover:bg-white/20 z-10"
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
                <p className="font-semibold text-white mb-1">
                  {selectedVideo.prompt}
                </p>
                <p className="text-slate-400">
                  {selectedVideo.duration === -1
                    ? "Auto"
                    : `${selectedVideo.duration}s`}{" "}
                  · {selectedVideo.modelVersion}
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Help Modal */}
      {showHelpModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowHelpModal(false);
            }}
          >
            <div className="relative max-w-3xl w-full max-h-[85vh] overflow-auto rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-slate-100 hover:bg-white/20"
                onClick={() => setShowHelpModal(false)}
              >
                <span className="sr-only">Close</span>
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-6 text-slate-100">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-xl font-semibold">Image-to-Video Guide</h3>
                </div>

                {/* Image Tips */}
                <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-cyan-400" />
                    Image Requirements
                  </h4>
                  <ul className="text-sm space-y-1 text-slate-200 list-disc list-inside">
                    <li>Formats: JPEG, PNG, WebP, BMP, TIFF, GIF, HEIC</li>
                    <li>Size: Up to 30MB</li>
                    <li>Dimensions: 300px-6000px, aspect ratio 0.4-2.5</li>
                    <li>Higher quality images = better video results</li>
                  </ul>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-4">
                    <p className="font-semibold text-emerald-100 mb-2">✓ Do</p>
                    <ul className="text-sm space-y-1 text-emerald-50 list-disc list-inside">
                      <li>Upload high-resolution images</li>
                      <li>Describe motion clearly</li>
                      <li>Match aspect ratio to your image</li>
                      <li>Specify camera movements</li>
                    </ul>
                  </div>
                  <div className="bg-red-500/10 border border-red-400/30 rounded-2xl p-4">
                    <p className="font-semibold text-red-100 mb-2">✗ Avoid</p>
                    <ul className="text-sm space-y-1 text-red-50 list-disc list-inside">
                      <li>Low-quality or blurry images</li>
                      <li>Extreme aspect ratio mismatches</li>
                      <li>Overly complex multi-scene actions</li>
                      <li>Contradictory motion descriptions</li>
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
                      <li>720p: Faster processing</li>
                      <li>1080p: Higher quality output</li>
                      <li>Adaptive: Auto-fits to your image</li>
                      <li>Duration: 4-12 seconds</li>
                      <li>Audio: Synced sound generation</li>
                    </ul>
                  </div>
                  <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      Example Prompts
                    </h4>
                    <ul className="text-sm space-y-2 text-slate-200">
                      <li className="p-2 bg-slate-800/50 rounded-lg">
                        &quot;Character opens eyes, smiles gently, hair blowing in
                        wind&quot;
                      </li>
                      <li className="p-2 bg-slate-800/50 rounded-lg">
                        &quot;Camera slowly zooms in, dramatic lighting change&quot;
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
                    <li>Processing time: 30s - 2min depending on duration</li>
                    <li>Non-matching aspect ratios apply center-based cropping</li>
                    <li>Videos auto-save to your S3 storage</li>
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
