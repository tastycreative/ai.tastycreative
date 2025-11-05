// app/(dashboard)/workspace/generate-content/fps-boost/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
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
  Folder,
  FolderPlus,
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
            <p className="text-sm text-gray-600 dark:text-gray-400">Video URL not available</p>
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
            <p className="text-sm text-gray-600 dark:text-gray-400">Failed to load video</p>
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
            className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onShare}
            className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {video.fps && (
        <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
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
  const [availableFolders, setAvailableFolders] = useState<Array<{slug: string, name: string, prefix: string, isShared?: boolean, permission?: 'VIEW' | 'EDIT'}>>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

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

  // Load available folders
  const loadFolders = async () => {
    if (!apiClient || !user) return;

    setIsLoadingFolders(true);
    try {
      const response = await apiClient.get('/api/s3/folders/list-custom');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.folders) {
          // Create folder objects with slug, name, prefix, shared status, and permission
          const folders = data.folders.map((folder: any) => {
            if (typeof folder === 'string') {
              return { slug: folder, name: folder, prefix: `outputs/${user.id}/${folder}/`, isShared: false, permission: 'EDIT' as const };
            }
            // Extract slug from prefix: outputs/{userId}/{slug}/
            const parts = folder.prefix.split('/').filter(Boolean);
            const slug = parts[2] || folder.name;
            return { 
              slug, 
              name: folder.name, 
              prefix: folder.prefix,
              isShared: folder.isShared || false,
              permission: folder.permission || 'EDIT' as 'VIEW' | 'EDIT'
            };
          });
          
          // Filter to only show folders with EDIT permission
          const editableFolders = folders.filter((f: any) => !f.isShared || f.permission === 'EDIT');
          
          setAvailableFolders(editableFolders);
          console.log('📁 Loaded editable folders with prefixes:', editableFolders);
        }
      }
    } catch (error) {
      console.error('Error loading folders:', error);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  // Load folders on mount
  useEffect(() => {
    if (apiClient && user) {
      loadFolders();
    }
  }, [apiClient, user]);

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

  const createWorkflowJson = (params: FPSBoostParams) => {
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
          filename_prefix: `${params.targetFolder}fps_boosted`,
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
      alert("Please select a folder to save the output");
      return;
    }

    setIsGenerating(true);
    setCurrentJob(null);

    try {
      console.log("=== STARTING FPS BOOST GENERATION ===");
      console.log("Generation params:", params);
      console.log("🎯 Target folder selected:", params.targetFolder);
      console.log("🎯 Filename prefix will be:", `${params.targetFolder}/fps_boosted`);

      const workflow = createWorkflowJson(params);
      const videoBase64Data = (window as any).fpsBoostVideoBase64Data;

      if (!videoBase64Data) {
        alert("Please re-upload your video");
        setIsGenerating(false);
        return;
      }

      const response = await apiClient.post("/api/generate/fps-boost", {
        workflow,
        params,
        videoData: videoBase64Data,
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
            <p className="text-gray-600 dark:text-gray-400">Initializing...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-700 rounded-3xl shadow-2xl border border-blue-200 dark:border-blue-800 p-8 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30 shadow-lg">
              <Zap className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center space-x-3">
                <span>FPS Boost</span>
                <Sparkles className="w-8 h-8" />
              </h1>
              <p className="text-blue-100 text-lg font-medium">
                AI-powered frame interpolation for ultra-smooth motion
              </p>
              <div className="flex items-center space-x-4 mt-3 text-sm">
                <div className="flex items-center space-x-1">
                  <Gauge className="w-4 h-4" />
                  <span>RIFE AI</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Video className="w-4 h-4" />
                  <span>2x - 5x FPS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video Upload */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center space-x-2">
              <Upload className="w-6 h-6 text-blue-500" />
              <span>Upload Video</span>
            </h3>

            {!uploadedVideoPreview ? (
              <div
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105'
                    : 'border-blue-300 dark:border-blue-600 hover:border-blue-400'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isUploading ? (
                  <div className="space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
                    <p className="text-gray-600 dark:text-gray-400">Uploading and analyzing video...</p>
                    <div className="max-w-xs mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className={`transition-transform ${isDragging ? 'scale-110' : ''}`}>
                      <Video className="w-16 h-16 text-blue-500 mx-auto" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {isDragging ? 'Drop video here' : 'Click or drag to upload video'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">MP4, MOV, AVI up to 500MB</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <video
                    ref={videoPreviewRef}
                    src={uploadedVideoPreview}
                    controls
                    className="w-full max-h-96 rounded-lg object-contain bg-black"
                  />
                  <button
                    onClick={removeUploadedVideo}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all hover:scale-110 z-10"
                    title="Remove video"
                  >
                    <X className="w-5 h-5" />
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border p-6">
            <h3 className="text-xl font-bold mb-4">FPS Settings</h3>

            <div className="space-y-6">
              {/* Output Folder Selection - Moved to top */}
              <div>
                <label className="text-sm font-medium mb-3 flex items-center space-x-2">
                  <Folder className="w-4 h-4 text-purple-500" />
                  <span>Save to Folder</span>
                </label>
                <div className="relative">
                  <select
                    value={params.targetFolder}
                    onChange={(e) => {
                      const selectedPrefix = e.target.value;
                      console.log("🔄 Folder selection changed to:", selectedPrefix);
                      setParams((prev) => ({ ...prev, targetFolder: selectedPrefix }));
                    }}
                    disabled={isLoadingFolders}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select a folder...</option>
                    {availableFolders.map((folder) => (
                      <option key={folder.prefix} value={folder.prefix}>
                        {folder.isShared ? '� ' : '📁 '}{folder.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {isLoadingFolders ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>
                {params.targetFolder && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center space-x-1">
                    <span>💡</span>
                    <span>Saving to: {params.targetFolder}</span>
                  </p>
                )}
              </div>

              {/* FPS Presets */}
              <div>
                <label className="text-sm font-medium mb-3 block">Quick Presets</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[30, 60, 90, 120].map((fps) => (
                    <button
                      key={fps}
                      onClick={() => setParams((prev) => ({ ...prev, targetFPS: fps }))}
                      className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                        params.targetFPS === fps
                          ? 'bg-blue-600 text-white shadow-lg scale-105'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {fps} FPS
                    </button>
                  ))}
                </div>
              </div>

              {/* Target FPS Slider */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">
                    Custom FPS
                  </label>
                  <div className="flex items-center space-x-2">
                    <Gauge className="w-5 h-5 text-blue-500" />
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
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
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Slow (20)</span>
                  <span>Smooth (60)</span>
                  <span>Ultra (120)</span>
                </div>
              </div>

              {/* Advanced Settings */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center space-x-2 text-blue-600 dark:text-blue-400"
              >
                <Settings className="w-4 h-4" />
                <span>Advanced Settings</span>
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAdvanced && (
                <div className="space-y-4 pt-4 border-t">
                  {/* Quality/Speed Trade-off */}
                  <div>
                    <label className="text-sm font-medium mb-3 block">Quality vs Speed</label>
                    <div className="relative">
                      <div className="flex justify-between text-xs text-gray-500 mb-2">
                        <span className="flex items-center space-x-1">
                          <Zap className="w-3 h-3" />
                          <span>Fast</span>
                        </span>
                        <span>Balanced</span>
                        <span className="flex items-center space-x-1">
                          <Sparkles className="w-3 h-3" />
                          <span>Quality</span>
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => setParams((prev) => ({ ...prev, fastMode: true, ensemble: false }))}
                          className={`flex-1 py-2 rounded-lg transition-all ${
                            params.fastMode && !params.ensemble
                              ? 'bg-yellow-500 text-white shadow-lg'
                              : 'bg-gray-100 dark:bg-gray-700'
                          }`}
                        >
                          <Zap className="w-4 h-4 mx-auto" />
                        </button>
                        <button
                          onClick={() => setParams((prev) => ({ ...prev, fastMode: false, ensemble: false }))}
                          className={`flex-1 py-2 rounded-lg transition-all ${
                            !params.fastMode && !params.ensemble
                              ? 'bg-blue-500 text-white shadow-lg'
                              : 'bg-gray-100 dark:bg-gray-700'
                          }`}
                        >
                          <Gauge className="w-4 h-4 mx-auto" />
                        </button>
                        <button
                          onClick={() => setParams((prev) => ({ ...prev, fastMode: false, ensemble: true }))}
                          className={`flex-1 py-2 rounded-lg transition-all ${
                            params.ensemble
                              ? 'bg-purple-500 text-white shadow-lg'
                              : 'bg-gray-100 dark:bg-gray-700'
                          }`}
                        >
                          <Sparkles className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        {params.fastMode && !params.ensemble && 'Faster processing, good quality'}
                        {!params.fastMode && !params.ensemble && 'Balanced speed and quality'}
                        {params.ensemble && 'Slower processing, best quality'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 flex items-center justify-between">
                      <span>Memory Management</span>
                      <span className="text-xs text-blue-600 dark:text-blue-400">{params.clearCache} frames</span>
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="5"
                      value={params.clearCache}
                      onChange={(e) => setParams((prev) => ({ ...prev, clearCache: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Frequent (5)</span>
                      <span>Balanced (25)</span>
                      <span>Rare (50)</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Clear cache more frequently for longer videos or limited GPU memory
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
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl shadow-lg transition-all hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <div className="flex items-center justify-center space-x-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processing...</span>
                {currentJob?.progress !== undefined && (
                  <span className="text-sm">({currentJob.progress}%)</span>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <Wand2 className="w-5 h-5" />
                <span>Boost FPS to {params.targetFPS}</span>
                <Zap className="w-4 h-4" />
              </div>
            )}
          </button>
          
          {(!params.uploadedVideo || !params.targetFolder) && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 -mt-2">
              {!params.uploadedVideo && "Please upload a video first"}
              {params.uploadedVideo && !params.targetFolder && "Please select a folder"}
            </p>
          )}
        </div>

        {/* Right Panel - Results */}
        <div className="space-y-6">
          {/* Current Job */}
          {currentJob && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Current Generation</h3>
                {currentJob.status === 'processing' && (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                )}
                {currentJob.status === 'completed' && (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
                {currentJob.status === 'failed' && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
              
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1 ${
                    currentJob.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                    currentJob.status === 'processing' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                    currentJob.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                    'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                  }`}>
                    {currentJob.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {currentJob.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                    {currentJob.status === 'failed' && <XCircle className="w-3 h-3" />}
                    <span className="capitalize">{currentJob.status}</span>
                  </span>
                </div>

                {/* Progress Bar */}
                {currentJob.status === 'processing' && currentJob.progress !== undefined && (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600 dark:text-gray-400">Progress</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{currentJob.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-cyan-500 h-3 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                        style={{ width: `${currentJob.progress}%` }}
                      >
                        <div className="absolute inset-0 bg-white/30 animate-pulse" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Stage Info */}
                {currentJob.stage && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>{currentJob.stage}</span>
                  </div>
                )}

                {/* Time Info */}
                {currentJob.elapsedTime && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Elapsed</div>
                      <div className="font-semibold">{Math.floor(currentJob.elapsedTime / 60)}m {currentJob.elapsedTime % 60}s</div>
                    </div>
                    {currentJob.estimatedTimeRemaining && (
                      <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Remaining</div>
                        <div className="font-semibold">{Math.floor(currentJob.estimatedTimeRemaining / 60)}m {currentJob.estimatedTimeRemaining % 60}s</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Error Display */}
                {currentJob.status === 'failed' && currentJob.error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-900 dark:text-red-100 mb-1">Generation Failed</p>
                        <p className="text-xs text-red-700 dark:text-red-300">{currentJob.error}</p>
                        <button
                          onClick={handleGenerate}
                          className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline flex items-center space-x-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry Generation</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Results */}
                {currentJob.status === 'completed' && jobVideos[currentJob.id] && (
                  <div className="space-y-4 mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center space-x-2">
                        <Video className="w-4 h-4 text-green-500" />
                        <span>Your Boosted Video</span>
                      </h4>
                      {showComparison && uploadedVideoPreview && (
                        <button
                          onClick={() => setShowComparison(!showComparison)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {showComparison ? 'Hide' : 'Show'} Comparison
                        </button>
                      )}
                    </div>
                    
                    {jobVideos[currentJob.id].map((video) => (
                      <div key={video.id} className="space-y-3">
                        <VideoPlayer
                          video={video}
                          onDownload={() => downloadVideo(video)}
                          onShare={() => shareVideo(video)}
                          label={`${params.targetFPS} FPS`}
                        />
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={() => downloadVideo(video)}
                            className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center justify-center space-x-2"
                          >
                            <Download className="w-4 h-4" />
                            <span>Download</span>
                          </button>
                          <button
                            onClick={() => shareVideo(video)}
                            className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all flex items-center justify-center space-x-2"
                          >
                            <Share2 className="w-4 h-4" />
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
  );
}
