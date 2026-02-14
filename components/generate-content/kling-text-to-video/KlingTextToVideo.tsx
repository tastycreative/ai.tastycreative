"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import { useCredits } from '@/lib/hooks/useCredits.query';
import { CreditCalculator } from "@/components/credits/CreditCalculator";
import { StorageFullBanner, useCanGenerate } from "@/components/generate-content/shared/StorageFullBanner";
import {
  AlertCircle,
  Archive,
  ChevronDown,
  Clock,
  Download,
  Film,
  Folder,
  FolderOpen,
  Info,
  Loader2,
  Maximize2,
  Play,
  RefreshCw,
  RotateCcw,
  Settings,
  Sparkles,
  Video,
  Zap,
  X,
  Wand2,
  Camera,
  Check,
  HelpCircle,
  Save,
  Trash2,
} from "lucide-react";

interface VaultFolder {
  id: string;
  name: string;
  profileId: string;
  profileName?: string;
  isDefault?: boolean;
  parentId?: string | null;
  subfolders?: Array<{ id: string }>;
}

interface GeneratedVideo {
  id: string;
  videoUrl: string;
  prompt: string;
  model: string;
  duration: string;
  aspectRatio: string;
  createdAt: string;
  status: "completed" | "processing" | "failed";
  profileName?: string;
  metadata?: {
    negativePrompt?: string;
    mode?: string;
    cfgScale?: number;
    sound?: string | null;
    cameraControl?: any;
    profileId?: string | null;
  };
}

// Kling model options with feature support flags
const MODEL_OPTIONS = [
  { value: "kling-v1", label: "Kling V1", description: "Standard quality", supportsSound: false, supportsCfgScale: true, supportsCameraControl: false },
  { value: "kling-v1-6", label: "Kling V1.6", description: "Enhanced V1", supportsSound: false, supportsCfgScale: true, supportsCameraControl: true },
  { value: "kling-v2-master", label: "Kling V2 Master", description: "V2 high quality", supportsSound: false, supportsCfgScale: false, supportsCameraControl: true },
  { value: "kling-v2-1-master", label: "Kling V2.1 Master", description: "V2.1 improved", supportsSound: false, supportsCfgScale: false, supportsCameraControl: true },
  { value: "kling-v2-5-turbo", label: "Kling V2.5 Turbo", description: "Fast V2.5", supportsSound: false, supportsCfgScale: false, supportsCameraControl: true },
  { value: "kling-v2-6", label: "Kling V2.6", description: "Latest with audio", supportsSound: true, supportsCfgScale: false, supportsCameraControl: true },
] as const;

// Mode options
const MODE_OPTIONS = [
  { value: "std", label: "Standard", description: "Faster generation" },
  { value: "pro", label: "Professional", description: "Higher quality" },
] as const;

// Duration options
const DURATION_OPTIONS = [
  { value: "5", label: "5 seconds", description: "Quick clip" },
  { value: "10", label: "10 seconds", description: "Extended clip" },
] as const;

// Aspect ratio options
const ASPECT_RATIO_OPTIONS = [
  { value: "16:9", label: "16:9", description: "Landscape (HD)" },
  { value: "9:16", label: "9:16", description: "Portrait (Stories/Reels)" },
  { value: "1:1", label: "1:1", description: "Square" },
] as const;

// Camera control options
const CAMERA_CONTROL_TYPE_OPTIONS = [
  { value: "simple", label: "Simple (6-axis)", description: "Custom 6-axis control" },
  { value: "down_back", label: "Down & Back", description: "Pan down and zoom out" },
  { value: "forward_up", label: "Forward & Up", description: "Zoom in and pan up" },
  { value: "right_turn_forward", label: "Right Turn Forward", description: "Rotate right and advance" },
  { value: "left_turn_forward", label: "Left Turn Forward", description: "Rotate left and advance" },
] as const;

// 6-axis camera config options (for simple type)
const CAMERA_AXIS_OPTIONS = [
  { key: "horizontal", label: "Horizontal", description: "Left/Right movement", min: -10, max: 10 },
  { key: "vertical", label: "Vertical", description: "Up/Down movement", min: -10, max: 10 },
  { key: "pan", label: "Pan", description: "Up/Down rotation", min: -10, max: 10 },
  { key: "tilt", label: "Tilt", description: "Left/Right rotation", min: -10, max: 10 },
  { key: "roll", label: "Roll", description: "Clockwise/Counter rotation", min: -10, max: 10 },
  { key: "zoom", label: "Zoom", description: "Focal length change", min: -10, max: 10 },
] as const;

// Prompt Templates
const PROMPT_TEMPLATES = [
  {
    name: "Cinematic Landscape",
    prompt: "A breathtaking cinematic drone shot slowly flying over a vast mountain range at golden hour, warm sunlight casting long shadows, dramatic clouds drifting across the sky, camera smoothly gliding forward",
    category: "Cinematic"
  },
  {
    name: "Product Showcase",
    prompt: "Professional product photography of a luxury watch on a minimalist white surface, soft studio lighting, camera slowly rotating around the product, highlighting reflections and details",
    category: "Commercial"
  },
  {
    name: "Nature Scene",
    prompt: "Serene forest scene with morning mist filtering through tall trees, gentle breeze rustling leaves, birds flying gracefully, camera slowly panning from left to right",
    category: "Nature"
  },
  {
    name: "Urban Time-lapse",
    prompt: "Bustling city street at night, neon lights reflecting on wet pavement, people walking by in motion blur, camera stationary capturing the energy and movement",
    category: "Urban"
  },
  {
    name: "Social Media Reel",
    prompt: "Trendy close-up of colorful smoothie bowl being garnished with fresh berries, artistic overhead angle, natural lighting, camera slowly zooming in",
    category: "Social"
  },
  {
    name: "Abstract Art",
    prompt: "Abstract flowing liquid colors in vibrant purples and pinks, smooth organic movements, psychedelic patterns emerging and dissolving, camera slowly zooming into the center",
    category: "Abstract"
  },
] as const;

// Default Presets
const DEFAULT_PRESETS = [
  {
    name: "Cinematic Pro",
    settings: {
      model: "kling-v1-6",
      mode: "pro",
      duration: "10",
      aspectRatio: "16:9",
      cfgScale: 0.3,
      useCameraControl: true,
      cameraControlType: "forward_up",
    }
  },
  {
    name: "Quick Social",
    settings: {
      model: "kling-v2-5-turbo",
      mode: "std",
      duration: "5",
      aspectRatio: "9:16",
      cfgScale: 0.5,
      useCameraControl: false,
    }
  },
  {
    name: "High Quality",
    settings: {
      model: "kling-v2-6",
      mode: "pro",
      duration: "10",
      aspectRatio: "16:9",
      cfgScale: 0.5,
      sound: "on",
      useCameraControl: true,
      cameraControlType: "simple",
    }
  },
] as const;

// Tooltip content
const TOOLTIPS = {
  model: "Choose the AI model version. V1.6 is stable and supports CFG scale. V2.6 is the latest with audio support.",
  mode: "Standard mode is faster (~2-3 min). Professional mode produces higher quality but takes longer (~4-6 min).",
  cfgScale: "Controls creativity vs accuracy. Lower values (0-0.4) = more creative and varied. Higher values (0.6-1.0) = more faithful to prompt.",
  cameraControl: "Add cinematic camera movements like zoom, pan, tilt, or predefined motions to your video.",
  duration: "5 seconds for quick clips, 10 seconds for extended scenes. Longer duration increases generation time.",
  aspectRatio: "Video dimensions. Choose 16:9 for landscape (YouTube, HD), 9:16 for portrait (Stories/Reels), or 1:1 for square posts.",
  sound: "Enable AI-generated audio that matches your video. Only available in Professional mode with V2.6 model.",
  negativePrompt: "Describe what you want to avoid in the video (e.g., 'blurry, distorted, low quality, text, watermark').",
} as const;

