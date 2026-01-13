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

export default function SeeDreamTextToVideo() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();

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
  const [availableFolders, setAvailableFolders] = useState<AvailableFolderOption[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  // Vault folder state
  const [vaultProfiles, setVaultProfiles] = useState<InstagramProfile[]>([]);
  const [vaultFoldersByProfile, setVaultFoldersByProfile] = useState<Record<string, VaultFolder[]>>({});
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);

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
          .filter((folder: any) => !folder.permission || folder.permission === "EDIT")
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
      const profilesResponse = await apiClient.get("/api/instagram/profiles");
      if (profilesResponse.ok) {
        const profilesData = await profilesResponse.json();
        const profiles: InstagramProfile[] = profilesData.profiles || [];
        setVaultProfiles(profiles);

        // Load folders for each profile
        const foldersByProfile: Record<string, VaultFolder[]> = {};
        for (const profile of profiles) {
          try {
            const foldersResponse = await apiClient.get(
              `/api/vault/folders?profileId=${profile.id}`
            );
            if (foldersResponse.ok) {
              const foldersData = await foldersResponse.json();
              // API returns folders array directly, not wrapped in { folders: [...] }
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
    if (!targetFolder) return "Videos save to your root outputs folder";
    
    const parsed = parseTargetFolder(targetFolder);
    if (parsed.type === "vault" && parsed.profileId && parsed.folderId) {
      const profile = vaultProfiles.find((p) => p.id === parsed.profileId);
      const folders = vaultFoldersByProfile[parsed.profileId] || [];
      const folder = folders.find((f) => f.id === parsed.folderId);
      if (profile && folder) {
        const profileDisplay = profile.instagramUsername ? `@${profile.instagramUsername}` : profile.name;
        return `Videos save to vault: ${profileDisplay} / ${folder.name}`;
      }
    } else if (parsed.type === "s3" && parsed.prefix) {
      const folder = availableFolders.find((f) => f.prefix === parsed.prefix);
      return `Videos save to ${folder?.displayPath || "selected folder"}`;
    }
    return "Videos save to selected folder";
  };

  const loadGenerationHistory = useCallback(async () => {
    if (!apiClient) return;
    setIsLoadingHistory(true);
    try {
      const response = await apiClient.get(
        "/api/generate/seedream-text-to-video?history=true"
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

      // Parse target folder for vault vs S3
      const parsedFolder = parseTargetFolder(targetFolder);
      
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
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-100">Prompt *</label>
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
                <p className="text-xs text-slate-300">Include movement, camera, and style cues for best results.</p>
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
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-100">Duration</label>
                  <span className="text-xs text-slate-300">Auto picks 4-12s based on prompt</span>
                </div>
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
                <div className="grid sm:grid-cols-2 gap-4">
                  {generationHistory.map((video) => (
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
                className="w-full h-auto max-h-[70vh] object-contain bg-black rounded-3xl"
              />
              <div className="p-4 text-sm text-slate-200">
                <p className="font-semibold text-white mb-1">{selectedVideo.prompt}</p>
                <p className="text-slate-400">
                  {selectedVideo.duration === -1 ? "Auto" : `${selectedVideo.duration}s`} · {selectedVideo.modelVersion}
                </p>
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
    </div>
  );
}
