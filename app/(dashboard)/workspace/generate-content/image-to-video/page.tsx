// app/(dashboard)/workspace/generate-content/image-to-video/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import { getBestMediaUrl } from "@/lib/directUrlUtils";
import {
  Video,
  Upload,
  Wand2,
  Settings,
  Download,
  Share2,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Sparkles,
  Sliders,
  RefreshCw,
  X,
  Play,
  Pause,
  Layers,
  ImageIcon,
  Clock,
  Folder,
  ChevronDown,
} from "lucide-react";

// Types
interface GenerationParams {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  length: number;
  batchSize: number;
  steps: number;
  cfg: number;
  samplerName: string;
  scheduler: string;
  seed: number | null;
  uploadedImage: string | null;
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

  // Enhanced progress fields
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
  format?: string;
  url?: string;
  dataUrl?: string;
  s3Key?: string;
  networkVolumePath?: string;
  awsS3Key?: string;
  awsS3Url?: string;
  createdAt: Date | string;
}

// Constants
const ASPECT_RATIOS = [
  { name: "Portrait", width: 480, height: 720, ratio: "2:3" },
  { name: "Square", width: 720, height: 720, ratio: "1:1" },
  { name: "Landscape", width: 720, height: 480, ratio: "3:2" },
  { name: "Wide", width: 1280, height: 720, ratio: "16:9" },
];

const SAMPLERS = [
  "euler",
  "euler_ancestral",
  "heun",
  "dpm_2",
  "dpm_2_ancestral",
  "lms",
  "dpm_fast",
  "dpm_adaptive",
];

const SCHEDULERS = [
  "simple",
  "normal",
  "karras",
  "exponential",
  "sgm_uniform",
  "ddim_uniform",
  "beta",
];

const formatJobTime = (createdAt: Date | string | undefined): string => {
  try {
    if (!createdAt) return "Unknown time";
    const date =
      typeof createdAt === "string" ? new Date(createdAt) : createdAt;
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
}: {
  video: DatabaseVideo;
  onDownload: () => void;
  onShare: () => void;
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ONLY use AWS S3 URLs - no fallbacks
  const awsS3Url = useMemo(() => {
    // Priority 1: Direct AWS S3 URL
    if (video.awsS3Url) {
      console.log(`🚀 Using direct AWS S3 URL for ${video.filename}:`, video.awsS3Url);
      return video.awsS3Url;
    }
    
    // Priority 2: Generate AWS S3 URL from key
    if (video.awsS3Key) {
      const generatedUrl = `https://tastycreative.s3.amazonaws.com/${video.awsS3Key}`;
      console.log(`🚀 Generated AWS S3 URL for ${video.filename}:`, generatedUrl);
      return generatedUrl;
    }

    console.error(`❌ No AWS S3 URL available for ${video.filename}`);
    console.log(`❌ Video data:`, {
      awsS3Key: video.awsS3Key,
      awsS3Url: video.awsS3Url,
      filename: video.filename
    });
    return null;
  }, [video.awsS3Key, video.awsS3Url, video.filename]);

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error(`❌ AWS S3 video error for ${video.filename}:`, e);
    console.error(`❌ Failed AWS S3 URL:`, awsS3Url);
    setHasError(true);
    setIsLoading(false);
  };

  const handleVideoLoad = () => {
    console.log(`✅ AWS S3 video loaded successfully: ${video.filename}`);
    setIsLoading(false);
    setHasError(false);
  };

  const handleCanPlay = () => {
    console.log(`✅ AWS S3 video can play: ${video.filename}`);
    setIsLoading(false);
  };

  // Reset when video changes
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [video.id]);

  // Show error if no AWS S3 URL available
  if (!awsS3Url) {
    return (
      <div className="relative group">
        <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              AWS S3 URL not available
            </p>
            <p className="text-xs text-gray-500 mt-1">{video.filename}</p>
            <p className="text-xs text-red-500 mt-2">
              awsS3Key: {video.awsS3Key || 'missing'}<br/>
              awsS3Url: {video.awsS3Url || 'missing'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex space-x-1">
            <button
              onClick={onDownload}
              className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
              title={`Download ${video.filename}`}
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onShare}
              className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show error if AWS S3 video failed to load
  if (hasError) {
    return (
      <div className="relative group">
        <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              AWS S3 video failed to load
            </p>
            <p className="text-xs text-gray-500 mt-1">{video.filename}</p>
            <p className="text-xs text-blue-500 mt-2 break-all">
              {awsS3Url}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex space-x-1">
            <button
              onClick={onDownload}
              className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
              title={`Download ${video.filename}`}
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onShare}
              className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group">
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Loading from AWS S3...
            </p>
            <p className="text-xs text-gray-500 mt-1 break-all max-w-xs">
              {awsS3Url}
            </p>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        controls
        className="w-full rounded-lg shadow-md hover:shadow-lg transition-shadow"
        poster="/video-placeholder.jpg"
        onError={handleVideoError}
        onLoadedData={handleVideoLoad}
        onCanPlay={handleCanPlay}
        onLoadStart={() => {
          console.log(`🎬 AWS S3 video loading started: ${video.filename}`);
          setIsLoading(true);
        }}
        preload="metadata"
        playsInline
        muted={false}
        crossOrigin="anonymous"
      >
        <source src={awsS3Url} type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Action buttons */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex space-x-1">
          <button
            onClick={onDownload}
            className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
            title={`Download ${video.filename}`}
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onShare}
            className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video metadata */}
      <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
          {video.width && video.height
            ? `${video.width}×${video.height}`
            : "Unknown size"}
          {video.fileSize &&
            ` • ${Math.round((video.fileSize / 1024 / 1024) * 100) / 100}MB`}
          <div className="text-green-400">📡 AWS S3</div>
        </div>
      </div>
    </div>
  );
};

