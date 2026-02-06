// app/(dashboard)/workspace/generate-content/face-swapping/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import {
  ImageIcon,
  Wand2,
  Settings,
  Download,
  Share2,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Users,
  Sliders,
  Copy,
  RefreshCw,
  Upload,
  X,
  Image as ImageIconLucide,
  Layers,
  ChevronDown,
  Archive,
  FolderOpen,
  Check,
} from "lucide-react";
import VaultFolderDropdown from "@/components/generate-content/shared/VaultFolderDropdown";

// Types
interface FaceSwapParams {
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
  // Face swap specific params
  contextExpandPixels: number;
  contextExpandFactor: number;
  fillMaskHoles: boolean;
  blurMaskPixels: number;
  invertMask: boolean;
  blendPixels: number;
  rescaleAlgorithm: string;
  mode: string;
  forceWidth: number;
  forceHeight: number;
  rescaleFactor: number;
  denoise: number;
  teaCacheEnabled: boolean;
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
  url?: string;
  dataUrl?: string;
  createdAt: Date | string;
}

// InstagramProfile type is provided by useInstagramProfile hook

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

const RESCALE_ALGORITHMS = ["bislerp", "bicubic", "bilinear", "nearest"];

const INPAINT_MODES = ["forced size", "resize canvas"];

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

