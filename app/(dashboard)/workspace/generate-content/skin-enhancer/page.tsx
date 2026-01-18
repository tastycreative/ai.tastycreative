// app/(dashboard)/workspace/generate-content/skin-enhancer/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
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
  Copy,
  RefreshCw,
  ArrowRightLeft,
  Eye,
  EyeOff,
  Layers,
  XCircle,
  Plus,
  X,
  Archive,
  ChevronDown,
  Clock,
} from "lucide-react";

// Types
interface LoRAConfig {
  id: string;
  modelName: string;
  strength: number;
}

interface EnhancementParams {
  prompt: string;
  width: number;
  height: number;
  portraitSize?: string; // New parameter for backend optimization
  batchSize: number;
  steps: number;
  cfg: number;
  samplerName: string;
  scheduler: string;
  guidance: number;
  influencerLoraStrength: number;
  selectedInfluencerLora: string;
  loras: LoRAConfig[]; // Multi-LoRA support
  seed: number | null;
  denoise: number;
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
  imagesReady?: number;
  totalImages?: number;
}

interface LoRAModel {
  fileName: string;
  displayName: string;
  name: string;
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
  url?: string | null; // Dynamically constructed ComfyUI URL (can be null for serverless)
  dataUrl?: string; // Database-served image URL
  createdAt: Date | string;
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

// Constants - Portrait-optimized sizes (3:4 aspect ratio for faces)
const ASPECT_RATIOS = [
  {
    name: "Portrait S",
    width: 768,
    height: 1024,
    ratio: "3:4",
    description: "Fast generation",
  },
  {
    name: "Portrait M",
    width: 832,
    height: 1216,
    ratio: "3:4",
    description: "Balanced quality",
  },
  {
    name: "Portrait L",
    width: 896,
    height: 1344,
    ratio: "3:4",
    description: "High quality",
  },
  {
    name: "Portrait XL",
    width: 1024,
    height: 1536,
    ratio: "3:4",
    description: "Ultra quality",
  },
  {
    name: "Square",
    width: 1024,
    height: 1024,
    ratio: "1:1",
    description: "Social media",
  },
  {
    name: "Custom",
    width: 1408,
    height: 1408,
    ratio: "Custom",
    description: "Your choice",
  },
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

// Fixed enhancement LoRAs (from the workflow)
const FIXED_ENHANCEMENT_LORAS = [
  { fileName: "real-humans-PublicPrompts.safetensors", strength: 1.0 },
  { fileName: "more_details.safetensors", strength: 0.6 },
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

export default function SkinEnhancerPage() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();

  // Refs for managing browser interactions
  const progressUpdateRef = useRef<((progress: any) => void) | null>(null);
  const notificationRef = useRef<Notification | null>(null);

  // Storage keys for persistence
  const STORAGE_KEYS = {
    currentJob: 'skin-enhancer-current-job',
    isGenerating: 'skin-enhancer-is-generating',
    progressData: 'skin-enhancer-progress-data',
    jobHistory: 'skin-enhancer-job-history',
  };

  const [params, setParams] = useState<EnhancementParams>({
    // Only show main prompt in UI
    prompt: "",
    // Portrait-optimized defaults (medium size)
    width: 832,
    height: 1216,
    portraitSize: "medium", // New parameter for backend optimization
    batchSize: 1,
    steps: 25,
    cfg: 0.7,
    samplerName: "dpmpp_2m",
    scheduler: "karras",
    guidance: 4,
    influencerLoraStrength: 0.95,
    selectedInfluencerLora: "None",
    loras: [], // Initialize with empty array - user can add influencer LoRAs
    seed: null,
    denoise: 0.25,
  });

  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [jobHistory, setJobHistory] = useState<GenerationJob[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [availableInfluencerLoRAs, setAvailableInfluencerLoRAs] = useState<
    LoRAModel[]
  >([{ fileName: "None", displayName: "No Influencer LoRA", name: "none" }]);
  const [loadingLoRAs, setLoadingLoRAs] = useState(true);

  // Folder selection state (vault-only)
  const [targetFolder, setTargetFolder] = useState<string>("");

  // Vault Integration State
  const [vaultProfiles, setVaultProfiles] = useState<InstagramProfile[]>([]);
  const [vaultFoldersByProfile, setVaultFoldersByProfile] = useState<Record<string, VaultFolder[]>>({});
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);

  // Database image states
  const [jobImages, setJobImages] = useState<Record<string, DatabaseImage[]>>(
    {}
  );
  const [imageStats, setImageStats] = useState<any>(null);

  // Comparison states
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonImages, setComparisonImages] = useState<{
    initial?: DatabaseImage;
    final?: DatabaseImage;
  }>({});
  const [comparisonMode, setComparisonMode] = useState<
    "split" | "overlay" | "toggle"
  >("split");

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

      // Update global progress
      updateGlobalProgress({
        isGenerating: true,
        progress: 0,
        stage: "canceling",
        message: "🛑 Canceling generation...",
        generationType: 'skin-enhancer',
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

      // Create cancelled job for history
      const canceledJob = {
        ...currentJob,
        status: 'failed' as const,
        error: 'Job canceled by user',
        progress: undefined, // Clear progress
      };

      // Update job history with cancelled job
      setJobHistory(prev => 
        prev.map(job => 
          job?.id === currentJob.id ? canceledJob : job
        ).filter(Boolean).slice(0, 5)
      );

      // Stop generation state immediately and clear current job
      setIsGenerating(false);
      setCurrentJob(null); // Clear the current job completely
      
      // Clear persistent state
      clearPersistentState();

      // Clear global progress immediately
      clearGlobalProgress();

      alert("✅ Generation canceled successfully");

    } catch (error) {
      console.error("❌ Error canceling generation:", error);
      
      alert(
        "❌ Failed to cancel generation: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  // Initialize job history from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedHistory = localStorage.getItem(STORAGE_KEYS.jobHistory);
        if (savedHistory) {
          const parsedHistory = JSON.parse(savedHistory);
          if (Array.isArray(parsedHistory)) {
            // Filter out any jobs with old /api/videos/ URLs to prevent confusion
            const validHistory = parsedHistory
              .filter(job => {
                if (!job || !job.id) return false;
                
                // Filter out jobs with old video API URLs - these should be image URLs for skin enhancer
                if (job.resultUrls && Array.isArray(job.resultUrls)) {
                  const hasOldVideoUrls = job.resultUrls.some((url: string) => 
                    typeof url === 'string' && url.includes('/api/videos/')
                  );
                  if (hasOldVideoUrls) {
                    console.warn("🚨 Filtering out job with old video URLs:", job.id, job.resultUrls);
                    return false;
                  }
                }
                
                return true;
              })
              .slice(0, 5)
              .map(job => ({
                ...job,
                createdAt: typeof job.createdAt === 'string' ? new Date(job.createdAt) : job.createdAt
              }));
            setJobHistory(validHistory);
            console.log("📚 Loaded job history from localStorage:", validHistory.length, "jobs");
            
            // Debug log all URLs in history
            validHistory.forEach(job => {
              if (job.resultUrls) {
                console.log(`📋 Job ${job.id} URLs:`, job.resultUrls);
              }
            });
          }
        }
      } catch (error) {
        console.error("Error loading job history from localStorage:", error);
        setJobHistory([]);
      }
    }
  }, []);

  // Fetch image stats on mount
  useEffect(() => {
    fetchImageStats();
  }, []);

