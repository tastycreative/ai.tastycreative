// app/(dashboard)/workspace/generate-content/fps-boost/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import VaultFolderDropdown from "@/components/generate-content/shared/VaultFolderDropdown";
import { useCredits } from '@/lib/hooks/useCredits.query';
import { CreditCalculator } from "@/components/credits/CreditCalculator";
import {
  Video,
  Upload,
  Wand2,
  Loader2,
  Download,
  Share2,
  AlertCircle,
  Zap,
  Gauge,
  Settings,
  ChevronDown,
  ChevronUp,
  X,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Clock,
  XCircle,
  Sparkles,
  Archive,
  FolderOpen,
  Check,
} from "lucide-react";

// Types
interface FPSBoostParams {
  targetFPS: number; // Target FPS (20-120)
  clearCache: number; // Clear cache after N frames
  fastMode: boolean; // Fast mode for quicker processing
  ensemble: boolean; // Ensemble mode for better quality
  uploadedVideo: string | null;
  targetFolder: string; // Target folder for output
}

interface GenerationJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  resultUrls?: string[];
  error?: string;
  createdAt?: Date | string;
  userId?: string;
  lastChecked?: string;
  comfyUIPromptId?: string;
  stage?: string;
  message?: string;
  elapsedTime?: number;
  estimatedTimeRemaining?: number;
}

interface DatabaseVideo {
  id: string;
  filename: string;
  subfolder: string;
  type: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
  format?: string;
  url?: string;
  dataUrl?: string;
  s3Key?: string;
  networkVolumePath?: string;
  awsS3Key?: string;
  awsS3Url?: string;
  createdAt: Date | string;
}

// Vault interface
interface VaultFolder {
  id: string;
  name: string;
  profileId: string;
  clerkId: string; // Owner of the folder (important for shared profiles)
  profileName?: string;
  profileUsername?: string | null;
  isDefault?: boolean;
  isOwnedProfile?: boolean;
  ownerName?: string | null;
}

const formatJobTime = (createdAt: Date | string | undefined): string => {
  try {
    if (!createdAt) return "Unknown time";
    const date = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
    if (isNaN(date.getTime())) return "Invalid time";
    return date.toLocaleTimeString();
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Unknown time";
  }
};

