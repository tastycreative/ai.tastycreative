// app/(dashboard)/workspace/generate-content/text-to-image/page.tsx - COMPLETE WITH DYNAMIC URLS
"use client";

import { useState, useEffect, useRef } from "react";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import { getBestImageUrl, hasS3Storage, buildDirectS3Url } from "@/lib/s3Utils";
import Link from "next/link";
import {
  ImageIcon,
  Wand2,
  Settings,
  Download,
  Share2,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Sparkles,
  Sliders,
  Copy,
  RefreshCw,
  RotateCcw,
  ExternalLink,
  Monitor,
  ChevronDown,
  X,
  Plus,
  Archive,
} from "lucide-react";

// Types
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



interface LoRAConfig {
  id: string;
  modelName: string;
  strength: number;
}

interface GenerationParams {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  batchSize: number;
  steps: number;
  cfg: number;
  samplerName: string;
  scheduler: string;
  guidance: number;
  loras: LoRAConfig[]; // Support multiple LoRAs
  seed: number | null;
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
  id: string;
  fileSize: number;
  uploadedAt: string;
  usageCount: number;
  networkVolumePath: string | null;
  originalFileName?: string;
  comfyUIPath?: string;
}

// Updated DatabaseImage interface for dynamic URLs
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
  s3Key?: string; // Legacy S3 key for network volume storage
  networkVolumePath?: string; // Path on network volume
  awsS3Key?: string; // AWS S3 key for direct storage
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

