"use client";

import { useCallback, useEffect, useState, useRef } from "react";
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
  Image as ImageIcon,
  Info,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Upload,
  Video,
  Volume2,
  VolumeX,
  X,
  Zap,
  Wand2,
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
  prompt?: string;
  mode: string;
  characterOrientation: string;
  duration?: string;
  imageUrl?: string;
  referenceVideoUrl?: string;
  createdAt: string;
  status: "processing" | "completed" | "failed";
  savedToVault?: boolean;
}

// Mode options
const MODE_OPTIONS = [
  { value: "std", label: "Standard", description: "Faster generation" },
  { value: "pro", label: "Professional", description: "Higher quality" },
] as const;

// Character orientation options
const ORIENTATION_OPTIONS = [
  { value: "image", label: "Match Image", description: "Max 10s video" },
  { value: "video", label: "Match Video", description: "Max 30s video" },
] as const;

export default function KlingMotionControl() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();

  // Form state
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"std" | "pro">("std");
  const [characterOrientation, setCharacterOrientation] = useState<"image" | "video">("image");
  const [keepOriginalSound, setKeepOriginalSound] = useState(false);

  // File state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

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
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

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

  // Parse target folder value
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

  // Load history
  const loadGenerationHistory = useCallback(async () => {
    if (!apiClient || !user) return;
    setIsLoadingHistory(true);
    try {
      const response = await apiClient.get("/api/generate/kling-motion-control?history=true");
      if (response.ok) {
        const data = await response.json();
        setGenerationHistory(data.videos || []);
      }
    } catch (err) {
      console.error("Error loading video history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [apiClient, user]);

  // Initial data load
  useEffect(() => {
    if (user && apiClient) {
      loadVaultData();
      loadGenerationHistory();
    }
  }, [user, apiClient, loadVaultData, loadGenerationHistory]);

  // Handle image file selection
  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPEG, PNG, WebP)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }

    setError(null);
    setImageFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle video file selection
  const handleVideoSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setError("Please select a video file (MP4, MOV, WebM)");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError("Video must be less than 100MB");
      return;
    }

    setError(null);
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreview(url);
  }, []);

  // Clear image
  const clearImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }, []);

  // Clear video
  const clearVideo = useCallback(() => {
    setVideoFile(null);
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    setVideoPreview(null);
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  }, [videoPreview]);

  // Poll for task status
  const pollTaskStatus = useCallback((taskId: string, localTaskId: string) => {
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

          const response = await fetch(`/api/generate/kling-motion-control?taskId=${taskId}`);
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
            setCurrentTaskId(null);
            clearImage();
            clearVideo();
            setPrompt("");
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
          setCurrentTaskId(null);
          setTimeout(() => clearGlobalProgress(), 3000);
          reject(err);
        }
      };

      poll();
    });
  }, [updateGlobalProgress, clearGlobalProgress, clearImage, clearVideo, loadGenerationHistory]);

  // Generate video
  const handleGenerate = async () => {
    if (!apiClient) {
      setError("API client not available");
      return;
    }
    if (!imageFile) {
      setError("Please select a reference image");
      return;
    }
    if (!videoFile) {
      setError("Please select a reference video");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("Submitting task...");
    const localTaskId = `kling-mc-${Date.now()}`;

    try {
      updateGlobalProgress({
        isGenerating: true,
        progress: 0,
        stage: "starting",
        message: "Starting Kling Motion Control generation...",
        generationType: "image-to-video",
        jobId: localTaskId,
      });

      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("video", videoFile);
      formData.append("mode", mode);
      formData.append("character_orientation", characterOrientation);
      formData.append("keep_original_sound", keepOriginalSound ? "yes" : "no");

      if (prompt.trim()) {
        formData.append("prompt", prompt.trim());
      }

      // Add folder selection data
      const parsedFolder = parseTargetFolder(targetFolder);
      if (parsedFolder.type === "vault" && parsedFolder.profileId && parsedFolder.folderId) {
        formData.append("saveToVault", "true");
        formData.append("vaultProfileId", parsedFolder.profileId);
        formData.append("vaultFolderId", parsedFolder.folderId);
      } else if (parsedFolder.prefix) {
        formData.append("targetFolder", parsedFolder.prefix);
      }

      const response = await fetch("/api/generate/kling-motion-control", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start video generation");
      }

      setCurrentTaskId(data.taskId);

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

  // Download video
  const handleDownload = async (videoUrl: string, filename?: string) => {
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `kling-motion-control-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to download video");
    }
  };

  // Reset form
  const handleReset = () => {
    setPrompt("");
    setMode("std");
    setCharacterOrientation("image");
    setKeepOriginalSound(false);
    clearImage();
    clearVideo();
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
                <Sparkles className="w-6 h-6 text-white" />
                <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Motion Studio</p>
                <h1 className="text-3xl sm:text-4xl font-black text-white">Kling AI — Motion Control</h1>
              </div>
            </div>
            <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed">
              Transfer motion from a reference video to your character image. Upload a character image 
              and a video with the desired movements to create stunning AI-animated content.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Character</p>
                  <p className="text-sm font-semibold text-white">Image Input</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20 text-pink-200">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Motion</p>
                  <p className="text-sm font-semibold text-white">Video Reference</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Duration</p>
                  <p className="text-sm font-semibold text-white">Up to 30s</p>
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
                    {mode === "pro" ? "Professional" : "Standard"} · {characterOrientation === "image" ? "Match Image" : "Match Video"}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-200/80">
                  <span className="rounded-full bg-white/10 px-3 py-1">
                    {keepOriginalSound ? "🔊 Sound" : "🔇 Muted"}
                  </span>
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
              {/* Reference Image Upload */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-violet-300" />
                  <label className="text-sm font-semibold text-slate-100">Reference Image (Character) *</label>
                </div>

                {imagePreview ? (
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-white/10">
                    <img
                      src={imagePreview}
                      alt="Reference character"
                      className="w-full h-full object-contain"
                    />
                    <button
                      onClick={clearImage}
                      disabled={isGenerating}
                      className="absolute top-2 right-2 p-2 rounded-xl bg-red-500/80 hover:bg-red-500 text-white transition disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => !isGenerating && imageInputRef.current?.click()}
                    className={`aspect-video rounded-2xl border-2 border-dashed border-white/20 hover:border-violet-500/50 bg-white/5 flex flex-col items-center justify-center gap-2 cursor-pointer transition ${
                      isGenerating ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <Upload className="h-8 w-8 text-slate-400" />
                    <span className="text-sm text-slate-300">Click to upload character image</span>
                    <span className="text-xs text-slate-400">Max 10MB · JPG, PNG, WebP</span>
                  </div>
                )}

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImageSelect}
                  disabled={isGenerating}
                />
                <p className="text-xs text-slate-300">Upload the character you want to animate.</p>
              </div>

              {/* Reference Video Upload */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-pink-300" />
                  <label className="text-sm font-semibold text-slate-100">Reference Video (Motion) *</label>
                </div>

                {videoPreview ? (
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-white/10">
                    <video
                      src={videoPreview}
                      controls
                      className="w-full h-full object-contain"
                    />
                    <button
                      onClick={clearVideo}
                      disabled={isGenerating}
                      className="absolute top-2 right-2 p-2 rounded-xl bg-red-500/80 hover:bg-red-500 text-white transition disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => !isGenerating && videoInputRef.current?.click()}
                    className={`aspect-video rounded-2xl border-2 border-dashed border-white/20 hover:border-pink-500/50 bg-white/5 flex flex-col items-center justify-center gap-2 cursor-pointer transition ${
                      isGenerating ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <Upload className="h-8 w-8 text-slate-400" />
                    <span className="text-sm text-slate-300">Click to upload reference video</span>
                    <span className="text-xs text-slate-400">Max 100MB · MP4, MOV, WebM · 3-30s</span>
                  </div>
                )}

                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={handleVideoSelect}
                  disabled={isGenerating}
                />
                <p className="text-xs text-slate-300">Upload a video showing the motion to transfer.</p>
              </div>

              {/* Character Orientation */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-violet-300" />
                  <label className="text-sm font-semibold text-slate-100">Character Orientation</label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ORIENTATION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCharacterOrientation(option.value as "image" | "video")}
                      className={`rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 ${
                        characterOrientation === option.value
                          ? "border-violet-400/70 bg-violet-500/10 text-white"
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

              {/* Quality Mode */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-300" />
                  <label className="text-sm font-semibold text-slate-100">Quality Mode</label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMode(option.value as "std" | "pro")}
                      className={`rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 ${
                        mode === option.value
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

              {/* Keep Original Sound */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {keepOriginalSound ? (
                      <Volume2 className="w-4 h-4 text-emerald-300" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-slate-400" />
                    )}
                    <label className="text-sm font-semibold text-slate-100">Keep Original Sound</label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKeepOriginalSound(!keepOriginalSound)}
                    disabled={isGenerating}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      keepOriginalSound ? "bg-emerald-500" : "bg-slate-600"
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        keepOriginalSound ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-slate-300">
                  {keepOriginalSound
                    ? "Audio from reference video will be preserved"
                    : "Generated video will be silent"}
                </p>
              </div>

              {/* Optional Prompt */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-100">Prompt (Optional)</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the desired output or scene..."
                  disabled={isGenerating}
                  maxLength={2500}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent disabled:opacity-50 min-h-[80px] resize-none"
                />
                <p className="text-xs text-slate-300">{prompt.length}/2500 characters</p>
              </div>

              {/* Folder Selection */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-violet-300" />
                  <label className="text-sm font-semibold text-slate-100">Save to Vault</label>
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
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !imageFile || !videoFile}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 via-purple-500 to-pink-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:hover:translate-y-0"
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
                        src={video.videoUrl}
                        muted
                        playsInline
                        className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(video.videoUrl, `motion-control-${video.id}.mp4`);
                            }}
                            className="rounded-lg bg-white/20 p-2 text-white hover:bg-white/30 transition"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openVideoModal(video);
                            }}
                            className="rounded-lg bg-white/20 p-2 text-white hover:bg-white/30 transition"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        </div>
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
                  <p className="text-xs uppercase tracking-[0.2em] text-violet-200">History</p>
                  <h2 className="text-lg font-semibold text-white">Previous generations</h2>
                </div>
                <button
                  onClick={loadGenerationHistory}
                  disabled={isLoadingHistory}
                  className="p-2 rounded-lg hover:bg-white/10 transition"
                  title="Refresh history"
                >
                  <RefreshCw className={`w-4 h-4 text-slate-300 ${isLoadingHistory ? "animate-spin" : ""}`} />
                </button>
              </div>

              {generationHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-slate-300">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm">No previous generations yet.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
                  {generationHistory.map((video) => (
                    <div
                      key={video.id}
                      role="button"
                      aria-label="Open video"
                      tabIndex={0}
                      onClick={() => openVideoModal(video)}
                      className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 cursor-pointer"
                    >
                      <video
                        data-role="preview"
                        src={video.videoUrl}
                        muted
                        playsInline
                        className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/90 to-transparent p-2">
                        <p className="text-[10px] text-slate-300 truncate">
                          {video.mode === "pro" ? "Pro" : "Std"} · {video.characterOrientation === "image" ? "Image" : "Video"}
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
                  {selectedVideo.prompt || "Motion Control Video"}
                </p>
                <p className="text-slate-400">
                  {selectedVideo.mode === "pro" ? "Professional" : "Standard"} · {selectedVideo.characterOrientation === "image" ? "Match Image" : "Match Video"}
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
            <div className="relative max-w-3xl w-full rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl mx-4">
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
                  <Info className="w-5 h-5 text-violet-400" />
                  <h3 className="text-xl font-semibold">Kling AI Motion Control Guide</h3>
                </div>
                
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-4">
                    <h4 className="font-semibold text-emerald-100 mb-2">✓ Good Inputs</h4>
                    <ul className="text-sm space-y-1 text-emerald-50 list-disc list-inside">
                      <li>Clear, well-lit character images</li>
                      <li>Smooth, stable reference videos</li>
                      <li>Similar body proportions</li>
                      <li>Visible full body or face</li>
                    </ul>
                  </div>
                  <div className="bg-red-500/10 border border-red-400/30 rounded-2xl p-4">
                    <h4 className="font-semibold text-red-100 mb-2">✗ Avoid</h4>
                    <ul className="text-sm space-y-1 text-red-50 list-disc list-inside">
                      <li>Blurry or low-quality images</li>
                      <li>Complex multi-person scenes</li>
                      <li>Very fast movements</li>
                      <li>Heavily occluded subjects</li>
                    </ul>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
                    <h4 className="font-semibold text-violet-100 mb-2 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Character Orientation: Image
                    </h4>
                    <ul className="text-sm space-y-1 text-slate-200">
                      <li>• Output matches image orientation</li>
                      <li>• Maximum duration: 10 seconds</li>
                      <li>• Best for portrait/specific poses</li>
                    </ul>
                  </div>
                  <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
                    <h4 className="font-semibold text-pink-100 mb-2 flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      Character Orientation: Video
                    </h4>
                    <ul className="text-sm space-y-1 text-slate-200">
                      <li>• Output matches video orientation</li>
                      <li>• Maximum duration: 30 seconds</li>
                      <li>• Best for dynamic movements</li>
                    </ul>
                  </div>
                </div>

                <div className="border border-amber-400/30 bg-amber-500/10 rounded-2xl p-4">
                  <h4 className="font-semibold flex items-center gap-2 text-amber-100">
                    <AlertCircle className="w-4 h-4" />
                    Tips for Best Results
                  </h4>
                  <ul className="text-sm space-y-1 text-amber-50 list-disc list-inside">
                    <li>Use Professional mode for complex movements</li>
                    <li>Keep reference videos between 3-10 seconds for best quality</li>
                    <li>Ensure character in image has similar pose to video start</li>
                    <li>Enable &quot;Keep Original Sound&quot; for videos with important audio</li>
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