const VideoPlayer = ({
  video,
  onDownload,
  onShare,
  label,
}: {
  video: DatabaseVideo;
  onDownload: () => void;
  onShare: () => void;
  label?: string;
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const awsS3Url = useMemo(() => {
    if (video.awsS3Url) return video.awsS3Url;
    if (video.awsS3Key) return `https://tastycreative.s3.amazonaws.com/${video.awsS3Key}`;
    return null;
  }, [video.awsS3Key, video.awsS3Url]);

  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [video.id]);

  if (!awsS3Url) {
    return (
      <div className="relative group">
        <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Video URL not available</p>
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="relative group">
        <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Failed to load video</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group">
      {label && (
        <div className="absolute top-2 left-2 z-10 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
          {label}
        </div>
      )}
      
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center z-10">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      )}

      <video
        ref={videoRef}
        controls
        className="w-full rounded-lg shadow-md"
        onError={() => setHasError(true)}
        onLoadedData={() => setIsLoading(false)}
        onCanPlay={() => setIsLoading(false)}
        preload="metadata"
        playsInline
      >
        <source src={awsS3Url} type="video/mp4" />
      </video>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex space-x-1">
          <button
            onClick={onDownload}
            className="p-1.5 sm:p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md active:scale-95"
            title="Download"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            onClick={onShare}
            className="p-1.5 sm:p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md active:scale-95"
            title="Share"
          >
            <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {video.fps && (
        <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black bg-opacity-75 text-white text-[10px] xs:text-xs px-1.5 xs:px-2 py-0.5 xs:py-1 rounded">
            {Math.round(video.fps)} FPS
            {video.duration && ` • ${video.duration.toFixed(1)}s`}
          </div>
        </div>
      )}
    </div>
  );
};

export default function FPSBoostPage() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();
  const { refreshCredits } = useCredits();

  // Use global profile from header
  const { profileId: globalProfileId, selectedProfile, isAllProfiles } = useInstagramProfile();

  const STORAGE_KEYS = {
    currentJob: 'fps-boost-current-job',
    isGenerating: 'fps-boost-is-generating',
    progressData: 'fps-boost-progress-data',
    jobHistory: 'fps-boost-job-history',
  };

  const [params, setParams] = useState<FPSBoostParams>({
    targetFPS: 30,
    clearCache: 10,
    fastMode: true,
    ensemble: true,
    uploadedVideo: null,
    targetFolder: '', // No default - user must select
  });

  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [jobHistory, setJobHistory] = useState<GenerationJob[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedVideoPreview, setUploadedVideoPreview] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jobVideos, setJobVideos] = useState<Record<string, DatabaseVideo[]>>({});
  const [videoStats, setVideoStats] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  
  // Hydration fix - track if component is mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Folder selection dropdown state
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  
  // Vault folder states - single list based on selected profile
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const isJobCancelled = (job: GenerationJob) => {
    return job.status === 'failed' && job.error === 'Job canceled by user';
  };

  const clearPersistentState = () => {
    if (typeof window !== 'undefined') {
      Object.values(STORAGE_KEYS).forEach(key => {
        if (key !== STORAGE_KEYS.jobHistory) {
          localStorage.removeItem(key);
        }
      });
    }
    clearGlobalProgress();
  };

  // Load vault folders for the selected profile (or all profiles)
  const loadVaultData = useCallback(async () => {
    if (!apiClient || !globalProfileId) return;

    setIsLoadingVaultData(true);
    try {
      const foldersResponse = await fetch(`/api/vault/folders?profileId=${globalProfileId}`);
      if (foldersResponse.ok) {
        const folders = await foldersResponse.json();
        setVaultFolders(folders);
      }
    } catch (error) {
      console.error('Failed to load vault folders:', error);
      setVaultFolders([]);
    } finally {
      setIsLoadingVaultData(false);
    }
  }, [apiClient, globalProfileId]);

  // Load vault data when profile changes
  useEffect(() => {
    loadVaultData();
    // Clear selected folder when profile changes
    setParams(prev => ({ ...prev, targetFolder: '' }));
  }, [loadVaultData]);

  // Handle video upload
  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !apiClient) return;

    setIsUploading(true);

    try {
      console.log("=== UPLOADING VIDEO FOR FPS BOOST ===");
      console.log("File:", file.name, file.size, file.type);

      const formData = new FormData();
      formData.append("video", file);

      const response = await apiClient.postFormData("/api/upload/video", formData);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      console.log("Upload result:", result);

      if (result.success && result.filename) {
        setParams((prev) => ({ ...prev, uploadedVideo: result.filename }));

        // Store base64 data for serverless API
        if (result.base64) {
          (window as any).fpsBoostVideoBase64Data = result.base64;
        }

        // Create preview URL
        const previewUrl = URL.createObjectURL(file);
        setUploadedVideoPreview(previewUrl);

        console.log("✅ Video uploaded successfully:", result.filename);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload video: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsUploading(false);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      const fakeEvent = {
        target: { files: [file] }
      } as any;
      await handleVideoUpload(fakeEvent);
    }
  };

  const removeUploadedVideo = () => {
    setParams((prev) => ({ ...prev, uploadedVideo: null }));
    setUploadedVideoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const createWorkflowJson = (params: FPSBoostParams, normalizedTargetFolder: string) => {
    // Calculate multiplier based on target FPS (assuming 30 FPS input)
    const baselineFPS = 30;
    const multiplier = Math.max(2, Math.round(params.targetFPS / baselineFPS));
    
    const workflow: any = {
      "1": {
        inputs: {
          video: params.uploadedVideo || "",
          force_rate: 0,
          custom_width: 0,
          custom_height: 0,
          frame_load_cap: 0,
          skip_first_frames: 0,
          select_every_nth: 1,
        },
        class_type: "VHS_LoadVideo",
      },
      "2": {
        inputs: {
          frames: ["1", 0],
          ckpt_name: "rife47.pth",
          clear_cache_after_n_frames: params.clearCache,
          multiplier: multiplier,
          fast_mode: params.fastMode,
          ensemble: params.ensemble,
          scale_factor: 1,
        },
        class_type: "RIFE VFI",
      },
      "3": {
        inputs: {
          images: ["2", 0],
          frame_rate: params.targetFPS,
          loop_count: 0,
          filename_prefix: `${normalizedTargetFolder}fps_boosted`,
          format: "video/h264-mp4",
          pix_fmt: "yuv420p",
          crf: 19,
          save_metadata: true,
          pingpong: false,
          save_output: true,
        },
        class_type: "VHS_VideoCombine",
      },
    };

    return workflow;
  };

  const handleGenerate = async () => {
    if (!apiClient) {
      alert("API client not ready");
      return;
    }

    if (!params.uploadedVideo) {
      alert("Please upload a video first");
      return;
    }

    if (!params.targetFolder) {
      alert("Please select a vault folder to save the output");
      return;
    }

    setIsGenerating(true);
    setCurrentJob(null);

    try {
      console.log("=== STARTING FPS BOOST GENERATION ===");
      
      // Get vault profile and folder IDs from selected folder
      const selectedFolder = vaultFolders.find(f => f.id === params.targetFolder);
      const profileId = selectedFolder?.profileId;
      const folderId = params.targetFolder;
      
      // Use temporary path for vault storage - vault path handled by webhook
      const normalizedTargetFolder = `outputs/${user?.id}/`;
      console.log("💾 Using temporary path for vault storage:", normalizedTargetFolder);

      console.log("Generation params:", params);
      console.log("📁 Vault folder info:", {
        targetFolder: params.targetFolder,
        profileId,
        folderId
      });
      console.log("🎯 Filename prefix will be:", `${normalizedTargetFolder}fps_boosted`);

      const workflow = createWorkflowJson(params, normalizedTargetFolder);
      const videoBase64Data = (window as any).fpsBoostVideoBase64Data;

      if (!videoBase64Data) {
        alert("Please re-upload your video");
        setIsGenerating(false);
        return;
      }

      const response = await apiClient.post("/api/generate/fps-boost", {
        workflow,
        params: { ...params, targetFolder: normalizedTargetFolder },
        videoData: videoBase64Data,
        // Vault parameters
        saveToVault: true,
        vaultProfileId: profileId,
        vaultFolderId: folderId,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Generation failed: ${response.status} - ${errorText}`);
      }

      const { jobId } = await response.json();
      console.log("Received job ID:", jobId);

      if (!jobId) {
        throw new Error("No job ID received");
      }

      const newJob: GenerationJob = {
        id: jobId,
        status: "pending",
        createdAt: new Date(),
        progress: 0,
      };

      setCurrentJob(newJob);
      setJobHistory((prev) => [newJob, ...prev.filter(Boolean)].slice(0, 5));

      pollJobStatus(jobId);
    } catch (error) {
      console.error("Generation error:", error);
      setIsGenerating(false);
      alert(error instanceof Error ? error.message : "Generation failed");
    }
  };

  const pollJobStatus = async (jobId: string) => {
    if (!apiClient) return;

    const maxAttempts = 600;
    let attempts = 0;

    const poll = async () => {
      if (!apiClient) return;

      try {
        attempts++;
        const response = await apiClient.get(`/api/jobs/${jobId}`);

        if (!response.ok) {
          if (response.status === 404 && attempts > 5) {
            setIsGenerating(false);
            return;
          }
          throw new Error(`Job status check failed: ${response.status}`);
        }

        const job = await response.json();
        if (job.createdAt && typeof job.createdAt === "string") {
          job.createdAt = new Date(job.createdAt);
        }

        setCurrentJob(job);
        setJobHistory((prev) =>
          prev.map((j) => (j?.id === jobId ? { ...job, createdAt: job.createdAt || j.createdAt } : j))
            .filter(Boolean)
            .slice(0, 5)
        );

        if (job.status === "completed") {
          console.log("✅ Job completed!");
          setIsGenerating(false);

          // Refresh credits after successful completion
          refreshCredits();

          await fetchJobVideos(jobId);
          return;
        } else if (job.status === "failed") {
          console.log("❌ Job failed:", job.error);
          setIsGenerating(false);
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setIsGenerating(false);
        }
      } catch (error) {
        console.error("Polling error:", error);
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setIsGenerating(false);
        }
      }
    };

    setTimeout(poll, 3000);
  };

  const fetchJobVideos = async (jobId: string): Promise<boolean> => {
    if (!apiClient) return false;

    try {
      const response = await apiClient.get(`/api/jobs/${jobId}/videos`);
      if (!response.ok) return false;

      const data = await response.json();
      if (data.success && data.videos && Array.isArray(data.videos)) {
        setJobVideos((prev) => ({ ...prev, [jobId]: data.videos }));
        return data.videos.length > 0;
      }
      return false;
    } catch (error) {
      console.error("Error fetching videos:", error);
      return false;
    }
  };

  const downloadVideo = async (video: DatabaseVideo) => {
    try {
      const url = video.awsS3Url || `https://tastycreative.s3.amazonaws.com/${video.awsS3Key}`;
      
      console.log("⬇️ Downloading video:", video.filename);
      
      // Fetch the video as a blob
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch video");
      
      const blob = await response.blob();
      
      // Create a blob URL and trigger download
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = video.filename || "video.mp4";
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL after a short delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      
      console.log("✅ Download started:", video.filename);
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to start download. Please try again or right-click the video to save.");
    }
  };

  const shareVideo = (video: DatabaseVideo) => {
    const url = video.awsS3Url || `https://tastycreative.s3.amazonaws.com/${video.awsS3Key}`;
    navigator.clipboard.writeText(url);
    alert("Video URL copied to clipboard!");
  };

  if (!apiClient) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-center space-x-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-slate-400">Initializing...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-50">
      {/* Background gradient effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute inset-x-10 top-20 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8 md:mb-10 text-center">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-xl sm:rounded-2xl shadow-lg animate-pulse">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
            </div>
            <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              FPS Boost Studio
            </h1>
          </div>
          <p className="text-xs sm:text-sm md:text-base lg:text-lg text-slate-300 max-w-2xl mx-auto px-2">
            AI-powered frame interpolation for ultra-smooth motion ⚡ Transform your videos with advanced RIFE technology
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          {/* Left Panel - Input */}
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {/* Video Upload */}
            <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 mb-4 sm:mb-6">
                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg sm:rounded-xl">
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-slate-50">Upload Video</h3>
              </div>

            {!uploadedVideoPreview ? (
              <div
                className={`relative border-2 border-dashed rounded-xl p-8 xs:p-10 sm:p-12 md:p-16 text-center cursor-pointer transition-all duration-300 ${
                  isDragging
                    ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 scale-[1.02] shadow-lg'
                    : 'border-slate-600 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-gradient-to-br hover:from-gray-50 hover:to-purple-50/30 dark:hover:from-gray-800/50 dark:hover:to-purple-900/10'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isUploading ? (
                  <div className="space-y-3 sm:space-y-4">
                    <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 animate-spin text-blue-500 mx-auto" />
                    <p className="text-xs sm:text-sm md:text-base text-slate-400">Uploading and analyzing video...</p>
                    <div className="max-w-xs mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 sm:h-2">
                      <div className="bg-blue-500 h-1.5 sm:h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    <div className={`transition-transform ${isDragging ? 'scale-110' : ''}`}>
                      <Video className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-blue-500 mx-auto" />
                    </div>
                    <div>
                      <p className="text-sm xs:text-base sm:text-lg font-semibold text-slate-50">
                        {isDragging ? 'Drop video here' : 'Click or drag to upload video'}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-400 mt-1">MP4, MOV, AVI up to 500MB</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                <div className="relative rounded-xl overflow-hidden border-2 border-slate-700/50 shadow-lg">
                  <video
                    ref={videoPreviewRef}
                    src={uploadedVideoPreview}
                    controls
                    className="w-full max-h-64 xs:max-h-72 sm:max-h-80 md:max-h-96 object-contain bg-black"
                  />
                  <button
                    onClick={removeUploadedVideo}
                    className="absolute top-2 xs:top-2.5 sm:top-3 right-2 xs:right-2.5 sm:right-3 p-1.5 sm:p-2 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg sm:rounded-xl hover:from-red-600 hover:to-red-700 transition-all hover:scale-110 shadow-xl z-10 active:scale-95"
                    title="Remove video"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
            />
          </div>

          {/* FPS Settings */}
          <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 mb-4 sm:mb-6">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg sm:rounded-xl">
                <Gauge className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-bold text-slate-50">FPS Settings</h3>
            </div>

            <div className="space-y-4 sm:space-y-6">
              {/* Output Folder Selection - Vault Only */}
              <div>
                <label className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2 text-slate-200">
                  <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500" />
                  <span>Save to Vault</span>
                  {isLoadingVaultData && (
                    <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin text-purple-400" />
                  )}
                </label>
                
                {/* Vault Folder Dropdown */}
                <VaultFolderDropdown
                  targetFolder={params.targetFolder}
                  setTargetFolder={(folder: string) => setParams(prev => ({ ...prev, targetFolder: folder }))}
                  folderDropdownOpen={folderDropdownOpen}
                  setFolderDropdownOpen={setFolderDropdownOpen}
                  vaultFolders={vaultFolders}
                  isAllProfiles={isAllProfiles}
                  selectedProfile={selectedProfile}
                  mounted={mounted}
                  accentColor="purple"
                />
                
                {/* Folder indicator */}
                <div className="flex items-center gap-2 mt-2">
                  {params.targetFolder && (
                    <div className="flex items-center gap-1.5 rounded-full bg-purple-500/20 px-2.5 py-1 text-[11px] text-purple-600 dark:text-purple-300">
                      <Archive className="w-3 h-3" />
                      <span>Vault Storage</span>
                    </div>
                  )}
                </div>
              </div>

              {/* FPS Presets */}
              <div>
                <label className="text-xs sm:text-sm font-medium mb-2 sm:mb-3 block">Quick Presets</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2">
                  {[30, 60, 90, 120].map((fps) => (
                    <button
                      key={fps}
                      onClick={() => setParams((prev) => ({ ...prev, targetFPS: fps }))}
                      className={`px-2 xs:px-3 sm:px-4 py-2 xs:py-2.5 sm:py-3 rounded-lg font-semibold transition-all text-xs xs:text-sm sm:text-base active:scale-95 ${
                        params.targetFPS === fps
                          ? 'bg-blue-600 text-white shadow-lg scale-105'
                          : 'bg-slate-700/50 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {fps} FPS
                    </button>
                  ))}
                </div>
              </div>

              {/* Target FPS Slider */}
              <div>
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <label className="text-xs sm:text-sm font-semibold text-slate-200">
                    Custom FPS
                  </label>
                  <div className="flex items-center space-x-1.5 sm:space-x-2 px-2 xs:px-3 sm:px-4 py-1 xs:py-1.5 sm:py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg sm:rounded-xl shadow-md">
                    <Gauge className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-white" />
                    <span className="text-lg xs:text-xl sm:text-2xl font-bold text-white">
                      {params.targetFPS}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min="20"
                  max="120"
                  step="5"
                  value={params.targetFPS}
                  onChange={(e) => setParams((prev) => ({ ...prev, targetFPS: parseInt(e.target.value) }))}
                  className="w-full h-3 bg-gradient-to-r from-blue-200 via-blue-400 to-blue-600 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((params.targetFPS - 20) / 100) * 100}%, #e5e7eb ${((params.targetFPS - 20) / 100) * 100}%, #e5e7eb 100%)`
                  }}
                />
                <div className="flex justify-between text-[10px] xs:text-xs text-slate-400 mt-1.5 sm:mt-2">
                  <span>Slow (20)</span>
                  <span>Smooth (60)</span>
                  <span>Ultra (120)</span>
                </div>
              </div>

              {/* Advanced Settings */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center space-x-1.5 sm:space-x-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors font-semibold text-xs xs:text-sm sm:text-base active:scale-95">
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Advanced Settings</span>
                {showAdvanced ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>

              {showAdvanced && (
                <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t">
                  {/* Quality/Speed Trade-off */}
                  <div>
                    <label className="text-xs sm:text-sm font-semibold text-slate-200 mb-2 sm:mb-3 block">Quality vs Speed</label>
                    <div className="relative">
                      <div className="flex justify-between text-[10px] xs:text-xs font-semibold text-slate-400 mb-2 sm:mb-3">
                        <span className="flex items-center space-x-0.5 xs:space-x-1">
                          <Zap className="w-2.5 h-2.5 xs:w-3 xs:h-3" />
                          <span>Fast</span>
                        </span>
                        <span>Balanced</span>
                        <span className="flex items-center space-x-0.5 xs:space-x-1">
                          <Sparkles className="w-2.5 h-2.5 xs:w-3 xs:h-3" />
                          <span>Quality</span>
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5 sm:space-x-2 md:space-x-3">
                        <button
                          onClick={() => setParams((prev) => ({ ...prev, fastMode: true, ensemble: false }))}
                          className={`flex-1 py-2 xs:py-2.5 sm:py-3 rounded-lg sm:rounded-xl transition-all duration-300 active:scale-95 ${
                            params.fastMode && !params.ensemble
                              ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-lg scale-105'
                              : 'bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700'
                          }`}
                        >
                          <Zap className="w-4 h-4 xs:w-4.5 xs:h-4.5 sm:w-5 sm:h-5 mx-auto" />
                        </button>
                        <button
                          onClick={() => setParams((prev) => ({ ...prev, fastMode: false, ensemble: false }))}
                          className={`flex-1 py-2 xs:py-2.5 sm:py-3 rounded-lg sm:rounded-xl transition-all duration-300 active:scale-95 ${
                            !params.fastMode && !params.ensemble
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg scale-105'
                              : 'bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700'
                          }`}
                        >
                          <Gauge className="w-4 h-4 xs:w-4.5 xs:h-4.5 sm:w-5 sm:h-5 mx-auto" />
                        </button>
                        <button
                          onClick={() => setParams((prev) => ({ ...prev, fastMode: false, ensemble: true }))}
                          className={`flex-1 py-2 xs:py-2.5 sm:py-3 rounded-lg sm:rounded-xl transition-all duration-300 active:scale-95 ${
                            params.ensemble
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg scale-105'
                              : 'bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700'
                          }`}
                        >
                          <Sparkles className="w-4 h-4 xs:w-4.5 xs:h-4.5 sm:w-5 sm:h-5 mx-auto" />
                        </button>
                      </div>
                      <p className="text-[10px] xs:text-xs text-slate-400 mt-2 sm:mt-3 text-center font-medium">
                        {params.fastMode && !params.ensemble && '⚡ Faster processing, good quality'}
                        {!params.fastMode && !params.ensemble && '⚖️ Balanced speed and quality'}
                        {params.ensemble && '✨ Slower processing, best quality'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs sm:text-sm font-semibold text-slate-200 mb-2 sm:mb-3 flex items-center justify-between">
                      <span>Memory Management</span>
                      <span className="px-2 xs:px-2.5 sm:px-3 py-0.5 xs:py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] xs:text-xs font-bold rounded-md sm:rounded-lg shadow-sm">
                        {params.clearCache} frames
                      </span>
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="5"
                      value={params.clearCache}
                      onChange={(e) => setParams((prev) => ({ ...prev, clearCache: parseInt(e.target.value) }))}
                      className="w-full h-2.5 sm:h-3 bg-gradient-to-r from-blue-200 via-blue-400 to-blue-600 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((params.clearCache - 5) / 45) * 100}%, #e5e7eb ${((params.clearCache - 5) / 45) * 100}%, #e5e7eb 100%)`
                      }}
                    />
                    <div className="flex justify-between text-[10px] xs:text-xs font-semibold text-slate-400 mt-1.5 sm:mt-2">
                      <span>Frequent (5)</span>
                      <span>Balanced (25)</span>
                      <span>Rare (50)</span>
                    </div>
                    <p className="text-[10px] xs:text-xs text-slate-400 mt-2 sm:mt-3 p-1.5 sm:p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                      💡 Clear cache more frequently for longer videos or limited GPU memory
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !params.uploadedVideo || !params.targetFolder}
            className="group w-full py-3 sm:py-4 md:py-5 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white font-bold text-sm sm:text-base md:text-lg rounded-xl sm:rounded-2xl hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 sm:gap-3 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            {isGenerating ? (
              <div className="flex items-center justify-center space-x-2 sm:space-x-3 relative z-10">
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                <span>Processing Magic...</span>
                {currentJob?.progress !== undefined && (
                  <span className="text-xs sm:text-sm bg-white/20 px-1.5 xs:px-2 py-0.5 xs:py-1 rounded-md sm:rounded-lg">({currentJob.progress}%)</span>
                )}
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-1.5 sm:space-x-2 relative z-10">
                <Wand2 className="w-5 h-5 sm:w-6 sm:h-6" />
                <span>Boost FPS to {params.targetFPS}</span>
                <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            )}
          </button>
          
          {(!params.uploadedVideo || !params.targetFolder) && (
            <div className="text-center py-2 xs:py-2.5 sm:py-3 px-3 xs:px-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
              <p className="text-xs xs:text-sm text-slate-200 font-medium flex items-center justify-center gap-1.5 sm:gap-2">
                <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {!params.uploadedVideo && "Please upload a video first"}
                {params.uploadedVideo && !params.targetFolder && "Please select a folder to save your output"}
              </p>
            </div>
          )}
        </div>

          {/* Right Panel - Progress & Results */}
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {/* Current Job */}
            {currentJob && (
              <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-slate-50">Current Generation</h3>
                  {currentJob.status === 'processing' && (
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-purple-500" />
                      <span className="text-[10px] xs:text-xs font-semibold text-purple-600 dark:text-purple-400">Processing</span>
                    </div>
                  )}
                  {currentJob.status === 'completed' && (
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                      <span className="text-[10px] xs:text-xs font-semibold text-green-600 dark:text-green-400">Completed</span>
                    </div>
                  )}
                  {currentJob.status === 'failed' && (
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                      <span className="text-[10px] xs:text-xs font-semibold text-red-600 dark:text-red-400">Failed</span>
                    </div>
                  )}
              </div>
              
              <div className="space-y-3 sm:space-y-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-slate-400">Status</span>
                  <span className={`px-2 xs:px-2.5 sm:px-3 py-0.5 xs:py-1 rounded-full text-[10px] xs:text-xs sm:text-sm font-medium flex items-center space-x-0.5 xs:space-x-1 ${
                    currentJob.status === 'completed' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                    currentJob.status === 'processing' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                    currentJob.status === 'failed' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                    'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                  }`}>
                    {currentJob.status === 'processing' && <Loader2 className="w-2.5 h-2.5 xs:w-3 xs:h-3 animate-spin" />}
                    {currentJob.status === 'completed' && <CheckCircle2 className="w-2.5 h-2.5 xs:w-3 xs:h-3" />}
                    {currentJob.status === 'failed' && <XCircle className="w-2.5 h-2.5 xs:w-3 xs:h-3" />}
                    <span className="capitalize">{currentJob.status}</span>
                  </span>
                </div>

                {/* Progress Bar */}
                {currentJob.status === 'processing' && currentJob.progress !== undefined && (
                  <div>
                    <div className="flex justify-between text-xs sm:text-sm mb-1.5 sm:mb-2">
                      <span className="text-slate-400">Progress</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{currentJob.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 sm:h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2.5 sm:h-3 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                        style={{ width: `${currentJob.progress}%` }}
                      >
                        <div className="absolute inset-0 bg-white/30 animate-pulse" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Stage Info */}
                {currentJob.stage && (
                  <div className="text-xs sm:text-sm text-slate-400 flex items-center space-x-1.5 sm:space-x-2">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>{currentJob.stage}</span>
                  </div>
                )}

                {/* Time Info */}
                {currentJob.elapsedTime && (
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                    <div className="p-1.5 sm:p-2 bg-slate-800/40 rounded-lg">
                      <div className="text-[10px] xs:text-xs text-slate-400 dark:text-slate-400">Elapsed</div>
                      <div className="font-semibold">{Math.floor(currentJob.elapsedTime / 60)}m {currentJob.elapsedTime % 60}s</div>
                    </div>
                    {currentJob.estimatedTimeRemaining && (
                      <div className="p-1.5 sm:p-2 bg-slate-800/40 rounded-lg">
                        <div className="text-[10px] xs:text-xs text-slate-400 dark:text-slate-400">Remaining</div>
                        <div className="font-semibold">{Math.floor(currentJob.estimatedTimeRemaining / 60)}m {currentJob.estimatedTimeRemaining % 60}s</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Error Display */}
                {currentJob.status === 'failed' && currentJob.error && (
                  <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start space-x-1.5 sm:space-x-2">
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-red-900 dark:text-red-100 mb-0.5 sm:mb-1">Generation Failed</p>
                        <p className="text-[10px] xs:text-xs text-red-700 dark:text-red-300">{currentJob.error}</p>
                        <button
                          onClick={handleGenerate}
                          className="mt-1.5 sm:mt-2 text-[10px] xs:text-xs text-red-600 dark:text-red-400 hover:underline flex items-center space-x-0.5 xs:space-x-1 active:scale-95"
                        >
                          <RotateCcw className="w-2.5 h-2.5 xs:w-3 xs:h-3" />
                          <span>Retry Generation</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Results */}
                {currentJob.status === 'completed' && jobVideos[currentJob.id] && (
                  <div className="space-y-3 sm:space-y-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm sm:text-base font-semibold flex items-center space-x-1.5 sm:space-x-2">
                        <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" />
                        <span>Your Boosted Video</span>
                      </h4>
                      {showComparison && uploadedVideoPreview && (
                        <button
                          onClick={() => setShowComparison(!showComparison)}
                          className="text-[10px] xs:text-xs text-blue-600 dark:text-blue-400 hover:underline active:scale-95"
                        >
                          {showComparison ? 'Hide' : 'Show'} Comparison
                        </button>
                      )}
                    </div>
                    
                    {jobVideos[currentJob.id].map((video) => (
                      <div key={video.id} className="space-y-2 sm:space-y-3">
                        <VideoPlayer
                          video={video}
                          onDownload={() => downloadVideo(video)}
                          onShare={() => shareVideo(video)}
                          label={`${params.targetFPS} FPS`}
                        />
                        
                        <div className="flex space-x-1.5 sm:space-x-2">
                          <button
                            onClick={() => downloadVideo(video)}
                            className="flex-1 py-2 sm:py-2.5 px-3 sm:px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm active:scale-95"
                          >
                            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>Download</span>
                          </button>
                          <button
                            onClick={() => shareVideo(video)}
                            className="flex-1 py-2 sm:py-2.5 px-3 sm:px-4 bg-gray-600 hover:bg-slate-700/50 text-white rounded-lg transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm active:scale-95"
                          >
                            <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>Share</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Credit Calculator */}
      <CreditCalculator
        path="fps-boost"
        modifiers={[
          ...(params.targetFPS >= 60 ? [{
            label: `High FPS Target (${params.targetFPS})`,
            multiplier: params.targetFPS / 30,
            description: 'Higher FPS targets cost more credits'
          }] : []),
        ]}
        position="bottom-right"
      />
    </div>
  );
}