export default function ImageToVideoPage() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();

  // Refs for managing browser interactions
  const progressUpdateRef = useRef<((progress: any) => void) | null>(null);
  const notificationRef = useRef<Notification | null>(null);

  // Storage keys for persistence
  const STORAGE_KEYS = {
    currentJob: 'image-to-video-current-job',
    isGenerating: 'image-to-video-is-generating',
    progressData: 'image-to-video-progress-data',
    jobHistory: 'image-to-video-job-history',
  };

  const [params, setParams] = useState<GenerationParams>({
    prompt: "",
    negativePrompt:
      "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走",
    width: 480,
    height: 720,
    length: 65,
    batchSize: 1,
    steps: 4,
    cfg: 1,
    samplerName: "euler",
    scheduler: "simple",
    seed: null,
    uploadedImage: null,
  });

  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [jobHistory, setJobHistory] = useState<GenerationJob[]>([]);

  // Real-time progress tracking for video generation
  const [progressData, setProgressData] = useState<{
    progress: number;
    stage: string;
    message: string;
    elapsedTime?: number;
    estimatedTimeRemaining?: number;
  }>({
    progress: 0,
    stage: "",
    message: "",
    elapsedTime: 0,
    estimatedTimeRemaining: 0,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<
    string | null
  >(null);

  // Folder selection states
  const [targetFolder, setTargetFolder] = useState<string>("");
  const [availableFolders, setAvailableFolders] = useState<Array<{
    slug: string;
    name: string;
    prefix: string;
    permission: string;
    isShared: boolean;
  }>>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);

  // Video-specific states
  const [jobVideos, setJobVideos] = useState<Record<string, DatabaseVideo[]>>(
    {}
  );
  const [videoStats, setVideoStats] = useState<any>(null);

  const selectedFolder = useMemo(
    () => availableFolders.find((folder) => folder.slug === targetFolder),
    [availableFolders, targetFolder]
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Helper function to determine if a failed job was actually cancelled
  const isJobCancelled = (job: GenerationJob) => {
    return job.status === 'failed' && job.error === 'Job canceled by user';
  };

  // Helper function to clear persistent state
  const clearPersistentState = () => {
    if (typeof window !== 'undefined') {
      Object.values(STORAGE_KEYS).forEach(key => {
        if (key !== STORAGE_KEYS.jobHistory) { // Preserve job history
          localStorage.removeItem(key);
        }
      });
    }
    // Also clear global progress
    clearGlobalProgress();
  };

  // Cancel generation function
  const cancelGeneration = async () => {
    if (!apiClient || !currentJob?.id) {
      alert("No active generation to cancel");
      return;
    }

    // Confirm cancellation
    const confirmed = confirm(
      "Are you sure you want to cancel this generation? This action cannot be undone."
    );
    
    if (!confirmed) {
      return;
    }

    try {
      console.log("🛑 Canceling generation:", currentJob.id);

      // Show immediate feedback
      setProgressData(prev => ({
        ...prev,
        stage: "canceling",
        message: "🛑 Canceling generation...",
      }));

      // Update global progress
      updateGlobalProgress({
        isGenerating: true,
        progress: progressData.progress,
        stage: "canceling",
        message: "🛑 Canceling generation...",
        generationType: 'image-to-video',
        jobId: currentJob.id,
        elapsedTime: progressData.elapsedTime,
        estimatedTimeRemaining: 0,
      });

      const response = await apiClient.post(`/api/jobs/${currentJob.id}/cancel`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Cancel failed:", response.status, errorText);
        throw new Error(`Cancel failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log("✅ Cancel result:", result);

      // Update job status
      const canceledJob = {
        ...currentJob,
        status: 'failed' as const,
        error: 'Job canceled by user',
      };

      setCurrentJob(canceledJob);
      setJobHistory(prev => 
        prev.map(job => 
          job?.id === currentJob.id ? canceledJob : job
        ).filter(Boolean).slice(0, 5)
      );

      // Stop generation state
      setIsGenerating(false);
      
      // Clear persistent state
      clearPersistentState();

      // Update progress to show cancellation
      setProgressData({
        progress: 0,
        stage: "canceled",
        message: "🛑 Generation canceled by user",
        elapsedTime: progressData.elapsedTime,
        estimatedTimeRemaining: 0,
      });

      // Clear global progress after a short delay
      setTimeout(() => {
        clearGlobalProgress();
      }, 2000);

      alert("✅ Generation canceled successfully");

    } catch (error) {
      console.error("❌ Error canceling generation:", error);
      
      // Reset progress on error
      setProgressData(prev => ({
        ...prev,
        stage: prev.stage === "canceling" ? "processing" : prev.stage,
        message: prev.stage === "canceling" ? "Processing..." : prev.message,
      }));

      alert(
        "❌ Failed to cancel generation: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  // Initialize and fetch data
  useEffect(() => {
    if (!Array.isArray(jobHistory)) {
      setJobHistory([]);
    }
    fetchVideoStats();
  }, []);

  // Load folders for selection
  useEffect(() => {
    const loadFolders = async () => {
      if (!apiClient || !user) {
        console.log("⏳ Waiting for apiClient and user to load folders");
        return;
      }

      try {
        setIsLoadingFolders(true);
        console.log("📁 Loading custom folders for image-to-video...");

        const response = await apiClient.get("/api/s3/folders/list-custom");

        if (!response.ok) {
          throw new Error(`Failed to load folders: ${response.status}`);
        }

        const data = await response.json();
        console.log("📊 Folders loaded:", data);

        if (data.success && Array.isArray(data.folders)) {
          // Filter to only EDIT permission folders and extract slug, name, prefix, permission
          const foldersWithSlugs = data.folders
            .filter((folder: any) => {
              // Only show folders with EDIT permission (or no permission field for owned folders)
              return !folder.permission || folder.permission === 'EDIT';
            })
            .map((folder: any) => {
              if (typeof folder === 'string') {
                // Legacy: if it's just a string, use it as both slug and name
                return { 
                  slug: folder, 
                  name: folder,
                  prefix: `outputs/${user.id}/${folder}`,
                  permission: 'EDIT',
                  isShared: false
                };
              }
              // Extract slug from prefix: outputs/userId/folder-slug/ -> folder-slug
              const slug = folder.prefix?.split('/').filter(Boolean)[2] || folder.name;
              const isShared = folder.permission === 'EDIT' && folder.ownerId !== user.id;
              return {
                slug: slug,
                name: folder.name,
                prefix: folder.prefix.replace(/\/$/, ''), // Remove trailing slash
                permission: folder.permission || 'EDIT',
                isShared
              };
            });
          setAvailableFolders(foldersWithSlugs);
          console.log("✅ Folders set with slugs:", foldersWithSlugs);
        } else {
          console.error("⚠️ Invalid folders response:", data);
          setAvailableFolders([]);
        }
      } catch (error) {
        console.error("❌ Error loading folders:", error);
        setAvailableFolders([]);
      } finally {
        setIsLoadingFolders(false);
      }
    };

    loadFolders();
  }, [apiClient, user]);

  // Progress tracking with browser integration
  useEffect(() => {
    if (typeof window !== 'undefined' && apiClient) {
      try {
        const savedCurrentJob = localStorage.getItem(STORAGE_KEYS.currentJob);
        const savedIsGenerating = localStorage.getItem(STORAGE_KEYS.isGenerating);
        const savedProgressData = localStorage.getItem(STORAGE_KEYS.progressData);
        const savedJobHistory = localStorage.getItem(STORAGE_KEYS.jobHistory);

        // Load job history first
        if (savedJobHistory) {
          try {
            const history = JSON.parse(savedJobHistory);
            if (Array.isArray(history)) {
              setJobHistory(history.slice(0, 5)); // Limit to 5 jobs
            }
          } catch (error) {
            console.error('Error parsing job history:', error);
          }
        }

        if (savedIsGenerating === 'true' && savedCurrentJob) {
          const job = JSON.parse(savedCurrentJob);
          const progressData = savedProgressData ? JSON.parse(savedProgressData) : {};
          
          // Only restore if job is still pending or processing
          if (job.status === 'pending' || job.status === 'processing') {
            setIsGenerating(true);
            setCurrentJob(job);
            
            // Resume progress tracking
            updateGlobalProgress({
              isGenerating: true,
              progress: progressData.progress || 50,
              stage: progressData.stage || 'Reconnecting to video generation...',
              message: progressData.message || 'Restoring your video generation session',
              generationType: 'image-to-video',
              jobId: job.id,
              elapsedTime: progressData.elapsedTime,
              estimatedTimeRemaining: progressData.estimatedTimeRemaining
            });

            // Resume polling
            pollJobStatus(job.id);
          } else {
            // Clean up completed/failed jobs
            Object.values(STORAGE_KEYS).forEach(key => {
              if (key !== STORAGE_KEYS.jobHistory) { // Preserve job history
                localStorage.removeItem(key);
              }
            });
          }
        }
      } catch (error) {
        console.error('Error restoring image-to-video state:', error);
        Object.values(STORAGE_KEYS).forEach(key => {
          if (key !== STORAGE_KEYS.jobHistory) { // Preserve job history
            localStorage.removeItem(key);
          }
        });
      }
    }
  }, [apiClient, updateGlobalProgress]);

  // Save current job to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (currentJob) {
        localStorage.setItem(STORAGE_KEYS.currentJob, JSON.stringify(currentJob));
      } else {
        localStorage.removeItem(STORAGE_KEYS.currentJob);
      }
    }
  }, [currentJob]);

  // Save generating state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.isGenerating, isGenerating.toString());
    }
  }, [isGenerating]);

  // Save job history to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && jobHistory.length > 0) {
      const validHistory = jobHistory.filter(job => job && job.id);
      if (validHistory.length > 0) {
        localStorage.setItem(STORAGE_KEYS.jobHistory, JSON.stringify(validHistory.slice(0, 5)));
      }
    }
  }, [jobHistory]);

  // Browser tab title and favicon updates
  useEffect(() => {
    const updateBrowserState = () => {
      if (isGenerating && currentJob) {
        // Update page title
        document.title = `🎬 Generating Video... - TastyCreative AI`;
        
        // Update favicon to indicate activity
        let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.rel = 'icon';
          document.head.appendChild(favicon);
        }
        favicon.href = '/favicon-generating.ico';
      } else {
        // Reset to normal state
        document.title = 'TastyCreative AI - Image to Video';
        const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (favicon) {
          favicon.href = '/favicon.ico';
        }
      }
    };

    updateBrowserState();
    
    // Cleanup on unmount
    return () => {
      if (!isGenerating) {
        document.title = 'TastyCreative AI - Image to Video';
        const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (favicon) {
          favicon.href = '/favicon.ico';
        }
      }
    };
  }, [isGenerating, currentJob]);

  // Notification management
  useEffect(() => {
    const manageNotifications = async () => {
      if (isGenerating && currentJob) {
        // Request notification permission if needed
        if ('Notification' in window && Notification.permission === 'default') {
          await Notification.requestPermission();
        }
      } else if (!isGenerating && currentJob && currentJob.status === 'completed' && !isJobCancelled(currentJob)) {
        // Show completion notification only for successfully completed jobs, not cancelled ones
        if ('Notification' in window && Notification.permission === 'granted') {
          // Close any existing notification
          if (notificationRef.current) {
            notificationRef.current.close();
          }
          
          // Show completion notification
          notificationRef.current = new Notification('🎬 Video Generation Complete!', {
            body: 'Your video is ready to view and download.',
            icon: '/favicon.ico',
            tag: 'video-generation-complete'
          });
          
          // Auto-close after 5 seconds
          setTimeout(() => {
            if (notificationRef.current) {
              notificationRef.current.close();
              notificationRef.current = null;
            }
          }, 5000);
        }
      }
    };

    manageNotifications();
    
    // Cleanup notifications on unmount
    return () => {
      if (notificationRef.current) {
        notificationRef.current.close();
        notificationRef.current = null;
      }
    };
  }, [isGenerating, currentJob]);

  // Clear global progress when component unmounts or generation ends
  useEffect(() => {
    return () => {
      if (!isGenerating) {
        clearGlobalProgress();
      }
    };
  }, [isGenerating, clearGlobalProgress]);

  // Auto-fetch videos when current job completes
  useEffect(() => {
    if (currentJob?.status === "completed" && currentJob?.id) {
      const hasVideos =
        jobVideos[currentJob.id] && jobVideos[currentJob.id].length > 0;
      const hasResultUrls =
        currentJob.resultUrls && currentJob.resultUrls.length > 0;

      // If job is completed but we don't have videos yet, try to fetch them
      if (!hasVideos && !hasResultUrls) {
        console.log(
          "🔄 Job completed but no videos found, attempting to fetch..."
        );
        setTimeout(() => {
          fetchJobVideos(currentJob.id);
        }, 2000); // Wait 2 seconds to allow webhook processing
      }
    }
  }, [currentJob?.status, currentJob?.id]);

  // Fetch video statistics
  const fetchVideoStats = async () => {
    if (!apiClient) return;

    try {
      const response = await apiClient.get("/api/videos?stats=true");

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVideoStats(data.stats);
          console.log("📊 Video stats:", data.stats);
        }
      }
    } catch (error) {
      console.error("Error fetching video stats:", error);
    }
  };

  // Fetch videos for a completed job
  const fetchJobVideos = async (jobId: string): Promise<boolean> => {
    if (!apiClient) return false;

    setIsLoadingVideos(true);
    try {
      console.log("🎬 Fetching database videos for job:", jobId);

      const response = await apiClient.get(`/api/jobs/${jobId}/videos`);
      console.log("📡 Video fetch response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Failed to fetch job videos:",
          response.status,
          errorText
        );
        return false;
      }

      const data = await response.json();
      console.log("📊 Job videos data:", data);

      if (data.success && data.videos && Array.isArray(data.videos)) {
        console.log(`✅ Found ${data.videos.length} videos for job ${jobId}`);
        setJobVideos((prev) => ({
          ...prev,
          [jobId]: data.videos,
        }));

        // Also update the current job with result URLs if needed
        if (data.videos.length > 0) {
          setCurrentJob((prev) =>
            prev?.id === jobId
              ? {
                  ...prev,
                  resultUrls: data.videos
                    .map((v: DatabaseVideo) => v.dataUrl || v.url)
                    .filter(Boolean),
                }
              : prev
          );

          // Update job history as well
          setJobHistory((prev) =>
            prev.map((job) =>
              job?.id === jobId
                ? {
                    ...job,
                    resultUrls: data.videos
                      .map((v: DatabaseVideo) => v.dataUrl || v.url)
                      .filter(Boolean),
                  }
                : job
            ).slice(0, 5)
          );
        }

        console.log(
          "✅ Updated job videos state for job:",
          jobId,
          "Videos count:",
          data.videos.length
        );
        return data.videos.length > 0;
      } else {
        console.warn("⚠️ Invalid response format:", data);
        return false;
      }
    } catch (error) {
      console.error("💥 Error fetching job videos:", error);
      return false;
    } finally {
      setIsLoadingVideos(false);
    }
  };

  // Handle image upload
  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !apiClient) return;

    setIsUploading(true);

    try {
      console.log("=== UPLOADING IMAGE FOR I2V ===");
      console.log("File:", file.name, file.size, file.type);

      const formData = new FormData();
      formData.append("image", file);

      const response = await apiClient.postFormData(
        "/api/upload/image",
        formData
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upload failed:", response.status, errorText);
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      console.log("Upload result:", result);

      if (result.success && result.filename) {
        setParams((prev) => ({
          ...prev,
          uploadedImage: result.filename,
        }));

        // Store base64 data for serverless API
        if (result.base64) {
          console.log("📦 Storing base64 data for image-to-video generation");
          // We'll pass this base64 data to the API
          (window as any).imageToVideoBase64Data = result.base64;
        }

        // Create preview URL
        const previewUrl = URL.createObjectURL(file);
        setUploadedImagePreview(previewUrl);

        console.log("✅ Image uploaded successfully:", result.filename);
      } else {
        throw new Error("Upload succeeded but no filename returned");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert(
        "Failed to upload image: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Remove uploaded image
  const removeUploadedImage = () => {
    setParams((prev) => ({
      ...prev,
      uploadedImage: null,
    }));
    setUploadedImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Generate random seed
  const generateRandomSeed = () => {
    const seed = Math.floor(Math.random() * 1000000000);
    setParams((prev) => ({ ...prev, seed }));
  };

  // Handle aspect ratio change
  const handleAspectRatioChange = (width: number, height: number) => {
    setParams((prev) => ({ ...prev, width, height }));
  };

  // Create workflow JSON based on the provided ComfyUI workflow with fixed values
  const createWorkflowJson = (params: GenerationParams, targetFolder?: string) => {
    const seed = params.seed || Math.floor(Math.random() * 1000000000);
    
    // Find the folder object to check if it's a shared folder
    const folderObj = availableFolders.find(f => f.slug === targetFolder);
    const isSharedFolder = folderObj?.isShared || false;
    
    // Use full prefix for shared folders, otherwise build normal path
    let filenamePrefix: string;
    if (isSharedFolder && folderObj?.prefix) {
      filenamePrefix = `${folderObj.prefix}/ImageToVideo`;
    } else if (targetFolder) {
      filenamePrefix = `${targetFolder}/ImageToVideo`;
    } else {
      filenamePrefix = "video/ComfyUI/wan2.2";
    }

    const workflow: any = {
      "6": {
        inputs: {
          text: params.prompt,
          clip: ["38", 0], // Direct connection to CLIPLoader
        },
        class_type: "CLIPTextEncode",
      },
      "7": {
        inputs: {
          text: params.negativePrompt,
          clip: ["38", 0], // Direct connection to CLIPLoader
        },
        class_type: "CLIPTextEncode",
      },
      "37": {
        inputs: {
          unet_name: "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
          weight_dtype: "default",
        },
        class_type: "UNETLoader",
      },
      "38": {
        inputs: {
          clip_name: "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
          type: "wan",
          device: "default",
        },
        class_type: "CLIPLoader",
      },
      "39": {
        inputs: {
          vae_name: "wan_2.1_vae.safetensors",
        },
        class_type: "VAELoader",
      },
      "48": {
        inputs: {
          model: ["89", 0], // Connected to LoRA high noise model
          shift: 8,
        },
        class_type: "ModelSamplingSD3",
      },
      "56": {
        inputs: {
          image: params.uploadedImage || "",
          upload: "image",
        },
        class_type: "LoadImage",
      },
      "65": {
        inputs: {
          image: ["56", 0],
          width: params.width,
          height: params.height,
          upscale_method: "nearest-exact",
          crop: "center",
        },
        class_type: "ImageScale",
      },
      "81": {
        inputs: {
          unet_name: "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
          weight_dtype: "default",
        },
        class_type: "UNETLoader",
      },
      "89": {
        inputs: {
          model: ["37", 0],
          lora_name:
            "lightx2v_14B_T2V_cfg_step_distill_lora_adaptive_rank_quantile_0.15_bf16.safetensors",
          strength_model: 2.5,
        },
        class_type: "LoraLoaderModelOnly",
      },
      "90": {
        inputs: {
          model: ["81", 0],
          lora_name:
            "Wan21_T2V_14B_lightx2v_cfg_step_distill_lora_rank32.safetensors",
          strength_model: 1.5,
        },
        class_type: "LoraLoaderModelOnly",
      },
      "91": {
        inputs: {
          noise_seed: seed,
          steps: params.steps,
          cfg: params.cfg,
          sampler_name: params.samplerName,
          scheduler: params.scheduler,
          denoise: 1,
          model: ["94", 0],
          positive: ["93", 0],
          negative: ["93", 1],
          latent_image: ["92", 0],
          add_noise: "disable",
          start_at_step: 2,
          end_at_step: 10000,
          return_with_leftover_noise: "disable",
        },
        class_type: "KSamplerAdvanced",
      },
      "92": {
        inputs: {
          noise_seed: seed,
          steps: params.steps,
          cfg: params.cfg,
          sampler_name: params.samplerName,
          scheduler: params.scheduler,
          denoise: 1,
          model: ["48", 0],
          positive: ["93", 0],
          negative: ["93", 1],
          latent_image: ["93", 2],
          add_noise: "enable",
          start_at_step: 0,
          end_at_step: 2,
          return_with_leftover_noise: "enable",
        },
        class_type: "KSamplerAdvanced",
      },
      "93": {
        inputs: {
          positive: ["6", 0],
          negative: ["7", 0],
          vae: ["39", 0], // Direct connection to VAELoader
          start_image: ["65", 0], // Direct connection to ImageResize
          width: params.width,
          height: params.height,
          length: params.length,
          batch_size: params.batchSize,
        },
        class_type: "WanImageToVideo",
      },
      "94": {
        inputs: {
          model: ["90", 0], // Connected to LoRA low noise model
          shift: 8,
        },
        class_type: "ModelSamplingSD3",
      },
      "8": {
        inputs: {
          samples: ["91", 0],
          vae: ["39", 0], // Direct connection to VAELoader
        },
        class_type: "VAEDecode",
      },
      "57": {
        inputs: {
          images: ["8", 0],
          fps: 16,
        },
        class_type: "CreateVideo",
      },
      "131": {
        inputs: {
          video: ["57", 0],
          filename_prefix: filenamePrefix,
          format: "auto",
          codec: "auto",
        },
        class_type: "SaveVideo",
      },
    };

    return workflow;
  };

  // Handle generation
  const handleGenerate = async () => {
    if (!apiClient) {
      alert("API client not ready. Please try again.");
      return;
    }

    if (!params.prompt.trim()) {
      alert("Please enter a prompt");
      return;
    }

    if (!params.uploadedImage) {
      alert("Please upload an image first");
      return;
    }

    if (!targetFolder) {
      alert("Please select a folder to save your video");
      return;
    }

    setIsGenerating(true);
    setCurrentJob(null);

    // Initialize progress tracking for video generation
    setProgressData({
      progress: 0,
      stage: "starting",
      message: "🚀 Initializing image-to-video generation...",
      elapsedTime: 0,
      estimatedTimeRemaining: 600, // 10 minutes initial estimate for video
    });

    try {
      console.log("=== STARTING I2V SERVERLESS GENERATION ===");
      console.log("Generation params:", params);

      const workflow = createWorkflowJson(params, targetFolder);
      console.log("Created I2V workflow for serverless submission");

      // Get base64 data from stored window object
      const imageBase64Data = (window as any).imageToVideoBase64Data;
      console.log(
        "📦 Using base64 data for image-to-video:",
        !!imageBase64Data
      );

      if (!imageBase64Data) {
        console.error("❌ No base64 image data found! User needs to re-upload the image.");
        alert("Please re-upload your image. The image data was not found.");
        setIsGenerating(false);
        return;
      }

      console.log("📦 Base64 data length:", imageBase64Data.length);
      console.log("📦 Base64 data preview:", imageBase64Data.substring(0, 50) + "...");

      // Use the serverless RunPod endpoint
      const response = await apiClient.post(
        "/api/generate/image-to-video-runpod",
        {
          workflow,
          params,
          user_id: user?.id, // Include user_id for proper S3 folder organization
          imageData: imageBase64Data, // Include base64 image data
        }
      );

      console.log(
        "I2V Serverless Generation API response status:",
        response.status
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "I2V Serverless Generation failed:",
          response.status,
          errorText
        );
        throw new Error(`Generation failed: ${response.status} - ${errorText}`);
      }

      const { jobId, runpodJobId } = await response.json();
      console.log("Received I2V job ID:", jobId);
      console.log("Received RunPod job ID:", runpodJobId);

      if (!jobId) {
        throw new Error("No job ID received from server");
      }

      const newJob: GenerationJob = {
        id: jobId,
        status: "pending",
        createdAt: new Date(),
        progress: 0,
      };

      setCurrentJob(newJob);
      setJobHistory((prev) => [newJob, ...prev.filter(Boolean)].slice(0, 5));

      // Start polling for job status (serverless jobs are handled via webhooks, but we still poll for updates)
      pollJobStatus(jobId);
    } catch (error) {
      console.error("I2V Serverless Generation error:", error);
      setIsGenerating(false);
      alert(error instanceof Error ? error.message : "Generation failed");
    }
  };

  // Poll job status (adapted for serverless - primarily webhook-driven updates)
  const pollJobStatus = async (jobId: string) => {
    if (!apiClient) {
      console.error("API client not ready for polling");
      return;
    }

    console.log("=== STARTING I2V SERVERLESS JOB POLLING ===");
    console.log("Polling I2V serverless job ID:", jobId);

    const maxAttempts = 600; // 20 minutes for serverless video generation (webhooks handle most updates)
    let attempts = 0;

    const poll = async () => {
      if (!apiClient) return;

      try {
        attempts++;
        console.log(
          `Polling attempt ${attempts}/${maxAttempts} for I2V serverless job ${jobId}`
        );

        const response = await apiClient.get(`/api/jobs/${jobId}`);
        console.log("I2V Serverless Job status response:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "I2V Serverless Job status error:",
            response.status,
            errorText
          );

          if (response.status === 404) {
            console.log("I2V Serverless Job not found - likely completed and cleaned up");
            
            // If we've been polling for a while and job is not found,
            // it probably completed and was cleaned up
            if (attempts > 5) {
              console.log("Job not found after multiple attempts - assuming completed and cleaned up");
              setIsGenerating(false);
              
              // Clear localStorage and stop polling
              setTimeout(() => {
                if (typeof window !== 'undefined') {
                  Object.values(STORAGE_KEYS).forEach(key => {
                    if (key !== STORAGE_KEYS.jobHistory) { // Preserve job history
                      localStorage.removeItem(key);
                    }
                  });
                }
                clearGlobalProgress();
              }, 1000);
              
              return; // Stop polling completely
            } else {
              // Early attempts - retry a few times in case of temporary storage lag
              setTimeout(poll, 3000);
              return;
            }
          }

          throw new Error(`Job status check failed: ${response.status}`);
        }

        const job = await response.json();
        console.log("I2V Serverless Job status data:", job);

        if (job.createdAt && typeof job.createdAt === "string") {
          job.createdAt = new Date(job.createdAt);
        }

        // Update progress tracking state
        if (job.status === "processing") {
          const progressUpdate = {
            progress: job.progress || 0,
            stage: job.stage || "",
            message: job.message || "Processing video generation...",
            elapsedTime: job.elapsedTime,
            estimatedTimeRemaining: job.estimatedTimeRemaining,
          };

          setProgressData(progressUpdate);

          // Update global progress and localStorage
          updateGlobalProgress({
            isGenerating: true,
            progress: progressUpdate.progress,
            stage: progressUpdate.stage,
            message: progressUpdate.message,
            generationType: 'image-to-video',
            jobId: jobId,
            elapsedTime: progressUpdate.elapsedTime,
            estimatedTimeRemaining: progressUpdate.estimatedTimeRemaining
          });

          // Save progress to localStorage for cross-tab sync
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.progressData, JSON.stringify(progressUpdate));
          }
        }

        setCurrentJob(job);
        setJobHistory((prev) =>
          prev
            .map((j) => {
              if (j?.id === jobId) {
                return {
                  ...job,
                  createdAt: job.createdAt || j.createdAt,
                };
              }
              return j;
            })
            .filter(Boolean)
            .slice(0, 5)
        );

        if (job.status === "completed") {
          console.log("I2V Serverless Job completed successfully!");
          setIsGenerating(false);

          // Reset progress tracking to show completion
          const completionProgress = {
            progress: 100,
            stage: "completed",
            message: "✅ Video generation completed successfully!",
            elapsedTime: progressData.elapsedTime,
            estimatedTimeRemaining: 0,
          };

          setProgressData(completionProgress);

          // Update global progress with completion
          updateGlobalProgress({
            isGenerating: false,
            progress: 100,
            stage: "completed",
            message: "✅ Video generation completed successfully!",
            generationType: 'image-to-video',
            jobId: jobId,
            elapsedTime: completionProgress.elapsedTime,
            estimatedTimeRemaining: 0
          });

          // Clear localStorage keys after completion
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              Object.values(STORAGE_KEYS).forEach(key => {
                if (key !== STORAGE_KEYS.jobHistory) { // Preserve job history
                  localStorage.removeItem(key);
                }
              });
            }
            clearGlobalProgress();
          }, 5000);

          // Fetch videos for completed job - try multiple times with delays
          console.log("🔄 Attempting to fetch job videos...");
          let fetchSuccess = false;
          let attempts = 0;
          const maxFetchAttempts = 5;

          while (!fetchSuccess && attempts < maxFetchAttempts) {
            attempts++;
            console.log(
              `🔄 Video fetch attempt ${attempts}/${maxFetchAttempts}...`
            );
            fetchSuccess = await fetchJobVideos(jobId);

            if (!fetchSuccess && attempts < maxFetchAttempts) {
              console.log(
                `🔄 Retrying video fetch in ${attempts * 2} seconds...`
              );
              await new Promise((resolve) =>
                setTimeout(resolve, attempts * 2000)
              );
            }
          }

          if (!fetchSuccess) {
            console.warn("⚠️ Failed to fetch videos after multiple attempts");
          }

          return;
        } else if (job.status === "failed") {
          console.log("I2V Serverless Job failed:", job.error);
          setIsGenerating(false);

          // Reset progress tracking to show failure
          const failureProgress = {
            progress: 0,
            stage: "failed",
            message: `❌ Video generation failed: ${
              job.error || "Unknown error"
            }`,
            elapsedTime: progressData.elapsedTime,
            estimatedTimeRemaining: 0,
          };

          setProgressData(failureProgress);

          // Update global progress with failure
          updateGlobalProgress({
            isGenerating: false,
            progress: 0,
            stage: "failed",
            message: `❌ Video generation failed: ${job.error || "Unknown error"}`,
            generationType: 'image-to-video',
            jobId: jobId,
            elapsedTime: failureProgress.elapsedTime,
            estimatedTimeRemaining: 0
          });

          // Clear localStorage keys after failure
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              Object.values(STORAGE_KEYS).forEach(key => {
                if (key !== STORAGE_KEYS.jobHistory) { // Preserve job history
                  localStorage.removeItem(key);
                }
              });
            }
            clearGlobalProgress();
          }, 5000);

          return;
        }

        // For serverless, we rely more on webhooks, so poll less frequently
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000); // Reduced polling for bandwidth optimization
        } else {
          console.warn(
            "I2V Serverless Polling timeout reached - job may still be running"
          );
          setIsGenerating(false);

          // Don't mark as failed, just stop polling - webhooks will update the status
          setProgressData({
            progress: progressData.progress,
            stage: "timeout",
            message:
              "⏱️ Polling timeout reached. Job may still be running via webhooks...",
            elapsedTime: progressData.elapsedTime,
            estimatedTimeRemaining: 0,
          });

          // Keep the job status as-is, don't mark as failed
          console.log(
            "Stopping polling but keeping job status. Webhooks will handle completion."
          );
        }
      } catch (error) {
        console.error("I2V Serverless Polling error:", error);

        // Check if this is a 404 "Job not found" error
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('404')) {
          console.log("Job not found (404) - likely completed and cleaned up");
          
          if (attempts > 5) {
            console.log("Stopping polling - job probably completed and was cleaned up");
            setIsGenerating(false);
            
            // Clear localStorage and stop polling
            setTimeout(() => {
              if (typeof window !== 'undefined') {
                Object.values(STORAGE_KEYS).forEach(key => {
                  if (key !== STORAGE_KEYS.jobHistory) { // Preserve job history
                    localStorage.removeItem(key);
                  }
                });
              }
              clearGlobalProgress();
            }, 1000);
            
            return; // Stop polling completely
          }
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 2000); // Slower retry on errors
        } else {
          console.warn("I2V Serverless Polling timeout reached after errors");
          setIsGenerating(false);

          // Don't mark as failed due to polling timeout
          setProgressData({
            progress: progressData.progress,
            stage: "timeout",
            message:
              "⏱️ Polling timeout reached. Job may still be running via webhooks...",
            elapsedTime: progressData.elapsedTime,
            estimatedTimeRemaining: 0,
          });
        }
      }
    };

    setTimeout(poll, 3000); // Start polling after 3 seconds
  };

  // Download video
  // Download video using ONLY AWS S3 URLs
  const downloadVideo = async (video: DatabaseVideo) => {
    try {
      console.log("📥 Downloading video:", video.filename);

      // Get AWS S3 URL
      let awsS3Url: string | null = null;
      
      if (video.awsS3Url) {
        awsS3Url = video.awsS3Url;
        console.log("📥 Using direct AWS S3 URL:", awsS3Url);
      } else if (video.awsS3Key) {
        awsS3Url = `https://tastycreative.s3.amazonaws.com/${video.awsS3Key}`;
        console.log("📥 Generated AWS S3 URL:", awsS3Url);
      } else {
        console.error("❌ No AWS S3 URL available for download");
        alert("❌ This video is not available for download (no AWS S3 URL)");
        return;
      }

      // Try to download from AWS S3
      try {
        const response = await fetch(awsS3Url);
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);

          const link = document.createElement("a");
          link.href = url;
          link.download = video.filename;
          link.click();

          URL.revokeObjectURL(url);
          console.log("✅ AWS S3 video downloaded successfully");
          return;
        } else {
          throw new Error(`AWS S3 download failed: ${response.status}`);
        }
      } catch (fetchError) {
        console.warn("⚠️ AWS S3 fetch failed, trying direct link:", fetchError);
        
        // Try direct link download as last resort for AWS S3
        const link = document.createElement("a");
        link.href = awsS3Url;
        link.download = video.filename;
        link.click();
        console.log("✅ AWS S3 direct link download attempted");
      }
    } catch (error) {
      console.error("❌ AWS S3 download error:", error);
      alert(
        "Failed to download video from AWS S3: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  // Share video using ONLY AWS S3 URLs
  const shareVideo = (video: DatabaseVideo) => {
    // Get AWS S3 URL
    let awsS3Url: string | null = null;
    
    if (video.awsS3Url) {
      awsS3Url = video.awsS3Url;
      console.log("📤 Sharing direct AWS S3 URL:", awsS3Url);
    } else if (video.awsS3Key) {
      awsS3Url = `https://tastycreative.s3.amazonaws.com/${video.awsS3Key}`;
      console.log("📤 Sharing generated AWS S3 URL:", awsS3Url);
    } else {
      console.error("❌ No AWS S3 URL available for sharing");
      alert("❌ This video cannot be shared (no AWS S3 URL)");
      return;
    }

    navigator.clipboard.writeText(awsS3Url);
    alert("✅ AWS S3 video URL copied to clipboard!");
  };

  // Show loading state while API client initializes
  if (!apiClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-950 dark:via-purple-950/30 dark:to-blue-950/30 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 flex items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600 dark:text-purple-400" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Initializing Image to Video Studio...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-950 dark:via-purple-950/30 dark:to-blue-950/30 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-2xl shadow-lg animate-pulse">
              <Video className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 dark:from-purple-400 dark:via-pink-400 dark:to-blue-400 bg-clip-text text-transparent">
              Image to Video Studio
            </h1>
            <span className="text-sm font-semibold px-3 py-1 rounded-full bg-green-500/20 text-green-700 dark:text-green-300 border border-green-300/40 dark:border-green-500/40 backdrop-blur-sm">Serverless</span>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Animate any still image with cinematic motion powered by WAN 2.2 on RunPod serverless infrastructure.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-gray-600 dark:text-gray-300">
            <div className="px-3 py-1 rounded-full bg-white/70 dark:bg-gray-900/40 border border-white/60 dark:border-gray-700/60 shadow-sm">
              <span className="font-semibold text-purple-600 dark:text-purple-300">WAN 2.2</span> Motion Engine
            </div>
            <div className="px-3 py-1 rounded-full bg-white/70 dark:bg-gray-900/40 border border-white/60 dark:border-gray-700/60 shadow-sm">
              HD Output • Smooth Animation
            </div>
            <div className="px-3 py-1 rounded-full bg-white/70 dark:bg-gray-900/40 border border-white/60 dark:border-gray-700/60 shadow-sm">
              S3 Library Integration
            </div>
          </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Folder Selection */}
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-xl shadow-lg">
                  <Folder className="w-5 h-5 text-white" />
                </div>
                <label className="text-lg font-bold text-gray-900 dark:text-white">
                  Save to Folder
                </label>
              </div>

              <div className="relative">
                <select
                  value={targetFolder}
                  onChange={(e) => setTargetFolder(e.target.value)}
                  disabled={isLoadingFolders || isGenerating}
                  className="w-full px-4 py-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select a folder...</option>
                  {availableFolders.map((folder) => (
                    <option key={folder.slug} value={folder.slug}>
                      {folder.isShared ? '🔓 ' : '📁 '}{folder.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>

              {isLoadingFolders && (
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading folders...</span>
                </div>
              )}

              {targetFolder && selectedFolder && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-200 dark:border-purple-700 text-xs text-purple-700 dark:text-purple-300">
                  <span>{selectedFolder.isShared ? '🔓' : '📁'}</span>
                  <span>
                    Saving to {selectedFolder.isShared
                      ? `${selectedFolder.prefix}/`
                      : `outputs/${user?.id}/${targetFolder}/`}
                  </span>
                  <span className="font-semibold">({selectedFolder.name})</span>
                </div>
              )}
              {targetFolder && !selectedFolder && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Saving to {`outputs/${user?.id}/${targetFolder}/`}
                </p>
              )}
            </div>
          </div>

          {/* Enhanced Image Upload */}
          <div className="group bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl hover:border-purple-400 dark:hover:border-purple-500 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
                  <ImageIcon className="w-6 h-6 text-white" />
                </div>
                <span>Source Image</span>
                <div className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                  Required
                </div>
              </h3>
            </div>

            {!uploadedImagePreview ? (
              <div
                className="relative border-2 border-dashed border-purple-300 dark:border-purple-600 rounded-2xl p-12 text-center cursor-pointer hover:border-purple-400 dark:hover:border-purple-500 transition-all duration-300 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 group-hover:scale-105"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-100/50 to-pink-100/50 dark:from-purple-800/20 dark:to-pink-800/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>

                {isUploading ? (
                  <div className="relative flex flex-col items-center space-y-4">
                    <div className="relative">
                      <Loader2 className="w-16 h-16 animate-spin text-purple-500" />
                      <div className="absolute inset-0 w-16 h-16 border-4 border-purple-200 dark:border-purple-700 rounded-full animate-ping"></div>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-purple-700 dark:text-purple-300 mb-1">
                        Uploading Your Image
                      </p>
                      <p className="text-sm text-purple-600 dark:text-purple-400">
                        Preparing for video transformation...
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative flex flex-col items-center space-y-4">
                    <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                      <Upload className="w-10 h-10 text-white" />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        Upload Your Image
                      </p>
                      <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-3">
                        Choose the image you want to bring to life with AI
                        motion
                      </p>
                      <div className="flex items-center justify-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg px-3 py-1">
                          PNG, JPG, WebP
                        </div>
                        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg px-3 py-1">
                          Max 10MB
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative group">
                <div className="relative overflow-hidden rounded-2xl shadow-lg">
                  <img
                    src={uploadedImagePreview}
                    alt="Uploaded image"
                    className="w-full max-h-80 object-contain bg-gray-50 dark:bg-gray-900 transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="absolute bottom-4 left-4 right-4 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-lg font-semibold mb-1">
                      Ready for Animation
                    </p>
                    <p className="text-sm opacity-90">
                      This image will be transformed into a video
                    </p>
                  </div>
                </div>
                <button
                  onClick={removeUploadedImage}
                  className="absolute top-3 right-3 p-2 bg-red-500/90 backdrop-blur-sm text-white rounded-xl hover:bg-red-600 transition-all duration-200 shadow-lg hover:scale-110"
                  title="Remove image"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">
                      Image uploaded: {params.uploadedImage}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={isUploading}
            />
          </div>

          {/* Enhanced Prompt Input */}
          <div className="group bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-300">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <label className="text-xl font-bold text-gray-900 dark:text-white flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl">
                    <Wand2 className="w-5 h-5 text-white" />
                  </div>
                  <span>Video Motion Prompt</span>
                  <div className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
                    Optional
                  </div>
                </label>
                <button
                  onClick={() => setParams((prev) => ({ ...prev, prompt: "" }))}
                  className="text-sm text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 font-medium transition-colors"
                >
                  Clear
                </button>
              </div>

              <div className="relative">
                <textarea
                  value={params.prompt}
                  onChange={(e) =>
                    setParams((prev) => ({ ...prev, prompt: e.target.value }))
                  }
                  placeholder="Describe the motion and animation you want to see... e.g., 'gentle wind blowing through hair, camera slowly zooming in, soft lighting changes'"
                  className="w-full h-32 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-300 text-sm leading-relaxed"
                  maxLength={500}
                />
                {params.prompt && (
                  <div className="absolute top-3 right-3">
                    <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-lg text-xs font-medium">
                      Ready ✓
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center">
                <div
                  className={`text-sm font-medium transition-colors ${
                    params.prompt.length > 400
                      ? "text-red-500"
                      : params.prompt.length > 250
                      ? "text-yellow-500"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {params.prompt.length}/500 characters
                </div>

                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                    <span className="font-medium">Pro Tip:</span>
                  </div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Leave blank for natural motion
                  </span>
                </div>
              </div>

              {/* Enhanced Negative Prompt */}
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <label className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-white" />
                    </div>
                    <span>Avoid in Video</span>
                    <div className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-xs font-medium">
                      Optional
                    </div>
                  </label>
                </div>

                <div className="relative">
                  <textarea
                    value={params.negativePrompt}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        negativePrompt: e.target.value,
                      }))
                    }
                    placeholder="Describe motions or effects you want to avoid... e.g., 'shaky camera, blurry motion, distorted faces, flickering'"
                    className="w-full h-24 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-4 focus:ring-red-500/20 focus:border-red-500 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-300 text-sm leading-relaxed"
                    maxLength={300}
                  />
                  {params.negativePrompt && (
                    <div className="absolute top-3 right-3">
                      <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-lg text-xs font-medium">
                        Filtering ⚠️
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {params.negativePrompt.length}/300 characters
                </div>
              </div>
            </div>
          </div>

          {/* Video Settings */}
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl shadow-lg">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Video Settings
              </h3>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-3 mb-6">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.name}
                    onClick={() =>
                      handleAspectRatioChange(ratio.width, ratio.height)
                    }
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                      params.width === ratio.width &&
                      params.height === ratio.height
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <div>{ratio.name}</div>
                    <div className="text-xs opacity-75">{ratio.ratio}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Video Length */}
            <div className="space-y-3 mb-6">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Video Length (frames): {params.length}
              </label>
              <input
                type="range"
                min="16"
                max="120"
                value={params.length}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    length: parseInt(e.target.value),
                  }))
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>16 frames (~1s)</span>
                <span>120 frames (~7.5s)</span>
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
            >
              <Sliders className="w-4 h-4" />
              <span>{showAdvanced ? "Hide" : "Show"} Advanced Settings</span>
            </button>

            {/* Advanced Settings */}
            {showAdvanced && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-6">
                {/* Steps */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Steps: {params.steps}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={params.steps}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        steps: parseInt(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>

                {/* CFG */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    CFG Scale: {params.cfg}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={params.cfg}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        cfg: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>

                {/* Sampler */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sampler
                  </label>
                  <select
                    value={params.samplerName}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        samplerName: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {SAMPLERS.map((sampler) => (
                      <option key={sampler} value={sampler}>
                        {sampler}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scheduler */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Scheduler
                  </label>
                  <select
                    value={params.scheduler}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        scheduler: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {SCHEDULERS.map((scheduler) => (
                      <option key={scheduler} value={scheduler}>
                        {scheduler}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Seed */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Seed (Optional)
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={params.seed || ""}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          seed: e.target.value
                            ? parseInt(e.target.value)
                            : null,
                        }))
                      }
                      placeholder="Random"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <button
                      onClick={generateRandomSeed}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={
              isGenerating || !params.prompt.trim() || !params.uploadedImage || !targetFolder
            }
            className="group w-full py-5 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white font-bold text-lg rounded-2xl hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            {isGenerating ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Generating Video...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300" />
                <span>Create Video Magic ✨</span>
              </>
            )}
          </button>

          {/* Helper text */}
          {!targetFolder && !isGenerating && (
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              ⚠️ Please select a folder to save your animated video
            </p>
          )}
        </div>

        {/* Right Panel - Results */}
        <div className="space-y-6">
          {/* Video Statistics */}
          {videoStats && (
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl shadow-lg">
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Your Video Library
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-100 dark:border-purple-800 shadow-sm">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">
                    Total Videos
                  </span>
                  <span className="text-lg font-bold text-purple-600 dark:text-purple-300">
                    {videoStats.totalVideos}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 border border-pink-100 dark:border-pink-800 shadow-sm">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">
                    Total Size
                  </span>
                  <span className="text-lg font-bold text-pink-600 dark:text-pink-300">
                    {Math.round((videoStats.totalSize / 1024 / 1024) * 100) /
                      100}{" "}
                    MB
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Current Generation */}
          {currentJob && (
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-xl shadow-lg">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Current Generation
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  {currentJob.status === "completed" && (
                    <button
                      onClick={() => fetchJobVideos(currentJob.id)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Refresh generated videos"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  {/* Refresh button for timed out jobs */}
                  {progressData.stage === "timeout" && (
                    <button
                      onClick={() => {
                        console.log(
                          "🔄 Manual refresh requested for job:",
                          currentJob.id
                        );
                        // Restart polling for this job
                        pollJobStatus(currentJob.id);
                      }}
                      className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                      title="Check job status again"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Check Status</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Status
                  </span>
                  <div className="flex items-center space-x-2">
                    {(currentJob.status === "pending" ||
                      currentJob.status === "processing") && (
                      <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                    )}
                    {currentJob.status === "completed" && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    {currentJob.status === "failed" && !isJobCancelled(currentJob) && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    {isJobCancelled(currentJob) && (
                      <XCircle className="w-4 h-4 text-orange-500" />
                    )}
                    <span className="text-sm font-medium capitalize">
                      {isJobCancelled(currentJob) ? 'cancelled' : currentJob.status}
                    </span>
                  </div>
                </div>

                {/* Enhanced Progress Display for Video Generation */}
                {(currentJob.status === "processing" ||
                  currentJob.status === "pending" ||
                  progressData.stage === "timeout") && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        {progressData.stage === "timeout" ? (
                          <Clock className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                        )}
                        Video Generation Progress
                      </h4>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {progressData.progress}%
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-purple-100 dark:bg-gray-700/80 rounded-full h-3 mb-3 overflow-hidden">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${
                          progressData.stage === "failed"
                            ? "bg-red-500"
                            : progressData.stage === "completed"
                            ? "bg-green-500"
                            : progressData.stage === "timeout"
                            ? "bg-yellow-500"
                            : "bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500"
                        }`}
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, progressData.progress)
                          )}%`,
                        }}
                      />
                    </div>

                    {/* Progress Message */}
                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                      {progressData.message || "Processing video generation..."}
                    </div>

                    {/* Time Information */}
                    {(progressData.elapsedTime ||
                      progressData.estimatedTimeRemaining) && (
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                        <span>
                          {progressData.elapsedTime
                            ? `Elapsed: ${Math.floor(
                                progressData.elapsedTime
                              )}s`
                            : ""}
                        </span>
                        <span>
                          {progressData.estimatedTimeRemaining
                            ? `Est. remaining: ${Math.floor(
                                progressData.estimatedTimeRemaining
                              )}s`
                            : ""}
                        </span>
                      </div>
                    )}

                    {/* Stage Indicator */}
                    {progressData.stage && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {progressData.stage === "starting" && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                          )}
                          {progressData.stage === "loading_models" && (
                            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                          )}
                          {progressData.stage === "processing_image" && (
                            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                          )}
                          {progressData.stage === "generating_frames" && (
                            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                          )}
                          {progressData.stage === "encoding_video" && (
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                          )}
                          {progressData.stage === "saving" && (
                            <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></div>
                          )}
                          {progressData.stage === "completed" && (
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          )}
                          {progressData.stage === "failed" && (
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          )}
                          {progressData.stage === "timeout" && (
                            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                          )}
                          <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {progressData.stage.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Fallback Legacy Progress (for jobs without enhanced progress) */}
                {currentJob.progress !== undefined &&
                  currentJob.status === "processing" &&
                  !progressData.stage && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Progress
                        </span>
                        <span className="text-sm font-medium">
                          {currentJob.progress}%
                        </span>
                      </div>
                      <div className="w-full bg-purple-100 dark:bg-gray-700/80 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${currentJob.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                {/* Video Display */}
                {((currentJob.resultUrls && currentJob.resultUrls.length > 0) ||
                  (jobVideos[currentJob.id] &&
                    jobVideos[currentJob.id].length > 0)) && (
                  <div className="space-y-3">
                    <h4 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                      <span className="p-1.5 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-lg shadow-md">
                        <Video className="w-4 h-4 text-white" />
                      </span>
                      Generated Videos
                    </h4>

                    <div className="grid grid-cols-1 gap-3">
                      {/* Show database videos if available */}
                      {jobVideos[currentJob.id] &&
                      jobVideos[currentJob.id].length > 0
                        ? // Database videos with dynamic URLs - show all videos, handle errors gracefully
                          jobVideos[currentJob.id].map((dbVideo, index) => (
                            <VideoPlayer
                              key={`db-${dbVideo.id}`}
                              video={dbVideo}
                              onDownload={() => downloadVideo(dbVideo)}
                              onShare={() => shareVideo(dbVideo)}
                            />
                          ))
                        : // Fallback to legacy URLs
                          currentJob.resultUrls &&
                          currentJob.resultUrls.length > 0 &&
                          currentJob.resultUrls.map((url, index) => (
                            <div
                              key={`legacy-${currentJob.id}-${index}`}
                              className="relative group"
                            >
                              <video
                                controls
                                className="w-full rounded-lg shadow-md hover:shadow-lg transition-shadow"
                                poster="/video-placeholder.jpg"
                              >
                                <source src={url} type="video/mp4" />
                                Your browser does not support the video tag.
                              </video>
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() => {
                                      const link = document.createElement("a");
                                      link.href = url;
                                      link.download = `generated-video-${
                                        index + 1
                                      }.mp4`;
                                      link.click();
                                    }}
                                    className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(url);
                                      alert("Video URL copied to clipboard!");
                                    }}
                                    className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                    </div>
                  </div>
                )}

                {/* Loading message for completed jobs without videos */}
                {currentJob.status === "completed" &&
                  (!currentJob.resultUrls ||
                    currentJob.resultUrls.length === 0) &&
                  (!jobVideos[currentJob.id] ||
                    jobVideos[currentJob.id].length === 0) && (
                    <div className="space-y-3">
                      <h4 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                        <span className="p-1.5 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-lg shadow-md">
                          <Video className="w-4 h-4 text-white" />
                        </span>
                        Generated Videos
                      </h4>
                      <div className="text-center py-8">
                        <div className="flex items-center justify-center space-x-2 text-gray-500 dark:text-gray-400 mb-3">
                          {isLoadingVideos ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span className="text-sm">
                                Loading generated videos...
                              </span>
                            </>
                          ) : (
                            <>
                              <Video className="w-4 h-4" />
                              <span className="text-sm">
                                Videos not found - they may still be processing
                              </span>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => fetchJobVideos(currentJob.id)}
                          disabled={isLoadingVideos}
                          className="group inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white rounded-2xl hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden mr-2"
                        >
                          <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                          {isLoadingVideos ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Loading...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4" />
                              <span>Refresh Videos</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            console.log("🔍 Current job:", currentJob);
                            console.log(
                              "🔍 Job videos:",
                              jobVideos[currentJob.id]
                            );
                            console.log("🔍 All job videos:", jobVideos);
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-2xl hover:from-blue-600 hover:to-cyan-600 text-sm font-semibold shadow-md"
                        >
                          <Play className="w-4 h-4" />
                          <span>Debug Info</span>
                        </button>
                      </div>
                    </div>
                  )}

                {currentJob.error && !isJobCancelled(currentJob) && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {currentJob.error}
                    </p>
                  </div>
                )}

                {/* Cancel Button - placed at bottom of current generation */}
                {isGenerating && currentJob && (
                  <button
                    onClick={cancelGeneration}
                    className="group w-full mt-4 py-4 bg-gradient-to-r from-red-500 via-orange-500 to-pink-500 text-white font-semibold rounded-2xl hover:from-red-600 hover:via-orange-600 hover:to-pink-600 transition-all duration-300 shadow-xl hover:shadow-2xl flex items-center justify-center gap-2 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                    <XCircle className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-bold tracking-wide">Cancel Generation</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Generation History */}
          {jobHistory.length > 0 && (
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-xl shadow-lg">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Recent Generations
                </h3>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {jobHistory
                  .filter((job) => job && job.id)
                  .slice(0, 10)
                  .map((job, index) => (
                    <div
                      key={job.id || `job-${index}`}
                      className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-100 dark:border-purple-800 rounded-xl shadow-sm"
                    >
                      <div className="flex items-center space-x-3">
                        {job.status === "completed" && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        {job.status === "failed" && !isJobCancelled(job) && (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        {isJobCancelled(job) && (
                          <XCircle className="w-4 h-4 text-orange-500" />
                        )}
                        {(job.status === "pending" ||
                          job.status === "processing") && (
                          <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatJobTime(job.createdAt)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {isJobCancelled(job) ? 'cancelled' : (job.status || "unknown")}
                          </p>
                        </div>
                      </div>
                      {job.resultUrls && job.resultUrls.length > 0 && (
                        <div className="flex space-x-1">
                          <button
                            onClick={() => fetchJobVideos(job.id)}
                            className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                            title="Refresh videos"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  );
}
