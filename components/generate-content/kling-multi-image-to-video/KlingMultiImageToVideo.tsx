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
  Folder,
  Info,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Video,
  Zap,
  X,
  Wand2,
  Upload,
  Image as ImageIcon,
  Trash2,
  Images,
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
  imageCount: number;
  createdAt: string;
  status: "completed" | "processing" | "failed";
}

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
}

// Kling model options
const MODEL_OPTIONS = [
  { value: "kling-v1", label: "Kling V1", description: "Standard quality" },
  { value: "kling-v1-5", label: "Kling V1.5", description: "Enhanced quality" },
  { value: "kling-v1-6", label: "Kling V1.6", description: "Latest model" },
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

export default function KlingMultiImageToVideo() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();

  // Form state
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [model, setModel] = useState<string>("kling-v1-6");
  const [mode, setMode] = useState<string>("std");
  const [duration, setDuration] = useState<string>("5");
  const [cfgScale, setCfgScale] = useState<number>(0.5);

  // Image upload state
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const response = await apiClient.get(
        "/api/generate/kling-multi-image-to-video?history=true"
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
    }
  }, [apiClient, loadVaultData, loadGenerationHistory]);

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Filter valid image files
    const validFiles = files.filter(file => file.type.startsWith("image/"));
    
    // Check total count
    const totalImages = uploadedImages.length + validFiles.length;
    if (totalImages > 5) {
      setError("Maximum 5 images allowed");
      return;
    }

    // Create preview URLs
    validFiles.forEach(file => {
      const preview = URL.createObjectURL(file);
      const newImage: UploadedImage = {
        id: `${Date.now()}-${Math.random()}`,
        file,
        preview,
      };
      setUploadedImages(prev => [...prev, newImage]);
    });

    // Reset input
    if (e.target) {
      e.target.value = "";
    }
  };

  // Remove image
  const removeImage = (id: string) => {
    setUploadedImages(prev => {
      const image = prev.find(img => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter(img => img.id !== id);
    });
  };

  // Move image up
  const moveImageUp = (index: number) => {
    if (index === 0) return;
    setUploadedImages(prev => {
      const newImages = [...prev];
      [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
      return newImages;
    });
  };

  // Move image down
  const moveImageDown = (index: number) => {
    if (index === uploadedImages.length - 1) return;
    setUploadedImages(prev => {
      const newImages = [...prev];
      [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
      return newImages;
    });
  };

  // Poll for task status
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
            `/api/generate/kling-multi-image-to-video?taskId=${taskId}`
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

          if (data.status === "succeed" && data.videoUrl) {
            updateGlobalProgress({
              isGenerating: false,
              progress: 100,
              stage: "completed",
              message: "Video generation completed!",
              generationType: "image-to-video",
              jobId: localTaskId,
            });
            setGeneratedVideos([{
              id: data.id || taskId,
              videoUrl: data.videoUrl,
              prompt: prompt,
              model: model,
              duration: duration,
              imageCount: uploadedImages.length,
              createdAt: new Date().toISOString(),
              status: "completed"
            }]);
            setPollingStatus("");
            setIsGenerating(false);
            loadGenerationHistory();
            resolve();
            return;
          }

          if (data.status === "failed") {
            throw new Error(data.error || data.message || "Video generation failed");
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
    if (uploadedImages.length < 2) {
      setError("Please upload at least 2 images");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("Uploading images...");
    const localTaskId = `kling-multi-i2v-${Date.now()}`;

    try {
      updateGlobalProgress({
        isGenerating: true,
        progress: 0,
        stage: "starting",
        message: "Starting Kling Multi-Image-to-Video generation...",
        generationType: "image-to-video",
        jobId: localTaskId,
      });

      // Prepare form data
      const formData = new FormData();
      
      // Add images
      uploadedImages.forEach((img, index) => {
        formData.append(`image${index + 1}`, img.file);
      });

      // Add parameters
      if (prompt) formData.append("prompt", prompt);
      if (negativePrompt) formData.append("negative_prompt", negativePrompt);
      formData.append("model", model);
      formData.append("mode", mode);
      formData.append("duration", duration);
      formData.append("cfg_scale", cfgScale.toString());

      // Parse target folder for vault vs S3
      const parsedFolder = parseTargetFolder(targetFolder);
      
      // Add folder params based on type
      if (parsedFolder.type === "vault" && parsedFolder.profileId && parsedFolder.folderId) {
        formData.append("saveToVault", "true");
        formData.append("vaultProfileId", parsedFolder.profileId);
        formData.append("vaultFolderId", parsedFolder.folderId);
      } else if (parsedFolder.prefix) {
        formData.append("targetFolder", parsedFolder.prefix);
      }

      const response = await apiClient.post(
        "/api/generate/kling-multi-image-to-video",
        formData
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
    setCfgScale(0.5);
    setUploadedImages([]);
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
                <Images className="w-6 h-6 text-white" />
                <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Motion Studio</p>
                <h1 className="text-3xl sm:text-4xl font-black text-white">Kling AI — Multi-Image to Video</h1>
              </div>
            </div>
            <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed">
              Create smooth transitions and animations from 2-5 images using Kling AI&apos;s 
              multi-image interpolation technology. Perfect for creating dynamic morphing videos.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Images</p>
                  <p className="text-sm font-semibold text-white">2-5 Images</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20 text-pink-200">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Duration</p>
                  <p className="text-sm font-semibold text-white">5s or 10s</p>
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
                  <span className="rounded-full bg-white/10 px-3 py-1">{uploadedImages.length} images</span>
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
              {/* Image Upload Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-100">Upload Images (2-5) *</label>
                  <span className="text-xs text-slate-400">{uploadedImages.length}/5</span>
                </div>
                
                {uploadedImages.length < 5 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGenerating}
                    className="w-full py-6 border-2 border-dashed border-white/20 hover:border-violet-400/50 rounded-2xl bg-white/5 hover:bg-white/10 transition-all flex flex-col items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="p-3 bg-violet-500/10 rounded-full group-hover:bg-violet-500/20 transition-colors">
                      <Upload className="h-6 w-6 text-violet-300" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-white font-medium">Click to upload images</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {uploadedImages.length === 0 ? "Upload 2-5 images to start" : `Add ${5 - uploadedImages.length} more`}
                      </p>
                    </div>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />

                {/* Image Preview Grid */}
                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {uploadedImages.map((image, index) => (
                      <div key={image.id} className="relative group">
                        <div className="aspect-square rounded-xl overflow-hidden border-2 border-white/10 group-hover:border-violet-400/50 transition-colors">
                          <img
                            src={image.preview}
                            alt={`Upload ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        
                        {/* Image Order Badge */}
                        <div className="absolute top-1 left-1 bg-violet-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                          {index + 1}
                        </div>

                        {/* Action Buttons */}
                        <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {index > 0 && (
                            <button
                              onClick={() => moveImageUp(index)}
                              className="p-1 bg-slate-900/90 hover:bg-slate-800 rounded text-white"
                              title="Move up"
                            >
                              <ChevronDown className="h-3 w-3 rotate-180" />
                            </button>
                          )}
                          {index < uploadedImages.length - 1 && (
                            <button
                              onClick={() => moveImageDown(index)}
                              className="p-1 bg-slate-900/90 hover:bg-slate-800 rounded text-white"
                              title="Move down"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            onClick={() => removeImage(image.id)}
                            className="p-1 bg-red-500/90 hover:bg-red-600 rounded text-white"
                            title="Remove"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Prompt Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-100">Prompt (Optional)</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the transition or animation style..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent disabled:opacity-50"
                  rows={3}
                  disabled={isGenerating}
                />
                <p className="text-xs text-slate-300">Optional: Guide the transition style between images.</p>
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
                <div className="grid grid-cols-3 gap-2">
                  {MODEL_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setModel(option.value)}
                      className={`rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                        model === option.value
                          ? "border-violet-400/70 bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-pink-500/10 text-white shadow-violet-900/40"
                          : "border-white/10 bg-white/5 text-slate-100/90"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="text-xs text-slate-300">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-100">Quality Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  {MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setMode(option.value)}
                      className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                        mode === option.value
                          ? "border-violet-400/70 bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-pink-500/10 text-white shadow-violet-900/40"
                          : "border-white/10 bg-white/5 text-slate-100/90"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="text-xs text-slate-300">{option.description}</p>
                    </button>
                  ))}
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

              {/* CFG Scale */}
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
                  disabled={isGenerating || uploadedImages.length < 2}
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
                        src={video.videoUrl}
                        className="w-full aspect-video object-cover"
                        muted
                        loop
                        playsInline
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-3">
                        <p className="text-sm text-white font-medium truncate">
                          {video.prompt || "Multi-image interpolation"}
                        </p>
                        <p className="text-xs text-slate-300">
                          {video.imageCount} images · {video.duration}s
                        </p>
                      </div>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(video.videoUrl, `kling-multi-i2v-${video.id}.mp4`);
                          }}
                          className="p-2 bg-white/10 backdrop-blur rounded-full text-white hover:bg-white/20"
                        >
                          <Download className="w-4 h-4" />
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
                  <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Recent</p>
                  <h2 className="text-lg font-semibold text-white">History</h2>
                </div>
                <button
                  onClick={() => loadGenerationHistory()}
                  disabled={isLoadingHistory}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition"
                >
                  <RefreshCw className={`w-4 h-4 text-slate-300 ${isLoadingHistory ? "animate-spin" : ""}`} />
                </button>
              </div>

              {generationHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-slate-300">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm">No generation history yet.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {generationHistory.map((video) => (
                    <div
                      key={video.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openVideoModal(video)}
                      className="flex gap-3 p-3 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition cursor-pointer"
                    >
                      <div className="w-20 h-14 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">
                        <video
                          src={video.videoUrl}
                          className="w-full h-full object-cover"
                          muted
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">
                          {video.prompt || "Multi-image interpolation"}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {video.imageCount} images · {video.duration}s · {video.model}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(video.createdAt).toLocaleDateString()}
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
                className="w-full h-auto max-h-[70vh] object-contain bg-black rounded-t-3xl"
              />
              <div className="p-4 text-sm text-slate-200">
                <p className="font-semibold text-white mb-1">{selectedVideo.prompt || "Multi-image interpolation"}</p>
                <p className="text-slate-400">
                  {selectedVideo.imageCount} images · {selectedVideo.duration}s · {selectedVideo.model}
                </p>
                <button
                  onClick={() => handleDownload(selectedVideo.videoUrl, `kling-multi-i2v-${selectedVideo.id}.mp4`)}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 via-purple-500 to-pink-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
                >
                  <Download className="w-4 h-4" />
                  Download Video
                </button>
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
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-6 text-slate-100">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-violet-400" />
                  <h3 className="text-xl font-semibold">Multi-Image to Video Guide</h3>
                </div>
                
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-4">
                    <h4 className="font-semibold text-emerald-100 mb-2">✓ Best Practices</h4>
                    <ul className="text-sm space-y-1 text-emerald-50">
                      <li>• Use 2-5 images in logical sequence</li>
                      <li>• Keep similar composition across images</li>
                      <li>• Use high-quality source images</li>
                      <li>• Consistent lighting helps smooth transitions</li>
                    </ul>
                  </div>
                  <div className="bg-red-500/10 border border-red-400/30 rounded-2xl p-4">
                    <h4 className="font-semibold text-red-100 mb-2">✗ Avoid</h4>
                    <ul className="text-sm space-y-1 text-red-50">
                      <li>• Drastically different scenes</li>
                      <li>• Low resolution images</li>
                      <li>• Inconsistent aspect ratios</li>
                      <li>• Blurry or compressed images</li>
                    </ul>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Zap className="w-4 h-4 text-violet-400" />
                      Standard Mode
                    </h4>
                    <ul className="text-sm space-y-1 text-slate-300 mt-2">
                      <li>• Faster generation time</li>
                      <li>• Good for quick previews</li>
                      <li>• Lower compute cost</li>
                    </ul>
                  </div>
                  <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-pink-400" />
                      Professional Mode
                    </h4>
                    <ul className="text-sm space-y-1 text-slate-300 mt-2">
                      <li>• Higher quality output</li>
                      <li>• Smoother transitions</li>
                      <li>• Better for final renders</li>
                    </ul>
                  </div>
                </div>

                <div className="border border-amber-400/30 bg-amber-500/10 rounded-2xl p-4">
                  <h4 className="font-semibold flex items-center gap-2 text-amber-100">
                    <AlertCircle className="w-4 h-4" />
                    Tips
                  </h4>
                  <ul className="text-sm space-y-1 text-amber-50 list-disc list-inside mt-2">
                    <li>Images are processed in the order you upload them</li>
                    <li>Use drag buttons to reorder images before generating</li>
                    <li>Prompts help guide transition style but are optional</li>
                    <li>10s duration works best with more images (4-5)</li>
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
