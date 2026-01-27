// app/(dashboard)/workspace/generate-content/text-to-image/page.tsx - REDESIGNED TO MATCH SEEDREAM STYLE
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import { getBestImageUrl, hasS3Storage, buildDirectS3Url } from "@/lib/s3Utils";
import {
  ImageIcon,
  Wand2,
  Settings,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Sparkles,
  Sliders,
  RefreshCw,
  RotateCcw,
  ChevronDown,
  X,
  Plus,
  Archive,
  Info,
  Zap,
  FolderOpen,
  Check,
  Monitor,
  Copy,
} from "lucide-react";

// Types
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
  loras: LoRAConfig[];
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

interface DatabaseImage {
  id: string;
  filename: string;
  subfolder: string;
  type: string;
  fileSize?: number;
  width?: number;
  height?: number;
  format?: string;
  url?: string | null;
  dataUrl?: string;
  s3Key?: string;
  networkVolumePath?: string;
  awsS3Key?: string;
  awsS3Url?: string;
  createdAt: Date | string;
  prompt?: string;
  negativePrompt?: string;
  steps?: number;
  cfg?: number;
  guidance?: number;
  samplerName?: string;
  scheduler?: string;
  seed?: number;
  loraModels?: LoRAConfig[];
  metadata?: {
    prompt?: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    steps?: number;
    cfg?: number;
    guidance?: number;
    samplerName?: string;
    scheduler?: string;
    seed?: number;
    loras?: LoRAConfig[];
    aspectRatio?: string;
    [key: string]: any;
  };
}

// Recent generation history item type
interface GenerationHistoryItem {
  id: string;
  imageUrl: string;
  prompt: string;
  createdAt: string;
  width: number;
  height: number;
  status: "completed" | "processing" | "failed";
  metadata?: {
    width?: number;
    height?: number;
    steps?: number;
    cfg?: number;
    guidance?: number;
    samplerName?: string;
    scheduler?: string;
    seed?: number;
    loras?: LoRAConfig[];
    aspectRatio?: string;
    negativePrompt?: string;
    [key: string]: any;
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

export default function TextToImagePage() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();

  // Use global profile from header
  const { profileId: globalProfileId, selectedProfile } = useInstagramProfile();

  // Hydration fix - track if component is mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

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
    loras: [],
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
    imageCount?: number;
    totalImages?: number;
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
  const [jobImages, setJobImages] = useState<Record<string, DatabaseImage[]>>({});
  const [refreshingImages, setRefreshingImages] = useState(false);
  const [lastImageFetch, setLastImageFetch] = useState<Record<string, number>>({});
  const fetchingImagesRef = useRef<Set<string>>(new Set());

  // Folder selection states
  const [targetFolder, setTargetFolder] = useState<string>("");

  // Vault Integration State - only folders for the selected profile
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);

  // Folder dropdown state
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const folderDropdownRef = useRef<HTMLDivElement>(null);