  // Browser tab title and favicon updates
  useEffect(() => {
    const updateBrowserState = () => {
      if (isGenerating && currentJob) {
        // Update page title
        document.title = `🎨 Enhancing Skin... - TastyCreative AI`;
        
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
        document.title = 'TastyCreative AI - Skin Enhancer';
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
        document.title = 'TastyCreative AI - Skin Enhancer';
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
          notificationRef.current = new Notification('🎨 Skin Enhancement Complete!', {
            body: 'Your enhanced images are ready to view and download.',
            icon: '/favicon.ico',
            tag: 'skin-enhancement-complete'
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

  // Persistent state management with localStorage
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
          
          // Validate job URLs - filter out any old video URLs that shouldn't be in skin enhancer
          if (job.resultUrls && Array.isArray(job.resultUrls)) {
            const hasOldVideoUrls = job.resultUrls.some((url: string) => 
              typeof url === 'string' && url.includes('/api/videos/')
            );
            
            if (hasOldVideoUrls) {
              console.warn("🚨 Current job has old video URLs, clearing:", job.id, job.resultUrls);
              clearPersistentState();
              return;
            }
          }
          
          const progressData = savedProgressData ? JSON.parse(savedProgressData) : {};
          
          // Only restore if job is still pending or processing
          if (job.status === 'pending' || job.status === 'processing') {
            setIsGenerating(true);
            setCurrentJob(job);
            
            // Resume progress tracking
            updateGlobalProgress({
              isGenerating: true,
              progress: progressData.progress || 50,
              stage: progressData.stage || 'Reconnecting to enhancement...',
              message: progressData.message || 'Restoring your skin enhancement session',
              generationType: 'skin-enhancer',
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
        console.error('Error restoring skin enhancer state:', error);
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

  // Save job history to localStorage with proper validation and 5 job limit
  useEffect(() => {
    if (typeof window !== 'undefined' && jobHistory.length > 0) {
      try {
        // Filter out any invalid jobs and limit to 5 most recent
        const validHistory = jobHistory
          .filter(job => job && job.id && job.status)
          .slice(0, 5)
          .map(job => ({
            ...job,
            // Ensure createdAt is serializable
            createdAt: job.createdAt instanceof Date ? job.createdAt.toISOString() : job.createdAt
          }));
        
        if (validHistory.length > 0) {
          localStorage.setItem(STORAGE_KEYS.jobHistory, JSON.stringify(validHistory));
          console.log("💾 Saved job history to localStorage:", validHistory.length, "jobs");
        }
      } catch (error) {
        console.error("Error saving job history to localStorage:", error);
      }
    }
  }, [jobHistory]);

  // Save progress data to localStorage for cross-tab sync
  useEffect(() => {
    const saveProgressData = (progressData: any) => {
      if (typeof window !== 'undefined') {
        if (isGenerating && progressData) {
          localStorage.setItem(STORAGE_KEYS.progressData, JSON.stringify(progressData));
        } else {
          localStorage.removeItem(STORAGE_KEYS.progressData);
        }
      }
    };

    // Set up stable progress update function
    progressUpdateRef.current = (progress: any) => {
      saveProgressData(progress);
      updateGlobalProgress({
        isGenerating: isGenerating,
        progress: progress.percentage || progress.progress || 0,
        stage: progress.stage || 'Starting...',
        message: progress.message || '',
        generationType: 'skin-enhancer',
        jobId: currentJob?.id || null,
        elapsedTime: progress.elapsedTime,
        estimatedTimeRemaining: progress.estimatedTimeRemaining
      });
    };
  }, [isGenerating, currentJob?.id, updateGlobalProgress]);

  // Cross-tab progress synchronization
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.progressData && e.newValue) {
        try {
          const progressData = JSON.parse(e.newValue);
          if (progressUpdateRef.current) {
            progressUpdateRef.current(progressData);
          }
        } catch (error) {
          console.error('Error parsing progress data:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Function to fetch images for a completed job
  const fetchJobImages = async (jobId: string): Promise<boolean> => {
    if (!apiClient) return false;

    try {
      console.log("🖼️ Fetching database images for job:", jobId);
      console.log("🖼️ Current job state:", currentJob);
      console.log("🖼️ All job images state:", jobImages);

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
        console.log("📊 Raw images from database:", data.images);
        setJobImages((prev) => {
          const updated = {
            ...prev,
            [jobId]: data.images,
          };
          console.log("📊 Updated jobImages state:", updated);
          return updated;
        });
        console.log(
          "✅ Updated job images state for job:",
          jobId,
          "Images count:",
          data.images.length
        );

        // Note: Comparison feature disabled - only showing final enhanced image
        // If you want before/after comparison in the future, you'll need to save both images

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
  const downloadDatabaseImage = async (image: DatabaseImage) => {
    if (!apiClient) return;

    try {
      console.log("📥 Downloading image:", image.filename);

      if (image.dataUrl) {
        // Priority 1: Download from database
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

      if (image.url) {
        // Priority 2: Download from ComfyUI (dynamic URL)
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

    if (image.dataUrl) {
      // Priority 1: Share database URL (more reliable)
      urlToShare = `${window.location.origin}${image.dataUrl}`;
    } else if (image.url) {
      // Priority 2: Share ComfyUI URL (dynamic)
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

  // Fetch available influencer LoRA models on component mount (includes owned + shared LoRAs)
  useEffect(() => {
    const fetchInfluencerLoRAModels = async () => {
      if (!apiClient) return;

      try {
        setLoadingLoRAs(true);
        console.log("=== FETCHING INFLUENCER LORA MODELS (including shared) ===");

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
          // Transform influencer format to LoRAModel format
          const loraModels: LoRAModel[] = data.map((inf: any) => ({
            fileName: inf.fileName,
            displayName: inf.isShared 
              ? `${inf.displayName} (Shared by ${inf.sharedBy})` 
              : inf.displayName,
            name: inf.name,
          }));
          
          console.log("Available influencer LoRA models (owned + shared):", loraModels);
          setAvailableInfluencerLoRAs(loraModels);

          // Set default LoRA if current selection isn't available
          const currentLoRAExists = loraModels.some(
            (lora: LoRAModel) => lora.fileName === params.selectedInfluencerLora
          );
          if (!currentLoRAExists) {
            const defaultLora =
              loraModels.find((lora: LoRAModel) => lora.fileName === "None")
                ?.fileName ||
              loraModels[0]?.fileName ||
              "None";
            console.log("Setting default influencer LoRA to:", defaultLora);
            setParams((prev) => ({
              ...prev,
              selectedInfluencerLora: defaultLora,
            }));
          }
        } else {
          console.error("Invalid LoRA API response:", data);
          setAvailableInfluencerLoRAs([
            {
              fileName: "None",
              displayName: "No Influencer LoRA",
              name: "none",
            },
          ]);
        }
      } catch (error) {
        console.error("Error fetching influencer LoRA models:", error);
        setAvailableInfluencerLoRAs([
          { fileName: "None", displayName: "No Influencer LoRA", name: "none" },
        ]);
      } finally {
        setLoadingLoRAs(false);
      }
    };

    fetchInfluencerLoRAModels();
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

  // Get display text for the selected folder (vault-only)
  const getSelectedFolderDisplay = (): string => {
    if (!targetFolder) return 'Select a vault folder to save your enhanced images';
    
    if (targetFolder.startsWith('vault:')) {
      const parts = targetFolder.replace('vault:', '').split(':');
      const profileId = parts[0];
      const folderId = parts[1];
      const profile = vaultProfiles.find(p => p.id === profileId);
      const folders = vaultFoldersByProfile[profileId] || [];
      const folder = folders.find(f => f.id === folderId);
      return `Saving to Vault: ${profile?.name || 'Profile'} / ${folder?.name || 'Folder'}`;
    }
    
    return 'Select a vault folder to save your enhanced images';
  };

  const generateRandomSeed = () => {
    const seed = Math.floor(Math.random() * 1000000000);
    setParams((prev) => ({ ...prev, seed }));
  };

  const handleAspectRatioChange = (width: number, height: number) => {
    // Map dimensions to portrait size for backend optimization
    let portraitSize = "medium";
    if (width === 768 && height === 1024) portraitSize = "small";
    else if (width === 832 && height === 1216) portraitSize = "medium";
    else if (width === 896 && height === 1344) portraitSize = "large";
    else if (width === 1024 && height === 1536) portraitSize = "xl";

    setParams((prev) => ({ ...prev, width, height, portraitSize }));
  };

  // Multi-LoRA Management Functions
  const addLoRA = () => {
    const newLoRA: LoRAConfig = {
      id: crypto.randomUUID(),
      modelName: "select", // Default to placeholder
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

  const updateLoRA = (
    id: string,
    field: keyof LoRAConfig,
    value: string | number
  ) => {
    setParams((prev) => ({
      ...prev,
      loras: prev.loras.map((lora) =>
        lora.id === id ? { ...lora, [field]: value } : lora
      ),
    }));
  };

  // Manual job status check (without starting continuous polling)
  const checkJobStatus = async (jobId: string) => {
    if (!apiClient) return;

    try {
      console.log("🔍 Manually checking job status for:", jobId);

      const response = await apiClient.get(`/api/jobs/${jobId}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Manual job status check failed:",
          response.status,
          errorText
        );
        return;
      }

      const job = await response.json();
      console.log("📊 Manual job status result:", job);

      // Handle date conversion safely
      if (job.createdAt && typeof job.createdAt === "string") {
        job.createdAt = new Date(job.createdAt);
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

      // If job completed, try to fetch images
      if (job.status === "completed") {
        console.log("✅ Job completed! Fetching images...");
        setIsGenerating(false);
        await fetchJobImages(jobId);
      } else if (job.status === "processing") {
        console.log("⚙️ Job still processing, resuming polling...");
        pollJobStatus(jobId); // Resume polling if still processing
      }
    } catch (error) {
      console.error("💥 Manual job status check error:", error);
    }
  };

  // Submit enhancement
  const handleEnhance = async () => {
    if (!apiClient) {
      alert("API client not ready. Please try again.");
      return;
    }

    if (!params.prompt.trim()) {
      alert("Please enter a prompt");
      return;
    }

    if (!targetFolder) {
      alert("Please select a vault folder to save your enhanced images");
      return;
    }

    setIsGenerating(true);
    setCurrentJob(null);

    // Initialize global progress
    updateGlobalProgress({
      isGenerating: true,
      progress: 0,
      stage: 'Preparing enhancement...',
      message: 'Setting up skin enhancement workflow',
      generationType: 'skin-enhancer',
      jobId: null
    });

    try {
      console.log("=== STARTING SKIN ENHANCEMENT ===");
      console.log("Enhancement params:", params);

      const workflow = createSkinEnhancerWorkflowJson(params, targetFolder);
      console.log("Created skin enhancer workflow for submission");

      // Parse vault folder (vault-only)
      let vaultProfileId: string | undefined;
      let vaultFolderId: string | undefined;
      
      if (targetFolder.startsWith('vault:')) {
        const parts = targetFolder.replace('vault:', '').split(':');
        vaultProfileId = parts[0];
        vaultFolderId = parts[1];
      }
      
      // Build request payload
      const requestPayload: any = {
        workflow,
        params,
      };

      // Add vault parameters
      if (vaultProfileId && vaultFolderId) {
        requestPayload.saveToVault = true;
        requestPayload.vaultProfileId = vaultProfileId;
        requestPayload.vaultFolderId = vaultFolderId;
        console.log("🗂️ Saving to vault:", { profileId: vaultProfileId, folderId: vaultFolderId });
      }

      // Update progress
      updateGlobalProgress({
        isGenerating: true,
        progress: 10,
        stage: 'Submitting to AI...',
        message: 'Sending your enhancement request',
        generationType: 'skin-enhancer',
        jobId: null
      });

      const response = await apiClient.post("/api/generate/skin-enhancer", requestPayload);

      console.log("Enhancement API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Enhancement failed:", response.status, errorText);
        clearGlobalProgress();
        throw new Error(
          `Enhancement failed: ${response.status} - ${errorText}`
        );
      }

      const { jobId } = await response.json();
      console.log("Received job ID:", jobId);

      if (!jobId) {
        clearGlobalProgress();
        throw new Error("No job ID received from server");
      }

      const newJob: GenerationJob = {
        id: jobId,
        status: "pending",
        createdAt: new Date(),
        progress: 0,
      };

      setCurrentJob(newJob);
      setJobHistory((prev) => {
        const updatedHistory = [newJob, ...prev.filter(job => job?.id !== jobId)].slice(0, 5);
        console.log("📝 Updated job history with new job:", updatedHistory.length, "total jobs");
        return updatedHistory;
      });

      // Update progress with job ID
      updateGlobalProgress({
        isGenerating: true,
        progress: 20,
        stage: 'Enhancement started',
        message: 'Your job has been queued for processing',
        generationType: 'skin-enhancer',
        jobId: jobId
      });

      // Start polling for job status
      pollJobStatus(jobId);
    } catch (error) {
      console.error("Enhancement error:", error);
      setIsGenerating(false);
      clearGlobalProgress();
      alert(error instanceof Error ? error.message : "Enhancement failed");
    }
  };

  // Updated poll job status with database image fetching and progress tracking
  const pollJobStatus = async (jobId: string) => {
    if (!apiClient) {
      console.error("API client not ready for polling");
      return;
    }

    console.log("=== STARTING JOB POLLING ===");
    console.log("Polling job ID:", jobId);

    const maxAttempts = 300; // 5 minutes for complex skin enhancement workflow
    let attempts = 0;
    const startTime = Date.now();

    const poll = async () => {
      if (!apiClient) return;

      try {
        attempts++;
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        console.log(
          `Polling attempt ${attempts}/${maxAttempts} for job ${jobId}`
        );

        // Calculate progress based on attempts and typical workflow duration
        const estimatedDuration = 180; // 3 minutes typical for skin enhancement
        const timeProgress = Math.min(elapsed / estimatedDuration, 0.9) * 100;
        const attemptProgress = Math.min((attempts / 60) * 100, 85); // Cap at 85% until completion
        const currentProgress = Math.max(timeProgress, attemptProgress, 25);

        // Update progress with time-based estimates
        const estimatedRemaining = Math.max(estimatedDuration - elapsed, 10);
        
        const progressData = {
          progress: currentProgress,
          stage: attempts < 20 ? 'Initializing enhancement...' : 
                 attempts < 40 ? 'Processing with FLUX model...' :
                 attempts < 80 ? 'Applying skin enhancement...' :
                 'Finalizing results...',
          message: `Processing your skin enhancement (${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, '0')})`,
          elapsedTime: elapsed,
          estimatedTimeRemaining: estimatedRemaining
        };

        // Save to localStorage for cross-tab sync
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.progressData, JSON.stringify(progressData));
        }
        
        updateGlobalProgress({
          isGenerating: true,
          progress: currentProgress,
          stage: progressData.stage,
          message: progressData.message,
          generationType: 'skin-enhancer',
          jobId: jobId,
          elapsedTime: elapsed,
          estimatedTimeRemaining: estimatedRemaining
        });

        const response = await apiClient.get(`/api/jobs/${jobId}`);
        console.log("Job status response:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Job status error:", response.status, errorText);

          if (response.status === 404) {
            console.log("Job not found - likely completed and cleaned up");
            
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
        console.log("Job status data:", job);

        // Handle date conversion safely
        if (job.createdAt && typeof job.createdAt === "string") {
          job.createdAt = new Date(job.createdAt);
        }

        // Handle chunked image uploads for batch skin enhancement generations
        if (job.status === "IMAGE_READY" && job.image) {
          console.log(`🎨 Received chunked enhanced skin image ${job.imageCount || 1} of ${job.totalImages || 1}`);
          
          // Update progress with individual image info
          const progressData = {
            progress: job.progress || 0,
            stage: job.stage || "uploading_images",
            message: job.message || `🎨 Enhanced skin image ${job.imageCount || 1} ready`,
            elapsedTime: job.elapsedTime,
            estimatedTimeRemaining: job.estimatedTimeRemaining,
            imageCount: job.imageCount || 1,
            totalImages: job.totalImages || 1,
          };

          // Save progress to localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.progressData, JSON.stringify(progressData));
          }

          // Update global progress
          updateGlobalProgress({
            isGenerating: true,
            progress: progressData.progress,
            stage: progressData.stage,
            message: progressData.message,
            generationType: 'skin-enhancer',
            jobId: jobId,
            elapsedTime: progressData.elapsedTime,
            estimatedTimeRemaining: progressData.estimatedTimeRemaining
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
              console.log(`✅ Saved chunked enhanced skin image ${job.imageCount}: ${job.image.filename}`);
              
              // Refresh job images to show the new image immediately
              await fetchJobImages(jobId);
            } else {
              console.error(`❌ Failed to save chunked enhanced skin image ${job.imageCount}:`, await saveResponse.text());
            }
          } catch (saveError) {
            console.error(`❌ Error saving chunked enhanced skin image ${job.imageCount}:`, saveError);
          }

          // Continue polling for more images or completion
          setTimeout(poll, 500);
          return;
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
          console.log("✅ Job completed successfully!");
          
          // Update to completion
          updateGlobalProgress({
            isGenerating: true,
            progress: 100,
            stage: 'Enhancement complete!',
            message: 'Fetching your enhanced images...',
            generationType: 'skin-enhancer',
            jobId: jobId,
            elapsedTime: elapsed
          });

          setIsGenerating(false);

          // Fetch database images for completed job with retry logic
          console.log("🔄 Attempting to fetch job images...");
          const fetchSuccess = await fetchJobImages(jobId);

          // If fetch failed or no images found, retry after a short delay
          if (!fetchSuccess) {
            console.log("🔄 Retrying image fetch after delay...");
            setTimeout(() => {
              fetchJobImages(jobId);
            }, 3000);
          }

          // Clear progress after a brief delay to show completion
          setTimeout(() => {
            clearGlobalProgress();
            // Clean up localStorage
            if (typeof window !== 'undefined') {
              Object.values(STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
              });
            }
          }, 2000);

          return;
        } else if (job.status === "failed") {
          console.log("❌ Job failed:", job.error);
          setIsGenerating(false);
          clearGlobalProgress();
          // Clean up localStorage
          if (typeof window !== 'undefined') {
            Object.values(STORAGE_KEYS).forEach(key => {
              localStorage.removeItem(key);
            });
          }
          return;
        }

        // Continue polling with dynamic intervals
        if (attempts < maxAttempts) {
          // Use longer intervals for skin enhancement (it's a complex workflow)
          const interval = attempts < 30 ? 2000 : attempts < 60 ? 3000 : 5000;
          setTimeout(poll, interval);
        } else {
          console.error(
            "⏰ Polling timeout reached after",
            maxAttempts,
            "attempts"
          );
          setIsGenerating(false);
          clearGlobalProgress();
          // Clean up localStorage on timeout
          if (typeof window !== 'undefined') {
            Object.values(STORAGE_KEYS).forEach(key => {
              localStorage.removeItem(key);
            });
          }
          setCurrentJob((prev) =>
            prev
              ? {
                  ...prev,
                  status: "failed" as const,
                  error:
                    "Processing timeout - skin enhancement may still be running in the background. Check back later or try refreshing the page.",
                }
              : null
          );
        }
      } catch (error) {
        console.error("💥 Polling error:", error);

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
          // Use exponential backoff for errors
          const retryDelay = Math.min(
            2000 * Math.pow(1.5, Math.floor(attempts / 10)),
            10000
          );
          console.log(`🔄 Retrying in ${retryDelay}ms...`);
          setTimeout(poll, retryDelay);
        } else {
          setIsGenerating(false);
          clearGlobalProgress();
          // Clean up localStorage on error
          if (typeof window !== 'undefined') {
            Object.values(STORAGE_KEYS).forEach(key => {
              if (key !== STORAGE_KEYS.jobHistory) { // Preserve job history
                localStorage.removeItem(key);
              }
            });
          }
          setCurrentJob((prev) =>
            prev
              ? {
                  ...prev,
                  status: "failed" as const,
                  error: "Enhancement failed after multiple attempts",
                }
              : null
          );
        }
      }
    };

    // Start polling after a short delay
    setTimeout(poll, 2000); // Start with 2 second delay for complex workflows
  };

  // Create workflow JSON for skin enhancer - SIMPLIFIED VERSION without PersonMaskUltra
  const createSkinEnhancerWorkflowJson = (params: EnhancementParams, targetFolder: string) => {
    const seed = params.seed || Math.floor(Math.random() * 1000000000);
    
    // Filter out "None" and "select" placeholder LoRAs (same pattern as text-to-image)
    const activeInfluencerLoRAs = params.loras.filter(lora => lora.modelName !== "None" && lora.modelName !== "select");
    const hasInfluencerLoRAs = activeInfluencerLoRAs.length > 0;
    const loraCount = activeInfluencerLoRAs.length;
    const lastLoraNodeId = hasInfluencerLoRAs ? `10${7 + loraCount}` : "108"; // 108, 109, 110, etc.

    const workflow: any = {
      // Initial FLUX generation
      "8": {
        inputs: {
          samples: ["104", 0],
          vae: ["102", 0],
        },
        class_type: "VAEDecode",
      },
      // Enhanced version using realistic checkpoint
      "31": {
        inputs: {
          ckpt_name: "epicrealismXL_v8Kiss.safetensors",
        },
        class_type: "CheckpointLoaderSimple",
      },
      "35": {
        inputs: {
          text: "Blurred, out of focus, low resolution, pixelated, cartoonish, unrealistic, overexposed, underexposed, flat lighting, distorted, artifacts, noise, extra limbs, deformed features, plastic skin, airbrushed, CGI, over-saturated colors, watermarks, text.",
          clip: ["115_2", 1],
        },
        class_type: "CLIPTextEncode",
      },
      "37": {
        inputs: {
          pixels: ["8", 0],
          vae: ["31", 2],
        },
        class_type: "VAEEncode",
      },
      "39": {
        inputs: {
          samples: ["41", 0],
          vae: ["31", 2],
        },
        class_type: "VAEDecode",
      },
      "41": {
        inputs: {
          seed: seed,
          steps: 25,
          cfg: 0.7,
          sampler_name: "dpmpp_2m",
          scheduler: "karras",
          denoise: 0.25, // Light enhancement
          model: ["115_2", 0],
          positive: ["113", 0],
          negative: ["35", 0],
          latent_image: ["37", 0], // Use encoded version of FLUX output
        },
        class_type: "KSampler",
      },
      "100": {
        inputs: {
          width: params.width,
          height: params.height,
          batch_size: params.batchSize,
        },
        class_type: "EmptyLatentImage",
      },
      "102": {
        inputs: {
          vae_name: "ae.safetensors",
        },
        class_type: "VAELoader",
      },
      "103": {
        inputs: {
          conditioning: ["106", 0],
          guidance: 4,
        },
        class_type: "FluxGuidance",
      },
      "104": {
        inputs: {
          seed: seed,
          steps: 40,
          cfg: 1,
          sampler_name: "heun",
          scheduler: "beta",
          denoise: 1,
          model: [lastLoraNodeId, 0], // Connect to last LoRA node's model output
          positive: ["103", 0],
          negative: ["107", 0],
          latent_image: ["100", 0],
        },
        class_type: "KSampler",
      },
      "105": {
        inputs: {
          text: "",
          clip: ["108", 1], // Always use first LoRA's CLIP output
        },
        class_type: "CLIPTextEncode",
      },
      "106": {
        inputs: {
          text: params.prompt, // Main user prompt
          clip: ["108", 1], // Always use first LoRA's CLIP output
        },
        class_type: "CLIPTextEncode",
      },
      "107": {
        inputs: {
          conditioning: ["105", 0],
        },
        class_type: "ConditioningZeroOut",
      },
      // First influencer LoRA (or fallback to enhancement LoRA)
      "108": {
        inputs: {
          model: ["118", 0],
          clip: ["119", 0],
          lora_name: hasInfluencerLoRAs
            ? activeInfluencerLoRAs[0].modelName
            : "real-humans-PublicPrompts.safetensors", // Use existing enhancement LoRA as fallback
          strength_model: hasInfluencerLoRAs
            ? activeInfluencerLoRAs[0].strength
            : 0.95,
          strength_clip: hasInfluencerLoRAs
            ? activeInfluencerLoRAs[0].strength
            : 0.95,
        },
        class_type: "LoraLoader",
      },
      "113": {
        inputs: {
          text: "closeup photo of a young woman with natural skin imperfections, fine skin pores, and realistic skin tones, photorealistic, soft diffused lighting, subsurface scattering, hyper-detailed shading, dynamic shadows, 8K resolution, cinematic lighting, masterpiece, intricate details, shot on a DSLR with a 50mm lens.", // Fixed enhancement prompt
          clip: ["115_2", 1],
        },
        class_type: "CLIPTextEncode",
      },
      "114": {
        inputs: {
          images: ["39", 0], // Save the enhanced result
          filename_prefix: "SkinEnhancer",
        },
        class_type: "SaveImage",
      },
      "115": {
        inputs: {
          model: ["31", 0],
          clip: ["31", 1],
          lora_name: "real-humans-PublicPrompts.safetensors",
          strength_model: 1.0,
          strength_clip: 1.0,
        },
        class_type: "LoraLoader",
      },
      "115_2": {
        inputs: {
          model: ["115", 0],
          clip: ["115", 1],
          lora_name: "more_details.safetensors",
          strength_model: 0.6,
          strength_clip: 0.6,
        },
        class_type: "LoraLoader",
      },
      "118": {
        inputs: {
          unet_name: "flux1-dev.safetensors",
          weight_dtype: "default",
        },
        class_type: "UNETLoader",
      },
      "119": {
        inputs: {
          clip_name1: "ViT-L-14-TEXT-detail-improved-hiT-GmP-HF.safetensors",
          clip_name2: "t5xxl_fp16.safetensors",
          type: "flux",
          device: "default",
        },
        class_type: "DualCLIPLoader",
      },
    };

    // Add additional chained influencer LoRA nodes if multiple LoRAs are configured
    if (hasInfluencerLoRAs && activeInfluencerLoRAs.length > 1) {
      for (let i = 1; i < activeInfluencerLoRAs.length; i++) {
        const nodeId = `10${8 + i}`; // 109, 110, 111, etc.
        const prevNodeId = i === 1 ? "108" : `10${7 + i}`; // Chain from previous LoRA node
        
        workflow[nodeId] = {
          inputs: {
            model: [prevNodeId, 0], // Connect to previous LoRA's model output
            lora_name: activeInfluencerLoRAs[i].modelName,
            strength_model: activeInfluencerLoRAs[i].strength,
            // Note: LoraLoaderModelOnly does NOT accept 'clip' or 'strength_clip' parameters
          },
          class_type: "LoraLoaderModelOnly",
        };
      }
    }

    console.log(
      "📋 Simplified skin enhancer workflow created with main prompt:",
      params.prompt
    );
    console.log(`🎭 Multi-LoRA: ${hasInfluencerLoRAs ? `${params.loras.length} influencer LoRAs` : 'Using fallback enhancement LoRA'}`);
    return workflow;
  };

  // Skin Comparison Component - Two-way comparison
  const SkinComparisonViewer = ({
    initial,
    final,
  }: {
    initial: DatabaseImage;
    final: DatabaseImage;
  }) => {
    const [sliderPosition, setSliderPosition] = useState(50);
    const [toggleState, setToggleState] = useState<"initial" | "final">(
      "initial"
    );

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
            <ArrowRightLeft className="w-5 h-5" />
            <span>Before & After Comparison</span>
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setComparisonMode("split")}
              className={`px-3 py-1 text-xs rounded ${
                comparisonMode === "split"
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              Split
            </button>
            <button
              onClick={() => setComparisonMode("overlay")}
              className={`px-3 py-1 text-xs rounded ${
                comparisonMode === "overlay"
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              Overlay
            </button>
            <button
              onClick={() => setComparisonMode("toggle")}
              className={`px-3 py-1 text-xs rounded ${
                comparisonMode === "toggle"
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              Toggle
            </button>
          </div>
        </div>

        {comparisonMode === "split" && (
          <div className="relative w-full max-w-4xl mx-auto">
            <div className="relative overflow-hidden rounded-lg">
              <div className="flex divide-x-2 divide-white">
                <div className="w-1/2 relative">
                  <img
                    src={(initial.dataUrl || initial.url) || ''}
                    alt="Before enhancement"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
                    Before
                  </div>
                </div>
                <div className="w-1/2 relative">
                  <img
                    src={(final.dataUrl || final.url) || ''}
                    alt="After enhancement"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs">
                    After
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {comparisonMode === "overlay" && (
          <div className="relative w-full max-w-2xl mx-auto">
            <div
              className="relative overflow-hidden rounded-lg"
              style={{ aspectRatio: "1" }}
            >
              {/* Final image (background) */}
              <img
                src={(final.dataUrl || final.url) || ''}
                alt="After enhancement"
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Initial image with clip-path */}
              <img
                src={(initial.dataUrl || initial.url) || ''}
                alt="Before enhancement"
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
                }}
              />
              {/* Slider line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
                style={{ left: `${sliderPosition}%` }}
              />
              {/* Labels */}
              <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
                Before
              </div>
              <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs">
                After
              </div>
            </div>
            {/* Slider control */}
            <div className="mt-4">
              <input
                type="range"
                min="0"
                max="100"
                value={sliderPosition}
                onChange={(e) => setSliderPosition(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Before</span>
                <span>After</span>
              </div>
            </div>
          </div>
        )}

        {comparisonMode === "toggle" && (
          <div className="relative w-full max-w-2xl mx-auto">
            <div className="relative overflow-hidden rounded-lg">
              <img
                src={
                  toggleState === "initial"
                    ? (initial.dataUrl || initial.url) || ''
                    : (final.dataUrl || final.url) || ''
                }
                alt={`${
                  toggleState === "initial" ? "Before" : "After"
                } enhancement`}
                className="w-full rounded-lg"
              />
              <div
                className={`absolute top-2 left-2 px-2 py-1 rounded text-xs text-white ${
                  toggleState === "initial" ? "bg-blue-500" : "bg-green-500"
                }`}
              >
                {toggleState === "initial" ? "Before" : "After"}
              </div>
            </div>
            <div className="mt-4 flex justify-center space-x-2">
              <button
                onClick={() => setToggleState("initial")}
                className={`px-3 py-2 rounded-lg flex items-center space-x-1 text-sm ${
                  toggleState === "initial"
                    ? "bg-blue-500 text-white"
                    : "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30"
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>Before</span>
              </button>
              <button
                onClick={() => setToggleState("final")}
                className={`px-3 py-2 rounded-lg flex items-center space-x-1 text-sm ${
                  toggleState === "final"
                    ? "bg-green-500 text-white"
                    : "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30"
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>After</span>
              </button>
            </div>
          </div>
        )}

        {/* Download buttons */}
        <div className="mt-4 flex justify-center space-x-2">
          <button
            onClick={() => downloadDatabaseImage(initial)}
            className="px-3 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 flex items-center space-x-1 text-sm"
          >
            <Download className="w-4 h-4" />
            <span>Before</span>
          </button>
          <button
            onClick={() => downloadDatabaseImage(final)}
            className="px-3 py-2 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/30 flex items-center space-x-1 text-sm"
          >
            <Download className="w-4 h-4" />
            <span>After</span>
          </button>
        </div>
      </div>
    );
  };

  // Show loading state while API client initializes
  if (!apiClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-950 dark:via-purple-950/30 dark:to-blue-950/30 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <p className="text-gray-600 dark:text-gray-300">
                Initializing API client...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-950 dark:via-purple-950/30 dark:to-blue-950/30 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-2xl shadow-lg animate-pulse">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 dark:from-purple-400 dark:via-pink-400 dark:to-blue-400 bg-clip-text text-transparent">
              Skin Enhancer Studio
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Perfect skin texture and glowing portraits with Flux-inspired AI enhancements tailored for natural results.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        {/* Left Panel - Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Folder Selection */}
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-lg sm:rounded-xl shadow-lg">
                  <Archive className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <label className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  Save to Vault
                </label>
              </div>

              <div className="relative">
                <select
                  value={targetFolder}
                  onChange={(e) => {
                    setTargetFolder(e.target.value);
                  }}
                  disabled={isLoadingVaultData || isGenerating}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 pr-8 sm:pr-10 bg-gray-800 border-2 border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-inner text-sm sm:text-base [&>option]:bg-gray-800 [&>option]:text-white [&>optgroup]:bg-gray-800 [&>optgroup]:text-gray-400"
                >
                  <option value="">Select a vault folder...</option>
                  
                  {/* Vault Folders by Profile - Each profile as its own optgroup */}
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
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {isLoadingVaultData ? (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Folder type indicator with badge */}
              <div className="flex items-center gap-2">
                {targetFolder && targetFolder.startsWith('vault:') && (
                  <div className="flex items-center gap-1.5 rounded-full bg-purple-500/20 px-2.5 py-1 text-[11px] text-purple-600 dark:text-purple-300">
                    <Archive className="w-3 h-3" />
                    <span>Vault Storage</span>
                  </div>
                )}
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 flex-1">
                  {getSelectedFolderDisplay()}
                </p>
              </div>
            </div>
          </div>

          {/* Prompt Input */}
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 text-pink-600 dark:text-pink-400" />
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">Enhancement Prompt</h2>
              </div>
              <button
                onClick={() => setParams((prev) => ({ ...prev, prompt: "" }))}
                className="text-xs font-semibold text-purple-600 hover:text-pink-600 dark:text-purple-400 dark:hover:text-pink-300 transition-colors"
              >
                Clear
              </button>
            </div>
            <textarea
              value={params.prompt}
              onChange={(e) =>
                setParams((prev) => ({ ...prev, prompt: e.target.value }))
              }
              placeholder="Describe the enhancement you want..."
              className="w-full h-24 sm:h-28 md:h-36 px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 shadow-inner transition-all"
            />
            <div className="mt-2 flex flex-col xs:flex-row items-start xs:items-center justify-between gap-1 xs:gap-0 text-xs text-gray-500 dark:text-gray-400">
              <span className="hidden xs:inline">💡 Tip: Highlight lighting, texture, and desired mood for best results.</span>
              <span className="xs:hidden">💡 Tip: Describe lighting, texture & mood</span>
              <span>{params.prompt.length}/1000</span>
            </div>
          </div>

          {/* Settings */}
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">Advanced Settings</h2>
              </div>
              <span className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold rounded-full bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 text-purple-600 dark:text-purple-300">
                Pro Controls
              </span>
            </div>

            {/* Multi-Influencer LoRA Model Selection */}
            <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Influencer Models (Optional)
                </span>
                <button
                  onClick={addLoRA}
                  disabled={loadingLoRAs || isGenerating}
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white text-xs font-semibold shadow-lg hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add LoRA</span>
                </button>
              </div>

              {loadingLoRAs ? (
                <div className="flex items-center gap-2 p-4 border border-dashed border-purple-300 dark:border-purple-700 rounded-2xl bg-purple-50/60 dark:bg-purple-900/20 text-sm text-purple-600 dark:text-purple-300">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading influencer models...
                </div>
              ) : (
                <div className="space-y-3">
                  {params.loras.length === 0 ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl text-center">
                      No influencer LoRAs selected yet. Click "Add LoRA" to layer your signature looks.
                    </div>
                  ) : (
                    params.loras.map((lora, index) => (
                      <div
                        key={lora.id}
                        className="p-4 border border-purple-200 dark:border-purple-800 rounded-2xl bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-purple-900/10 dark:via-pink-900/10 dark:to-blue-900/10 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                            Influencer LoRA #{index + 1}
                          </span>
                          <button
                            onClick={() => removeLoRA(lora.id)}
                            disabled={isGenerating}
                            className="p-1 rounded-lg bg-white/70 dark:bg-gray-900/50 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 transition-colors disabled:opacity-50"
                            title="Remove LoRA"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                            Model
                          </label>
                          <select
                            value={lora.modelName}
                            onChange={(e) =>
                              updateLoRA(lora.id, "modelName", e.target.value)
                            }
                            disabled={isGenerating}
                            className="w-full px-3 py-2 border-2 border-purple-200 dark:border-purple-700 rounded-xl bg-white dark:bg-gray-900/70 text-gray-900 dark:text-white text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500 transition-all disabled:opacity-50"
                          >
                            <option value="select" disabled>
                              Select a LoRA
                            </option>
                            {availableInfluencerLoRAs
                              .filter((l) => l.fileName !== "None")
                              .map((loraModel) => (
                                <option
                                  key={loraModel.fileName}
                                  value={loraModel.fileName}
                                >
                                  {loraModel.displayName}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                              Strength
                            </span>
                            <span className="text-xs font-mono text-purple-600 dark:text-purple-300 bg-white/70 dark:bg-gray-900/60 px-2 py-0.5 rounded-full">
                              {lora.strength.toFixed(2)}
                            </span>
                          </div>
                          <div className="relative h-2 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded-full">
                            <div
                              className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-full"
                              style={{ width: `${lora.strength * 100}%` }}
                            ></div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={lora.strength}
                              onChange={(e) =>
                                updateLoRA(
                                  lora.id,
                                  "strength",
                                  parseFloat(e.target.value)
                                )
                              }
                              disabled={isGenerating}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {params.loras.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-300">
                  <CheckCircle className="w-3 h-3" />
                  <span>
                    Using {params.loras.length} influencer {params.loras.length > 1 ? "LoRAs" : "LoRA"}
                  </span>
                </div>
              )}
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-3 sm:space-y-4">
              <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                Output Size
              </span>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                {ASPECT_RATIOS.map((ratio) => {
                  const isActive = params.width === ratio.width && params.height === ratio.height;
                  return (
                    <button
                      key={ratio.name}
                      onClick={() => handleAspectRatioChange(ratio.width, ratio.height)}
                      className={`p-2.5 sm:p-3 md:p-4 rounded-xl border-2 text-xs sm:text-sm font-semibold transition-all duration-300 bg-white/70 dark:bg-gray-900/40 backdrop-blur-sm text-left hover:scale-[1.01] active:scale-95 ${
                        isActive
                          ? "border-purple-500 shadow-lg text-purple-700 dark:text-purple-200"
                          : "border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-purple-300 dark:hover:border-purple-500"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 sm:mb-2">
                        <span>{ratio.name}</span>
                        {isActive && <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" />}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                        {ratio.width}×{ratio.height} • {ratio.ratio}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-0.5 sm:mt-1">
                        {ratio.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Batch Size Slider */}
            <div className="space-y-3 sm:space-y-4 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" />
                  Batch Size
                </span>
                <div className="px-2 sm:px-3 py-1 rounded-full bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 text-[10px] sm:text-xs font-semibold text-purple-700 dark:text-purple-200">
                  {params.batchSize} {params.batchSize > 1 ? "images" : "image"}
                </div>
              </div>

              <div className="relative">
                <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${(params.batchSize / 15) * 100}%` }}
                  ></div>
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-white dark:bg-gray-200 border-2 border-purple-500 rounded-full shadow-lg ring-4 ring-purple-200/50 dark:ring-purple-400/30 transition-all"
                    style={{ left: `${(params.batchSize / 15) * 100}%` }}
                  ></div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  value={params.batchSize}
                  onChange={(e) => setParams((prev) => ({ ...prev, batchSize: parseInt(e.target.value) }))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex justify-between mt-3 px-1">
                  {[1, 5, 10, 15].map((marker) => (
                    <div key={marker} className="flex flex-col items-center">
                      <div
                        className={`w-1 h-2 rounded-full ${
                          params.batchSize >= marker
                            ? "bg-purple-500"
                            : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      ></div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{marker}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Generate multiple enhanced versions in one batch. Higher batch sizes may take longer to process.
              </p>
            </div>
          </div>

          {/* Enhance Button */}
          <button
            onClick={handleEnhance}
            disabled={isGenerating || !params.prompt.trim() || !targetFolder}
            className="group w-full py-3 sm:py-4 md:py-5 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white font-bold text-sm sm:text-base md:text-lg rounded-2xl hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 sm:gap-3 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                <span>Enhancing Beauty...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 group-hover:rotate-12 transition-transform duration-300" />
                <span>Enhance Skin ✨</span>
              </>
            )}
          </button>

          {!targetFolder && !isGenerating && (
            <p className="text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 -mt-2">
              Please select a folder before enhancing.
            </p>
          )}
        </div>

        {/* Right Panel - Results */}
        <div className="space-y-4 sm:space-y-6">
          {/* Image Statistics */}
          {imageStats && (
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
              <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                <Archive className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
                Your Image Library
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                <div className="p-2 sm:p-3 rounded-xl bg-purple-50/70 dark:bg-purple-900/20 border border-purple-200/70 dark:border-purple-800/60">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total Images</p>
                  <p className="text-base sm:text-lg font-semibold text-purple-600 dark:text-purple-300">
                    {imageStats.totalImages}
                  </p>
                </div>
                <div className="p-2 sm:p-3 rounded-xl bg-blue-50/70 dark:bg-blue-900/20 border border-blue-200/70 dark:border-blue-800/60">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total Size</p>
                  <p className="text-base sm:text-lg font-semibold text-blue-600 dark:text-blue-300">
                    {Math.round((imageStats.totalSize / 1024 / 1024) * 100) /
                      100}{" "}
                    MB
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Current Enhancement */}
          {currentJob && (
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
                  <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                    Current Enhancement
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {(currentJob.status === "processing" || currentJob.status === "pending") && (
                    <button
                      onClick={() => checkJobStatus(currentJob.id)}
                      className="p-1.5 sm:p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/40 hover:bg-gradient-to-br hover:from-purple-500/90 hover:to-blue-500/90 hover:text-white transition-all duration-200 active:scale-95"
                      title="Check job status"
                    >
                      <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                  {currentJob.status === "completed" && (
                    <button
                      onClick={() => {
                        console.log("🔄 Manual refresh clicked for job:", currentJob.id);
                        console.log("🔄 Current job state:", currentJob);
                        fetchJobImages(currentJob.id);
                      }}
                      className="p-1.5 sm:p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/40 hover:bg-gradient-to-br hover:from-purple-500/90 hover:to-blue-500/90 hover:text-white transition-all duration-200 active:scale-95"
                      title="Refresh enhanced images"
                    >
                      <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                  {currentJob.status === "failed" && (
                    <button
                      onClick={() => checkJobStatus(currentJob.id)}
                      className="p-1.5 sm:p-2 rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-300 transition-colors active:scale-95"
                      title="Recheck job status"
                    >
                      <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4 sm:space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Status
                  </span>
                  <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 text-[10px] sm:text-xs font-semibold text-purple-700 dark:text-purple-200">
                    {(currentJob.status === "pending" || currentJob.status === "processing") && (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    )}
                    {currentJob.status === "completed" && <CheckCircle className="w-3 h-3" />}
                    {currentJob.status === "failed" && !isJobCancelled(currentJob) && <AlertCircle className="w-3 h-3" />}
                    {currentJob.status === "failed" && isJobCancelled(currentJob) && <XCircle className="w-3 h-3" />}
                    <span className="capitalize">
                      {currentJob.status === "failed" && isJobCancelled(currentJob)
                        ? "cancelled"
                        : currentJob.status}
                      {currentJob.status === "processing" && <span className="hidden sm:inline"> • may take 3-5 minutes</span>}
                    </span>
                  </div>
                </div>

                {currentJob.progress !== undefined && currentJob.status !== "failed" && !isJobCancelled(currentJob) && (
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400">
                        Progress
                        {currentJob.imagesReady && currentJob.totalImages && (
                          <span className="ml-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                            Image {currentJob.imagesReady} of {currentJob.totalImages}
                          </span>
                        )}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-purple-600 dark:text-purple-300">
                        {Number(currentJob.progress) && !isNaN(Number(currentJob.progress)) && Math.round(Number(currentJob.progress)) >= 0
                          ? Math.round(Number(currentJob.progress))
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 transition-all duration-500"
                        style={{
                          width: `${
                            Number(currentJob.progress) && !isNaN(Number(currentJob.progress)) && Math.round(Number(currentJob.progress)) >= 0
                              ? Math.round(Number(currentJob.progress))
                              : 0
                          }%`,
                        }}
                      ></div>
                    </div>
                    {currentJob.status === "processing" && currentJob.progress < 90 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Skin enhancement is a delicate process. Hang tight while we perfect the details.
                      </p>
                    )}
                  </div>
                )}

                {currentJob.status === "completed" && (!currentJob.resultUrls || currentJob.resultUrls.length === 0) && (!jobImages[currentJob.id] || jobImages[currentJob.id].length === 0) && (
                  <div className="space-y-3 sm:space-y-4">
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Enhanced Images
                    </h4>
                    <div className="text-center py-6 sm:py-8 rounded-2xl border border-dashed border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/10">
                      <div className="flex items-center justify-center gap-2 text-purple-600 dark:text-purple-300 mb-2 sm:mb-3">
                        <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                        <span className="text-xs sm:text-sm">Loading enhanced images...</span>
                      </div>
                      <button
                        onClick={() => fetchJobImages(currentJob.id)}
                        className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white text-xs sm:text-sm font-semibold shadow-lg hover:shadow-2xl transition-all active:scale-95"
                      >
                        <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Refresh Images
                      </button>
                    </div>
                  </div>
                )}

                {((currentJob.resultUrls && currentJob.resultUrls.length > 0) || (jobImages[currentJob.id] && jobImages[currentJob.id].length > 0)) && (
                  <div className="space-y-4" id={`job-images-${currentJob.id}`}>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Enhanced Images
                      </h4>
                      {comparisonImages.initial && comparisonImages.final && (
                        <button
                          onClick={() => setShowComparison(!showComparison)}
                          className="px-3 py-1 rounded-xl bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 text-purple-600 dark:text-purple-300 text-sm font-semibold hover:shadow-md transition-all flex items-center gap-2"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                          {showComparison ? "Hide" : "Show"} Comparison
                        </button>
                      )}
                    </div>

                    {showComparison && comparisonImages.initial && comparisonImages.final && (
                      <SkinComparisonViewer initial={comparisonImages.initial} final={comparisonImages.final} />
                    )}

                    <div className="grid grid-cols-1 gap-4">
                      {jobImages[currentJob.id] && jobImages[currentJob.id].length > 0
                        ? jobImages[currentJob.id].map((dbImage, index) => (
                            <div key={`db-${dbImage.id}`} className="relative group">
                              {(dbImage.dataUrl || dbImage.url) ? (
                                <div className="relative overflow-hidden rounded-2xl border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-2">
                                  <div className="relative w-full h-80 bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden">
                                    <img
                                      src={(dbImage.dataUrl || dbImage.url) as string}
                                      alt={`Enhanced image ${index + 1}`}
                                      className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                                      onError={(e) => {
                                        console.error("Image load error for:", dbImage.filename);
                                        const element = e.target as HTMLImageElement;
                                        const currentSrc = element.src;
                                        if (currentSrc === dbImage.dataUrl && dbImage.url) {
                                          element.src = dbImage.url;
                                        } else if (currentSrc === dbImage.url && dbImage.dataUrl) {
                                          element.src = dbImage.dataUrl;
                                        } else {
                                          element.style.display = "none";
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full h-64 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400">
                                  <div className="text-center text-xs">
                                    <p>Image not available</p>
                                    <p>{dbImage.filename}</p>
                                  </div>
                                </div>
                              )}

                              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => downloadDatabaseImage(dbImage)}
                                    className="p-2 rounded-xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 hover:bg-gradient-to-br hover:from-blue-500 hover:to-blue-600 hover:text-white shadow-lg transition-all"
                                    title={`Download ${dbImage.filename}`}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => shareImage(dbImage)}
                                    className="p-2 rounded-xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 hover:bg-gradient-to-br hover:from-purple-500 hover:to-pink-600 hover:text-white shadow-lg transition-all"
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-sm text-white text-xs">
                                  {dbImage.width && dbImage.height ? `${dbImage.width}×${dbImage.height}` : "Unknown size"}
                                  {dbImage.fileSize && ` • ${Math.round(dbImage.fileSize / 1024)}KB`}
                                  {dbImage.format && ` • ${dbImage.format.toUpperCase()}`}
                                </div>
                              </div>
                            </div>
                          ))
                        : currentJob.resultUrls &&
                          currentJob.resultUrls.length > 0 &&
                          currentJob.resultUrls.map((url, index) => (
                            <div key={`legacy-${currentJob.id}-${index}`} className="relative group">
                              <div className="relative overflow-hidden rounded-2xl border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-2">
                                <div className="relative w-full h-80 bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden">
                                  <img
                                    src={url}
                                    alt={`Enhanced image ${index + 1}`}
                                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                                    onError={(e) => {
                                      console.error("Legacy image load error:", url);
                                      (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => downloadFromUrl(url, `enhanced-image-${index + 1}.png`)}
                                    className="p-2 rounded-xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 hover:bg-gradient-to-br hover:from-blue-500 hover:to-blue-600 hover:text-white shadow-lg transition-all"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(url);
                                      alert("Image URL copied to clipboard!");
                                    }}
                                    className="p-2 rounded-xl bg-white/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 hover:bg-gradient-to-br hover:from-purple-500 hover:to-pink-600 hover:text-white shadow-lg transition-all"
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

                {currentJob.error && !isJobCancelled(currentJob) && (
                  <div className="p-4 rounded-2xl border border-red-200 dark:border-red-800 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/30 dark:to-pink-900/30">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-red-600 dark:text-red-300 mb-2">
                          {currentJob.error}
                        </p>
                        {currentJob.error.includes("timeout") && (
                          <p className="text-xs text-red-500 dark:text-red-300">
                            The job may still be processing. Try checking status or start a new enhancement.
                          </p>
                        )}
                      </div>
                      {currentJob.status === "failed" && (
                        <button
                          onClick={() => checkJobStatus(currentJob.id)}
                          className="px-3 py-1.5 rounded-xl bg-red-100 dark:bg-red-800 text-red-600 dark:text-red-200 text-xs font-semibold hover:bg-red-200 dark:hover:bg-red-700"
                        >
                          Check Status
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {isGenerating && currentJob && (
                  <button
                    onClick={cancelGeneration}
                    className="group w-full py-3 sm:py-4 bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 dark:from-gray-600 dark:via-gray-700 dark:to-gray-800 text-white font-semibold text-sm sm:text-base rounded-2xl hover:from-purple-600 hover:via-pink-600 hover:to-blue-600 transition-all duration-300 shadow-xl hover:shadow-2xl flex items-center justify-center gap-2 relative overflow-hidden active:scale-95"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    <XCircle className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform duration-300" />
                    <span>Cancel Enhancement</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Recent Enhancements - Persistent History */}
          {jobHistory.length > 0 && (
            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-5">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 dark:text-purple-400" />
                  <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                    Recent Enhancements
                  </h3>
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {jobHistory.length}/5 jobs
                </span>
              </div>
              <div className="space-y-2 sm:space-y-3 max-h-96 overflow-y-auto pr-1">
                {jobHistory
                  .filter((job) => job && job.id)
                  .slice(0, 5)
                  .map((job, index) => {
                    const statusBadge = (() => {
                      if (job.status === "completed") {
                        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
                      }
                      if (job.status === "failed" && isJobCancelled(job)) {
                        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
                      }
                      if (job.status === "failed") {
                        return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300";
                      }
                      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
                    })();

                    return (
                      <div
                        key={job.id || `job-${index}`}
                        className="flex items-center justify-between p-2.5 sm:p-3 md:p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/40 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-lg transition-all"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div
                            className={`px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${statusBadge}`}
                          >
                            {job.status === "failed" && isJobCancelled(job)
                              ? "cancelled"
                              : job.status || "unknown"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {formatJobTime(job.createdAt)}
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                              Job ID: {job.id}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                          {job.status === "completed" && jobImages[job.id]?.length > 0 && (
                            <button
                              onClick={() => {
                                const imageSection = document.getElementById(`job-images-${job.id}`);
                                imageSection?.scrollIntoView({ behavior: "smooth" });
                              }}
                              className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-lg transition-all active:scale-95"
                            >
                              View Results
                            </button>
                          )}
                          {(job.status === "pending" || job.status === "processing") && job.id === currentJob?.id && (
                            <button
                              onClick={() => checkJobStatus(job.id)}
                              className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-lg transition-all active:scale-95"
                            >
                              Refresh
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);
}
