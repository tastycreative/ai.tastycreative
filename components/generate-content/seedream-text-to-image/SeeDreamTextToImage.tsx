"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import VaultFolderDropdown, { VaultFolder } from "@/components/generate-content/shared/VaultFolderDropdown";
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
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();

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
    if (!apiClient) {
      setError("API client not available");
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
    
    const taskId = `seedream-${Date.now()}`;
    
    try {
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

      const response = await apiClient.post("/api/generate/seedream-text-to-image", payload);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Generation failed");
      }

      const data = await response.json();
      
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
      updateGlobalProgress({
        isGenerating: false,
        progress: 0,
        stage: "failed",
        message: error.message || "Generation failed",
        generationType: "text-to-image",
        jobId: taskId,
      });
      setTimeout(() => clearGlobalProgress(), 3000);
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
    <div className="relative min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute inset-x-10 top-20 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <div className="grid gap-4 md:grid-cols-[2fr_1fr] items-center">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-900/30 backdrop-blur">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 shadow-lg shadow-cyan-900/50">
                <Sparkles className="w-6 h-6 text-white" />
                <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Live Studio</p>
                <h1 className="text-3xl sm:text-4xl font-black text-white">SeeDream 4.5 — Text to Image</h1>
              </div>
            </div>
            <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed">
              Craft bold visuals with SeeDream 4.5 — tuned for cinematic clarity, color fidelity, and coherent batches. Pair ratios and resolution presets to hit the perfect look every time.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-200"><Zap className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-slate-300">Speed</p>
                  <p className="text-sm font-semibold text-white">Batch up to 5</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-200"><Sliders className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-slate-300">Control</p>
                  <p className="text-sm font-semibold text-white">Smart ratios</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200"><Download className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-slate-300">Output</p>
                  <p className="text-sm font-semibold text-white">4K ready</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="group inline-flex items-center gap-2 rounded-full bg-white text-slate-900 px-4 py-2 text-sm font-semibold shadow-lg shadow-cyan-900/20 transition hover:-translate-y-0.5 hover:shadow-xl"
                title="View Help & Tips"
              >
                <Info className="w-4 h-4" />
                Quick Guide
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs text-slate-300">Current size</p>
                <p className="text-lg font-semibold text-white">{currentSize}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs text-slate-300">Aspect</p>
                <p className="text-lg font-semibold text-white">{selectedRatio}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs text-slate-300">Resolution</p>
                <p className="text-lg font-semibold text-white">{selectedResolution}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Generation Controls */}
          <div className="lg:col-span-1">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-900/30 backdrop-blur space-y-6">
              {/* Prompt Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white">Prompt</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTemplates(!showTemplates)}
                      className="rounded-full bg-indigo-500/20 hover:bg-indigo-500/30 px-3 py-1 text-[11px] font-semibold text-indigo-100 transition-colors flex items-center gap-1"
                      disabled={isGenerating}
                    >
                      <Sparkles className="w-3 h-3" />
                      Templates
                    </button>
                    <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-[11px] font-semibold text-cyan-100">Required</span>
                  </div>
                </div>
                
                {/* Prompt Templates Dropdown */}
                {showTemplates && (
                  <div className="rounded-2xl border border-indigo-400/30 bg-indigo-950/40 backdrop-blur p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-indigo-200">Choose a template</p>
                      <button
                        onClick={() => setShowTemplates(false)}
                        className="text-indigo-300 hover:text-indigo-100 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid gap-2 max-h-60 overflow-y-auto">
                      {promptTemplates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => applyTemplate(template)}
                          className="text-left p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-indigo-300/40 transition-all group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white mb-1">{template.name}</p>
                              <p className="text-xs text-slate-300 line-clamp-2 mb-2">{template.prompt}</p>
                              <div className="flex items-center gap-2 text-[10px]">
                                <span className="bg-white/10 rounded px-2 py-0.5 text-slate-300">{template.category}</span>
                                {template.resolution && <span className="bg-cyan-500/20 rounded px-2 py-0.5 text-cyan-200">{template.resolution}</span>}
                                {template.aspectRatio && <span className="bg-amber-500/20 rounded px-2 py-0.5 text-amber-200">{template.aspectRatio}</span>}
                              </div>
                            </div>
                            <Check className="w-4 h-4 text-indigo-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="relative">
                  <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent" />
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Design a moody cinematic still of..."
                    className="relative w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                    rows={4}
                    disabled={isGenerating}
                  />
                </div>
                
                {/* Character Counter */}
                <div className="flex items-center justify-between text-xs">
                  <p className="text-slate-300">Keep it tight & vivid. Under 600 words works best.</p>
                  <div className={`font-mono ${
                    prompt.length === 0 ? 'text-slate-400' :
                    prompt.length < 400 ? 'text-emerald-400' :
                    prompt.length < 600 ? 'text-amber-400' :
                    'text-red-400'
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
                    <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Your Presets</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {userPresets.map((preset) => (
                      <div key={preset.id} className="group relative">
                        <button
                          onClick={() => loadPreset(preset)}
                          className="w-full text-left p-3 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 hover:from-white/10 hover:border-indigo-300/40 transition-all"
                        >
                          <p className="text-sm font-semibold text-white mb-1">{preset.name}</p>
                          <div className="flex flex-wrap gap-1 text-[10px]">
                            <span className="bg-cyan-500/20 text-cyan-200 rounded px-1.5 py-0.5">{preset.resolution}</span>
                            <span className="bg-amber-500/20 text-amber-200 rounded px-1.5 py-0.5">{preset.aspectRatio}</span>
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
                    <Settings className="w-4 h-4 text-cyan-300" />
                    <p className="text-sm font-semibold text-white">Framing</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform lg:opacity-0 ${sectionsCollapsed.framing ? '' : 'rotate-180'}`} />
                </button>

                <div className={`space-y-3 ${sectionsCollapsed.framing ? 'hidden lg:block' : ''}`}>

                <div className="grid grid-cols-2 gap-3">
                  {["2K", "4K"].map((res) => (
                    <button
                      key={res}
                      onClick={() => setSelectedResolution(res as "2K" | "4K")}
                      className={`group flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                        selectedResolution === res
                          ? "border-cyan-400/60 bg-cyan-500/10 shadow-lg shadow-cyan-900/40"
                          : "border-white/10 bg-white/5 hover:border-cyan-200/40"
                      }`}
                      disabled={isGenerating}
                    >
                      <div>
                        <p className="text-xs text-slate-300">Resolution</p>
                        <p className="text-lg font-semibold text-white">{res}</p>
                      </div>
                      <div className="rounded-xl bg-white/5 px-3 py-1 text-[11px] text-slate-200">
                        {res === "2K" ? "Faster" : "Detail"}
                      </div>
                    </button>
                  ))}
                </div>

                <p className="text-xs text-slate-300">Aspect Ratio</p>
                <div className="grid grid-cols-4 gap-2">
                  {aspectRatios.map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setSelectedRatio(ratio)}
                      className={`rounded-xl border px-2 py-2 text-sm font-semibold transition ${
                        selectedRatio === ratio
                          ? "border-amber-300/70 bg-amber-400/10 text-amber-100 shadow-sm shadow-amber-900/40"
                          : "border-white/10 bg-white/5 text-white hover:border-amber-200/40"
                      }`}
                      disabled={isGenerating}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[11px] text-slate-300">Width</p>
                    <p className="text-lg font-semibold text-white">{currentSize.split('x')[0]}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[11px] text-slate-300">Height</p>
                    <p className="text-lg font-semibold text-white">{currentSize.split('x')[1]}</p>
                  </div>
                </div>

                {/* Save as Preset Button */}
                <button
                  type="button"
                  onClick={() => setShowPresetModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-dashed border-indigo-400/40 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-200 text-sm font-medium transition-colors"
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
                    <Archive className="w-4 h-4 text-purple-300" />
                    <p className="text-sm font-semibold text-white">Save to Vault</p>
                    {!targetFolder && showFolderValidation && (
                      <span className="text-xs bg-red-500/20 text-red-200 px-2 py-1 rounded-full animate-pulse">⚠️ Required</span>
                    )}
                    {isLoadingVaultData && (
                      <Loader2 className="w-3 h-3 animate-spin text-purple-300" />
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform lg:opacity-0 ${sectionsCollapsed.vault ? '' : 'rotate-180'}`} />
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
                  <p className="text-sm font-semibold text-white">Batch Size</p>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-slate-200">{maxImages} total</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform lg:opacity-0 ${sectionsCollapsed.batch ? '' : 'rotate-180'}`} />
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
                  className="w-full accent-cyan-400"
                  disabled={isGenerating}
                />
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                </div>
                {/* Dynamic Helper Text */}
                {maxImages === 1 ? (
                  <p className="text-xs text-slate-300 text-center">
                    Perfect for single hero shots or focused compositions.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 p-3 space-y-2">
                      <p className="text-xs font-semibold text-cyan-50">✓ Batch Generation Checklist:</p>
                      <div className="space-y-1 text-xs text-cyan-50/90">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={prompt.toLowerCase().includes(maxImages.toString()) || prompt.toLowerCase().includes(['two', 'three', 'four', 'five'][maxImages - 2] || '')}
                            readOnly
                            className="rounded border-cyan-300/50"
                          />
                          <span>Mention {maxImages} images in prompt</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={prompt.toLowerCase().includes('consistent') || prompt.toLowerCase().includes('cohesive') || prompt.toLowerCase().includes('same')}
                            readOnly
                            className="rounded border-cyan-300/50"
                          />
                          <span>Describe relationship/consistency</span>
                        </label>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 text-center">
                      Example: "Generate {maxImages} cohesive frames with consistent lighting and palette"
                    </p>
                  </div>
                )}
                <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-3 text-xs text-amber-50">
                  💡 Max 5 images per batch. For more, run multiple batches.
                </div>
              </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
                  <AlertCircle className="h-5 w-5 text-red-200" />
                  <p className="text-sm text-red-50">{error}</p>
                </div>
              )}

              {/* Action Buttons - Sticky on Mobile */}
              <div className="sticky bottom-4 lg:static grid grid-cols-[1.6fr_0.4fr] gap-3 z-10">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 px-6 py-3 font-semibold text-white shadow-xl shadow-cyan-900/40 transition hover:-translate-y-0.5 disabled:from-slate-500 disabled:to-slate-500 disabled:shadow-none"
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 transition group-hover:opacity-10" />
                  <div className="relative flex items-center justify-center gap-2">
                    {isGenerating ? (
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
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-cyan-200/40 disabled:opacity-60"
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
            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-cyan-900/30 backdrop-blur">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-white">
                  <ImageIcon className="w-4 h-4" />
                  Generated Images
                </div>
                {generatedImages.length > 0 && (
                  <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
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
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-cyan-900/30 transition hover:-translate-y-1 hover:shadow-2xl"
                    >
                      <div className="relative">
                        <img
                          src={image.imageUrl}
                          alt={image.prompt}
                          className="w-full h-full object-cover transition duration-700 group-hover:scale-[1.02]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition group-hover:opacity-100" />
                        <div className="absolute bottom-0 left-0 right-0 p-4 opacity-0 transition duration-300 group-hover:opacity-100">
                          <div className="mb-3 text-xs text-slate-200 line-clamp-2">{image.prompt}</div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-200/80">
                            <span className="rounded-full bg-white/10 px-3 py-1">{image.size}</span>
                            <span className="rounded-full bg-white/10 px-3 py-1">{image.modelVersion}</span>
                          </div>
                          <button
                            onClick={() => handleDownload(image.imageUrl, `seedream-${image.id}.jpg`)}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-md transition hover:bg-white"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                        </div>
                        {image.size && (
                          <div className="absolute top-3 right-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-900">
                            {image.size}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/5 py-16">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                    <ImageIcon className="w-7 h-7 text-cyan-200" />
                  </div>
                  <p className="text-sm text-slate-200/80">
                    {isGenerating ? 'Generating your images...' : 'Your outputs will land here.'}
                  </p>
                </div>
              )}

              {/* Generation History */}
              <div className="mt-8 space-y-3">
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
                      className="text-xs text-cyan-300 hover:text-cyan-200 transition flex items-center gap-1"
                    >
                      View All
                      <span className="bg-cyan-500/20 rounded-full px-2 py-0.5">{generationHistory.length}</span>
                    </button>
                  )}
                </div>
                {generationHistory.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {generationHistory.slice(0, 8).map((image) => (
                      <button
                        key={image.id}
                        className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-md shadow-cyan-900/20 transition hover:-translate-y-1 hover:border-cyan-200/40"
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
                    {isLoadingHistory && <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" />}
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
            className="relative w-full max-w-4xl max-h-[90vh] overflow-auto my-8 rounded-3xl border border-white/10 bg-slate-950/90 shadow-2xl shadow-cyan-900/40 backdrop-blur"
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
                <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600">
                  <Info className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white">SeeDream 4.5 — Guide</h2>
              </div>

              <div className="space-y-8 text-slate-100">
                {/* Prompting Tips */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-cyan-200">
                    <Sparkles className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">How to write better prompts</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold">✨ Recommended structure</p>
                      <p className="text-sm text-slate-200/80">Subject + Action + Environment + Style/Details</p>
                      <p className="mt-2 text-sm text-slate-300">
                        Example: "Vibrant close-up editorial portrait, model with piercing gaze, wearing a sculptural hat, rich color blocking, sharp focus on eyes, shallow depth of field, Vogue magazine cover aesthetic, shot on medium format, dramatic studio lighting."
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4">
                        <p className="text-sm font-semibold text-emerald-50">✓ Good practices</p>
                        <ul className="mt-2 space-y-1 text-sm text-emerald-50/90 list-disc list-inside">
                          <li>Coherent natural language</li>
                          <li>Stay under 600 words</li>
                          <li>Include style, color, lighting</li>
                          <li>Describe composition details</li>
                          <li>Be explicit about intent</li>
                        </ul>
                      </div>
                      <div className="rounded-2xl border border-red-300/40 bg-red-400/10 p-4">
                        <p className="text-sm font-semibold text-red-50">✗ Avoid</p>
                        <ul className="mt-2 space-y-1 text-sm text-red-50/90 list-disc list-inside">
                          <li>Overlong prompts (600+ words)</li>
                          <li>Conflicting styles or directions</li>
                          <li>Vague descriptions</li>
                          <li>Unrelated scene jumps</li>
                        </ul>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-300/40 bg-amber-400/10 p-4">
                      <p className="text-sm font-semibold text-amber-50">💡 Batch tip</p>
                      <p className="text-sm text-amber-50/90">
                        When requesting multiple images, spell out the relationship: "Generate 4 cohesive frames of the same courtyard across the four seasons, consistent palette and camera angle."
                      </p>
                    </div>
                  </div>
                </section>

                {/* Parameters Explanation */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-cyan-200">
                    <Settings className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Parameter guide</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <h4 className="text-sm font-semibold text-white mb-1">📐 Resolution & ratio</h4>
                      <p className="text-sm text-slate-200/80">2K is faster; 4K is detail-first. Ratios: square (1:1), landscape (16:9), portrait (9:16), and cinematic (21:9).</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <h4 className="text-sm font-semibold text-white mb-1">🎨 Batch size</h4>
                      <p className="text-sm text-slate-200/80">Use 1 for the hero shot, 2-5 for variations. For more, run multiple batches.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <h4 className="text-sm font-semibold text-white mb-1">📁 Save to folder</h4>
                      <p className="text-sm text-slate-200/80">Organize outputs into custom S3 folders; default is your root outputs.</p>
                    </div>
                  </div>
                </section>

                {/* Example Use Cases */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-cyan-200">
                    <Zap className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Example use cases</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-purple-300/40 bg-purple-500/10 p-4">
                      <p className="text-sm font-semibold text-purple-50">🎬 Comic / storyboard</p>
                      <p className="text-sm text-purple-50/80">Batch 4-8 frames; keep camera angle and palette consistent.</p>
                    </div>
                    <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4">
                      <p className="text-sm font-semibold text-amber-50">🎨 Product viz</p>
                      <p className="text-sm text-amber-50/80">Batch 4-6 angles; specify lighting and material callouts.</p>
                    </div>
                    <div className="rounded-2xl border border-teal-300/40 bg-teal-500/10 p-4">
                      <p className="text-sm font-semibold text-teal-50">📸 Editorial</p>
                      <p className="text-sm text-teal-50/80">Batch 1-3 hero shots; define mood, lens, and lighting.</p>
                    </div>
                  </div>
                </section>

                {/* Important Notes */}
                <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                  <div className="flex items-center gap-2 text-amber-200 mb-2">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4"
          onClick={() => {
            setShowImageModal(false);
            setSelectedImage(null);
          }}
        >
          <div 
            className="relative w-full max-w-3xl max-h-[85vh] overflow-auto rounded-3xl border border-white/10 bg-slate-950/90 shadow-2xl shadow-cyan-900/40 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => {
                setShowImageModal(false);
                setSelectedImage(null);
              }}
              className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Image container */}
            <div className="p-6 space-y-4 text-slate-100">
              <div className="rounded-2xl border border-white/10 bg-slate-900 overflow-hidden max-h-[60vh] flex items-center justify-center">
                <img
                  src={selectedImage.imageUrl}
                  alt={selectedImage.prompt}
                  className="w-full h-auto max-h-[60vh] object-contain"
                />
              </div>

              {/* Image details */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-cyan-200">
                  <Info className="w-4 h-4" />
                  <h3 className="text-base font-semibold">Image details</h3>
                </div>
                <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Prompt</p>
                  <p className="text-sm text-slate-100 leading-relaxed">{selectedImage.prompt}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-200/80">
                    <span className="rounded-full bg-white/10 px-3 py-1">Size: {selectedImage.size}</span>
                    <span className="rounded-full bg-white/10 px-3 py-1">Model: {selectedImage.modelVersion}</span>
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
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/40 transition hover:-translate-y-0.5"
                >
                  <Download className="w-4 h-4" />
                  Download image
                </button>

                {/* Reuse button */}
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
            className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-cyan-900/40 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/95 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                  <RefreshCw className="w-5 h-5 text-cyan-400" />
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
                      className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-md shadow-cyan-900/20 transition hover:-translate-y-1 hover:border-cyan-200/40"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4"
          onClick={() => setShowPresetModal(false)}
        >
          <div 
            className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-indigo-900/40 backdrop-blur p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPresetModal(false)}
              className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Save as Preset</h2>
              </div>
              <p className="text-sm text-slate-300">
                Save your current settings for quick access later
              </p>
            </div>

            <div className="space-y-4">
              {/* Current Settings Preview */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Current Settings</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-cyan-500/20 text-cyan-200 rounded-full px-3 py-1">{selectedResolution}</span>
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
                <label className="text-sm font-semibold text-white">Preset Name</label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g., My Instagram Preset"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
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
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAsPreset}
                  disabled={!presetName.trim()}
                  className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 disabled:from-slate-500 disabled:to-slate-500 disabled:shadow-none"
                >
                  Save Preset
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
