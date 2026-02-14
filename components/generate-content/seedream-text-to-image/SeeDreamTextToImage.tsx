"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import { useCredits } from '@/lib/hooks/useCredits.query';
import { CreditCalculator } from "@/components/credits/CreditCalculator";
import VaultFolderDropdown, { VaultFolder } from "@/components/generate-content/shared/VaultFolderDropdown";
import { StorageFullBanner, useCanGenerate } from "@/components/generate-content/shared/StorageFullBanner";
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
  Info,
  Zap,
  Archive,
  X,
  Check,
  ChevronDown,
} from "lucide-react";

interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  modelVersion: string;
  size: string;
  createdAt: string;
  status: "completed" | "processing" | "failed";
  profileName?: string | null;
  metadata?: {
    resolution?: string;
    aspectRatio?: string;
    negativePrompt?: string;
    watermark?: boolean;
  };
}

interface GenerationJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  imageUrl?: string;
  error?: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  category: string;
  resolution?: "2K" | "4K";
  aspectRatio?: "1:1" | "3:4" | "4:3" | "16:9" | "9:16" | "2:3" | "3:2" | "21:9";
}

interface UserPreset {
  id: string;
  name: string;
  resolution: "2K" | "4K";
  aspectRatio: "1:1" | "3:4" | "4:3" | "16:9" | "9:16" | "2:3" | "3:2" | "21:9";
  watermark: boolean;
  folderId?: string;
}