export default function FaceSwappingPage() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();
  
  // Use global profile from header
  const { profileId: globalProfileId, selectedProfile, profiles, isAllProfiles } = useInstagramProfile();

  // Refs for managing browser interactions
  const progressUpdateRef = useRef<((progress: any) => void) | null>(null);
  const notificationRef = useRef<Notification | null>(null);
  
  // Hydration fix - track if component is mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Storage keys for persistence
  const STORAGE_KEYS = {
    currentJob: 'face-swap-current-job',
    isGenerating: 'face-swap-is-generating',
    progressData: 'face-swap-progress-data',
    jobHistory: 'face-swap-job-history',
  };

  const [params, setParams] = useState<FaceSwapParams>({
    prompt:
      "Replace the face in the masked area with the face from the right side of the image. Maintain natural lighting, skin tone matching, and seamless blending. High quality realistic portrait.",
    width: 832,
    height: 1216,
    batchSize: 1,
    steps: 40,
    cfg: 1,
    samplerName: "euler",
    scheduler: "normal",
    guidance: 100,
    loraStrength: 1,
    selectedLora: "comfyui_portrait_lora64.safetensors",
    seed: null,
    // Face swap specific
    contextExpandPixels: 200,
    contextExpandFactor: 1,
    fillMaskHoles: true,
    blurMaskPixels: 16,
    invertMask: false,
    blendPixels: 16,
    rescaleAlgorithm: "bicubic",
    mode: "forced size",
    forceWidth: 832,
    forceHeight: 1216,
    rescaleFactor: 1,
    denoise: 1,
    teaCacheEnabled: false, // Disabled for serverless compatibility
  });

  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [jobHistory, setJobHistory] = useState<GenerationJob[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Real-time progress states
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

  const [availableLoRAs, setAvailableLoRAs] = useState<LoRAModel[]>([
    {
      fileName: "comfyui_portrait_lora64.safetensors",
      displayName: "Portrait LoRA",
      name: "portrait_lora",
    },
    {
      fileName: "FLUX.1-Turbo-Alpha.safetensors",
      displayName: "FLUX Turbo Alpha",
      name: "flux_turbo",
    },
  ]);
  const [loadingLoRAs, setLoadingLoRAs] = useState(true);

  // Folder selection states
  const [targetFolder, setTargetFolder] = useState<string>("");
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);

  // Vault Integration State - only folders for the selected profile
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);

  // Original image states (image with face to be replaced)
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [originalImagePreview, setOriginalImagePreview] = useState<
    string | null
  >(null);
  const [maskData, setMaskData] = useState<string | null>(null);
  const [showMaskEditor, setShowMaskEditor] = useState(false);
  const [uploadedOriginalFilename, setUploadedOriginalFilename] = useState<
    string | null
  >(null);

  // New face image states
  const [newFaceImage, setNewFaceImage] = useState<File | null>(null);
  const [newFaceImagePreview, setNewFaceImagePreview] = useState<string | null>(
    null
  );
  const [uploadedNewFaceFilename, setUploadedNewFaceFilename] = useState<
    string | null
  >(null);

  const [uploadingImage, setUploadingImage] = useState(false);

  // Simple masking states
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushTool, setBrushTool] = useState<"brush" | "eraser">("brush");
  const [brushSize, setBrushSize] = useState(50);
  const [showMask, setShowMask] = useState(true);

  // Database image states
  const [jobImages, setJobImages] = useState<Record<string, DatabaseImage[]>>(
    {}
  );
  const [imageStats, setImageStats] = useState<any>(null);

  const originalFileInputRef = useRef<HTMLInputElement>(null);
  const newFaceFileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const shouldContinuePolling = useRef<boolean>(true);

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
        generationType: 'face-swap',
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
      
      // Stop polling immediately
      shouldContinuePolling.current = false;
      
      // Clear persistent state
      clearPersistentState();

      // Update progress to show cancellation immediately
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
              stage: progressData.stage || 'Reconnecting to face swap...',
              message: progressData.message || 'Restoring your face swap session',
              generationType: 'face-swap',
              jobId: job.id,
              elapsedTime: progressData.elapsedTime,
              estimatedTimeRemaining: progressData.estimatedTimeRemaining
            });

            // Resume polling
            shouldContinuePolling.current = true; // Enable polling for resumed job
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
        console.error('Error restoring face swap state:', error);
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
        document.title = `🔄 Face Swapping... - TastyCreative AI`;
        
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
        document.title = 'TastyCreative AI - Face Swapping';
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
        document.title = 'TastyCreative AI - Face Swapping';
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
        // Show completion notification ONLY for successfully completed jobs (not cancelled)
        if ('Notification' in window && Notification.permission === 'granted') {
          // Close any existing notification
          if (notificationRef.current) {
            notificationRef.current.close();
          }
          
          // Show completion notification
          notificationRef.current = new Notification('🔄 Face Swap Complete!', {
            body: 'Your face swap images are ready to view and download.',
            icon: '/favicon.ico',
            tag: 'face-swap-complete'
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

  // Handle original image upload
  const handleOriginalImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
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

      setOriginalImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setOriginalImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle new face image upload
  const handleNewFaceImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
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

      setNewFaceImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setNewFaceImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeOriginalImage = () => {
    setOriginalImage(null);
    setOriginalImagePreview(null);
    setMaskData(null);
    setShowMaskEditor(false);
    setUploadedOriginalFilename(null);
    if (originalFileInputRef.current) {
      originalFileInputRef.current.value = "";
    }
  };

  // Simple masking functions
  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const image = imageRef.current;

    if (!canvas || !maskCanvas || !image || !originalImagePreview) return;

    // Use the actual image dimensions for the canvas
    const { naturalWidth: width, naturalHeight: height } = image;

    // Set canvas display size for UI (scaled down for editing)
    const maxDisplayWidth = 400;
    const maxDisplayHeight = 300;
    let displayWidth = width;
    let displayHeight = height;

    if (width > maxDisplayWidth || height > maxDisplayHeight) {
      const scale = Math.min(
        maxDisplayWidth / width,
        maxDisplayHeight / height
      );
      displayWidth = width * scale;
      displayHeight = height * scale;
    }

    // Set actual canvas size to match original image (for proper mask resolution)
    [canvas, maskCanvas].forEach((c) => {
      c.width = width; // Full resolution
      c.height = height; // Full resolution
      c.style.width = `${displayWidth}px`; // Display size
      c.style.height = `${displayHeight}px`; // Display size
    });

    // Draw image on main canvas at full resolution
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(image, 0, 0, width, height);
    }

    // Initialize mask canvas
    const maskCtx = maskCanvas.getContext("2d");
    if (maskCtx) {
      maskCtx.fillStyle = "rgba(0, 0, 0, 0)";
      maskCtx.fillRect(0, 0, width, height);
    }

    updateMaskPreview();
  }, [originalImagePreview]);

  const updateMaskPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;

    if (!canvas || !maskCanvas || !imageRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear and redraw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);

    if (showMask) {
      // Overlay mask with red tint
      const maskCtx = maskCanvas.getContext("2d");
      if (maskCtx) {
        const maskImageData = maskCtx.getImageData(
          0,
          0,
          maskCanvas.width,
          maskCanvas.height
        );
        const data = maskImageData.data;

        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "rgba(255, 0, 0, 0.5)";

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 0) {
            // If mask pixel has alpha > 0
            const x = (i / 4) % maskCanvas.width;
            const y = Math.floor(i / 4 / maskCanvas.width);
            ctx.fillRect(x, y, 1, 1);
          }
        }

        ctx.globalAlpha = 1;
      }
    }
  }, [showMask]);

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width; // Scale from display to actual canvas
    const scaleY = canvas.height / rect.height; // Scale from display to actual canvas

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const drawOnMask = useCallback(
    (x: number, y: number) => {
      const maskCanvas = maskCanvasRef.current;
      const canvas = canvasRef.current;
      if (!maskCanvas || !canvas) return;

      const ctx = maskCanvas.getContext("2d");
      if (!ctx) return;

      // Scale brush size based on canvas resolution vs display size
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaledBrushSize = brushSize * scaleX; // Scale brush to match resolution

      ctx.globalCompositeOperation =
        brushTool === "brush" ? "source-over" : "destination-out";
      ctx.fillStyle = brushTool === "brush" ? "white" : "transparent";
      ctx.beginPath();
      ctx.arc(x, y, scaledBrushSize / 2, 0, 2 * Math.PI);
      ctx.fill();

      updateMaskPreview();
      generateMaskData();
    },
    [brushTool, brushSize, updateMaskPreview]
  );

  const generateMaskData = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(
      0,
      0,
      maskCanvas.width,
      maskCanvas.height
    );
    const hasContent = imageData.data.some(
      (_, i) => i % 4 === 3 && imageData.data[i] > 0
    );

    if (hasContent) {
      const maskDataUrl = maskCanvas.toDataURL("image/png");
      setMaskData(maskDataUrl);
      console.log("🎭 Mask data generated:", {
        hasContent: true,
        dataUrlLength: maskDataUrl.length,
        preview: maskDataUrl.substring(0, 50) + "...",
      });
    } else {
      setMaskData(null);
      console.log("🎭 Mask cleared - no content detected");
    }
  }, []);

  const clearMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    updateMaskPreview();
    setMaskData(null);
  }, [updateMaskPreview]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const pos = getMousePos(e);
    drawOnMask(pos.x, pos.y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pos = getMousePos(e);
    drawOnMask(pos.x, pos.y);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  // Initialize canvas when image loads
  useEffect(() => {
    if (originalImagePreview && showMaskEditor) {
      const image = imageRef.current;
      if (image) {
        image.onload = initializeCanvas;
        image.src = originalImagePreview;
      }
    }
  }, [originalImagePreview, showMaskEditor, initializeCanvas]);

  const removeNewFaceImage = () => {
    setNewFaceImage(null);
    setNewFaceImagePreview(null);
    setUploadedNewFaceFilename(null);
    if (newFaceFileInputRef.current) {
      newFaceFileInputRef.current.value = "";
    }
  };

  // Function to fetch images for a completed job
  const fetchJobImages = async (jobId: string): Promise<boolean> => {
    if (!apiClient) return false;

    try {
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

    if (image.dataUrl) {
      urlToShare = `${window.location.origin}${image.dataUrl}`;
    } else if (image.url) {
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

  // Fetch available LoRA models on component mount
  useEffect(() => {
    if (!apiClient) {
      console.log("⏳ API client not ready yet, skipping LoRA fetch");
      return;
    }

    const fetchLoRAModels = async () => {
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

          // Set default LoRA for face swapping (Portrait LoRA)
          const portraitLora = data.models.find(
            (lora: LoRAModel) =>
              lora.fileName === "comfyui_portrait_lora64.safetensors"
          );
          if (portraitLora) {
            setParams((prev) => ({
              ...prev,
              selectedLora: portraitLora.fileName,
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
              fileName: "comfyui_portrait_lora64.safetensors",
              displayName: "Portrait LoRA",
              name: "portrait_lora",
            },
            {
              fileName: "FLUX.1-Turbo-Alpha.safetensors",
              displayName: "FLUX Turbo Alpha",
              name: "flux_turbo",
            },
          ]);
        }
      } catch (error) {
        console.error("Error fetching LoRA models:", error);
        setAvailableLoRAs([
          {
            fileName: "comfyui_portrait_lora64.safetensors",
            displayName: "Portrait LoRA",
            name: "portrait_lora",
          },
          {
            fileName: "FLUX.1-Turbo-Alpha.safetensors",
            displayName: "FLUX Turbo Alpha",
            name: "flux_turbo",
          },
        ]);
      } finally {
        setLoadingLoRAs(false);
      }
    };

    fetchLoRAModels();
  }, [apiClient]);

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
    setTargetFolder("");
  }, [loadVaultData]);

  // Get display text for the selected folder
  const getSelectedFolderDisplay = (): string => {
    if (!targetFolder) return 'Select a vault folder to save images';
    
    const folder = vaultFolders.find(f => f.id === targetFolder);
    if (folder) {
      // When viewing all profiles, show the folder's profile name
      if (isAllProfiles && folder.profileName) {
        const sharedLabel = !folder.isOwnedProfile && folder.ownerName ? ` (shared by ${folder.ownerName})` : '';
        return `Saving to: ${folder.profileName}${sharedLabel} / ${folder.name}`;
      }
      // When viewing single profile
      if (selectedProfile && selectedProfile.id !== 'all') {
        const profileDisplay = (selectedProfile as any).instagramUsername ? `@${(selectedProfile as any).instagramUsername}` : selectedProfile.name;
        return `Saving to Vault: ${profileDisplay} / ${folder.name}`;
      }
    }
    return 'Select a vault folder to save images';
  };

  const generateRandomSeed = () => {
    const seed = Math.floor(Math.random() * 1000000000);
    setParams((prev) => ({ ...prev, seed }));
  };

  const handleAspectRatioChange = (width: number, height: number) => {
    setParams((prev) => ({
      ...prev,
      width,
      height,
      forceWidth: width,
      forceHeight: height,
    }));
  };

  // Upload images to server (simple approach like style transfer)
  const uploadImagesToServer = async (
    originalFile: File,
    newFaceFile: File,
    maskDataUrl?: string | null
  ): Promise<{
    originalFilename: string;
    newFaceFilename: string;
    maskFilename?: string;
    originalImageData?: string;
    newFaceImageData?: string;
    maskImageData?: string;
  }> => {
    if (!apiClient) {
      throw new Error("API client not available");
    }

    setUploadingImage(true);

    try {
      // Upload original image with mask (similar to style transfer)
      console.log("📤 Uploading original image with mask...");
      const originalFormData = new FormData();
      originalFormData.append("image", originalFile);

      // Add mask data if present
      if (maskDataUrl) {
        console.log("🎭 Processing mask data for upload...");
        console.log("Mask data URL length:", maskDataUrl.length);

        // Convert data URL to blob
        const maskResponse = await fetch(maskDataUrl);
        const maskBlob = await maskResponse.blob();
        originalFormData.append("mask", maskBlob, "mask.png");

        console.log("✅ Mask blob created and added to form data:", {
          size: maskBlob.size,
          type: maskBlob.type,
        });
      } else {
        console.log("⚠️ No mask data URL provided for upload");
      }

      const originalResponse = await apiClient.postFormData(
        "/api/upload/image",
        originalFormData
      );

      if (!originalResponse.ok) {
        const errorData = await originalResponse.json();
        throw new Error(errorData.error || "Failed to upload original image");
      }

      const originalData = await originalResponse.json();
      console.log("✅ Original image uploaded:", originalData.filename);
      if (originalData.maskFilename) {
        console.log("✅ Mask uploaded:", originalData.maskFilename);
      }

      // Upload new face image
      console.log("📤 Uploading new face image...");
      const newFaceFormData = new FormData();
      newFaceFormData.append("image", newFaceFile);

      const newFaceResponse = await apiClient.postFormData(
        "/api/upload/image",
        newFaceFormData
      );

      if (!newFaceResponse.ok) {
        const errorData = await newFaceResponse.json();
        throw new Error(errorData.error || "Failed to upload new face image");
      }

      const newFaceData = await newFaceResponse.json();
      console.log("✅ New face image uploaded:", newFaceData.filename);

      return {
        originalFilename: originalData.filename,
        newFaceFilename: newFaceData.filename,
        maskFilename: originalData.maskFilename,
        // Include base64 data for direct use by RunPod handler
        originalImageData: originalData.base64,
        newFaceImageData: newFaceData.base64,
        maskImageData: originalData.maskBase64,
      };
    } catch (error) {
      console.error("💥 Error uploading images:", error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
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

    if (!originalImage) {
      alert("Please select an original image");
      return;
    }

    if (!newFaceImage) {
      alert("Please select a new face image");
      return;
    }

    if (!targetFolder) {
      alert("Please select a folder to save your face swap results");
      return;
    }

    // Optional: Warn if no mask is applied
    if (!maskData) {
      const proceed = confirm(
        "No face mask has been applied. The entire image may be affected. Continue anyway?"
      );
      if (!proceed) return;
    }

    setIsGenerating(true);
    setCurrentJob(null);

    // Initialize progress tracking
    setProgressData({
      progress: 5,
      stage: "starting",
      message: "🚀 Initializing face swap generation...",
      elapsedTime: 0,
      estimatedTimeRemaining: 300, // 5 minutes estimate
    });

    try {
      console.log("=== STARTING FACE SWAP GENERATION (SERVERLESS) ===");
      console.log("Generation params:", params);

      // Upload both images
      console.log("📤 Uploading images...");
      const uploadResult = await uploadImagesToServer(
        originalImage,
        newFaceImage,
        maskData
      );
      console.log("✅ Images uploaded:", uploadResult);

      const workflow = createWorkflowJson(
        params,
        uploadResult.originalFilename,
        uploadResult.newFaceFilename,
        uploadResult.maskFilename,
        targetFolder
      );
      console.log("Created face swap workflow for submission");

      // For vault folders, we now use direct folder ID instead of vault:profileId:folderId format
      // The folder object contains the profileId we need
      const selectedFolder = vaultFolders.find(f => f.id === targetFolder);
      const vaultProfileId = selectedFolder?.profileId;
      const vaultFolderId = targetFolder;
      
      console.log('📁 Folder info:', {
        targetFolder,
        saveToVault: !!targetFolder,
        profileId: vaultProfileId,
        folderId: vaultFolderId,
        folderName: selectedFolder?.name,
        profileName: selectedFolder?.profileName
      });

      // Create serverless job using same pattern as text-to-image
      const response = await apiClient.post(
        "/api/generate/face-swap-serverless",
        {
          action: "generate_face_swap",
          workflow,
          params,
          originalFilename: uploadResult.originalFilename,
          newFaceFilename: uploadResult.newFaceFilename,
          maskFilename: uploadResult.maskFilename,
          // Include base64 data for RunPod handler (prioritized over URLs)
          originalImageData: uploadResult.originalImageData,
          newFaceImageData: uploadResult.newFaceImageData,
          maskImageData: uploadResult.maskImageData,
          generationType: "face_swap",
          user_id: user?.id,
          // Vault parameters - always save to vault
          saveToVault: true,
          vaultProfileId: vaultProfileId,
          vaultFolderId: vaultFolderId,
        }
      );

      console.log(
        "Serverless generation API response status:",
        response.status
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Generation failed:", response.status, errorText);
        throw new Error(`Generation failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("Serverless response data:", data);

      const jobId = data.jobId;
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
      setJobHistory((prev) => [newJob, ...prev.filter(Boolean)].slice(0, 5));

      // Start polling for job status
      shouldContinuePolling.current = true; // Enable polling for new job
      pollJobStatus(jobId);
    } catch (error) {
      console.error("Face swap generation error:", error);
      setIsGenerating(false);

      // Update progress with error
      setProgressData({
        progress: 0,
        stage: "failed",
        message: error instanceof Error ? error.message : "Generation failed",
        elapsedTime: 0,
        estimatedTimeRemaining: 0,
      });

      // Clear error progress after delay
      setTimeout(() => {
        setProgressData({
          progress: 0,
          stage: "",
          message: "",
          elapsedTime: 0,
          estimatedTimeRemaining: 0,
        });
      }, 5000);

      alert(error instanceof Error ? error.message : "Generation failed");
    }
  };

  // Updated poll job status with real-time progress updates and database image fetching
  const pollJobStatus = async (jobId: string) => {
    if (!apiClient) {
      console.error("❌ API client not available for job polling");
      setIsGenerating(false);
      return;
    }

    console.log("=== STARTING REAL-TIME JOB POLLING ===");
    console.log("Polling job ID:", jobId);

    const maxAttempts = 1200; // 10 minutes (1200 attempts * 500ms = 600 seconds)
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
          `🔍 Polling attempt ${attempts}/${maxAttempts} for job ${jobId}`
        );

        const response = await apiClient.get(`/api/jobs/${jobId}`);
        console.log("📡 Job status response:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ Job status error:", response.status, errorText);

          if (response.status === 404) {
            console.log("Job not found - likely completed and cleaned up or still initializing");
            
            if (attempts > 10 && shouldContinuePolling.current) {
              console.log("Job not found after multiple attempts - assuming completed and cleaned up");
              setIsGenerating(false);
              shouldContinuePolling.current = false;
              
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
            } else if (attempts < 30 && shouldContinuePolling.current) {
              // Retry for new jobs (serverless jobs might take time to appear)
              console.log("⏳ Job not found yet, retrying...");
              setTimeout(poll, 2000);
              return;
            } else if (!shouldContinuePolling.current) {
              console.log("🛑 Polling stopped due to cancellation (404 retry)");
              return;
            }
          } else if (!shouldContinuePolling.current) {
            console.log("🛑 Polling stopped due to cancellation");
            return;
          }

          throw new Error(`Job status check failed: ${response.status}`);
        }

        const job = await response.json();
        console.log("📊 Job status data:", job);

        // Handle date conversion safely
        if (job.createdAt && typeof job.createdAt === "string") {
          job.createdAt = new Date(job.createdAt);
        }

        // Update progress data with enhanced information
        if (job.progress !== undefined || job.stage || job.message) {
          const progressUpdate = {
            progress: job.progress || 0,
            stage: job.stage || "",
            message:
              job.message ||
              (job.status === "processing" ? "Processing..." : ""),
            elapsedTime: job.elapsedTime || 0,
            estimatedTimeRemaining: job.estimatedTimeRemaining || 0,
          };

          setProgressData(progressUpdate);

          // Update global progress and localStorage
          updateGlobalProgress({
            isGenerating: true,
            progress: progressUpdate.progress,
            stage: progressUpdate.stage,
            message: progressUpdate.message,
            generationType: 'face-swap',
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
          console.log("🎉 Face swap job completed successfully!");

          // Final progress update
          setProgressData({
            progress: 100,
            stage: "completed",
            message: "Face swap completed successfully! 🎉",
            elapsedTime: job.elapsedTime || 0,
            estimatedTimeRemaining: 0,
          });

          setIsGenerating(false);

          // Fetch database images for completed job with retry logic
          console.log("�️ Attempting to fetch job images...");
          const fetchSuccess = await fetchJobImages(jobId);

          // If fetch failed or no images found, retry after a short delay
          if (!fetchSuccess) {
            console.log("🔄 Retrying image fetch after delay...");
            setTimeout(() => {
              fetchJobImages(jobId);
            }, 3000);
          }

          // Refresh image stats
          await fetchImageStats();

          // Clear progress and global progress after a brief delay
          setTimeout(() => {
            setProgressData({
              progress: 0,
              stage: "",
              message: "",
              elapsedTime: 0,
              estimatedTimeRemaining: 0,
            });
            clearGlobalProgress();
            
            // Clear localStorage keys
            if (typeof window !== 'undefined') {
              Object.values(STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
              });
            }
          }, 5000);

          return;
        } else if (job.status === "failed") {
          console.log("❌ Face swap job failed:", job.error);

          // Check if this was a user cancellation vs actual failure
          if (isJobCancelled(job)) {
            // Update progress with cancellation
            const cancelProgress = {
              progress: 0,
              stage: "cancelled",
              message: "🛑 Face swap cancelled by user",
              elapsedTime: job.elapsedTime || 0,
              estimatedTimeRemaining: 0,
            };

            setProgressData(cancelProgress);

            // Update global progress with cancellation
            updateGlobalProgress({
              isGenerating: false,
              progress: 0,
              stage: "cancelled",
              message: "🛑 Face swap cancelled by user",
              generationType: 'face-swap',
              jobId: jobId,
              elapsedTime: cancelProgress.elapsedTime,
              estimatedTimeRemaining: 0
            });

            console.log("✅ Face swap was cancelled by user");
          } else {
            // Update progress with error
            const errorProgress = {
              progress: 0,
              stage: "failed",
              message: job.error || "Generation failed",
              elapsedTime: job.elapsedTime || 0,
              estimatedTimeRemaining: 0,
            };

            setProgressData(errorProgress);

            // Update global progress with error
            updateGlobalProgress({
              isGenerating: false,
              progress: 0,
              stage: "failed",
              message: job.error || "Face swap generation failed",
              generationType: 'face-swap',
              jobId: jobId,
              elapsedTime: errorProgress.elapsedTime,
              estimatedTimeRemaining: 0
            });
          }

          setIsGenerating(false);

          // Clear error progress and localStorage after delay
          setTimeout(() => {
            setProgressData({
              progress: 0,
              stage: "",
              message: "",
              elapsedTime: 0,
              estimatedTimeRemaining: 0,
            });
            clearGlobalProgress();
            
            // Clear localStorage keys
            if (typeof window !== 'undefined') {
              Object.values(STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
              });
            }
          }, 5000);

          return;
        }

        // Continue polling if still processing
        if (
          attempts < maxAttempts &&
          (job.status === "pending" || job.status === "processing") &&
          shouldContinuePolling.current
        ) {
          // More frequent polling for better real-time updates
          setTimeout(poll, 500);
        } else if (!shouldContinuePolling.current) {
          console.log("🛑 Polling stopped due to cancellation");
        } else if (attempts >= maxAttempts) {
          console.error("⏰ Polling timeout reached");
          setIsGenerating(false);

          const timeoutProgress = {
            progress: 0,
            stage: "failed",
            message: "Generation timeout - may still be running in background",
            elapsedTime: 0,
            estimatedTimeRemaining: 0,
          };

          setProgressData(timeoutProgress);

          // Update global progress with timeout
          updateGlobalProgress({
            isGenerating: false,
            progress: 0,
            stage: "failed",
            message: "Face swap generation timeout",
            generationType: 'face-swap',
            jobId: jobId,
            elapsedTime: 0,
            estimatedTimeRemaining: 0
          });

          setCurrentJob((prev) =>
            prev
              ? {
                  ...prev,
                  status: "failed" as const,
                  error: "Polling timeout - generation may still be running",
                }
              : null
          );

          // Clear timeout progress and localStorage after delay
          setTimeout(() => {
            clearGlobalProgress();
            
            if (typeof window !== 'undefined') {
              Object.values(STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
              });
            }
          }, 5000);
        }
      } catch (error) {
        console.error("❌ Polling error:", error);

        if (attempts < maxAttempts && shouldContinuePolling.current) {
          setTimeout(poll, 2000); // Retry with longer delay
        } else if (!shouldContinuePolling.current) {
          console.log("🛑 Polling stopped due to cancellation (error handler)");
        } else {
          setIsGenerating(false);
          setCurrentJob((prev) =>
            prev
              ? {
                  ...prev,
                  status: "failed" as const,
                  error: "Failed to get job status",
                }
              : null
          );
        }
      }
    };

    // Start polling after a short delay
    setTimeout(poll, 1000);
  };

  // Create workflow JSON for face swapping - using pure inpainting approach
  const createWorkflowJson = (
    params: FaceSwapParams,
    originalFilename: string,
    newFaceFilename: string,
    maskFilename?: string,
    targetFolder?: string
  ) => {
    const seed = params.seed || Math.floor(Math.random() * 1000000000);

    // Determine the filename prefix - vault path handled by webhook
    // Since we now use direct folder IDs, always use temporary path
    const filenamePrefix = `outputs/${user?.id}/FaceSwap`;
    console.log("💾 Using temporary path for vault storage:", filenamePrefix);

    // Simplified pure inpainting workflow - with face reference
    const workflow: any = {
      // Load models
      "340": {
        inputs: {
          unet_name: "flux1FillDevFp8_v10.safetensors",
          weight_dtype: "default",
        },
        class_type: "UNETLoader",
      },
      "341": {
        inputs: {
          clip_name1: "clip_l.safetensors",
          clip_name2: "t5xxl_fp16.safetensors",
          type: "flux",
          dtype: "default",
        },
        class_type: "DualCLIPLoader",
      },
      "338": {
        inputs: {
          vae_name: "ae.safetensors",
        },
        class_type: "VAELoader",
      },
      // Load LoRA for ACE++ portrait enhancement
      "337": {
        inputs: {
          model: ["340", 0],
          clip: ["341", 0],
          lora_name: "comfyui_portrait_lora64.safetensors",
          strength_model: 1.0,
          strength_clip: 1.0,
        },
        class_type: "LoraLoader",
      },
      // Load original image
      "239": {
        inputs: {
          image: originalFilename,
        },
        class_type: "LoadImage",
      },
      // Load new face image
      "240": {
        inputs: {
          image: newFaceFilename,
        },
        class_type: "LoadImage",
      },
      // Concatenate for face reference in inpainting
      "323": {
        inputs: {
          image1: ["239", 0],
          image2: ["240", 0],
          direction: "right",
          match_image_size: true,
        },
        class_type: "ImageConcanate",
      },
      // Create text prompt for face swap with reference to new face
      "343": {
        inputs: {
          text:
            params.prompt ||
            "Replace the face in the masked area with the face from the right side of the image. Maintain natural lighting, skin tone matching, and seamless blending. High quality realistic portrait.",
          clip: ["341", 0],
        },
        class_type: "CLIPTextEncode",
      },
      // Apply Flux guidance
      "345": {
        inputs: {
          conditioning: ["343", 0],
          guidance: params.guidance || 50,
        },
        class_type: "FluxGuidance",
      },
      // Zero out negative conditioning for Flux
      "404": {
        inputs: {
          conditioning: ["343", 0],
        },
        class_type: "ConditioningZeroOut",
      },
      // Inpaint model conditioning - use concatenated image to see both faces
      "221": {
        inputs: {
          positive: ["345", 0],
          negative: ["404", 0],
          vae: ["338", 0],
          pixels: ["323", 0], // Use concatenated image with both faces
          mask: maskFilename ? ["244", 0] : ["243", 0],
        },
        class_type: "InpaintModelConditioning",
      },
      // K-Sampler for generation
      "346": {
        inputs: {
          model: ["337", 0],
          positive: ["221", 0],
          negative: ["221", 1],
          latent_image: ["221", 2],
          seed: seed,
          control_after_generate: "randomize",
          steps: params.steps || 25,
          cfg: params.cfg || 1,
          sampler_name: params.samplerName || "euler",
          scheduler: params.scheduler || "normal",
          denoise: params.denoise || 0.8,
        },
        class_type: "KSampler",
      },
      // VAE Decode
      "214": {
        inputs: {
          samples: ["346", 0],
          vae: ["338", 0],
        },
        class_type: "VAEDecode",
      },
      // Crop back to original size (left side of concatenated result)
      "415": {
        inputs: {
          image: ["214", 0],
          width: params.width || 832,
          height: params.height || 1216,
          x: 0,
          y: 0,
        },
        class_type: "ImageCrop",
      },
      // Save final result
      "413": {
        inputs: {
          images: ["415", 0],
          filename_prefix: filenamePrefix,
        },
        class_type: "SaveImage",
      },
      // Preview result
      "382": {
        inputs: {
          images: ["415", 0],
        },
        class_type: "PreviewImage",
      },
    };

    console.log("🎭 Pure inpainting face swap workflow created");
    console.log("📋 Using direct inpainting without crop/stitch");
    console.log("📁 Files:", {
      originalFilename,
      newFaceFilename,
      maskFilename,
    });

    // Add mask loading node if mask is provided
    if (maskFilename) {
      workflow["241"] = {
        inputs: {
          image: maskFilename,
        },
        class_type: "LoadImage",
      };

      // Convert mask image to mask for proper processing
      workflow["242"] = {
        inputs: {
          image: ["241", 0],
          channel: "red",
        },
        class_type: "ImageToMask",
      };

      // Create empty image with same dimensions as new face
      workflow["245"] = {
        inputs: {
          width: params.width || 832,
          height: params.height || 1216,
          batch_size: 1,
          color: 0,
        },
        class_type: "EmptyImage",
      };

      // Concatenate original mask with empty mask
      workflow["246"] = {
        inputs: {
          image1: ["241", 0], // Original mask image
          image2: ["245", 0], // Empty image for right side
          direction: "right",
          match_image_size: true,
        },
        class_type: "ImageConcanate",
      };

      // Convert concatenated mask image to mask
      workflow["244"] = {
        inputs: {
          image: ["246", 0],
          channel: "red",
        },
        class_type: "ImageToMask",
      };

      console.log(
        "🎨 Mask handling: Using painted mask for targeted inpainting on concatenated image"
      );
    } else {
      // When no mask is provided, create mask for left side only (original image area)
      workflow["243"] = {
        inputs: {
          image: ["239", 0],
          channel: "red",
        },
        class_type: "ImageToMask",
      };

      console.log(
        "🎨 Mask handling: Created full-coverage mask for original image area"
      );
    }

    return workflow;
  };

  if (!apiClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-950 dark:via-purple-950/30 dark:to-blue-950/30 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[24rem]">
            <div className="text-center bg-slate-900/70 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-700/50 px-10 py-12">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-purple-500" />
              <h3 className="text-xl font-semibold text-slate-50 mb-2">
                Initializing Face Swapping Studio...
              </h3>
              <p className="text-slate-300">
                Setting up authentication for face swapping. Hang tight!
              </p>
            </div>
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
              <Users className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
            </div>
            <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              Face Swapping Studio
            </h1>
          </div>
          <p className="text-xs sm:text-sm md:text-base lg:text-lg text-slate-300 max-w-2xl mx-auto px-2">
            Replace faces with cinematic realism using Flux-powered inpainting, intelligent masking, and precision blending tools.
          </p>
          <div className="mt-4 sm:mt-6 flex flex-wrap justify-center gap-2 sm:gap-3 text-[10px] sm:text-xs md:text-sm">
            <div className="px-2 xs:px-3 sm:px-4 py-1 sm:py-1.5 md:py-2 bg-slate-800/60 text-slate-100 rounded-full shadow-md border border-slate-700/50 backdrop-blur-sm font-semibold">
              Precise Masking Toolkit
            </div>
            <div className="px-2 xs:px-3 sm:px-4 py-1 sm:py-1.5 md:py-2 bg-slate-800/60 text-slate-100 rounded-full shadow-md border border-slate-700/50 backdrop-blur-sm font-semibold">
              Flux Fill Inpainting
            </div>
            <div className="px-2 xs:px-3 sm:px-4 py-1 sm:py-1.5 md:py-2 bg-slate-800/60 text-slate-100 rounded-full shadow-md border border-slate-700/50 backdrop-blur-sm font-semibold">
              Natural Blending Results
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        {/* Left Panel - Controls */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4 md:space-y-6">
          {/* Folder Selection */}
          <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
            <div>
              <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-lg sm:rounded-xl text-white shadow-lg">
                  <Archive className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="text-left flex-1">
                  <h2 className="text-base sm:text-lg md:text-xl font-bold text-slate-50">Save to Vault</h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Choose where your swapped portraits will land.
                  </p>
                </div>
                {isLoadingVaultData && (
                  <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                )}
              </div>

              {/* Vault Folder Dropdown */}
              <VaultFolderDropdown
                targetFolder={targetFolder}
                setTargetFolder={setTargetFolder}
                folderDropdownOpen={folderDropdownOpen}
                setFolderDropdownOpen={setFolderDropdownOpen}
                vaultFolders={vaultFolders}
                isAllProfiles={isAllProfiles}
                selectedProfile={selectedProfile}
                mounted={mounted}
                accentColor="purple"
              />

              {/* Status Indicator */}
              {targetFolder && (
                <div className="mt-2 sm:mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-100 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20">
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  <p className="text-xs text-purple-700 dark:text-purple-200 flex-1 truncate">
                    {getSelectedFolderDisplay()}
                  </p>
                </div>
              )}

              {isLoadingVaultData && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 mt-2 sm:mt-3">
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                  <span>Loading folders...</span>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Image Uploads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Enhanced Original Image Upload */}
            <div className="group bg-slate-900/50 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 p-6 hover:shadow-2xl hover:border-blue-400 transition-all duration-300">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-lg font-bold text-slate-50 flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl">
                      <ImageIconLucide className="w-5 h-5 text-white" />
                    </div>
                    <span>Original Image</span>
                    <div className="px-2 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-medium">
                      Face to Replace
                    </div>
                  </label>
                  {originalImage && (
                    <button
                      onClick={removeOriginalImage}
                      className="p-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {!originalImagePreview ? (
                  <div
                    onClick={() => originalFileInputRef.current?.click()}
                    className="relative border-2 border-dashed border-blue-300 dark:border-blue-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition-all duration-300 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 group-hover:scale-105"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 to-indigo-100/50 dark:from-blue-800/20 dark:to-indigo-800/20 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" />
                      </div>
                      <p className="text-slate-50 mb-1.5 sm:mb-2 text-sm sm:text-base md:text-lg font-semibold">
                        Upload Original Image
                      </p>
                      <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-medium mb-1.5 sm:mb-2">
                        The image containing the face you want to replace
                      </p>
                      <p className="text-[10px] sm:text-xs text-slate-400 bg-white/50 dark:bg-gray-800/50 rounded-lg px-2 sm:px-3 py-0.5 sm:py-1 inline-block">
                        PNG, JPG, WebP • Max 10MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {/* Image Preview and Mask Editor Toggle */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] sm:text-xs font-medium text-slate-200">
                        Original {maskData && "(Masked)"}
                      </h3>
                      <div className="flex space-x-1.5 sm:space-x-2">
                        <button
                          onClick={() => setShowMaskEditor(!showMaskEditor)}
                          className={`px-1.5 xs:px-2 py-0.5 xs:py-1 text-[10px] xs:text-xs rounded transition-colors active:scale-95 ${
                            showMaskEditor
                              ? "bg-blue-500 text-white"
                              : "bg-slate-700 text-slate-200"
                          }`}
                        >
                          {showMaskEditor ? "Hide Mask" : "Edit Mask"}
                        </button>
                      </div>
                    </div>

                    {/* Simple Mask Editor or Preview */}
                    {showMaskEditor ? (
                      <div className="space-y-2 sm:space-y-3">
                        {/* Simple Mask Tools */}
                        <div className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                          <div className="flex items-center space-x-2 sm:space-x-3">
                            {/* Tool Selection */}
                            <div className="flex space-x-1">
                              <button
                                onClick={() => setBrushTool("brush")}
                                className={`p-1.5 sm:p-2 rounded transition-colors active:scale-95 ${
                                  brushTool === "brush"
                                    ? "bg-blue-500 text-white"
                                    : "bg-slate-700 text-slate-300"
                                }`}
                                title="Brush - Paint mask"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => setBrushTool("eraser")}
                                className={`p-1.5 sm:p-2 rounded transition-colors active:scale-95 ${
                                  brushTool === "eraser"
                                    ? "bg-blue-500 text-white"
                                    : "bg-slate-700 text-slate-300"
                                }`}
                                title="Eraser - Remove mask"
                              >
                                🧽
                              </button>
                            </div>

                            {/* Brush Size */}
                            <div className="flex items-center space-x-1.5 sm:space-x-2">
                              <button
                                onClick={() =>
                                  setBrushSize(Math.max(5, brushSize - 5))
                                }
                                className="p-0.5 xs:p-1 bg-slate-700 rounded text-xs sm:text-sm active:scale-95"
                              >
                                −
                              </button>
                              <span className="text-[10px] xs:text-xs sm:text-sm w-6 xs:w-7 sm:w-8 text-center">
                                {brushSize}
                              </span>
                              <button
                                onClick={() =>
                                  setBrushSize(Math.min(50, brushSize + 5))
                                }
                                className="p-0.5 xs:p-1 bg-slate-700 rounded text-xs sm:text-sm active:scale-95"
                              >
                                +
                              </button>
                            </div>

                            {/* Show/Hide Mask */}
                            <button
                              onClick={() => setShowMask(!showMask)}
                              className={`p-1.5 sm:p-2 rounded transition-colors active:scale-95 ${
                                showMask
                                  ? "bg-green-500 text-white"
                                  : "bg-slate-700 text-slate-300"
                              }`}
                              title={showMask ? "Hide mask" : "Show mask"}
                            >
                              {showMask ? "👁️" : "🙈"}
                            </button>
                          </div>

                          {/* Clear Mask */}
                          <button
                            onClick={clearMask}
                            className="px-2 xs:px-3 py-1 bg-red-500 text-white rounded text-[10px] xs:text-xs sm:text-sm hover:bg-red-600 active:scale-95"
                            title="Clear all mask"
                          >
                            Clear
                          </button>
                        </div>

                        {/* Canvas Container */}
                        <div className="relative border border-slate-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                          {/* Hidden image for loading */}
                          <img
                            ref={imageRef}
                            style={{ display: "none" }}
                            alt="Reference"
                          />

                          {/* Main canvas (image + mask overlay) */}
                          <canvas
                            ref={canvasRef}
                            className="block max-w-full h-auto"
                            style={{
                              cursor:
                                brushTool === "brush" ? "crosshair" : "grab",
                            }}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                          />

                          {/* Hidden mask canvas */}
                          <canvas
                            ref={maskCanvasRef}
                            style={{ display: "none" }}
                          />

                          {/* Tool indicator */}
                          <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 bg-black bg-opacity-75 text-white px-1.5 xs:px-2 py-0.5 xs:py-1 rounded text-[10px] xs:text-xs">
                            {brushTool === "brush" ? "✏️" : "🧽"} {brushSize}px
                          </div>
                        </div>

                        {/* Instructions */}
                        <div className="text-[10px] xs:text-xs text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-gray-900 p-2 sm:p-3 rounded">
                          <p>
                            <strong>Manual Face Masking:</strong>
                          </p>
                          <ul className="list-disc list-inside mt-1 space-y-0.5 xs:space-y-1">
                            <li>
                              Use the <strong>brush</strong> to paint over the
                              face you want to replace
                            </li>
                            <li>
                              Use the <strong>eraser</strong> to remove mask
                              areas
                            </li>
                            <li>
                              Red overlay shows areas that will be replaced with
                              the new face
                            </li>
                            <li>
                              Only paint the face area - avoid hair, background,
                              and clothing
                            </li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <img
                          src={originalImagePreview}
                          alt="Original"
                          className="w-full h-32 xs:h-40 sm:h-48 object-cover rounded-lg"
                        />
                        {maskData && (
                          <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 bg-blue-500 text-white px-1.5 xs:px-2 py-0.5 xs:py-1 rounded text-[10px] xs:text-xs">
                            🎭 Masked
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mask Status */}
                    {maskData ? (
                      <div className="text-[10px] xs:text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-1.5 xs:p-2 rounded">
                        ✅ Face mask ready - White areas will be replaced with
                        the new face
                      </div>
                    ) : (
                      <div className="text-[10px] xs:text-xs text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-gray-900/20 p-1.5 xs:p-2 rounded">
                        💡 <strong>Face Swap Tip:</strong> Click "Edit Mask" and
                        paint over the face you want to replace. Only the masked
                        areas will be swapped.
                      </div>
                    )}
                  </div>
                )}

                <input
                  ref={originalFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleOriginalImageUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Enhanced New Face Image Upload */}
            <div className="group bg-slate-900/50 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 p-6 hover:shadow-2xl hover:border-pink-400 transition-all duration-300">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-lg font-bold text-slate-50 flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <span>New Face Image</span>
                    <div className="px-2 py-1 bg-pink-500/20 text-pink-300 border border-pink-500/30 rounded-full text-xs font-medium">
                      Source Face
                    </div>
                  </label>
                  {newFaceImage && (
                    <button
                      onClick={removeNewFaceImage}
                      className="p-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {!newFaceImagePreview ? (
                  <div
                    onClick={() => newFaceFileInputRef.current?.click()}
                    className="relative border-2 border-dashed border-pink-300 dark:border-pink-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 text-center hover:border-pink-400 dark:hover:border-pink-500 cursor-pointer transition-all duration-300 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 group-hover:scale-105"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-100/50 to-rose-100/50 dark:from-pink-800/20 dark:to-rose-800/20 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" />
                      </div>
                      <p className="text-slate-50 mb-1.5 sm:mb-2 text-sm sm:text-base md:text-lg font-semibold">
                        Upload New Face
                      </p>
                      <p className="text-xs sm:text-sm text-pink-600 dark:text-pink-400 font-medium mb-1.5 sm:mb-2">
                        The face you want to transfer to the original image
                      </p>
                      <p className="text-[10px] sm:text-xs text-slate-400 bg-white/50 dark:bg-gray-800/50 rounded-lg px-2 sm:px-3 py-0.5 sm:py-1 inline-block">
                        PNG, JPG, WebP • Max 10MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-xl sm:rounded-2xl overflow-hidden shadow-lg group">
                    <img
                      src={newFaceImagePreview}
                      alt="New Face"
                      className="w-full h-32 xs:h-40 sm:h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="absolute bottom-1.5 sm:bottom-2 left-1.5 sm:left-2 right-1.5 sm:right-2 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs sm:text-sm font-medium">Source face ready</p>
                    </div>
                    {uploadingImage && (
                      <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center rounded-xl sm:rounded-2xl">
                        <div className="flex flex-col items-center space-y-2 sm:space-y-3 text-white">
                          <div className="relative">
                            <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin" />
                            <div className="absolute inset-0 w-6 h-6 sm:w-8 sm:h-8 border-2 border-white/30 rounded-full animate-ping"></div>
                          </div>
                          <span className="text-xs sm:text-sm font-medium">
                            Uploading face image...
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <input
                  ref={newFaceFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleNewFaceImageUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Prompt Input */}
          <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-medium text-slate-200">
                  Generation Prompt
                </label>
                <button
                  onClick={() =>
                    setParams((prev) => ({
                      ...prev,
                      prompt:
                        "Retain face. fit the face perfectly to the body. natural realistic eyes, match the skin tone of the body to the face",
                    }))
                  }
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Reset
                </button>
              </div>
              <textarea
                value={params.prompt}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, prompt: e.target.value }))
                }
                placeholder="Instructions for face swapping..."
                className="w-full h-24 px-4 py-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-slate-800/50 text-slate-50 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Basic Settings */}
          <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
            <h3 className="text-base sm:text-lg font-semibold text-slate-50 mb-3 sm:mb-4">
              Face Swap Settings
            </h3>

            {/* Output Size */}
            <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              <label className="text-xs sm:text-sm font-medium text-slate-200">
                Output Size
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.name}
                    onClick={() =>
                      handleAspectRatioChange(ratio.width, ratio.height)
                    }
                    className={`p-2 sm:p-3 rounded-lg border text-xs sm:text-sm font-medium transition-all active:scale-95 ${
                      params.width === ratio.width &&
                      params.height === ratio.height
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                        : "border-slate-600 text-slate-200 hover:border-gray-400"
                    }`}
                  >
                    <div>{ratio.name}</div>
                    <div className="text-[10px] xs:text-xs opacity-75">{ratio.ratio}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* TeaCache Toggle */}
            <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-medium text-slate-200">
                  TeaCache (Speed Optimization)
                </label>
                <button
                  onClick={() =>
                    setParams((prev) => ({
                      ...prev,
                      teaCacheEnabled: !prev.teaCacheEnabled,
                    }))
                  }
                  className={`relative inline-flex h-5 sm:h-6 w-9 sm:w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-95 ${
                    params.teaCacheEnabled
                      ? "bg-blue-600"
                      : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 sm:h-4 w-3.5 sm:w-4 transform rounded-full bg-white transition-transform ${
                      params.teaCacheEnabled ? "translate-x-5 sm:translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400">
                Enable TeaCache for faster generation (recommended for speed)
              </p>
            </div>

            {/* Advanced Settings Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 active:scale-95">
              <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{showAdvanced ? "Hide" : "Show"} Advanced Settings</span>
            </button>

            {/* Advanced Settings */}
            {showAdvanced && (
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-700/50 space-y-4 sm:space-y-6">
                {/* Context Expand Pixels */}
                <div className="space-y-2 sm:space-y-3">
                  <label className="text-xs sm:text-sm font-medium text-slate-200">
                    Context Expand Pixels: {params.contextExpandPixels}
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="400"
                    step="10"
                    value={params.contextExpandPixels}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        contextExpandPixels: parseInt(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Tight Crop</span>
                    <span>More Context</span>
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-200">
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
                  <label className="text-sm font-medium text-slate-200">
                    Guidance: {params.guidance}
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="5"
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

                {/* Denoise */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-200">
                    Denoise Strength: {params.denoise}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={params.denoise}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        denoise: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>

                {/* Blur Mask Pixels */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-200">
                    Blur Mask Pixels: {params.blurMaskPixels}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="2"
                    value={params.blurMaskPixels}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        blurMaskPixels: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>

                {/* Blend Pixels */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-200">
                    Blend Pixels: {params.blendPixels}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="2"
                    value={params.blendPixels}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        blendPixels: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>

                {/* Sampler */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-200">
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
                    className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-800/50 text-slate-50"
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
                  <label className="text-sm font-medium text-slate-200">
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
                    className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-800/50 text-slate-50"
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
                  <label className="text-sm font-medium text-slate-200">
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
                      className="flex-1 px-3 py-2 border border-slate-600 rounded-lg bg-slate-800/50 text-slate-50"
                    />
                    <button
                      onClick={generateRandomSeed}
                      className="px-3 py-2 border border-slate-600 rounded-lg hover:bg-slate-700/50"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Progress information is now shown in the "Current Face Swap" section below */}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={
              isGenerating ||
              !params.prompt.trim() ||
              !originalImage ||
              !newFaceImage ||
              !targetFolder ||
              uploadingImage
            }
            className="group w-full py-3 sm:py-4 md:py-5 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white font-bold text-sm sm:text-base md:text-lg rounded-xl sm:rounded-2xl hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 sm:gap-3 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 animate-spin" />
                <span>Swapping Faces...</span>
              </>
            ) : uploadingImage ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 animate-spin" />
                <span>Uploading Images...</span>
              </>
            ) : (
              <>
                <Users className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 group-hover:rotate-12 transition-transform duration-300" />
                <span>Swap Faces</span>
              </>
            )}
          </button>

          {/* Helper text */}
          {!targetFolder && !isGenerating && (
            <p className="text-center text-xs sm:text-sm text-slate-400 -mt-1 sm:-mt-2">
              ⚠️ Please select a folder before swapping faces
            </p>
          )}

          {/* Cancel button is now available in the "Current Face Swap" section below */}
        </div>

        {/* Right Panel - Results */}
        <div className="space-y-3 sm:space-y-4 md:space-y-6">
          {/* Image Statistics */}
          {imageStats && (
            <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-xl text-white shadow-lg">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-slate-50">
                    Your Image Library
                  </h3>
                  <p className="text-xs text-slate-400">
                    Quick stats on your stored swaps.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-slate-400">
                    Total Images:
                  </span>
                  <span className="ml-2 font-medium">
                    {imageStats.totalImages}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-slate-400">
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

          {/* Current Generation */}
          {currentJob && (
            <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-lg sm:rounded-xl text-white shadow-lg">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-slate-50">
                      Current Face Swap
                    </h3>
                    <p className="text-[10px] sm:text-xs text-slate-400">
                      Track progress and manage the active job.
                    </p>
                  </div>
                </div>
                {currentJob.status === "completed" && (
                  <button
                    onClick={() => fetchJobImages(currentJob.id)}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700/50 active:scale-95"
                    title="Refresh generated images"
                  >
                    <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-slate-400">
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

                {/* Progress and Status Details */}
                {(currentJob.status === "pending" || currentJob.status === "processing") && progressData.progress > 0 && (
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-slate-400">
                        Progress
                      </span>
                      <span className="text-xs sm:text-sm font-medium">
                        {progressData.progress}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2 sm:h-2.5 md:h-3">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 sm:h-2.5 md:h-3 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(0, Math.min(100, progressData.progress))}%` }}
                      />
                    </div>
                    {progressData.message && (
                      <div className="text-xs sm:text-sm text-slate-300">
                        {progressData.message}
                      </div>
                    )}
                    {progressData.stage && (
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                        <span className="text-[10px] sm:text-xs text-slate-400 capitalize">
                          {progressData.stage.replace("_", " ")}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Cancel Button - placed below progress */}
                {(currentJob.status === "pending" || currentJob.status === "processing") && (
                  <button
                    onClick={cancelGeneration}
                    className="group w-full py-2 sm:py-2.5 md:py-3 bg-gradient-to-r from-red-500 via-pink-600 to-purple-600 text-white font-semibold text-sm sm:text-base rounded-lg sm:rounded-xl hover:from-red-600 hover:via-pink-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-1.5 sm:gap-2 relative overflow-hidden active:scale-95">
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Cancel Face Swap</span>
                  </button>
                )}

                {/* Show loading or no images message for completed jobs */}
                {currentJob.status === "completed" &&
                  (!currentJob.resultUrls ||
                    currentJob.resultUrls.length === 0) &&
                  (!jobImages[currentJob.id] ||
                    jobImages[currentJob.id].length === 0) && (
                    <div className="space-y-2 sm:space-y-3">
                      <h4 className="text-xs sm:text-sm font-medium text-slate-200">
                        Generated Images
                      </h4>
                      <div className="text-center py-6 sm:py-8">
                        <div className="flex items-center justify-center space-x-1.5 sm:space-x-2 text-slate-400 mb-2 sm:mb-3">
                          <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                          <span className="text-xs sm:text-sm">
                            Loading generated images...
                          </span>
                        </div>
                        <button
                          onClick={() => fetchJobImages(currentJob.id)}
                          className="px-3 xs:px-4 py-1.5 xs:py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-lg sm:rounded-xl hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 transition-all duration-300 shadow-md active:scale-95"
                        >
                          Refresh Images
                        </button>
                      </div>
                    </div>
                  )}

                {/* Enhanced image display with dynamic URL support - prioritize final results */}
                {((currentJob.resultUrls && currentJob.resultUrls.length > 0) ||
                  (jobImages[currentJob.id] &&
                    jobImages[currentJob.id].length > 0)) && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-slate-200">
                      Face Swap Results
                    </h4>

                    <div className="grid grid-cols-1 gap-3">
                      {/* Show database images if available - ONLY show final results */}
                      {jobImages[currentJob.id] &&
                        jobImages[currentJob.id].length > 0 &&
                        (() => {
                          const images = jobImages[currentJob.id];
                          // ONLY show final face swap results, filter out everything else
                          const finalResults = images.filter(
                            (img) =>
                              img.filename.includes("PureInpaint_FaceSwap") ||
                              img.filename.includes("face_swap_result") ||
                              (img.filename.includes("final") &&
                                !img.filename.includes("temp"))
                          );

                          // Only return final results, no fallback
                          return finalResults.map((dbImage, index) => {
                            const isFinalResult = true; // All displayed images are final results

                            return (
                              <div
                                key={`db-${dbImage.id}`}
                                className="relative group ring-2 ring-green-500 ring-opacity-50"
                              >
                                <div className="absolute top-2 left-2 z-10">
                                  <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                                    ✨ Final Result
                                  </div>
                                </div>
                                <img
                                  src={dbImage.dataUrl || dbImage.url}
                                  alt={`Face swap result ${index + 1}`}
                                  className="w-full rounded-lg shadow-md hover:shadow-lg transition-shadow"
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
                                      console.log(
                                        "Falling back to ComfyUI URL"
                                      );
                                      (e.target as HTMLImageElement).src =
                                        dbImage.url;
                                    } else if (
                                      currentSrc === dbImage.url &&
                                      dbImage.dataUrl
                                    ) {
                                      console.log(
                                        "Falling back to database URL"
                                      );
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
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() =>
                                        downloadDatabaseImage(dbImage)
                                      }
                                      className="p-2 bg-slate-800/50 rounded-lg shadow-md hover:shadow-lg"
                                      title={`Download ${dbImage.filename}`}
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => shareImage(dbImage)}
                                      className="p-2 bg-slate-800/50 rounded-lg shadow-md hover:shadow-lg"
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
                              </div>
                            );
                          });
                        })()}

                      {/* Show message if no final results found */}
                      {jobImages[currentJob.id] &&
                        jobImages[currentJob.id].length > 0 &&
                        (() => {
                          const images = jobImages[currentJob.id];
                          const finalResults = images.filter(
                            (img) =>
                              img.filename.includes("PureInpaint_FaceSwap") ||
                              img.filename.includes("face_swap_result") ||
                              (img.filename.includes("final") &&
                                !img.filename.includes("temp"))
                          );

                          if (finalResults.length === 0) {
                            return (
                              <div className="text-center py-8">
                                <div className="text-slate-400 mb-3">
                                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">
                                    Processing face swap...
                                  </p>
                                  <p className="text-xs">
                                    Final result will appear here once ready
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                      {/* Fallback to legacy URLs if no database images - filter for final results */}
                      {(!jobImages[currentJob.id] ||
                        jobImages[currentJob.id].length === 0) &&
                        currentJob.resultUrls &&
                        currentJob.resultUrls.length > 0 &&
                        currentJob.resultUrls
                          .filter(
                            (url) =>
                              url.includes("PureInpaint_FaceSwap") ||
                              url.includes("face_swap_result") ||
                              (!url.includes("temp") &&
                                !url.includes("reference"))
                          )
                          .map((url, index) => (
                            <div
                              key={`legacy-${currentJob.id}-${index}`}
                              className="relative group"
                            >
                              <img
                                src={url}
                                alt={`Face swap result ${index + 1}`}
                                className="w-full rounded-lg shadow-md hover:shadow-lg transition-shadow"
                                onError={(e) => {
                                  console.error(
                                    "Legacy image load error:",
                                    url
                                  );
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
                                        `face-swap-${index + 1}.png`
                                      )
                                    }
                                    className="p-2 bg-slate-800/50 rounded-lg shadow-md hover:shadow-lg"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(url);
                                      alert("Image URL copied to clipboard!");
                                    }}
                                    className="p-2 bg-slate-800/50 rounded-lg shadow-md hover:shadow-lg"
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

                {currentJob.error && (
                  <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/30 dark:to-pink-950/30 border-2 border-red-200 dark:border-red-800 rounded-2xl flex items-start gap-3 shadow-lg">
                    <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                        {currentJob.error}
                      </p>
                      <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                        Try adjusting your mask or prompt before running again.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Face Swaps - Persistent History */}
          {jobHistory.length > 0 && (
            <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-xl text-white shadow-lg">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-50">
                      Recent Face Swaps
                    </h3>
                    <p className="text-xs text-slate-400">
                      Last five jobs with quick access to results.
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-400">
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
                      className="flex items-center justify-between p-3 bg-white/80 dark:bg-gray-800/60 border border-gray-200/70 dark:border-gray-600 rounded-xl hover:border-purple-200 dark:hover:border-purple-500 hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        {job.status === "completed" && (
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        )}
                        {job.status === "failed" && !isJobCancelled(job) && (
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        )}
                        {isJobCancelled(job) && (
                          <XCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                        )}
                        {(job.status === "pending" ||
                          job.status === "processing") && (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-50 truncate">
                            {formatJobTime(job.createdAt)}
                          </p>
                          <p className="text-xs text-slate-400 capitalize">
                            {isJobCancelled(job) ? 'cancelled' : (job.status || "unknown")}
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
                            className="px-2 py-1 text-xs bg-green-500/20 text-green-300 border border-green-500/30 rounded hover:bg-green-500/30 transition-colors"
                          >
                            View Results
                          </button>
                        )}
                        {job.resultUrls && job.resultUrls.length > 0 && (
                          <button
                            onClick={() => fetchJobImages(job.id)}
                            className="px-2 py-1 text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded hover:bg-blue-500/30 transition-colors"
                            title="Refresh images"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        {(job.status === "pending" || job.status === "processing") && job.id === currentJob?.id && (
                          <button
                            onClick={() => pollJobStatus(job.id)}
                            className="px-2 py-1 text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded hover:bg-orange-500/30 transition-colors"
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
  </div>
  );
}
