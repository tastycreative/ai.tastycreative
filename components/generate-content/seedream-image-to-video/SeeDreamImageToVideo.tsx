"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import { useCredits } from '@/lib/hooks/useCredits.query';
import { CreditCalculator } from "@/components/credits/CreditCalculator";
import { ReferenceSelector } from "@/components/reference-bank/ReferenceSelector";
import { ReferenceItem } from "@/hooks/useReferenceBank";
import VaultFolderDropdown, { VaultFolder } from "@/components/generate-content/shared/VaultFolderDropdown";
import { StorageFullBanner, useCanGenerate } from "@/components/generate-content/shared/StorageFullBanner";
import {
  Video,
  Download,
  Loader2,
  AlertCircle,
  RotateCcw,
  Zap,
  Upload,
  Image as ImageIcon,
  X,
  Play,
  Clock,
  Folder,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Info,
  Settings,
  Archive,
  Library,
  Film,
  Sparkles,
} from "lucide-react";

interface GeneratedVideo {
  id: string;
  videoUrl: string;
  prompt: string;
  modelVersion: string;
  duration: number;
  cameraFixed: boolean;
  createdAt: string;
  status: "completed" | "processing" | "failed";
  referenceImageUrl?: string | null;
  profileName?: string;
  metadata?: {
    resolution?: string;
    ratio?: string;
    generateAudio?: boolean;
    cameraFixed?: boolean;
    referenceImageUrl?: string | null;
    profileId?: string | null;
  };
}

interface PromptTemplate {
  name: string;
  description: string;
  prompt: string;
}

interface UserPreset {
  id: string;
  name: string;
  resolution: "720p" | "1080p";
  aspectRatio: "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9" | "adaptive";
  duration: number;
  cameraFixed: boolean;
  generateAudio: boolean;
  createdAt: number;
}

const RESOLUTION_DIMENSIONS = {
  "720p": {
    "16:9": "1280×720",
    "4:3": "1112×834",
    "1:1": "960×960",
    "3:4": "834×1112",
    "9:16": "720×1280",
    "21:9": "1470×630",
    adaptive: "Auto",
  },
  "1080p": {
    "16:9": "1920×1080",
    "4:3": "1440×1080",
    "1:1": "1080×1080",
    "3:4": "1080×1440",
    "9:16": "1080×1920",
    "21:9": "2520×1080",
    adaptive: "Auto",
  },
} as const;

const ASPECT_RATIOS = [
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
  "21:9",
  "adaptive",
] as const;

const sliderToDuration = (value: number) => (value === 0 ? -1 : value + 3);

