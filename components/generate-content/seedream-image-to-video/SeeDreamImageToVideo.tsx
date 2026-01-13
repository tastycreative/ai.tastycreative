"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
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
} from "lucide-react";

interface AvailableFolderOption {
  name: string;
  prefix: string;
  displayPath: string;
  path: string;
  depth: number;
  isShared?: boolean;
  permission?: "VIEW" | "EDIT";
  parentPrefix?: string | null;
}

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
  const [availableFolders, setAvailableFolders] = useState<
    AvailableFolderOption[]
  >([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  // Vault folder state
  const [vaultProfiles, setVaultProfiles] = useState<InstagramProfile[]>([]);
  const [vaultFoldersByProfile, setVaultFoldersByProfile] = useState<Record<string, VaultFolder[]>>({});
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

  const loadFolders = useCallback(async () => {
    if (!apiClient || !user) return;
    setIsLoadingFolders(true);
    try {
      const response = await apiClient.get("/api/s3/folders/list-custom");
      if (!response.ok) throw new Error("Failed to load folders");
      const data = await response.json();
      if (data.success && Array.isArray(data.folders)) {
        const folderOptions: AvailableFolderOption[] = data.folders
          .filter(
            (folder: any) => !folder.permission || folder.permission === "EDIT"
          )
          .map((folder: any) => ({
            name: folder.name || "",
            prefix: folder.prefix || "",
            displayPath: folder.path || folder.name || "",
            path: folder.path || "",
            depth: folder.depth || 0,
            isShared: folder.isShared || false,
            permission: folder.permission,
            parentPrefix: folder.parentPrefix,
          }));
        setAvailableFolders(folderOptions);
      }
    } catch (err) {
      console.error("Failed to load folders:", err);
    } finally {
      setIsLoadingFolders(false);
    }
  }, [apiClient, user]);

  // Load vault profiles and folders
  const loadVaultData = useCallback(async () => {
    if (!apiClient || !user) return;
    setIsLoadingVaultData(true);
    try {
      // Load profiles
      const profilesResponse = await fetch("/api/instagram/profiles");
      if (profilesResponse.ok) {
        const profilesData = await profilesResponse.json();
        const profileList: InstagramProfile[] = Array.isArray(profilesData)
          ? profilesData
          : profilesData.profiles || [];

        // Sort profiles alphabetically
        const sortedProfiles = [...profileList].sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
        );

        setVaultProfiles(sortedProfiles);

        // Load folders for each profile
        const foldersByProfile: Record<string, VaultFolder[]> = {};
        await Promise.all(
          sortedProfiles.map(async (profile) => {
            try {
              const foldersResponse = await fetch(
                `/api/vault/folders?profileId=${profile.id}`
              );
              if (foldersResponse.ok) {
                const folders = await foldersResponse.json();
                foldersByProfile[profile.id] = Array.isArray(folders) ? folders : [];
              }
            } catch (err) {
              console.error(`Failed to load folders for profile ${profile.id}:`, err);
              foldersByProfile[profile.id] = [];
            }
          })
        );
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
    if (!targetFolder) return "Videos save to your root outputs folder";
    
    const parsed = parseTargetFolder(targetFolder);
    if (parsed.type === "vault" && parsed.profileId && parsed.folderId) {
      const profile = vaultProfiles.find((p) => p.id === parsed.profileId);
      const folders = vaultFoldersByProfile[parsed.profileId] || [];
      const folder = folders.find((f) => f.id === parsed.folderId);
      if (profile && folder) {
        const profileDisplay = profile.instagramUsername ? `@${profile.instagramUsername}` : profile.name;
        return `Saving to Vault: ${profileDisplay} / ${folder.name}`;
      }
    } else if (parsed.type === "s3" && parsed.prefix) {
      const folder = availableFolders.find((f) => f.prefix === parsed.prefix);
      return `Saving to ${folder?.displayPath || "selected folder"}`;
    }
    return "Videos save to selected folder";
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
      loadFolders();
      loadVaultData();
      loadGenerationHistory();
    }
  }, [apiClient, loadFolders, loadVaultData, loadGenerationHistory]);

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

      // Parse target folder for vault vs S3
      const parsedFolder = parseTargetFolder(targetFolder);

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

      // Add folder params based on type
      if (parsedFolder.type === "vault" && parsedFolder.profileId && parsedFolder.folderId) {
        payload.saveToVault = true;
        payload.vaultProfileId = parsedFolder.profileId;
        payload.vaultFolderId = parsedFolder.folderId;
      } else if (parsedFolder.prefix) {
        payload.targetFolder = parsedFolder.prefix;
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
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-cyan-300" />
                  <p className="text-sm font-semibold text-white">Save Destination</p>
                  {(isLoadingFolders || isLoadingVaultData) && (
                    <Loader2 className="w-3 h-3 animate-spin text-cyan-300" />
                  )}
                </div>
                <div className="relative">
                  <select
                    value={targetFolder}
                    onChange={(e) => setTargetFolder(e.target.value)}
                    disabled={isGenerating || isLoadingFolders || isLoadingVaultData}
                    className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40 disabled:opacity-50"
                  >
                    <option value="">📁 Default Output Folder</option>
                    
                    {/* S3 Folders Group */}
                    {availableFolders.length > 0 && (
                      <optgroup label="📂 Your Output Folders">
                        {availableFolders.map((folder) => (
                          <option key={folder.prefix} value={folder.prefix}>
                            {'  '.repeat(folder.depth)}{folder.name}
                            {folder.isShared && ' (Shared)'}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    
                    {/* Vault Folders by Profile */}
                    {vaultProfiles.map((profile) => {
                      const folders = vaultFoldersByProfile[profile.id] || [];
                      if (folders.length === 0) return null;
                      
                      return (
                        <optgroup 
                          key={profile.id} 
                          label={`📸 Vault - ${profile.name}${profile.instagramUsername ? ` (@${profile.instagramUsername})` : ''}`}
                        >
                          {folders.map((folder) => (
                            <option 
                              key={folder.id} 
                              value={`vault:${profile.id}:${folder.id}`}
                            >
                              {folder.name}{folder.isDefault ? ' (Default)' : ''}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                </div>
                
                {/* Folder type indicator */}
                <div className="flex items-center gap-2">
                  {targetFolder && targetFolder.startsWith('vault:') ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-purple-500/20 px-2.5 py-1 text-[11px] text-purple-200">
                      <Archive className="w-3 h-3" />
                      <span>Vault Storage</span>
                    </div>
                  ) : targetFolder ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-cyan-500/20 px-2.5 py-1 text-[11px] text-cyan-200">
                      <Folder className="w-3 h-3" />
                      <span>S3 Storage</span>
                    </div>
                  ) : null}
                  <p className="text-xs text-slate-300 flex-1">
                    {getSelectedFolderDisplay()}
                  </p>
                </div>
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
