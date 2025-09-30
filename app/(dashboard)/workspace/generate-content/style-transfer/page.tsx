// app/(dashboard)/workspace/generate-content/style-transfer/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import MaskEditor from "@/components/MaskEditor";
import { getOptimizedImageUrl } from "@/lib/awsS3Utils";
import {
  ImageIcon,
  Wand2,
  Settings,
  Download,
  Share2,
  Loader2,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Sliders,
  Copy,
  RefreshCw,
  Upload,
  X,
  Image as ImageIconLucide,
  Palette,
  Layers,
  Monitor,
  Eye,
  Users,
  XCircle,
} from "lucide-react";

// Types
interface StyleTransferParams {
  prompt: string;
  width: number;
  height: number;
  batchSize: number;
  steps: number;
  cfg: number;
  samplerName: string;
  scheduler: string;
  guidance: number;
  loraStrength: number;
  selectedLora: string;
  seed: number | null;
  // Style transfer specific params
  weight: number;
  mode: string;
  downsamplingFactor: number;
  downsamplingFunction: string;
  autocropMargin: number;
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

interface LoRAModel {
  fileName: string;
  displayName: string;
  name: string;
}

interface DatabaseImage {
  id: string;
  filename: string;
  subfolder: string;
  type: string;
  fileSize?: number;
  width?: number;
  height?: number;
  format?: string;
  url?: string | null; // Dynamically constructed URL (network volume or ComfyUI URL)
  dataUrl?: string; // Database-served image URL (fallback)
  s3Key?: string; // S3 key for network volume storage (RunPod - deprecated)
  networkVolumePath?: string; // Path on network volume (RunPod - deprecated)
  awsS3Key?: string; // AWS S3 key for primary storage
  awsS3Url?: string; // AWS S3 public URL for direct access
  createdAt: Date | string;
}

// Constants
const ASPECT_RATIOS = [
  { name: "Portrait", width: 832, height: 1216, ratio: "2:3" },
  { name: "Square", width: 1024, height: 1024, ratio: "1:1" },
  { name: "Landscape", width: 1216, height: 832, ratio: "3:2" },
  { name: "Wide", width: 1344, height: 768, ratio: "16:9" },
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
  "normal",
  "karras",
  "exponential",
  "sgm_uniform",
  "simple",
  "ddim_uniform",
  "beta",
];

const STYLE_MODES = ["center crop (square)", "resize", "crop", "pad"];

const DOWNSAMPLING_FUNCTIONS = ["area", "bicubic", "bilinear", "nearest"];

const formatJobTime = (createdAt: Date | string | undefined): string => {
  try {
    if (!createdAt) {
      return "Unknown time";
    }

    const date =
      typeof createdAt === "string" ? new Date(createdAt) : createdAt;

    if (isNaN(date.getTime())) {
      return "Invalid time";
    }

    return date.toLocaleTimeString();
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Unknown time";
  }
};

export default function StyleTransferPage() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();

  const [params, setParams] = useState<StyleTransferParams>({
    prompt: "",
    width: 832,
    height: 1216,
    batchSize: 1,
    steps: 40,
    cfg: 1,
    samplerName: "euler",
    scheduler: "beta",
    guidance: 3.5,
    loraStrength: 0.95,
    selectedLora: "AI MODEL 3.safetensors",
    seed: null,
    // Style transfer specific
    weight: 0.8,
    mode: "center crop (square)",
    downsamplingFactor: 1,
    downsamplingFunction: "area",
    autocropMargin: 0.1,
  });

  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [jobHistory, setJobHistory] = useState<GenerationJob[]>([]);