  // Generation History State
  const [generationHistory, setGenerationHistory] = useState<GenerationHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Modal state for viewing images
  const [selectedImage, setSelectedImage] = useState<GenerationHistoryItem | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Persistent generation state keys
  const STORAGE_KEYS = {
    currentJob: 'text-to-image-current-job',
    isGenerating: 'text-to-image-is-generating',
    progressData: 'text-to-image-progress-data',
    jobHistory: 'text-to-image-job-history',
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(event.target as Node)) {
        setFolderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check for reuse data from sessionStorage (from Vault)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const reuseDataStr = sessionStorage.getItem('flux-t2i-reuse');
    if (reuseDataStr) {
      try {
        const reuseData = JSON.parse(reuseDataStr);
        
        // Populate form with reuse data
        if (reuseData.prompt) {
          setParams(prev => ({ ...prev, prompt: reuseData.prompt }));
        }
        if (reuseData.negativePrompt) {
          setParams(prev => ({ ...prev, negativePrompt: reuseData.negativePrompt }));
        }
        if (reuseData.width && reuseData.height) {
          setParams(prev => ({ ...prev, width: reuseData.width, height: reuseData.height }));
        }
        if (reuseData.steps) {
          setParams(prev => ({ ...prev, steps: reuseData.steps }));
        }
        if (reuseData.cfg !== undefined) {
          setParams(prev => ({ ...prev, cfg: reuseData.cfg }));
        }
        if (reuseData.guidance !== undefined) {
          setParams(prev => ({ ...prev, guidance: reuseData.guidance }));
        }
        if (reuseData.samplerName) {
          setParams(prev => ({ ...prev, samplerName: reuseData.samplerName }));
        }
        if (reuseData.scheduler) {
          setParams(prev => ({ ...prev, scheduler: reuseData.scheduler }));
        }
        if (reuseData.seed !== undefined) {
          setParams(prev => ({ ...prev, seed: reuseData.seed }));
        }
        if (reuseData.loras && Array.isArray(reuseData.loras)) {
          setParams(prev => ({ ...prev, loras: reuseData.loras }));
        }
        
        // Clear sessionStorage after use
        sessionStorage.removeItem('flux-t2i-reuse');
      } catch (e) {
        console.error('Error parsing reuse data:', e);
        sessionStorage.removeItem('flux-t2i-reuse');
      }
    }
  }, []);

  // Load generation history - useCallback so it can be used in dependencies
  const loadGenerationHistory = useCallback(async () => {
    if (!apiClient) return;
    setIsLoadingHistory(true);
    try {
      // Use the FLUX text-to-image-runpod endpoint for history
      const url = globalProfileId 
        ? `/api/generate/text-to-image-runpod?profileId=${globalProfileId}`
        : "/api/generate/text-to-image-runpod";
      const response = await apiClient.get(url);
      if (response.ok) {
        const data = await response.json();
        const images = data.images || [];
        console.log('📋 Loaded FLUX T2I generation history:', images.length, 'images for profile:', globalProfileId);
        setGenerationHistory(images);
      } else {
        console.error('Failed to load FLUX T2I history:', response.status);
        setGenerationHistory([]);
      }
    } catch (error) {
      console.error('Error loading FLUX T2I history:', error);
      setGenerationHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [apiClient, globalProfileId]);

  // Load generation history when apiClient is available or profile changes
  useEffect(() => {
    loadGenerationHistory();
  }, [loadGenerationHistory]);

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

  // Get display text for the selected folder
  const getSelectedFolderDisplay = (): string => {
    if (!targetFolder || !globalProfileId) return 'Select a vault folder to save images';
    
    const folder = vaultFolders.find(f => f.id === targetFolder);
    if (folder && selectedProfile) {
      const profileDisplay = selectedProfile.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile.name;
      return `Saving to Vault: ${profileDisplay} / ${folder.name}`;
    }
    return 'Select a vault folder to save images';
  };

  // Get current aspect ratio info
  const getCurrentAspectRatio = () => {
    const matched = ASPECT_RATIOS.find(
      ar => ar.width === params.width && ar.height === params.height
    );
    return matched || { name: "Custom", ratio: `${params.width}:${params.height}`, width: params.width, height: params.height };
  };

  // Load persistent state on component mount
  useEffect(() => {
    if (typeof window !== 'undefined' && apiClient) {
      try {
        const savedCurrentJob = localStorage.getItem(STORAGE_KEYS.currentJob);
        const savedIsGenerating = localStorage.getItem(STORAGE_KEYS.isGenerating);
        const savedProgressData = localStorage.getItem(STORAGE_KEYS.progressData);
        const savedJobHistory = localStorage.getItem(STORAGE_KEYS.jobHistory);

        if (savedJobHistory) {
          try {
            const history = JSON.parse(savedJobHistory);
            if (Array.isArray(history)) {
              setJobHistory(history.slice(0, 5));
            }
          } catch (error) {
            localStorage.removeItem(STORAGE_KEYS.jobHistory);
          }
        }

        if (savedCurrentJob) {
          const job = JSON.parse(savedCurrentJob);
          setCurrentJob(job);
          
          if (savedIsGenerating === 'true' && (job.status === 'pending' || job.status === 'processing')) {
            setIsGenerating(true);
            
            if (savedProgressData) {
              setProgressData(JSON.parse(savedProgressData));
            }
            
            setTimeout(() => {
              pollJobStatus(job.id);
            }, 100);
          } else if (job.status === 'completed') {
            if (!fetchingImagesRef.current.has(job.id)) {
              fetchingImagesRef.current.add(job.id);
              fetchJobImages(job.id).finally(() => {
                fetchingImagesRef.current.delete(job.id);
              });
            }
          }
        }
      } catch (error) {
        clearPersistentState();
      }
    }
  }, [apiClient]);

  const clearPersistentState = () => {
    if (typeof window !== 'undefined') {
      const keysToKeep = [STORAGE_KEYS.jobHistory];
      Object.values(STORAGE_KEYS).forEach(key => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      });
    }
    clearGlobalProgress();
  };

  const isJobCancelled = (job: GenerationJob) => {
    return job.status === 'failed' && job.error === 'Job canceled by user';
  };

  // Save state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (currentJob && (currentJob.status === 'pending' || currentJob.status === 'processing')) {
        localStorage.setItem(STORAGE_KEYS.currentJob, JSON.stringify(currentJob));
      } else {
        localStorage.removeItem(STORAGE_KEYS.currentJob);
      }
    }
  }, [currentJob]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.isGenerating, isGenerating.toString());
      
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
      
      if (!isGenerating) {
        localStorage.removeItem(STORAGE_KEYS.progressData);
        clearGlobalProgress();
      }
    }
  }, [isGenerating, currentJob?.id, progressData.progress, progressData.stage, progressData.message, progressData.elapsedTime, progressData.estimatedTimeRemaining, updateGlobalProgress, clearGlobalProgress]);

  useEffect(() => {
    if (typeof window !== 'undefined' && isGenerating) {
      localStorage.setItem(STORAGE_KEYS.progressData, JSON.stringify(progressData));
      
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
  }, [progressData, isGenerating, currentJob?.id, updateGlobalProgress]);

  useEffect(() => {
    if (typeof window !== 'undefined' && Array.isArray(jobHistory) && jobHistory.length > 0) {
      const validHistory = jobHistory
        .filter(job => job && job.id && job.status)
        .slice(0, 5);
      
      if (validHistory.length > 0) {
        localStorage.setItem(STORAGE_KEYS.jobHistory, JSON.stringify(validHistory));
      }
    }
  }, [jobHistory]);

  // Auto-refresh for jobs
  useEffect(() => {
    if (!apiClient || !currentJob) return;

    if (currentJob.status === 'completed' || currentJob.status === 'failed') return;

    if (currentJob.status !== 'processing' && currentJob.status !== 'pending') return;

    const autoRefreshInterval = setInterval(() => {
      console.log('🔄 Auto-refresh: Job still processing...');
    }, 10000);

    return () => clearInterval(autoRefreshInterval);
  }, [apiClient, currentJob?.id, currentJob?.status]);

  // Watch for job status changes
  useEffect(() => {
    if (currentJob && currentJob.status === 'completed' && !isGenerating) {
      if (fetchingImagesRef.current.has(currentJob.id)) return;

      const currentImages = jobImages[currentJob.id];
      const hasImages = currentImages && currentImages.length > 0;
      
      if (!hasImages) {
        fetchingImagesRef.current.add(currentJob.id);
        
        fetchJobImages(currentJob.id).finally(() => {
          fetchingImagesRef.current.delete(currentJob.id);
        });
        
        let retryCount = 0;
        const maxRetries = 5;
        const retryDelays = [1000, 2000, 5000, 10000, 15000];
        
        const scheduleRetry = () => {
          if (retryCount < maxRetries) {
            setTimeout(async () => {
              const imgs = jobImages[currentJob.id];
              if (!imgs || imgs.length === 0) {
                await fetchJobImages(currentJob.id, true);
                retryCount++;
                scheduleRetry();
              }
            }, retryDelays[retryCount]);
          }
        };
        
        scheduleRetry();
      }
    }
  }, [currentJob?.status, currentJob?.id, isGenerating]);

  const fetchJobImages = async (jobId: string, forceRefresh: boolean = false): Promise<boolean> => {
    try {
      if (!apiClient) return false;

      const now = Date.now();
      const lastFetch = lastImageFetch[jobId] || 0;
      const cacheTimeout = 10000;

      if (!forceRefresh && now - lastFetch < cacheTimeout && jobImages[jobId] && jobImages[jobId].length > 0) {
        return true;
      }

      const response = await apiClient.get(`/api/jobs/${jobId}/images`);

      if (!response.ok) return false;

      const data = await response.json();

      if (data.success && data.images && Array.isArray(data.images)) {
        setLastImageFetch(prev => ({ ...prev, [jobId]: now }));
        setJobImages((prev) => ({ ...prev, [jobId]: data.images }));
        return data.images.length > 0;
      }
      return false;
    } catch (error) {
      console.error("Error fetching job images:", error);
      return false;
    }
  };

  // Download image
  const handleDownload = async (imageUrl: string, filename: string) => {
    try {
      let blobUrl: string;
      
      if (imageUrl.startsWith('data:')) {
        blobUrl = imageUrl;
      } else {
        const proxyUrl = `/api/download/image?url=${encodeURIComponent(imageUrl)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.status}`);
        }
        
        const blob = await response.blob();
        blobUrl = window.URL.createObjectURL(blob);
      }
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        if (!imageUrl.startsWith('data:')) {
          window.URL.revokeObjectURL(blobUrl);
        }
      }, 100);
    } catch (error) {
      console.error("Download failed:", error);
      setError("Failed to download image. Please try again.");
    }
  };

  // Fetch available LoRA models
  useEffect(() => {
    if (!apiClient) return;

    const fetchLoRAModels = async () => {
      try {
        setLoadingLoRAs(true);
        const response = await apiClient.get("/api/user/influencers");

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (Array.isArray(data)) {
          const loraModels: LoRAModel[] = data.map((inf: any) => ({
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
          }));

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

          setAvailableLoRAs(allLoraModels);
        }
      } catch (error) {
        console.error("Error loading LoRA models:", error);
      } finally {
        setLoadingLoRAs(false);
      }
    };

    fetchLoRAModels();
  }, [apiClient]);

  const generateRandomSeed = () => {
    setParams(prev => ({ ...prev, seed: Math.floor(Math.random() * 2147483647) }));
  };

  const handleAspectRatioChange = (width: number, height: number) => {
    setParams(prev => ({ ...prev, width, height }));
  };

  const addLoRA = () => {
    const newLoRA: LoRAConfig = {
      id: `lora-${Date.now()}`,
      modelName: "None",
      strength: 0.85,
    };
    setParams(prev => ({ ...prev, loras: [...prev.loras, newLoRA] }));
  };

  const removeLoRA = (id: string) => {
    setParams(prev => ({
      ...prev,
      loras: prev.loras.filter(lora => lora.id !== id),
    }));
  };

  const updateLoRA = (id: string, updates: Partial<LoRAConfig>) => {
    setParams(prev => ({
      ...prev,
      loras: prev.loras.map(lora =>
        lora.id === id ? { ...lora, ...updates } : lora
      ),
    }));
  };

  // Reuse settings from a generated image
  const handleReuseSettings = (image: GenerationHistoryItem) => {
    // Set prompt
    if (image.prompt) {
      setParams(prev => ({ ...prev, prompt: image.prompt }));
    }
    
    // Set dimensions from metadata
    if (image.metadata?.width && image.metadata?.height) {
      setParams(prev => ({ ...prev, width: image.metadata!.width!, height: image.metadata!.height! }));
    } else if (image.width && image.height) {
      setParams(prev => ({ ...prev, width: image.width, height: image.height }));
    }
    
    // Set negative prompt from metadata
    if (image.metadata?.negativePrompt) {
      setParams(prev => ({ ...prev, negativePrompt: image.metadata!.negativePrompt! }));
    }
    
    // Set steps from metadata
    if (image.metadata?.steps) {
      setParams(prev => ({ ...prev, steps: image.metadata!.steps! }));
    }
    
    // Set cfg from metadata
    if (image.metadata?.cfg !== undefined) {
      setParams(prev => ({ ...prev, cfg: image.metadata!.cfg! }));
    }
    
    // Set guidance from metadata
    if (image.metadata?.guidance !== undefined) {
      setParams(prev => ({ ...prev, guidance: image.metadata!.guidance! }));
    }
    
    // Set sampler from metadata
    if (image.metadata?.samplerName) {
      setParams(prev => ({ ...prev, samplerName: image.metadata!.samplerName! }));
    }
    
    // Set scheduler from metadata
    if (image.metadata?.scheduler) {
      setParams(prev => ({ ...prev, scheduler: image.metadata!.scheduler! }));
    }
    
    // Set seed from metadata (optional - user may want different seed)
    if (image.metadata?.seed !== undefined) {
      setParams(prev => ({ ...prev, seed: image.metadata!.seed! }));
    }
    
    // Set LoRAs from metadata
    if (image.metadata?.loras && Array.isArray(image.metadata.loras)) {
      setParams(prev => ({ ...prev, loras: image.metadata!.loras! }));
    }
    
    // Close any open modals
    setShowImageModal(false);
    setShowHistoryModal(false);
    setSelectedImage(null);
    
    // Scroll to top to show the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setParams({
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
      loras: [],
      seed: null,
    });
    setTargetFolder("");
    setError(null);
  };

  // Submit generation
  const handleGenerate = async () => {
    if (!apiClient) {
      setError("API client not available");
      return;
    }

    if (!targetFolder) {
      setError("Please select a vault folder to save your images");
      return;
    }

    if (!params.prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const workflow = createWorkflowJson(params, targetFolder);
      
      // Debug logging for vault params
      console.log('🔍 FRONTEND DEBUG: Vault params:', {
        globalProfileId,
        targetFolder,
        saveToVault: !!(globalProfileId && targetFolder),
      });
      
      updateGlobalProgress({
        isGenerating: true,
        progress: 0,
        stage: "starting",
        message: "Starting FLUX generation...",
        generationType: "text-to-image",
        jobId: `flux-${Date.now()}`,
      });

      const response = await apiClient.post("/api/generate/text-to-image-runpod", {
        workflow,
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        width: params.width,
        height: params.height,
        batchSize: params.batchSize,
        steps: params.steps,
        cfg: params.cfg,
        samplerName: params.samplerName,
        scheduler: params.scheduler,
        guidance: params.guidance,
        seed: params.seed,
        loras: params.loras.filter(l => l.modelName !== "None"),
        vaultProfileId: globalProfileId || null,
        vaultFolderId: targetFolder || null,
        saveToVault: !!(globalProfileId && targetFolder), // ✅ Enable vault saving when both profile and folder are selected
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Generation failed");
      }

      const data = await response.json();
      
      const newJob: GenerationJob = {
        id: data.jobId,
        status: "pending",
        progress: 0,
        createdAt: new Date(),
      };
      
      setCurrentJob(newJob);
      setJobHistory(prev => [newJob, ...prev.filter(j => j?.id !== newJob.id)].slice(0, 5));

      pollJobStatus(data.jobId);

    } catch (error: any) {
      console.error("Generation error:", error);
      setError(error.message || "Failed to generate images");
      setIsGenerating(false);
      clearGlobalProgress();
    }
  };

  const createWorkflowJson = (params: GenerationParams, targetFolder?: string) => {
    const seed = params.seed || Math.floor(Math.random() * 2147483647);
    const filenamePrefix = `TextToImage_${Date.now()}_${seed}`;
    const activeLoRAs = params.loras.filter(lora => lora.modelName !== "None");
    const useLoRA = activeLoRAs.length > 0;

    const workflow: any = {
      "1": {
        inputs: { width: params.width, height: params.height, batch_size: params.batchSize },
        class_type: "EmptyLatentImage",
      },
      "2": {
        inputs: { text: params.prompt, clip: ["5", 0] },
        class_type: "CLIPTextEncode",
      },
      "3": {
        inputs: { samples: ["12", 0], vae: ["4", 0] },
        class_type: "VAEDecode",
      },
      "4": {
        inputs: { vae_name: "ae.safetensors" },
        class_type: "VAELoader",
      },
      "5": {
        inputs: { clip_name1: "t5xxl_fp16.safetensors", clip_name2: "clip_l.safetensors", type: "flux" },
        class_type: "DualCLIPLoader",
      },
      "6": {
        inputs: { unet_name: "flux1-dev.safetensors", weight_dtype: "fp8_e4m3fn" },
        class_type: "UNETLoader",
      },
      "7": {
        inputs: { conditioning: ["2", 0], guidance: params.guidance },
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
        inputs: { conditioning: ["2", 0] },
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
        inputs: { filename_prefix: filenamePrefix, images: ["3", 0] },
        class_type: "SaveImage",
      },
    };

    if (useLoRA) {
      activeLoRAs.forEach((lora, index) => {
        const nodeId = `${14 + index}`;
        const previousNodeId = index === 0 ? "6" : `${14 + index - 1}`;
        
        workflow[nodeId] = {
          inputs: {
            model: [previousNodeId, 0],
            lora_name: lora.modelName,
            strength_model: lora.strength,
          },
          class_type: "LoraLoaderModelOnly",
        };
      });
    }

    return workflow;
  };

  const pollJobStatus = async (jobId: string) => {
    if (!apiClient) return;

    const maxAttempts = 360;
    let attempts = 0;

    const poll = async () => {
      attempts++;

      try {
        const response = await apiClient.get(`/api/jobs/${jobId}`);

        if (!response.ok) {
          if (attempts < maxAttempts) {
            setTimeout(poll, 2000);
          }
          return;
        }

        const job = await response.json();

        if (job.createdAt && typeof job.createdAt === "string") {
          job.createdAt = new Date(job.createdAt);
        }

        setCurrentJob(job);
        setJobHistory(prev =>
          prev.map(j => (j?.id === jobId ? job : j)).filter(Boolean).slice(0, 5)
        );

        if (job.progress !== undefined) {
          setProgressData({
            progress: job.progress || 0,
            stage: job.stage || (job.progress < 30 ? "starting" : job.progress < 70 ? "generating" : "saving"),
            message: job.message || `Progress: ${job.progress}%`,
            elapsedTime: job.elapsedTime,
            estimatedTimeRemaining: job.estimatedTimeRemaining,
            imageCount: job.imageCount,
            totalImages: job.totalImages,
          });
        }

        if (job.status === "completed") {
          setIsGenerating(false);
          clearPersistentState();

          setProgressData({
            progress: 100,
            stage: "completed",
            message: "✅ Generation completed!",
            elapsedTime: job.elapsedTime,
            estimatedTimeRemaining: 0,
          });

          await fetchJobImages(jobId, true);
          loadGenerationHistory();
          return;
        }

        if (job.status === "failed") {
          setIsGenerating(false);
          clearPersistentState();

          setProgressData({
            progress: 0,
            stage: "failed",
            message: job.error || "Generation failed",
            elapsedTime: job.elapsedTime,
            estimatedTimeRemaining: 0,
          });
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setIsGenerating(false);
          clearPersistentState();
        }
      } catch (error) {
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setIsGenerating(false);
          clearPersistentState();
        }
      }
    };

    setTimeout(poll, 3000);
  };

  const cancelGeneration = async () => {
    if (!apiClient || !currentJob?.id) return;

    const confirmed = confirm("Are you sure you want to cancel this generation?");
    if (!confirmed) return;

    try {
      setProgressData(prev => ({ ...prev, stage: "canceling", message: "🛑 Canceling generation..." }));

      const response = await apiClient.post(`/api/jobs/${currentJob.id}/cancel`);

      if (!response.ok) {
        throw new Error("Cancel failed");
      }

      const canceledJob = { ...currentJob, status: 'failed' as const, error: 'Job canceled by user' };

      setCurrentJob(canceledJob);
      setJobHistory(prev => 
        prev.map(job => job?.id === currentJob.id ? canceledJob : job).filter(Boolean).slice(0, 5)
      );

      setIsGenerating(false);
      clearPersistentState();

      setProgressData({ progress: 0, stage: "canceled", message: "🛑 Generation canceled", elapsedTime: progressData.elapsedTime, estimatedTimeRemaining: 0 });

      setTimeout(() => clearGlobalProgress(), 2000);

    } catch (error) {
      setProgressData(prev => ({ ...prev, stage: prev.stage === "canceling" ? "processing" : prev.stage }));
      setError("Failed to cancel generation");
    }
  };

  if (!apiClient) {
    return (
      <div className="relative min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-purple-400 mx-auto" />
          <h3 className="text-2xl font-bold text-white">Preparing AI Studio ✨</h3>
          <p className="text-slate-400">Setting up your creative workspace...</p>
        </div>
      </div>
    );
  }

  const currentAspect = getCurrentAspectRatio();

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-50">
      {/* Background effects */}
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
                <Wand2 className="w-6 h-6 text-white" />
                <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-purple-200">Live Studio</p>
                <h1 className="text-3xl sm:text-4xl font-black text-white">FLUX — Text to Image</h1>
              </div>
            </div>
            <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed">
              Create stunning AI-generated images with FLUX. Support for custom LoRA models, multiple aspect ratios, and batch generation.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-200"><Zap className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-slate-300">LoRA</p>
                  <p className="text-sm font-semibold text-white">Multi-Stack</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20 text-pink-200"><Sliders className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-slate-300">Control</p>
                  <p className="text-sm font-semibold text-white">Full params</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200"><Copy className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-slate-300">Batch</p>
                  <p className="text-sm font-semibold text-white">Up to 15</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="group inline-flex items-center gap-2 rounded-full bg-white text-slate-900 px-4 py-2 text-sm font-semibold shadow-lg shadow-purple-900/20 transition hover:-translate-y-0.5 hover:shadow-xl"
                title="View Help & Tips"
              >
                <Info className="w-4 h-4" />
                Quick Guide
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs text-slate-300">Size</p>
                <p className="text-lg font-semibold text-white">{params.width}×{params.height}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs text-slate-300">Aspect</p>
                <p className="text-lg font-semibold text-white">{currentAspect.ratio}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs text-slate-300">Batch</p>
                <p className="text-lg font-semibold text-white">{params.batchSize}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Generation Controls */}
          <div className="lg:col-span-1">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-purple-900/30 backdrop-blur space-y-6">
              {/* Prompt Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white">Prompt</label>
                  <span className="rounded-full bg-purple-500/20 px-3 py-1 text-[11px] font-semibold text-purple-100">Required</span>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent" />
                  <textarea
                    value={params.prompt}
                    onChange={(e) => setParams(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="Describe your vision in vivid detail..."
                    className="relative w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm text-white placeholder-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                    rows={4}
                    disabled={isGenerating}
                  />
                </div>
                <p className="text-xs text-slate-300">Be specific about style, lighting, composition.</p>
              </div>

              {/* Aspect Ratio Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-purple-300" />
                  <p className="text-sm font-semibold text-white">Aspect Ratio</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio.name}
                      onClick={() => handleAspectRatioChange(ratio.width, ratio.height)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition ${
                        params.width === ratio.width && params.height === ratio.height
                          ? "border-purple-400/60 bg-purple-500/10 shadow-lg shadow-purple-900/40"
                          : "border-white/10 bg-white/5 hover:border-purple-200/40"
                      }`}
                      disabled={isGenerating}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">{ratio.name}</p>
                          <p className="text-xs text-slate-400">{ratio.ratio}</p>
                        </div>
                        {params.width === ratio.width && params.height === ratio.height && (
                          <Check className="w-4 h-4 text-purple-400" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Folder Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Archive className="w-4 h-4 text-pink-300" />
                  <p className="text-sm font-semibold text-white">Save to Vault</p>
                  {isLoadingVaultData && (
                    <Loader2 className="w-3 h-3 animate-spin text-pink-300" />
                  )}
                </div>
                
                {/* Modern Custom Dropdown */}
                <div ref={folderDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => !(!mounted || isGenerating || isLoadingVaultData || !globalProfileId) && setFolderDropdownOpen(!folderDropdownOpen)}
                    disabled={!mounted || isGenerating || isLoadingVaultData || !globalProfileId}
                    className={`
                      w-full flex items-center justify-between gap-3 px-4 py-3.5
                      rounded-2xl border transition-all duration-200
                      ${folderDropdownOpen 
                        ? 'border-pink-400 bg-pink-500/10 ring-2 ring-pink-400/30' 
                        : 'border-white/10 bg-slate-800/80 hover:border-pink-400/50 hover:bg-slate-800'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`
                        flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
                        ${targetFolder 
                          ? 'bg-gradient-to-br from-pink-500/30 to-purple-500/30 border border-pink-400/30' 
                          : 'bg-slate-700/50 border border-white/5'
                        }
                      `}>
                        <FolderOpen className={`w-4 h-4 ${targetFolder ? 'text-pink-300' : 'text-slate-400'}`} />
                      </div>
                      <div className="text-left min-w-0">
                        <p className={`text-sm font-medium truncate ${targetFolder ? 'text-white' : 'text-slate-400'}`}>
                          {targetFolder 
                            ? vaultFolders.find(f => f.id === targetFolder)?.name || 'Select folder...'
                            : 'Select a folder...'
                          }
                        </p>
                        {targetFolder && selectedProfile && (
                          <p className="text-[11px] text-pink-300/70 truncate">
                            {selectedProfile.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${folderDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {folderDropdownOpen && mounted && (
                    <div className="absolute z-50 w-full bottom-full mb-2 py-2 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetFolder('');
                          setFolderDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center">
                          <X className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-sm text-slate-400">No folder selected</span>
                        {!targetFolder && <Check className="w-4 h-4 text-pink-400 ml-auto" />}
                      </button>

                      {vaultFolders.filter(f => !f.isDefault).length > 0 && (
                        <div className="my-2 mx-3 h-px bg-white/5" />
                      )}

                      <div className="max-h-[200px] overflow-y-auto">
                        {vaultFolders.filter(f => !f.isDefault).map((folder) => (
                          <button
                            key={folder.id}
                            type="button"
                            onClick={() => {
                              setTargetFolder(folder.id);
                              setFolderDropdownOpen(false);
                            }}
                            className={`
                              w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150
                              ${targetFolder === folder.id 
                                ? 'bg-pink-500/15' 
                                : 'hover:bg-white/5'
                              }
                            `}
                          >
                            <div className={`
                              w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                              ${targetFolder === folder.id 
                                ? 'bg-gradient-to-br from-pink-500/40 to-purple-500/40 border border-pink-400/40' 
                                : 'bg-slate-700/50 border border-white/5'
                              }
                            `}>
                              <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? 'text-pink-300' : 'text-slate-400'}`} />
                            </div>
                            <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-white font-medium' : 'text-slate-200'}`}>
                              {folder.name}
                            </span>
                            {targetFolder === folder.id && (
                              <Check className="w-4 h-4 text-pink-400 flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>

                      {vaultFolders.filter(f => !f.isDefault).length === 0 && (
                        <div className="px-4 py-6 text-center">
                          <FolderOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                          <p className="text-sm text-slate-400">No folders available</p>
                          <p className="text-xs text-slate-500 mt-1">Create folders in the Vault tab</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {targetFolder && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-pink-500/10 border border-pink-500/20">
                    <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
                    <p className="text-xs text-pink-200 flex-1 truncate">
                      {getSelectedFolderDisplay()}
                    </p>
                  </div>
                )}
              </div>

              {/* Batch Size */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">Batch Size</p>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-slate-200">{params.batchSize} image{params.batchSize !== 1 ? 's' : ''}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  value={params.batchSize}
                  onChange={(e) => setParams(prev => ({ ...prev, batchSize: Number(e.target.value) }))}
                  className="w-full accent-purple-400"
                  disabled={isGenerating}
                />
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>1</span>
                  <span>5</span>
                  <span>10</span>
                  <span>15</span>
                </div>
              </div>

              {/* LoRA Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-green-300" />
                    <p className="text-sm font-semibold text-white">Style Models (LoRA)</p>
                  </div>
                  {params.loras.filter(l => l.modelName !== "None").length > 0 && (
                    <span className="rounded-full bg-green-500/20 px-2 py-1 text-[11px] text-green-200">
                      {params.loras.filter(l => l.modelName !== "None").length} active
                    </span>
                  )}
                </div>

                {loadingLoRAs ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-green-500/30 bg-green-500/5">
                    <Loader2 className="w-4 h-4 animate-spin text-green-400" />
                    <span className="text-sm text-slate-300">Loading models...</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {params.loras.map((lora, index) => (
                      <div key={lora.id} className="p-3 rounded-xl border border-white/10 bg-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">LoRA {index + 1}</span>
                          <button onClick={() => removeLoRA(lora.id)} className="text-red-400 hover:text-red-300">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                        <select
                          value={lora.modelName}
                          onChange={(e) => updateLoRA(lora.id, { modelName: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-white/10 bg-slate-800 text-white text-sm"
                          disabled={isGenerating}
                        >
                          {availableLoRAs.map((model) => (
                            <option key={model.id} value={model.fileName}>
                              {model.displayName}
                            </option>
                          ))}
                        </select>
                        {lora.modelName !== "None" && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400">Strength</span>
                              <span className="text-green-300">{(lora.strength * 100).toFixed(0)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={lora.strength}
                              onChange={(e) => updateLoRA(lora.id, { strength: parseFloat(e.target.value) })}
                              className="w-full accent-green-400"
                              disabled={isGenerating}
                            />
                          </div>
                        )}
                      </div>
                    ))}

                    <button
                      onClick={addLoRA}
                      disabled={isGenerating}
                      className="w-full py-2.5 px-4 border border-dashed border-green-400/30 rounded-xl bg-green-500/5 hover:bg-green-500/10 text-green-300 text-sm font-medium transition flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add LoRA
                    </button>
                  </div>
                )}
              </div>

              {/* Advanced Settings Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-white">Advanced Settings</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>

              {/* Advanced Settings */}
              {showAdvanced && (
                <div className="space-y-4 p-4 rounded-xl border border-white/10 bg-white/5">
                  {/* Steps */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">Steps</span>
                      <span className="text-white font-medium">{params.steps}</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={params.steps}
                      onChange={(e) => setParams(prev => ({ ...prev, steps: parseInt(e.target.value) }))}
                      className="w-full accent-purple-400"
                      disabled={isGenerating}
                    />
                  </div>

                  {/* Guidance */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">Guidance</span>
                      <span className="text-white font-medium">{params.guidance}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="0.5"
                      value={params.guidance}
                      onChange={(e) => setParams(prev => ({ ...prev, guidance: parseFloat(e.target.value) }))}
                      className="w-full accent-purple-400"
                      disabled={isGenerating}
                    />
                  </div>

                  {/* Sampler */}
                  <div className="space-y-2">
                    <label className="text-sm text-slate-300">Sampler</label>
                    <select
                      value={params.samplerName}
                      onChange={(e) => setParams(prev => ({ ...prev, samplerName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-white/10 bg-slate-800 text-white text-sm"
                      disabled={isGenerating}
                    >
                      {SAMPLERS.map((sampler) => (
                        <option key={sampler} value={sampler}>{sampler}</option>
                      ))}
                    </select>
                  </div>

                  {/* Scheduler */}
                  <div className="space-y-2">
                    <label className="text-sm text-slate-300">Scheduler</label>
                    <select
                      value={params.scheduler}
                      onChange={(e) => setParams(prev => ({ ...prev, scheduler: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-white/10 bg-slate-800 text-white text-sm"
                      disabled={isGenerating}
                    >
                      {SCHEDULERS.map((scheduler) => (
                        <option key={scheduler} value={scheduler}>{scheduler}</option>
                      ))}
                    </select>
                  </div>

                  {/* Seed */}
                  <div className="space-y-2">
                    <label className="text-sm text-slate-300">Seed (Optional)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={params.seed || ""}
                        onChange={(e) => setParams(prev => ({ ...prev, seed: e.target.value ? parseInt(e.target.value) : null }))}
                        placeholder="Random"
                        className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-slate-800 text-white text-sm"
                        disabled={isGenerating}
                      />
                      <button
                        onClick={generateRandomSeed}
                        className="p-2 rounded-lg border border-white/10 bg-slate-800 hover:bg-slate-700 transition"
                        disabled={isGenerating}
                      >
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
                  <AlertCircle className="h-5 w-5 text-red-200" />
                  <p className="text-sm text-red-50">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-[1.6fr_0.4fr] gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !params.prompt.trim() || !targetFolder}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-400 via-pink-500 to-blue-600 px-6 py-3 font-semibold text-white shadow-xl shadow-purple-900/40 transition hover:-translate-y-0.5 disabled:from-slate-500 disabled:to-slate-500 disabled:shadow-none"
                >
                  <div className="relative flex items-center justify-center gap-2">
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Generating</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-5 h-5" />
                        <span>Generate</span>
                      </>
                    )}
                  </div>
                </button>
                <button
                  onClick={handleReset}
                  disabled={isGenerating}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-purple-200/40 disabled:opacity-60"
                  title="Reset form"
                >
                  <RotateCcw className="w-4 h-4 inline mr-2" />
                  Reset
                </button>
              </div>

              {/* Cancel Button */}
              {isGenerating && currentJob && (currentJob.status === "pending" || currentJob.status === "processing") && (
                <button
                  onClick={cancelGeneration}
                  className="w-full rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 hover:bg-red-500/20 transition flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancel Generation
                </button>
              )}
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-purple-900/30 backdrop-blur">
              {/* Current Generation Progress */}
              {isGenerating && currentJob && (
                <div className="mb-6 p-4 rounded-2xl border border-purple-500/30 bg-purple-500/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                      <span className="font-semibold text-white">Generating...</span>
                    </div>
                    <span className="text-purple-200">{progressData.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                    <div
                      className="bg-gradient-to-r from-purple-400 to-pink-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progressData.progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-slate-300">{progressData.message}</p>
                  {progressData.totalImages && progressData.totalImages > 1 && (
                    <p className="text-xs text-slate-400 mt-1">
                      Image {progressData.imageCount || 0} of {progressData.totalImages}
                    </p>
                  )}
                </div>
              )}

              {/* Generated Images from current job */}
              {currentJob && currentJob.status === 'completed' && jobImages[currentJob.id] && jobImages[currentJob.id].length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-white">
                      <ImageIcon className="w-4 h-4" />
                      Current Generation
                    </div>
                    <div className="rounded-full bg-green-500/20 px-3 py-1 text-xs text-green-200">
                      {jobImages[currentJob.id].length} image{jobImages[currentJob.id].length !== 1 ? 's' : ''} ready
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {jobImages[currentJob.id].map((image, index) => (
                      <div
                        key={image.id}
                        className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-purple-900/30 transition hover:-translate-y-1 hover:shadow-2xl"
                      >
                        <img
                          src={getBestImageUrl(image)}
                          alt={`Generated image ${index + 1}`}
                          className="w-full h-auto object-cover transition duration-700 group-hover:scale-[1.02]"
                          onError={(e) => {
                            if (image.dataUrl) {
                              (e.target as HTMLImageElement).src = image.dataUrl;
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition group-hover:opacity-100" />
                        <div className="absolute bottom-0 left-0 right-0 p-4 opacity-0 transition duration-300 group-hover:opacity-100">
                          <div className="flex items-center gap-2 text-[11px] text-slate-200/80 mb-2">
                            <span className="rounded-full bg-white/10 px-3 py-1">{image.width}×{image.height}</span>
                          </div>
                          <button
                            onClick={() => handleDownload(getBestImageUrl(image), image.filename)}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-md transition hover:bg-white"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No generation placeholder */}
              {(!currentJob || (currentJob.status !== 'processing' && currentJob.status !== 'pending' && (!jobImages[currentJob.id] || jobImages[currentJob.id].length === 0))) && !isGenerating && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/5 py-16 mb-8">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                    <ImageIcon className="w-7 h-7 text-purple-200" />
                  </div>
                  <p className="text-sm text-slate-200/80">Your generated images will appear here.</p>
                </div>
              )}

              {/* Generation History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                    <h3 className="text-sm font-semibold">Recent Generations</h3>
                    {generationHistory.length > 0 && (
                      <span className="text-xs text-slate-400">({generationHistory.length})</span>
                    )}
                  </div>
                  {generationHistory.length > 8 && (
                    <button
                      onClick={() => setShowHistoryModal(true)}
                      className="text-xs text-purple-300 hover:text-purple-200 transition flex items-center gap-1"
                    >
                      View All
                      <span className="bg-purple-500/20 rounded-full px-2 py-0.5">{generationHistory.length}</span>
                    </button>
                  )}
                </div>
                {generationHistory.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {generationHistory.slice(0, 8).map((image) => (
                      <button
                        key={image.id}
                        className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-md shadow-purple-900/20 transition hover:-translate-y-1 hover:border-purple-200/40"
                        onClick={() => {
                          setSelectedImage(image);
                          setShowImageModal(true);
                        }}
                      >
                        {image.imageUrl ? (
                          <img
                            src={image.imageUrl}
                            alt={image.prompt}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const placeholder = target.nextElementSibling as HTMLElement;
                              if (placeholder) placeholder.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className={`absolute inset-0 flex flex-col items-center justify-center bg-slate-800/50 ${image.imageUrl ? 'hidden' : 'flex'}`}
                        >
                          <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                          <span className="text-xs text-slate-400 px-2 text-center line-clamp-2">{image.prompt?.slice(0, 50) || 'Image'}</span>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 transition group-hover:opacity-100" />
                        <div className="absolute bottom-2 left-2 right-2 text-left text-[11px] text-slate-100 line-clamp-2 opacity-0 transition group-hover:opacity-100">
                          {image.prompt}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                    <span>{isLoadingHistory ? 'Loading history...' : 'No previous generations yet'}</span>
                    {isLoadingHistory && <RefreshCw className="w-4 h-4 animate-spin text-purple-200" />}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help Modal */}
      {showHelpModal && typeof window !== 'undefined' && document?.body && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowHelpModal(false)}
        >
          <div 
            className="relative w-full max-w-4xl max-h-[90vh] overflow-auto my-8 rounded-3xl border border-white/10 bg-slate-950/90 shadow-2xl shadow-purple-900/40 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowHelpModal(false)}
              className="sticky top-4 float-right mr-4 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-blue-600">
                  <Info className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white">FLUX Text-to-Image — Guide</h2>
              </div>

              <div className="space-y-8 text-slate-100">
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-purple-200">
                    <Sparkles className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">How to write better prompts</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold">✨ Recommended structure</p>
                      <p className="text-sm text-slate-200/80">Subject + Action + Environment + Style/Details</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4">
                        <p className="text-sm font-semibold text-emerald-50">✓ Good practices</p>
                        <ul className="mt-2 space-y-1 text-sm text-emerald-50/90 list-disc list-inside">
                          <li>Be specific and descriptive</li>
                          <li>Include lighting and mood</li>
                          <li>Mention camera angles</li>
                          <li>Describe composition</li>
                        </ul>
                      </div>
                      <div className="rounded-2xl border border-red-300/40 bg-red-400/10 p-4">
                        <p className="text-sm font-semibold text-red-50">✗ Avoid</p>
                        <ul className="mt-2 space-y-1 text-sm text-red-50/90 list-disc list-inside">
                          <li>Vague descriptions</li>
                          <li>Conflicting styles</li>
                          <li>Too many subjects</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-purple-200">
                    <Settings className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Parameter guide</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <h4 className="text-sm font-semibold text-white mb-1">🎨 LoRA Models</h4>
                      <p className="text-sm text-slate-200/80">Stack multiple LoRAs to combine styles. Lower strength for subtlety.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <h4 className="text-sm font-semibold text-white mb-1">📐 Aspect Ratio</h4>
                      <p className="text-sm text-slate-200/80">Portrait for people, landscape for scenes, square for balanced compositions.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <h4 className="text-sm font-semibold text-white mb-1">⚙️ Steps & Guidance</h4>
                      <p className="text-sm text-slate-200/80">Higher steps = more detail but slower. Guidance controls prompt adherence.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <h4 className="text-sm font-semibold text-white mb-1">🎲 Seed</h4>
                      <p className="text-sm text-slate-200/80">Use same seed to reproduce results. Leave empty for random.</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Image Modal */}
      {showImageModal && selectedImage && typeof window !== 'undefined' && document?.body && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4"
          onClick={() => {
            setShowImageModal(false);
            setSelectedImage(null);
          }}
        >
          <div 
            className="relative w-full max-w-3xl max-h-[85vh] overflow-auto rounded-3xl border border-white/10 bg-slate-950/90 shadow-2xl shadow-purple-900/40 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowImageModal(false);
                setSelectedImage(null);
              }}
              className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 space-y-4 text-slate-100">
              <div className="rounded-2xl border border-white/10 bg-slate-900 overflow-hidden max-h-[60vh] flex items-center justify-center">
                <img
                  src={selectedImage.imageUrl}
                  alt={selectedImage.prompt}
                  className="w-full h-auto max-h-[60vh] object-contain"
                />
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-purple-200">
                  <Info className="w-4 h-4" />
                  <h3 className="text-base font-semibold">Image details</h3>
                </div>
                <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Prompt</p>
                  <p className="text-sm text-slate-100 leading-relaxed">{selectedImage.prompt}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-200/80 mt-2">
                    <span className="rounded-full bg-white/10 px-3 py-1">{selectedImage.width}×{selectedImage.height}</span>
                    {selectedImage.metadata?.steps && (
                      <span className="rounded-full bg-white/10 px-3 py-1">Steps: {selectedImage.metadata.steps}</span>
                    )}
                    {selectedImage.metadata?.guidance && (
                      <span className="rounded-full bg-white/10 px-3 py-1">Guidance: {selectedImage.metadata.guidance}</span>
                    )}
                    {selectedImage.metadata?.seed && (
                      <span className="rounded-full bg-white/10 px-3 py-1">Seed: {selectedImage.metadata.seed}</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownload(selectedImage.imageUrl, `flux-${selectedImage.id}.png`)}
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-400 via-pink-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-900/40 transition hover:-translate-y-0.5"
                >
                  <Download className="w-4 h-4" />
                  Download image
                </button>

                <button
                  type="button"
                  onClick={() => handleReuseSettings(selectedImage)}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-white/10 hover:-translate-y-0.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reuse settings
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* View All History Modal */}
      {showHistoryModal && typeof window !== 'undefined' && document?.body && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4"
          onClick={() => setShowHistoryModal(false)}
        >
          <div 
            className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-purple-900/40 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/95 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                  <RefreshCw className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Generation History</h2>
                  <p className="text-xs text-slate-400">{generationHistory.length} images generated</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid of all history images */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {generationHistory.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {generationHistory.map((image) => (
                    <button
                      key={image.id}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-md shadow-purple-900/20 transition hover:-translate-y-1 hover:border-purple-200/40"
                      onClick={() => {
                        setShowHistoryModal(false);
                        setSelectedImage(image);
                        setShowImageModal(true);
                      }}
                    >
                      {image.imageUrl ? (
                        <img
                          src={image.imageUrl}
                          alt={image.prompt}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const placeholder = target.nextElementSibling as HTMLElement;
                            if (placeholder) placeholder.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`absolute inset-0 flex flex-col items-center justify-center bg-slate-800/50 ${image.imageUrl ? 'hidden' : 'flex'}`}
                      >
                        <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                        <span className="text-xs text-slate-400 px-2 text-center line-clamp-2">{image.prompt?.slice(0, 30) || 'Image'}</span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition group-hover:opacity-100" />
                      <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 transition group-hover:opacity-100">
                        <p className="text-[11px] text-slate-100 line-clamp-2 mb-1">{image.prompt}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
                          <span className="bg-white/20 rounded px-1.5 py-0.5">{image.width}×{image.height}</span>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 text-[9px] text-slate-300 bg-black/50 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition">
                        {new Date(image.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
                  <p>No generation history yet</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
