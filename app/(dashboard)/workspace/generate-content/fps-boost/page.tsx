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
} from "lucide-react";

// Types
interface FPSBoostParams {
  targetFPS: number; // Target FPS (20-120)
  clearCache: number; // Clear cache after N frames
  fastMode: boolean; // Fast mode for quicker processing
  ensemble: boolean; // Ensemble mode for better quality
  uploadedVideo: string | null;
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
  });

  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [jobHistory, setJobHistory] = useState<GenerationJob[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedVideoPreview, setUploadedVideoPreview] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jobVideos, setJobVideos] = useState<Record<string, DatabaseVideo[]>>({});
  const [videoStats, setVideoStats] = useState<any>(null);

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
          filename_prefix: "fps_boost/fps_boosted",
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

    setIsGenerating(true);
    setCurrentJob(null);

    try {
      console.log("=== STARTING FPS BOOST GENERATION ===");
      console.log("Generation params:", params);

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
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = video.filename;
        link.click();
        URL.revokeObjectURL(downloadUrl);
      }
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download video");
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
                className="relative border-2 border-dashed border-blue-300 dark:border-blue-600 rounded-2xl p-12 text-center cursor-pointer hover:border-blue-400 transition-all"
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <div className="space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
                    <p className="text-gray-600 dark:text-gray-400">Uploading video...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Video className="w-16 h-16 text-blue-500 mx-auto" />
                    <div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        Click to upload video
                      </p>
                      <p className="text-sm text-gray-500 mt-1">MP4, MOV, AVI up to 500MB</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <video
                  ref={videoPreviewRef}
                  src={uploadedVideoPreview}
                  controls
                  className="w-full max-h-96 rounded-lg object-contain bg-black"
                />
                <button
                  onClick={removeUploadedVideo}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 z-10"
                >
                  <X className="w-5 h-5" />
                </button>
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
              {/* Target FPS Slider */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">
                    Target FPS
                  </label>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {params.targetFPS} FPS
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="120"
                  value={params.targetFPS}
                  onChange={(e) => setParams((prev) => ({ ...prev, targetFPS: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>20 FPS</span>
                  <span>120 FPS</span>
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
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Clear Cache After: {params.clearCache} frames
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      value={params.clearCache}
                      onChange={(e) => setParams((prev) => ({ ...prev, clearCache: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={params.fastMode}
                      onChange={(e) => setParams((prev) => ({ ...prev, fastMode: e.target.checked }))}
                    />
                    <span>Fast Mode (faster but slightly lower quality)</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={params.ensemble}
                      onChange={(e) => setParams((prev) => ({ ...prev, ensemble: e.target.checked }))}
                    />
                    <span>Ensemble Mode (better quality but slower)</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !params.uploadedVideo}
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl shadow-lg transition-all"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5 inline mr-2" />
                Boost FPS
              </>
            )}
          </button>
        </div>

        {/* Right Panel - Results */}
        <div className="space-y-6">
          {/* Current Job */}
          {currentJob && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold mb-4">Current Generation</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    currentJob.status === 'completed' ? 'bg-green-100 text-green-700' :
                    currentJob.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                    currentJob.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {currentJob.status}
                  </span>
                </div>

                {currentJob.progress !== undefined && (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Progress</span>
                      <span>{currentJob.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${currentJob.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {currentJob.status === 'completed' && jobVideos[currentJob.id] && (
                  <div className="space-y-4 mt-4">
                    <h4 className="font-semibold">Results:</h4>
                    {jobVideos[currentJob.id].map((video) => (
                      <VideoPlayer
                        key={video.id}
                        video={video}
                        onDownload={() => downloadVideo(video)}
                        onShare={() => shareVideo(video)}
                        label={`${params.targetFPS} FPS`}
                      />
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