  // Real-time progress tracking
  const [progressData, setProgressData] = useState<{
    progress: number;
    stage: string;
    message: string;
    elapsedTime?: number;
    estimatedTimeRemaining?: number;
    imageCount?: number; // For batch progress
    totalImages?: number; // For batch progress
  }>({
    progress: 0,
    stage: "",
    message: "",
    elapsedTime: 0,
    estimatedTimeRemaining: 0,
    imageCount: 0,
    totalImages: 0,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [availableLoRAs, setAvailableLoRAs] = useState<LoRAModel[]>([
    {
      fileName: "AI MODEL 3.safetensors",
      displayName: "AI MODEL 3",
      name: "ai_model_3",
    },
  ]);
  const [loadingLoRAs, setLoadingLoRAs] = useState(true);

  // Style transfer specific states
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<
    string | null
  >(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [maskData, setMaskData] = useState<string | null>(null);
  const [showMaskEditor, setShowMaskEditor] = useState(false);
  const [uploadedImageFilename, setUploadedImageFilename] = useState<
    string | null
  >(null);

  // Database image states
  const [jobImages, setJobImages] = useState<Record<string, DatabaseImage[]>>(
    {}
  );
  const [imageStats, setImageStats] = useState<any>(null);
  const [refreshingImages, setRefreshingImages] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldContinuePolling = useRef<boolean>(true);

  // Helper function to determine if a failed job was actually cancelled
  const isJobCancelled = (job: GenerationJob) => {
    return job.status === 'failed' && job.error === 'Job canceled by user';
  };

  // Helper function to clear persistent state
  const clearPersistentState = () => {
    if (typeof window !== 'undefined') {
      // Clear all keys except job history
      const keysToKeep = [STORAGE_KEYS.jobHistory];
      Object.values(STORAGE_KEYS).forEach(key => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      });
    }
    // Also clear global progress
    clearGlobalProgress();
  };

  // Helper function to move currentJob to history when it's completed
  const moveCurrentJobToHistory = () => {
    if (currentJob && (currentJob.status === 'completed' || currentJob.status === 'failed')) {
      setJobHistory(prev => {
        // Check if job is already in history
        const existsInHistory = prev.some(job => job?.id === currentJob.id);
        if (!existsInHistory) {
          // Add to front of history and limit to 5
          return [currentJob, ...prev.filter(Boolean)].slice(0, 5);
        }
        return prev.slice(0, 5); // Just ensure limit
      });
    }
  };

  // Manual state reset for stuck jobs
  const resetStuckJob = () => {
    console.log("🔄 Manually resetting stuck job state");
    
    // Move current job to history before clearing
    moveCurrentJobToHistory();
    
    shouldContinuePolling.current = false;
    setIsGenerating(false);
    setCurrentJob(null);
    clearPersistentState();
    setProgressData({
      progress: 0,
      stage: "",
      message: "",
      elapsedTime: 0,
      estimatedTimeRemaining: 0,
    });
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

      // Update global progress
      updateGlobalProgress({
        isGenerating: true,
        progress: 0,
        stage: "canceling",
        message: "🛑 Canceling generation...",
        generationType: 'style-transfer',
        jobId: currentJob.id,
        elapsedTime: 0,
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
        ).filter(Boolean).slice(0, 5) // Limit to 5 jobs
      );

      // Stop generation state
      setIsGenerating(false);
      
      // Stop polling immediately
      shouldContinuePolling.current = false;
      
      // Add a small delay to ensure any in-flight polling requests complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Reset progress data immediately
      setProgressData({
        progress: 0,
        stage: "cancelled",
        message: "🛑 Generation cancelled by user",
        elapsedTime: 0,
        estimatedTimeRemaining: 0,
      });
      
      // Clear persistent state
      clearPersistentState();

      // Clear global progress after a short delay
      setTimeout(() => {
        clearGlobalProgress();
      }, 2000);

      alert("✅ Generation canceled successfully");

    } catch (error) {
      console.error("❌ Error canceling generation:", error);
      
      alert(
        "❌ Failed to cancel generation: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  // Persistent generation state keys
  const STORAGE_KEYS = {
    currentJob: 'style-transfer-current-job',
    isGenerating: 'style-transfer-is-generating',
    progressData: 'style-transfer-progress-data',
    jobHistory: 'style-transfer-job-history',
  };

  // Load persistent state on component mount
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
              setJobHistory(history.slice(0, 5)); // Limit to 5 most recent
              console.log('📚 Loaded job history:', history.length, 'jobs');
            }
          } catch (error) {
            console.error('Error parsing saved job history:', error);
            localStorage.removeItem(STORAGE_KEYS.jobHistory);
          }
        }

        if (savedCurrentJob) {
          const job = JSON.parse(savedCurrentJob);
          setCurrentJob(job);
          
          // If there's a saved generating state and the job is still pending/processing, resume polling
          // But don't resume for cancelled jobs
          if (savedIsGenerating === 'true' && 
              (job.status === 'pending' || job.status === 'processing') && 
              !(job.status === 'failed' && job.error === 'Job canceled by user')) {
            setIsGenerating(true);
            
            if (savedProgressData) {
              setProgressData(JSON.parse(savedProgressData));
            }
            
            // Resume polling for this job with a delay to ensure pollJobStatus is defined
            console.log('🔄 Resuming style transfer monitoring for job:', job.id);
            shouldContinuePolling.current = true; // Enable polling for resumed job
            setTimeout(() => {
              pollJobStatus(job.id);
            }, 100);
          }
        }
      } catch (error) {
        console.error('Error loading persistent state:', error);
        // Clear corrupted data
        clearPersistentState();
      }
    }
  }, [apiClient]); // Add apiClient as dependency

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (currentJob) {
        localStorage.setItem(STORAGE_KEYS.currentJob, JSON.stringify(currentJob));
      } else {
        localStorage.removeItem(STORAGE_KEYS.currentJob);
      }
    }
  }, [currentJob]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.isGenerating, isGenerating.toString());
      
      // Update global progress
      if (isGenerating && currentJob) {
        updateGlobalProgress({
          isGenerating: true,
          progress: progressData.progress || 0,
          stage: progressData.stage || '',
          message: progressData.message || 'Style transfer in progress...',
          generationType: 'style-transfer',
          jobId: currentJob.id,
          elapsedTime: progressData.elapsedTime,
          estimatedTimeRemaining: progressData.estimatedTimeRemaining,
        });
      }
      
      // Clear state when generation completes
      if (!isGenerating) {
        localStorage.removeItem(STORAGE_KEYS.progressData);
        clearGlobalProgress();
      }
    }
  }, [isGenerating, currentJob?.id, progressData.progress, progressData.stage, progressData.message, progressData.elapsedTime, progressData.estimatedTimeRemaining, progressData.imageCount, progressData.totalImages, updateGlobalProgress, clearGlobalProgress]);

  useEffect(() => {
    if (typeof window !== 'undefined' && isGenerating) {
      localStorage.setItem(STORAGE_KEYS.progressData, JSON.stringify(progressData));
      
      // Update global progress when progress data changes
      if (currentJob) {
        updateGlobalProgress({
          isGenerating: true,
          progress: progressData.progress || 0,
          stage: progressData.stage || '',
          message: progressData.message || 'Style transfer in progress...',
          generationType: 'style-transfer',
          jobId: currentJob.id,
          elapsedTime: progressData.elapsedTime,
          estimatedTimeRemaining: progressData.estimatedTimeRemaining,
        });
      }
    }
  }, [progressData.progress, progressData.stage, progressData.message, progressData.elapsedTime, progressData.estimatedTimeRemaining, progressData.imageCount, progressData.totalImages, isGenerating, currentJob?.id, updateGlobalProgress]);

  // Save job history to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && Array.isArray(jobHistory) && jobHistory.length > 0) {
      // Only save valid jobs and limit to 5 most recent
      const validHistory = jobHistory
        .filter(job => job && job.id && job.status)
        .slice(0, 5);
      
      if (validHistory.length > 0) {
        localStorage.setItem(STORAGE_KEYS.jobHistory, JSON.stringify(validHistory));
        console.log('💾 Saved job history:', validHistory.length, 'jobs');
      }
    }
  }, [jobHistory]);

  // Update browser tab title and favicon for cross-tab generation progress indication
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const originalTitle = 'Style Transfer - AI Creative Studio';
      
      if (isGenerating && currentJob) {
        // Update document title with progress
        const progress = Math.round(progressData.progress || 0);
        const stage = progressData.stage || 'generating';
        
        let progressIcon = '🎨';
        if (stage === 'starting') progressIcon = '🚀';
        else if (stage === 'loading_models') progressIcon = '📦';
        else if (stage === 'processing_prompt') progressIcon = '📝';
        else if (stage === 'processing_image') progressIcon = '🖼️';
        else if (stage === 'generating') progressIcon = '🎨';
        else if (stage === 'saving') progressIcon = '💾';
        else if (stage === 'completed') progressIcon = '✅';
        else if (stage === 'failed') progressIcon = '❌';
        
        const titleWithProgress = `${progressIcon} ${progress}% - Style Transfer | AI Creative Studio`;
        document.title = titleWithProgress;
        
        // Create and update dynamic favicon with progress indicator
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 32;
        canvas.height = 32;
        
        if (ctx) {
          // Draw background circle
          ctx.fillStyle = '#8B5CF6'; // Purple background for style transfer
          ctx.beginPath();
          ctx.arc(16, 16, 15, 0, 2 * Math.PI);
          ctx.fill();
          
          // Draw progress arc
          if (progress > 0) {
            ctx.strokeStyle = '#10B981'; // Green progress
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(16, 16, 12, -Math.PI / 2, (2 * Math.PI * progress / 100) - Math.PI / 2);
            ctx.stroke();
          }
          
          // Draw center dot
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(16, 16, 4, 0, 2 * Math.PI);
          ctx.fill();
          
          // Update favicon
          const faviconUrl = canvas.toDataURL('image/png');
          let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
          if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
          }
          favicon.href = faviconUrl;
        }
        
      } else {
        // Reset to original title and favicon when not generating
        document.title = originalTitle;
        
        // Reset favicon to default
        const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (favicon) {
          favicon.href = '/favicon.ico';
        }
      }
    }
    
    // Cleanup function to reset title when component unmounts
    return () => {
      if (typeof window !== 'undefined') {
        document.title = 'Style Transfer - AI Creative Studio';
      }
    };
  }, [isGenerating, currentJob, progressData]);

  // Request notification permission on component mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Send browser notification when generation completes
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && 
        currentJob && currentJob.status === 'completed' && !isGenerating) {
      
      if (Notification.permission === 'granted') {
        const notification = new Notification('🎨 Style Transfer Complete!', {
          body: 'Your stylized image is ready to view.',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'style-transfer-complete',
          requireInteraction: false,
        });

        // Auto-close notification after 5 seconds
        setTimeout(() => {
          notification.close();
        }, 5000);

        // Focus window when notification is clicked
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
    }
  }, [currentJob?.status, isGenerating]);

  // Initialize empty job history on mount
  useEffect(() => {
    if (!Array.isArray(jobHistory)) {
      setJobHistory([]);
    }
  }, []);

  // Fetch image stats on mount
  useEffect(() => {
    if (apiClient) {
      fetchImageStats();
    }
  }, [apiClient]);

  // Auto-refresh for ALL jobs - check every 3 seconds for faster loading
  useEffect(() => {
    if (!apiClient || !currentJob) {
      return;
    }

    // More aggressive auto-refresh for ANY job that might have images
    const autoRefreshInterval = setInterval(async () => {
      console.log('🔄 Auto-refresh: Checking for job images...');
      
      // Always check for images if we don't have them yet
      const hasImages = jobImages[currentJob.id] && jobImages[currentJob.id].length > 0;
      
      if (!hasImages) {
        console.log('🔄 Auto-refresh: No images found, fetching...');
        await fetchJobImages(currentJob.id);
        
        // Also try auto-processing every few cycles
        if (Math.random() < 0.3) { // 30% chance each cycle
          try {
            await apiClient.post("/api/jobs/auto-process-serverless");
            console.log("🔄 Auto-processing triggered during auto-refresh");
          } catch (error) {
            // Silent fail for auto-processing
          }
        }
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(autoRefreshInterval);
  }, [apiClient, currentJob, jobImages]);

  // Watch for job status changes and immediately fetch images when completed
  useEffect(() => {
    if (currentJob && currentJob.status === 'completed' && !isGenerating) {
      const hasImages = jobImages[currentJob.id] && jobImages[currentJob.id].length > 0;
      
      if (!hasImages) {
        console.log('🎯 Job completed, immediately fetching images...');
        // Fetch immediately when job completes
        fetchJobImages(currentJob.id);
        
        // Also set up aggressive retry for the first minute
        const retryIntervals = [1000, 2000, 5000, 10000, 15000]; // 1s, 2s, 5s, 10s, 15s
        
        retryIntervals.forEach((delay, index) => {
          setTimeout(async () => {
            const currentImages = jobImages[currentJob.id];
            if (!currentImages || currentImages.length === 0) {
              console.log(`🔄 Retry ${index + 1}: Still no images, fetching again...`);
              await fetchJobImages(currentJob.id);
            }
          }, delay);
        });
      }
    }
  }, [currentJob?.status, currentJob?.id, isGenerating, jobImages]);

  // Handle reference image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert("Please select a valid image file");
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert("Image size must be less than 10MB");
        return;
      }

      setReferenceImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setReferenceImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    setReferenceImagePreview(null);
    setMaskData(null);
    setShowMaskEditor(false);
    setUploadedImageFilename(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle mask updates from the mask editor
  const handleMaskUpdate = (maskDataUrl: string | null) => {
    setMaskData(maskDataUrl);
    console.log("🎭 Mask updated:", maskDataUrl ? "Has mask data" : "No mask");
  };

  // Function to fetch images for a completed job
  const fetchJobImages = async (jobId: string): Promise<boolean> => {
    try {
      if (!apiClient) {
        console.error("API client is not available");
        return false;
      }

      console.log("🖼️ Fetching database images for job:", jobId);

      const response = await apiClient.get(`/api/jobs/${jobId}/images`);
      console.log("📡 Image fetch response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Failed to fetch job images:",
          response.status,
          errorText
        );
        return false;
      }

      const data = await response.json();
      console.log("📊 Job images data:", data);

      if (data.success && data.images && Array.isArray(data.images)) {
        // Update job images state
        setJobImages((prev) => ({
          ...prev,
          [jobId]: data.images,
        }));
        
        console.log(
          "✅ Updated job images state for job:",
          jobId,
          "Images count:",
          data.images.length
        );

        // Log sample image data for debugging
        if (data.images.length > 0) {
          // Always accept images even if they don't have displayable URLs yet
          // They may be processing in the background
          console.log("📸 Sample image data:", {
            filename: data.images[0].filename,
            hasDataUrl: !!data.images[0].dataUrl,
            hasUrl: !!data.images[0].url,
            hasS3Key: !!data.images[0].s3Key,
            hasNetworkVolume: !!data.images[0].networkVolumePath,
            id: data.images[0].id,
          });
        }

        // Force a re-render by updating a counter or timestamp
        setJobImages((prev) => ({ ...prev }));

        return data.images.length > 0;
      } else {
        console.warn("⚠️ Invalid response format:", data);
        return false;
      }
    } catch (error) {
      console.error("💥 Error fetching job images:", error);
      return false;
    }
  };

  // Function to fetch user image statistics
  const fetchImageStats = async () => {
    if (!apiClient) return;

    try {
      const response = await apiClient.get("/api/images?stats=true");

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setImageStats(data.stats);
          console.log("📊 Image stats:", data.stats);
        }
      }
    } catch (error) {
      console.error("Error fetching image stats:", error);
    }
  };

  // Function to download image with dynamic URL support
  // Function to download image with dynamic URL support
  const downloadDatabaseImage = async (image: DatabaseImage) => {
    if (!apiClient) {
      alert("API client not available");
      return;
    }

    try {
      console.log("📥 Downloading image:", image.filename);

      // Priority 1: Download from AWS S3
      if (image.awsS3Key || image.awsS3Url) {
        const s3Url = getOptimizedImageUrl(image);
        console.log("🚀 Downloading from S3:", s3Url);
        
        try {
          const response = await fetch(s3Url);
          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = image.filename;
            link.click();
            URL.revokeObjectURL(url);
            console.log("✅ S3 image downloaded");
            return;
          }
        } catch (s3Error) {
          console.warn("⚠️ S3 download failed, trying fallback:", s3Error);
        }
      }

      // Priority 2: Download from database
      if (image.dataUrl) {
        const response = await apiClient.get(image.dataUrl);
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = image.filename;
          link.click();
          URL.revokeObjectURL(url);
          console.log("✅ Database image downloaded");
          return;
        }
      }

      // Priority 3: Download from ComfyUI (dynamic URL)
      if (image.url) {
        const link = document.createElement("a");
        link.href = image.url;
        link.download = image.filename;
        link.click();
        console.log("✅ ComfyUI image downloaded");
        return;
      }

      throw new Error("No download URL available");
    } catch (error) {
      console.error("Error downloading image:", error);
      alert(
        "Failed to download image: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  // Function to share image URL
  const shareImage = (image: DatabaseImage) => {
    let urlToShare = "";

    // Priority 1: Share AWS S3 URL (fastest and most reliable)
    if (image.awsS3Key || image.awsS3Url) {
      urlToShare = getOptimizedImageUrl(image);
    } else if (image.dataUrl) {
      // Priority 2: Share database URL (more reliable)
      urlToShare = `${window.location.origin}${image.dataUrl}`;
    } else if (image.url) {
      // Priority 3: Share ComfyUI URL (dynamic, may not work for serverless)
      urlToShare = image.url;
    } else {
      alert("No shareable URL available for this image");
      return;
    }

    navigator.clipboard.writeText(urlToShare);
    alert("Image URL copied to clipboard!");
    navigator.clipboard.writeText(urlToShare);
    alert("Image URL copied to clipboard!");
  };

  // Helper function for legacy URL downloads
  const downloadFromUrl = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  };

  // Fetch available LoRA models on component mount
  useEffect(() => {
    const fetchLoRAModels = async () => {
      if (!apiClient) return;

      try {
        setLoadingLoRAs(true);
        console.log("=== FETCHING LORA MODELS ===");

        const response = await apiClient.get("/api/models/loras");
        console.log("LoRA API response status:", response.status);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("LoRA API response data:", data);

        if (data.success && data.models && Array.isArray(data.models)) {
          console.log("Available LoRA models:", data.models);
          setAvailableLoRAs(data.models);

          // Set default LoRA for style transfer (AI MODEL 3)
          const aiModel3 = data.models.find(
            (lora: LoRAModel) => lora.fileName === "AI MODEL 3.safetensors"
          );
          if (aiModel3) {
            setParams((prev) => ({
              ...prev,
              selectedLora: aiModel3.fileName,
            }));
          } else {
            const defaultLora = data.models[0]?.fileName || "None";
            setParams((prev) => ({
              ...prev,
              selectedLora: defaultLora,
            }));
          }
        } else {
          console.error("Invalid LoRA API response:", data);
          setAvailableLoRAs([
            {
              fileName: "AI MODEL 3.safetensors",
              displayName: "AI MODEL 3",
              name: "ai_model_3",
            },
          ]);
        }
      } catch (error) {
        console.error("Error fetching LoRA models:", error);
        setAvailableLoRAs([
          {
            fileName: "AI MODEL 3.safetensors",
            displayName: "AI MODEL 3",
            name: "ai_model_3",
          },
        ]);
      } finally {
        setLoadingLoRAs(false);
      }
    };

    fetchLoRAModels();
  }, [apiClient]);

  const generateRandomSeed = () => {
    const seed = Math.floor(Math.random() * 1000000000);
    setParams((prev) => ({ ...prev, seed }));
  };

  const handleAspectRatioChange = (width: number, height: number) => {
    setParams((prev) => ({ ...prev, width, height }));
  };

  // Upload reference image to server
  const uploadReferenceImageToServer = async (
    file: File,
    maskDataUrl?: string | null
  ): Promise<{
    filename: string;
    maskFilename?: string;
    base64?: string;
    maskBase64?: string;
    dataUrl?: string;
    maskDataUrl?: string;
  }> => {
    if (!apiClient) throw new Error("API client not ready");

    const formData = new FormData();
    formData.append("image", file);

    // Add mask data if present
    if (maskDataUrl) {
      // Convert data URL to blob
      const maskResponse = await fetch(maskDataUrl);
      const maskBlob = await maskResponse.blob();
      formData.append("mask", maskBlob, "mask.png");
    }

    setUploadingImage(true);

    try {
      const response = await apiClient.postFormData(
        "/api/upload/image",
        formData
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload image");
      }

      const data = await response.json();
      console.log("✅ Image uploaded successfully:", data);

      return {
        filename: data.filename,
        maskFilename: data.maskFilename,
        base64: data.base64,
        maskBase64: data.maskBase64,
        dataUrl: data.dataUrl,
        maskDataUrl: data.maskDataUrl,
      };
    } catch (error) {
      console.error("💥 Error uploading image:", error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  // Submit generation - Updated for serverless
  const handleGenerate = async () => {
    if (!apiClient) {
      alert("API client not ready. Please try again.");
      return;
    }

    if (!params.prompt.trim()) {
      alert("Please enter a prompt");
      return;
    }

    if (!referenceImage) {
      alert("Please select a reference image for style transfer");
      return;
    }

    setIsGenerating(true);
    setCurrentJob(null);

    // Initialize progress tracking with batch size
    setProgressData({
      progress: 0,
      stage: "starting",
      message: "🚀 Initializing style transfer generation...",
      elapsedTime: 0,
      estimatedTimeRemaining: 180, // 3 minutes initial estimate
      imageCount: 0,
      totalImages: params.batchSize, // Set expected batch size
    });

    try {
      console.log("=== STARTING STYLE TRANSFER GENERATION (SERVERLESS) ===");
      console.log("Generation params:", params);

      // Upload reference image first
      console.log("📤 Uploading reference image...");
      const uploadResult = await uploadReferenceImageToServer(
        referenceImage,
        maskData
      );
      console.log("✅ Reference image uploaded:", uploadResult.filename);
      if (uploadResult.maskFilename) {
        console.log("✅ Mask uploaded:", uploadResult.maskFilename);
      }

      const workflow = createWorkflowJson(
        params,
        uploadResult.filename,
        uploadResult.maskFilename
      );
      console.log("Created style transfer workflow for serverless submission");

      // Submit to serverless API endpoint instead of local ComfyUI
      const response = await apiClient.post("/api/generate/serverless", {
        workflow,
        params,
        action: "generate_style_transfer",
        generation_type: "style_transfer",
        referenceImage: uploadResult.filename,
        maskImage: uploadResult.maskFilename,
        // Include base64 data for direct use by RunPod
        referenceImageData: uploadResult.base64,
        maskImageData: uploadResult.maskBase64,
      });

      console.log("Serverless API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Serverless generation failed:",
          response.status,
          errorText
        );
        throw new Error(
          `Serverless generation failed: ${response.status} - ${errorText}`
        );
      }

      const { jobId } = await response.json();
      console.log("Received serverless job ID:", jobId);

      if (!jobId) {
        throw new Error("No job ID received from serverless endpoint");
      }

      const newJob: GenerationJob = {
        id: jobId,
        status: "pending",
        createdAt: new Date(),
        progress: 0,
      };

      setCurrentJob(newJob);
      setJobHistory((prev) => [newJob, ...prev.filter(Boolean)].slice(0, 5)); // Limit to 5 jobs

      // Start polling for job status (serverless webhooks + polling)
      shouldContinuePolling.current = true; // Enable polling for new job
      pollJobStatus(jobId);
    } catch (error) {
      console.error("Serverless generation error:", error);
      setIsGenerating(false);
      alert(
        error instanceof Error ? error.message : "Serverless generation failed"
      );
    }
  };

  // Updated poll job status for serverless with database image fetching and enhanced progress tracking
  const pollJobStatus = async (jobId: string) => {
    if (!apiClient) {
      console.error("❌ API client not available for job polling");
      setIsGenerating(false);
      return;
    }

    console.log("=== STARTING STYLE TRANSFER JOB POLLING ===");
    console.log("Polling style transfer job ID:", jobId);

    const maxAttempts = 600; // 10 minutes (increased for complex generations)
    let attempts = 0;

    const poll = async () => {
      try {
        // Check if polling should continue
        if (!shouldContinuePolling.current) {
          console.log("🛑 Polling stopped - generation was cancelled");
          return;
        }

        attempts++;
        console.log(
          `Polling attempt ${attempts}/${maxAttempts} for job ${jobId}`
        );

        let response = await apiClient.get(`/api/jobs/${jobId}`);
        console.log("Job status response:", response.status);

        // If job status endpoint fails, try RunPod status endpoint as fallback
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Job status error:", response.status, errorText);

          // Try RunPod serverless completion check as fallback
          if (response.status === 404 || response.status >= 500) {
            console.log(
              "🔄 Trying RunPod serverless completion check as fallback..."
            );
            try {
              const serverlessResponse = await apiClient.post(
                "/api/jobs/check-runpod-serverless",
                {
                  jobId,
                }
              );

              if (serverlessResponse.ok) {
                response = serverlessResponse;
                console.log("✅ RunPod serverless check successful");
              } else {
                console.error("❌ RunPod serverless check also failed");
              }
            } catch (serverlessError) {
              console.error(
                "❌ RunPod serverless check error:",
                serverlessError
              );
            }
          }

          if (!response.ok) {
            if (response.status === 404) {
              console.error("Job not found - this might be a storage issue");
              if (attempts < 10 && shouldContinuePolling.current) {
                // Retry a few times for new jobs
                setTimeout(poll, 500); // Faster polling for better progress updates
                return;
              } else if (!shouldContinuePolling.current) {
                console.log("🛑 Polling stopped due to cancellation (404 retry)");
                return;
              }
            }

            throw new Error(`Job status check failed: ${response.status}`);
          }
        }

        const job = await response.json();
        console.log("Job status data:", job);

        // Handle date conversion safely
        if (job.createdAt && typeof job.createdAt === "string") {
          job.createdAt = new Date(job.createdAt);
        }

        // Handle chunked image uploads for batch style transfer generations
        if (job.status === "IMAGE_READY" && job.image) {
          console.log(`🎨 Received chunked style transfer image ${job.imageCount || 1} of ${job.totalImages || 1}`);
          
          // Update progress with individual image info
          setProgressData({
            progress: job.progress || 0,
            stage: job.stage || "uploading_images",
            message: job.message || `🎨 Style transfer image ${job.imageCount || 1} ready`,
            elapsedTime: job.elapsedTime,
            estimatedTimeRemaining: job.estimatedTimeRemaining,
            imageCount: job.imageCount || 1,
            totalImages: job.totalImages || 1,
          });

          // Process the individual image immediately
          try {
            const saveResponse = await apiClient.post("/api/images/save", {
              jobId: jobId,
              filename: job.image.filename,
              subfolder: job.image.subfolder || "",
              type: job.image.type || "output",
              data: job.image.data,
            });

            if (saveResponse.ok) {
              console.log(`✅ Saved chunked style transfer image ${job.imageCount}: ${job.image.filename}`);
              
              // Refresh job images to show the new image immediately
              await fetchJobImages(jobId);
            } else {
              console.error(`❌ Failed to save chunked style transfer image ${job.imageCount}:`, await saveResponse.text());
            }
          } catch (saveError) {
            console.error(`❌ Error saving chunked style transfer image ${job.imageCount}:`, saveError);
          }

          // Continue polling for more images or completion
          setTimeout(poll, 500);
          return;
        }

        // Update progress tracking state
        if (job.status === "processing") {
          setProgressData({
            progress: job.progress || 0,
            stage: job.stage || "",
            message: job.message || "Processing style transfer...",
            elapsedTime: job.elapsedTime,
            estimatedTimeRemaining: job.estimatedTimeRemaining,
            imageCount: job.imageCount,
            totalImages: job.totalImages,
          });
        }

        // Don't override locally cancelled jobs - check if current job was cancelled by user
        if (currentJob && isJobCancelled(currentJob)) {
          console.log("🛑 Not overriding locally cancelled job");
          return; // Exit polling immediately for cancelled jobs
        }

        setCurrentJob(job);
        setJobHistory((prev) =>
          prev
            .map((j) => {
              if (j?.id === jobId) {
                // Don't override locally cancelled jobs in history
                if (isJobCancelled(j)) {
                  return j; // Keep the cancelled job as-is
                }
                return {
                  ...job,
                  createdAt: job.createdAt || j.createdAt,
                };
              }
              return j;
            })
            .filter(Boolean)
            .slice(0, 5) // Limit to 5 jobs
        );

        if (job.status === "completed") {
          console.log("Style transfer job completed successfully!");
          setIsGenerating(false);
          
          // Clear persistent state when generation completes
          clearPersistentState();

          // Reset progress tracking
          setProgressData({
            progress: 100,
            stage: "completed",
            message: "✅ Style transfer generation completed successfully!",
            elapsedTime: progressData.elapsedTime,
            estimatedTimeRemaining: 0,
          });

          // Fetch database images for completed job with aggressive retry logic
          console.log("🔄 Attempting to fetch job images immediately...");
          
          // First, trigger auto-processing to ensure serverless jobs are processed
          try {
            console.log("🔄 Pre-triggering auto-processing for serverless jobs...");
            const autoProcessResponse = await apiClient.post("/api/jobs/auto-process-serverless");
            if (autoProcessResponse.ok) {
              console.log("✅ Pre-processing triggered successfully");
              // Wait briefly for processing
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (error) {
            console.error("❌ Pre-processing failed:", error);
          }
          
          const fetchSuccess = await fetchJobImages(jobId);

          // If fetch failed or no images found, retry with multiple attempts
          if (!fetchSuccess) {
            console.log("🔄 First fetch failed, starting aggressive retry sequence...");
            
            // Retry with shorter intervals: 0.5s, 1s, 2s, 3s, 5s
            const retryDelays = [500, 1000, 2000, 3000, 5000];
            
            for (let i = 0; i < retryDelays.length; i++) {
              await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
              console.log(`🔄 Retry attempt ${i + 1} after ${retryDelays[i]}ms delay...`);
              
              const retrySuccess = await fetchJobImages(jobId);
              if (retrySuccess) {
                console.log(`✅ Images fetched successfully on retry ${i + 1}`);
                break;
              }
              
              if (i === retryDelays.length - 1) {
                console.warn("⚠️ All retry attempts failed, triggering auto-processing...");
                
                // Force auto-processing as last resort
                try {
                  const autoProcessResponse = await apiClient.post("/api/jobs/auto-process-serverless");
                  if (autoProcessResponse.ok) {
                    // Wait a bit and try one more time
                    setTimeout(async () => {
                      console.log("🔄 Final attempt after auto-processing...");
                      await fetchJobImages(jobId);
                    }, 2000);
                  }
                } catch (error) {
                  console.error("❌ Auto-processing failed:", error);
                }
              }
            }
          } else {
            console.log("✅ Images fetched successfully on first attempt");
          }

          // Also trigger auto-processing for serverless jobs (fallback)
          try {
            console.log("🔄 Triggering auto-processing for serverless jobs...");
            const autoProcessResponse = await apiClient.post(
              "/api/jobs/auto-process-serverless"
            );
            if (autoProcessResponse.ok) {
              console.log("✅ Auto-processing triggered successfully");
              // Refresh images again after auto-processing
              setTimeout(() => {
                fetchJobImages(jobId);
                fetchImageStats();
              }, 2000);
            }
          } catch (autoProcessError) {
            console.error("❌ Auto-processing failed:", autoProcessError);
          }

          // Refresh image stats after completion
          console.log("📊 Refreshing image stats after generation completion");
          await fetchImageStats();

          // Show success notification in console only
          console.log(
            "✅ Style transfer completed! Images should appear automatically in the gallery and below."
          );

          return;
        } else if (job.status === "failed") {
          console.log("Style transfer job failed:", job.error);
          setIsGenerating(false);
          
          // Clear persistent state when generation fails
          clearPersistentState();

          // Check if this was a user cancellation vs actual failure
          if (isJobCancelled(job)) {
            // Reset progress tracking to show cancellation
            setProgressData({
              progress: 0,
              stage: "cancelled",
              message: "🛑 Style transfer cancelled by user",
              elapsedTime: progressData.elapsedTime,
              estimatedTimeRemaining: 0,
            });
            // Don't show alert for user cancellations
            console.log("✅ Style transfer was cancelled by user");
          } else {
            // Reset progress tracking to show failure
            setProgressData({
              progress: 0,
              stage: "failed",
              message: `❌ Style transfer failed: ${job.error || "Unknown error"}`,
              elapsedTime: progressData.elapsedTime,
              estimatedTimeRemaining: 0,
            });
            // Only show alert for actual failures
            alert(`❌ Style transfer failed: ${job.error || "Unknown error"}`);
          }
          return;
        }

        // Continue polling
        if (attempts < maxAttempts && shouldContinuePolling.current) {
          setTimeout(poll, 500); // Poll every 500ms for smooth progress updates
        } else if (!shouldContinuePolling.current) {
          console.log("🛑 Polling stopped due to cancellation");
        } else {
          console.error("❌ Style transfer polling timeout");
          setIsGenerating(false);
          
          // Clear persistent state on timeout
          clearPersistentState();

          // Reset progress tracking to show timeout
          setProgressData({
            progress: 0,
            stage: "failed",
            message: "❌ Style transfer timeout - please try again",
            elapsedTime: progressData.elapsedTime,
            estimatedTimeRemaining: 0,
          });

          alert("Style transfer generation timeout - please try again");
        }
      } catch (error) {
        console.error("❌ Polling error:", error);
        
        // Continue polling on errors (network issues, etc.)
        if (attempts < maxAttempts && shouldContinuePolling.current) {
          setTimeout(poll, 2000); // Longer delay on errors
        } else if (!shouldContinuePolling.current) {
          console.log("🛑 Polling stopped due to cancellation (error handler)");
        } else {
          setIsGenerating(false);
          clearPersistentState();
          alert("Style transfer monitoring failed - please refresh and try again");
        }
      }
    };

    // Start polling immediately
    poll();
  };

  // Create workflow JSON for style transfer - matches your ComfyUI workflow exactly
  const createWorkflowJson = (
    params: StyleTransferParams,
    imageFilename: string,
    maskFilename?: string
  ) => {
    const seed = params.seed || Math.floor(Math.random() * 1000000000);

    const workflow: any = {
      "8": {
        inputs: {
          samples: ["31", 0],
          vae: ["50", 0],
        },
        class_type: "VAEDecode",
      },
      "154": {
        inputs: {
          filename_prefix: "ComfyUI",
          images: ["8", 0],
        },
        class_type: "SaveImage",
      },
      "33": {
        inputs: {
          text: "", // Negative prompt - empty for style transfer
          clip: ["51", 1],
        },
        class_type: "CLIPTextEncode",
      },
      "31": {
        inputs: {
          model: ["51", 0],
          positive: ["41", 0],
          negative: ["33", 0],
          latent_image: ["27", 0],
          seed: seed,
          steps: params.steps,
          cfg: params.cfg,
          sampler_name: params.samplerName,
          scheduler: params.scheduler,
          denoise: 1,
        },
        class_type: "KSampler",
      },
      "37": {
        inputs: {
          unet_name: "flux1-dev.safetensors",
          weight_dtype: "fp8_e4m3fn",
        },
        class_type: "UNETLoader",
      },
      "51": {
        inputs: {
          model: ["37", 0],
          clip: ["38", 0],
          lora_name: params.selectedLora,
          strength_model: params.loraStrength,
          strength_clip: 1,
        },
        class_type: "LoraLoader",
      },
      "38": {
        inputs: {
          clip_name1: "t5xxl_fp16.safetensors",
          clip_name2: "ViT-L-14-TEXT-detail-improved-hiT-GmP-HF.safetensors",
          type: "flux",
          device: "default",
        },
        class_type: "DualCLIPLoader",
      },
      "42": {
        inputs: {
          style_model_name: "flux1-redux-dev.safetensors",
        },
        class_type: "StyleModelLoader",
      },
      "43": {
        inputs: {
          clip_name: "model.safetensors",
        },
        class_type: "CLIPVisionLoader",
      },
      "44": {
        inputs: {
          clip_vision: ["43", 0],
          image: ["155", 0],
        },
        class_type: "CLIPVisionEncode",
      },
      "44_redux": {
        inputs: {
          conditioning: ["6", 0], // Text conditioning
          style_model: ["42", 0], // Style model
          clip_vision_output: ["44", 0], // Image conditioning
          strength: params.weight,
          strength_type: "multiply",
        },
        class_type: "StyleModelApplyAdvanced",
      },
      "50": {
        inputs: {
          vae_name: "ae.safetensors",
        },
        class_type: "VAELoader",
      },
      "41": {
        inputs: {
          conditioning: ["44_redux", 0],
          guidance: params.guidance,
        },
        class_type: "FluxGuidance",
      },
      "27": {
        inputs: {
          width: params.width,
          height: params.height,
          batch_size: params.batchSize,
        },
        class_type: "EmptySD3LatentImage",
      },
      "6": {
        inputs: {
          text: params.prompt,
          clip: ["51", 1],
        },
        class_type: "CLIPTextEncode",
      },
      "155": {
        inputs: {
          image: imageFilename,
        },
        class_type: "LoadImage",
      },
    };

    // Add mask processing nodes if mask is provided
    if (maskFilename) {
      // Load mask image
      workflow["156"] = {
        inputs: {
          image: maskFilename,
        },
        class_type: "LoadImage",
      };

      // Convert image to mask (takes the red channel and converts to mask)
      workflow["157"] = {
        inputs: {
          image: ["156", 0],
          channel: "red", // Use red channel for mask
        },
        class_type: "ImageToMask",
      };
    }

    return workflow;
  };

  // Show loading state while API client initializes
  if (!apiClient) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Initializing API client...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Enhanced Header */}
        <div className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 p-1">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Palette className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">
                    AI Style Transfer
                  </h1>
                  <p className="text-purple-100 text-lg">
                    Transform your images with artistic styles using FLUX Redux
                  </p>
                </div>
              </div>

              {/* Status Indicators */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 bg-white/20 rounded-lg px-3 py-2">
                  <Monitor className="w-4 h-4 text-white" />
                  <span className="text-white text-sm font-medium">
                    FLUX Redux
                  </span>
                </div>
                <div className="flex items-center space-x-2 bg-white/20 rounded-lg px-3 py-2">
                  <Eye className="w-4 h-4 text-white" />
                  <span className="text-white text-sm font-medium">
                    {isGenerating ? "Generating..." : "Ready"}
                  </span>
                </div>
                <div className="flex items-center space-x-2 bg-white/20 rounded-lg px-3 py-2">
                  <Users className="w-4 h-4 text-white" />
                  <span className="text-white text-sm font-medium">Pro</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Reference Image Upload */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center">
                <Palette className="w-5 h-5 mr-2 text-pink-600" />
                Style Reference Image
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Upload your reference image for style transfer
                  </label>
                  {referenceImage && (
                    <button
                      onClick={removeReferenceImage}
                      className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {!referenceImagePreview ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 border-slate-300 hover:border-pink-400 hover:bg-pink-50/50 dark:border-slate-600 dark:hover:border-pink-500 dark:hover:bg-pink-900/20 cursor-pointer group"
                  >
                    <div className="w-16 h-16 mx-auto bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center group-hover:bg-pink-200 dark:group-hover:bg-pink-900/50 transition-colors mb-4">
                      <Upload className="w-8 h-8 text-pink-600 dark:text-pink-400" />
                    </div>
                    <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Upload Style Reference Image
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Choose an image whose artistic style you want to apply
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                      Supports PNG, JPG, WebP (max 10MB)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Image Preview and Mask Editor Toggle */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Reference Image {maskData && "(Masked)"}
                      </h3>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setShowMaskEditor(!showMaskEditor)}
                          className={`px-4 py-2 text-sm rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                            showMaskEditor
                              ? "bg-purple-600 text-white shadow-md"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                          }`}
                        >
                          <Wand2 className="w-4 h-4" />
                          <span>
                            {showMaskEditor ? "Hide Mask Editor" : "Edit Mask"}
                          </span>
                        </button>
                        <button
                          onClick={removeReferenceImage}
                          className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                        >
                          <X className="w-4 h-4" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>

                    {/* Mask Editor or Simple Preview */}
                    {showMaskEditor ? (
                      <MaskEditor
                        imageUrl={referenceImagePreview}
                        onMaskUpdate={handleMaskUpdate}
                        className="w-full"
                      />
                    ) : (
                      <div className="relative group">
                        <img
                          src={referenceImagePreview}
                          alt="Reference"
                          className="w-full h-64 object-cover rounded-xl shadow-md group-hover:shadow-lg transition-shadow"
                        />
                        {maskData && (
                          <div className="absolute top-3 right-3 bg-purple-600 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg">
                            🎭 Masked
                          </div>
                        )}
                        {uploadingImage && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-xl backdrop-blur-sm">
                            <div className="flex items-center space-x-3 text-white bg-black/30 px-4 py-2 rounded-lg">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Uploading...</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mask Status */}
                    {maskData && (
                      <div className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                        ✅ Mask applied - Only white areas will be
                        style-transferred
                      </div>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Prompt Input */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-lg font-semibold text-slate-800 dark:text-white flex items-center">
                    <Sparkles className="w-5 h-5 mr-2 text-indigo-600" />
                    Style Description
                  </label>
                  <button
                    onClick={() =>
                      setParams((prev) => ({ ...prev, prompt: "" }))
                    }
                    className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    Clear
                  </button>
                </div>
                <textarea
                  value={params.prompt}
                  onChange={(e) =>
                    setParams((prev) => ({ ...prev, prompt: e.target.value }))
                  }
                  placeholder="Describe the artistic style you want to apply (e.g., 'oil painting style with thick brushstrokes and vibrant colors')"
                  className="w-full h-32 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
                <div className="flex justify-between items-center">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {params.prompt.length}/1000 characters
                  </div>
                  <div className="text-xs text-indigo-600 dark:text-indigo-400">
                    💡 Tip: Be specific about the artistic style you want
                  </div>
                </div>
              </div>
            </div>

            {/* Basic Settings */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center">
                <Sliders className="w-5 h-5 mr-2 text-indigo-600" />
                Style Transfer Settings
              </h3>

              {/* Style Weight */}
              <div className="space-y-4 mb-6 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl">
                <label className="text-sm font-semibold text-slate-800 dark:text-white flex items-center">
                  <Sliders className="w-4 h-4 mr-2 text-indigo-600" />
                  Style Weight:{" "}
                  <span className="ml-2 text-indigo-600 font-bold">
                    {params.weight}
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={params.weight}
                  onChange={(e) =>
                    setParams((prev) => ({
                      ...prev,
                      weight: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer slider-thumb"
                />
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span>💫 Subtle</span>
                  <span>🎨 Strong</span>
                </div>
              </div>

              {/* Style Mode */}
              <div className="space-y-3 mb-6">
                <label className="text-sm font-semibold text-slate-800 dark:text-white flex items-center">
                  <Settings className="w-4 h-4 mr-2 text-purple-600" />
                  Style Mode
                </label>
                <select
                  value={params.mode}
                  onChange={(e) =>
                    setParams((prev) => ({
                      ...prev,
                      mode: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {STYLE_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>

              {/* LoRA Model Selection */}
              <div className="space-y-3 mb-6">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  LoRA Model
                </label>

                {loadingLoRAs ? (
                  <div className="flex items-center space-x-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-gray-500">
                      Loading LoRA models...
                    </span>
                  </div>
                ) : (
                  <select
                    value={params.selectedLora}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        selectedLora: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {availableLoRAs.map((lora, index) => (
                      <option
                        key={`${lora.fileName}-${index}`}
                        value={lora.fileName}
                      >
                        {lora.displayName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Aspect Ratio */}
              <div className="space-y-3 mb-6">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Output Size
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

              {/* Batch Size */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-800 dark:text-white flex items-center">
                    <Layers className="w-4 h-4 mr-2 text-purple-600" />
                    Batch Size
                  </label>
                  <div className="bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 px-3 py-1 rounded-full">
                    <span className="text-sm font-bold text-purple-700 dark:text-purple-300">
                      {params.batchSize} {params.batchSize > 1 ? 'images' : 'image'}
                    </span>
                  </div>
                </div>
                
                <div className="relative">
                  {/* Slider Track */}
                  <div className="relative h-2 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded-full shadow-inner">
                    {/* Progress Fill */}
                    <div 
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600 rounded-full shadow-lg transition-all duration-300 ease-out"
                      style={{ width: `${(params.batchSize / 15) * 100}%` }}
                    />
                    
                    {/* Slider Handle */}
                    <div 
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-white dark:bg-gray-200 border-2 border-purple-500 rounded-full shadow-lg cursor-pointer hover:scale-110 transition-all duration-200 ring-4 ring-purple-200/50 dark:ring-purple-400/30"
                      style={{ left: `${(params.batchSize / 15) * 100}%` }}
                    />
                  </div>
                  
                  {/* Invisible Input Range */}
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={params.batchSize}
                    onChange={(e) => setParams((prev) => ({ ...prev, batchSize: parseInt(e.target.value) }))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  
                  {/* Scale Markers */}
                  <div className="flex justify-between mt-3 px-1">
                    {[1, 5, 10, 15].map((marker) => (
                      <div key={marker} className="flex flex-col items-center">
                        <div className={`w-1 h-2 rounded-full transition-colors ${
                          params.batchSize >= marker 
                            ? 'bg-purple-500' 
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`} />
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {marker}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  💡 Generate multiple style variations simultaneously
                </p>
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
                      min="10"
                      max="100"
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

                  {/* Guidance */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Guidance: {params.guidance}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="0.5"
                      value={params.guidance}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          guidance: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  {/* LoRA Strength */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      LoRA Strength: {params.loraStrength}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={params.loraStrength}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          loraStrength: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Downsampling Factor */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Downsampling Factor: {params.downsamplingFactor}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="0.5"
                      value={params.downsamplingFactor}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          downsamplingFactor: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Downsampling Function */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Downsampling Function
                    </label>
                    <select
                      value={params.downsamplingFunction}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          downsamplingFunction: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {DOWNSAMPLING_FUNCTIONS.map((func) => (
                        <option key={func} value={func}>
                          {func}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Autocrop Margin */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Autocrop Margin: {params.autocropMargin}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.5"
                      step="0.05"
                      value={params.autocropMargin}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          autocropMargin: parseFloat(e.target.value),
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
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
              <button
                onClick={handleGenerate}
                disabled={
                  isGenerating ||
                  !params.prompt.trim() ||
                  !referenceImage ||
                  uploadingImage
                }
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Applying Style Transfer...</span>
                  </>
                ) : uploadingImage ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Uploading Image...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    <span>Apply Style Transfer</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="space-y-6">
            {/* Image Statistics */}
            {imageStats && (
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center">
                  <ImageIcon className="w-5 h-5 mr-2 text-green-600" />
                  Your Image Library
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                    <div className="text-slate-600 dark:text-slate-400 text-xs mb-1">
                      Total Images
                    </div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                      {imageStats.totalImages}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                    <div className="text-slate-600 dark:text-slate-400 text-xs mb-1">
                      Storage Used
                    </div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                      {Math.round((imageStats.totalSize / 1024 / 1024) * 100) /
                        100}{" "}
                      MB
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Current Generation */}
            {currentJob && (
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center">
                    <Wand2 className="w-5 h-5 mr-2 text-purple-600" />
                    Generation Status
                  </h3>
                  {currentJob.status === "completed" && (
                    <button
                      onClick={() => fetchJobImages(currentJob.id)}
                      className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                      title="Refresh generated images"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  {/* Reset button for stuck jobs */}
                  {(currentJob.status === "processing" || currentJob.status === "pending") && !isGenerating && (
                    <button
                      onClick={resetStuckJob}
                      className="p-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Reset stuck job state"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Status
                    </span>
                    <div className="flex items-center space-x-2">
                      {(currentJob.status === "pending" ||
                        currentJob.status === "processing") && (
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      )}
                      {currentJob.status === "completed" && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                      {currentJob.status === "failed" && !isJobCancelled(currentJob) && (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      {currentJob.status === "failed" && isJobCancelled(currentJob) && (
                        <XCircle className="w-4 h-4 text-orange-600" />
                      )}
                      <span className="text-sm font-semibold capitalize text-slate-900 dark:text-white">
                        {currentJob.status === "failed" && isJobCancelled(currentJob)
                          ? "cancelled"
                          : currentJob.status}
                      </span>
                    </div>
                  </div>

                  {(currentJob.progress !== undefined || progressData.progress > 0) && 
                   !isJobCancelled(currentJob) && (
                    <div className="space-y-4">
                      {/* Enhanced Progress Display */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Progress
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {Math.round(progressData.progress || currentJob.progress || 0)}%
                          </span>
                          {progressData.estimatedTimeRemaining && 
                           Number(progressData.estimatedTimeRemaining) > 0 && 
                           Math.round(Number(progressData.estimatedTimeRemaining)) > 0 && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              ({Math.round(Number(progressData.estimatedTimeRemaining))}s left)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-purple-600 to-pink-600 h-full rounded-full transition-all duration-300 relative"
                          style={{ width: `${Math.round(progressData.progress || currentJob.progress || 0)}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                      </div>

                      {/* Stage and Message Display */}
                      {(progressData.stage || progressData.message) && (
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                          {progressData.stage && (
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                {progressData.stage.replace(/_/g, ' ')}
                              </span>
                            </div>
                          )}
                          {progressData.message && (
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {progressData.message}
                            </p>
                          )}

                          {/* Batch Progress Indicator for Style Transfer */}
                          {progressData.totalImages && progressData.totalImages > 1 && (
                            <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300 mb-2">
                              <span className="flex items-center space-x-2">
                                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                                <span>
                                  Style Transfer Image {progressData.imageCount || 0} of {progressData.totalImages}
                                </span>
                              </span>
                              <span className="text-xs font-medium bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-full">
                                Batch Generation
                              </span>
                            </div>
                          )}

                          {/* Individual Image Progress Bar for Batch Style Transfer */}
                          {progressData.totalImages && progressData.totalImages > 1 && (
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                                <span>Images Completed</span>
                                <span>{progressData.imageCount || 0} / {progressData.totalImages}</span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                <div
                                  className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                                  style={{
                                    width: `${((progressData.imageCount || 0) / (progressData.totalImages || 1)) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          {progressData.elapsedTime && Number(progressData.elapsedTime) > 0 && (
                            <div className="flex items-center justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
                              <span>Elapsed: {Math.round(Number(progressData.elapsedTime))}s</span>
                              {progressData.estimatedTimeRemaining && 
                               Number(progressData.estimatedTimeRemaining) > 0 && 
                               Math.round(Number(progressData.estimatedTimeRemaining)) > 0 && (
                                <span>Remaining: ~{Math.round(Number(progressData.estimatedTimeRemaining))}s</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show completion status with refresh option */}
                  {(currentJob.status === "completed" || currentJob.status === "failed") && (
                    <div className="mb-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {currentJob.status === "completed" ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span className="text-sm font-medium">
                            {currentJob.status === "completed"
                              ? "Style transfer completed"
                              : "Style transfer failed"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={async () => {
                              setRefreshingImages(true);
                              try {
                                await fetchImageStats();
                                await fetchJobImages(currentJob.id);
                                
                                // Also trigger auto-processing
                                try {
                                  const autoProcessResponse = await apiClient.post("/api/jobs/auto-process-serverless");
                                  if (autoProcessResponse.ok) {
                                    setTimeout(() => {
                                      fetchJobImages(currentJob.id);
                                    }, 2000);
                                  }
                                } catch (error) {
                                  console.error("Auto-processing failed:", error);
                                }
                              } catch (error) {
                                console.error("Refresh failed:", error);
                              } finally {
                                setRefreshingImages(false);
                              }
                            }}
                            disabled={refreshingImages}
                            className="px-3 py-1 text-xs bg-purple-500 hover:bg-purple-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                          >
                            {refreshingImages ? (
                              <>
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                Refreshing...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="mr-1 h-3 w-3" />
                                Refresh
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Show loading or no images message for completed jobs */}
                  {!isJobCancelled(currentJob) && currentJob.status === "completed" &&
                    (!currentJob.resultUrls ||
                      currentJob.resultUrls.length === 0) &&
                    (!jobImages[currentJob.id] ||
                      jobImages[currentJob.id].length === 0) && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Generated Images
                        </h4>
                        <div className="text-center py-8">
                          <div className="flex items-center justify-center space-x-2 text-gray-500 dark:text-gray-400 mb-3">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span className="text-sm">
                              Loading generated images...
                            </span>
                          </div>
                          <button
                            onClick={() => fetchJobImages(currentJob.id)}
                            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm"
                          >
                            Refresh Images
                          </button>
                        </div>
                      </div>
                    )}

                  {/* Enhanced image display with dynamic URL support - matching text-to-image format */}
                  {!isJobCancelled(currentJob) && ((currentJob.resultUrls &&
                    currentJob.resultUrls.length > 0) ||
                    (jobImages[currentJob.id] &&
                      jobImages[currentJob.id].length > 0)) && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Generated Images
                        </h4>
                        <div className="flex items-center space-x-2">
                          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                            {jobImages[currentJob.id] && jobImages[currentJob.id].length > 0 
                              ? `${jobImages[currentJob.id].length} image${jobImages[currentJob.id].length > 1 ? 's' : ''}`
                              : currentJob.resultUrls && currentJob.resultUrls.length > 0
                              ? `${currentJob.resultUrls.length} image${currentJob.resultUrls.length > 1 ? 's' : ''}`
                              : '0 images'
                            }
                          </div>
                          <button
                            onClick={async () => {
                              console.log('🔄 Manual refresh: Fetching latest images for job:', currentJob.id);
                              setRefreshingImages(true);
                              try {
                                await fetchJobImages(currentJob.id);
                              } finally {
                                setRefreshingImages(false);
                              }
                            }}
                            disabled={refreshingImages}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-medium transition-colors flex items-center space-x-1"
                            title="Refresh images"
                          >
                            <RefreshCw className={`w-3 h-3 ${refreshingImages ? 'animate-spin' : ''}`} />
                            <span>{refreshingImages ? 'Refreshing...' : 'Refresh'}</span>
                          </button>
                        </div>
                      </div>

                      <div className={`grid gap-3 ${
                        // Dynamic grid based on number of images
                        jobImages[currentJob.id] && jobImages[currentJob.id].length > 0 
                          ? jobImages[currentJob.id].length === 1 
                            ? 'grid-cols-1' 
                            : jobImages[currentJob.id].length === 2 
                            ? 'grid-cols-2' 
                            : jobImages[currentJob.id].length <= 4 
                            ? 'grid-cols-2' 
                            : 'grid-cols-3'
                          : currentJob.resultUrls && currentJob.resultUrls.length > 0
                          ? currentJob.resultUrls.length === 1 
                            ? 'grid-cols-1' 
                            : currentJob.resultUrls.length === 2 
                            ? 'grid-cols-2' 
                            : currentJob.resultUrls.length <= 4 
                            ? 'grid-cols-2' 
                            : 'grid-cols-3'
                          : 'grid-cols-1'
                      }`}>
                        {/* Show database images if available */}
                        {jobImages[currentJob.id] &&
                        jobImages[currentJob.id].length > 0 ? (
                          // Database images with dynamic URLs - show all images, including those being processed
                          jobImages[currentJob.id]
                            .map((dbImage, index) => (
                              <div
                                key={`db-${dbImage.id}`}
                                className="relative group"
                              >
                                {(dbImage.awsS3Key || dbImage.awsS3Url) || dbImage.dataUrl ? (
                                  // Image is ready to display
                                  <>
                                    <img
                                      src={getOptimizedImageUrl(dbImage)}
                                      alt={`Style transfer result ${index + 1}`}
                                      className="w-full h-auto rounded-lg shadow-md hover:shadow-lg transition-shadow object-cover"
                                      onError={(e) => {
                                        console.warn(
                                          "⚠️ Image failed to load:",
                                          dbImage.filename
                                        );

                                        const currentSrc = (e.target as HTMLImageElement).src;
                                        
                                        // Try fallback URLs in order: AWS S3 -> Database -> Placeholder
                                        if (dbImage.awsS3Key && !currentSrc.includes(dbImage.awsS3Key)) {
                                          console.log("Trying AWS S3 URL for:", dbImage.filename);
                                          (e.target as HTMLImageElement).src = `https://tastycreative.s3.amazonaws.com/${dbImage.awsS3Key}`;
                                        } else if (dbImage.awsS3Url && currentSrc !== dbImage.awsS3Url) {
                                          console.log("Trying direct AWS S3 URL for:", dbImage.filename);
                                          (e.target as HTMLImageElement).src = dbImage.awsS3Url;
                                        } else if (dbImage.dataUrl && !currentSrc.includes('/api/images/')) {
                                          console.log("Falling back to database URL for:", dbImage.filename);
                                          (e.target as HTMLImageElement).src = dbImage.dataUrl;
                                        } else {
                                          console.log("Switching to placeholder for:", dbImage.filename);
                                          (e.target as HTMLImageElement).src = "/api/placeholder-image";
                                        }
                                      }}
                                    />
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <div className="flex space-x-1">
                                        <button
                                          onClick={() =>
                                            downloadDatabaseImage(dbImage)
                                          }
                                          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
                                          title={`Download ${dbImage.filename} (${
                                            dbImage.fileSize
                                              ? `${Math.round(
                                                  dbImage.fileSize / 1024
                                                )}KB`
                                              : "Unknown size"
                                          })`}
                                        >
                                          <Download className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => shareImage(dbImage)}
                                          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
                                        >
                                          <Share2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Image metadata */}
                                    <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <div className="bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                                        {dbImage.width && dbImage.height
                                          ? `${dbImage.width}×${dbImage.height}`
                                          : "Unknown size"}
                                        {dbImage.fileSize &&
                                          ` • ${Math.round(
                                            dbImage.fileSize / 1024
                                          )}KB`}
                                        {dbImage.format &&
                                          ` • ${dbImage.format.toUpperCase()}`}
                                      </div>
                                    </div>
                                    
                                    {/* Image number indicator */}
                                    <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                                      {index + 1}
                                    </div>
                                  </>
                                ) : (
                                  // Image is still being processed
                                  <div className="w-full aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg flex flex-col items-center justify-center">
                                    <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center px-2">
                                      Image {index + 1}<br />
                                      Processing...
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))
                        ) : // Check if there are images without data (still processing)
                        jobImages[currentJob.id] &&
                          jobImages[currentJob.id].length > 0 &&
                          jobImages[currentJob.id].some((img) => !img.dataUrl) ? (
                          <div className="text-center py-8">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full mb-4">
                              <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 mb-2">
                              Style transfer images are being processed...
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-500">
                              {
                                jobImages[currentJob.id].filter(
                                  (img) => !img.dataUrl
                                ).length
                              }{" "}
                              image(s) saving to database
                            </p>
                            <button
                              onClick={() =>
                                currentJob.id && fetchJobImages(currentJob.id)
                              }
                              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
                            >
                              Check Again
                            </button>
                          </div>
                        ) : (
                          // Fallback to legacy URLs if no database images
                          currentJob.resultUrls &&
                          currentJob.resultUrls.length > 0 &&
                          currentJob.resultUrls.map((url, index) => (
                            <div
                              key={`legacy-${currentJob.id}-${index}`}
                              className="relative group"
                            >
                              <img
                                src={url}
                                alt={`Style transfer result ${index + 1}`}
                                className="w-full h-auto rounded-lg shadow-md hover:shadow-lg transition-shadow object-cover"
                                onError={(e) => {
                                  console.error("Legacy image load error:", url);
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() =>
                                      downloadFromUrl(
                                        url,
                                        `style-transfer-${index + 1}.png`
                                      )
                                    }
                                    className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(url);
                                      alert("Image URL copied to clipboard!");
                                    }}
                                    className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              
                              {/* Image number indicator for legacy images */}
                              <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                                {index + 1}
                              </div>
                            </div>
                          ))
                        )}
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

                  {/* Cancel Button */}
                  {isGenerating && (currentJob.status === "pending" || currentJob.status === "processing") && (
                    <button
                      onClick={cancelGeneration}
                      className="w-full py-3 px-6 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center space-x-2 mt-4"
                    >
                      <XCircle className="w-5 h-5" />
                      <span>Cancel Style Transfer</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Generation History */}
            {jobHistory.length > 0 && (
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                  Recent Style Transfers
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {jobHistory
                    .filter((job) => job && job.id)
                    .slice(0, 5) // Show only 5 most recent jobs
                    .map((job, index) => (
                      <div
                        key={job.id || `job-${index}`}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          {job.status === "completed" && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                          {job.status === "failed" && !isJobCancelled(job) && (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                          {job.status === "failed" && isJobCancelled(job) && (
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
                              {job.status === "failed" && isJobCancelled(job)
                                ? "cancelled"
                                : job.status || "unknown"}
                            </p>
                          </div>
                        </div>
                        {job.resultUrls && job.resultUrls.length > 0 && (
                          <div className="flex space-x-1">
                            <button
                              onClick={() => fetchJobImages(job.id)}
                              className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                              title="Refresh images"
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
