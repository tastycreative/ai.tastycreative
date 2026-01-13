"use client";

import { useState, useEffect, useCallback } from "react";import { createPortal } from "react-dom";import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import {
  ImageIcon,
  Download,
  Loader2,
  AlertCircle,
  Sparkles,
  RotateCcw,
  Zap,
  Upload,
  X,
  Folder,
  ChevronDown,
  RefreshCw,
  Info,
  Settings,
  User,
  Archive,
} from "lucide-react";

interface AvailableFolderOption {
  name: string;
  prefix: string;
  displayPath: string;
  path: string;
  depth: number;
  isShared?: boolean;
  permission?: 'VIEW' | 'EDIT';
  parentPrefix?: string | null;
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

// Combined folder type for the unified dropdown
type FolderType = 's3' | 'vault';

interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  modelVersion: string;
  size: string;
  createdAt: string;
  status: "completed" | "processing" | "failed";
}

export default function SeeDreamImageToImage() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();

  // Form State
  const [prompt, setPrompt] = useState("");
  const [selectedResolution, setSelectedResolution] = useState<"2K" | "4K">("2K");
  const [selectedRatio, setSelectedRatio] = useState<"1:1" | "3:4" | "4:3" | "16:9" | "9:16" | "2:3" | "3:2" | "21:9">("1:1");
  const [uploadedImages, setUploadedImages] = useState<Array<{ id: string; base64: string; file: File }>>([
  ]);
  const [maxImages, setMaxImages] = useState(1);

  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // History State
  const [generationHistory, setGenerationHistory] = useState<GeneratedImage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Modal state for viewing images
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  
  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Folder Selection State
  const [targetFolder, setTargetFolder] = useState<string>("");
  const [folderType, setFolderType] = useState<FolderType>('s3');
  const [availableFolders, setAvailableFolders] = useState<AvailableFolderOption[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  // Vault Integration State
  const [vaultProfiles, setVaultProfiles] = useState<InstagramProfile[]>([]);
  const [vaultFoldersByProfile, setVaultFoldersByProfile] = useState<Record<string, VaultFolder[]>>({});
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);

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

  // Get current size based on resolution and ratio
  const currentSize = resolutionRatios[selectedResolution][selectedRatio];

  // Load generation history when apiClient is available
  useEffect(() => {
    if (apiClient) {
      loadGenerationHistory();
    }
  }, [apiClient]);

  const loadGenerationHistory = async () => {
    if (!apiClient) return;
    setIsLoadingHistory(true);
    try {
      const response = await apiClient.get("/api/generate/seedream-image-to-image");
      if (response.ok) {
        const data = await response.json();
        setGenerationHistory(data.images || []);
      }
    } catch (error) {
      // Silently fail if endpoint doesn't exist yet
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadFolders = useCallback(async () => {
    if (!apiClient || !user) return;

    setIsLoadingFolders(true);
    try {
      const response = await apiClient.get('/api/s3/folders/list-custom');
      if (!response.ok) {
        throw new Error('Failed to load folders');
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.folders)) {
        const folderOptions: AvailableFolderOption[] = data.folders
          .filter((folder: any) => !folder.permission || folder.permission === 'EDIT')
          .map((folder: any) => ({
            name: folder.name || '',
            prefix: folder.prefix || '',
            displayPath: folder.path || folder.name || '',
            path: folder.path || '',
            depth: folder.depth || 0,
            isShared: folder.isShared || false,
            permission: folder.permission,
            parentPrefix: folder.parentPrefix,
          }));

        setAvailableFolders(folderOptions);
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
    } finally {
      setIsLoadingFolders(false);
    }
  }, [apiClient, user]);

  // Load folders on mount
  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  // Load vault profiles and their folders
  const loadVaultData = useCallback(async () => {
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
  }, [apiClient]);

  // Load vault data on mount
  useEffect(() => {
    loadVaultData();
  }, [loadVaultData]);

  // Helper to parse the combined folder value
  const parseTargetFolder = (value: string): { type: FolderType; folderId: string; profileId?: string; profileName?: string } => {
    if (value.startsWith('vault:')) {
      const parts = value.replace('vault:', '').split(':');
      const profileId = parts[0];
      const folderId = parts[1];
      const profile = vaultProfiles.find(p => p.id === profileId);
      return { type: 'vault', folderId, profileId, profileName: profile?.name };
    }
    return { type: 's3', folderId: value };
  };

  // Get display text for the selected folder
  const getSelectedFolderDisplay = (): string => {
    if (!targetFolder) return 'Saving to your root outputs folder';
    
    const parsed = parseTargetFolder(targetFolder);
    
    if (parsed.type === 'vault') {
      const folders = vaultFoldersByProfile[parsed.profileId || ''] || [];
      const folder = folders.find(f => f.id === parsed.folderId);
      return `Saving to Vault: ${parsed.profileName || 'Profile'} / ${folder?.name || 'Folder'}`;
    }
    
    const s3Folder = availableFolders.find(f => f.prefix === parsed.folderId);
    return `Saving to ${s3Folder?.displayPath || 'selected folder'}`;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImage = {
          id: `img-${Date.now()}`,
          base64: reader.result as string,
          file,
        };
        setUploadedImages((prev) => [...prev, newImage]);
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    e.target.value = '';
  };

  const handleRemoveImage = (imageId: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const handleGenerate = async () => {
    if (!apiClient) {
      setError("API client not available");
      return;
    }

    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    if (uploadedImages.length === 0) {
      setError("Please upload at least one reference image");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);
    
    const taskId = `seedream-i2i-${Date.now()}`;
    
    try {
      updateGlobalProgress({
        isGenerating: true,
        progress: 0,
        stage: "starting",
        message: "Starting SeeDream 4.5 Image-to-Image generation...",
        generationType: "image-to-image",
        jobId: taskId,
      });

      // Prepare request payload
      const payload: any = {
        prompt: prompt.trim(),
        model: "ep-20260103160511-gxx75",
        image: uploadedImages.length === 1 
          ? uploadedImages[0].base64 
          : uploadedImages.map(img => img.base64), // Array for multiple images, single string for one image
        watermark: false,
        sequential_image_generation: maxImages > 1 ? "auto" : "disabled",
        size: currentSize,
      };

      // Handle folder selection - parse the target folder
      if (targetFolder) {
        const parsed = parseTargetFolder(targetFolder);
        if (parsed.type === 'vault') {
          // For vault folders, pass vault-specific info
          payload.saveToVault = true;
          payload.vaultProfileId = parsed.profileId;
          payload.vaultFolderId = parsed.folderId;
        } else {
          // For S3 folders, pass the prefix as before
          payload.targetFolder = parsed.folderId;
        }
      }

      // Add batch generation config
      if (maxImages > 1) {
        payload.sequential_image_generation_options = {
          max_images: maxImages,
        };
      }

      const response = await apiClient.post("/api/generate/seedream-image-to-image", payload);
      
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
        generationType: "image-to-image",
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

      setGeneratedImages(images);
      
      // Reload history to include newly generated images
      loadGenerationHistory();
      
    } catch (error: any) {
      console.error("Generation error:", error);
      setError(error.message || "Failed to generate images");
      updateGlobalProgress({
        isGenerating: false,
        progress: 0,
        stage: "failed",
        message: error.message || "Generation failed",
        generationType: "image-to-image",
        jobId: taskId,
      });
      setTimeout(() => clearGlobalProgress(), 3000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (imageUrl: string, filename: string) => {
    try {
      console.log('Download attempt:', { imageUrl, filename });
      
      if (!imageUrl) {
        throw new Error('Image URL is empty. The image may not have been saved to S3.');
      }
      
      let blobUrl: string;
      
      if (imageUrl.startsWith('data:')) {
        // Data URLs can be used directly
        blobUrl = imageUrl;
      } else {
        // Use proxy endpoint to avoid CORS issues
        const proxyUrl = `/api/download/image?url=${encodeURIComponent(imageUrl)}`;
        console.log('Fetching via proxy:', proxyUrl);
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Download failed:', response.status, errorData);
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
    setSelectedResolution("2K");
    setSelectedRatio("1:1");
    setMaxImages(1);
    setTargetFolder("");
    setFolderType('s3');
    setError(null);
    setGeneratedImages([]);
    setUploadedImages([]);
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
                <h1 className="text-3xl sm:text-4xl font-black text-white">SeeDream 4.5 — Image to Image</h1>
              </div>
            </div>
            <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed">
              Transform references into finished visuals. Upload a primary image, add optional style refs, and steer with a concise prompt.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-200"><Upload className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-slate-300">Inputs</p>
                  <p className="text-sm font-semibold text-white">1-14 refs</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-200"><Settings className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-slate-300">Framing</p>
                  <p className="text-sm font-semibold text-white">Smart ratios</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200"><Download className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-slate-300">Output</p>
                  <p className="text-sm font-semibold text-white">2K/4K ready</p>
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
              {/* Image Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white">Reference Images</label>
                  <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-[11px] font-semibold text-cyan-100">{uploadedImages.length || 0} added</span>
                </div>

                {/* Uploaded Images Grid */}
                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {uploadedImages.map((img, index) => (
                      <div key={img.id} className="relative group">
                        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-lg shadow-cyan-900/30 transition hover:-translate-y-1 hover:shadow-2xl">
                          <img
                            src={img.base64}
                            alt={`Reference ${index + 1}`}
                            className="w-full h-32 object-contain p-2"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 transition group-hover:opacity-100" />
                          <button
                            onClick={() => handleRemoveImage(img.id)}
                            disabled={isGenerating}
                            className="absolute top-2 right-2 rounded-full bg-white/10 p-1.5 text-white opacity-0 transition hover:bg-red-500/80 group-hover:opacity-100"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <div className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-900 shadow">
                            {index === 0 ? 'Primary' : `Ref ${index + 1}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload New Image Button */}
                <label className="group flex flex-col items-center justify-center w-full h-32 rounded-xl border border-dashed border-white/20 bg-slate-950/60 cursor-pointer transition hover:border-cyan-200/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-900/30">
                  <div className="flex flex-col items-center justify-center py-4">
                    <div className="relative mb-2">
                      <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                      <Upload className="relative w-8 h-8 text-cyan-200 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-sm text-white">
                      <span className="font-semibold text-cyan-100">
                        {uploadedImages.length === 0 ? 'Upload primary image' : 'Add reference image'}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-300 mt-1">PNG, JPG, WEBP (max 10MB)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isGenerating}
                  />
                </label>

                {uploadedImages.length > 0 && (
                  <p className="text-xs text-slate-300">
                    First image is primary; additional images provide style/composition cues.
                  </p>
                )}
              </div>

              {/* Prompt Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white">Prompt</label>
                  <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-[11px] font-semibold text-cyan-100">Required</span>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent" />
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the changes: keep pose, swap outfit to ..."
                    className="relative w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                    rows={4}
                    disabled={isGenerating}
                  />
                </div>
                <p className="text-xs text-slate-300">Be explicit about what stays vs. changes. Under 600 words.</p>
              </div>

              {/* Resolution & Aspect Ratio Configuration */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-cyan-300" />
                  <p className="text-sm font-semibold text-white">Framing</p>
                </div>

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
              </div>

              {/* Folder Selection */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-cyan-300" />
                  <p className="text-sm font-semibold text-white">Save Destination</p>
                  {(isLoadingFolders || isLoadingVaultData) && (
                    <Loader2 className="w-3 h-3 animate-spin text-cyan-300" />
                  )}
                </div>
                <div className="relative">
                  <select
                    value={targetFolder}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTargetFolder(value);
                      const parsed = parseTargetFolder(value);
                      setFolderType(parsed.type);
                    }}
                    disabled={isGenerating || isLoadingFolders || isLoadingVaultData}
                    className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40 disabled:opacity-50"
                  >
                    <option value="">📁 Default Output Folder</option>
                    
                    {/* S3 Folders Group */}
                    {availableFolders.length > 0 && (
                      <optgroup label="📂 Your Output Folders">
                        {availableFolders.map((folder) => (
                          <option key={folder.prefix} value={folder.prefix}>
                            {'  '.repeat(folder.depth)}{folder.name}
                            {folder.isShared && ' (Shared)'}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    
                    {/* Vault Folders by Profile */}
                    {vaultProfiles.map((profile) => {
                      const folders = vaultFoldersByProfile[profile.id] || [];
                      if (folders.length === 0) return null;
                      
                      return (
                        <optgroup 
                          key={profile.id} 
                          label={`📸 Vault - ${profile.name}${profile.instagramUsername ? ` (@${profile.instagramUsername})` : ''}`}
                        >
                          {folders.map((folder) => (
                            <option 
                              key={folder.id} 
                              value={`vault:${profile.id}:${folder.id}`}
                            >
                              {folder.name}{folder.isDefault ? ' (Default)' : ''}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                </div>
                
                {/* Folder type indicator */}
                <div className="flex items-center gap-2">
                  {targetFolder && targetFolder.startsWith('vault:') ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-purple-500/20 px-2.5 py-1 text-[11px] text-purple-200">
                      <Archive className="w-3 h-3" />
                      <span>Vault Storage</span>
                    </div>
                  ) : targetFolder ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-cyan-500/20 px-2.5 py-1 text-[11px] text-cyan-200">
                      <Folder className="w-3 h-3" />
                      <span>S3 Storage</span>
                    </div>
                  ) : null}
                  <p className="text-xs text-slate-300 flex-1">
                    {getSelectedFolderDisplay()}
                  </p>
                </div>
              </div>

              {/* Batch Size */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">Batch Size</p>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-slate-200">{maxImages} total</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  value={maxImages}
                  onChange={(e) => setMaxImages(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                  disabled={isGenerating}
                />
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>Solo</span>
                  <span>Series</span>
                </div>
                <p className="text-xs text-slate-300 text-center">
                  Match batch size to how many outputs you request in the prompt.
                </p>
                <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-3 text-xs text-amber-50">
                  💡 Keep phrasing consistent across a batch for cohesive results.
                </div>
              </div>

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
                  disabled={isGenerating || !prompt.trim() || uploadedImages.length === 0}
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
                            onClick={() => handleDownload(image.imageUrl, `seedream-i2i-${image.id}.jpg`)}
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
                <div className="flex items-center gap-2 text-white">
                  <RefreshCw className="w-4 h-4" />
                  <h3 className="text-sm font-semibold">Recent Generations</h3>
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
                        <img
                          src={image.imageUrl}
                          alt={image.prompt}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
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
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" />
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

            <div className="p-8 text-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600">
                  <Info className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white">SeeDream 4.5 — Image-to-Image Guide</h2>
              </div>

              <div className="space-y-8">
                {/* Prompting Tips */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-cyan-200">
                    <Sparkles className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Effective transformation prompts</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold">✨ Structure</p>
                      <p className="text-sm text-slate-200/80">What to keep + What to change + Desired outcome.</p>
                      <p className="mt-2 text-sm text-slate-300">
                        Example: "Keep the pose and liquid silhouette. Swap material to clear water so skin shows through; shift lighting from reflection to refraction."
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4">
                        <p className="text-sm font-semibold text-emerald-50">✓ Good practices</p>
                        <ul className="mt-2 space-y-1 text-sm text-emerald-50/90 list-disc list-inside">
                          <li>State what stays fixed</li>
                          <li>Describe the change clearly</li>
                          <li>Mention style/texture and lighting</li>
                          <li>Stay under 600 words</li>
                        </ul>
                      </div>
                      <div className="rounded-2xl border border-red-300/40 bg-red-400/10 p-4">
                        <p className="text-sm font-semibold text-red-50">✗ Avoid</p>
                        <ul className="mt-2 space-y-1 text-sm text-red-50/90 list-disc list-inside">
                          <li>Vague requests like "make it better"</li>
                          <li>Contradictory directions</li>
                          <li>Full redesign asks</li>
                          <li>Too many simultaneous changes</li>
                        </ul>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-300/40 bg-amber-400/10 p-4">
                      <p className="text-sm font-semibold text-amber-50">💡 Multi-image blending</p>
                      <p className="text-sm text-amber-50/90">
                        First upload is primary; others guide style/composition. Example: "Apply the jacket style from image 2 onto the person in image 1."
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
                      <h4 className="text-sm font-semibold text-white mb-1">🖼️ Reference images</h4>
                      <p className="text-sm text-slate-200/80">Upload 1-14. First is primary; others are style/pose refs. JPEG/PNG/WEBP, up to 10MB each.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <h4 className="text-sm font-semibold text-white mb-1">📐 Resolution & ratio</h4>
                      <p className="text-sm text-slate-200/80">2K for speed, 4K for detail. Ratios: 1:1, 16:9, 9:16, 21:9, more.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <h4 className="text-sm font-semibold text-white mb-1">🎨 Batch size</h4>
                      <p className="text-sm text-slate-200/80">1 for the hero output; 2-15 for variations or angles. Keep input images + outputs ≤ 15.</p>
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
                      <p className="text-sm font-semibold text-purple-50">👔 Fashion/Product</p>
                      <p className="text-sm text-purple-50/80">Batch 3-5 colorways; keep fit and pose.</p>
                    </div>
                    <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4">
                      <p className="text-sm font-semibold text-amber-50">🎨 Style transfer</p>
                      <p className="text-sm text-amber-50/80">Use image 2 style on image 1 subject.</p>
                    </div>
                    <div className="rounded-2xl border border-teal-300/40 bg-teal-500/10 p-4">
                      <p className="text-sm font-semibold text-teal-50">🏠 Scene edit</p>
                      <p className="text-sm text-teal-50/80">Swap backgrounds while keeping lighting coherent.</p>
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
                    <li>Primary image drives composition; others guide style.</li>
                    <li>Inputs + outputs must be ≤ 15 for a batch.</li>
                    <li>Larger inputs may take longer.</li>
                    <li>All results save automatically to S3.</li>
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
                      a.download = `seedream-i2i-${selectedImage.id}.jpg`;
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
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