export default function SeeDreamTextToImage() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const params = useParams();
  const tenant = params.tenant as string;
  const { updateGlobalProgress, clearGlobalProgress, addJob, updateJob, hasActiveGenerationForType, getLastCompletedJobForType, clearCompletedJobsForType, activeJobs } = useGenerationProgress();
  const { refreshCredits } = useCredits();
  const { canGenerate, storageError } = useCanGenerate();

  // Check if this specific tab has an active generation
  const hasActiveGeneration = hasActiveGenerationForType('text-to-image');

  // Form State
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [selectedResolution, setSelectedResolution] = useState<"2K" | "4K">("2K");
  const [selectedRatio, setSelectedRatio] = useState<"1:1" | "3:4" | "4:3" | "16:9" | "9:16" | "2:3" | "3:2" | "21:9">("1:1");
  const [enableWatermark, setEnableWatermark] = useState(false);
  const [maxImages, setMaxImages] = useState(1);
  const [enableBatchGeneration, setEnableBatchGeneration] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Folder Selection State
  const [targetFolder, setTargetFolder] = useState<string>("");
  const [showFolderValidation, setShowFolderValidation] = useState(false);

  // Prompt Templates & Presets
  const [showTemplates, setShowTemplates] = useState(false);
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState("");

  // Collapsible Sections for Mobile
  const [sectionsCollapsed, setSectionsCollapsed] = useState({
    framing: false,
    vault: false,
    batch: false,
    advanced: true
  });

  // Use global profile from header
  const { profileId: globalProfileId, selectedProfile, isAllProfiles } = useInstagramProfile();

  // Hydration fix - track if component is mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check for stale active jobs and try to complete them from history
  useEffect(() => {
    if (!mounted || !apiClient) return;

    const checkStaleJob = async () => {
      // Check if there's an active processing job for this type
      const activeJob = activeJobs.find(
        job => job.generationType === 'text-to-image' && 
        (job.status === 'pending' || job.status === 'processing')
      );

      if (activeJob) {
        // Check generation history to see if it completed while we were offline
        try {
          const url = globalProfileId 
            ? `/api/generate/seedream-text-to-image?history=true&profileId=${globalProfileId}`
            : "/api/generate/seedream-text-to-image?history=true";
          const response = await apiClient.get(url);
          
          if (response.ok) {
            const data = await response.json();
            const recentImages = data.images || [];
            
            // Check if any images were created around the time of the active job
            const jobTimeWindow = 60 * 1000; // 1 minute window
            const matchingImages = recentImages.filter((img: any) => {
              const imgCreatedAt = new Date(img.createdAt).getTime();
              return imgCreatedAt >= activeJob.startedAt && 
                     imgCreatedAt <= activeJob.startedAt + jobTimeWindow;
            });

            if (matchingImages.length > 0) {
              console.log('✅ Found completed images for stale job, marking as complete');
              // Update the job as completed with the results
              updateJob(activeJob.jobId, {
                status: 'completed',
                progress: 100,
                message: 'Generation completed',
                results: matchingImages,
                completedAt: Date.now(),
              });
              
              // Display the results
              setGeneratedImages(matchingImages);
              setGenerationHistory(prev => {
                const allImages = [...matchingImages, ...prev];
                const uniqueHistory = allImages.filter((img: any, index: number, self: any[]) =>
                  index === self.findIndex((i: any) => i.id === img.id)
                ).slice(0, 20);
                return uniqueHistory;
              });
            }
          }
        } catch (error) {
          console.error('Failed to check for completed generation:', error);
        }
      }
    };

    checkStaleJob();
    // Only runs once on mount to check for previously incomplete jobs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, apiClient]);

  // Check for completed generations when component mounts or jobs update
  useEffect(() => {
    if (!mounted || isGenerating) return; // Don't sync while actively generating
    
    const lastCompletedJob = getLastCompletedJobForType('text-to-image');
    if (lastCompletedJob && lastCompletedJob.results && Array.isArray(lastCompletedJob.results)) {
      // Display the results if not already showing
      setGeneratedImages(prev => {
        // Check if we already have these results
        const existingIds = new Set(prev.map(img => img.id));
        const newResults = lastCompletedJob.results.filter((img: any) => !existingIds.has(img.id));
        
        if (newResults.length > 0) {
          console.log('📋 Displaying results from completed generation:', newResults.length);
          return [...newResults, ...prev];
        }
        return prev;
      });
      
      // Also update history
      setGenerationHistory(prev => {
        const allImages = [...lastCompletedJob.results, ...prev];
        const uniqueHistory = allImages.filter((img: any, index: number, self: any[]) =>
          index === self.findIndex((i: any) => i.id === img.id)
        ).slice(0, 20);
        return uniqueHistory;
      });
    }
  }, [mounted, getLastCompletedJobForType]);

  // Load smart defaults from localStorage per profile
  useEffect(() => {
    if (!mounted || !globalProfileId) return;
    
    const savedSettingsKey = `seedream-settings-${globalProfileId}`;
    const savedSettings = localStorage.getItem(savedSettingsKey);
    
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.resolution) setSelectedResolution(settings.resolution);
        if (settings.aspectRatio) setSelectedRatio(settings.aspectRatio);
        if (settings.watermark !== undefined) setEnableWatermark(settings.watermark);
        if (settings.folderId) setTargetFolder(settings.folderId);
      } catch (e) {
        console.error('Failed to load saved settings:', e);
      }
    }
  }, [mounted, globalProfileId]);

  // Load user presets
  useEffect(() => {
    if (!mounted) return;
    
    const savedPresets = localStorage.getItem('seedream-presets');
    if (savedPresets) {
      try {
        setUserPresets(JSON.parse(savedPresets));
      } catch (e) {
        console.error('Failed to load presets:', e);
      }
    }
  }, [mounted]);

  // Save settings when they change
  useEffect(() => {
    if (!mounted || !globalProfileId) return;
    
    const settingsToSave = {
      resolution: selectedResolution,
      aspectRatio: selectedRatio,
      watermark: enableWatermark,
      folderId: targetFolder
    };
    
    const savedSettingsKey = `seedream-settings-${globalProfileId}`;
    localStorage.setItem(savedSettingsKey, JSON.stringify(settingsToSave));
  }, [mounted, globalProfileId, selectedResolution, selectedRatio, enableWatermark, targetFolder]);

  // Check for reuse data from sessionStorage (from Vault)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const reuseDataStr = sessionStorage.getItem('seedream-t2i-reuse');
    if (reuseDataStr) {
      try {
        const reuseData = JSON.parse(reuseDataStr);
        
        // Populate form with reuse data
        if (reuseData.prompt) {
          setPrompt(reuseData.prompt);
        }
        if (reuseData.resolution) {
          setSelectedResolution(reuseData.resolution as "2K" | "4K");
        }
        if (reuseData.aspectRatio) {
          const validRatios = ["1:1", "3:4", "4:3", "16:9", "9:16", "2:3", "3:2", "21:9"];
          if (validRatios.includes(reuseData.aspectRatio)) {
            setSelectedRatio(reuseData.aspectRatio as typeof selectedRatio);
          }
        }
        if (reuseData.negativePrompt) {
          setNegativePrompt(reuseData.negativePrompt);
        }
        if (reuseData.watermark !== undefined) {
          setEnableWatermark(reuseData.watermark);
        }
        
        // Clear sessionStorage after use
        sessionStorage.removeItem('seedream-t2i-reuse');
      } catch (e) {
        console.error('Error parsing reuse data:', e);
        sessionStorage.removeItem('seedream-t2i-reuse');
      }
    }
  }, []);

  // Folder dropdown state
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);

  // Vault Integration State - only folders for the selected profile
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);

  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // History State
  const [generationHistory, setGenerationHistory] = useState<GeneratedImage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Modal state for viewing images
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  
  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Resolution and Ratio configurations
  const resolutionRatios = {
    "2K": {
      "1:1": "2048x2048",
      "3:4": "1728x2304",
      "4:3": "2304x1728",
      "16:9": "2560x1440",
      "9:16": "1440x2560",
      "2:3": "1664x2496",
      "3:2": "2496x1664",
      "21:9": "3024x1296",
    },
    "4K": {
      "1:1": "4096x4096",
      "3:4": "3520x4704",
      "4:3": "4704x3520",
      "16:9": "5504x3040",
      "9:16": "3040x5504",
      "2:3": "3328x4992",
      "3:2": "4992x3328",
      "21:9": "6240x2656",
    },
  };

  const aspectRatios = ["1:1", "3:4", "4:3", "16:9", "9:16", "2:3", "3:2", "21:9"] as const;

  // Prompt Templates
  const promptTemplates: PromptTemplate[] = [
    {
      id: "editorial-portrait",
      name: "Editorial Portrait",
      category: "Photography",
      prompt: "High-fashion editorial portrait, professional model with striking features, dramatic studio lighting with rim light, shot on medium format camera, shallow depth of field, clean background, Vogue magazine aesthetic, sharp focus on eyes, color graded with rich tones",
      resolution: "4K",
      aspectRatio: "3:4"
    },
    {
      id: "product-hero",
      name: "Product Hero Shot",
      category: "Commercial",
      prompt: "Premium product photography, luxury item centered on minimalist pedestal, soft directional lighting with subtle reflections, clean white background, photorealistic detail, commercial quality, studio lighting setup, hyper-detailed textures",
      resolution: "4K",
      aspectRatio: "1:1"
    },
    {
      id: "cinematic-landscape",
      name: "Cinematic Landscape",
      category: "Scenery",
      prompt: "Epic cinematic landscape, golden hour lighting, dramatic volumetric clouds, vivid color palette, wide-angle composition, atmospheric perspective, photorealistic detail, nature documentary quality, deep depth of field",
      resolution: "4K",
      aspectRatio: "21:9"
    },
    {
      id: "instagram-lifestyle",
      name: "Instagram Lifestyle",
      category: "Social Media",
      prompt: "Bright and airy lifestyle shot, natural window lighting, warm color tones, candid moment, aesthetic composition, Instagram-worthy, soft focus background, relatable and authentic vibe",
      resolution: "2K",
      aspectRatio: "4:3"
    },
    {
      id: "tech-visualization",
      name: "Tech Product Viz",
      category: "Technology",
      prompt: "Sleek tech product visualization, modern minimalist design, neon accent lighting, futuristic dark background with subtle grid, floating elements, reflective surfaces, cutting-edge aesthetic, high-tech atmosphere",
      resolution: "4K",
      aspectRatio: "16:9"
    },
    {
      id: "food-photography",
      name: "Food Photography",
      category: "Culinary",
      prompt: "Gourmet food photography, artfully plated dish, overhead 45-degree angle, natural soft lighting, rustic wooden table surface, depth of field with blurred background, rich colors, appetizing presentation, magazine quality",
      resolution: "2K",
      aspectRatio: "1:1"
    }
  ];

  // Get current size based on resolution and ratio
  const currentSize = resolutionRatios[selectedResolution][selectedRatio];

  // Load generation history when apiClient is available or profile changes
  useEffect(() => {
    if (apiClient) {
      loadGenerationHistory();
    }
  }, [apiClient, globalProfileId]);

  const loadGenerationHistory = async () => {
    if (!apiClient) return;
    setIsLoadingHistory(true);
    try {
      // Add profileId to filter by selected profile
      const url = globalProfileId 
        ? `/api/generate/seedream-text-to-image?profileId=${globalProfileId}`
        : "/api/generate/seedream-text-to-image";
      const response = await apiClient.get(url);
      if (response.ok) {
        const data = await response.json();
        const images = data.images || [];
        console.log('📋 Loaded T2I generation history:', images.length, 'images for profile:', globalProfileId);
        console.log('📋 Image URLs present:', images.filter((i: any) => !!i.imageUrl).length);
        setGenerationHistory(images);
      } else {
        console.error('Failed to load T2I history:', response.status);
      }
    } catch (error) {
      console.error('Error loading T2I history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

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

  // Preset Management
  const saveAsPreset = () => {
    if (!presetName.trim()) return;
    
    const newPreset: UserPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      resolution: selectedResolution,
      aspectRatio: selectedRatio,
      watermark: enableWatermark,
      folderId: targetFolder || undefined
    };
    
    const updatedPresets = [...userPresets, newPreset];
    setUserPresets(updatedPresets);
    localStorage.setItem('seedream-presets', JSON.stringify(updatedPresets));
    setPresetName("");
    setShowPresetModal(false);
  };

  const loadPreset = (preset: UserPreset) => {
    setSelectedResolution(preset.resolution);
    setSelectedRatio(preset.aspectRatio);
    setEnableWatermark(preset.watermark);
    if (preset.folderId) setTargetFolder(preset.folderId);
  };

  const deletePreset = (presetId: string) => {
    const updatedPresets = userPresets.filter(p => p.id !== presetId);
    setUserPresets(updatedPresets);
    localStorage.setItem('seedream-presets', JSON.stringify(updatedPresets));
  };

  const applyTemplate = (template: PromptTemplate) => {
    setPrompt(template.prompt);
    if (template.resolution) setSelectedResolution(template.resolution);
    if (template.aspectRatio) setSelectedRatio(template.aspectRatio);
    setShowTemplates(false);
  };

  const handleGenerate = async () => {
    // Clear any old completed jobs for this generation type
    clearCompletedJobsForType('text-to-image');
    
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
      setError("Please select a vault folder to save your images");
      setShowFolderValidation(true);
      // Scroll to folder section
      document.getElementById('folder-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);
    
    const taskId = `seedream-t2i-${Date.now()}`;
    
    try {
      // Create a job in the global progress tracker
      addJob({
        jobId: taskId,
        generationType: "text-to-image",
        progress: 0,
        stage: "starting",
        message: "Starting SeeDream 4.5 generation...",
        status: "processing",
        startedAt: Date.now(),
        metadata: {
          prompt: prompt.trim().slice(0, 100),
          resolution: selectedResolution,
          aspectRatio: selectedRatio,
          profileName: selectedProfile?.name,
        }
      });

      updateGlobalProgress({
        isGenerating: true,
        progress: 0,
        stage: "starting",
        message: "Starting SeeDream 4.5 generation...",
        generationType: "text-to-image",
        jobId: taskId,
      });

      // Prepare request payload - use the folder's profileId for proper association
      const folderProfileId = vaultFolders.find(f => f.id === targetFolder)?.profileId || globalProfileId;
      const payload: any = {
        prompt: prompt.trim(),
        model: "ep-20260103160511-gxx75",
        watermark: enableWatermark,
        sequential_image_generation: maxImages > 1 ? "auto" : "disabled",
        size: currentSize,
        // Always send the current profile ID so images are associated with the profile
        vaultProfileId: folderProfileId || null,
        // Include resolution and aspect ratio for metadata
        resolution: selectedResolution,
        aspectRatio: selectedRatio,
        organizationSlug: tenant,
      };

      // Handle vault folder selection - save directly to vault
      if (targetFolder && globalProfileId) {
        payload.saveToVault = true;
        payload.vaultFolderId = targetFolder;
      }

      // Add negative prompt if provided
      if (negativePrompt.trim()) {
        payload.negative_prompt = negativePrompt.trim();
      }

      // Add batch generation config
      if (maxImages > 1) {
        payload.sequential_image_generation_options = {
          max_images: maxImages,
        };
      }

      // Track current progress for simulation
      let currentProgress = 0;
      
      // Simulate realistic progress updates while waiting for API
      const progressInterval = setInterval(() => {
        if (currentProgress < 90) {
          const increment = Math.random() * 10 + 5; // Random increment between 5-15%
          currentProgress = Math.min(currentProgress + increment, 90);
          
          // Update stage based on progress
          let stage = "processing";
          let message = "Generating image...";
          if (currentProgress < 20) {
            stage = "loading_models";
            message = "Loading AI models...";
          } else if (currentProgress < 40) {
            stage = "processing_prompt";
            message = "Processing your prompt...";
          } else if (currentProgress < 70) {
            stage = "generating";
            message = "Creating your image...";
          } else {
            stage = "finalizing";
            message = "Finalizing generation...";
          }
          
          updateJob(taskId, {
            progress: currentProgress,
            stage,
            message,
          });
          
          updateGlobalProgress({
            progress: currentProgress,
            stage,
            message,
            jobId: taskId,
          });
        }
      }, 2000); // Update every 2 seconds

      const response = await apiClient.post("/api/generate/seedream-text-to-image", payload);
      
      // Clear progress simulation
      clearInterval(progressInterval);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Generation failed");
      }

      const data = await response.json();

      // Refresh credit balance in the UI after successful generation
      refreshCredits();

      // Update job as completed
      updateJob(taskId, {
        progress: 100,
        stage: "completed",
        message: "Generation completed!",
        status: "completed",
      });

      updateGlobalProgress({
        isGenerating: false,
        progress: 100,
        stage: "completed",
        message: "Generation completed!",
        generationType: "text-to-image",
        jobId: taskId,
      });

      // Use the images returned from the API (already saved to database)
      const images: GeneratedImage[] = data.images.map((img: any) => ({
        id: img.id,
        imageUrl: img.url,
        prompt: img.prompt,
        modelVersion: img.model || "SeeDream 4.5",
        size: img.size,
        createdAt: img.createdAt,
        status: "completed" as const,
      }));

      console.log('📋 Generated images:', images.length);
      console.log('📋 Image URLs:', images.map(i => ({ id: i.id, hasUrl: !!i.imageUrl, url: i.imageUrl?.slice(0, 50) })));

      setGeneratedImages(images);
      
      // Store results in the job so they persist across tab navigation
      updateJob(taskId, {
        results: images,
      });
      
      // Also add new images to history immediately for instant feedback
      setGenerationHistory(prev => {
        const newHistory = [...images, ...prev];
        // Remove duplicates by id and limit to 20
        const uniqueHistory = newHistory.filter((img, index, self) =>
          index === self.findIndex((i) => i.id === img.id)
        ).slice(0, 20);
        return uniqueHistory;
      });

      // Also reload history from server to ensure sync (with small delay for DB consistency)
      setTimeout(() => loadGenerationHistory(), 500);
      
    } catch (error: any) {
      console.error("Generation error:", error);
      setError(error.message || "Failed to generate images");
      
      // Update job as failed
      updateJob(taskId, {
        progress: 0,
        stage: "failed",
        message: error.message || "Generation failed",
        status: "failed",
        error: error.message,
      });

      updateGlobalProgress({
        isGenerating: false,
        progress: 0,
        stage: "failed",
        message: error.message || "Generation failed",
        generationType: "text-to-image",
        jobId: taskId,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (imageUrl: string, filename: string) => {
    try {
      let blobUrl: string;
      
      if (imageUrl.startsWith('data:')) {
        // Data URLs can be used directly
        blobUrl = imageUrl;
      } else {
        // Use proxy endpoint to avoid CORS issues
        const proxyUrl = `/api/download/image?url=${encodeURIComponent(imageUrl)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.status}`);
        }
        
        const blob = await response.blob();
        blobUrl = window.URL.createObjectURL(blob);
      }
      
      // Trigger download
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
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

  const handleReset = () => {
    // Clear any completed jobs for this generation type
    clearCompletedJobsForType('text-to-image');
    
    setPrompt("");
    setNegativePrompt("");
    setSelectedResolution("2K");
    setSelectedRatio("1:1");
    setEnableWatermark(false);
    setMaxImages(1);
    setEnableBatchGeneration(false);
    setTargetFolder("");
    setError(null);
    setGeneratedImages([]);
  };

  // Reuse settings from a generated image
  const handleReuseSettings = (image: GeneratedImage) => {
    // Set prompt
    if (image.prompt) {
      setPrompt(image.prompt);
    }
    
    // Set resolution from metadata or try to parse from size
    if (image.metadata?.resolution) {
      setSelectedResolution(image.metadata.resolution as "2K" | "4K");
    }
    
    // Set aspect ratio from metadata
    if (image.metadata?.aspectRatio) {
      const validRatios = ["1:1", "3:4", "4:3", "16:9", "9:16", "2:3", "3:2", "21:9"];
      if (validRatios.includes(image.metadata.aspectRatio)) {
        setSelectedRatio(image.metadata.aspectRatio as typeof selectedRatio);
      }
    }
    
    // Set negative prompt from metadata
    if (image.metadata?.negativePrompt) {
      setNegativePrompt(image.metadata.negativePrompt);
    }
    
    // Set watermark from metadata
    if (image.metadata?.watermark !== undefined) {
      setEnableWatermark(image.metadata.watermark);
    }
    
    // Close any open modals
    setShowImageModal(false);
    setShowHistoryModal(false);
    setSelectedImage(null);
    
    // Scroll to top to show the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative max-h-[85vh] overflow-y-auto overflow-x-hidden bg-[#F8F8F8] dark:bg-[#0a0a0f] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl shadow-lg custom-scrollbar text-sidebar-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-[#EC67A1]/20 dark:bg-[#EC67A1]/10 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-[#5DC3F8]/10 dark:bg-[#5DC3F8]/5 blur-3xl" />
        <div className="absolute inset-x-10 top-20 h-[1px] bg-gradient-to-r from-transparent via-[#EC67A1]/20 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <div className="grid gap-4 md:grid-cols-[2fr_1fr] items-center">
          <div className="bg-[#F8F8F8] dark:bg-zinc-800/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-[#EC67A1]/10 dark:shadow-[#EC67A1]/20 backdrop-blur">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F774B9] via-[#EC67A1] to-[#E1518E] shadow-lg shadow-[#EC67A1]/30">
                <Sparkles className="w-6 h-6 text-white" />
                <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#EC67A1]">Live Studio</p>
                <h1 className="text-3xl sm:text-4xl font-black text-sidebar-foreground">SeeDream 4.5 — Text to Image</h1>
              </div>
            </div>
            <p className="text-sm sm:text-base text-header-muted leading-relaxed">
              Craft bold visuals with SeeDream 4.5 — tuned for cinematic clarity, color fidelity, and coherent batches. Pair ratios and resolution presets to hit the perfect look every time.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EC67A1]/20 text-[#EC67A1]"><Zap className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-header-muted">Speed</p>
                  <p className="text-sm font-semibold text-sidebar-foreground">Batch up to 5</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5DC3F8]/20 text-[#5DC3F8]"><Sliders className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-header-muted">Control</p>
                  <p className="text-sm font-semibold text-sidebar-foreground">Smart ratios</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-500"><Download className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-header-muted">Output</p>
                  <p className="text-sm font-semibold text-sidebar-foreground">4K ready</p>
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
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-[#F8F8F8] dark:bg-zinc-800/50 px-4 py-3">
                <p className="text-xs text-header-muted">Current size</p>
                <p className="text-lg font-semibold text-sidebar-foreground">{currentSize}</p>
              </div>
              <div className="rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-[#F8F8F8] dark:bg-zinc-800/50 px-4 py-3">
                <p className="text-xs text-header-muted">Aspect</p>
                <p className="text-lg font-semibold text-sidebar-foreground">{selectedRatio}</p>
              </div>
              <div className="rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-[#F8F8F8] dark:bg-zinc-800/50 px-4 py-3">
                <p className="text-xs text-header-muted">Resolution</p>
                <p className="text-lg font-semibold text-sidebar-foreground">{selectedResolution}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Generation Controls */}
          <div className="lg:col-span-1">
            <div className="rounded-3xl border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-[#F8F8F8] dark:bg-zinc-800/50 p-6 shadow-2xl shadow-[#EC67A1]/10 dark:shadow-[#EC67A1]/20 backdrop-blur space-y-6">
              {/* Prompt Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-sidebar-foreground">Prompt</label>
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
                  </div>
                </div>
                
                {/* Prompt Templates Dropdown */}
                {showTemplates && (
                  <div className="rounded-2xl border border-[#EC67A1]/30 bg-white dark:bg-[#1a1625] backdrop-blur p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-[#EC67A1]">Choose a template</p>
                      <button
                        onClick={() => setShowTemplates(false)}
                        className="text-header-muted hover:text-sidebar-foreground transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid gap-2 max-h-60 overflow-y-auto">
                      {promptTemplates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => applyTemplate(template)}
                          className="text-left p-3 rounded-xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-[#F8F8F8] dark:bg-zinc-800/30 hover:bg-[#EC67A1]/10 hover:border-[#EC67A1]/40 transition-all group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-sidebar-foreground mb-1">{template.name}</p>
                              <p className="text-xs text-header-muted line-clamp-2 mb-2">{template.prompt}</p>
                              <div className="flex items-center gap-2 text-[10px]">
                                <span className="bg-zinc-200 dark:bg-zinc-700 rounded px-2 py-0.5 text-header-muted">{template.category}</span>
                                {template.resolution && <span className="bg-[#EC67A1]/20 rounded px-2 py-0.5 text-[#EC67A1]">{template.resolution}</span>}
                                {template.aspectRatio && <span className="bg-[#5DC3F8]/20 rounded px-2 py-0.5 text-[#5DC3F8]">{template.aspectRatio}</span>}
                              </div>
                            </div>
                            <Check className="w-4 h-4 text-[#EC67A1] opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="relative">
                  <div className="pointer-events-none absolute inset-0 rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-gradient-to-b from-[#EC67A1]/5 to-transparent" />
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Design a moody cinematic still of..."
                    className="relative w-full rounded-2xl border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-white dark:bg-[#1a1625]/50 px-4 py-4 text-sm text-sidebar-foreground placeholder-header-muted focus:border-[#EC67A1] focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/40"
                    rows={4}
                    disabled={isGenerating}
                  />
                </div>
                
                {/* Character Counter */}
                <div className="flex items-center justify-between text-xs">
                  <p className="text-header-muted">Keep it tight & vivid. Under 600 words works best.</p>
                  <div className={`font-mono ${
                    prompt.length === 0 ? 'text-header-muted' :
                    prompt.length < 400 ? 'text-emerald-500' :
                    prompt.length < 600 ? 'text-amber-500' :
                    'text-red-500'
                  }`}>
                    {prompt.length}/600
                    {prompt.length > 500 && prompt.length <= 600 && ' ⚠️'}
                    {prompt.length > 600 && ' 🚫 Too long!'}
                  </div>
                </div>
              </div>

              {/* User Presets */}
              {userPresets.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-header-muted uppercase tracking-wider">Your Presets</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {userPresets.map((preset) => (
                      <div key={preset.id} className="group relative">
                        <button
                          onClick={() => loadPreset(preset)}
                          className="w-full text-left p-3 rounded-xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 hover:bg-[#EC67A1]/10 hover:border-[#EC67A1]/40 transition-all"
                        >
                          <p className="text-sm font-semibold text-sidebar-foreground mb-1">{preset.name}</p>
                          <div className="flex flex-wrap gap-1 text-[10px]">
                            <span className="bg-[#EC67A1]/20 text-[#EC67A1] rounded px-1.5 py-0.5">{preset.resolution}</span>
                            <span className="bg-[#5DC3F8]/20 text-[#5DC3F8] rounded px-1.5 py-0.5">{preset.aspectRatio}</span>
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePreset(preset.id);
                          }}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500/90 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          title="Delete preset"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolution & Aspect Ratio Configuration */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setSectionsCollapsed(prev => ({ ...prev, framing: !prev.framing }))}
                  className="flex items-center justify-between w-full group"
                >
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-[#EC67A1]" />
                    <p className="text-sm font-semibold text-sidebar-foreground">Framing</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-header-muted transition-transform lg:opacity-0 ${sectionsCollapsed.framing ? '' : 'rotate-180'}`} />
                </button>

                <div className={`space-y-3 ${sectionsCollapsed.framing ? 'hidden lg:block' : ''}`}>

                <div className="grid grid-cols-2 gap-3">
                  {["2K", "4K"].map((res) => (
                    <button
                      key={res}
                      onClick={() => setSelectedResolution(res as "2K" | "4K")}
                      className={`group flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                        selectedResolution === res
                          ? "border-[#EC67A1]/60 bg-[#EC67A1]/10 shadow-lg shadow-[#EC67A1]/20"
                          : "border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 hover:border-[#EC67A1]/40"
                      }`}
                      disabled={isGenerating}
                    >
                      <div>
                        <p className="text-xs text-header-muted">Resolution</p>
                        <p className="text-lg font-semibold text-sidebar-foreground">{res}</p>
                      </div>
                      <div className="rounded-xl bg-zinc-200 dark:bg-zinc-700 px-3 py-1 text-[11px] text-header-muted">
                        {res === "2K" ? "Faster" : "Detail"}
                      </div>
                    </button>
                  ))}
                </div>

                <p className="text-xs text-header-muted">Aspect Ratio</p>
                <div className="grid grid-cols-4 gap-2">
                  {aspectRatios.map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setSelectedRatio(ratio)}
                      className={`rounded-xl border px-2 py-2 text-sm font-semibold transition ${
                        selectedRatio === ratio
                          ? "border-[#5DC3F8]/70 bg-[#5DC3F8]/10 text-[#5DC3F8] shadow-sm shadow-[#5DC3F8]/20"
                          : "border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 text-sidebar-foreground hover:border-[#5DC3F8]/40"
                      }`}
                      disabled={isGenerating}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-3 py-2">
                    <p className="text-[11px] text-header-muted">Width</p>
                    <p className="text-lg font-semibold text-sidebar-foreground">{currentSize.split('x')[0]}</p>
                  </div>
                  <div className="rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-3 py-2">
                    <p className="text-[11px] text-header-muted">Height</p>
                    <p className="text-lg font-semibold text-sidebar-foreground">{currentSize.split('x')[1]}</p>
                  </div>
                </div>

                {/* Save as Preset Button */}
                <button
                  type="button"
                  onClick={() => setShowPresetModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-dashed border-[#EC67A1]/40 bg-[#EC67A1]/5 hover:bg-[#EC67A1]/10 text-[#EC67A1] text-sm font-medium transition-colors"
                  disabled={isGenerating}
                >
                  <Sparkles className="w-4 h-4" />
                  Save Current Settings as Preset
                </button>
              </div>
              </div>

              {/* Folder Selection */}
              <div className="space-y-3" id="folder-section">
                <button
                  type="button"
                  onClick={() => setSectionsCollapsed(prev => ({ ...prev, vault: !prev.vault }))}
                  className="flex items-center justify-between w-full group"
                >
                  <div className="flex items-center gap-2">
                    <Archive className="w-4 h-4 text-[#EC67A1]" />
                    <p className="text-sm font-semibold text-sidebar-foreground">Save to Vault</p>
                    {!targetFolder && showFolderValidation && (
                      <span className="text-xs bg-red-500/20 text-red-500 px-2 py-1 rounded-full animate-pulse">⚠️ Required</span>
                    )}
                    {isLoadingVaultData && (
                      <Loader2 className="w-3 h-3 animate-spin text-[#EC67A1]" />
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-header-muted transition-transform lg:opacity-0 ${sectionsCollapsed.vault ? '' : 'rotate-180'}`} />
                </button>
                
                <div className={`space-y-3 ${sectionsCollapsed.vault ? 'hidden lg:block' : ''}`}>
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
                  label="Save to Vault Folder"
                />
              </div>
              </div>

              {/* Batch Size */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setSectionsCollapsed(prev => ({ ...prev, batch: !prev.batch }))}
                  className="flex items-center justify-between w-full group"
                >
                  <p className="text-sm font-semibold text-sidebar-foreground">Batch Size</p>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#EC67A1]/20 px-3 py-1 text-[11px] text-[#EC67A1]">{maxImages} total</span>
                    <ChevronDown className={`w-4 h-4 text-header-muted transition-transform lg:opacity-0 ${sectionsCollapsed.batch ? '' : 'rotate-180'}`} />
                  </div>
                </button>

                <div className={`space-y-3 ${sectionsCollapsed.batch ? 'hidden lg:block' : ''}`}>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={maxImages}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMaxImages(value);
                    setEnableBatchGeneration(value > 1);
                  }}
                  className="w-full accent-[#EC67A1]"
                  disabled={isGenerating}
                />
                <div className="flex items-center justify-between text-[11px] text-header-muted">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                </div>
                {/* Dynamic Helper Text */}
                {maxImages === 1 ? (
                  <p className="text-xs text-header-muted text-center">
                    Perfect for single hero shots or focused compositions.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-2xl border border-[#EC67A1]/30 bg-[#EC67A1]/10 p-3 space-y-2">
                      <p className="text-xs font-semibold text-[#EC67A1]">✓ Batch Generation Checklist:</p>
                      <div className="space-y-1 text-xs text-sidebar-foreground">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={prompt.toLowerCase().includes(maxImages.toString()) || prompt.toLowerCase().includes(['two', 'three', 'four', 'five'][maxImages - 2] || '')}
                            readOnly
                            className="rounded border-[#EC67A1]/50 accent-[#EC67A1]"
                          />
                          <span>Mention {maxImages} images in prompt</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={prompt.toLowerCase().includes('consistent') || prompt.toLowerCase().includes('cohesive') || prompt.toLowerCase().includes('same')}
                            readOnly
                            className="rounded border-[#EC67A1]/50 accent-[#EC67A1]"
                          />
                          <span>Describe relationship/consistency</span>
                        </label>
                      </div>
                    </div>
                    <p className="text-xs text-header-muted text-center">
                      Example: "Generate {maxImages} cohesive frames with consistent lighting and palette"
                    </p>
                  </div>
                )}
                <div className="rounded-2xl border border-[#5DC3F8]/30 bg-[#5DC3F8]/10 p-3 text-xs text-[#5DC3F8]">
                  💡 Max 5 images per batch. For more, run multiple batches.
                </div>
              </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <p className="text-sm text-red-500">{error}</p>
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

              {/* Action Buttons - Sticky on Mobile */}
              <div className="sticky bottom-4 lg:static grid grid-cols-[1.6fr_0.4fr] gap-3 z-10">
                <button
                  onClick={handleGenerate}
                  disabled={hasActiveGeneration || !prompt.trim() || !canGenerate}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EC67A1] to-[#F774B9] px-6 py-3 font-semibold text-white shadow-xl shadow-[#EC67A1]/30 transition hover:-translate-y-0.5 hover:from-[#E1518E] hover:to-[#EC67A1] disabled:from-zinc-500 disabled:to-zinc-500 disabled:shadow-none"
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 transition group-hover:opacity-10" />
                  <div className="relative flex items-center justify-center gap-2">
                    {hasActiveGeneration ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Generating</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        <span>Generate</span>
                      </>
                    )}
                  </div>
                </button>
                <button
                  onClick={handleReset}
                  disabled={isGenerating}
                  className="rounded-2xl border border-[#EC67A1]/20 bg-zinc-100 dark:bg-zinc-800 px-4 py-3 text-sm font-semibold text-sidebar-foreground transition hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-60"
                  title="Reset form"
                >
                  <RotateCcw className="w-4 h-4 inline mr-2" />
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-[#F8F8F8] dark:bg-zinc-800/50 p-6 shadow-2xl shadow-[#EC67A1]/10 dark:shadow-[#EC67A1]/20 backdrop-blur">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="flex items-center gap-2 rounded-full border border-[#EC67A1]/20 bg-[#EC67A1]/10 px-3 py-1 text-sm font-semibold text-[#EC67A1]">
                  <ImageIcon className="w-4 h-4" />
                  Generated Images
                </div>
                {generatedImages.length > 0 && (
                  <div className="rounded-full bg-[#EC67A1]/20 px-3 py-1 text-xs text-[#EC67A1]">
                    {generatedImages.length} {generatedImages.length === 1 ? 'image' : 'images'} ready
                  </div>
                )}
              </div>

              {/* Generated Images Grid */}
              {generatedImages.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {generatedImages.map((image) => (
                    <div
                      key={image.id}
                      className="group relative overflow-hidden rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 shadow-lg shadow-[#EC67A1]/10 transition hover:-translate-y-1 hover:shadow-2xl"
                    >
                      <div className="relative">
                        <img
                          src={image.imageUrl}
                          alt={image.prompt}
                          className="w-full h-full object-cover transition duration-700 group-hover:scale-[1.02]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition group-hover:opacity-100" />
                        <div className="absolute bottom-0 left-0 right-0 p-4 opacity-0 transition duration-300 group-hover:opacity-100">
                          <div className="mb-3 text-xs text-white line-clamp-2">{image.prompt}</div>
                          <div className="flex items-center gap-2 text-[11px] text-white/80">
                            <span className="rounded-full bg-white/20 px-3 py-1">{image.size}</span>
                            <span className="rounded-full bg-white/20 px-3 py-1">{image.modelVersion}</span>
                          </div>
                          <button
                            onClick={() => handleDownload(image.imageUrl, `seedream-${image.id}.jpg`)}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#EC67A1] to-[#F774B9] px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-[#E1518E] hover:to-[#EC67A1]"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                        </div>
                        {image.size && (
                          <div className="absolute top-3 right-3 rounded-full bg-white dark:bg-zinc-800 px-3 py-1 text-[11px] font-semibold text-sidebar-foreground">
                            {image.size}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#EC67A1]/30 bg-white dark:bg-zinc-800/30 py-16">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EC67A1]/10">
                    <ImageIcon className="w-7 h-7 text-[#EC67A1]" />
                  </div>
                  <p className="text-sm text-header-muted">
                    {isGenerating ? 'Generating your images...' : 'Your outputs will land here.'}
                  </p>
                </div>
              )}

              {/* Generation History */}
              <div className="mt-8 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sidebar-foreground">
                    <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                    <h3 className="text-sm font-semibold">Recent Generations</h3>
                    {generationHistory.length > 0 && (
                      <span className="text-xs text-header-muted">({generationHistory.length})</span>
                    )}
                  </div>
                  {generationHistory.length > 8 && (
                    <button
                      onClick={() => setShowHistoryModal(true)}
                      className="text-xs text-[#EC67A1] hover:text-[#E1518E] transition flex items-center gap-1"
                    >
                      View All
                      <span className="bg-[#EC67A1]/20 rounded-full px-2 py-0.5">{generationHistory.length}</span>
                    </button>
                  )}
                </div>
                {generationHistory.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {generationHistory.slice(0, 8).map((image) => (
                      <button
                        key={image.id}
                        className="group relative aspect-square overflow-hidden rounded-xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 shadow-md shadow-[#EC67A1]/10 transition hover:-translate-y-1 hover:border-[#EC67A1]/40"
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
                              // Hide broken image and show placeholder
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const placeholder = target.nextElementSibling as HTMLElement;
                              if (placeholder) placeholder.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className={`absolute inset-0 flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800/50 ${image.imageUrl ? 'hidden' : 'flex'}`}
                        >
                          <ImageIcon className="w-8 h-8 text-header-muted mb-2" />
                          <span className="text-xs text-header-muted px-2 text-center line-clamp-2">{image.prompt?.slice(0, 50) || 'Image'}</span>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 transition group-hover:opacity-100" />
                        <div className="absolute bottom-2 left-2 right-2 text-left text-[11px] text-white line-clamp-2 opacity-0 transition group-hover:opacity-100">
                          {image.prompt}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-4 py-3 text-sm text-header-muted">
                    <span>{isLoadingHistory ? 'Loading history...' : 'No previous generations yet'}</span>
                    {isLoadingHistory && <RefreshCw className="w-4 h-4 animate-spin text-[#EC67A1]" />}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowHelpModal(false)}
        >
          <div 
            className="relative w-full max-w-4xl max-h-[90vh] overflow-auto my-8 rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowHelpModal(false)}
              className="sticky top-4 float-right mr-4 z-10 rounded-full bg-zinc-100 dark:bg-zinc-800 p-2 text-sidebar-foreground transition hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-gradient-to-br from-[#EC67A1] to-[#F774B9]">
                  <Info className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-sidebar-foreground">SeeDream 4.5 — Guide</h2>
              </div>

              <div className="space-y-8 text-sidebar-foreground">
                {/* Prompting Tips */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-[#EC67A1]">
                    <Sparkles className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">How to write better prompts</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 p-4">
                      <p className="text-sm font-semibold">✨ Recommended structure</p>
                      <p className="text-sm text-header-muted">Subject + Action + Environment + Style/Details</p>
                      <p className="mt-2 text-sm text-header-muted">
                        Example: "Vibrant close-up editorial portrait, model with piercing gaze, wearing a sculptural hat, rich color blocking, sharp focus on eyes, shallow depth of field, Vogue magazine cover aesthetic, shot on medium format, dramatic studio lighting."
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4">
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">✓ Good practices</p>
                        <ul className="mt-2 space-y-1 text-sm text-emerald-700 dark:text-emerald-200 list-disc list-inside">
                          <li>Coherent natural language</li>
                          <li>Stay under 600 words</li>
                          <li>Include style, color, lighting</li>
                          <li>Describe composition details</li>
                          <li>Be explicit about intent</li>
                        </ul>
                      </div>
                      <div className="rounded-2xl border border-red-300/40 bg-red-400/10 p-4">
                        <p className="text-sm font-semibold text-red-600 dark:text-red-300">✗ Avoid</p>
                        <ul className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-200 list-disc list-inside">
                          <li>Overlong prompts (600+ words)</li>
                          <li>Conflicting styles or directions</li>
                          <li>Vague descriptions</li>
                          <li>Unrelated scene jumps</li>
                        </ul>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-300/40 bg-amber-400/10 p-4">
                      <p className="text-sm font-semibold text-amber-600 dark:text-amber-300">💡 Batch tip</p>
                      <p className="text-sm text-amber-700 dark:text-amber-200">
                        When requesting multiple images, spell out the relationship: "Generate 4 cohesive frames of the same courtyard across the four seasons, consistent palette and camera angle."
                      </p>
                    </div>
                  </div>
                </section>

                {/* Parameters Explanation */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-[#EC67A1]">
                    <Settings className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Parameter guide</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 p-4">
                      <h4 className="text-sm font-semibold text-sidebar-foreground mb-1">📐 Resolution & ratio</h4>
                      <p className="text-sm text-header-muted">2K is faster; 4K is detail-first. Ratios: square (1:1), landscape (16:9), portrait (9:16), and cinematic (21:9).</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 p-4">
                      <h4 className="text-sm font-semibold text-sidebar-foreground mb-1">🎨 Batch size</h4>
                      <p className="text-sm text-header-muted">Use 1 for the hero shot, 2-5 for variations. For more, run multiple batches.</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 p-4">
                      <h4 className="text-sm font-semibold text-sidebar-foreground mb-1">📁 Save to folder</h4>
                      <p className="text-sm text-header-muted">Organize outputs into custom S3 folders; default is your root outputs.</p>
                    </div>
                  </div>
                </section>

                {/* Example Use Cases */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-[#EC67A1]">
                    <Zap className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Example use cases</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-purple-300/40 bg-purple-500/10 p-4">
                      <p className="text-sm font-semibold text-purple-600 dark:text-purple-300">🎬 Comic / storyboard</p>
                      <p className="text-sm text-purple-700 dark:text-purple-200">Batch 4-8 frames; keep camera angle and palette consistent.</p>
                    </div>
                    <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4">
                      <p className="text-sm font-semibold text-amber-600 dark:text-amber-300">🎨 Product viz</p>
                      <p className="text-sm text-amber-700 dark:text-amber-200">Batch 4-6 angles; specify lighting and material callouts.</p>
                    </div>
                    <div className="rounded-2xl border border-teal-300/40 bg-teal-500/10 p-4">
                      <p className="text-sm font-semibold text-teal-600 dark:text-teal-300">📸 Editorial</p>
                      <p className="text-sm text-teal-700 dark:text-teal-200">Batch 1-3 hero shots; define mood, lens, and lighting.</p>
                    </div>
                  </div>
                </section>

                {/* Important Notes */}
                <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 p-4 text-sm text-header-muted">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-300 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <p className="font-semibold">Notes</p>
                  </div>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Images save automatically to S3.</li>
                    <li>4K takes longer but rewards detail.</li>
                    <li>Batch coherence improves with consistent phrasing.</li>
                  </ul>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4"
          onClick={() => {
            setShowImageModal(false);
            setSelectedImage(null);
          }}
        >
          <div 
            className="relative w-full max-w-3xl max-h-[85vh] overflow-auto rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => {
                setShowImageModal(false);
                setSelectedImage(null);
              }}
              className="absolute top-4 right-4 z-10 rounded-full bg-zinc-100 dark:bg-zinc-800 p-2 text-sidebar-foreground transition hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Image container */}
            <div className="p-6 space-y-4 text-sidebar-foreground">
              <div className="rounded-2xl border border-modal-border bg-modal-bg overflow-hidden max-h-[60vh] flex items-center justify-center">
                <img
                  src={selectedImage.imageUrl}
                  alt={selectedImage.prompt}
                  className="w-full h-auto max-h-[60vh] object-contain"
                />
              </div>

              {/* Image details */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-[#EC67A1]">
                  <Info className="w-4 h-4" />
                  <h3 className="text-base font-semibold">Image details</h3>
                </div>
                <div className="space-y-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-header-muted">Prompt</p>
                  <p className="text-sm text-sidebar-foreground leading-relaxed">{selectedImage.prompt}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-header-muted">
                    <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1">Size: {selectedImage.size}</span>
                    <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1">Model: {selectedImage.modelVersion}</span>
                  </div>
                </div>

                {/* Download button */}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const imageUrl = selectedImage.imageUrl;
                      let blobUrl: string;
                      
                      if (imageUrl.startsWith('data:')) {
                        // Data URLs can be used directly
                        blobUrl = imageUrl;
                      } else {
                        // Use proxy endpoint to avoid CORS issues
                        const proxyUrl = `/api/download/image?url=${encodeURIComponent(imageUrl)}`;
                        const response = await fetch(proxyUrl);
                        
                        if (!response.ok) {
                          throw new Error(`Failed to download image: ${response.status}`);
                        }
                        
                        const blob = await response.blob();
                        blobUrl = window.URL.createObjectURL(blob);
                      }
                      
                      // Trigger download
                      const a = document.createElement('a');
                      a.style.display = 'none';
                      a.href = blobUrl;
                      a.download = `seedream-${selectedImage.id}.jpg`;
                      document.body.appendChild(a);
                      a.click();
                      
                      // Cleanup
                      setTimeout(() => {
                        document.body.removeChild(a);
                        if (!imageUrl.startsWith('data:')) {
                          window.URL.revokeObjectURL(blobUrl);
                        }
                      }, 100);
                    } catch (error) {
                      console.error("Download failed:", error);
                      alert('Download failed. Please try again or contact support if the issue persists.');
                    }
                  }}
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#EC67A1]/30 transition hover:-translate-y-0.5"
                >
                  <Download className="w-4 h-4" />
                  Download image
                </button>

                {/* Reuse button */}
                <button
                  type="button"
                  onClick={() => handleReuseSettings(selectedImage)}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 px-4 py-3 text-sm font-semibold text-sidebar-foreground shadow-lg transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:-translate-y-0.5"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowHistoryModal(false)}
        >
          <div 
            className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#EC67A1]/20">
                  <RefreshCw className="w-5 h-5 text-[#EC67A1]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-sidebar-foreground">Generation History</h2>
                  <p className="text-xs text-header-muted">{generationHistory.length} images generated</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="rounded-full bg-zinc-100 dark:bg-zinc-800 p-2 text-sidebar-foreground transition hover:bg-zinc-200 dark:hover:bg-zinc-700"
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
                      className="group relative aspect-square overflow-hidden rounded-xl border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-white dark:bg-zinc-800/30 shadow-md shadow-[#EC67A1]/10 transition hover:-translate-y-1 hover:border-[#EC67A1]/50"
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
                          <span className="bg-white/20 rounded px-1.5 py-0.5">{image.size}</span>
                          {isAllProfiles && image.profileName && (
                            <span className="bg-violet-500/30 text-violet-200 rounded px-1.5 py-0.5">{image.profileName}</span>
                          )}
                        </div>
                      </div>
                      {/* Date badge */}
                      <div className="absolute top-2 right-2 text-[9px] text-slate-300 bg-black/50 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition">
                        {new Date(image.createdAt).toLocaleDateString()}
                      </div>
                      {/* Profile badge for all profiles view */}
                      {isAllProfiles && image.profileName && (
                        <div className="absolute top-2 left-2 text-[9px] text-violet-200 bg-violet-600/60 rounded px-1.5 py-0.5">
                          {image.profileName}
                        </div>
                      )}
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

      {/* Save Preset Modal */}
      {showPresetModal && typeof window !== 'undefined' && document?.body && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowPresetModal(false)}
        >
          <div 
            className="relative w-full max-w-md rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPresetModal(false)}
              className="absolute top-4 right-4 rounded-full bg-zinc-100 dark:bg-zinc-800 p-2 text-sidebar-foreground transition hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-[#EC67A1]/20">
                  <Sparkles className="w-5 h-5 text-[#EC67A1]" />
                </div>
                <h2 className="text-xl font-bold text-sidebar-foreground">Save as Preset</h2>
              </div>
              <p className="text-sm text-header-muted">
                Save your current settings for quick access later
              </p>
            </div>

            <div className="space-y-4">
              {/* Current Settings Preview */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 p-4 space-y-2">
                <p className="text-xs font-semibold text-header-muted uppercase tracking-wider">Current Settings</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-[#EC67A1]/20 text-[#EC67A1] dark:text-[#F774B9] rounded-full px-3 py-1">{selectedResolution}</span>
                  <span className="bg-amber-500/20 text-amber-200 rounded-full px-3 py-1">{selectedRatio}</span>
                  <span className="bg-purple-500/20 text-purple-200 rounded-full px-3 py-1">
                    {enableWatermark ? 'Watermark ON' : 'Watermark OFF'}
                  </span>
                  {targetFolder && (
                    <span className="bg-emerald-500/20 text-emerald-200 rounded-full px-3 py-1">
                      Folder: {vaultFolders.find(f => f.id === targetFolder)?.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Preset Name Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-sidebar-foreground">Preset Name</label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g., My Instagram Preset"
                  className="w-full rounded-xl border border-modal-input-border bg-modal-input-bg px-4 py-3 text-sm text-modal-foreground placeholder-header-muted focus:border-[#5DC3F8] focus:outline-none focus:ring-2 focus:ring-[#5DC3F8]/40"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && presetName.trim()) {
                      saveAsPreset();
                    }
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPresetModal(false)}
                  className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 px-4 py-3 text-sm font-semibold text-sidebar-foreground transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAsPreset}
                  disabled={!presetName.trim()}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 disabled:from-zinc-400 disabled:to-zinc-400 disabled:shadow-none"
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
          ...(selectedResolution === '4K' ? [{
            label: '4K Resolution',
            multiplier: 1.5,
            description: '4K resolution costs 50% more credits than 2K'
          }] : []),
          ...(maxImages > 1 ? [{
            label: `Batch (${maxImages} images)`,
            multiplier: maxImages,
            description: `Generating ${maxImages} images in one batch`
          }] : []),
        ]}
        position="bottom-right"
      />
    </div>
  );
}