export default function TextToImagePage() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();

  const [params, setParams] = useState<GenerationParams>({
    prompt: "",
    negativePrompt: "",
    width: 832,
    height: 1216,
    batchSize: 1,
    steps: 40,
    cfg: 1,
    samplerName: "euler",
    scheduler: "beta",
    guidance: 4,
    loras: [], // Start with no LoRAs
    seed: null,
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
  const [error, setError] = useState<string | null>(null);
  const [availableLoRAs, setAvailableLoRAs] = useState<LoRAModel[]>([
    {
      fileName: "None",
      displayName: "No LoRA (Base Model)",
      name: "none",
      id: "none",
      fileSize: 0,
      uploadedAt: new Date().toISOString(),
      usageCount: 0,
      networkVolumePath: null,
    },
  ]);
  const [loadingLoRAs, setLoadingLoRAs] = useState(true);

  // Database image states with caching
  const [jobImages, setJobImages] = useState<Record<string, DatabaseImage[]>>(
    {}
  );
  const [imageStats, setImageStats] = useState<any>(null);
  const [refreshingImages, setRefreshingImages] = useState(false);
  const [lastImageFetch, setLastImageFetch] = useState<Record<string, number>>({});
  const fetchingImagesRef = useRef<Set<string>>(new Set()); // Track which jobs are currently being fetched

  // Folder selection states (vault-only)
  const [targetFolder, setTargetFolder] = useState<string>("");

  // Vault Integration State
  const [vaultProfiles, setVaultProfiles] = useState<InstagramProfile[]>([]);
  const [vaultFoldersByProfile, setVaultFoldersByProfile] = useState<Record<string, VaultFolder[]>>({});
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);

  // Persistent generation state keys
  const STORAGE_KEYS = {
    currentJob: 'text-to-image-current-job',
    isGenerating: 'text-to-image-is-generating',
    progressData: 'text-to-image-progress-data',
    jobHistory: 'text-to-image-job-history',
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
              console.log('📚 Loaded text-to-image job history:', history.length, 'jobs');
            }
          } catch (error) {
            console.error('Error parsing saved job history:', error);
            localStorage.removeItem(STORAGE_KEYS.jobHistory);
          }
        }

        if (savedCurrentJob) {
          const job = JSON.parse(savedCurrentJob);
          setCurrentJob(job);
          
          // Only resume polling if the job is still pending/processing AND generating state is true
          if (savedIsGenerating === 'true' && (job.status === 'pending' || job.status === 'processing')) {
            setIsGenerating(true);
            
            if (savedProgressData) {
              setProgressData(JSON.parse(savedProgressData));
            }
            
            // Resume polling for this job with a delay to ensure pollJobStatus is defined
            console.log('🔄 Resuming generation monitoring for job:', job.id);
            setTimeout(() => {
              pollJobStatus(job.id);
            }, 100);
          } else if (job.status === 'completed') {
            // For completed jobs, just load the images without polling
            console.log('✅ Loading completed job images:', job.id);
            // Only fetch if not already fetching
            if (!fetchingImagesRef.current.has(job.id)) {
              fetchingImagesRef.current.add(job.id);
              fetchJobImages(job.id).finally(() => {
                fetchingImagesRef.current.delete(job.id);
              });
            }
          }
        }
      } catch (error) {
        console.error('Error loading persistent state:', error);
        // Clear corrupted data
        clearPersistentState();
      }
    }
  }, [apiClient]); // Add apiClient as dependency

  // Clear persistent state helper
  // Clear persistent state helper
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

  // Helper function to determine if a failed job was actually cancelled
  const isJobCancelled = (job: GenerationJob) => {
    return job.status === 'failed' && job.error === 'Job canceled by user';
  };

  // Helper function to get display status and icon
  const getJobStatusDisplay = (job: GenerationJob) => {
    if (isJobCancelled(job)) {
      return {
        status: 'cancelled',
        icon: 'cancelled' as const,
        color: 'text-orange-500'
      };
    }
    
    return {
      status: job.status,
      icon: job.status,
      color: job.status === 'failed' ? 'text-red-500' : 
             job.status === 'completed' ? 'text-green-500' : 
             'text-blue-500'
    };
  };

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (currentJob && (currentJob.status === 'pending' || currentJob.status === 'processing')) {
        // Only save jobs that are still in progress
        localStorage.setItem(STORAGE_KEYS.currentJob, JSON.stringify(currentJob));
      } else {
        // Remove completed or failed jobs from persistent storage
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
          message: progressData.message || 'Text-to-image generation in progress...',
          generationType: 'text-to-image',
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
          message: progressData.message || 'Text-to-image generation in progress...',
          generationType: 'text-to-image',
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
        console.log('💾 Saved text-to-image job history:', validHistory.length, 'jobs');
      }
    }
  }, [jobHistory]);

  // Update browser tab title and favicon for cross-tab generation progress indication
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const originalTitle = 'Text to Image - AI Creative Studio';
      
      if (isGenerating && currentJob) {
        // Update document title with progress
        const progress = Math.round(progressData.progress || 0);
        const stage = progressData.stage || 'generating';
        
        let progressIcon = '🎨';
        if (stage === 'starting') progressIcon = '🚀';
        else if (stage === 'loading_models') progressIcon = '📦';
        else if (stage === 'processing_prompt') progressIcon = '📝';
        else if (stage === 'generating') progressIcon = '🎨';
        else if (stage === 'saving') progressIcon = '💾';
        else if (stage === 'completed') progressIcon = '✅';
        else if (stage === 'failed') progressIcon = '❌';
        
        const titleWithProgress = `${progressIcon} ${progress}% - Generating Image | AI Creative Studio`;
        document.title = titleWithProgress;
        
        // Create and update dynamic favicon with progress indicator
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 32;
        canvas.height = 32;
        
        if (ctx) {
          // Draw background circle
          ctx.fillStyle = '#3B82F6'; // Blue background
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
        
        // Reset favicon to default (you might want to set this to your actual favicon)
        const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (favicon) {
          favicon.href = '/favicon.ico'; // Update this to your actual favicon path
        }
      }
    }
    
    // Cleanup function to reset title when component unmounts
    return () => {
      if (typeof window !== 'undefined') {
        document.title = 'Text to Image - AI Creative Studio';
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
        const notification = new Notification('🎨 Image Generation Complete!', {
          body: 'Your AI-generated image is ready to view.',
          icon: '/favicon.ico', // Update to your favicon path
          badge: '/favicon.ico',
          tag: 'generation-complete',
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

  // Load vault profiles and their folders
  useEffect(() => {
    const loadVaultData = async () => {
      if (!apiClient) return;

      setIsLoadingVaultData(true);
      try {
        // First, load all Instagram profiles
        const profilesResponse = await fetch('/api/instagram/profiles');
        if (!profilesResponse.ok) {
          throw new Error('Failed to load profiles');
        }

        const profilesData = await profilesResponse.json();
        const profileList: InstagramProfile[] = Array.isArray(profilesData)
          ? profilesData
          : profilesData.profiles || [];

        // Sort profiles alphabetically
        const sortedProfiles = [...profileList].sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
        );

        setVaultProfiles(sortedProfiles);

        // Now load vault folders for each profile
        const foldersByProfile: Record<string, VaultFolder[]> = {};

        await Promise.all(
          sortedProfiles.map(async (profile) => {
            try {
              const foldersResponse = await fetch(`/api/vault/folders?profileId=${profile.id}`);
              if (foldersResponse.ok) {
                const folders = await foldersResponse.json();
                foldersByProfile[profile.id] = folders;
              }
            } catch (error) {
              console.error(`Failed to load folders for profile ${profile.id}:`, error);
              foldersByProfile[profile.id] = [];
            }
          })
        );

        setVaultFoldersByProfile(foldersByProfile);
      } catch (error) {
        console.error('Failed to load vault data:', error);
      } finally {
        setIsLoadingVaultData(false);
      }
    };

    loadVaultData();
  }, [apiClient]);

  // Get display text for the selected vault folder
  const getSelectedFolderDisplay = (): string => {
    if (!targetFolder) return 'Select a vault folder to save your images';
    
    if (targetFolder.startsWith('vault:')) {
      const parts = targetFolder.replace('vault:', '').split(':');
      const profileId = parts[0];
      const folderId = parts[1];
      const profile = vaultProfiles.find(p => p.id === profileId);
      const folders = vaultFoldersByProfile[profileId] || [];
      const folder = folders.find(f => f.id === folderId);
      return `Saving to: ${profile?.name || 'Profile'} / ${folder?.name || 'Folder'}`;
    }
    
    return 'Select a vault folder';
  };

  // Auto-refresh for jobs - OPTIMIZED for AWS S3 direct URLs
  useEffect(() => {
    if (!apiClient || !currentJob) {
      return;
    }

    // Never auto-refresh for completed or failed jobs - they should be stable
    if (currentJob.status === 'completed' || currentJob.status === 'failed') {
      console.log('🛑 Auto-refresh: Job finished, no refresh needed');
      return;
    }

    // Only auto-refresh for actively processing jobs
    if (currentJob.status !== 'processing' && currentJob.status !== 'pending') {
      return;
    }

    console.log('🔄 Auto-refresh: Monitoring processing job...');

    const autoRefreshInterval = setInterval(() => {
      console.log('🔄 Auto-refresh: Job still processing, waiting for completion...');
      // Just log - actual status updates come from pollJobStatus
    }, 10000);

    return () => clearInterval(autoRefreshInterval);
  }, [apiClient, currentJob?.id, currentJob?.status]);

  // Watch for job status changes and immediately fetch images when completed
  useEffect(() => {
    if (currentJob && currentJob.status === 'completed' && !isGenerating) {
      // Check if we're already fetching images for this job
      if (fetchingImagesRef.current.has(currentJob.id)) {
        console.log('🔄 Already fetching images for job:', currentJob.id);
        return;
      }

      // Always check current state of jobImages, not closure
      const currentImages = jobImages[currentJob.id];
      const hasImages = currentImages && currentImages.length > 0;
      
      if (!hasImages) {
        console.log('🎯 Job completed, immediately fetching images...');
        
        // Mark as fetching
        fetchingImagesRef.current.add(currentJob.id);
        
        // Fetch immediately when job completes
        fetchJobImages(currentJob.id).finally(() => {
          // Remove from fetching set after completion
          fetchingImagesRef.current.delete(currentJob.id);
        });
        
        // Set up retries with a single setTimeout chain to avoid multiple parallel retries
        let retryCount = 0;
        const maxRetries = 5;
        const retryDelays = [1000, 2000, 5000, 10000, 15000]; // 1s, 2s, 5s, 10s, 15s
        
        const scheduleRetry = () => {
          if (retryCount < maxRetries) {
            setTimeout(async () => {
              // Check if images arrived
              const imgs = jobImages[currentJob.id];
              if (!imgs || imgs.length === 0) {
                console.log(`🔄 Retry ${retryCount + 1}/${maxRetries}: Still no images, fetching again...`);
                await fetchJobImages(currentJob.id, true); // Force refresh
                retryCount++;
                scheduleRetry(); // Schedule next retry
              } else {
                console.log('✅ Images found, stopping retries');
              }
            }, retryDelays[retryCount]);
          }
        };
        
        scheduleRetry();
      }
    }
  }, [currentJob?.status, currentJob?.id, isGenerating]);

  // Function to fetch images for a completed job with caching
  const fetchJobImages = async (jobId: string, forceRefresh: boolean = false): Promise<boolean> => {
    try {
      if (!apiClient) {
        console.error("API client is not available");
        return false;
      }

      // Check cache - don't fetch if we already fetched recently (within 10 seconds)
      const now = Date.now();
      const lastFetch = lastImageFetch[jobId] || 0;
      const cacheTimeout = 10000; // 10 seconds cache

      if (!forceRefresh && now - lastFetch < cacheTimeout && jobImages[jobId] && jobImages[jobId].length > 0) {
        console.log(`📦 Using cached images for job ${jobId} (${jobImages[jobId].length} images)`);
        return true;
      }

      console.log("🖼️ Fetching database images for job:", jobId, forceRefresh ? "(forced)" : "");

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
        // Update cache timestamp
        setLastImageFetch(prev => ({
          ...prev,
          [jobId]: now
        }));

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
          console.log("📸 Sample image:", {
            filename: data.images[0].filename,
            hasDataUrl: !!data.images[0].dataUrl,
            hasUrl: !!data.images[0].url,
            hasS3Key: !!data.images[0].s3Key,
            hasNetworkVolume: !!data.images[0].networkVolumePath,
            id: data.images[0].id,
          });
          
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
    if (!apiClient) {
      console.error("❌ API client not available for image stats");
      return;
    }

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
  const downloadDatabaseImage = async (image: DatabaseImage) => {
    if (!apiClient) {
      alert("API client not available");
      return;
    }

    try {
      console.log("📥 Downloading image:", image.filename);

      // Priority 1: Download from S3 network volume
      if (hasS3Storage(image)) {
        const s3Url = getBestImageUrl(image);
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

    // Priority 1: Share S3 URL (fastest and most reliable)
    if (hasS3Storage(image)) {
      urlToShare = getBestImageUrl(image);
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
  };

  // Helper function for legacy URL downloads
  const downloadFromUrl = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  };

  // Helper function to check S3 storage availability
  const hasS3Storage = (image: DatabaseImage): boolean => {
    return !!(image.s3Key || image.networkVolumePath || image.awsS3Key || image.awsS3Url);
  };

  // Fetch available LoRA models on component mount (includes owned + shared LoRAs)
  useEffect(() => {
    if (!apiClient) {
      console.log("⏳ API client not ready yet, skipping LoRA fetch");
      return;
    }

    const fetchLoRAModels = async () => {
      try {
        setLoadingLoRAs(true);
        console.log("=== FETCHING LORA MODELS (including shared) ===");

        // Use /api/user/influencers to get both owned and shared LoRAs
        const response = await apiClient.get("/api/user/influencers");
        console.log("LoRA API response status:", response.status);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("LoRA API response data:", data);

        // Backend returns array of influencers directly
        if (Array.isArray(data)) {
          console.log("🔍 Raw LoRA data from API:", data);
          
          // Transform influencer format to LoRAModel format
          // Use fileName directly - it already contains the correct path format
          const loraModels: LoRAModel[] = data.map((inf: any) => {
            console.log(`📁 LoRA mapping: ${inf.displayName}`, {
              isShared: inf.isShared,
              clerkId: inf.clerkId,
              fileName: inf.fileName,
            });
            
            return {
              fileName: inf.fileName,
              displayName: inf.isShared 
                ? `${inf.displayName} (Shared by ${inf.sharedBy})` 
                : inf.displayName,
              name: inf.name,
              id: inf.id,
              fileSize: inf.fileSize,
              uploadedAt: inf.uploadedAt,
              usageCount: inf.usageCount,
              networkVolumePath: inf.comfyUIPath || null,
              originalFileName: inf.originalFileName,
              comfyUIPath: inf.comfyUIPath,
            };
          });

          // Add "None" option at the beginning
          const allLoraModels = [
            {
              fileName: "None",
              displayName: "No LoRA (Base Model)",
              name: "none",
              id: "none",
              fileSize: 0,
              uploadedAt: new Date().toISOString(),
              usageCount: 0,
              networkVolumePath: null,
            },
            ...loraModels,
          ];

          console.log("Available LoRA models (owned + shared):", allLoraModels);
          setAvailableLoRAs(allLoraModels);

          // Migrate old single LoRA state to new multi-LoRA format if needed
          if (typeof window !== 'undefined') {
            const storedParams = localStorage.getItem('text-to-image-params');
            if (storedParams) {
              try {
                const parsed = JSON.parse(storedParams);
                // Check if old format (has selectedLora/loraStrength but no loras array)
                if ('selectedLora' in parsed && !('loras' in parsed)) {
                  const migratedLoras: LoRAConfig[] = [];
                  if (parsed.selectedLora && parsed.selectedLora !== 'None') {
                    migratedLoras.push({
                      id: `lora-${Date.now()}`,
                      modelName: parsed.selectedLora,
                      strength: parsed.loraStrength || 0.95,
                    });
                  }
                  setParams(prev => ({
                    ...prev,
                    loras: migratedLoras,
                  }));
                  console.log('✅ Migrated old LoRA format to new multi-LoRA format');
                }
              } catch (e) {
                console.error('Error migrating LoRA format:', e);
              }
            }
          }
        } else {
          console.error("Invalid LoRA API response:", data);
          setAvailableLoRAs([
            {
              fileName: "None",
              displayName: "No LoRA (Base Model)",
              name: "none",
              id: "none",
              fileSize: 0,
              uploadedAt: new Date().toISOString(),
              usageCount: 0,
              networkVolumePath: "",
            },
          ]);
        }
      } catch (error) {
        console.error("Error fetching LoRA models:", error);
        setAvailableLoRAs([
          {
            fileName: "None",
            displayName: "No LoRA (Base Model)",
            name: "none",
            id: "none",
            fileSize: 0,
            uploadedAt: new Date().toISOString(),
            usageCount: 0,
            networkVolumePath: "",
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

  // LoRA management functions
  const addLoRA = () => {
    const newLoRA: LoRAConfig = {
      id: `lora-${Date.now()}`,
      modelName: "None",
      strength: 0.95,
    };
    setParams((prev) => ({
      ...prev,
      loras: [...prev.loras, newLoRA],
    }));
  };

  const removeLoRA = (id: string) => {
    setParams((prev) => ({
      ...prev,
      loras: prev.loras.filter((lora) => lora.id !== id),
    }));
  };

  const updateLoRA = (id: string, updates: Partial<LoRAConfig>) => {
    setParams((prev) => ({
      ...prev,
      loras: prev.loras.map((lora) =>
        lora.id === id ? { ...lora, ...updates } : lora
      ),
    }));
  };

  // Submit generation
  const handleGenerate = async () => {
    if (!apiClient) {
      alert("API client not available - please try again");
      return;
    }

    if (!params.prompt.trim()) {
      alert("Please enter a prompt");
      return;
    }

    if (!targetFolder) {
      alert("Please select a folder to save your generated images");
      return;
    }

    setIsGenerating(true);
    setCurrentJob(null);
    
    // Clear any previous persistent state when starting new generation
    clearPersistentState();

    // Initialize progress tracking
    setProgressData({
      progress: 0,
      stage: "starting",
      message: "🚀 Initializing text-to-image generation...",
      elapsedTime: 0,
      estimatedTimeRemaining: 180, // 3 minutes initial estimate
      imageCount: 0,
      totalImages: params.batchSize, // Set expected batch size
    });

    try {
      console.log("=== STARTING GENERATION ===");
      console.log("🎯 Current form state:", {
        prompt: params.prompt,
        loras: params.loras,
        width: params.width,
        height: params.height,
        steps: params.steps,
        guidance: params.guidance,
      });

      // Verify form state before submission
      if (params.prompt !== "ohwx woman wearing a sexy red lingerie") {
        console.warn("⚠️ Prompt value may be incorrect:", params.prompt);
      }

      const workflow = createWorkflowJson(params, targetFolder);
      console.log("Created workflow for submission");

      // Build request payload
      const requestPayload: any = {
        workflow,
        params,
      };

      // Parse vault folder and add parameters
      if (targetFolder.startsWith('vault:')) {
        const parts = targetFolder.replace('vault:', '').split(':');
        const profileId = parts[0];
        const folderId = parts[1];
        requestPayload.saveToVault = true;
        requestPayload.vaultProfileId = profileId;
        requestPayload.vaultFolderId = folderId;
        console.log("🗂️ Saving to vault:", { profileId, folderId });
      }

      const response = await apiClient.post(
        "/api/generate/text-to-image-runpod",
        requestPayload
      );

      console.log("Generation API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Generation failed:", response.status, errorText);
        throw new Error(`Generation failed: ${response.status} - ${errorText}`);
      }

      const { jobId } = await response.json();
      console.log("Received job ID:", jobId);

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
      setJobHistory((prev) => [newJob, ...prev.filter(Boolean)].slice(0, 5)); // Limit to 5 jobs

      // Start polling for job status
      pollJobStatus(jobId);
    } catch (error) {
      console.error("Generation error:", error);
      setIsGenerating(false);
      alert(error instanceof Error ? error.message : "Generation failed");
    }
  };

  // Manual status refresh function for testing
  const refreshJobStatus = async (jobId: string) => {
    if (!apiClient) {
      console.error("❌ API client not available for status refresh");
      return;
    }

    try {
      console.log("🔄 Manually refreshing job status for:", jobId);

      // Try the manual RunPod status check endpoint
      const runpodResponse = await apiClient.get(
        `/api/jobs/${jobId}/status`
      );

      if (runpodResponse.ok) {
        const result = await runpodResponse.json();
        console.log("✅ Manual status refresh result:", result);

        // Refresh the regular job status
        const jobResponse = await apiClient.get(`/api/jobs/${jobId}`);
        if (jobResponse.ok) {
          const job = await jobResponse.json();

          // Handle date conversion safely
          if (job.createdAt && typeof job.createdAt === "string") {
            job.createdAt = new Date(job.createdAt);
          }

          setCurrentJob(job);
          console.log("🔄 Job status updated:", job.status);

          // If job is completed, fetch the generated images
          if (job.status === "completed") {
            await fetchJobImages(jobId);
            await fetchImageStats();
          }
        }
      } else {
        const errorText = await runpodResponse.text();
        console.error(
          "Manual refresh failed:",
          runpodResponse.status,
          errorText
        );
      }
    } catch (error) {
      console.error("Error during manual status refresh:", error);
    }
  };

  // Manual image download and save function for when URLs fail
  const forceDownloadAndSaveImages = async (jobId: string) => {
    if (!apiClient) {
      console.error("❌ API client not available for image download");
      return false;
    }

    try {
      console.log("🔧 Force downloading and saving images for job:", jobId);

      // Call a special endpoint to force download and save images
      const response = await apiClient.post(
        `/api/jobs/${jobId}/force-save-images`
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Force download result:", result);

        // Refresh job images after successful download
        setTimeout(() => {
          fetchJobImages(jobId);
        }, 2000);

        return true;
      } else {
        const errorText = await response.text();
        console.error("Force download failed:", response.status, errorText);
        return false;
      }
    } catch (error) {
      console.error("Error during force image download:", error);
      return false;
    }
  };

  // Updated poll job status with database image fetching and gallery refresh notification
  const pollJobStatus = async (jobId: string) => {
    if (!apiClient) {
      console.error("❌ API client not available for job polling");
      setIsGenerating(false);
      return;
    }

    console.log("=== STARTING JOB POLLING ===");
    console.log("Polling job ID:", jobId);

    const maxAttempts = 600; // 10 minutes (increased for image-to-video and complex generations)
    let attempts = 0;

    const poll = async () => {
      try {
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
              if (attempts < 10) {
                // Retry a few times for new jobs
                setTimeout(poll, 2000); // Reduced polling for better bandwidth usage
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

        // Handle chunked image uploads for batch generations
        if (job.status === "IMAGE_READY" && job.image) {
          console.log(`📸 Received chunked image ${job.imageCount || 1} of ${job.totalImages || 1}`);
          
          // Update progress with individual image info
          setProgressData({
            progress: job.progress || 0,
            stage: job.stage || "uploading_images",
            message: job.message || `📸 Image ${job.imageCount || 1} ready`,
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
              console.log(`✅ Saved chunked image ${job.imageCount}: ${job.image.filename}`);
              
              // Refresh job images to show the new image immediately
              await fetchJobImages(jobId);
            } else {
              console.error(`❌ Failed to save chunked image ${job.imageCount}:`, await saveResponse.text());
            }
          } catch (saveError) {
            console.error(`❌ Error saving chunked image ${job.imageCount}:`, saveError);
          }

          // Continue polling for more images or completion
          setTimeout(poll, 2000);
          return;
        }

        // Update progress tracking state
        if (job.status === "processing") {
          setProgressData({
            progress: job.progress || 0,
            stage: job.stage || "",
            message: job.message || "Processing...",
            elapsedTime: job.elapsedTime,
            estimatedTimeRemaining: job.estimatedTimeRemaining,
          });
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
            .slice(0, 5) // Limit to 5 jobs
        );

        if (job.status === "completed") {
          console.log("Job completed successfully!");
          setIsGenerating(false);
          
          // Clear persistent state when generation completes
          clearPersistentState();

          // Reset progress tracking
          setProgressData({
            progress: 100,
            stage: "completed",
            message: "✅ Text-to-image generation completed successfully!",
            elapsedTime: progressData.elapsedTime,
            estimatedTimeRemaining: 0,
          });

          // Fetch database images for completed job with AWS S3 optimized retry
          console.log("🔄 Attempting to fetch job images immediately...");
          
          // First, trigger auto-processing to ensure serverless jobs are processed
          try {
            console.log("🔄 Pre-triggering auto-processing for serverless jobs...");
            const autoProcessResponse = await apiClient.post("/api/jobs/auto-process-serverless");
            if (autoProcessResponse.ok) {
              console.log("✅ Pre-processing triggered successfully");
              // Wait briefly for processing
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (error) {
            console.error("❌ Pre-processing failed:", error);
          }
          
          const fetchSuccess = await fetchJobImages(jobId);

          // For AWS S3, we only need minimal retries since URLs are direct
          if (!fetchSuccess) {
            console.log("🔄 First fetch failed, trying limited retries for AWS S3...");
            
            // Reduced retry attempts with longer intervals for AWS S3
            const retryDelays = [2000, 5000]; // Only 2 retries: 2s, 5s
            
            for (let i = 0; i < retryDelays.length; i++) {
              await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
              console.log(`🔄 Retry attempt ${i + 1} after ${retryDelays[i]}ms delay...`);
              
              const retrySuccess = await fetchJobImages(jobId);
              if (retrySuccess) {
                console.log(`✅ Images fetched successfully on retry ${i + 1}`);
                break;
              }
              
              if (i === retryDelays.length - 1) {
                console.warn("⚠️ Limited retries failed - AWS S3 data may still be syncing...");
                
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
            "✅ Generation completed! Images should appear automatically in the gallery and below."
          );

          return;
        } else if (job.status === "failed") {
          console.log("Job failed:", job.error);
          setIsGenerating(false);
          
          // Clear persistent state when generation fails
          clearPersistentState();

          const wasCancelled = isJobCancelled(job);
          const statusText = wasCancelled ? "cancelled" : "failed";
          const emoji = wasCancelled ? "🛑" : "❌";

          // Reset progress tracking to show failure/cancellation
          setProgressData({
            progress: 0,
            stage: statusText,
            message: `${emoji} Generation ${statusText}: ${job.error || "Unknown error"}`,
            elapsedTime: progressData.elapsedTime,
            estimatedTimeRemaining: 0,
          });

          // Only show alert for actual failures, not user cancellations
          // (user cancellations are handled by the cancel function itself)
          if (!wasCancelled) {
            alert(`${emoji} Generation ${statusText}: ${job.error || "Unknown error"}`);
          }
          return;
        }

        // Continue polling
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        } else {
          console.warn("Polling timeout reached - job may still be running");
          setIsGenerating(false);
          
          // Clear persistent state on timeout (but don't mark job as failed)
          clearPersistentState();

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
        console.error("Polling error:", error);

        if (attempts < maxAttempts) {
          setTimeout(poll, 2000); // Reduced retry interval
        } else {
          console.warn("Polling timeout reached after errors");
          setIsGenerating(false);
          
          // Clear persistent state on error timeout
          clearPersistentState();

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

    // Start polling after a short delay
    setTimeout(poll, 3000);
  };

  // Create workflow JSON
  const createWorkflowJson = (params: GenerationParams, targetFolder?: string) => {
    // Always generate a truly random seed to prevent caching issues
    const seed = params.seed || Math.floor(Math.random() * 2147483647);
    console.log(`🎲 Using seed: ${seed}`);

    // Build filename prefix (vault folders handled by backend)
    const filenamePrefix = `TextToImage_${Date.now()}_${seed}`;

    // Check if we have any LoRAs to apply
    const activeLoRAs = params.loras.filter(lora => lora.modelName !== "None");
    const useLoRA = activeLoRAs.length > 0;

    const workflow: any = {
      "1": {
        inputs: {
          width: params.width,
          height: params.height,
          batch_size: params.batchSize,
        },
        class_type: "EmptyLatentImage",
      },
      "2": {
        inputs: {
          text: params.prompt,
          clip: ["5", 0],
        },
        class_type: "CLIPTextEncode",
      },
      "3": {
        inputs: {
          samples: ["12", 0],
          vae: ["4", 0],
        },
        class_type: "VAEDecode",
      },
      "4": {
        inputs: {
          vae_name: "ae.safetensors",
        },
        class_type: "VAELoader",
      },
      "5": {
        inputs: {
          clip_name1: "t5xxl_fp16.safetensors",
          clip_name2: "clip_l.safetensors",
          type: "flux",
        },
        class_type: "DualCLIPLoader",
      },
      "6": {
        inputs: {
          unet_name: "flux1-dev.safetensors",
          weight_dtype: "fp8_e4m3fn",
        },
        class_type: "UNETLoader",
      },
      "7": {
        inputs: {
          conditioning: ["2", 0],
          guidance: params.guidance,
        },
        class_type: "FluxGuidance",
      },
      "9": {
        inputs: {
          model: useLoRA ? [`${14 + activeLoRAs.length - 1}`, 0] : ["6", 0],
          max_shift: 1.15,
          base_shift: 0.3,
          width: params.width,
          height: params.height,
        },
        class_type: "ModelSamplingFlux",
      },
      "10": {
        inputs: {
          conditioning: ["2", 0],
        },
        class_type: "ConditioningZeroOut",
      },
      "12": {
        inputs: {
          seed: seed,
          steps: params.steps,
          cfg: params.cfg,
          sampler_name: params.samplerName,
          scheduler: params.scheduler,
          denoise: 1,
          model: ["9", 0],
          positive: ["7", 0],
          negative: ["10", 0],
          latent_image: ["1", 0],
        },
        class_type: "KSampler",
      },
      "13": {
        inputs: {
          filename_prefix: filenamePrefix,
          images: ["3", 0],
        },
        class_type: "SaveImage",
      },
    };

    // Chain multiple LoRA loaders (similar to rgthree Power LoRA Loader)
    if (useLoRA) {
      console.log(`🎯 Loading ${activeLoRAs.length} LoRA(s)`);
      
      activeLoRAs.forEach((lora, index) => {
        const nodeId = `${14 + index}`;
        const previousNodeId = index === 0 ? "6" : `${14 + index - 1}`;
        
        // Use modelName directly - it already has the correct format from the API
        // For owned LoRAs: "user_xxx/filename.safetensors"
        // For shared LoRAs: "user_owner/filename.safetensors"
        const loraPath = lora.modelName;
        
        console.log(`🎯 LoRA ${index + 1}: ${loraPath} (strength: ${lora.strength})`);
        
        workflow[nodeId] = {
          inputs: {
            model: [previousNodeId, 0],
            lora_name: loraPath,
            strength_model: lora.strength,
          },
          class_type: "LoraLoaderModelOnly",
        };
        
        console.log(
          `🎯 LoRA workflow node ${nodeId}:`,
          JSON.stringify(workflow[nodeId], null, 2)
        );
      });
    }

    // Final workflow debugging
    console.log("🔍 === FINAL WORKFLOW DEBUG ===");
    console.log(`🎲 Seed: ${seed}`);
    console.log(`🎭 Prompt: ${params.prompt}`);
    console.log(`🖼️ Filename prefix: ComfyUI_${Date.now()}_${seed}`);
    if (useLoRA) {
      console.log(`🎯 Total LoRAs being used: ${activeLoRAs.length}`);
      activeLoRAs.forEach((lora, index) => {
        console.log(`   LoRA ${index + 1}: ${lora.modelName} @ ${lora.strength} strength`);
      });
    } else {
      console.log(`🚫 No LoRA selected`);
    }
    console.log("🔍 === END WORKFLOW DEBUG ===");

    return workflow;
  };

  // Manual job check
  const manualJobCheck = async () => {
    if (!apiClient) {
      alert("API client not available");
      return;
    }

    if (!currentJob?.id) {
      alert("No current job to check");
      return;
    }

    try {
      console.log("=== MANUAL JOB CHECK ===");
      console.log("Checking job:", currentJob.id);

      const response = await apiClient.get(`/api/jobs/${currentJob.id}`);
      console.log("Manual check response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Manual check failed:", errorText);
        alert(`Job check failed: ${response.status} - ${errorText}`);
        return;
      }

      const job = await response.json();
      console.log("Manual check result:", job);

      // Handle date conversion
      if (job.createdAt && typeof job.createdAt === "string") {
        job.createdAt = new Date(job.createdAt);
      }

      setCurrentJob(job);
      setJobHistory((prev) =>
        prev.map((j) => (j?.id === currentJob.id ? job : j)).filter(Boolean).slice(0, 5) // Limit to 5 jobs
      );

      alert(`Job Status: ${job.status}\nProgress: ${job.progress || 0}%`);
    } catch (error) {
      console.error("Manual check error:", error);
      alert(
        "Manual check failed: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
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
        generationType: 'text-to-image',
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
        ).filter(Boolean).slice(0, 5) // Limit to 5 jobs
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

  if (!apiClient) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-[600px] bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900 rounded-3xl">
          <div className="text-center space-y-8 p-8">
            <div className="relative">
              <div className="w-28 h-28 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto shadow-2xl"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                  <Sparkles className="w-8 h-8 text-white animate-pulse" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Preparing AI Studio ✨
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-lg max-w-lg mx-auto leading-relaxed">
                Setting up your creative workspace with the latest FLUX AI
                models and artistic tools...
              </p>
            </div>

            <div className="flex items-center justify-center space-x-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce shadow-lg"></div>
              <div
                className="w-3 h-3 bg-purple-500 rounded-full animate-bounce shadow-lg"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce shadow-lg"
                style={{ animationDelay: "0.2s" }}
              ></div>
            </div>

            <div className="mt-8 p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-blue-200/50 dark:border-gray-700/50 max-w-sm mx-auto">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Loading AI Models...
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full animate-pulse"
                  style={{ width: "75%" }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-950 dark:via-purple-950/30 dark:to-blue-950/30 p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8 text-center">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-xl sm:rounded-2xl shadow-lg animate-pulse">
              <Wand2 className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" />
            </div>
            <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 dark:from-purple-400 dark:via-pink-400 dark:to-blue-400 bg-clip-text text-transparent">
              Text to Image Studio
            </h1>
          </div>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto px-2">
            Transform your imagination into stunning visuals with AI-powered magic ✨ Create breathtaking images with advanced FLUX technology
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/30 dark:to-pink-950/30 border-2 border-red-300 dark:border-red-700 rounded-xl sm:rounded-2xl flex items-start gap-2 sm:gap-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="p-1.5 sm:p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-red-900 dark:text-red-100 text-sm sm:text-base md:text-lg">Oops! Something went wrong</h3>
              <p className="text-xs sm:text-sm text-red-700 dark:text-red-300 mt-1 break-words">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 transition-colors p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg active:scale-95 flex-shrink-0"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          {/* Left Panel - Input */}
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
          {/* Vault Folder Selection */}
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <Archive className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                Save to Vault
              </h2>
              {isLoadingVaultData && (
                <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
              )}
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Select a vault folder to save your generated images
              </label>

              <div className="relative">
                <select
                  id="folder-select-text-to-image"
                  value={targetFolder}
                  onChange={(e) => setTargetFolder(e.target.value)}
                  disabled={isLoadingVaultData}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white hover:border-purple-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed appearance-none [&>option]:bg-gray-800 [&>option]:text-white [&>optgroup]:bg-gray-800 [&>optgroup]:text-gray-400"
                >
                  <option value="">📁 Select a vault folder...</option>
                  
                  {/* Vault Folders by Profile */}
                  {vaultProfiles.map((profile) => {
                    const folders = (vaultFoldersByProfile[profile.id] || []).filter(f => !f.isDefault);
                    if (folders.length === 0) return null;
                    
                    return (
                      <optgroup 
                        key={profile.id} 
                        label={`📸 ${profile.name}${profile.instagramUsername ? ` (@${profile.instagramUsername})` : ''}`}
                      >
                        {folders.map((folder) => (
                          <option 
                            key={folder.id} 
                            value={`vault:${profile.id}:${folder.id}`}
                          >
                            {folder.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>

              {/* Selected folder display */}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {getSelectedFolderDisplay()}
              </p>
            </div>
          </div>

          {/* Prompt Section */}
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 text-pink-600 dark:text-pink-400" />
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                Describe Your Vision ✨
              </h2>
            </div>
            <textarea
              value={params.prompt}
              onChange={(e) =>
                setParams((prev) => ({ ...prev, prompt: e.target.value }))
              }
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 dark:border-gray-600 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-900/50 dark:text-white resize-none transition-all shadow-inner"
              rows={5}
              placeholder="Describe your dream image in vivid detail... (e.g., 'A futuristic cityscape at sunset with flying cars and neon lights')"
            />
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-2">
              💡 Tip: Be specific and descriptive for best results!
            </p>
          </div>

          {/* Generation Settings */}
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                Generation Settings
              </h2>
            </div>

            {/* LoRA Model Selection */}
            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-sm sm:text-base md:text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2 sm:space-x-3">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  <span className="whitespace-nowrap">AI Style Models</span>
                  <div className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-[10px] sm:text-xs font-medium">
                    Multi-Stack
                  </div>
                </label>
                {params.loras.filter(l => l.modelName !== "None").length > 0 && (
                  <div className="flex items-center space-x-1.5 sm:space-x-2 text-green-600 dark:text-green-400">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs sm:text-sm font-medium">{params.loras.filter(l => l.modelName !== "None").length} Active</span>
                  </div>
                )}
              </div>

              {loadingLoRAs ? (
                <div className="flex items-center space-x-3 p-4 border-2 border-dashed border-green-300 dark:border-green-600 rounded-2xl bg-green-50 dark:bg-green-900/10 backdrop-blur-sm">
                  <Loader2 className="w-5 h-5 animate-spin text-green-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                    Loading your custom AI models...
                  </span>
                  <div className="ml-auto">
                    <div className="w-16 h-2 bg-green-200 dark:bg-green-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full animate-pulse"
                        style={{ width: "60%" }}
                      ></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Existing LoRAs */}
                  {params.loras.map((lora, index) => (
                    <div key={lora.id} className="p-4 bg-white dark:bg-gray-800 rounded-xl border-2 border-green-200 dark:border-green-700 shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-bold">
                            LoRA {index + 1}
                          </div>
                          {lora.modelName !== "None" && (
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          )}
                        </div>
                        <button
                          onClick={() => removeLoRA(lora.id)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                      
                      {/* LoRA Model Selection */}
                      <div className="relative mb-3">
                        <select
                          value={lora.modelName}
                          onChange={(e) => updateLoRA(lora.id, { modelName: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-green-200 dark:border-green-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300 appearance-none font-medium shadow-sm"
                        >
                          {availableLoRAs.map((loraModel, idx) => (
                            <option
                              key={`${loraModel.fileName}-${idx}`}
                              value={loraModel.fileName}
                            >
                              {loraModel.displayName}
                              {loraModel.fileName !== "None" &&
                                loraModel.fileSize > 0 &&
                                ` (${(loraModel.fileSize / 1024 / 1024).toFixed(1)}MB)`}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-500 pointer-events-none" />
                      </div>

                      {/* LoRA Strength Slider */}
                      {lora.modelName !== "None" && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Strength
                            </label>
                            <span className="text-sm font-bold text-green-600 dark:text-green-400">
                              {(lora.strength * 100).toFixed(0)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={lora.strength}
                            onChange={(e) => updateLoRA(lora.id, { strength: parseFloat(e.target.value) })}
                            className="w-full h-2 bg-green-200 dark:bg-green-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                          />
                          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>Subtle</span>
                            <span>Balanced</span>
                            <span>Strong</span>
                          </div>
                        </div>
                      )}

                      {/* LoRA Info */}
                      {lora.modelName !== "None" && (() => {
                        const selectedLoRA = availableLoRAs.find(
                          (l) => l.fileName === lora.modelName
                        );
                        return selectedLoRA && selectedLoRA.fileSize > 0 ? (
                          <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                            <div className="text-xs text-green-600 dark:text-green-400 space-y-0.5">
                              <div>
                                Size: {(selectedLoRA.fileSize / 1024 / 1024).toFixed(1)}MB
                              </div>
                              <div>
                                Uploaded: {new Date(selectedLoRA.uploadedAt).toLocaleDateString()}
                              </div>
                              {selectedLoRA.usageCount > 0 && (
                                <div>Used {selectedLoRA.usageCount} times</div>
                              )}
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  ))}

                  {/* Add LoRA Button */}
                  <button
                    onClick={addLoRA}
                    className="w-full py-3 px-4 border-2 border-dashed border-green-300 dark:border-green-600 rounded-xl bg-green-50 dark:bg-green-900/10 hover:bg-green-100 dark:hover:bg-green-900/20 text-green-700 dark:text-green-300 font-medium transition-all duration-300 flex items-center justify-center space-x-2 group"
                  >
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                    <span>Add Another LoRA</span>
                  </button>

                  {/* Summary */}
                  {params.loras.filter(l => l.modelName !== "None").length > 0 && (
                    <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-700 rounded-xl shadow-sm">
                      <div className="p-2 bg-green-500 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-green-800 dark:text-green-200">
                          {params.loras.filter(l => l.modelName !== "None").length} Style Model{params.loras.filter(l => l.modelName !== "None").length > 1 ? 's' : ''} Active
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400">
                          Models will be applied in sequence (stacked)
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Enhanced Aspect Ratio */}
            <div className="space-y-4 mb-6 p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <label className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl">
                    <Monitor className="w-5 h-5 text-white" />
                  </div>
                  <span>Image Dimensions</span>
                  <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                    Choose Aspect
                  </div>
                </label>
                <div className="text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                  {params.width} × {params.height}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.name}
                    onClick={() =>
                      handleAspectRatioChange(ratio.width, ratio.height)
                    }
                    className={`group relative p-4 rounded-2xl border-2 text-sm font-medium transition-all duration-300 hover:scale-105 ${
                      params.width === ratio.width &&
                      params.height === ratio.height
                        ? "border-blue-500 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-2xl scale-105 ring-4 ring-blue-500/20"
                        : "border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-300 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 shadow-sm hover:shadow-lg"
                    }`}
                  >
                    {/* Visual Representation */}
                    <div className="flex justify-center mb-2">
                      <div
                        className={`border rounded-sm ${
                          params.width === ratio.width &&
                          params.height === ratio.height
                            ? "border-white/60 bg-white/20"
                            : "border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-700"
                        }`}
                        style={{
                          width: ratio.width > ratio.height ? "24px" : "18px",
                          height: ratio.height > ratio.width ? "24px" : "18px",
                          aspectRatio: `${ratio.width}/${ratio.height}`,
                        }}
                      ></div>
                    </div>

                    <div className="text-center">
                      <div className="font-bold text-base mb-1">
                        {ratio.name}
                      </div>
                      <div
                        className={`text-xs mb-1 ${
                          params.width === ratio.width &&
                          params.height === ratio.height
                            ? "text-blue-100"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {ratio.ratio}
                      </div>
                      <div
                        className={`text-xs ${
                          params.width === ratio.width &&
                          params.height === ratio.height
                            ? "text-blue-200"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        {ratio.width}×{ratio.height}
                      </div>
                    </div>

                    {/* Selection indicator */}
                    {params.width === ratio.width &&
                      params.height === ratio.height && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                          <CheckCircle className="w-4 h-4 text-yellow-800" />
                        </div>
                      )}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-sm pt-2">
                <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="font-medium">Pro Tip:</span>
                </div>
                <span className="text-gray-600 dark:text-gray-400">
                  Portrait works best for people, landscape for scenes
                </span>
              </div>
            </div>

            {/* Enhanced Batch Size */}
            <div className="space-y-4 mb-6 p-4 bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-900/20 dark:via-amber-900/20 dark:to-yellow-900/20 rounded-2xl border border-orange-200 dark:border-orange-800">
              <div className="flex items-center justify-between">
                <label className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl">
                    <Copy className="w-5 h-5 text-white" />
                  </div>
                  <span>Batch Generation</span>
                  <div className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-xs font-medium">
                    Multiple Images
                  </div>
                </label>
                <div className="flex items-center space-x-3">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-4 py-2 rounded-2xl shadow-sm">
                    {params.batchSize}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    image{params.batchSize !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={params.batchSize}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        batchSize: parseInt(e.target.value),
                      }))
                    }
                    className="w-full h-3 bg-gradient-to-r from-orange-200 to-amber-200 dark:from-orange-800 dark:to-amber-800 rounded-lg appearance-none cursor-pointer slider-thumb"
                    style={{
                      background: `linear-gradient(to right, 
                        rgb(249 115 22) 0%, 
                        rgb(249 115 22) ${((params.batchSize - 1) / 14) * 100}%, 
                        rgb(209 213 219) ${
                          ((params.batchSize - 1) / 14) * 100
                        }%, 
                        rgb(209 213 219) 100%)`,
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 font-medium mt-2">
                    {[1, 5, 10, 15].map((num) => (
                      <div
                        key={num}
                        className={`flex flex-col items-center ${
                          params.batchSize === num
                            ? "text-orange-600 dark:text-orange-400 font-bold"
                            : ""
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full mb-1 ${
                            params.batchSize >= num
                              ? "bg-orange-500"
                              : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        ></div>
                        <span>
                          {num} image{num !== 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-2xl border border-orange-200 dark:border-orange-700">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                      <Copy className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm font-bold text-orange-800 dark:text-orange-200">
                      Generating {params.batchSize} variation
                      {params.batchSize !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                    {params.batchSize === 1 && "Single image"}
                    {params.batchSize >= 2 && params.batchSize <= 3 && "More variety"}
                    {params.batchSize >= 4 && params.batchSize <= 7 && "Good selection"}
                    {params.batchSize >= 8 && params.batchSize <= 12 && "Great variety"}
                    {params.batchSize >= 13 && "Maximum choice"}
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Advanced Settings Toggle */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full p-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-indigo-500" />
                  <span>Advanced Settings</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showAdvanced ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>

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

          {/* Enhanced Generate Button */}
          <div className="mt-6">
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-3xl p-4 border border-gray-200 dark:border-gray-700 shadow-lg">
              {/* Current Settings Summary */}
              <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Current Generation Settings:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Prompt:
                    </span>{" "}
                    <span className="text-gray-900 dark:text-white font-medium">
                      {params.prompt.substring(0, 40)}
                      {params.prompt.length > 40 ? "..." : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Style Model:
                    </span>{" "}
                    <span className="text-gray-900 dark:text-white font-medium">
                      {params.loras.length > 0 && params.loras.some(l => l.modelName !== "None")
                        ? `${params.loras.filter(l => l.modelName !== "None").length} LoRA${params.loras.filter(l => l.modelName !== "None").length > 1 ? 's' : ''}`
                        : "Base Model"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Size:
                    </span>{" "}
                    <span className="text-gray-900 dark:text-white font-medium">
                      {params.width}×{params.height}
                    </span>
                  </div>
                </div>
              </div>

              {/* Generation Info */}
              <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700 rounded-2xl">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-green-400 to-blue-500 rounded-xl">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white text-sm">
                      Ready to Generate
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {params.batchSize} image
                      {params.batchSize !== 1 ? "s" : ""} • {params.width}×
                      {params.height}
                      {params.loras.some(l => l.modelName !== "None") && ` • ${params.loras.filter(l => l.modelName !== "None").length} LoRA${params.loras.filter(l => l.modelName !== "None").length > 1 ? 's' : ''}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Ready
                  </span>
                </div>
              </div>

              {/* Generate Button */}
              {!isGenerating && (
                <button
                  onClick={handleGenerate}
                  disabled={!params.prompt.trim() || !targetFolder}
                  className={`group relative w-full py-3 sm:py-4 md:py-5 px-4 sm:px-6 md:px-8 rounded-xl sm:rounded-2xl transition-all duration-500 flex items-center justify-center space-x-2 sm:space-x-3 md:space-x-4 font-bold text-base sm:text-lg md:text-xl overflow-hidden ${
                    !params.prompt.trim() || !targetFolder
                      ? "bg-gradient-to-r from-gray-400 to-gray-500 cursor-not-allowed text-white/80"
                      : "bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 hover:from-purple-700 hover:via-blue-700 hover:to-indigo-700 text-white shadow-xl sm:shadow-2xl hover:shadow-purple-500/30 hover:scale-105 active:scale-95"
                  }`}
                >
                  {/* Animated background */}
                  <div
                    className={`absolute inset-0 rounded-xl sm:rounded-2xl transition-opacity duration-500 ${
                      !params.prompt.trim() || !targetFolder
                        ? "opacity-0"
                        : "opacity-100 bg-gradient-to-r from-purple-400/20 via-blue-400/20 to-indigo-400/20 animate-pulse"
                    }`}
                  ></div>

                  {/* Button content */}
                  <div className="relative flex items-center justify-center space-x-2 sm:space-x-3 md:space-x-4">
                    <div className="relative">
                      <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 group-hover:rotate-12 transition-transform duration-300 drop-shadow-lg" />
                      <div className="absolute -top-0.5 sm:-top-1 -right-0.5 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 bg-yellow-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-600 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                    <span className="drop-shadow-sm">Generate AI Art</span>
                    <Wand2 className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 group-hover:rotate-12 transition-transform duration-300 drop-shadow-lg" />
                  </div>
                </button>
              )}

              {/* Status messages */}
              {!params.prompt.trim() ? (
                <div className="text-center mt-3 sm:mt-4 p-2 sm:p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg sm:rounded-xl">
                  <div className="flex items-center justify-center space-x-1.5 sm:space-x-2 text-amber-700 dark:text-amber-300">
                    <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium">
                      Enter a creative prompt to begin
                    </span>
                  </div>
                </div>
              ) : !targetFolder ? (
                <div className="text-center mt-3 sm:mt-4 p-2 sm:p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg sm:rounded-xl">
                  <div className="flex items-center justify-center space-x-1.5 sm:space-x-2 text-amber-700 dark:text-amber-300">
                    <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium">
                      ⚠️ Please select a folder before generating
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center mt-3 sm:mt-4 p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg sm:rounded-xl">
                  <div className="flex items-center justify-center space-x-1.5 sm:space-x-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium">
                      Ready to create amazing art!
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="space-y-3 sm:space-y-4 md:space-y-6">
          {/* Enhanced Image Statistics */}
          {imageStats && (
            <div className="group bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300">
              <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="p-1.5 sm:p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg sm:rounded-xl">
                    <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
                  </div>
                  <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                    AI Art Gallery
                  </h3>
                </div>
                <Link
                  href="/dashboard/workspace/generated-content"
                  className="group flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg sm:rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 font-medium shadow-lg hover:shadow-xl active:scale-95 text-sm sm:text-base w-full xs:w-auto justify-center"
                >
                  <span>View Gallery</span>
                  <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl sm:rounded-2xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                      <div className="p-1.5 sm:p-2 bg-blue-500 rounded-lg sm:rounded-xl flex-shrink-0">
                        <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-700 dark:text-blue-300">
                          {imageStats.totalImages?.toLocaleString() || 0}
                        </div>
                        <div className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-medium">
                          Total Masterpieces
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm sm:text-base md:text-lg font-bold text-gray-700 dark:text-gray-300">
                        {Math.round(
                          (imageStats.totalSize / 1024 / 1024) * 100
                        ) / 100}{" "}
                        MB
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Storage Used
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Current Generation */}
          {currentJob && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                  Current Generation
                </h3>
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  {/* Manual status refresh button for processing jobs */}
                  {(currentJob.status === "processing" ||
                    currentJob.status === "pending") && (
                    <button
                      onClick={() => refreshJobStatus(currentJob.id)}
                      className="p-1.5 sm:p-2 text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 active:scale-95 transition-transform"
                      title="Check RunPod status and sync if completed"
                    >
                      <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                  {/* Image refresh button for completed jobs */}
                  {currentJob.status === "completed" && (
                    <button
                      onClick={() => fetchJobImages(currentJob.id, true)}
                      className="p-1.5 sm:p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-transform"
                      title="Refresh generated images"
                    >
                      <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Status
                  </span>
                  <div className="flex items-center space-x-1.5 sm:space-x-2">
                    {(currentJob.status === "pending" ||
                      currentJob.status === "processing") && (
                      <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-blue-500" />
                    )}
                    {currentJob.status === "completed" && (
                      <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" />
                    )}
                    {currentJob.status === "failed" && !isJobCancelled(currentJob) && (
                      <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
                    )}
                    {isJobCancelled(currentJob) && (
                      <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500" />
                    )}
                    <span className="text-xs sm:text-sm font-medium capitalize">
                      {isJobCancelled(currentJob) ? 'cancelled' : currentJob.status}
                    </span>
                  </div>
                </div>

                {/* Enhanced Progress Display */}
                {(currentJob.status === "processing" ||
                  currentJob.status === "pending") && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        Generation Progress
                      </h4>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {progressData.progress}%
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${
                          progressData.stage === "failed"
                            ? "bg-red-500"
                            : progressData.stage === "cancelled"
                            ? "bg-orange-500"
                            : progressData.stage === "completed"
                            ? "bg-green-500"
                            : "bg-gradient-to-r from-blue-500 to-purple-600"
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
                      {progressData.message || "Processing..."}
                    </div>

                    {/* Batch Progress Indicator */}
                    {progressData.totalImages && progressData.totalImages > 1 && (
                      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 mb-2">
                        <span className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                          <span>
                            Image {progressData.imageCount || 0} of {progressData.totalImages}
                          </span>
                        </span>
                        <span className="text-xs font-medium bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full">
                          Batch Generation
                        </span>
                      </div>
                    )}

                    {/* Individual Image Progress Bar for Batch */}
                    {progressData.totalImages && progressData.totalImages > 1 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>Images Completed</span>
                          <span>{progressData.imageCount || 0} / {progressData.totalImages}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${((progressData.imageCount || 0) / (progressData.totalImages || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

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
                          {progressData.stage === "encoding_prompt" && (
                            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                          )}
                          {progressData.stage === "generating" && (
                            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                          )}
                          {progressData.stage === "decoding" && (
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                          )}
                          {progressData.stage === "saving" && (
                            <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></div>
                          )}
                          {progressData.stage === "uploading_images" && (
                            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                          )}
                          {progressData.stage === "completed" && (
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          )}
                          {progressData.stage === "failed" && (
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
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
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${currentJob.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                {/* Enhanced no images message for completed jobs */}
                {currentJob.status === "completed" &&
                  (!currentJob.resultUrls ||
                    currentJob.resultUrls.length === 0) &&
                  (!jobImages[currentJob.id] ||
                    jobImages[currentJob.id].length === 0) && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Generated Images
                      </h4>
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-2">
                              ⚠️ Images generated but not loaded yet
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                              The generation completed successfully, but images
                              may still be processing or need to be downloaded
                              from the server.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={async () => {
                                  setRefreshingImages(true);
                                  try {
                                    await fetchJobImages(currentJob.id);
                                  } finally {
                                    setRefreshingImages(false);
                                  }
                                }}
                                disabled={refreshingImages}
                                className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 disabled:bg-amber-400 transition-colors flex items-center space-x-1"
                              >
                                <RefreshCw className={`w-3 h-3 ${refreshingImages ? 'animate-spin' : ''}`} />
                                <span>{refreshingImages ? 'Refreshing...' : 'Refresh Images'}</span>
                              </button>
                              <button
                                onClick={async () => {
                                  const success =
                                    await forceDownloadAndSaveImages(
                                      currentJob.id
                                    );
                                  if (success) {
                                    console.log(
                                      "✅ Images downloaded successfully! They should appear shortly."
                                    );
                                    // Re-fetch job images to update the display
                                    await fetchJobImages(currentJob.id);
                                  } else {
                                    console.error(
                                      "❌ Failed to download images. Please try again or check the Generated Content gallery."
                                    );
                                  }
                                }}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors flex items-center space-x-1"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download Images</span>
                              </button>
                              <button
                                onClick={() => refreshJobStatus(currentJob.id)}
                                className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors flex items-center space-x-1"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Refresh Status</span>
                              </button>
                              <button
                                onClick={() =>
                                  window.open(
                                    "/dashboard/workspace/generated-content",
                                    "_blank"
                                  )
                                }
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors flex items-center space-x-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>View Gallery</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Enhanced image display with dynamic URL support */}
                {((currentJob.resultUrls && currentJob.resultUrls.length > 0) ||
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
                        // Database images with dynamic URLs - only show images that have displayable URLs
                        jobImages[currentJob.id]
                          .filter((img) => hasS3Storage(img) || img.dataUrl || img.url)
                          .map((dbImage, index) => (
                            <div
                              key={`db-${dbImage.id}`}
                              className="relative group"
                            >
                              <img
                                src={getBestImageUrl(dbImage)}
                                alt={`Generated image ${index + 1}`}
                                className="w-full h-auto rounded-lg shadow-md hover:shadow-lg transition-shadow object-cover"
                                onError={(e) => {
                                  console.warn(
                                    "⚠️ Image failed to load:",
                                    dbImage.filename
                                  );

                                  const currentSrc = (e.target as HTMLImageElement).src;
                                  
                                  // Try fallback URLs in order: S3 -> Database -> Placeholder
                                  if (dbImage.s3Key && !currentSrc.includes(dbImage.s3Key)) {
                                    console.log("Trying S3 URL for:", dbImage.filename);
                                    (e.target as HTMLImageElement).src = buildDirectS3Url(dbImage.s3Key);
                                  } else if (dbImage.networkVolumePath && !currentSrc.includes('s3api-us-ks-2')) {
                                    console.log("Trying S3 URL from network path for:", dbImage.filename);
                                    const s3Key = dbImage.networkVolumePath.replace('/runpod-volume/', '');
                                    (e.target as HTMLImageElement).src = buildDirectS3Url(s3Key);
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
                            </div>
                          ))
                      ) : // Check if there are images without any displayable URL (still processing)
                      jobImages[currentJob.id] &&
                        jobImages[currentJob.id].length > 0 &&
                        jobImages[currentJob.id].some((img) => !img.awsS3Url && !img.awsS3Key && !img.dataUrl && !img.url) ? (
                        <div className="text-center py-8">
                          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 mb-2">
                            Images are being processed...
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-500">
                            {
                              jobImages[currentJob.id].filter(
                                (img) => !img.awsS3Url && !img.awsS3Key && !img.dataUrl && !img.url
                              ).length
                            }{" "}
                            image(s) saving to storage
                          </p>
                          <button
                            onClick={() =>
                              currentJob.id && fetchJobImages(currentJob.id, true)
                            }
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                          >
                            Refresh Images
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
                              alt={`Generated image ${index + 1}`}
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
                                      `generated-image-${index + 1}.png`
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

                {currentJob.error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {currentJob.error}
                    </p>
                  </div>
                )}

                {/* Cancel Button - only show for pending/processing jobs */}
                {isGenerating && (currentJob.status === "pending" || currentJob.status === "processing") && (
                  <div className="pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={cancelGeneration}
                      className="group relative w-full py-3 sm:py-4 px-4 sm:px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2 sm:space-x-3 font-semibold text-base sm:text-lg overflow-hidden bg-gradient-to-r from-red-500 via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-red-500/30 hover:scale-105 active:scale-95"
                    >
                      {/* Animated background */}
                      <div className="absolute inset-0 rounded-xl opacity-100 bg-gradient-to-r from-red-400/20 via-red-500/20 to-red-600/20 animate-pulse"></div>

                      {/* Button content */}
                      <div className="relative flex items-center justify-center space-x-2 sm:space-x-3">
                        <div className="relative">
                          <X className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-90 transition-transform duration-300 drop-shadow-lg" />
                        </div>
                        <span className="drop-shadow-sm">Cancel Generation</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Generation History */}
          {jobHistory.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6">
              <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                Recent Generations
              </h3>
              <div className="space-y-2 sm:space-y-3 max-h-80 sm:max-h-96 overflow-y-auto">
                {jobHistory
                  .filter((job) => job && job.id)
                  .slice(0, 10)
                  .map((job, index) => (
                    <div
                      key={job.id || `job-${index}`}
                      className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                        {job.status === "completed" && (
                          <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
                        )}
                        {job.status === "failed" && !isJobCancelled(job) && (
                          <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 flex-shrink-0" />
                        )}
                        {isJobCancelled(job) && (
                          <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500 flex-shrink-0" />
                        )}
                        {(job.status === "pending" ||
                          job.status === "processing") && (
                          <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-blue-500 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                            {formatJobTime(job.createdAt)}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 capitalize truncate">
                            {isJobCancelled(job) ? 'cancelled' : (job.status || "unknown")}
                          </p>
                        </div>
                      </div>
                      {job.resultUrls && job.resultUrls.length > 0 && (
                        <div className="flex space-x-1 flex-shrink-0">
                          <button
                            onClick={() => fetchJobImages(job.id, true)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 active:scale-95 transition-transform"
                            title="Refresh images"
                          >
                            <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
