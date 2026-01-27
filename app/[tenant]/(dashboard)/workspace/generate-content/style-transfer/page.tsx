// app/(dashboard)/workspace/generate-content/style-transfer/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import MaskEditor from "@/components/MaskEditor";
import { getOptimizedImageUrl } from "@/lib/awsS3Utils";
import { ReferenceSelector } from "@/components/reference-bank/ReferenceSelector";
import { ReferenceItem } from "@/hooks/useReferenceBank";
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
  XCircle,
  Archive,
  ChevronDown,
  RotateCcw,
  Clock,
  Folder,
  Library,
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
  // Multi-LoRA support
  loras: LoRAConfig[];
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

// Interface for generation history images
interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  modelVersion: string;
  size: string;
  createdAt: string;
  status: "completed" | "processing" | "failed";
  source?: "generated" | "vault";
  profileId?: string;
  // Metadata for reuse functionality
  metadata?: {
    width?: number;
    height?: number;
    steps?: number;
    cfg?: number;
    samplerName?: string;
    scheduler?: string;
    guidance?: number;
    loraStrength?: number;
    selectedLora?: string;
    seed?: number | null;
    weight?: number;
    mode?: string;
    downsamplingFactor?: number;
    downsamplingFunction?: string;
    autocropMargin?: number;
    referenceImageUrl?: string;
    profileId?: string;
  };
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

  // Use global profile from header
  const { profileId: globalProfileId, selectedProfile } = useInstagramProfile();

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
    // Multi-LoRA support
    loras: [{
      id: crypto.randomUUID(),
      modelName: "AI MODEL 3.safetensors",
      strength: 0.95
    }],
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
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null); // Track URL for reuse
  const [isFromReferenceBank, setIsFromReferenceBank] = useState(false); // Track if image is from Reference Bank
  const [isSavingToReferenceBank, setIsSavingToReferenceBank] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [maskData, setMaskData] = useState<string | null>(null);
  const [showMaskEditor, setShowMaskEditor] = useState(false);
  const [uploadedImageFilename, setUploadedImageFilename] = useState<
    string | null
  >(null);

  // Folder selection states (vault-only)
  const [targetFolder, setTargetFolder] = useState<string>("");

  // Vault Integration State - Updated to use global profile
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);

  // Generation History State
  const [generationHistory, setGenerationHistory] = useState<GeneratedImage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Modal states
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Reference Bank Selector State
  const [showReferenceBankSelector, setShowReferenceBankSelector] = useState(false);

  // Hydration fix - track if component is mounted
  const [mounted, setMounted] = useState(false);

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

  // Multi-LoRA management functions
  const addLoRA = () => {
    const newLora: LoRAConfig = {
      id: crypto.randomUUID(),
      modelName: availableLoRAs[0]?.fileName || "AI MODEL 3.safetensors",
      strength: 0.95
    };
    setParams(prev => ({
      ...prev,
      loras: [...prev.loras, newLora]
    }));
  };

  const removeLoRA = (id: string) => {
    setParams(prev => ({
      ...prev,
      loras: prev.loras.filter(lora => lora.id !== id)
    }));
  };

  const updateLoRA = (id: string, field: keyof LoRAConfig, value: any) => {
    setParams(prev => ({
      ...prev,
      loras: prev.loras.map(lora => 
        lora.id === id ? { ...lora, [field]: value } : lora
      )
    }));
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

  // Load vault folders for the selected profile
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

  // Load generation history
  const loadGenerationHistory = useCallback(async () => {
    if (!apiClient) return;
    setIsLoadingHistory(true);
    try {
      // Add profileId to filter by selected profile
      const url = globalProfileId 
        ? `/api/generate/style-transfer?profileId=${globalProfileId}`
        : "/api/generate/style-transfer";
      const response = await apiClient.get(url);
      if (response.ok) {
        const data = await response.json();
        const images = data.images || [];
        console.log('📋 Loaded Style Transfer history:', images.length, 'images for profile:', globalProfileId);
        setGenerationHistory(images);
      } else {
        console.error('Failed to load Style Transfer history:', response.status);
      }
    } catch (error) {
      console.error('Error loading Style Transfer history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [apiClient, globalProfileId]);

  // Load generation history when apiClient is available or profile changes
  useEffect(() => {
    if (apiClient) {
      loadGenerationHistory();
    }
  }, [apiClient, globalProfileId, loadGenerationHistory]);

  // Handle reusing generation parameters from a previous generation
  const handleReuseSettings = async (image: GeneratedImage) => {
    // Set the prompt
    if (image.prompt) {
      setParams(prev => ({ ...prev, prompt: image.prompt }));
    }

    // Set parameters from metadata
    if (image.metadata) {
      const { metadata } = image;
      setParams(prev => ({
        ...prev,
        width: metadata.width || prev.width,
        height: metadata.height || prev.height,
        steps: metadata.steps || prev.steps,
        cfg: metadata.cfg || prev.cfg,
        samplerName: metadata.samplerName || prev.samplerName,
        scheduler: metadata.scheduler || prev.scheduler,
        guidance: metadata.guidance || prev.guidance,
        loraStrength: metadata.loraStrength || prev.loraStrength,
        selectedLora: metadata.selectedLora || prev.selectedLora,
        seed: metadata.seed !== undefined ? metadata.seed : prev.seed,
        weight: metadata.weight || prev.weight,
        mode: metadata.mode || prev.mode,
        downsamplingFactor: metadata.downsamplingFactor || prev.downsamplingFactor,
        downsamplingFunction: metadata.downsamplingFunction || prev.downsamplingFunction,
        autocropMargin: metadata.autocropMargin !== undefined ? metadata.autocropMargin : prev.autocropMargin,
      }));

      // Load reference image if available - create a proper File object
      if (metadata.referenceImageUrl) {
        try {
          console.log('🖼️ Loading reference image for reuse:', metadata.referenceImageUrl);
          const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(metadata.referenceImageUrl)}`);
          if (proxyResponse.ok) {
            const blob = await proxyResponse.blob();
            
            // Create a File object from the blob (required for generation)
            const file = new File([blob], 'reference-image.png', { type: blob.type || 'image/png' });
            setReferenceImage(file);
            setReferenceImageUrl(metadata.referenceImageUrl);
            setIsFromReferenceBank(true);
            
            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
              setReferenceImagePreview(reader.result as string);
            };
            reader.readAsDataURL(blob);
            console.log('✅ Reference image loaded for reuse');
          }
        } catch (err) {
          console.warn('Failed to load reference image:', err);
        }
      }
    }

    // Close the modal
    setShowImageModal(false);
    setSelectedImage(null);

    // Scroll to the top of the page to show the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Check for reuse data on mount
  useEffect(() => {
    setMounted(true);
    
    // Check for reuse data from Vault or other sources
    const checkForReuseData = async () => {
      try {
        const reuseDataStr = sessionStorage.getItem('flux-style-transfer-reuse');
        if (reuseDataStr) {
          const reuseData = JSON.parse(reuseDataStr);
          
          // Clear the sessionStorage immediately to prevent re-applying
          sessionStorage.removeItem('flux-style-transfer-reuse');
          
          // Apply the reuse data
          if (reuseData.prompt) {
            setParams(prev => ({ ...prev, prompt: reuseData.prompt }));
          }
          
          // Apply all other params from metadata
          if (reuseData.width) setParams(prev => ({ ...prev, width: reuseData.width }));
          if (reuseData.height) setParams(prev => ({ ...prev, height: reuseData.height }));
          if (reuseData.steps) setParams(prev => ({ ...prev, steps: reuseData.steps }));
          if (reuseData.cfg) setParams(prev => ({ ...prev, cfg: reuseData.cfg }));
          if (reuseData.samplerName) setParams(prev => ({ ...prev, samplerName: reuseData.samplerName }));
          if (reuseData.scheduler) setParams(prev => ({ ...prev, scheduler: reuseData.scheduler }));
          if (reuseData.guidance) setParams(prev => ({ ...prev, guidance: reuseData.guidance }));
          if (reuseData.loraStrength) setParams(prev => ({ ...prev, loraStrength: reuseData.loraStrength }));
          if (reuseData.selectedLora) setParams(prev => ({ ...prev, selectedLora: reuseData.selectedLora }));
          if (reuseData.seed !== undefined) setParams(prev => ({ ...prev, seed: reuseData.seed }));
          if (reuseData.weight) setParams(prev => ({ ...prev, weight: reuseData.weight }));
          if (reuseData.mode) setParams(prev => ({ ...prev, mode: reuseData.mode }));
          if (reuseData.downsamplingFactor) setParams(prev => ({ ...prev, downsamplingFactor: reuseData.downsamplingFactor }));
          if (reuseData.downsamplingFunction) setParams(prev => ({ ...prev, downsamplingFunction: reuseData.downsamplingFunction }));
          if (reuseData.autocropMargin !== undefined) setParams(prev => ({ ...prev, autocropMargin: reuseData.autocropMargin }));
          
          // Load reference image if available
          if (reuseData.referenceImageUrl) {
            try {
              const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(reuseData.referenceImageUrl)}`);
              if (proxyResponse.ok) {
                const blob = await proxyResponse.blob();
                
                // Create a File object from the blob for form submission
                const file = new File([blob], 'reference-image.png', { type: blob.type || 'image/png' });
                setReferenceImage(file);
                setReferenceImageUrl(reuseData.referenceImageUrl);
                setIsFromReferenceBank(true); // Treat as from Reference Bank to avoid re-saving
                
                // Create preview
                const reader = new FileReader();
                reader.onloadend = () => {
                  setReferenceImagePreview(reader.result as string);
                };
                reader.readAsDataURL(blob);
                
                console.log('✅ Reference image loaded from reuse data:', reuseData.referenceImageUrl);
              }
            } catch (err) {
              console.warn('Failed to load reference image:', err);
            }
          }
        }
      } catch (error) {
        console.error('Error parsing reuse data:', error);
      }
    };
    
    checkForReuseData();
  }, []);

  // Get display text for the selected vault folder
  const getSelectedFolderDisplay = (): string => {
    if (!targetFolder || !globalProfileId) return 'Please select a vault folder to save your images';
    
    const folder = vaultFolders.find(f => f.id === targetFolder);
    if (folder && selectedProfile) {
      const profileDisplay = selectedProfile.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile.name;
      return `Saving to Vault: ${profileDisplay} / ${folder.name}`;
    }
    return 'Please select a vault folder';
  };

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
    setReferenceImageUrl(null);
    setIsFromReferenceBank(false);
    setMaskData(null);
    setShowMaskEditor(false);
    setUploadedImageFilename(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Save uploaded image to Reference Bank
  const saveToReferenceBank = async (imageBase64: string, fileName: string): Promise<{ id: string; url: string } | null> => {
    if (!globalProfileId) return null;
    
    try {
      // Get file info
      const mimeType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      const extension = mimeType === 'image/png' ? 'png' : 'jpg';
      const finalFileName = fileName || `style-reference-${Date.now()}.${extension}`;
      
      // Convert base64 to blob for upload
      const base64Data = imageBase64.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      
      // Get dimensions from the image
      const img = new Image();
      const dimensionsPromise = new Promise<{ width: number; height: number }>((resolve) => {
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = imageBase64;
      });
      const dimensions = await dimensionsPromise;

      // Get presigned URL
      const presignedResponse = await fetch('/api/reference-bank/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: finalFileName,
          fileType: mimeType,
          profileId: globalProfileId,
        }),
      });

      if (!presignedResponse.ok) {
        const errorText = await presignedResponse.text();
        console.error('Failed to get presigned URL:', presignedResponse.status, errorText);
        return null;
      }

      const { presignedUrl, key, url } = await presignedResponse.json();

      // Upload to S3
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: blob,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Failed to upload to S3:', uploadResponse.status, errorText);
        return null;
      }

      // Create reference item in database
      const createResponse = await fetch('/api/reference-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: globalProfileId,
          name: finalFileName,
          fileType: 'image',
          mimeType,
          fileSize: blob.size,
          width: dimensions.width,
          height: dimensions.height,
          awsS3Key: key,
          awsS3Url: url,
          tags: ['style-transfer', 'reference'],
        }),
      });

      if (!createResponse.ok) {
        console.error('Failed to create reference item');
        return null;
      }

      const newReference = await createResponse.json();
      console.log('✅ Image saved to Reference Bank:', newReference.id);
      return { id: newReference.id, url: newReference.awsS3Url || url };
    } catch (err) {
      console.error('Error saving to Reference Bank:', err);
      return null;
    }
  };

  // Handle selection from Reference Bank
  const handleReferenceBankSelect = async (item: ReferenceItem) => {
    if (referenceImage) {
      // Remove existing reference image first
      removeReferenceImage();
    }

    try {
      // Use a proxy to fetch the image to avoid CORS issues
      const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(item.awsS3Url)}`);
      
      if (!proxyResponse.ok) {
        throw new Error('Failed to load reference image');
      }
      
      const blob = await proxyResponse.blob();
      
      // Create a File object from the blob
      const file = new File([blob], item.name || 'reference-image.png', { type: blob.type || 'image/png' });
      
      setReferenceImage(file);
      setReferenceImageUrl(item.awsS3Url); // Track the URL for metadata
      setIsFromReferenceBank(true); // Mark as from Reference Bank
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setReferenceImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(blob);
      
      // Track usage
      fetch(`/api/reference-bank/${item.id}/use`, { method: 'POST' }).catch(console.error);
      
      console.log('✅ Reference image loaded from Reference Bank:', item.name);
    } catch (err) {
      console.error('Error loading reference image from Reference Bank:', err);
      alert('Failed to load reference image. Please try again.');
    }

    setShowReferenceBankSelector(false);
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

  // Fetch available LoRA models on component mount (includes owned + shared LoRAs)
  useEffect(() => {
    const fetchLoRAModels = async () => {
      if (!apiClient) return;

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
          // Transform influencer format to LoRAModel format
          const loraModels: LoRAModel[] = data.map((inf: any) => ({
            fileName: inf.fileName,
            displayName: inf.isShared 
              ? `${inf.displayName} (Shared by ${inf.sharedBy})` 
              : inf.displayName,
            name: inf.name,
          }));
          
          console.log("Available LoRA models (owned + shared):", loraModels);
          setAvailableLoRAs(loraModels);

          // Set default LoRA for style transfer (AI MODEL 3)
          const aiModel3 = loraModels.find(
            (lora: LoRAModel) => lora.fileName === "AI MODEL 3.safetensors"
          );
          if (aiModel3) {
            setParams((prev) => ({
              ...prev,
              selectedLora: aiModel3.fileName,
            }));
          } else if (loraModels.length > 0) {
            const defaultLora = loraModels[0].fileName;
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

  // Reset form
  const handleReset = () => {
    setParams({
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
      weight: 0.8,
      mode: "center crop (square)",
      downsamplingFactor: 1,
      downsamplingFunction: "area",
      autocropMargin: 0.1,
      loras: [{
        id: crypto.randomUUID(),
        modelName: "AI MODEL 3.safetensors",
        strength: 0.95
      }],
    });
    setReferenceImage(null);
    setReferenceImagePreview(null);
    setMaskData(null);
    setUploadedImageFilename(null);
    setTargetFolder("");
    setCurrentJob(null);
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

    if (!globalProfileId) {
      alert("Please select a profile from the header to save your images");
      return;
    }

    if (!targetFolder) {
      alert("Please select a folder to save your stylized images");
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

      // Save reference image to Reference Bank if not already from there
      let currentReferenceImageUrl = referenceImageUrl;
      if (!isFromReferenceBank && referenceImagePreview && globalProfileId) {
        console.log("📚 Saving reference image to Reference Bank...");
        setIsSavingToReferenceBank(true);
        try {
          const fileName = referenceImage?.name || `style-reference-${Date.now()}.png`;
          const savedRef = await saveToReferenceBank(referenceImagePreview, fileName);
          if (savedRef) {
            currentReferenceImageUrl = savedRef.url;
            setReferenceImageUrl(savedRef.url);
            setIsFromReferenceBank(true);
            console.log("✅ Reference image saved to Reference Bank:", savedRef.url);
          }
        } catch (err) {
          console.warn("⚠️ Failed to save to Reference Bank, continuing with generation:", err);
        } finally {
          setIsSavingToReferenceBank(false);
        }
      }

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
        uploadResult.maskFilename,
        targetFolder
      );
      console.log("Created style transfer workflow for serverless submission");

      // Build request payload with all params at top level for webhook metadata extraction
      const requestPayload: any = {
        workflow,
        // Include all params at top level for webhook metadata extraction
        prompt: params.prompt,
        negativePrompt: '',
        width: params.width,
        height: params.height,
        steps: params.steps,
        cfg: params.cfg,
        guidance: params.guidance,
        samplerName: params.samplerName,
        scheduler: params.scheduler,
        // Only include seed if it's not null
        ...(params.seed !== null && { seed: params.seed }),
        loraStrength: params.loraStrength,
        selectedLora: params.selectedLora,
        loras: params.loras,
        // Style transfer specific params
        weight: params.weight,
        mode: params.mode,
        downsamplingFactor: params.downsamplingFactor,
        downsamplingFunction: params.downsamplingFunction,
        autocropMargin: params.autocropMargin,
        // Also include in nested params for backward compatibility
        params: {
          ...params,
          source: 'flux-style-transfer',
          generationType: 'style-transfer',
          referenceImage: uploadResult.filename,
        },
        action: "generate_style_transfer",
        generation_type: "style_transfer",
        generationType: 'style-transfer',
        user_id: user?.id,
        referenceImage: uploadResult.filename,
        maskImage: uploadResult.maskFilename,
        // Include base64 data for direct use by RunPod
        referenceImageData: uploadResult.base64,
        maskImageData: uploadResult.maskBase64,
        // Add source for tracking
        source: 'flux-style-transfer',
        // Include reference image URL for metadata storage (from Reference Bank or auto-saved)
        referenceImageUrl: currentReferenceImageUrl || null,
      };

      // Parse vault folder and add parameters
      // Check if using the new format (just folder ID) or old format (vault:profileId:folderId)
      if (globalProfileId && targetFolder && !targetFolder.startsWith('vault:')) {
        // New format: just folder ID, use global profile
        requestPayload.saveToVault = true;
        requestPayload.vaultProfileId = globalProfileId;
        requestPayload.vaultFolderId = targetFolder;
        console.log("🗂️ Saving to vault:", { profileId: globalProfileId, folderId: targetFolder });
      } else if (targetFolder.startsWith('vault:')) {
        // Old format: vault:profileId:folderId
        const parts = targetFolder.replace('vault:', '').split(':');
        const profileId = parts[0];
        const folderId = parts[1];
        requestPayload.saveToVault = true;
        requestPayload.vaultProfileId = profileId;
        requestPayload.vaultFolderId = folderId;
        console.log("🗂️ Saving to vault (legacy):", { profileId, folderId });
      }

      // Submit to serverless API endpoint instead of local ComfyUI
      const response = await apiClient.post("/api/generate/serverless", requestPayload);

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
          
          // Reload generation history to show the new image
          console.log("📋 Reloading generation history after completion");
          await loadGenerationHistory();

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
    maskFilename?: string,
    targetFolder?: string
  ) => {
    const seed = params.seed || Math.floor(Math.random() * 1000000000);

    // Determine the last LoRA node ID for chaining
    const loraCount = params.loras.length;
    const lastLoraNodeId = loraCount > 1 ? `5${loraCount}` : "51";
    
    // Build filename prefix (vault folders handled by backend)
    const filenamePrefix = "StyleTransfer";

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
          filename_prefix: filenamePrefix,
          images: ["8", 0],
        },
        class_type: "SaveImage",
      },
      "33": {
        inputs: {
          text: "", // Negative prompt - empty for style transfer
          clip: ["51", 1], // Always connect to first LoRA node's CLIP output (LoraLoaderModelOnly doesn't output CLIP)
        },
        class_type: "CLIPTextEncode",
      },
      "31": {
        inputs: {
          model: [lastLoraNodeId, 0], // Connect to last LoRA node's model output
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
      // Multi-LoRA support: Chain LoRA loaders
      // First LoRA connects to base model (node 37)
      "51": {
        inputs: {
          model: ["37", 0],
          clip: ["38", 0],
          lora_name: params.loras[0]?.modelName || params.selectedLora,
          strength_model: params.loras[0]?.strength || params.loraStrength,
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
          clip: ["51", 1], // Always connect to first LoRA node's CLIP output (LoraLoaderModelOnly doesn't output CLIP)
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

    // Add additional chained LoRA nodes if multiple LoRAs are configured
    if (params.loras.length > 1) {
      for (let i = 1; i < params.loras.length; i++) {
        const nodeId = `5${i + 1}`; // 52, 53, 54, etc.
        const prevNodeId = i === 1 ? "51" : `5${i}`; // Chain from previous LoRA node
        
        workflow[nodeId] = {
          inputs: {
            model: [prevNodeId, 0], // Connect to previous LoRA's model output
            lora_name: params.loras[i].modelName,
            strength_model: params.loras[i].strength,
            // Note: LoraLoaderModelOnly does NOT accept 'clip' or 'strength_clip' parameters
          },
          class_type: "LoraLoaderModelOnly",
        };
      }
    }

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
    <div className="relative min-h-screen bg-slate-950 text-slate-50">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute inset-x-10 top-20 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <div className="grid gap-4 md:grid-cols-[2fr_1fr] items-center">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-purple-900/30 backdrop-blur">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-blue-600 shadow-lg shadow-purple-900/50">
                <Palette className="w-6 h-6 text-white" />
                <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                  FLUX Style Transfer
                </h1>
                <p className="text-sm text-slate-400">Transform images with AI-powered artistic styles</p>
              </div>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Upload a reference image and apply its style to your creations using advanced FLUX Redux technology. Perfect for creating consistent branded content.
            </p>
          </div>

          {/* Profile indicator card */}
          <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-3xl p-6 shadow-xl backdrop-blur">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-purple-500/30 flex items-center justify-center">
                <Folder className="w-5 h-5 text-purple-300" />
              </div>
              <div>
                <p className="text-sm text-purple-200/80">Current Profile</p>
                <p className="text-lg font-semibold text-white">
                  {selectedProfile ? (selectedProfile.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile.name) : 'No profile selected'}
                </p>
              </div>
            </div>
            <p className="text-xs text-purple-200/60">
              Images will be saved to this profile's vault
            </p>
          </div>
        </div>

        {/* Error Display */}
        {currentJob?.error && !isJobCancelled(currentJob) && (
          <div className="p-4 bg-gradient-to-r from-red-950/50 to-pink-950/50 border border-red-500/30 rounded-2xl flex items-start gap-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="p-2 bg-red-500/20 rounded-lg flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-red-100">Oops! Something went wrong</h3>
              <p className="text-sm text-red-300 mt-1 break-words">{currentJob.error}</p>
            </div>
            <button
              onClick={() => setCurrentJob(prev => prev ? {...prev, error: undefined} : null)}
              className="text-red-400 hover:text-red-200 transition-colors p-1 hover:bg-red-500/20 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Input */}
          <div className="space-y-6">
            {/* Vault Folder Selection */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur">
              <div className="flex items-center gap-2 mb-4">
                <Archive className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-bold text-white">
                  Save to Vault
                </h2>
                {isLoadingVaultData && (
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                )}
              </div>
              
              {!globalProfileId ? (
                <div className="text-center py-4">
                  <p className="text-slate-400 text-sm">Please select a profile from the header to see vault folders</p>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <select
                      value={targetFolder}
                      onChange={(e) => setTargetFolder(e.target.value)}
                      disabled={isLoadingVaultData}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-inner [&>option]:bg-slate-800 [&>option]:text-white"
                    >
                      <option value="">📁 Select a vault folder...</option>
                      {vaultFolders.filter(f => !f.isDefault).map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                  
                  {/* Selected folder display */}
                  <p className="text-xs text-slate-400 mt-2">
                    {getSelectedFolderDisplay()}
                  </p>
                </>
              )}
            </div>

            {/* Reference Image Upload */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-pink-400" />
                  <h2 className="text-lg font-bold text-white">
                    Style Reference Image
                  </h2>
                </div>
                {/* Reference Bank Button */}
                {mounted && globalProfileId && (
                  <button
                    type="button"
                    onClick={() => setShowReferenceBankSelector(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/30 transition-all"
                    disabled={isGenerating}
                  >
                    <Library className="w-3.5 h-3.5" />
                    Reference Bank
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-300">
                    Upload your reference image for style transfer
                  </label>
                  {referenceImage && (
                    <button
                      onClick={removeReferenceImage}
                      className="text-xs text-red-400 hover:text-red-300"
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
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-white/20 shadow-lg">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm sm:text-base md:text-lg font-semibold text-slate-800 dark:text-white flex items-center">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-indigo-600" />
                    Style Description
                  </label>
                  <button
                    onClick={() =>
                      setParams((prev) => ({ ...prev, prompt: "" }))
                    }
                    className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 active:scale-95 transition-transform"
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
                  className="w-full h-24 sm:h-28 md:h-32 px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
                <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center gap-1 xs:gap-2">
                  <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                    {params.prompt.length}/1000 characters
                  </div>
                  <div className="text-[10px] sm:text-xs text-indigo-600 dark:text-indigo-400">
                    💡 Tip: Be specific about the artistic style you want
                  </div>
                </div>
              </div>
            </div>

            {/* Basic Settings */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-white/20 shadow-lg">
              <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800 dark:text-white mb-3 sm:mb-4 flex items-center">
                <Sliders className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-indigo-600" />
                Style Transfer Settings
              </h3>

              {/* Style Weight */}
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6 p-3 sm:p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg sm:rounded-xl">
                <label className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-white flex items-center">
                  <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-indigo-600" />
                  Style Weight:{" "}
                  <span className="ml-1.5 sm:ml-2 text-indigo-600 font-bold">
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

              {/* Multi-LoRA Configuration */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-800 dark:text-white flex items-center">
                    <Layers className="w-4 h-4 mr-2 text-purple-600" />
                    LoRA Models (Power LoRA Loader)
                  </label>
                  <button
                    onClick={addLoRA}
                    disabled={loadingLoRAs}
                    className="px-3 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-medium rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                  >
                    <span>+</span>
                    <span>Add LoRA</span>
                  </button>
                </div>

                {loadingLoRAs ? (
                  <div className="flex items-center space-x-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-gray-500">
                      Loading LoRA models...
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {params.loras.map((lora, index) => (
                      <div
                        key={lora.id}
                        className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                            LoRA {index + 1}
                          </span>
                          {params.loras.length > 1 && (
                            <button
                              onClick={() => removeLoRA(lora.id)}
                              className="text-red-500 hover:text-red-700 transition-colors"
                              title="Remove LoRA"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* LoRA Model Selection */}
                        <div>
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                            Model
                          </label>
                          <select
                            value={lora.modelName}
                            onChange={(e) =>
                              updateLoRA(lora.id, "modelName", e.target.value)
                            }
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            {availableLoRAs.map((loraModel, idx) => (
                              <option
                                key={`${loraModel.fileName}-${idx}`}
                                value={loraModel.fileName}
                              >
                                {loraModel.displayName}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* LoRA Strength */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              Strength
                            </label>
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                              {lora.strength.toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.05"
                            value={lora.strength}
                            onChange={(e) =>
                              updateLoRA(
                                lora.id,
                                "strength",
                                parseFloat(e.target.value)
                              )
                            }
                            className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span>0</span>
                            <span>2</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-white/20 shadow-lg">
              <div className="grid grid-cols-[2fr_0.5fr] gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={
                    isGenerating ||
                    !params.prompt.trim() ||
                    !referenceImage ||
                    uploadingImage ||
                    !targetFolder
                  }
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-200 flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-lg hover:shadow-xl disabled:cursor-not-allowed active:scale-95 text-sm sm:text-base"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                      <span>Applying Style Transfer...</span>
                    </>
                  ) : uploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                      <span>Uploading Image...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>Apply Style Transfer</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleReset}
                  disabled={isGenerating}
                  className="rounded-lg sm:rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-700/50 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:border-indigo-400 dark:hover:border-indigo-400 disabled:opacity-60 flex items-center justify-center"
                  title="Reset form"
                >
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
              
              {!targetFolder && !isGenerating && (
                <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-amber-600 dark:text-amber-400 text-center">
                  ⚠️ Please select a folder before applying style transfer
                </p>
              )}
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {/* Image Statistics */}
            {imageStats && (
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-white/20 shadow-lg">
                <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800 dark:text-white mb-3 sm:mb-4 flex items-center">
                  <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-green-600" />
                  Your Image Library
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm">
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2 sm:p-3">
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
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6 border border-white/20 shadow-lg">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800 dark:text-white flex items-center">
                    <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-purple-600" />
                    Generation Status
                  </h3>
                  {currentJob.status === "completed" && (
                    <button
                      onClick={() => fetchJobImages(currentJob.id)}
                      className="p-1.5 sm:p-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors active:scale-95"
                      title="Refresh generated images"
                    >
                      <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                  {/* Reset button for stuck jobs */}
                  {(currentJob.status === "processing" || currentJob.status === "pending") && !isGenerating && (
                    <button
                      onClick={resetStuckJob}
                      className="p-1.5 sm:p-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-95"
                      title="Reset stuck job state"
                    >
                      <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between p-2 sm:p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                      Status
                    </span>
                    <div className="flex items-center space-x-1.5 sm:space-x-2">
                      {(currentJob.status === "pending" ||
                        currentJob.status === "processing") && (
                        <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-indigo-600" />
                      )}
                      {currentJob.status === "completed" && (
                        <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
                      )}
                      {currentJob.status === "failed" && !isJobCancelled(currentJob) && (
                        <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
                      )}
                      {currentJob.status === "failed" && isJobCancelled(currentJob) && (
                        <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600" />
                      )}
                      <span className="text-xs sm:text-sm font-semibold capitalize text-slate-900 dark:text-white">
                        {currentJob.status === "failed" && isJobCancelled(currentJob)
                          ? "cancelled"
                          : currentJob.status}
                      </span>
                    </div>
                  </div>

                  {(currentJob.progress !== undefined || progressData.progress > 0) && 
                   !isJobCancelled(currentJob) && (
                    <div className="space-y-3 sm:space-y-4">
                      {/* Enhanced Progress Display */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                          Progress
                        </span>
                        <div className="flex items-center space-x-1.5 sm:space-x-2">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                            {Math.round(progressData.progress || currentJob.progress || 0)}%
                          </span>
                          {progressData.estimatedTimeRemaining && 
                           Number(progressData.estimatedTimeRemaining) > 0 && 
                           Math.round(Number(progressData.estimatedTimeRemaining)) > 0 && (
                            <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
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

            {/* Recent Generations Section */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Recent Generations</h2>
                  <p className="text-sm text-slate-400">
                    {globalProfileId && selectedProfile 
                      ? `${selectedProfile.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile.name}'s style transfers`
                      : 'Your recent style transfers'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadGenerationHistory()}
                  disabled={isLoadingHistory}
                  className="px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-lg transition-colors flex items-center gap-2 text-sm"
                >
                  {isLoadingHistory ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Refresh
                </button>
                {generationHistory.length > 8 && (
                  <button
                    onClick={() => setShowHistoryModal(true)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    View All ({generationHistory.length})
                  </button>
                )}
              </div>
            </div>
            
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : generationHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="w-12 h-12 text-slate-600 mb-4" />
                <p className="text-slate-400">No style transfers yet</p>
                <p className="text-sm text-slate-500 mt-1">Generate your first style transfer to see it here</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {generationHistory.slice(0, 8).map((image) => (
                  <div
                    key={image.id}
                    onClick={() => {
                      setSelectedImage(image);
                      setShowImageModal(true);
                    }}
                    className="group relative aspect-square bg-slate-800/50 rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-purple-500/50 transition-all"
                  >
                    <img
                      src={image.imageUrl}
                      alt={image.prompt || 'Style transfer'}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-xs text-white/90 line-clamp-2">{image.prompt || 'No prompt'}</p>
                        <p className="text-xs text-slate-400 mt-1">{image.size}</p>
                      </div>
                    </div>
                    {image.status === "processing" && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View All History Modal */}
      {mounted && showHistoryModal && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">All Generations</h2>
                  <p className="text-sm text-slate-400">{generationHistory.length} style transfers</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {generationHistory.map((image) => (
                  <div
                    key={image.id}
                    onClick={() => {
                      setSelectedImage(image);
                      setShowImageModal(true);
                      setShowHistoryModal(false);
                    }}
                    className="group relative aspect-square bg-slate-800/50 rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-purple-500/50 transition-all"
                  >
                    <img
                      src={image.imageUrl}
                      alt={image.prompt || 'Style transfer'}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-xs text-white/90 line-clamp-2">{image.prompt || 'No prompt'}</p>
                        <p className="text-xs text-slate-400 mt-1">{new Date(image.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Image Preview Modal */}
      {mounted && showImageModal && selectedImage && createPortal(
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Image Preview</h3>
              <button
                onClick={() => {
                  setShowImageModal(false);
                  setSelectedImage(null);
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Image */}
                <div className="aspect-square bg-slate-800/50 rounded-xl overflow-hidden">
                  <img
                    src={selectedImage.imageUrl}
                    alt={selectedImage.prompt || 'Style transfer'}
                    className="w-full h-full object-contain"
                  />
                </div>
                
                {/* Details */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-1">Prompt</h4>
                    <p className="text-white">{selectedImage.prompt || 'No prompt'}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-1">Size</h4>
                      <p className="text-white">{selectedImage.size || 'Unknown'}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-1">Created</h4>
                      <p className="text-white">{new Date(selectedImage.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  {selectedImage.metadata && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-slate-400">Settings</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {selectedImage.metadata.steps && (
                          <div className="bg-slate-800/50 rounded-lg p-2">
                            <span className="text-slate-400">Steps:</span>{' '}
                            <span className="text-white">{selectedImage.metadata.steps}</span>
                          </div>
                        )}
                        {selectedImage.metadata.cfg && (
                          <div className="bg-slate-800/50 rounded-lg p-2">
                            <span className="text-slate-400">CFG:</span>{' '}
                            <span className="text-white">{selectedImage.metadata.cfg}</span>
                          </div>
                        )}
                        {selectedImage.metadata.weight && (
                          <div className="bg-slate-800/50 rounded-lg p-2">
                            <span className="text-slate-400">Weight:</span>{' '}
                            <span className="text-white">{selectedImage.metadata.weight}</span>
                          </div>
                        )}
                        {selectedImage.metadata.guidance && (
                          <div className="bg-slate-800/50 rounded-lg p-2">
                            <span className="text-slate-400">Guidance:</span>{' '}
                            <span className="text-white">{selectedImage.metadata.guidance}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3 pt-4">
                    <button
                      onClick={() => handleReuseSettings(selectedImage)}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reuse Settings
                    </button>
                    <a
                      href={selectedImage.imageUrl}
                      download={`style-transfer-${selectedImage.id}.png`}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reference Bank Selector */}
      {showReferenceBankSelector && globalProfileId && (
        <ReferenceSelector
          profileId={globalProfileId}
          onSelect={handleReferenceBankSelect}
          onClose={() => setShowReferenceBankSelector(false)}
          filterType="image"
          isOpen={true}
        />
      )}
      </div>
    </div>
  );
}