export default function KlingTextToVideo() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress, addJob, updateJob, hasActiveGenerationForType, getLastCompletedJobForType, clearCompletedJobsForType, activeJobs } = useGenerationProgress();
  const { refreshCredits } = useCredits();
  const { canGenerate, storageError } = useCanGenerate();

  // Check if this specific tab has an active generation
  const hasActiveGeneration = hasActiveGenerationForType('kling-text-to-video');

  // Use global profile from header
  const { profileId: globalProfileId, selectedProfile } = useInstagramProfile();
  
  // Check if "All Profiles" is selected
  const isAllProfiles = globalProfileId === "all";

  // Hydration fix - track if component is mounted
  const [mounted, setMounted] = useState(false);
  
  // Check for stale active jobs and try to complete them from history
  useEffect(() => {
    if (!mounted || !apiClient) return;

    const checkStaleJob = async () => {
      const activeJob = activeJobs.find(
        job => job.generationType === 'kling-text-to-video' && 
        (job.status === 'pending' || job.status === 'processing')
      );

      if (activeJob) {
        try {
          const url = globalProfileId 
            ? `/api/generate/kling-text-to-video?history=true&profileId=${globalProfileId}`
            : "/api/generate/kling-text-to-video?history=true";
          const response = await apiClient.get(url);
          
          if (response.ok) {
            const data = await response.json();
            const recentVideos = data.videos || [];
            
            const jobTimeWindow = 60 * 1000;
            const matchingVideos = recentVideos.filter((video: any) => {
              const videoCreatedAt = new Date(video.createdAt).getTime();
              return videoCreatedAt >= activeJob.startedAt && 
                     videoCreatedAt <= activeJob.startedAt + jobTimeWindow;
            });

            if (matchingVideos.length > 0) {
              console.log('✅ Found completed videos for stale Kling T2V job');
              updateJob(activeJob.jobId, {
                status: 'completed',
                progress: 100,
                message: 'Generation completed',
                results: matchingVideos,
                completedAt: Date.now(),
              });
              
              setGeneratedVideos(matchingVideos);
              setGenerationHistory((prev: any) => {
                const allVideos = [...matchingVideos, ...prev];
                const uniqueHistory = allVideos.filter((video: any, index: number, self: any[]) =>
                  index === self.findIndex((v: any) => v.id === video.id)
                ).slice(0, 20);
                return uniqueHistory;
              });
            }
          }
        } catch (error) {
          console.error('Failed to check for completed Kling T2V generation:', error);
        }
      }
    };

    checkStaleJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, apiClient]);
  
  useEffect(() => {
    setMounted(true);
    
    // Check for reuse data from Vault
    const reuseData = sessionStorage.getItem('kling-t2v-reuse');
    if (reuseData) {
      try {
        const data = JSON.parse(reuseData);
        console.log('Restoring Kling T2V settings from Vault:', data);
        
        // Set prompt and negative prompt
        if (data.prompt) setPrompt(data.prompt);
        if (data.negativePrompt) setNegativePrompt(data.negativePrompt);
        
        // Set model
        if (data.model && MODEL_OPTIONS.find(m => m.value === data.model)) {
          setModel(data.model);
        }
        
        // Set mode
        if (data.mode && MODE_OPTIONS.find(m => m.value === data.mode)) {
          setMode(data.mode);
        }
        
        // Set duration
        if (data.duration && DURATION_OPTIONS.find(d => d.value === data.duration)) {
          setDuration(data.duration);
        }
        
        // Set aspect ratio
        if (data.aspectRatio && ASPECT_RATIO_OPTIONS.find(a => a.value === data.aspectRatio)) {
          setAspectRatio(data.aspectRatio);
        }
        
        // Set CFG scale
        if (typeof data.cfgScale === 'number') {
          setCfgScale(data.cfgScale);
        }
        
        // Set sound
        if (data.sound) {
          setSound(data.sound);
        }
        
        // Set camera control
        if (data.cameraControl) {
          setUseCameraControl(true);
          if (data.cameraControl.type) {
            setCameraControlType(data.cameraControl.type);
          }
          if (data.cameraControl.config) {
            setCameraConfig(data.cameraControl.config);
          }
        }
        
        // Clear the sessionStorage after reading
        sessionStorage.removeItem('kling-t2v-reuse');
      } catch (err) {
        console.error('Error parsing Kling T2V reuse data:', err);
        sessionStorage.removeItem('kling-t2v-reuse');
      }
    }
  }, []);

  // Check for completed generations when component mounts or jobs update
  useEffect(() => {
    if (!mounted || isGenerating) return;
    
    const lastCompletedJob = getLastCompletedJobForType('kling-text-to-video');
    if (lastCompletedJob && lastCompletedJob.results && Array.isArray(lastCompletedJob.results)) {
      setGeneratedVideos(prev => {
        const existingIds = new Set(prev.map((video: any) => video.id));
        const newResults = lastCompletedJob.results.filter((video: any) => !existingIds.has(video.id));
        
        if (newResults.length > 0) {
          console.log('📋 Displaying results from completed Kling T2V:', newResults.length);
          return [...newResults, ...prev];
        }
        return prev;
      });
      
      setGenerationHistory((prev: any) => {
        const allVideos = [...lastCompletedJob.results, ...prev];
        const uniqueHistory = allVideos.filter((video: any, index: number, self: any[]) =>
          index === self.findIndex((v: any) => v.id === video.id)
        ).slice(0, 20);
        return uniqueHistory;
      });
    }
  }, [mounted, getLastCompletedJobForType, activeJobs]);

  // Folder dropdown state
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const folderDropdownRef = useRef<HTMLDivElement>(null);

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

  // Form state
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [model, setModel] = useState<string>("kling-v1-6");
  const [mode, setMode] = useState<string>("std");
  const [duration, setDuration] = useState<string>("5");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [cfgScale, setCfgScale] = useState<number>(0.5);
  const [sound, setSound] = useState<"on" | "off">("off");
  const [useCameraControl, setUseCameraControl] = useState(false);
  const [cameraControlType, setCameraControlType] = useState<string>("simple");
  const [cameraConfig, setCameraConfig] = useState<Record<string, number>>({
    horizontal: 0,
    vertical: 0,
    pan: 0,
    tilt: 0,
    roll: 0,
    zoom: 0,
  });
  const [selectedCameraAxis, setSelectedCameraAxis] = useState<string>("zoom");

  // Check model feature support
  const currentModel = MODEL_OPTIONS.find(m => m.value === model);
  const currentModelSupportsSound = currentModel?.supportsSound ?? false;
  const currentModelSupportsCfgScale = currentModel?.supportsCfgScale ?? true;
  const currentModelSupportsCameraControl = currentModel?.supportsCameraControl ?? false;

  // Folder state
  const [targetFolder, setTargetFolder] = useState<string>("");

  // Vault folder state - only for the selected profile
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);

  // Generation state
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [generationHistory, setGenerationHistory] = useState<GeneratedVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Toast notification state
  const [toastError, setToastError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  // Presets state
  const [userPresets, setUserPresets] = useState<any[]>([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Load user presets from localStorage
  useEffect(() => {
    if (mounted) {
      try {
        const saved = localStorage.getItem('kling-t2v-presets');
        if (saved) {
          setUserPresets(JSON.parse(saved));
        }
      } catch (err) {
        console.error('Failed to load presets:', err);
      }
    }
  }, [mounted]);

  // Save user presets to localStorage
  const saveUserPresets = (presets: any[]) => {
    try {
      localStorage.setItem('kling-t2v-presets', JSON.stringify(presets));
      setUserPresets(presets);
    } catch (err) {
      console.error('Failed to save presets:', err);
    }
  };

  // Show toast notification
  const showErrorToast = (message: string) => {
    setToastError(message);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      setTimeout(() => setToastError(null), 300);
    }, 5000);
  };

  const pauseAllPreviews = () => {
    const previewVideos = document.querySelectorAll<HTMLVideoElement>("video[data-role='preview']");
    previewVideos.forEach((video) => {
      video.pause();
      video.currentTime = 0;
    });
  };

  // Load vault folders for the selected profile
  const loadVaultData = useCallback(async () => {
    if (!apiClient || !globalProfileId) return;
    setIsLoadingVaultData(true);
    try {
      const foldersResponse = await fetch(`/api/vault/folders?profileId=${globalProfileId}`);
      if (foldersResponse.ok) {
        const data = await foldersResponse.json();
        const folders = Array.isArray(data) ? data : (data.folders || []);
        // Add profileName from response if available (for "all" profiles view)
        setVaultFolders(folders.map((f: any) => ({
          ...f,
          profileName: f.profileName || null
        })));
      }
    } catch (err) {
      console.error("Failed to load vault folders:", err);
      setVaultFolders([]);
    } finally {
      setIsLoadingVaultData(false);
    }
  }, [apiClient, globalProfileId]);

  // Helper: Get folder path as breadcrumb (e.g., "Parent / Child")
  const getFolderPath = useCallback((folderId: string): string => {
    const parts: string[] = [];
    let currentId: string | null = folderId;
    
    while (currentId) {
      const folder = vaultFolders.find(f => f.id === currentId);
      if (!folder) break;
      parts.unshift(folder.name);
      currentId = folder.parentId || null;
    }
    
    return parts.join(' / ');
  }, [vaultFolders]);

  // Helper: Get folder depth for indentation
  const getFolderDepth = useCallback((folderId: string): number => {
    let depth = 0;
    let currentId: string | null = folderId;
    
    while (currentId) {
      const folder = vaultFolders.find(f => f.id === currentId);
      if (!folder || !folder.parentId) break;
      depth++;
      currentId = folder.parentId;
    }
    
    return depth;
  }, [vaultFolders]);

  // Helper: Sort folders by hierarchy (parent before children)
  const sortFoldersHierarchically = useCallback((folders: VaultFolder[]): VaultFolder[] => {
    const result: VaultFolder[] = [];
    const addedIds = new Set<string>();
    
    const addFolderAndChildren = (folderId: string) => {
      if (addedIds.has(folderId)) return;
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return;
      
      result.push(folder);
      addedIds.add(folderId);
      
      // Add children
      const children = folders.filter(f => f.parentId === folderId);
      children.forEach(child => addFolderAndChildren(child.id));
    };
    
    // First add all root folders (no parent)
    const rootFolders = folders.filter(f => !f.parentId);
    rootFolders.forEach(folder => addFolderAndChildren(folder.id));
    
    return result;
  }, []);

  // Get display name for selected folder
  const getSelectedFolderDisplay = (): string => {
    if (!targetFolder || !globalProfileId) return "Select a vault folder to save videos";
    
    const folder = vaultFolders.find((f) => f.id === targetFolder);
    if (folder) {
      // Build folder path for nested folders
      const folderPath = getFolderPath(targetFolder);
      
      // When viewing all profiles, use folder's profileName
      if (isAllProfiles && folder.profileName) {
        return `Saving to Vault: ${folder.profileName} / ${folderPath}`;
      }
      // When viewing specific profile, use selectedProfile
      if (selectedProfile) {
        const profileDisplay = selectedProfile.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile.name;
        return `Saving to Vault: ${profileDisplay} / ${folderPath}`;
      }
      return `Saving to Vault: ${folderPath}`;
    }
    return "Select a vault folder to save videos";
  };

  const loadGenerationHistory = useCallback(async () => {
    if (!apiClient) return;
    setIsLoadingHistory(true);
    try {
      console.log("[Kling T2V Frontend] Loading generation history...");
      // Add profileId to filter by selected profile
      const url = globalProfileId
        ? `/api/generate/kling-text-to-video?history=true&profileId=${globalProfileId}`
        : "/api/generate/kling-text-to-video?history=true";
      const response = await apiClient.get(url);
      if (response.ok) {
        const data = await response.json();
        const videos = data.videos || [];
        console.log("[Kling T2V Frontend] Loaded videos:", videos.length);
        console.log("[Kling T2V Frontend] Video URLs present:", videos.filter((v: any) => !!v.videoUrl).length);
        setGenerationHistory(videos);
      } else {
        console.error("[Kling T2V Frontend] Failed to load history, status:", response.status);
      }
    } catch (err) {
      console.error("[Kling T2V Frontend] Failed to load generation history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [apiClient, globalProfileId]);

  useEffect(() => {
    if (apiClient) {
      loadVaultData();
      loadGenerationHistory();
      // Clear selected folder when profile changes
      setTargetFolder("");
    }
  }, [apiClient, loadVaultData, loadGenerationHistory]);

  const pollTaskStatus = (taskId: string, localTaskId: string) => {
    const maxAttempts = 120;
    let attempts = 0;

    return new Promise<void>((resolve, reject) => {
      const poll = async () => {
        try {
          attempts++;
          const elapsedSeconds = attempts * 5;
          setPollingStatus(
            `Processing... (${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s)`
          );
          updateJob(localTaskId, {
            progress: Math.min(90, attempts * 2),
            stage: 'processing',
            message: `Generating video... ${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`,
            status: 'processing',
            elapsedTime: elapsedSeconds * 1000,
          });

          const response = await apiClient?.get(
            `/api/generate/kling-text-to-video?taskId=${taskId}`
          );
          if (!response) throw new Error("API client not available");
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to check task status");
          }

          const data = await response.json();

          if (data.status === "completed" && data.videos && data.videos.length > 0) {
            updateJob(localTaskId, {
              status: 'completed',
              progress: 100,
              stage: 'completed',
              message: 'Video generation completed!',
              results: data.videos,
              completedAt: Date.now(),
            });
            setGeneratedVideos(data.videos);
            setPollingStatus("");
            setIsGenerating(false);
            loadGenerationHistory();
            resolve();
            return;
          }

          if (data.status === "failed") {
            throw new Error(data.error || "Video generation failed");
          }

          if (data.status === "processing" || data.status === "submitted") {
            if (attempts < maxAttempts) {
              setTimeout(poll, 5000);
              return;
            }
            throw new Error("Video generation timed out");
          }

          if (attempts < maxAttempts) {
            setTimeout(poll, 5000);
            return;
          }

          throw new Error("Video generation timed out");
        } catch (err: any) {
          console.error("Polling error:", err);
          setError(err.message || "Failed to check generation status");
          updateJob(localTaskId, {
            status: 'failed',
            progress: 0,
            stage: 'failed',
            message: err.message || 'Generation failed',
            error: err.message,
            completedAt: Date.now(),
          });
          setPollingStatus("");
          setIsGenerating(false);
          reject(err);
        }
      };

      poll();
    });
  };

  // Apply prompt template
  const applyPromptTemplate = (template: typeof PROMPT_TEMPLATES[number]) => {
    setPrompt(template.prompt);
  };

  // Apply preset
  const applyPreset = (preset: any) => {
    const settings = preset.settings;
    if (settings.model) setModel(settings.model);
    if (settings.mode) setMode(settings.mode);
    if (settings.duration) setDuration(settings.duration);
    if (settings.aspectRatio) setAspectRatio(settings.aspectRatio);
    if (typeof settings.cfgScale === 'number') setCfgScale(settings.cfgScale);
    if (settings.sound) setSound(settings.sound);
    if (typeof settings.useCameraControl === 'boolean') setUseCameraControl(settings.useCameraControl);
    if (settings.cameraControlType) setCameraControlType(settings.cameraControlType);
    if (settings.cameraConfig) setCameraConfig(settings.cameraConfig);
  };

  // Save current settings as preset
  const saveAsPreset = () => {
    if (!presetName.trim()) {
      showErrorToast('Please enter a preset name');
      return;
    }

    const newPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      settings: {
        model,
        mode,
        duration,
        aspectRatio,
        cfgScale,
        sound,
        useCameraControl,
        cameraControlType,
        cameraConfig,
      }
    };

    const updatedPresets = [...userPresets, newPreset];
    saveUserPresets(updatedPresets);
    setPresetName('');
    setShowPresetModal(false);
    showErrorToast(`Preset "${newPreset.name}" saved!`);
  };

  // Delete preset
  const deletePreset = (presetId: string) => {
    const updatedPresets = userPresets.filter(p => p.id !== presetId);
    saveUserPresets(updatedPresets);
  };

  const handleGenerate = async () => {
    if (!apiClient) {
      showErrorToast("API client not available");
      return;
    }

    // Check storage availability
    if (!canGenerate) {
      showErrorToast(storageError || "Storage is full. Please add more storage or free up space before generating.");
      return;
    }

    if (!targetFolder) {
      showErrorToast("Please select a vault folder to save your video");
      return;
    }
    if (!prompt.trim()) {
      showErrorToast("Please enter a prompt");
      return;
    }

    // Clear previous completed jobs for this type
    await clearCompletedJobsForType('kling-text-to-video');
    
    setIsGenerating(true);
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("Submitting task...");
    const localTaskId = `kling-t2v-${Date.now()}`;

    try {
      // Create job in global state
      addJob({
        jobId: localTaskId,
        generationType: 'kling-text-to-video',
        progress: 0,
        stage: 'starting',
        message: 'Starting Kling Text-to-Video generation...',
        status: 'pending',
        startedAt: Date.now(),
        metadata: {
          prompt: prompt.trim(),
          aspectRatio,
        },
      });
      
      const payload: any = {
        prompt: prompt.trim(),
        negative_prompt: negativePrompt.trim() || undefined,
        model_name: model, // API uses model_name, not model
        mode,
        duration,
        aspect_ratio: aspectRatio,
        // Use folder's profileId for proper association (works for both single and all profiles views)
        vaultProfileId: targetFolder ? vaultFolders.find(f => f.id === targetFolder)?.profileId || globalProfileId : globalProfileId,
      };

      // Add CFG scale only for V1 models that support it
      if (currentModelSupportsCfgScale) {
        payload.cfg_scale = cfgScale;
      }

      // Add sound parameter (only for V2.6+ models)
      if (currentModelSupportsSound) {
        payload.sound = sound;
      }

      // Add camera control if enabled and model supports it
      if (useCameraControl && currentModelSupportsCameraControl) {
        if (cameraControlType === "simple") {
          // For simple type, build config with the selected axis value
          const config: Record<string, number> = {};
          // Only include the selected axis with non-zero value
          if (cameraConfig[selectedCameraAxis] !== 0) {
            config[selectedCameraAxis] = cameraConfig[selectedCameraAxis];
          }
          payload.camera_control = {
            type: "simple",
            config: Object.keys(config).length > 0 ? config : undefined,
          };
        } else {
          // For predefined types (down_back, forward_up, etc.), config must be empty
          payload.camera_control = {
            type: cameraControlType,
          };
        }
      }

      // Add vault folder params if selected
      if (targetFolder && globalProfileId) {
        payload.saveToVault = true;
        payload.vaultFolderId = targetFolder;
      }

      const response = await apiClient.post(
        "/api/generate/kling-text-to-video",
        payload
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.details?.message || errorData.error || "Generation failed";
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Refresh credits after successful task submission
      refreshCredits();

      if (data.status === "completed" && data.videos && data.videos.length > 0) {
        updateJob(localTaskId, {
          status: 'completed',
          progress: 100,
          stage: 'completed',
          message: 'Generation completed!',
          results: data.videos,
          completedAt: Date.now(),
        });
        setGeneratedVideos(data.videos);
        setPollingStatus("");
        loadGenerationHistory();
        setIsGenerating(false);
      } else if (data.taskId) {
        await pollTaskStatus(data.taskId, localTaskId);
      }
    } catch (err: any) {
      console.error("Generation error:", err);
      showErrorToast(err.message || "Failed to generate video");
      updateJob(localTaskId, {
        status: 'failed',
        progress: 0,
        stage: 'failed',
        message: err.message || 'Generation failed',
        error: err.message,
        completedAt: Date.now(),
      });
      setPollingStatus("");
      setIsGenerating(false);
    }
  };

  const handleDownload = async (videoUrl: string, filename: string) => {
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const handleReset = async () => {
    // Clear completed jobs for this type
    await clearCompletedJobsForType('kling-text-to-video');
    
    setPrompt("");
    setNegativePrompt("");
    setModel("kling-v1-6");
    setMode("std");
    setDuration("5");
    setAspectRatio("16:9");
    setCfgScale(0.5);
    setSound("off");
    setUseCameraControl(false);
    setCameraControlType("simple");
    setCameraConfig({
      horizontal: 0,
      vertical: 0,
      pan: 0,
      tilt: 0,
      roll: 0,
      zoom: 0,
    });
    setSelectedCameraAxis("zoom");
    setTargetFolder("");
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("");
  };

  // Handle reuse settings from a selected video
  const handleReuseSettings = (video: GeneratedVideo) => {
    // Set prompt
    setPrompt(video.prompt || '');
    
    // Set negative prompt from metadata
    if (video.metadata?.negativePrompt) {
      setNegativePrompt(video.metadata.negativePrompt);
    }
    
    // Set model
    if (video.model && MODEL_OPTIONS.find(m => m.value === video.model)) {
      setModel(video.model);
    }
    
    // Set mode from metadata
    if (video.metadata?.mode && MODE_OPTIONS.find(m => m.value === video.metadata?.mode)) {
      setMode(video.metadata.mode);
    }
    
    // Set duration
    if (video.duration && DURATION_OPTIONS.find(d => d.value === video.duration)) {
      setDuration(video.duration);
    }
    
    // Set aspect ratio
    if (video.aspectRatio && ASPECT_RATIO_OPTIONS.find(a => a.value === video.aspectRatio)) {
      setAspectRatio(video.aspectRatio);
    }
    
    // Set CFG scale from metadata
    if (typeof video.metadata?.cfgScale === 'number') {
      setCfgScale(video.metadata.cfgScale);
    }
    
    // Set sound from metadata
    if (video.metadata?.sound) {
      setSound(video.metadata.sound as "on" | "off");
    }
    
    // Set camera control from metadata
    if (video.metadata?.cameraControl) {
      setUseCameraControl(true);
      const cameraControl = video.metadata.cameraControl;
      if (cameraControl.type) {
        setCameraControlType(cameraControl.type);
      }
      if (cameraControl.config) {
        setCameraConfig(cameraControl.config);
      }
    }
    
    // Close modal
    setShowVideoModal(false);
  };

  useEffect(() => {
    if (showVideoModal) {
      pauseAllPreviews();
    }
  }, [showVideoModal]);

  const openVideoModal = (video: GeneratedVideo) => {
    pauseAllPreviews();
    setSelectedVideo(video);
    setShowVideoModal(true);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowVideoModal(false);
        setShowHelpModal(false);
        setShowHistoryModal(false);
        setShowPresetModal(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Tooltip component
  const Tooltip = ({ content, children }: { content: string; children: React.ReactNode }) => {
    const [showTooltip, setShowTooltip] = useState(false);

    return (
      <div className="relative inline-block">
        <span
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={(e) => {
            e.stopPropagation();
            setShowTooltip(!showTooltip);
          }}
          className="inline-flex items-center text-zinc-400 dark:text-zinc-500 hover:text-[#EC67A1] transition-colors cursor-help"
        >
          {children}
        </span>
        {showTooltip && (
          <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 text-xs text-white bg-zinc-800 dark:bg-zinc-700 border border-zinc-600 rounded-lg shadow-xl pointer-events-none">
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-zinc-800 dark:bg-zinc-700 border-r border-b border-zinc-600 rotate-45" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-h-[85vh] overflow-y-auto overflow-x-hidden bg-[#F8F8F8] dark:bg-[#0a0a0f] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl shadow-lg custom-scrollbar relative text-sidebar-foreground">
      {/* Toast Notification */}
      {showToast && toastError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-red-400/50 bg-red-500/10 backdrop-blur-xl shadow-2xl max-w-md">
            <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0" />
            <span className="text-sm text-red-100">{toastError}</span>
            <button
              type="button"
              onClick={() => setShowToast(false)}
              className="ml-2 text-red-300 hover:text-red-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-[#EC67A1]/20 dark:bg-[#EC67A1]/10 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute inset-x-10 top-20 h-[1px] bg-gradient-to-r from-transparent via-zinc-300/30 dark:via-white/20 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header Section */}
        <div className="grid gap-4 md:grid-cols-[2fr_1fr] items-start">
          <div className="bg-[#F8F8F8] dark:bg-zinc-800/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-[#EC67A1]/10 dark:shadow-[#EC67A1]/20 backdrop-blur">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F774B9] via-[#EC67A1] to-[#E1518E] shadow-lg shadow-[#EC67A1]/50">
                <Film className="w-6 h-6 text-white" />
                <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#EC67A1]">Motion Studio</p>
                <h1 className="text-3xl sm:text-4xl font-black text-sidebar-foreground">Kling AI — Text to Video</h1>
              </div>
            </div>
            <p className="text-sm sm:text-base text-header-muted leading-relaxed">
              Create stunning AI-generated videos from text prompts using Kling AI&apos;s powerful models. 
              Supports professional mode, camera controls, and multiple aspect ratios.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EC67A1]/20 text-[#EC67A1]">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-header-muted">Duration</p>
                  <p className="text-sm font-semibold text-sidebar-foreground">5s or 10s</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20 text-pink-200">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-header-muted">Camera</p>
                  <p className="text-sm font-semibold text-sidebar-foreground">AI Controls</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5DC3F8]/20 text-[#5DC3F8]">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-header-muted">Model</p>
                  <p className="text-sm font-semibold text-sidebar-foreground">Kling V1.6</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="group inline-flex items-center gap-2 rounded-full bg-white text-slate-900 px-4 py-2 text-sm font-semibold shadow-lg shadow-[#EC67A1]/20 transition hover:-translate-y-0.5 hover:shadow-xl"
                title="View Help & Tips"
              >
                <Info className="w-4 h-4" />
                Quick Guide
              </button>
            </div>

            <div className="rounded-3xl border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-gradient-to-br from-[#EC67A1]/10 via-[#F774B9]/10 to-[#5DC3F8]/10 p-4 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#EC67A1]">Current setup</p>
                  <p className="text-sm font-semibold text-sidebar-foreground">
                    {MODEL_OPTIONS.find(m => m.value === model)?.label} · {mode === "pro" ? "Professional" : "Standard"} · {duration}s
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-header-muted">
                  <span className="rounded-full bg-zinc-100 dark:bg-white/10 px-3 py-1">{aspectRatio}</span>
                  <span
                    className={`rounded-full px-3 py-1 ${
                      isGenerating
                        ? "bg-amber-400/20 text-amber-600 dark:text-amber-300"
                        : "bg-emerald-400/20 text-emerald-600 dark:text-emerald-300"
                    }`}
                  >
                    {isGenerating ? "Rendering" : "Ready"}
                  </span>
                </div>
              </div>
              {pollingStatus && (
                <div className="mt-3 flex items-center gap-2 text-sm text-[#EC67A1]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{pollingStatus}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-[480px_1fr] items-start">
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            {/* Presets Bar - Sticky on mobile */}
            <div className="bg-[#F8F8F8] dark:bg-zinc-800/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-3xl p-4 shadow-2xl shadow-[#EC67A1]/10 dark:shadow-[#EC67A1]/20 backdrop-blur lg:sticky lg:top-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-[#EC67A1]" />
                  <p className="text-sm font-semibold text-sidebar-foreground">Quick Presets</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPresetModal(true)}
                  disabled={isGenerating}
                  className="text-xs text-[#EC67A1] hover:text-[#E1518E] transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <Save className="w-3 h-3" />
                  Save Current
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    disabled={isGenerating}
                    className="px-3 py-1.5 text-xs font-medium rounded-full border border-[#EC67A1]/30 bg-[#EC67A1]/10 text-[#EC67A1] hover:bg-[#EC67A1]/20 hover:border-[#EC67A1]/50 transition-all disabled:opacity-50"
                  >
                    {preset.name}
                  </button>
                ))}
                {userPresets.map((preset) => (
                  <div key={preset.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => applyPreset(preset)}
                      disabled={isGenerating}
                      className="px-3 py-1.5 text-xs font-medium rounded-full border border-[#EC67A1]/30 bg-[#EC67A1]/10 text-[#EC67A1] hover:bg-[#EC67A1]/20 hover:border-[#EC67A1]/50 transition-all disabled:opacity-50"
                    >
                      {preset.name}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePreset(preset.id);
                      }}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#F8F8F8] dark:bg-zinc-800/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-[#EC67A1]/10 dark:shadow-[#EC67A1]/20 backdrop-blur space-y-6">
              {/* Prompt Input with Templates */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-base font-bold text-sidebar-foreground">Prompt <span className="text-red-400">*</span></label>
                    <Tooltip content={TOOLTIPS.negativePrompt}>
                      <HelpCircle className="w-4 h-4" />
                    </Tooltip>
                  </div>
                  <select
                    onChange={(e) => {
                      const template = PROMPT_TEMPLATES.find(t => t.name === e.target.value);
                      if (template) applyPromptTemplate(template);
                      e.target.value = '';
                    }}
                    disabled={isGenerating}
                    className="text-xs px-2 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sidebar-foreground hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 cursor-pointer"
                  >
                    <option value="">💡 Use template...</option>
                    {PROMPT_TEMPLATES.map((template) => (
                      <option key={template.name} value={template.name}>
                        {template.category}: {template.name}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your video in detail... Be specific about the scene, motion, lighting, and camera movement for best results."
                  className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 px-4 py-4 text-base text-sidebar-foreground placeholder-zinc-400 dark:placeholder-zinc-500 transition focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/50 focus:border-transparent disabled:opacity-50 resize-none"
                  rows={6}
                  disabled={isGenerating}
                />
                <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
                  <span>Be descriptive for best results</span>
                  <span className={prompt.length > 200 ? 'text-[#EC67A1]' : ''}>{prompt.length} chars</span>
                </div>

                {/* Quick Settings - Integrated in prompt section */}
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Model Dropdown */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-medium text-header-muted">Model</label>
                        <Tooltip content={TOOLTIPS.model}>
                          <HelpCircle className="w-3 h-3" />
                        </Tooltip>
                      </div>
                      <select
                        value={model}
                        onChange={(e) => {
                          const newModel = e.target.value;
                          setModel(newModel);
                          const option = MODEL_OPTIONS.find(m => m.value === newModel);
                          if (option?.supportsSound) {
                            setSound("on");
                            setMode("pro");
                          } else {
                            setSound("off");
                          }
                          if (!option?.supportsCameraControl) {
                            setUseCameraControl(false);
                          }
                        }}
                        disabled={isGenerating}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/50 focus:border-transparent disabled:opacity-50 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700"
                      >
                        {MODEL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label} {option.supportsSound ? '🔊' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quality Mode Dropdown */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-medium text-header-muted">Quality</label>
                        <Tooltip content={TOOLTIPS.mode}>
                          <HelpCircle className="w-3 h-3" />
                        </Tooltip>
                      </div>
                      <select
                        value={mode}
                        onChange={(e) => {
                          setMode(e.target.value);
                          if (e.target.value === "std" && sound === "on") {
                            setSound("off");
                          }
                        }}
                        disabled={isGenerating || (sound === "on" && currentModelSupportsSound)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/50 focus:border-transparent disabled:opacity-50 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700"
                      >
                        {MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Duration Dropdown */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-medium text-header-muted">Duration</label>
                        <Tooltip content={TOOLTIPS.duration}>
                          <HelpCircle className="w-3 h-3" />
                        </Tooltip>
                      </div>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        disabled={isGenerating}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/50 focus:border-transparent disabled:opacity-50 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700"
                      >
                        {DURATION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Aspect Ratio Dropdown */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-medium text-header-muted">Aspect Ratio</label>
                        <Tooltip content={TOOLTIPS.aspectRatio}>
                          <HelpCircle className="w-3 h-3" />
                        </Tooltip>
                      </div>
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        disabled={isGenerating}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/50 focus:border-transparent disabled:opacity-50 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700"
                      >
                        {ASPECT_RATIO_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Folder Selection - MOVED UP */}
              <div className="space-y-3 border-t border-zinc-200 dark:border-zinc-700 pt-6">
                <div className="flex items-center gap-2">
                  <Archive className="w-5 h-5 text-[#EC67A1]" />
                  <p className="text-base font-bold text-sidebar-foreground">Save to Vault <span className="text-red-400">*</span></p>
                  {isLoadingVaultData && (
                    <Loader2 className="w-4 h-4 animate-spin text-[#EC67A1]" />
                  )}
                </div>
                
                {/* Modern Custom Dropdown */}
                <div ref={folderDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => !(!mounted || isGenerating || isLoadingVaultData || !globalProfileId) && setFolderDropdownOpen(!folderDropdownOpen)}
                    disabled={!mounted || isGenerating || isLoadingVaultData || !globalProfileId}
                    className={`
                      w-full flex items-center justify-between gap-3 px-4 py-4
                      rounded-2xl border-2 transition-all duration-200
                      ${folderDropdownOpen 
                        ? 'border-[#EC67A1] bg-[#EC67A1]/10 ring-2 ring-[#EC67A1]/30' 
                        : targetFolder
                          ? 'border-[#EC67A1]/50 bg-[#EC67A1]/5'
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:border-[#EC67A1]/50 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`
                        flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
                        ${targetFolder 
                          ? 'bg-gradient-to-br from-[#EC67A1]/30 to-[#F774B9]/30 border border-[#EC67A1]/30' 
                          : 'bg-zinc-100 dark:bg-slate-700/50 border border-zinc-200 dark:border-white/5'
                        }
                      `}>
                        <FolderOpen className={`w-5 h-5 ${targetFolder ? 'text-[#EC67A1]' : 'text-zinc-400 dark:text-slate-400'}`} />
                      </div>
                      <div className="text-left min-w-0">
                        <p className={`text-sm font-semibold truncate ${targetFolder ? 'text-sidebar-foreground' : 'text-zinc-400 dark:text-slate-400'}`}>
                          {targetFolder 
                            ? vaultFolders.find(f => f.id === targetFolder)?.name || 'Select folder...'
                            : 'Select a folder...'
                          }
                        </p>
                        {targetFolder && (
                          <p className="text-xs text-[#EC67A1]/70 truncate">
                            {isAllProfiles 
                              ? vaultFolders.find(f => f.id === targetFolder)?.profileName || ''
                              : selectedProfile?.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile?.name || ''
                            }
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-zinc-400 dark:text-slate-400 transition-transform duration-200 flex-shrink-0 ${folderDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {folderDropdownOpen && mounted && (
                    <div className="absolute z-50 w-full bottom-full mb-2 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/20 dark:shadow-black/40 overflow-hidden max-h-[300px] overflow-y-auto">
                      {/* Clear Selection Option */}
                      <button
                        type="button"
                        onClick={() => {
                          setTargetFolder('');
                          setFolderDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-slate-700/50 flex items-center justify-center">
                          <X className="w-4 h-4 text-zinc-400 dark:text-slate-400" />
                        </div>
                        <span className="text-sm text-zinc-400 dark:text-slate-400">No folder selected</span>
                        {!targetFolder && <Check className="w-4 h-4 text-[#EC67A1] ml-auto" />}
                      </button>

                      {vaultFolders.filter(f => !f.isDefault).length > 0 && (
                        <div className="my-2 mx-3 h-px bg-zinc-100 dark:bg-white/5" />
                      )}

                      {/* Folder Options - Grouped by profile when viewing all profiles */}
                      {isAllProfiles ? (
                        // Group folders by profile
                        Object.entries(
                          vaultFolders.filter(f => !f.isDefault).reduce((acc, folder) => {
                            const profileKey = folder.profileName || 'Unknown Profile';
                            if (!acc[profileKey]) acc[profileKey] = [];
                            acc[profileKey].push(folder);
                            return acc;
                          }, {} as Record<string, VaultFolder[]>)
                        ).map(([profileName, folders]) => (
                          <div key={profileName}>
                            <div className="px-4 py-2 text-xs font-semibold text-[#EC67A1] uppercase tracking-wider bg-[#EC67A1]/10 sticky top-0">
                              {profileName}
                            </div>
                            {sortFoldersHierarchically(folders).map((folder) => {
                              const depth = getFolderDepth(folder.id);
                              const hasChildren = vaultFolders.some(f => f.parentId === folder.id);
                              return (
                                <button
                                  key={folder.id}
                                  type="button"
                                  onClick={() => {
                                    setTargetFolder(folder.id);
                                    setFolderDropdownOpen(false);
                                  }}
                                  className={`
                                    w-full flex items-center gap-3 py-2.5 text-left transition-all duration-150
                                    ${targetFolder === folder.id 
                                      ? 'bg-[#EC67A1]/10' 
                                      : 'hover:bg-zinc-50 dark:hover:bg-white/5'
                                    }
                                  `}
                                  style={{ paddingLeft: `${16 + depth * 16}px`, paddingRight: '16px' }}
                                >
                                  <div className={`
                                    w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0
                                    ${targetFolder === folder.id 
                                      ? 'bg-gradient-to-br from-[#EC67A1]/40 to-[#F774B9]/40 border border-[#EC67A1]/40' 
                                      : 'bg-zinc-100 dark:bg-slate-700/50 border border-zinc-200 dark:border-white/5'
                                    }
                                  `}>
                                    {hasChildren ? (
                                      <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? 'text-[#EC67A1]' : 'text-zinc-400 dark:text-slate-400'}`} />
                                    ) : (
                                      <Folder className={`w-4 h-4 ${targetFolder === folder.id ? 'text-[#EC67A1]' : 'text-zinc-400 dark:text-slate-400'}`} />
                                    )}
                                  </div>
                                  <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-sidebar-foreground font-medium' : 'text-sidebar-foreground'}`}>
                                    {folder.name}
                                  </span>
                                  {depth > 0 && (
                                    <span className="text-xs text-slate-500 flex-shrink-0">L{depth + 1}</span>
                                  )}
                                  {targetFolder === folder.id && (
                                    <Check className="w-4 h-4 text-[#EC67A1] flex-shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ))
                      ) : (
                        // Single profile view - hierarchical list
                        sortFoldersHierarchically(vaultFolders.filter(f => !f.isDefault)).map((folder) => {
                          const depth = getFolderDepth(folder.id);
                          const hasChildren = vaultFolders.some(f => f.parentId === folder.id);
                          return (
                            <button
                              key={folder.id}
                              type="button"
                              onClick={() => {
                                setTargetFolder(folder.id);
                                setFolderDropdownOpen(false);
                              }}
                              className={`
                                w-full flex items-center gap-3 py-2.5 text-left transition-all duration-150
                                ${targetFolder === folder.id 
                                  ? 'bg-[#EC67A1]/10' 
                                  : 'hover:bg-zinc-50 dark:hover:bg-white/5'
                                }
                              `}
                              style={{ paddingLeft: `${16 + depth * 16}px`, paddingRight: '16px' }}
                            >
                              <div className={`
                                w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0
                                ${targetFolder === folder.id 
                                  ? 'bg-gradient-to-br from-[#EC67A1]/40 to-[#F774B9]/40 border border-[#EC67A1]/40' 
                                  : 'bg-zinc-100 dark:bg-slate-700/50 border border-zinc-200 dark:border-white/5'
                                }
                              `}>
                                {hasChildren ? (
                                  <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? 'text-[#EC67A1]' : 'text-zinc-400 dark:text-slate-400'}`} />
                                ) : (
                                  <Folder className={`w-4 h-4 ${targetFolder === folder.id ? 'text-[#EC67A1]' : 'text-zinc-400 dark:text-slate-400'}`} />
                                )}
                              </div>
                              <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-sidebar-foreground font-medium' : 'text-sidebar-foreground'}`}>
                                {folder.name}
                              </span>
                              {depth > 0 && (
                                <span className="text-xs text-slate-500 flex-shrink-0">L{depth + 1}</span>
                              )}
                              {targetFolder === folder.id && (
                                <Check className="w-4 h-4 text-[#EC67A1] flex-shrink-0" />
                              )}
                            </button>
                          );
                        })
                      )}

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

                {/* Status Indicator */}
                {targetFolder && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EC67A1]/10 border border-[#EC67A1]/20">
                    <div className="w-2 h-2 rounded-full bg-[#EC67A1] animate-pulse" />
                    <p className="text-xs text-[#EC67A1] flex-1 truncate">
                      Videos will be saved to this folder
                    </p>
                  </div>
                )}
              </div>

              {/* Negative Prompt */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-sidebar-foreground">Negative Prompt (Optional)</label>
                  <Tooltip content={TOOLTIPS.negativePrompt}>
                    <HelpCircle className="w-3.5 h-3.5" />
                  </Tooltip>
                </div>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="What to avoid: blurry, distorted, low quality, watermark, text..."
                  className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 px-4 py-3 text-sm text-sidebar-foreground placeholder-zinc-400 dark:placeholder-zinc-500 transition focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/50 focus:border-transparent disabled:opacity-50"
                  rows={2}
                  disabled={isGenerating}
                />
              </div>

              {/* Collapsible Advanced Settings */}
              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6">
                <button
                  type="button"
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors border border-zinc-200 dark:border-zinc-700"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#EC67A1]" />
                    <span className="text-sm font-semibold text-sidebar-foreground">Advanced Options</span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">(CFG, Camera, Sound)</span>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-zinc-400 dark:text-zinc-500 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`} />
                </button>

                {showAdvancedSettings && (
                  <div className="mt-4 space-y-6 animate-in slide-in-from-top">
              {/* Sound Toggle - Only for V2.6+ in Pro mode */}
              {currentModelSupportsSound && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-sidebar-foreground">Audio Generation</label>
                    <Tooltip content={TOOLTIPS.sound}>
                      <HelpCircle className="w-3.5 h-3.5" />
                    </Tooltip>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSound("off")}
                      className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                        sound === "off"
                          ? "border-[#EC67A1]/70 bg-[#EC67A1]/10 text-sidebar-foreground shadow-[#EC67A1]/20"
                          : "border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-sidebar-foreground"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <p className="text-sm font-semibold">🔇 No Audio</p>
                      <p className="text-xs text-header-muted">Video only</p>
                    </button>
                    <button
                      onClick={() => {
                        setSound("on");
                        // Sound only works in Pro mode for V2.6
                        if (mode === "std") {
                          setMode("pro");
                        }
                      }}
                      className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                        sound === "on"
                          ? "border-emerald-400/70 bg-emerald-500/10 text-sidebar-foreground shadow-emerald-900/30"
                          : "border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-sidebar-foreground"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <p className="text-sm font-semibold">🔊 With Audio</p>
                      <p className="text-xs text-header-muted">Pro mode only</p>
                    </button>
                  </div>
                </div>
              )}

              {/* CFG Scale - Only for V1 models */}
              {currentModelSupportsCfgScale && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-semibold text-sidebar-foreground">Creativity (CFG Scale)</label>
                      <Tooltip content={TOOLTIPS.cfgScale}>
                        <HelpCircle className="w-3.5 h-3.5" />
                      </Tooltip>
                    </div>
                    <span className="text-xs text-header-muted">{cfgScale.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={cfgScale}
                    onChange={(e) => setCfgScale(Number(e.target.value))}
                    className="w-full accent-[#EC67A1]"
                    disabled={isGenerating}
                  />
                  <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
                    <span>More Creative</span>
                    <span>More Accurate</span>
                  </div>
                </div>
              )}

              {/* Camera Control - Only for V1.6+ models */}
              {currentModelSupportsCameraControl && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setUseCameraControl(!useCameraControl)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                      useCameraControl
                        ? "border-[#EC67A1]/70 bg-[#EC67A1]/10 text-sidebar-foreground shadow-[#EC67A1]/20"
                        : "border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-sidebar-foreground"
                    } disabled:opacity-50`}
                    disabled={isGenerating}
                  >
                    <div className="flex items-center gap-3">
                      <Camera className="w-5 h-5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">Camera Control</p>
                          <Tooltip content={TOOLTIPS.cameraControl}>
                            <HelpCircle className="w-3.5 h-3.5" />
                          </Tooltip>
                        </div>
                        <p className="text-xs text-header-muted">
                          {useCameraControl ? "AI camera movements enabled" : "Click to enable camera movements"}
                        </p>
                      </div>
                    </div>
                  </button>

                {useCameraControl && (
                  <div className="space-y-4 pl-2">
                    {/* Camera Control Type Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-sidebar-foreground">Movement Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {CAMERA_CONTROL_TYPE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setCameraControlType(option.value)}
                            className={`rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 ${
                              cameraControlType === option.value
                                ? "border-[#EC67A1]/70 bg-[#EC67A1]/10 text-sidebar-foreground"
                                : "border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-sidebar-foreground"
                            } disabled:opacity-50`}
                            disabled={isGenerating}
                          >
                            <p className="text-xs font-semibold">{option.label}</p>
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{option.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 6-Axis Config (only for simple type) */}
                    {cameraControlType === "simple" && (
                      <div className="space-y-3 border-t border-zinc-200 dark:border-zinc-700 pt-3">
                        <label className="text-xs font-semibold text-sidebar-foreground">6-Axis Configuration</label>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Select one axis and set its value. Only one axis can be non-zero.</p>
                        
                        {/* Axis Selection */}
                        <div className="grid grid-cols-3 gap-1">
                          {CAMERA_AXIS_OPTIONS.map((axis) => (
                            <button
                              key={axis.key}
                              onClick={() => {
                                setSelectedCameraAxis(axis.key);
                                // Reset all other axes to 0
                                setCameraConfig({
                                  horizontal: 0,
                                  vertical: 0,
                                  pan: 0,
                                  tilt: 0,
                                  roll: 0,
                                  zoom: 0,
                                  [axis.key]: cameraConfig[axis.key] || 0,
                                });
                              }}
                              className={`rounded-lg border px-2 py-1.5 text-center transition ${
                                selectedCameraAxis === axis.key
                                  ? "border-[#EC67A1]/70 bg-[#EC67A1]/10 text-sidebar-foreground"
                                  : "border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-header-muted"
                              } disabled:opacity-50`}
                              disabled={isGenerating}
                            >
                              <p className="text-[10px] font-semibold">{axis.label}</p>
                            </button>
                          ))}
                        </div>

                        {/* Selected Axis Slider */}
                        {selectedCameraAxis && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-header-muted">
                                {CAMERA_AXIS_OPTIONS.find(a => a.key === selectedCameraAxis)?.description}
                              </span>
                              <span className="text-xs font-mono text-[#EC67A1]">
                                {cameraConfig[selectedCameraAxis]?.toFixed(0) || 0}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={-10}
                              max={10}
                              step={1}
                              value={cameraConfig[selectedCameraAxis] || 0}
                              onChange={(e) => {
                                const newValue = Number(e.target.value);
                                setCameraConfig({
                                  horizontal: 0,
                                  vertical: 0,
                                  pan: 0,
                                  tilt: 0,
                                  roll: 0,
                                  zoom: 0,
                                  [selectedCameraAxis]: newValue,
                                });
                              }}
                              className="w-full accent-[#EC67A1]"
                              disabled={isGenerating}
                            />
                            <div className="flex justify-between text-[10px] text-slate-500">
                              <span>-10</span>
                              <span>0</span>
                              <span>+10</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}
                  </div>
                )}
              </div>

              {/* Storage Full/Warning Banner */}
              <StorageFullBanner showWarning={true} />

              {/* Action Buttons - Sticky on mobile */}
              <div className="flex flex-col sm:flex-row gap-3 sticky bottom-4 sm:static z-10">
                <button
                  onClick={handleGenerate}
                  disabled={hasActiveGeneration || !prompt.trim() || !targetFolder || !canGenerate}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#EC67A1] to-[#F774B9] px-6 py-4 sm:py-3 text-base sm:text-sm font-bold sm:font-semibold text-white shadow-2xl shadow-[#EC67A1]/30 transition hover:-translate-y-0.5 hover:from-[#E1518E] hover:to-[#EC67A1] hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {isGenerating ? "Generating..." : "Generate Video"}
                </button>
                <button
                  onClick={handleReset}
                  type="button"
                  disabled={hasActiveGeneration}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-700 px-5 py-4 sm:py-3 text-base sm:text-sm font-semibold text-sidebar-foreground transition hover:-translate-y-0.5 hover:bg-zinc-300 dark:hover:bg-zinc-600 hover:shadow-lg disabled:opacity-60"
                >
                  <RotateCcw className="w-5 h-5 sm:w-4 sm:h-4" /> Reset
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="space-y-6">
            {/* Generated Videos */}
            <div className="bg-[#F8F8F8] dark:bg-zinc-800/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-3xl p-6 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#EC67A1]">Latest output</p>
                  <h2 className="text-lg font-semibold text-sidebar-foreground">Generated videos</h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-header-muted">
                  <Play className="w-4 h-4" />
                  {generatedVideos.length} clip{generatedVideos.length === 1 ? "" : "s"}
                </div>
              </div>

              {generatedVideos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-white/5 p-6 text-center text-header-muted">
                  <Video className="w-6 h-6 mx-auto mb-2 text-zinc-400 dark:text-slate-400" />
                  <p className="text-sm">Your generated videos will appear here.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {generatedVideos.map((video) => (
                    <div
                      key={video.id}
                      role="button"
                      aria-label="Open video"
                      tabIndex={0}
                      onClick={() => openVideoModal(video)}
                      className="group relative overflow-hidden rounded-2xl border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-[#F8F8F8] dark:bg-white/5 cursor-pointer"
                    >
                      <video
                        data-role="preview"
                        preload="metadata"
                        src={video.videoUrl}
                        className="w-full h-52 object-cover pointer-events-none"
                        controlsList="nodownload noplaybackrate noremoteplayback"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition" />
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
                        <span className="rounded-full bg-white/10 px-3 py-1">
                          {video.duration}s · {video.aspectRatio}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(video.videoUrl, `kling-${video.id}.mp4`);
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-[11px] font-semibold backdrop-blur"
                        >
                          <Download className="w-3 h-3" />
                          Save
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Generation History */}
            <div className="bg-[#F8F8F8] dark:bg-zinc-800/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-3xl p-6 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#EC67A1]">Library</p>
                  <h2 className="text-lg font-semibold text-sidebar-foreground">Recent generations</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowHistoryModal(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-white/5 px-3 py-1 text-xs text-sidebar-foreground transition hover:-translate-y-0.5 hover:shadow"
                  >
                    <Maximize2 className="w-3 h-3" />
                    View All
                  </button>
                  <button
                    type="button"
                    onClick={loadGenerationHistory}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-white/5 px-3 py-1 text-xs text-sidebar-foreground transition hover:-translate-y-0.5 hover:shadow"
                    disabled={isLoadingHistory}
                  >
                    {isLoadingHistory ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Refresh
                  </button>
                </div>
              </div>

              {generationHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-white/5 p-6 text-center text-header-muted">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-zinc-400 dark:text-slate-400" />
                  <p className="text-sm">No history yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[320px] overflow-y-auto pr-1">
                  {generationHistory.map((video) => (
                    <div
                      key={video.id}
                      role="button"
                      aria-label="Open video"
                      tabIndex={0}
                      onClick={() => video.videoUrl && openVideoModal(video)}
                      className="group overflow-hidden rounded-xl border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-[#F8F8F8] dark:bg-white/5 cursor-pointer max-w-[180px]"
                    >
                      {video.videoUrl ? (
                        <video
                          data-role="preview"
                          preload="metadata"
                          src={video.videoUrl}
                          className="w-full h-24 object-cover pointer-events-none"
                          controlsList="nodownload noplaybackrate noremoteplayback"
                        />
                      ) : (
                        <div className="w-full h-24 flex items-center justify-center bg-zinc-100 dark:bg-slate-800/50">
                          <div className="text-center text-zinc-400 dark:text-slate-400">
                            <Video className="w-5 h-5 mx-auto mb-1 opacity-50" />
                            <span className="text-[10px]">Unavailable</span>
                          </div>
                        </div>
                      )}
                      <div className="px-2 py-2 text-[10px] text-sidebar-foreground">
                        <p className="font-medium text-sidebar-foreground truncate text-xs">{video.prompt}</p>
                        <p className="text-zinc-400 dark:text-zinc-500 truncate">
                          {video.duration}s · {video.model}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Video Modal */}
      {showVideoModal && selectedVideo &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowVideoModal(false);
            }}
          >
            <div
              className="relative w-full max-w-6xl max-h-[85vh] rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full bg-zinc-100 dark:bg-zinc-800 p-2 text-sidebar-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700"
                onClick={() => setShowVideoModal(false)}
              >
                <span className="sr-only">Close</span>
                <X className="w-4 h-4" />
              </button>
              <video
                controls
                autoPlay
                playsInline
                src={selectedVideo.videoUrl}
                className="w-full h-auto max-h-[70vh] object-contain bg-black rounded-3xl"
              />
              <div className="p-4 text-sm text-sidebar-foreground">
                <p className="font-semibold text-sidebar-foreground mb-1">{selectedVideo.prompt}</p>
                <p className="text-zinc-400 dark:text-zinc-500 mb-3">
                  {selectedVideo.duration}s · {selectedVideo.aspectRatio} · {selectedVideo.model}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReuseSettings(selectedVideo)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#EC67A1]/20 hover:bg-[#EC67A1]/30 border border-[#EC67A1]/30 px-4 py-2 text-sm font-medium text-[#EC67A1] transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reuse Settings
                  </button>
                  <button
                    onClick={() =>
                      handleDownload(
                        selectedVideo.videoUrl,
                        `kling-t2v-${selectedVideo.id}.mp4`
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-sidebar-foreground transition"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* View All History Modal */}
      {showHistoryModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowHistoryModal(false)}
          >
            <div
              className="relative w-full max-w-7xl max-h-[90vh] overflow-auto rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur p-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#EC67A1]">Library</p>
                  <h2 className="text-2xl font-bold text-sidebar-foreground">All Recent Generations</h2>
                  <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
                    {generationHistory.length} video{generationHistory.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="rounded-full bg-zinc-100 dark:bg-zinc-800 p-2 text-sidebar-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                {generationHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-slate-400">
                    <Clock className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-lg">No generation history yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {generationHistory.map((video) => (
                      <div
                        key={video.id}
                        role="button"
                        aria-label="Open video"
                        tabIndex={0}
                        onClick={() => {
                          if (video.videoUrl) {
                            openVideoModal(video);
                            setShowHistoryModal(false);
                          }
                        }}
                        className="group relative overflow-hidden rounded-2xl border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-[#F8F8F8] dark:bg-white/5 cursor-pointer transition hover:border-[#EC67A1]/50 hover:shadow-lg hover:shadow-[#EC67A1]/10"
                      >
                        {video.videoUrl ? (
                          <video
                            data-role="preview"
                            preload="metadata"
                            src={video.videoUrl}
                            className="w-full aspect-video object-cover pointer-events-none"
                            controlsList="nodownload noplaybackrate noremoteplayback"
                          />
                        ) : (
                          <div className="w-full aspect-video flex items-center justify-center bg-zinc-100 dark:bg-slate-800/50">
                            <div className="text-center text-zinc-400 dark:text-slate-400">
                              <Video className="w-8 h-8 mx-auto mb-2" />
                              <p className="text-xs">Processing...</p>
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
                        <div className="absolute bottom-0 left-0 right-0 p-3 text-white transform translate-y-full group-hover:translate-y-0 transition">
                          <p className="text-xs font-medium line-clamp-2 mb-1">{video.prompt}</p>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-300 dark:text-slate-300">
                            <span>{video.duration}s</span>
                            <span>•</span>
                            <span>{video.aspectRatio}</span>
                          </div>
                        </div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                          <div className="rounded-full bg-[#EC67A1]/20 backdrop-blur-sm px-2 py-1 text-[10px] text-[#EC67A1] border border-[#EC67A1]/30">
                            {video.status === "completed" ? "✓ Ready" : "Processing"}
                          </div>
                        </div>
                        {/* Profile badge when viewing all profiles */}
                        {isAllProfiles && video.profileName && (
                          <div className="absolute top-2 left-2">
                            <div className="rounded-full bg-slate-900/80 backdrop-blur-sm px-2 py-1 text-[10px] text-[#EC67A1] border border-[#EC67A1]/30">
                              {video.profileName}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Save Preset Modal */}
      {showPresetModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur p-4"
            onClick={() => setShowPresetModal(false)}
          >
            <div
              className="relative w-full max-w-md rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full bg-zinc-100 dark:bg-zinc-800 p-2 text-sidebar-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                onClick={() => setShowPresetModal(false)}
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Save className="w-5 h-5 text-[#EC67A1]" />
                  <h3 className="text-xl font-semibold text-sidebar-foreground">Save Preset</h3>
                </div>

                <p className="text-sm text-header-muted">
                  Save your current settings as a preset for quick access later.
                </p>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-sidebar-foreground">Preset Name</label>
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="e.g., My Cinematic Style"
                    className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 px-4 py-3 text-sm text-sidebar-foreground placeholder-zinc-400 dark:placeholder-zinc-500 transition focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/50 focus:border-transparent"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveAsPreset();
                      }
                    }}
                    autoFocus
                  />
                </div>

                <div className="bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-3">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">This preset will save:</p>
                  <ul className="text-xs text-header-muted space-y-1 list-disc list-inside">
                    <li>Model: {MODEL_OPTIONS.find(m => m.value === model)?.label}</li>
                    <li>Mode: {mode === "pro" ? "Professional" : "Standard"}</li>
                    <li>Duration: {duration}s</li>
                    <li>Aspect Ratio: {aspectRatio}</li>
                    {currentModelSupportsCfgScale && <li>CFG Scale: {cfgScale}</li>}
                    {currentModelSupportsSound && <li>Sound: {sound}</li>}
                    {useCameraControl && <li>Camera Control: {cameraControlType}</li>}
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPresetModal(false)}
                    className="flex-1 px-4 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-white/5 text-sidebar-foreground hover:bg-zinc-100 dark:hover:bg-white/10 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveAsPreset}
                    disabled={!presetName.trim()}
                    className="flex-1 px-4 py-2 rounded-2xl bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white font-semibold hover:shadow-lg hover:-translate-y-0.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Preset
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Help Modal */}
      {showHelpModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur">
            <div className="relative max-w-3xl w-full rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-2xl">
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full bg-zinc-100 dark:bg-zinc-800 p-2 text-sidebar-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700"
                onClick={() => setShowHelpModal(false)}
              >
                <span className="sr-only">Close</span>
                ×
              </button>

              <div className="space-y-6 text-sidebar-foreground">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-[#EC67A1]" />
                  <h3 className="text-xl font-semibold">Kling AI Text-to-Video Guide</h3>
                </div>
                
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-4">
                    <p className="font-semibold text-emerald-600 dark:text-emerald-300 mb-2">✓ Do</p>
                    <ul className="text-sm space-y-1 text-emerald-600 dark:text-emerald-300 list-disc list-inside">
                      <li>Be specific about subject, action, and setting</li>
                      <li>Describe camera movements explicitly</li>
                      <li>Include lighting and atmosphere details</li>
                      <li>Use Professional mode for complex scenes</li>
                    </ul>
                  </div>
                  <div className="bg-red-500/10 border border-red-400/30 rounded-2xl p-4">
                    <p className="font-semibold text-red-600 dark:text-red-300 mb-2">✗ Avoid</p>
                    <ul className="text-sm space-y-1 text-red-600 dark:text-red-300 list-disc list-inside">
                      <li>Vague or single-word prompts</li>
                      <li>Contradictory instructions</li>
                      <li>Too many simultaneous actions</li>
                      <li>Overly complex scene changes</li>
                    </ul>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4 bg-zinc-50 dark:bg-zinc-800/30">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-[#EC67A1]" />
                      Parameters
                    </h4>
                    <ul className="text-sm space-y-1 text-sidebar-foreground list-disc list-inside">
                      <li><strong>Model:</strong> V1.6 is latest, V1.5 is stable</li>
                      <li><strong>Mode:</strong> Pro for quality, Std for speed</li>
                      <li><strong>Duration:</strong> 5s quick, 10s extended</li>
                      <li><strong>Aspect:</strong> 16:9 landscape, 9:16 portrait</li>
                      <li><strong>CFG:</strong> Lower = more creative</li>
                    </ul>
                  </div>
                  <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4 bg-zinc-50 dark:bg-zinc-800/30">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-[#EC67A1]" />
                      Camera Controls
                    </h4>
                    <ul className="text-sm space-y-1 text-sidebar-foreground list-disc list-inside">
                      <li><strong>Zoom In/Out:</strong> Gradual focal changes</li>
                      <li><strong>Down & Back:</strong> Pull away motion</li>
                      <li><strong>Forward & Up:</strong> Push in motion</li>
                      <li><strong>Turn Forward:</strong> Pan while moving</li>
                    </ul>
                  </div>
                </div>

                <div className="border border-amber-400/30 bg-amber-500/10 rounded-2xl p-4">
                  <h4 className="font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4" />
                    Tips
                  </h4>
                  <ul className="text-sm space-y-1 text-amber-600 dark:text-amber-300 list-disc list-inside">
                    <li>Generation typically takes 2-5 minutes depending on duration and mode</li>
                    <li>Professional mode produces higher quality but takes longer</li>
                    <li>Use negative prompts to avoid common issues like blur or distortion</li>
                    <li>Videos are automatically saved to your S3 storage or Vault</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Credit Calculator */}
      <CreditCalculator
        path="kling-text-to-video"
        modifiers={[
          ...(mode === 'pro' ? [{
            label: 'Professional Mode',
            multiplier: 2,
            description: 'Pro mode costs 2x more credits for higher quality'
          }] : []),
          ...(duration === '10' ? [{
            label: 'Extended Duration (10s)',
            multiplier: 2,
            description: '10s videos cost 2x more than 5s videos'
          }] : []),
          ...(model === 'kling-v1-6' ? [{
            label: 'V1.6 Model',
            multiplier: 1.2,
            description: 'Latest model costs 20% more credits'
          }] : []),
        ]}
        position="bottom-right"
      />
    </div>
  );
}
