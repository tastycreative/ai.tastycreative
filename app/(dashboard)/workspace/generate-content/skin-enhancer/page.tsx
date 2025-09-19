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
  Eye,
  EyeOff,
  Layers,
  XCircle,
} from "lucide-react";

// Types
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
  url?: string; // Dynamically constructed ComfyUI URL
  dataUrl?: string; // Database-served image URL
  createdAt: Date | string;
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

  // Database image states
  const [jobImages, setJobImages] = useState<Record<string, DatabaseImage[]>>(
    {}
  );
  const [imageStats, setImageStats] = useState<any>(null);

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
            // Ensure we only keep valid jobs and limit to 5
            const validHistory = parsedHistory
              .filter(job => job && job.id)
              .slice(0, 5)
              .map(job => ({
                ...job,
                createdAt: typeof job.createdAt === 'string' ? new Date(job.createdAt) : job.createdAt
              }));
            setJobHistory(validHistory);
            console.log("📚 Loaded job history from localStorage:", validHistory.length, "jobs");
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

        // Set up comparison images for two-way comparison
        const initialImage = data.images.find(
          (img: DatabaseImage) =>
            img.filename.includes("flux_initial") ||
            img.filename.includes("initial")
        );
        const finalImage = data.images.find(
          (img: DatabaseImage) =>
            img.filename.includes("skin_enhanced") &&
            !img.filename.includes("intermediate")
        );

        if (initialImage && finalImage) {
          console.log("🔄 Found initial and final images:", {
            initial: initialImage.filename,
            final: finalImage.filename,
          });
        } else if (data.images.length >= 2) {
          // Fallback: use first and last images
          console.log("🔄 Found comparison images (fallback):", {
            initial: data.images[0].filename,
            final: data.images[data.images.length - 1].filename,
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

  // Fetch available influencer LoRA models on component mount
  useEffect(() => {
    const fetchInfluencerLoRAModels = async () => {
      if (!apiClient) return;

      try {
        setLoadingLoRAs(true);
        console.log("=== FETCHING INFLUENCER LORA MODELS ===");

        const response = await apiClient.get("/api/models/loras");
        console.log("LoRA API response status:", response.status);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("LoRA API response data:", data);

        if (data.success && data.models && Array.isArray(data.models)) {
          console.log("Available influencer LoRA models:", data.models);
          setAvailableInfluencerLoRAs(data.models);

          // Set default LoRA if current selection isn't available
          const currentLoRAExists = data.models.some(
            (lora: LoRAModel) => lora.fileName === params.selectedInfluencerLora
          );
          if (!currentLoRAExists) {
            const defaultLora =
              data.models.find((lora: LoRAModel) => lora.fileName === "None")
                ?.fileName ||
              data.models[0]?.fileName ||
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

      const workflow = createSkinEnhancerWorkflowJson(params);
      console.log("Created skin enhancer workflow for submission");

      // Update progress
      updateGlobalProgress({
        isGenerating: true,
        progress: 10,
        stage: 'Submitting to AI...',
        message: 'Sending your enhancement request',
        generationType: 'skin-enhancer',
        jobId: null
      });

      const response = await apiClient.post("/api/generate/skin-enhancer", {
        workflow,
        params,
      });

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
  const createSkinEnhancerWorkflowJson = (params: EnhancementParams) => {
    const seed = params.seed || Math.floor(Math.random() * 1000000000);
    const useInfluencerLoRA = params.selectedInfluencerLora !== "None";

    const workflow: any = {
      // Initial FLUX generation
      "8": {
        inputs: {
          samples: ["104", 0],
          vae: ["102", 0],
        },
        class_type: "VAEDecode",
      },
      "8_save": {
        inputs: {
          images: ["8", 0],
          filename_prefix: "flux_initial",
        },
        class_type: "SaveImage",
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
          model: ["108", 0],
          positive: ["103", 0],
          negative: ["107", 0],
          latent_image: ["100", 0],
        },
        class_type: "KSampler",
      },
      "105": {
        inputs: {
          text: "",
          clip: ["108", 1],
        },
        class_type: "CLIPTextEncode",
      },
      "106": {
        inputs: {
          text: params.prompt, // Main user prompt
          clip: ["108", 1],
        },
        class_type: "CLIPTextEncode",
      },
      "107": {
        inputs: {
          conditioning: ["105", 0],
        },
        class_type: "ConditioningZeroOut",
      },
      "108": {
        inputs: {
          model: ["118", 0],
          clip: ["119", 0],
          lora_name: useInfluencerLoRA
            ? params.selectedInfluencerLora
            : "real-humans-PublicPrompts.safetensors", // Use existing enhancement LoRA as fallback
          strength_model: useInfluencerLoRA
            ? params.influencerLoraStrength
            : 0.95,
          strength_clip: useInfluencerLoRA
            ? params.influencerLoraStrength
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
          filename_prefix: "skin_enhanced",
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

    console.log(
      "📋 Simplified skin enhancer workflow created with main prompt:",
      params.prompt
    );
    return workflow;
  };

  // Skin Comparison Component - Two-way comparison
  // Show loading state while API client initializes
  if (!apiClient) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Initializing API client...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-green-600 to-teal-700 rounded-3xl shadow-2xl border border-emerald-200 dark:border-emerald-800 p-8 text-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30 shadow-lg">
              <div className="relative">
                <Sparkles className="w-10 h-10 text-white drop-shadow-sm" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-teal-400 rounded-full flex items-center justify-center">
                  <Eye className="w-3 h-3 text-teal-800" />
                </div>
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2 drop-shadow-sm flex items-center space-x-3">
                <span>Skin Enhancer</span>
                <span className="text-2xl">✨</span>
              </h1>
              <p className="text-emerald-100 text-lg font-medium opacity-90 mb-2">
                Perfect skin texture and details with AI-powered enhancement
              </p>
              <div className="flex items-center space-x-4 text-sm text-emerald-100">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>AI Enhancement</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-emerald-300 rounded-full"></div>
                  <span>Natural Results</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-teal-300 rounded-full"></div>
                  <span>Skin Perfect</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 mb-1">
                  <Sparkles className="w-4 h-4 text-teal-300" />
                  <span className="text-sm font-semibold text-white">
                    Skin AI
                  </span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-200 font-medium">
                    Ready
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prompt Input */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enhancement Prompt
                </label>
                <button
                  onClick={() => setParams((prev) => ({ ...prev, prompt: "" }))}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
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
                className="w-full h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {params.prompt.length}/1000 characters
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Settings
            </h3>

            {/* Influencer LoRA Model Selection */}
            <div className="space-y-3 mb-6">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Influencer Model (Optional)
              </label>

              {loadingLoRAs ? (
                <div className="flex items-center space-x-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-gray-500">
                    Loading influencer models...
                  </span>
                </div>
              ) : (
                <select
                  value={params.selectedInfluencerLora}
                  onChange={(e) =>
                    setParams((prev) => ({
                      ...prev,
                      selectedInfluencerLora: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {availableInfluencerLoRAs.map((lora, index) => (
                    <option
                      key={`${lora.fileName}-${index}`}
                      value={lora.fileName}
                    >
                      {lora.displayName}
                    </option>
                  ))}
                </select>
              )}

              {params.selectedInfluencerLora !== "None" && (
                <div className="text-xs text-green-600 dark:text-green-400">
                  Using influencer model:{" "}
                  {availableInfluencerLoRAs.find(
                    (lora) => lora.fileName === params.selectedInfluencerLora
                  )?.displayName || params.selectedInfluencerLora}
                </div>
              )}
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Output Size
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.name}
                    onClick={() =>
                      handleAspectRatioChange(ratio.width, ratio.height)
                    }
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                      params.width === ratio.width &&
                      params.height === ratio.height
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <div className="font-semibold">{ratio.name}</div>
                    <div className="text-xs opacity-75">
                      {ratio.width}×{ratio.height}
                    </div>
                    <div className="text-xs opacity-60 mt-1">
                      {ratio.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Batch Size Slider */}
            <div className="space-y-4 mb-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                  <Layers className="w-4 h-4 mr-2 text-green-600" />
                  Batch Size
                </label>
                <div className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 px-3 py-1 rounded-full">
                  <span className="text-sm font-bold text-green-700 dark:text-green-300">
                    {params.batchSize} {params.batchSize > 1 ? 'images' : 'image'}
                  </span>
                </div>
              </div>
              
              <div className="relative">
                {/* Slider Track */}
                <div className="relative h-2 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded-full shadow-inner">
                  {/* Progress Fill */}
                  <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 rounded-full shadow-lg transition-all duration-300 ease-out"
                    style={{ width: `${(params.batchSize / 15) * 100}%` }}
                  />
                  
                  {/* Slider Handle */}
                  <div 
                    className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-white dark:bg-gray-200 border-2 border-green-500 rounded-full shadow-lg cursor-pointer hover:scale-110 transition-all duration-200 ring-4 ring-green-200/50 dark:ring-green-400/30"
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
                          ? 'bg-green-500' 
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
                Generate multiple enhanced versions in one batch. Higher batch sizes may take longer to process.
              </p>
            </div>
          </div>

          {/* Enhance Button */}
          <button
            onClick={handleEnhance}
            disabled={isGenerating || !params.prompt.trim()}
            className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center space-x-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Enhancing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Enhance Skin</span>
              </>
            )}
          </button>
        </div>

        {/* Right Panel - Results */}
        <div className="space-y-6">
          {/* Image Statistics */}
          {imageStats && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Your Image Library
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Total Images:
                  </span>
                  <span className="ml-2 font-medium">
                    {imageStats.totalImages}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Total Size:
                  </span>
                  <span className="ml-2 font-medium">
                    {Math.round((imageStats.totalSize / 1024 / 1024) * 100) /
                      100}{" "}
                    MB
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Current Enhancement */}
          {currentJob && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Current Enhancement
                </h3>
                <div className="flex space-x-2">
                  {(currentJob.status === "processing" ||
                    currentJob.status === "pending") && (
                    <button
                      onClick={() => checkJobStatus(currentJob.id)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Check job status"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  {currentJob.status === "completed" && (
                    <button
                      onClick={() => {
                        console.log("🔄 Manual refresh clicked for job:", currentJob.id);
                        console.log("🔄 Current job state:", currentJob);
                        fetchJobImages(currentJob.id);
                      }}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Refresh enhanced images"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  {currentJob.status === "failed" && (
                    <button
                      onClick={() => checkJobStatus(currentJob.id)}
                      className="p-2 text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/20"
                      title="Recheck job status"
                    >
                      <RefreshCw className="w-4 h-4" />
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
                      <Loader2 className="w-4 h-4 animate-spin text-green-500" />
                    )}
                    {currentJob.status === "completed" && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    {currentJob.status === "failed" && !isJobCancelled(currentJob) && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    {currentJob.status === "failed" && isJobCancelled(currentJob) && (
                      <XCircle className="w-4 h-4 text-orange-500" />
                    )}
                    <span className="text-sm font-medium capitalize">
                      {currentJob.status === "failed" && isJobCancelled(currentJob)
                        ? "cancelled"
                        : currentJob.status}
                      {currentJob.status === "processing" &&
                        " (may take 3-5 minutes)"}
                    </span>
                  </div>
                </div>

                {currentJob.progress !== undefined && 
                 currentJob.status !== "failed" && 
                 !isJobCancelled(currentJob) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Progress
                        {currentJob.imagesReady && currentJob.totalImages && (
                          <span className="ml-2 text-xs">
                            (Image {currentJob.imagesReady} of {currentJob.totalImages})
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-medium">
                        {Number(currentJob.progress) && !isNaN(Number(currentJob.progress)) && Math.round(Number(currentJob.progress)) >= 0 ? Math.round(Number(currentJob.progress)) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Number(currentJob.progress) && !isNaN(Number(currentJob.progress)) && Math.round(Number(currentJob.progress)) >= 0 ? Math.round(Number(currentJob.progress)) : 0}%` }}
                      />
                    </div>
                    {currentJob.status === "processing" &&
                      currentJob.progress < 90 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Skin enhancement is a complex process. Please be
                          patient...
                        </p>
                      )}
                  </div>
                )}

                {/* Show loading or no images message for completed jobs */}
                {currentJob.status === "completed" &&
                  (!currentJob.resultUrls ||
                    currentJob.resultUrls.length === 0) &&
                  (!jobImages[currentJob.id] ||
                    jobImages[currentJob.id].length === 0) && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Enhanced Images
                      </h4>
                      <div className="text-center py-8">
                        <div className="flex items-center justify-center space-x-2 text-gray-500 dark:text-gray-400 mb-3">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span className="text-sm">
                            Loading enhanced images...
                          </span>
                        </div>
                        <button
                          onClick={() => fetchJobImages(currentJob.id)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                        >
                          Refresh Images
                        </button>
                      </div>
                    </div>
                  )}

                {/* Enhanced image display with dynamic URL support */}
                {((currentJob.resultUrls && currentJob.resultUrls.length > 0) ||
                  (jobImages[currentJob.id] &&
                    jobImages[currentJob.id].length > 0)) && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 rounded-lg">
                        <Eye className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                          Enhanced Images
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Your AI-enhanced skin perfection results
                        </p>
                      </div>
                    </div>

                    {/* Simple Grid Layout based on batch size */}
                    <div className={`grid gap-4 ${
                      jobImages[currentJob.id]?.length === 1 
                        ? 'grid-cols-1 max-w-md mx-auto'
                        : jobImages[currentJob.id]?.length === 2 
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : jobImages[currentJob.id]?.length === 3
                        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                    }`}>
                      {/* Show database images if available */}
                      {jobImages[currentJob.id] &&
                      jobImages[currentJob.id].length > 0
                        ? // Database images with dynamic URLs
                          jobImages[currentJob.id].map((dbImage, index) => (
                            <div
                              key={`db-${dbImage.id}`}
                              className="group relative rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200"
                            >
                              <img
                                src={dbImage.dataUrl || dbImage.url}
                                alt={`Enhanced image ${index + 1}`}
                                className="w-full h-auto object-cover"
                                onError={(e) => {
                                  console.error(
                                    "Image load error for:",
                                    dbImage.filename
                                  );

                                  // Smart fallback logic
                                  const currentSrc = (
                                    e.target as HTMLImageElement
                                  ).src;

                                  if (
                                    currentSrc === dbImage.dataUrl &&
                                    dbImage.url
                                  ) {
                                    console.log("Falling back to ComfyUI URL");
                                    (e.target as HTMLImageElement).src =
                                      dbImage.url;
                                  } else if (
                                    currentSrc === dbImage.url &&
                                    dbImage.dataUrl
                                  ) {
                                    console.log("Falling back to database URL");
                                    (e.target as HTMLImageElement).src =
                                      dbImage.dataUrl;
                                  } else {
                                    console.error(
                                      "All URLs failed for:",
                                      dbImage.filename
                                    );
                                    (
                                      e.target as HTMLImageElement
                                    ).style.display = "none";
                                  }
                                }}
                              />
                              
                              {/* Simple hover overlay with download button */}
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                                <button
                                  onClick={() => downloadDatabaseImage(dbImage)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-3 bg-white rounded-full shadow-lg hover:shadow-xl"
                                  title={`Download ${dbImage.filename}`}
                                >
                                  <Download className="w-5 h-5 text-gray-700" />
                                </button>
                              </div>
                            </div>
                          ))
                        : // Fallback to legacy URLs if no database images
                          currentJob.resultUrls &&
                          currentJob.resultUrls.length > 0 &&
                          currentJob.resultUrls.map((url, index) => (
                            <div
                              key={`legacy-${currentJob.id}-${index}`}
                              className="group relative rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200"
                            >
                              <img
                                src={url}
                                alt={`Enhanced image ${index + 1}`}
                                className="w-full h-auto object-cover"
                                onError={(e) => {
                                  console.error(
                                    "Legacy image load error:",
                                    url
                                  );
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                              
                              {/* Simple hover overlay with download button */}
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                                <button
                                  onClick={() =>
                                    downloadFromUrl(
                                      url,
                                      `enhanced-image-${index + 1}.png`
                                    )
                                  }
                                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-3 bg-white rounded-full shadow-lg hover:shadow-xl"
                                  title={`Download enhanced image ${index + 1}`}
                                >
                                  <Download className="w-5 h-5 text-gray-700" />
                                </button>
                              </div>
                            </div>
                          ))
                      }
                    </div>
                  </div>
                )}

                {currentJob.error && !isJobCancelled(currentJob) && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                          {currentJob.error}
                        </p>
                        {currentJob.error.includes("timeout") && (
                          <p className="text-xs text-red-500 dark:text-red-400">
                            The job may still be processing. Try checking status
                            or starting a new enhancement.
                          </p>
                        )}
                      </div>
                      {currentJob.status === "failed" && (
                        <button
                          onClick={() => checkJobStatus(currentJob.id)}
                          className="px-3 py-1 text-xs bg-red-100 dark:bg-red-800 text-red-600 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-700"
                        >
                          Check Status
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Cancel Button - placed at bottom of current enhancement */}
                {isGenerating && currentJob && (
                  <button
                    onClick={cancelGeneration}
                    className="w-full py-3 px-6 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center space-x-2"
                  >
                    <XCircle className="w-5 h-5" />
                    <span>Cancel Enhancement</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Recent Enhancements - Persistent History */}
          {jobHistory.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Enhancements
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {jobHistory.length}/5 jobs
                </span>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {jobHistory
                  .filter((job) => job && job.id)
                  .slice(0, 5) // Limit to 5 jobs
                  .map((job, index) => (
                    <div
                      key={job.id || `job-${index}`}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        {job.status === "completed" && (
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        )}
                        {job.status === "failed" && !isJobCancelled(job) && (
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        )}
                        {job.status === "failed" && isJobCancelled(job) && (
                          <XCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                        )}
                        {(job.status === "pending" ||
                          job.status === "processing") && (
                          <Loader2 className="w-4 h-4 animate-spin text-green-500 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {formatJobTime(job.createdAt)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {job.status === "failed" && isJobCancelled(job)
                              ? "cancelled"
                              : job.status || "unknown"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {job.status === "completed" && jobImages[job.id]?.length > 0 && (
                          <button
                            onClick={() => {
                              // Scroll to images for this job
                              const imageSection = document.getElementById(`job-images-${job.id}`);
                              imageSection?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                          >
                            View Results
                          </button>
                        )}
                        {(job.status === "pending" || job.status === "processing") && job.id === currentJob?.id && (
                          <button
                            onClick={() => checkJobStatus(job.id)}
                            className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                          >
                            Refresh
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