export default function SeeDreamImageToVideo() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const params = useParams();
  const tenant = params.tenant as string;
  const { updateGlobalProgress, clearGlobalProgress, addJob, updateJob, hasActiveGenerationForType, getLastCompletedJobForType, getCompletedJobsForType, clearCompletedJobsForType, activeJobs } = useGenerationProgress();
  const { refreshCredits } = useCredits();
  const { canGenerate, storageError } = useCanGenerate();

  // Check if this specific tab has an active generation
  const hasActiveGeneration = hasActiveGenerationForType('image-to-video');

  const [prompt, setPrompt] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string>("");
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  
  // Reference Bank state
  const [showReferenceBankSelector, setShowReferenceBankSelector] = useState(false);
  const [isSavingToReferenceBank, setIsSavingToReferenceBank] = useState(false);
  const [fromReferenceBank, setFromReferenceBank] = useState(false);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [aspectRatio, setAspectRatio] =
    useState<(typeof ASPECT_RATIOS)[number]>("16:9");
  const [duration, setDuration] = useState(4);
  const [durationSliderValue, setDurationSliderValue] = useState(1);
  const [cameraFixed, setCameraFixed] = useState(false);
  const [generateAudio, setGenerateAudio] = useState(true);

  const [targetFolder, setTargetFolder] = useState<string>("");

  // Prompt Templates & Presets
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [showFolderValidation, setShowFolderValidation] = useState(false);

  // Collapsible sections (mobile)
  const [sectionsCollapsed, setSectionsCollapsed] = useState({
    upload: false,
    prompt: false,
    duration: false,
    options: false,
    vault: false,
  });

  const promptTemplates: PromptTemplate[] = [
    {
      name: "Motion Enhancement",
      description: "Add smooth movement to photo",
      prompt: "Smooth, cinematic camera movement. Natural motion with subtle depth. Professional cinematography."
    },
    {
      name: "Portrait to Life",
      description: "Animate portrait photos",
      prompt: "Gentle head movement and blinking. Natural facial expressions. Soft, lifelike motion with warm lighting."
    },
    {
      name: "Landscape Pan",
      description: "Sweeping landscape shots",
      prompt: "Slow, sweeping camera pan across the scene. Golden hour lighting. Cinematic depth and atmosphere."
    },
    {
      name: "Product Reveal",
      description: "Dynamic product showcase",
      prompt: "Rotating camera around the product. Studio lighting. Clean, professional presentation."
    },
    {
      name: "Action Sequence",
      description: "Add dynamic motion",
      prompt: "Fast-paced movement with motion blur. Dynamic camera angles. High-energy cinematography."
    },
    {
      name: "Atmospheric Scene",
      description: "Add environmental effects",
      prompt: "Subtle particle effects and atmospheric haze. Dramatic lighting shifts. Moody, cinematic atmosphere."
    },
  ];

  // Use global profile from header
  const { profileId: globalProfileId, selectedProfile, isAllProfiles } = useInstagramProfile();

  // Hydration fix - track if component is mounted
  const [mounted, setMounted] = useState(false);
  
  // Vault folder state - only for the selected profile
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);

  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [generationHistory, setGenerationHistory] = useState<GeneratedVideo[]>(
    []
  );
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(
    null
  );
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Check for stale active jobs and try to complete them from history
  useEffect(() => {
    if (!mounted || !apiClient) return;

    const checkStaleJob = async () => {
      // Check if there's an active processing job for this type
      const activeJob = activeJobs.find(
        job => job.generationType === 'image-to-video' && 
        (job.status === 'pending' || job.status === 'processing')
      );

      if (activeJob) {
        // Check generation history to see if it completed while we were offline
        try {
          const url = globalProfileId 
            ? `/api/generate/seedream-image-to-video?history=true&profileId=${globalProfileId}`
            : "/api/generate/seedream-image-to-video?history=true";
          const response = await apiClient.get(url);
          
          if (response.ok) {
            const data = await response.json();
            const recentVideos = data.videos || [];
            
            // Check if any videos were created around the time of the active job
            const jobTimeWindow = 60 * 1000; // 1 minute window
            const matchingVideos = recentVideos.filter((video: any) => {
              const videoCreatedAt = new Date(video.createdAt).getTime();
              return videoCreatedAt >= activeJob.startedAt && 
                     videoCreatedAt <= activeJob.startedAt + jobTimeWindow;
            });

            if (matchingVideos.length > 0) {
              console.log('✅ Found completed videos for stale I2V job, marking as complete');
              // Update the job as completed with the results
              updateJob(activeJob.jobId, {
                status: 'completed',
                progress: 100,
                message: 'Generation completed',
                results: matchingVideos,
                completedAt: Date.now(),
              });
              
              // Display the results
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
          console.error('Failed to check for completed I2V generation:', error);
        }
      }
    };

    checkStaleJob();
    // Only runs once on mount to check for previously incomplete jobs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, apiClient]);
  
  useEffect(() => {
    setMounted(true);
    
    // Check for reuse data from Vault
    const reuseData = sessionStorage.getItem('seedream-i2v-reuse');
    if (reuseData) {
      try {
        const data = JSON.parse(reuseData);
        console.log('Restoring I2V settings from Vault:', data);
        
        // Set prompt
        if (data.prompt) setPrompt(data.prompt);
        
        // Set resolution
        if (data.resolution === '720p' || data.resolution === '1080p') {
          setResolution(data.resolution);
        }
        
        // Set aspect ratio
        if (data.ratio && ASPECT_RATIOS.includes(data.ratio)) {
          setAspectRatio(data.ratio);
        }
        
        // Set duration
        if (data.duration && data.duration !== -1) {
          setDuration(data.duration);
          const sliderVal = data.duration - 3;
          if (sliderVal >= 0 && sliderVal <= 9) {
            setDurationSliderValue(sliderVal);
          }
        } else if (data.duration === -1) {
          setDurationSliderValue(0); // Auto
        }
        
        // Set toggles
        if (typeof data.cameraFixed === 'boolean') setCameraFixed(data.cameraFixed);
        if (typeof data.generateAudio === 'boolean') setGenerateAudio(data.generateAudio);
        
        // Load reference image if available
        if (data.referenceImageUrl) {
          fetch(`/api/proxy-image?url=${encodeURIComponent(data.referenceImageUrl)}`)
            .then(res => res.ok ? res.blob() : Promise.reject('Failed to load'))
            .then(blob => {
              const reader = new FileReader();
              reader.onloadend = () => {
                setUploadedImage(reader.result as string);
                setUploadedImageFile(null);
                setFromReferenceBank(true);
                setReferenceUrl(data.referenceImageUrl);
              };
              reader.readAsDataURL(blob);
            })
            .catch(() => {
              // Fallback: use URL directly
              setUploadedImage(data.referenceImageUrl);
              setUploadedImageFile(null);
              setFromReferenceBank(true);
              setReferenceUrl(data.referenceImageUrl);
            });
        }
        
        // Clear the sessionStorage after reading
        sessionStorage.removeItem('seedream-i2v-reuse');
      } catch (err) {
        console.error('Error parsing I2V reuse data:', err);
        sessionStorage.removeItem('seedream-i2v-reuse');
      }
    }
  }, []);

  // Check for completed generations when component mounts or jobs update
  useEffect(() => {
    if (!mounted || isGenerating) return; // Don't sync while actively generating
    
    // Get only the LATEST completed job to display in "Generated Videos" section
    const latestJob = getLastCompletedJobForType('image-to-video');
    
    if (latestJob && latestJob.results && Array.isArray(latestJob.results)) {
      setGeneratedVideos(prev => {
        const existingIds = new Set(prev.map((video: any) => video.id));
        const newResults = latestJob.results.filter((video: any) => !existingIds.has(video.id));
        
        if (newResults.length > 0) {
          console.log(`📋 Displaying latest I2V generation with ${newResults.length} new videos`);
          return newResults; // Replace with latest generation only
        }
        return prev;
      });
    }
  }, [mounted, getLastCompletedJobForType, activeJobs, isGenerating]);

  // Folder dropdown state
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);

  // localStorage: Load user presets per profile
  useEffect(() => {
    if (typeof window !== 'undefined' && globalProfileId) {
      const savedPresets = localStorage.getItem(`seedream-i2v-presets-${globalProfileId}`);
      if (savedPresets) {
        try {
          setUserPresets(JSON.parse(savedPresets));
        } catch (e) {
          console.error('Error loading I2V presets:', e);
        }
      }

      // Load last settings
      const savedSettings = localStorage.getItem(`seedream-i2v-settings-${globalProfileId}`);
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          if (settings.resolution) setResolution(settings.resolution);
          if (settings.aspectRatio) setAspectRatio(settings.aspectRatio);
          if (settings.duration !== undefined) {
            setDuration(settings.duration);
            if (settings.duration === -1) {
              setDurationSliderValue(0);
            } else {
              setDurationSliderValue(Math.max(0, Math.min(9, settings.duration - 3)));
            }
          }
          if (settings.cameraFixed !== undefined) setCameraFixed(settings.cameraFixed);
          if (settings.generateAudio !== undefined) setGenerateAudio(settings.generateAudio);
          if (settings.targetFolder) setTargetFolder(settings.targetFolder);
        } catch (e) {
          console.error('Error loading I2V settings:', e);
        }
      }
    }
  }, [globalProfileId]);

  // localStorage: Auto-save settings when they change
  useEffect(() => {
    if (typeof window !== 'undefined' && globalProfileId && mounted) {
      const settings = {
        resolution,
        aspectRatio,
        duration,
        cameraFixed,
        generateAudio,
        targetFolder,
      };
      localStorage.setItem(`seedream-i2v-settings-${globalProfileId}`, JSON.stringify(settings));
    }
  }, [resolution, aspectRatio, duration, cameraFixed, generateAudio, targetFolder, globalProfileId, mounted]);

  // Preset management functions
  const saveAsPreset = () => {
    if (!presetName.trim() || !globalProfileId) return;

    const newPreset: UserPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      resolution,
      aspectRatio,
      duration,
      cameraFixed,
      generateAudio,
      createdAt: Date.now(),
    };

    const updatedPresets = [...userPresets, newPreset];
    setUserPresets(updatedPresets);
    localStorage.setItem(`seedream-i2v-presets-${globalProfileId}`, JSON.stringify(updatedPresets));
    setShowPresetModal(false);
    setPresetName('');
  };

  const loadPreset = (preset: UserPreset) => {
    setResolution(preset.resolution);
    setAspectRatio(preset.aspectRatio);
    setDuration(preset.duration);
    if (preset.duration === -1) {
      setDurationSliderValue(0);
    } else {
      setDurationSliderValue(Math.max(0, Math.min(9, preset.duration - 3)));
    }
    setCameraFixed(preset.cameraFixed);
    setGenerateAudio(preset.generateAudio);
  };

  const deletePreset = (presetId: string) => {
    if (!globalProfileId) return;
    const updatedPresets = userPresets.filter(p => p.id !== presetId);
    setUserPresets(updatedPresets);
    localStorage.setItem(`seedream-i2v-presets-${globalProfileId}`, JSON.stringify(updatedPresets));
  };

  const applyTemplate = (template: PromptTemplate) => {
    setPrompt(template.prompt);
    setShowTemplates(false);
  };

  const pauseAllPreviews = () => {
    const previewVideos = document.querySelectorAll<HTMLVideoElement>(
      "video[data-role='preview']"
    );
    previewVideos.forEach((video) => {
      video.pause();
      video.currentTime = 0;
    });
  };

  const currentDimensions = useMemo(
    () => RESOLUTION_DIMENSIONS[resolution][aspectRatio],
    [resolution, aspectRatio]
  );

  // Load vault folders for the selected profile
  const loadVaultData = useCallback(async () => {
    if (!apiClient || !globalProfileId) return;
    setIsLoadingVaultData(true);
    try {
      const foldersResponse = await fetch(`/api/vault/folders?profileId=${globalProfileId}`);
      if (foldersResponse.ok) {
        const folders = await foldersResponse.json();
        setVaultFolders(Array.isArray(folders) ? folders : []);
      }
    } catch (err) {
      console.error("Failed to load vault folders:", err);
      setVaultFolders([]);
    } finally {
      setIsLoadingVaultData(false);
    }
  }, [apiClient, globalProfileId]);

  const loadGenerationHistory = useCallback(async () => {
    if (!apiClient) return;
    setIsLoadingHistory(true);
    try {
      // Add profileId to filter by selected profile
      const url = globalProfileId 
        ? `/api/generate/seedream-image-to-video?history=true&profileId=${globalProfileId}`
        : "/api/generate/seedream-image-to-video?history=true";
      const response = await apiClient.get(url);
      if (response.ok) {
        const data = await response.json();
        console.log('📋 Loaded I2V generation history:', data.videos?.length || 0, 'videos for profile:', globalProfileId);
        setGenerationHistory(data.videos || []);
      }
    } catch (err) {
      console.error("Failed to load I2V generation history:", err);
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
  }, [apiClient, loadVaultData, loadGenerationHistory, globalProfileId]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setUploadedImage(base64);
      setUploadedImageFile(file);
      // Reset reference bank tracking for new uploads
      setFromReferenceBank(false);
      setReferenceId(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setUploadedImage("");
    setUploadedImageFile(null);
    setFromReferenceBank(false);
    setReferenceId(null);
    setReferenceUrl(null);
  };

  // Save image to Reference Bank
  const saveToReferenceBank = async (imageBase64: string, fileName: string, file?: File, skipIfExists?: boolean): Promise<{ id: string; url: string } | null> => {
    if (!globalProfileId) return null;
    
    try {
      // Get file info
      const mimeType = file?.type || (imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg');
      const extension = mimeType === 'image/png' ? 'png' : 'jpg';
      const finalFileName = fileName || `reference-${Date.now()}.${extension}`;
      
      // Convert base64 to blob for upload
      const base64Data = imageBase64.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      
      // Check if a similar file already exists in Reference Bank (by size)
      if (skipIfExists) {
        try {
          const existingCheck = await fetch(`/api/reference-bank?profileId=${globalProfileId}&checkDuplicate=true&fileSize=${blob.size}&fileName=${encodeURIComponent(finalFileName)}`);
          if (existingCheck.ok) {
            const existing = await existingCheck.json();
            if (existing.duplicate) {
              console.log('⏭️ Skipping duplicate - image already exists in Reference Bank:', existing.existingId);
              return { id: existing.existingId, url: existing.existingUrl };
            }
          }
        } catch (err) {
          console.warn('Could not check for duplicates:', err);
        }
      }
      
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
        console.error('Failed to get presigned URL:', presignedResponse.status);
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
        console.error('Failed to upload to S3:', uploadResponse.status);
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
          tags: ['seedream', 'image-to-video'],
        }),
      });

      if (!createResponse.ok) {
        console.error('Failed to create reference item');
        return null;
      }

      const newReference = await createResponse.json();
      return { id: newReference.id, url: newReference.awsS3Url || url };
    } catch (err) {
      console.error('Error saving to Reference Bank:', err);
      return null;
    }
  };

  // Handle selection from Reference Bank
  const handleReferenceBankSelect = async (item: ReferenceItem) => {
    try {
      // Use a proxy to fetch the image to avoid CORS issues
      const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(item.awsS3Url)}`);
      
      if (!proxyResponse.ok) {
        // Fallback: use the URL directly
        setUploadedImage(item.awsS3Url);
        setUploadedImageFile(null);
        setFromReferenceBank(true);
        setReferenceId(item.id);
        setReferenceUrl(item.awsS3Url);
        
        // Track usage
        fetch(`/api/reference-bank/${item.id}/use`, { method: 'POST' }).catch(console.error);
        setShowReferenceBankSelector(false);
        return;
      }
      
      const blob = await proxyResponse.blob();
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setUploadedImage(base64);
        setUploadedImageFile(null);
        setFromReferenceBank(true);
        setReferenceId(item.id);
        setReferenceUrl(item.awsS3Url);
        
        // Track usage
        fetch(`/api/reference-bank/${item.id}/use`, { method: 'POST' }).catch(console.error);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Error loading reference image:', err);
      setError('Failed to load reference image. Please try again.');
    }

    setShowReferenceBankSelector(false);
  };

  const pollTaskStatus = (apiTaskId: string, localTaskId: string) => {
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
          
          const currentProgress = Math.min(90, attempts * 2);
          const message = `Generating video... ${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`;
          
          updateJob(localTaskId, {
            progress: currentProgress,
            stage: "processing",
            message,
          });
          
          updateGlobalProgress({
            isGenerating: true,
            progress: currentProgress,
            stage: "processing",
            message,
            generationType: "image-to-video",
            jobId: localTaskId,
          });

          const response = await apiClient?.get(
            `/api/generate/seedream-image-to-video?taskId=${apiTaskId}`
          );
          if (!response) throw new Error("API client not available");
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to check task status");
          }

          const data = await response.json();

          if (
            data.status === "completed" &&
            data.videos &&
            data.videos.length > 0
          ) {
            // Refresh credit balance in the UI after successful generation
            refreshCredits();
            
            // Update job as completed
            updateJob(localTaskId, {
              progress: 100,
              stage: "completed",
              message: "Video generation completed!",
              status: "completed",
              results: data.videos,
            });
            
            updateGlobalProgress({
              isGenerating: false,
              progress: 100,
              stage: "completed",
              message: "Video generation completed!",
              generationType: "image-to-video",
              jobId: localTaskId,
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

          if (data.status === "processing") {
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
          
          // Update job as failed
          updateJob(localTaskId, {
            progress: 0,
            stage: "failed",
            message: err.message || "Generation failed",
            status: "failed",
            error: err.message,
          });
          
          updateGlobalProgress({
            isGenerating: false,
            progress: 0,
            stage: "failed",
            message: err.message || "Generation failed",
            generationType: "image-to-video",
            jobId: localTaskId,
          });
          setPollingStatus("");
          setIsGenerating(false);
          reject(err);
        }
      };

      poll();
    });
  };

  const handleGenerate = async () => {
    if (!apiClient) {
      setError("API client not available");
      return;
    }

    // Check storage availability
    if (!canGenerate) {
      setError(storageError || "Storage is full. Please add more storage or free up space before generating.");
      return;
    }

    if (!targetFolder) {
      setError("Please select a vault folder to save your video");
      setShowFolderValidation(true);
      // Scroll to folder section
      document.getElementById('folder-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }
    if (!uploadedImage) {
      setError("Please upload an image");
      return;
    }

    setShowFolderValidation(false);
    setIsGenerating(true);
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("Submitting task...");
    const localTaskId = `seedream-i2v-${Date.now()}`;

    // Track the reference URL locally (for use in payload)
    let savedReferenceUrl = referenceUrl;

    // Save to Reference Bank before generating (only for new uploads, not from Reference Bank)
    if (globalProfileId && !fromReferenceBank && uploadedImage && uploadedImageFile) {
      setIsSavingToReferenceBank(true);
      try {
        // Pass skipIfExists: true to avoid creating duplicates
        const saveResult = await saveToReferenceBank(uploadedImage, uploadedImageFile.name || 'reference.jpg', uploadedImageFile, true);
        if (saveResult) {
          savedReferenceUrl = saveResult.url;
          setReferenceId(saveResult.id);
          setReferenceUrl(saveResult.url);
          setFromReferenceBank(true);
          console.log('Image saved to Reference Bank:', saveResult.id, 'URL:', saveResult.url);
        }
      } catch (err) {
        console.warn('Failed to save image to Reference Bank:', err);
        // Continue with generation even if save fails
      } finally {
        setIsSavingToReferenceBank(false);
      }
    }

    try {
      // Create a job in the global progress tracker
      addJob({
        jobId: localTaskId,
        generationType: "image-to-video",
        progress: 0,
        stage: "starting",
        message: "Starting SeeDream 4.5 Image-to-Video generation...",
        status: "processing",
        startedAt: Date.now(),
        metadata: {
          prompt: prompt.trim().slice(0, 100),
          resolution,
          aspectRatio,
          profileName: selectedProfile?.name,
        }
      });

      updateGlobalProgress({
        isGenerating: true,
        progress: 0,
        stage: "starting",
        message: "Starting SeeDream 4.5 Image-to-Video generation...",
        generationType: "image-to-video",
        jobId: localTaskId,
      });

      // Get profileId from the selected folder
      const selectedFolder = vaultFolders.find(f => f.id === targetFolder);
      const folderProfileId = selectedFolder?.profileId || globalProfileId;

      const payload: any = {
        prompt: prompt.trim(),
        image: uploadedImage,
        model: "ep-20260105171451-cljlk",
        resolution,
        ratio: aspectRatio,
        duration,
        seed: -1,
        cameraFixed,
        watermark: false,
        generateAudio,
        // Store reference image URL for reuse functionality
        referenceImageUrl: savedReferenceUrl || null,
        // Always include profile ID for history filtering (use folder's profile)
        vaultProfileId: folderProfileId || null,
        organizationSlug: tenant,
      };

      // Add vault folder params if selected
      if (targetFolder && folderProfileId) {
        payload.saveToVault = true;
        payload.vaultFolderId = targetFolder;
      }

      const response = await apiClient.post(
        "/api/generate/seedream-image-to-video",
        payload
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.details?.error?.message ||
          errorData.error ||
          "Generation failed";
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.status === "completed" && data.videos && data.videos.length > 0) {
        // Refresh credit balance in the UI after successful generation
        refreshCredits();
        
        // Update job as completed
        updateJob(localTaskId, {
          progress: 100,
          stage: "completed",
          message: "Generation completed!",
          status: "completed",
          results: data.videos,
        });
        
        updateGlobalProgress({
          isGenerating: false,
          progress: 100,
          stage: "completed",
          message: "Generation completed!",
          generationType: "image-to-video",
          jobId: localTaskId,
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
      setError(err.message || "Failed to generate video");
      
      // Update job as failed
      updateJob(localTaskId, {
        progress: 0,
        stage: "failed",
        message: err.message || "Generation failed",
        status: "failed",
        error: err.message,
      });
      
      updateGlobalProgress({
        isGenerating: false,
        progress: 0,
        stage: "failed",
        message: err.message || "Generation failed",
        generationType: "image-to-video",
        jobId: localTaskId,
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

  const handleReset = () => {
    setPrompt("");
    setUploadedImage("");
    setUploadedImageFile(null);
    setDuration(4);
    setDurationSliderValue(1);
    setResolution("720p");
    setAspectRatio("16:9");
    setCameraFixed(false);
    setGenerateAudio(true);
    setTargetFolder("");
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("");
    setFromReferenceBank(false);
    setReferenceId(null);
    setReferenceUrl(null);
  };

  // Handle reuse settings from a selected video
  const handleReuseSettings = async (video: GeneratedVideo) => {
    // Set prompt
    setPrompt(video.prompt || '');
    
    // Set parameters from metadata
    if (video.metadata) {
      const res = video.metadata.resolution as "720p" | "1080p";
      if (res === "720p" || res === "1080p") {
        setResolution(res);
      }
      
      const ratio = video.metadata.ratio as (typeof ASPECT_RATIOS)[number];
      if (ASPECT_RATIOS.includes(ratio)) {
        setAspectRatio(ratio);
      }
      
      setCameraFixed(video.metadata.cameraFixed || false);
      setGenerateAudio(video.metadata.generateAudio ?? true);
    }
    
    // Set duration
    if (video.duration && video.duration !== -1) {
      setDuration(video.duration);
      // Convert duration to slider value (duration = sliderValue + 3, or -1 for auto)
      const sliderVal = video.duration - 3;
      if (sliderVal >= 0 && sliderVal <= 9) {
        setDurationSliderValue(sliderVal);
      }
    } else {
      setDurationSliderValue(0); // Auto
    }
    
    // Load reference image if available
    const refUrl = video.referenceImageUrl || video.metadata?.referenceImageUrl;
    if (refUrl) {
      try {
        // Use proxy to fetch the image to avoid CORS issues
        const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(refUrl)}`);
        
        if (proxyResponse.ok) {
          const blob = await proxyResponse.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            setUploadedImage(base64);
            setUploadedImageFile(null);
            setFromReferenceBank(true);
            setReferenceUrl(refUrl);
          };
          reader.readAsDataURL(blob);
        } else {
          // Fallback: use URL directly
          setUploadedImage(refUrl);
          setUploadedImageFile(null);
          setFromReferenceBank(true);
          setReferenceUrl(refUrl);
        }
      } catch (err) {
        console.error('Error loading reference image for reuse:', err);
        // Fallback: use URL directly
        setUploadedImage(refUrl);
        setUploadedImageFile(null);
        setFromReferenceBank(true);
        setReferenceUrl(refUrl);
      }
    }
    
    // Close modal
    setShowVideoModal(false);
  };

  useEffect(() => {
    setDuration(sliderToDuration(durationSliderValue));
  }, [durationSliderValue]);

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
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="relative max-h-[85vh] overflow-y-auto overflow-x-hidden bg-[#F8F8F8] dark:bg-[#0a0a0f] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl shadow-lg custom-scrollbar text-sidebar-foreground">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-[#EC67A1]/20 dark:bg-[#EC67A1]/10 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-[#5DC3F8]/10 dark:bg-[#5DC3F8]/5 blur-3xl" />
        <div className="absolute inset-x-10 top-20 h-[1px] bg-gradient-to-r from-transparent via-[#EC67A1]/20 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header Section */}
        <div className="grid gap-4 md:grid-cols-[2fr_1fr] items-start">
          <div className="bg-[#F8F8F8] dark:bg-zinc-800/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-[#EC67A1]/10 dark:shadow-[#EC67A1]/20 backdrop-blur">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F774B9] via-[#EC67A1] to-[#E1518E] shadow-lg shadow-[#EC67A1]/30">
                <ImageIcon className="w-6 h-6 text-white" />
                <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#EC67A1]">
                  Motion Studio
                </p>
                <h1 className="text-3xl sm:text-4xl font-black text-sidebar-foreground">
                  SeeDream 4.5 — Image to Video
                </h1>
              </div>
            </div>
            <p className="text-sm sm:text-base text-header-muted leading-relaxed">
              Transform your images into stunning AI-powered videos. Upload an
              image, describe the motion, and watch it come to life with
              cinematic quality.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EC67A1]/20 text-[#EC67A1]">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-header-muted">Quality</p>
                  <p className="font-semibold text-sidebar-foreground">Up to 1080p</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5DC3F8]/20 text-[#5DC3F8]">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-header-muted">Duration</p>
                  <p className="font-semibold text-sidebar-foreground">4-12 seconds</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-500">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-header-muted">Output</p>
                  <p className="font-semibold text-sidebar-foreground">MP4 · 24fps</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white px-4 py-2 text-sm font-semibold shadow-lg shadow-[#EC67A1]/30 transition hover:-translate-y-0.5 hover:shadow-xl"
                title="View Help & Tips"
              >
                <Info className="w-4 h-4" />
                Quick Guide
              </button>
            </div>

            <div className="rounded-3xl border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-gradient-to-br from-[#EC67A1]/10 via-[#F774B9]/10 to-[#5DC3F8]/10 p-4 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-header-muted">Status</p>
                  <p className="font-semibold text-sidebar-foreground">
                    {isGenerating
                      ? "Generating..."
                      : generatedVideos.length > 0
                        ? "Ready"
                        : "Awaiting input"}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-header-muted">
                  <span
                    className={`h-2 w-2 rounded-full ${isGenerating ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`}
                  />
                  {isGenerating ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Processing
                    </span>
                  ) : (
                    "Idle"
                  )}
                </div>
              </div>
              {pollingStatus && (
                <div className="mt-3 flex items-center gap-2 text-sm text-[#EC67A1]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {pollingStatus}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-[420px_1fr] items-start">
          {/* Input Panel */}
          <div className="space-y-6">
            <div className="bg-[#F8F8F8] dark:bg-zinc-800/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-[#EC67A1]/10 dark:shadow-[#EC67A1]/20 backdrop-blur space-y-6">
              {/* Image Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-sidebar-foreground">
                    Starting Image *
                  </label>
                  {/* Reference Bank Button */}
                  {mounted && (
                    <button
                      type="button"
                      onClick={() => setShowReferenceBankSelector(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#EC67A1]/20 hover:bg-[#EC67A1]/30 text-[#EC67A1] border border-[#EC67A1]/30 transition-all"
                      disabled={isGenerating}
                    >
                      <Library className="w-3.5 h-3.5" />
                      Reference Bank
                    </button>
                  )}
                </div>
                {!uploadedImage ? (
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                      disabled={isGenerating}
                    />
                    <label
                      htmlFor="image-upload"
                      className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-2xl cursor-pointer hover:border-[#EC67A1]/50 transition-all duration-300 bg-white dark:bg-zinc-800/50 hover:bg-[#EC67A1]/5"
                    >
                      <Upload className="w-12 h-12 text-[#EC67A1] mb-3" />
                      <span className="text-sm font-medium text-sidebar-foreground">
                        Click to upload image
                      </span>
                      <span className="text-xs text-header-muted mt-1">
                        PNG, JPG, WEBP up to 30MB
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="relative group">
                    <img
                      src={uploadedImage}
                      alt="Uploaded"
                      className={`w-full h-48 object-contain rounded-2xl border-2 bg-zinc-100 dark:bg-black/30 ${
                        fromReferenceBank ? 'border-[#EC67A1]/50' : 'border-[#EC67A1]/20 dark:border-[#EC67A1]/30'
                      }`}
                    />
                    {fromReferenceBank && (
                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-[#EC67A1] text-xs text-white flex items-center gap-1">
                        <Library className="w-3 h-3" />
                        From Reference Bank
                      </div>
                    )}
                    <button
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                      disabled={isGenerating}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between w-full group">
                  <label className="text-sm font-semibold text-sidebar-foreground">
                    Motion Description *
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTemplates(!showTemplates)}
                      className="rounded-full bg-[#EC67A1]/20 hover:bg-[#EC67A1]/30 px-3 py-1 text-[11px] font-semibold text-[#EC67A1] transition-colors flex items-center gap-1"
                      disabled={isGenerating}
                    >
                      <Sparkles className="w-3 h-3" />
                      Templates
                    </button>
                    <span className="rounded-full bg-[#EC67A1]/20 px-3 py-1 text-[11px] font-semibold text-[#EC67A1]">Required</span>
                    <button
                      type="button"
                      onClick={() => setSectionsCollapsed(prev => ({ ...prev, prompt: !prev.prompt }))}
                      className="lg:hidden p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition"
                    >
                      <ChevronDown className={`w-4 h-4 text-header-muted transition-transform ${sectionsCollapsed.prompt ? '' : 'rotate-180'}`} />
                    </button>
                  </div>
                </div>

                <div className={`space-y-2 ${sectionsCollapsed.prompt ? 'hidden lg:block' : ''}`}>
                {/* Prompt Templates Dropdown */}
                {showTemplates && (
                  <div className="rounded-2xl border border-[#EC67A1]/30 dark:border-[#EC67A1]/40 bg-white dark:bg-zinc-800/80 backdrop-blur p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <p className="text-xs font-semibold text-[#EC67A1] mb-2">Motion Templates:</p>
                    <div className="grid gap-2">
                      {promptTemplates.map((template, idx) => (
                        <button
                          key={idx}
                          onClick={() => applyTemplate(template)}
                          disabled={isGenerating}
                          className="w-full text-left p-3 rounded-xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-gradient-to-br from-[#EC67A1]/5 to-transparent hover:from-[#EC67A1]/10 hover:border-[#EC67A1]/40 transition-all disabled:opacity-50"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-sidebar-foreground mb-0.5">{template.name}</p>
                              <p className="text-xs text-header-muted">{template.description}</p>
                            </div>
                            <Sparkles className="w-4 h-4 text-[#EC67A1] opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="pointer-events-none absolute inset-0 rounded-2xl border border-[#EC67A1]/10 bg-gradient-to-b from-[#EC67A1]/5 to-transparent" />
                  </div>
                )}

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    "Describe the motion you want...\n\nExample: Camera slowly zooms in, character opens eyes and smiles gently. Soft wind blows through hair."
                  }
                  className="w-full rounded-2xl border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-white dark:bg-zinc-800/50 px-4 py-3 text-sm text-sidebar-foreground placeholder-header-muted transition focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/50 focus:border-transparent disabled:opacity-50"
                  rows={5}
                  disabled={isGenerating}
                />
                
                <div className="flex items-center justify-between text-xs">
                  <p className="text-header-muted">
                    Describe camera movement, subject actions, and style cues.
                  </p>
                  <span className={`font-semibold ${
                    prompt.length > 500 ? 'text-red-500 dark:text-red-400' : prompt.length > 300 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-500 dark:text-emerald-400'
                  }`}>
                    {prompt.length > 500 && '⚠️ '}{prompt.length} chars
                  </span>
                </div>

                {/* User Presets Display */}
                {userPresets.length > 0 && (
                  <div className="mt-3 p-3 rounded-xl bg-white dark:bg-zinc-800/30 border border-[#EC67A1]/10 dark:border-[#EC67A1]/20">
                    <p className="text-xs font-semibold text-header-muted mb-2">Your Presets:</p>
                    <div className="flex flex-wrap gap-2">
                      {userPresets.map((preset) => (
                        <div key={preset.id} className="group relative">
                          <button
                            onClick={() => loadPreset(preset)}
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#EC67A1]/20 hover:bg-[#EC67A1]/30 text-xs font-medium text-[#EC67A1] border border-[#EC67A1]/30 transition-all disabled:opacity-50"
                          >
                            {preset.name}
                          </button>
                          <button
                            onClick={() => deletePreset(preset.id)}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete preset"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              </div>

              {/* Resolution & Aspect Ratio */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-sidebar-foreground">
                    Resolution
                  </label>
                  <span className="text-xs text-header-muted">
                    {currentDimensions}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(["720p", "1080p"] as const).map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setResolution(res)}
                      className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                        resolution === res
                          ? "border-[#EC67A1]/60 bg-[#EC67A1]/10 text-sidebar-foreground shadow-[#EC67A1]/20"
                          : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-sidebar-foreground"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <p className="font-semibold">{res}</p>
                      <p className="text-xs text-header-muted">
                        {res === "720p" ? "HD Quality" : "Full HD"}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-sidebar-foreground">
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={`rounded-xl border px-2 py-2 text-xs font-semibold transition hover:-translate-y-0.5 ${
                          aspectRatio === ratio
                            ? "border-[#EC67A1]/60 bg-[#EC67A1]/10 text-[#EC67A1]"
                            : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-sidebar-foreground"
                        } disabled:opacity-50`}
                        disabled={isGenerating}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 px-4 py-3 text-sm text-sidebar-foreground flex items-center justify-between">
                  <span className="text-header-muted">Output Dimensions</span>
                  <span className="font-semibold text-[#EC67A1]">
                    {currentDimensions}
                  </span>
                </div>
              </div>

              {/* Duration Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-sidebar-foreground">
                    Duration
                  </label>
                  <span className="text-xs text-[#EC67A1] font-semibold">
                    {duration === -1 ? "Auto" : `${duration}s`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-header-muted w-8">Auto</span>
                  <input
                    type="range"
                    min={0}
                    max={9}
                    step={1}
                    value={durationSliderValue}
                    onChange={(e) =>
                      setDurationSliderValue(Number(e.target.value))
                    }
                    className="flex-1 accent-[#EC67A1]"
                    disabled={isGenerating}
                  />
                  <span className="text-xs text-header-muted w-8">12s</span>
                </div>
                <div className="flex items-center justify-between text-xs text-header-muted">
                  <span>Model chooses optimal length</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {duration === -1 ? "4-12s range" : `Fixed ${duration}s`}
                  </span>
                </div>
              </div>

              {/* Toggle Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCameraFixed((prev) => !prev)}
                  className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                    cameraFixed
                      ? "border-[#EC67A1]/60 bg-[#EC67A1]/10 text-sidebar-foreground shadow-[#EC67A1]/20"
                      : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-sidebar-foreground"
                  } disabled:opacity-50`}
                  disabled={isGenerating}
                >
                  <p className="font-semibold flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Fixed Camera
                  </p>
                  <p className="text-xs text-header-muted">
                    {cameraFixed ? "Static view" : "Dynamic movement"}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setGenerateAudio((prev) => !prev)}
                  className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                    generateAudio
                      ? "border-[#EC67A1]/60 bg-[#EC67A1]/10 text-sidebar-foreground shadow-[#EC67A1]/20"
                      : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-sidebar-foreground"
                  } disabled:opacity-50`}
                  disabled={isGenerating}
                >
                  <p className="font-semibold flex items-center gap-2">
                    🎵 Generate Audio
                  </p>
                  <p className="text-xs text-header-muted">
                    {generateAudio ? "With sound" : "Silent video"}
                  </p>
                </button>
              </div>

              {/* Folder Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Archive className="w-4 h-4 text-[#EC67A1]" />
                  <p className="text-sm font-semibold text-sidebar-foreground">Save to Vault</p>
                  {isLoadingVaultData && (
                    <Loader2 className="w-3 h-3 animate-spin text-[#EC67A1]" />
                  )}
                </div>
                
                <VaultFolderDropdown
                  targetFolder={targetFolder}
                  setTargetFolder={setTargetFolder}
                  folderDropdownOpen={folderDropdownOpen}
                  setFolderDropdownOpen={setFolderDropdownOpen}
                  vaultFolders={vaultFolders}
                  isAllProfiles={isAllProfiles}
                  selectedProfile={selectedProfile}
                  mounted={mounted}
                  accentColor="pink"
                  label="Save to Folder"
                />
              </div>

              {/* Error Display */}
              {error && (
                <div className="flex items-center gap-2 rounded-2xl border border-red-400/50 dark:border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Generation in Progress Message */}
              {hasActiveGeneration && !isGenerating && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>A generation is already in progress for this tab. Please wait for it to complete.</span>
                  </div>
                </div>
              )}

              {/* Storage Full/Warning Banner */}
              <StorageFullBanner showWarning={true} />

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={hasActiveGeneration || !prompt.trim() || !uploadedImage || !canGenerate}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#EC67A1]/30 transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60"
                >
                  {hasActiveGeneration ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {hasActiveGeneration ? "Generating..." : "Generate Video"}
                </button>
                <button
                  onClick={handleReset}
                  type="button"
                  disabled={isGenerating}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-5 py-3 text-sm font-semibold text-sidebar-foreground transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
                >
                  <RotateCcw className="w-4 h-4" /> Reset
                </button>
              </div>
            </div>
          </div>

          {/* Output Panel */}
          <div className="space-y-6">
            {/* Generated Videos */}
            <div className="bg-[#F8F8F8] dark:bg-zinc-800/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-3xl p-6 shadow-2xl shadow-[#EC67A1]/10 dark:shadow-[#EC67A1]/20 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-sidebar-foreground">Generated Videos</h2>
                  <p className="text-xs text-header-muted">Latest output</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-header-muted">
                  <Play className="w-4 h-4" />
                  {generatedVideos.length} clip{generatedVideos.length !== 1 && "s"}
                </div>
              </div>

              {generatedVideos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#EC67A1]/30 bg-white dark:bg-zinc-800/30 p-6 text-center text-header-muted">
                  <Video className="w-6 h-6 mx-auto mb-2 text-[#EC67A1]" />
                  <p className="text-sm">Your generated video will appear here</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {generatedVideos.map((video) => (
                    <div
                      key={video.id}
                      className="group relative rounded-2xl border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-white dark:bg-zinc-800/30 overflow-hidden hover:border-[#EC67A1]/60 transition-all cursor-pointer"
                      onClick={() => openVideoModal(video)}
                    >
                      <div className="aspect-video relative bg-black">
                        <video
                          data-role="preview"
                          src={video.videoUrl}
                          className="w-full h-full object-cover pointer-events-none"
                          muted
                          playsInline
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-10 h-10 text-white" />
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        <p className="text-xs text-sidebar-foreground line-clamp-2">
                          {video.prompt}
                        </p>
                        <div className="flex items-center justify-between text-xs text-header-muted">
                          <span>
                            {video.duration === -1
                              ? "Auto"
                              : `${video.duration}s`}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(
                                video.videoUrl,
                                `seedream-i2v-${video.id}.mp4`
                              );
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-[#EC67A1]/20 bg-[#EC67A1]/10 px-2 py-1 text-sidebar-foreground hover:bg-[#EC67A1]/20 hover:border-[#EC67A1]/40 transition"
                          >
                            <Download className="w-3 h-3" />
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Generations */}
            <div className="bg-[#F8F8F8] dark:bg-zinc-800/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-3xl p-6 shadow-2xl shadow-[#EC67A1]/10 dark:shadow-[#EC67A1]/20 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-sidebar-foreground">Recent Generations</h2>
                    {generationHistory.length > 0 && (
                      <span className="text-xs text-header-muted">({generationHistory.length})</span>
                    )}
                  </div>
                  <p className="text-xs text-header-muted">History</p>
                </div>
                <div className="flex items-center gap-2">
                  {generationHistory.length > 4 && (
                    <button
                      onClick={() => setShowHistoryModal(true)}
                      className="text-xs text-[#EC67A1] hover:text-[#E1518E] transition flex items-center gap-1"
                    >
                      View All
                      <span className="bg-[#EC67A1]/20 rounded-full px-2 py-0.5">{generationHistory.length}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={loadGenerationHistory}
                    className="inline-flex items-center gap-1 rounded-full border border-[#EC67A1]/20 bg-[#EC67A1]/10 px-3 py-1 text-xs text-sidebar-foreground transition hover:-translate-y-0.5 hover:shadow"
                    disabled={isLoadingHistory}
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${isLoadingHistory ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </button>
                </div>
              </div>

              {generationHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#EC67A1]/30 bg-white dark:bg-zinc-800/30 p-6 text-center text-header-muted">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-[#EC67A1]" />
                  <p className="text-sm">Recent generations will appear here</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {generationHistory.slice(0, 4).map((video) => (
                    <div
                      key={video.id}
                      className="group relative rounded-2xl border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-white dark:bg-zinc-800/30 overflow-hidden hover:border-[#EC67A1]/60 transition-all cursor-pointer"
                      onClick={() => openVideoModal(video)}
                    >
                      <div className="aspect-video relative bg-black">
                        <video
                          data-role="preview"
                          src={video.videoUrl}
                          className="w-full h-full object-cover pointer-events-none"
                          muted
                          playsInline
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-10 h-10 text-white" />
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        <p className="text-xs text-sidebar-foreground line-clamp-2">
                          {video.prompt}
                        </p>
                        <div className="flex items-center justify-between text-xs text-header-muted">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {video.duration === -1
                              ? "Auto"
                              : `${video.duration}s`}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(
                                video.videoUrl,
                                `seedream-i2v-${video.id}.mp4`
                              );
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-[#EC67A1]/20 bg-[#EC67A1]/10 px-2 py-1 text-sidebar-foreground hover:bg-[#EC67A1]/20 hover:border-[#EC67A1]/40 transition"
                          >
                            <Download className="w-3 h-3" />
                            Save
                          </button>
                        </div>
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
      {showVideoModal &&
        selectedVideo &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowVideoModal(false);
            }}
          >
            <div
              className="relative w-full max-w-6xl max-h-[85vh] rounded-3xl border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-white dark:bg-[#1a1625] shadow-2xl shadow-[#EC67A1]/10"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full bg-zinc-100 dark:bg-zinc-800 p-2 text-sidebar-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700 z-10"
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
                <p className="font-semibold text-sidebar-foreground mb-1">
                  {selectedVideo.prompt}
                </p>
                <p className="text-header-muted mb-3">
                  {selectedVideo.duration === -1
                    ? "Auto"
                    : `${selectedVideo.duration}s`}{" "}
                  · {selectedVideo.modelVersion}
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
                        `seedream-i2v-${selectedVideo.id}.mp4`
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-sidebar-foreground transition"
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

      {/* Help Modal */}
      {showHelpModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={() => setShowHelpModal(false)}
          >
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-auto my-8 rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="sticky top-4 float-right mr-4 z-10 rounded-full bg-zinc-100 dark:bg-zinc-800 p-2 text-sidebar-foreground transition hover:bg-zinc-200 dark:hover:bg-zinc-700"
                onClick={() => setShowHelpModal(false)}
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[#EC67A1] to-[#F774B9]">
                    <Info className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-sidebar-foreground">SeeDream 4.5 Image-to-Video — Guide</h2>
                </div>

              <div className="space-y-8 text-sidebar-foreground">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-[#EC67A1]" />
                  <h3 className="text-xl font-semibold">Image-to-Video Guide</h3>
                </div>

                {/* Image Tips */}
                <div className="border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl p-4 bg-[#F8F8F8] dark:bg-zinc-800/50">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#EC67A1]" />
                    Image Requirements
                  </h4>
                  <ul className="text-sm space-y-1 text-header-muted list-disc list-inside">
                    <li>Formats: JPEG, PNG, WebP, BMP, TIFF, GIF, HEIC</li>
                    <li>Size: Up to 30MB</li>
                    <li>Dimensions: 300px-6000px, aspect ratio 0.4-2.5</li>
                    <li>Higher quality images = better video results</li>
                  </ul>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-4">
                    <p className="font-semibold text-emerald-600 dark:text-emerald-300 mb-2">✓ Do</p>
                    <ul className="text-sm space-y-1 text-emerald-700 dark:text-emerald-200 list-disc list-inside">
                      <li>Upload high-resolution images</li>
                      <li>Describe motion clearly</li>
                      <li>Match aspect ratio to your image</li>
                      <li>Specify camera movements</li>
                    </ul>
                  </div>
                  <div className="bg-red-500/10 border border-red-400/30 rounded-2xl p-4">
                    <p className="font-semibold text-red-600 dark:text-red-300 mb-2">✗ Avoid</p>
                    <ul className="text-sm space-y-1 text-red-700 dark:text-red-200 list-disc list-inside">
                      <li>Low-quality or blurry images</li>
                      <li>Extreme aspect ratio mismatches</li>
                      <li>Overly complex multi-scene actions</li>
                      <li>Contradictory motion descriptions</li>
                    </ul>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl p-4 bg-[#F8F8F8] dark:bg-zinc-800/50">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-[#EC67A1]" />
                      Parameters
                    </h4>
                    <ul className="text-sm space-y-1 text-header-muted list-disc list-inside">
                      <li>720p: Faster processing</li>
                      <li>1080p: Higher quality output</li>
                      <li>Adaptive: Auto-fits to your image</li>
                      <li>Duration: 4-12 seconds</li>
                      <li>Audio: Synced sound generation</li>
                    </ul>
                  </div>
                  <div className="border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl p-4 bg-[#F8F8F8] dark:bg-zinc-800/50">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#EC67A1]" />
                      Example Prompts
                    </h4>
                    <ul className="text-sm space-y-2 text-header-muted">
                      <li className="p-2 bg-white dark:bg-zinc-800/80 rounded-lg">
                        &quot;Character opens eyes, smiles gently, hair blowing in
                        wind&quot;
                      </li>
                      <li className="p-2 bg-white dark:bg-zinc-800/80 rounded-lg">
                        &quot;Camera slowly zooms in, dramatic lighting change&quot;
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="border border-amber-400/30 bg-amber-500/10 rounded-2xl p-4">
                  <h4 className="font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4" />
                    Notes
                  </h4>
                  <ul className="text-sm space-y-1 text-amber-700 dark:text-amber-200 list-disc list-inside">
                    <li>Processing time: 30s - 2min depending on duration</li>
                    <li>Non-matching aspect ratios apply center-based cropping</li>
                    <li>Videos auto-save to your S3 storage</li>
                  </ul>
                </div>
              </div>
            </div>
            </div>
          </div>,
          document.body
        )}

      {/* View All History Modal */}
      {showHistoryModal && typeof window !== 'undefined' && document?.body && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setShowHistoryModal(false)}
        >
          <div 
            className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-white dark:bg-[#1a1625] shadow-2xl shadow-[#EC67A1]/10 dark:shadow-[#EC67A1]/20 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-white dark:bg-[#1a1625] backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#EC67A1]/20 to-[#F774B9]/20">
                  <Film className="w-5 h-5 text-[#EC67A1]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-sidebar-foreground">Generation History</h2>
                  <p className="text-xs text-header-muted">{generationHistory.length} videos generated</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="rounded-full bg-zinc-100 dark:bg-zinc-800 p-2 text-sidebar-foreground transition hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid of all history videos */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {generationHistory.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {generationHistory.map((video) => (
                    <div
                      key={video.id}
                      role="button"
                      aria-label="Open video"
                      tabIndex={0}
                      onClick={() => {
                        setShowHistoryModal(false);
                        openVideoModal(video);
                      }}
                      className="group overflow-hidden rounded-2xl border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-[#F8F8F8] dark:bg-zinc-800/30 cursor-pointer transition hover:-translate-y-1 hover:border-[#EC67A1]/50"
                    >
                      <div className="relative">
                        <video
                          data-role="preview"
                          preload="metadata"
                          src={video.videoUrl}
                          className="w-full h-32 object-cover pointer-events-none"
                          controlsList="nodownload noplaybackrate noremoteplayback"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition">
                          <Play className="w-10 h-10 text-white" />
                        </div>
                        {/* Profile badge (when viewing all profiles) */}
                        {isAllProfiles && video.profileName && (
                          <div className="absolute top-2 left-2 text-[9px] text-violet-200 bg-violet-600/60 rounded px-1.5 py-0.5">
                            {video.profileName}
                          </div>
                        )}
                        {/* Date badge */}
                        <div className="absolute top-2 right-2 text-[9px] text-slate-300 bg-black/50 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition">
                          {new Date(video.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-sm font-medium text-sidebar-foreground line-clamp-2 mb-1">{video.prompt}</p>
                        <div className="flex items-center gap-2 text-[10px] text-header-muted flex-wrap">
                          {isAllProfiles && video.profileName && (
                            <span className="bg-violet-500/20 rounded px-1.5 py-0.5 text-violet-600 dark:text-violet-300">
                              {video.profileName}
                            </span>
                          )}
                          <span className="bg-zinc-200 dark:bg-zinc-700/50 rounded px-1.5 py-0.5">
                            {video.duration === -1 ? "Auto" : `${video.duration}s`}
                          </span>
                          <span className="bg-[#EC67A1]/20 rounded px-1.5 py-0.5 text-[#EC67A1]">
                            {video.modelVersion}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-header-muted">
                  <Film className="w-12 h-12 mb-3 opacity-50" />
                  <p>No generation history yet</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reference Bank Selector */}
      {showReferenceBankSelector && (
        <ReferenceSelector
          isOpen={true}
          onClose={() => setShowReferenceBankSelector(false)}
          onSelect={handleReferenceBankSelect}
          filterType="image"
        />
      )}

      {/* Save Preset Modal */}
      {showPresetModal && typeof window !== 'undefined' && document?.body && createPortal(
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white dark:bg-[#1a1625] rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-[#EC67A1]/10 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30">
            <h3 className="text-xl font-semibold mb-4 text-sidebar-foreground">Save Image-to-Video Preset</h3>
            
            <div className="space-y-4">
              {/* Preset Name Input */}
              <div>
                <label className="block text-sm font-medium text-header-muted mb-2">
                  Preset Name
                </label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g., My Motion Settings"
                  className="w-full px-4 py-2.5 bg-[#F8F8F8] dark:bg-zinc-800/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-lg text-sidebar-foreground placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/50"
                  autoFocus
                />
              </div>

              {/* Current Settings Preview */}
              <div className="bg-[#F8F8F8] dark:bg-zinc-800/50 rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-header-muted uppercase tracking-wide mb-2">
                  Settings to Save:
                </p>
                <div className="space-y-1.5 text-sm text-sidebar-foreground">
                  <div className="flex justify-between">
                    <span className="text-header-muted">Resolution:</span>
                    <span className="font-medium">{resolution}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-header-muted">Aspect Ratio:</span>
                    <span className="font-medium">{aspectRatio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-header-muted">Duration:</span>
                    <span className="font-medium">{duration === -1 ? 'Auto' : `${duration}s`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-header-muted">Camera:</span>
                    <span className="font-medium">{cameraFixed ? 'Fixed' : 'Dynamic'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-header-muted">Audio:</span>
                    <span className="font-medium">{generateAudio ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPresetModal(false);
                    setPresetName('');
                  }}
                  className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sidebar-foreground rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAsPreset}
                  disabled={!presetName.trim()}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#EC67A1]/30"
                >
                  Save Preset
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Floating Credit Calculator */}
      <CreditCalculator
        modifiers={[
          ...(resolution === '1080p' ? [{
            label: '1080p Resolution',
            multiplier: 1.3,
            description: '1080p costs 30% more credits than 720p'
          }] : []),
          ...(duration > 4 ? [{
            label: `Extended Duration (${duration}s)`,
            multiplier: duration / 4,
            description: 'Longer videos cost more credits proportionally'
          }] : []),
        ]}
        position="bottom-right"
      />
    </div>
  );
}
