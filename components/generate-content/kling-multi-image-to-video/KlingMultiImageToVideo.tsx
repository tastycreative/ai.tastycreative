"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import { ReferenceSelector } from "@/components/reference-bank/ReferenceSelector";
import { ReferenceItem } from "@/hooks/useReferenceBank";
import { useCredits } from '@/lib/hooks/useCredits.query';
import { CreditCalculator } from "@/components/credits/CreditCalculator";
import {
  AlertCircle,
  Archive,
  ChevronDown,
  Clock,
  Download,
  Folder,
  FolderOpen,
  HelpCircle,
  Info,
  Loader2,
  Maximize2,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Video,
  Zap,
  X,
  Wand2,
  Upload,
  Image as ImageIcon,
  Trash2,
  Images,
  Check,
  Library,
} from "lucide-react";

// Image compression utility - optimizes large images while preserving quality for AI generation
const compressImage = async (
  file: File,
  maxSizeMB: number = 3.5,
  maxWidthOrHeight: number = 2048
): Promise<{ file: File; compressed: boolean; originalSize: number; newSize: number }> => {
  return new Promise((resolve, reject) => {
    const originalSize = file.size;
    
    if (file.size <= maxSizeMB * 1024 * 1024) {
      resolve({ file, compressed: false, originalSize, newSize: originalSize });
      return;
    }

    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;
      
      if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
        if (width > height) {
          height = (height / width) * maxWidthOrHeight;
          width = maxWidthOrHeight;
        } else {
          width = (width / height) * maxWidthOrHeight;
          height = maxWidthOrHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      }

      ctx?.drawImage(img, 0, 0, width, height);

      let quality = 0.92;
      const minQuality = 0.75;
      
      const tryCompress = (q: number): Promise<Blob | null> => {
        return new Promise((res) => {
          canvas.toBlob((blob) => res(blob), 'image/jpeg', q);
        });
      };

      const compressLoop = async () => {
        let blob = await tryCompress(quality);
        
        while (blob && blob.size > maxSizeMB * 1024 * 1024 && quality > minQuality) {
          quality -= 0.05;
          blob = await tryCompress(quality);
        }
        
        if (blob && blob.size > maxSizeMB * 1024 * 1024) {
          const scale = 0.8;
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          quality = 0.85;
          blob = await tryCompress(quality);
          
          while (blob && blob.size > maxSizeMB * 1024 * 1024 && quality > minQuality) {
            quality -= 0.05;
            blob = await tryCompress(quality);
          }
        }

        if (!blob) {
          reject(new Error('Failed to compress image'));
          return;
        }

        const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });

        resolve({
          file: compressedFile,
          compressed: true,
          originalSize,
          newSize: blob.size,
        });
      };

      compressLoop();
    };

    img.onerror = () => reject(new Error('Failed to load image for compression'));

    const reader = new FileReader();
    reader.onloadend = () => {
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

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
  mode?: string;
  duration: string;
  aspectRatio?: string;
  imageCount: number;
  cfgScale?: number;
  negativePrompt?: string;
  sourceImageUrls?: string[];
  createdAt: string;
  status: "completed" | "processing" | "failed";
  profileName?: string;
  metadata?: {
    prompt?: string;
    negativePrompt?: string;
    model?: string;
    mode?: string;
    duration?: string;
    aspectRatio?: string;
    imageCount?: number;
    cfgScale?: number;
    sourceImageUrls?: string[];
    [key: string]: any;
  };
}

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  fromReferenceBank?: boolean;
  referenceId?: string;
}

// Kling model options - Multi-image only supports V1.6
const MODEL_OPTIONS = [
  { value: "kling-v1-6", label: "Kling V1.6", description: "Multi-image support" },
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

// Tooltips for technical terms
const TOOLTIPS = {
  model: "AI model version used for generation. V1.6 supports multi-image interpolation.",
  mode: "Standard: Faster generation. Professional: Higher quality with more detail.",
  duration: "Length of the generated video clip.",
  aspectRatio: "Video dimensions. Choose based on your platform (16:9 for YouTube, 9:16 for Stories).",
  negativePrompt: "Words or concepts to avoid in the generation. Helps prevent unwanted elements.",
  imageCount: "Number of images to interpolate between. 2-4 images supported.",
};

// Tooltip component - using span instead of button to avoid hydration errors
const Tooltip = ({ text }: { text: string }) => (
  <span className="group relative inline-flex cursor-help">
    <HelpCircle className="w-4 h-4 text-slate-400 transition-colors group-hover:text-violet-300" />
    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-48 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-100 opacity-0 shadow-xl transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
      {text}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-800" />
    </span>
  </span>
);

export default function KlingMultiImageToVideo() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();
  const { refreshCredits } = useCredits();

  // Use global profile from header
  const { profileId: globalProfileId, selectedProfile } = useInstagramProfile();
  
  // Check if "All Profiles" is selected
  const isAllProfiles = globalProfileId === "all";

  // Hydration fix - track if component is mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    
    // Check for reuse data from vault/sessionStorage
    const reuseData = sessionStorage.getItem('kling-multi-i2v-reuse');
    if (reuseData) {
      const loadReuseData = async () => {
        try {
          const data = JSON.parse(reuseData);
          
          // Set prompt
          if (data.prompt) setPrompt(data.prompt);
          
          // Set negative prompt
          if (data.negativePrompt) setNegativePrompt(data.negativePrompt);
          
          // Set model
          if (data.model) setModel(data.model);
          
          // Set mode
          if (data.mode) setMode(data.mode);
          
          // Set duration
          if (data.duration) setDuration(data.duration);
          
          // Set aspect ratio
          if (data.aspectRatio) setAspectRatio(data.aspectRatio);
          
          // Load source images if available
          const sourceUrls = data.sourceImageUrls || [];
          if (sourceUrls.length > 0) {
            setIsCompressing(true);
            
            try {
              const loadedImages: UploadedImage[] = [];
              for (let i = 0; i < sourceUrls.length; i++) {
                const url = sourceUrls[i];
                try {
                  const response = await fetch(url);
                  if (response.ok) {
                    const blob = await response.blob();
                    const file = new File([blob], `source-image-${i + 1}.jpg`, { type: blob.type || 'image/jpeg' });
                    const preview = URL.createObjectURL(blob);
                    loadedImages.push({
                      id: `reuse-${Date.now()}-${i}`,
                      file,
                      preview,
                      fromReferenceBank: false,
                    });
                  }
                } catch (imgErr) {
                  console.warn(`[Kling Multi-I2V] Error loading source image ${i + 1}:`, imgErr);
                }
              }
              
              setUploadedImages(loadedImages);
              console.log(`[Kling Multi-I2V] Loaded ${loadedImages.length} source images from vault reuse`);
            } finally {
              setIsCompressing(false);
            }
          }
          
          // Clear the reuse data after using it
          sessionStorage.removeItem('kling-multi-i2v-reuse');
        } catch (err) {
          console.error('Failed to parse reuse data:', err);
          sessionStorage.removeItem('kling-multi-i2v-reuse');
        }
      };
      
      loadReuseData();
    }
  }, []);

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

  // Image upload state - API supports up to 4 images
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_IMAGES = 4;
  const [isCompressing, setIsCompressing] = useState(false);
  
  // Reference Bank state
  const [showReferenceBankSelector, setShowReferenceBankSelector] = useState(false);
  const [isSavingToReferenceBank, setIsSavingToReferenceBank] = useState(false);

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

  // Show error as toast notification
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
      console.log("[Kling Multi-I2V Frontend] Loading generation history...", "profileId:", globalProfileId);
      const url = globalProfileId 
        ? `/api/generate/kling-multi-image-to-video?history=true&profileId=${globalProfileId}`
        : "/api/generate/kling-multi-image-to-video?history=true";
      const response = await apiClient.get(url);
      if (response.ok) {
        const data = await response.json();
        const videos = data.videos || [];
        console.log("[Kling Multi-I2V Frontend] Loaded videos:", videos.length);
        console.log("[Kling Multi-I2V Frontend] Video URLs present:", videos.filter((v: any) => !!v.videoUrl).length);
        setGenerationHistory(videos);
      } else {
        console.error("[Kling Multi-I2V Frontend] Failed to load history, status:", response.status);
      }
    } catch (err) {
      console.error("[Kling Multi-I2V Frontend] Failed to load generation history:", err);
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

  // Handle image upload with compression
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Filter valid image files
    const validFiles = files.filter(file => file.type.startsWith("image/"));
    
    // Check total count - API supports max 4 images
    const totalImages = uploadedImages.length + validFiles.length;
    if (totalImages > MAX_IMAGES) {
      showErrorToast(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }

    // Check individual file sizes (allow up to 20MB since we compress)
    const oversizedFiles = validFiles.filter(f => f.size > 20 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      showErrorToast("Each image must be less than 20MB");
      return;
    }
    setIsCompressing(true);

    try {
      // Compress and add each file
      for (const file of validFiles) {
        const result = await compressImage(file, 3, 2048);
        const preview = URL.createObjectURL(result.file);
        const newImage: UploadedImage = {
          id: `${Date.now()}-${Math.random()}`,
          file: result.file,
          preview,
        };
        setUploadedImages(prev => [...prev, newImage]);
        
        if (result.compressed) {
          console.log(`[Kling Multi-I2V] Image compressed: ${(result.originalSize / (1024 * 1024)).toFixed(1)}MB → ${(result.newSize / (1024 * 1024)).toFixed(1)}MB`);
        }
      }
    } catch (err) {
      console.error("Image compression failed:", err);
      showErrorToast("Failed to process one or more images. Please try different files.");
    } finally {
      setIsCompressing(false);
    }

    // Reset input
    if (e.target) {
      e.target.value = "";
    }
  };

  // Remove image
  const removeImage = (id: string) => {
    setUploadedImages(prev => {
      const image = prev.find(img => img.id === id);
      if (image && !image.fromReferenceBank) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter(img => img.id !== id);
    });
  };

  // Move image up
  const moveImageUp = (index: number) => {
    if (index === 0) return;
    setUploadedImages(prev => {
      const newImages = [...prev];
      [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
      return newImages;
    });
  };

  // Move image down
  const moveImageDown = (index: number) => {
    if (index === uploadedImages.length - 1) return;
    setUploadedImages(prev => {
      const newImages = [...prev];
      [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
      return newImages;
    });
  };

  // Save image to Reference Bank (for file-based uploads)
  const saveToReferenceBank = async (file: File, imagePreview: string, skipIfExists?: boolean): Promise<string | null> => {
    if (!globalProfileId) return null;
    
    try {
      const mimeType = file.type || 'image/jpeg';
      const extension = mimeType === 'image/png' ? 'png' : 'jpg';
      const fileName = file.name || `reference-${Date.now()}.${extension}`;
      
      // Use the file directly instead of converting from base64
      // This handles both blob URLs and data URLs
      const blob = file;
      
      // Check if a similar file already exists in Reference Bank (by size)
      if (skipIfExists) {
        try {
          const existingCheck = await fetch(`/api/reference-bank?profileId=${globalProfileId}&checkDuplicate=true&fileSize=${blob.size}&fileName=${encodeURIComponent(fileName)}`);
          if (existingCheck.ok) {
            const existing = await existingCheck.json();
            if (existing.duplicate) {
              console.log('⏭️ Skipping duplicate - image already exists in Reference Bank:', existing.existingId);
              return existing.existingId;
            }
          }
        } catch (err) {
          console.warn('Could not check for duplicates:', err);
        }
      }
      
      // Get dimensions from image
      const img = new Image();
      const dimensionsPromise = new Promise<{ width: number; height: number }>((resolve) => {
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = imagePreview;
      });
      const dimensions = await dimensionsPromise;

      // Get presigned URL
      const presignedResponse = await fetch('/api/reference-bank/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, fileType: mimeType, profileId: globalProfileId }),
      });

      if (!presignedResponse.ok) return null;

      const { presignedUrl, key, url } = await presignedResponse.json();

      // Upload to S3
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: blob,
      });

      if (!uploadResponse.ok) return null;

      // Create reference item in database
      const createResponse = await fetch('/api/reference-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: globalProfileId,
          name: fileName,
          fileType: 'image',
          mimeType,
          fileSize: blob.size,
          width: dimensions.width,
          height: dimensions.height,
          awsS3Key: key,
          awsS3Url: url,
          tags: ['kling', 'multi-image-to-video'],
        }),
      });

      if (!createResponse.ok) return null;

      const newReference = await createResponse.json();
      return newReference.id;
    } catch (err) {
      console.error('Error saving to Reference Bank:', err);
      return null;
    }
  };

  // Handle single selection from Reference Bank (legacy support)
  const handleReferenceBankSelect = async (item: ReferenceItem) => {
    await handleReferenceBankMultiSelect([item]);
  };

  // Handle multi-selection from Reference Bank
  const handleReferenceBankMultiSelect = async (items: ReferenceItem[]) => {
    if (items.length === 0) {
      setShowReferenceBankSelector(false);
      return;
    }

    // Filter out already added items
    const existingReferenceIds = new Set(uploadedImages.map(img => img.referenceId).filter(Boolean));
    const newItems = items.filter(item => !existingReferenceIds.has(item.id));

    if (newItems.length === 0) {
      showErrorToast('All selected images are already added');
      setShowReferenceBankSelector(false);
      return;
    }

    // Check if adding these would exceed the max
    const canAdd = MAX_IMAGES - uploadedImages.length;
    if (canAdd <= 0) {
      showErrorToast(`Maximum ${MAX_IMAGES} images reached`);
      setShowReferenceBankSelector(false);
      return;
    }

    // Trim to fit available slots
    const itemsToAdd = newItems.slice(0, canAdd);

    setIsCompressing(true);
    const loadedImages: UploadedImage[] = [];

    for (const item of itemsToAdd) {
      try {
        // Fetch image via proxy
        const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(item.awsS3Url)}`);
        
        if (!proxyResponse.ok) {
          console.warn('Failed to load reference image:', item.name);
          continue;
        }
        
        const blob = await proxyResponse.blob();
        
        // Convert blob to File
        const file = new File([blob], item.name || 'reference.jpg', { type: blob.type || 'image/jpeg' });
        
        // Create preview as base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        loadedImages.push({
          id: `ref-${item.id}-${Date.now()}`,
          file,
          preview: base64,
          fromReferenceBank: true,
          referenceId: item.id,
        });
        
        // Track usage
        fetch(`/api/reference-bank/${item.id}/use`, { method: 'POST' }).catch(console.error);
      } catch (err) {
        console.error('Error loading reference image:', item.name, err);
      }
    }

    if (loadedImages.length > 0) {
      setUploadedImages(prev => [...prev, ...loadedImages]);
    } else {
      showErrorToast('Failed to load selected images. Please try again.');
    }

    setIsCompressing(false);
    setShowReferenceBankSelector(false);
  };

  // Poll for task status
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
          updateGlobalProgress({
            isGenerating: true,
            progress: Math.min(90, attempts * 2),
            stage: "processing",
            message: `Generating video... ${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`,
            generationType: "image-to-video",
            jobId: localTaskId,
          });

          const response = await apiClient?.get(
            `/api/generate/kling-multi-image-to-video?taskId=${taskId}`
          );
          if (!response) throw new Error("API client not available");
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to check task status");
          }

          const data = await response.json();

          if (data.status === "completed" && data.videos && data.videos.length > 0) {
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

          if (data.status === "succeed" && data.videoUrl) {
            updateGlobalProgress({
              isGenerating: false,
              progress: 100,
              stage: "completed",
              message: "Video generation completed!",
              generationType: "image-to-video",
              jobId: localTaskId,
            });
            setGeneratedVideos([{
              id: data.id || taskId,
              videoUrl: data.videoUrl,
              prompt: prompt,
              model: model,
              duration: duration,
              imageCount: uploadedImages.length,
              createdAt: new Date().toISOString(),
              status: "completed"
            }]);
            setPollingStatus("");
            setIsGenerating(false);
            loadGenerationHistory();
            resolve();
            return;
          }

          if (data.status === "failed") {
            throw new Error(data.error || data.message || "Video generation failed");
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
          showErrorToast(err.message || "Failed to check generation status");
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
          setTimeout(() => clearGlobalProgress(), 3000);
          reject(err);
        }
      };

      poll();
    });
  };

  const handleGenerate = async () => {
    if (!apiClient) {
      showErrorToast("API client not available");
      return;
    }
    if (!targetFolder) {
      showErrorToast("Please select a vault folder to save your video");
      return;
    }
    if (uploadedImages.length < 2) {
      showErrorToast("Please upload at least 2 images");
      return;
    }
    if (!prompt.trim()) {
      showErrorToast("Prompt is required for multi-image video generation");
      return;
    }

    setIsGenerating(true);
    setGeneratedVideos([]);
    setPollingStatus("Uploading images...");
    const localTaskId = `kling-multi-i2v-${Date.now()}`;

    try {
      // Save new uploads to Reference Bank before generating
      if (globalProfileId) {
        setIsSavingToReferenceBank(true);
        for (let i = 0; i < uploadedImages.length; i++) {
          const img = uploadedImages[i];
          // Only save if not already from Reference Bank and doesn't have a referenceId
          if (!img.fromReferenceBank && !img.referenceId) {
            // Pass skipIfExists: true to avoid creating duplicates
            const newReferenceId = await saveToReferenceBank(img.file, img.preview, true);
            if (newReferenceId) {
              // Update the image to mark it as saved
              setUploadedImages(prev => prev.map((item, idx) => 
                idx === i ? { ...item, fromReferenceBank: true, referenceId: newReferenceId } : item
              ));
            }
          }
        }
        setIsSavingToReferenceBank(false);
      }

      updateGlobalProgress({
        isGenerating: true,
        progress: 0,
        stage: "starting",
        message: "Starting Kling Multi-Image-to-Video generation...",
        generationType: "image-to-video",
        jobId: localTaskId,
      });

      // Prepare form data
      const formData = new FormData();
      
      // Add images - API expects image_list format
      uploadedImages.forEach((img, index) => {
        formData.append(`image${index + 1}`, img.file);
      });

      // Add parameters - using correct API field names
      formData.append("prompt", prompt.trim()); // Required
      if (negativePrompt.trim()) {
        formData.append("negative_prompt", negativePrompt.trim());
      }
      formData.append("model_name", model); // API uses model_name
      formData.append("mode", mode);
      formData.append("duration", duration);
      formData.append("aspect_ratio", aspectRatio); // Add aspect ratio

      // Add vault folder params if selected
      if (targetFolder && globalProfileId) {
        formData.append("saveToVault", "true");
        // Use folder's profileId for proper association (works for both single and all profiles views)
        const folderProfileId = vaultFolders.find(f => f.id === targetFolder)?.profileId || globalProfileId;
        if (folderProfileId && folderProfileId !== "all") {
          formData.append("vaultProfileId", folderProfileId);
        }
        formData.append("vaultFolderId", targetFolder);
      }

      const response = await apiClient.post(
        "/api/generate/kling-multi-image-to-video",
        formData
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
      showErrorToast(err.message || "Failed to generate video");
      updateGlobalProgress({
        isGenerating: false,
        progress: 0,
        stage: "failed",
        message: err.message || "Generation failed",
        generationType: "image-to-video",
        jobId: localTaskId,
      });
      setPollingStatus("");
      setTimeout(() => clearGlobalProgress(), 3000);
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
    setNegativePrompt("");
    setModel("kling-v1-6");
    setMode("std");
    setDuration("5");
    setAspectRatio("16:9");
    setUploadedImages([]);
    setTargetFolder("");
    setGeneratedVideos([]);
    setPollingStatus("");
  };

  // Handle reuse settings from a selected video
  const handleReuseSettings = async (video: GeneratedVideo) => {
    // Set prompt
    setPrompt(video.prompt || video.metadata?.prompt || '');
    
    // Set negative prompt
    if (video.negativePrompt || video.metadata?.negativePrompt) {
      setNegativePrompt(video.negativePrompt || video.metadata?.negativePrompt || '');
    }
    
    // Set model
    const videoModel = video.model || video.metadata?.model;
    if (videoModel && MODEL_OPTIONS.find(m => m.value === videoModel)) {
      setModel(videoModel);
    }
    
    // Set mode
    const videoMode = video.mode || video.metadata?.mode;
    if (videoMode && MODE_OPTIONS.find(m => m.value === videoMode)) {
      setMode(videoMode);
    }
    
    // Set duration
    const videoDuration = video.duration || video.metadata?.duration;
    if (videoDuration && DURATION_OPTIONS.find(d => d.value === videoDuration)) {
      setDuration(videoDuration);
    }
    
    // Set aspect ratio
    const videoAspectRatio = video.aspectRatio || video.metadata?.aspectRatio;
    if (videoAspectRatio && ASPECT_RATIO_OPTIONS.find(a => a.value === videoAspectRatio)) {
      setAspectRatio(videoAspectRatio);
    }
    
    // Load source images if available
    const sourceUrls = video.sourceImageUrls || video.metadata?.sourceImageUrls || [];
    if (sourceUrls.length > 0) {
      setIsCompressing(true);
      
      try {
        // Clear existing images first
        setUploadedImages([]);
        
        // Fetch and load each source image
        const loadedImages: UploadedImage[] = [];
        for (let i = 0; i < sourceUrls.length; i++) {
          const url = sourceUrls[i];
          try {
            const response = await fetch(url);
            if (response.ok) {
              const blob = await response.blob();
              const file = new File([blob], `source-image-${i + 1}.jpg`, { type: blob.type || 'image/jpeg' });
              const preview = URL.createObjectURL(blob);
              loadedImages.push({
                id: `reuse-${Date.now()}-${i}`,
                file,
                preview,
                fromReferenceBank: false,
              });
            } else {
              console.warn(`[Kling Multi-I2V] Failed to fetch source image ${i + 1}:`, response.status);
            }
          } catch (imgErr) {
            console.warn(`[Kling Multi-I2V] Error loading source image ${i + 1}:`, imgErr);
          }
        }
        
        setUploadedImages(loadedImages);
        console.log(`[Kling Multi-I2V] Loaded ${loadedImages.length} source images for reuse`);
      } catch (err) {
        console.error("[Kling Multi-I2V] Error loading source images:", err);
        showErrorToast("Failed to load some source images");
      } finally {
        setIsCompressing(false);
      }
    } else {
      // No source images available, clear existing
      setUploadedImages([]);
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
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute inset-x-10 top-20 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header Section */}
        <div className="grid gap-4 md:grid-cols-[2fr_1fr] items-start">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-violet-900/30 backdrop-blur">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-600 shadow-lg shadow-violet-900/50">
                <Images className="w-6 h-6 text-white" />
                <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Motion Studio</p>
                <h1 className="text-3xl sm:text-4xl font-black text-white">Kling AI — Multi-Image to Video</h1>
              </div>
            </div>
            <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed">
              Create smooth transitions and animations from 2-4 images using Kling AI&apos;s 
              multi-image interpolation technology. Perfect for creating dynamic morphing videos.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Images</p>
                  <p className="text-sm font-semibold text-white">2-4 Images</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20 text-pink-200">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Duration</p>
                  <p className="text-sm font-semibold text-white">5s or 10s</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-300">Model</p>
                  <p className="text-sm font-semibold text-white">Kling V1.6</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="group inline-flex items-center gap-2 rounded-full bg-white text-slate-900 px-4 py-2 text-sm font-semibold shadow-lg shadow-violet-900/20 transition hover:-translate-y-0.5 hover:shadow-xl"
                title="View Help & Tips"
              >
                <Info className="w-4 h-4" />
                Quick Guide
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-pink-500/10 p-4 shadow-2xl shadow-violet-900/20 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Current setup</p>
                  <p className="text-sm font-semibold text-white">
                    {MODEL_OPTIONS.find(m => m.value === model)?.label} · {mode === "pro" ? "Professional" : "Standard"} · {duration}s
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-200/80">
                  <span className="rounded-full bg-white/10 px-3 py-1">{uploadedImages.length} images</span>
                  <span
                    className={`rounded-full px-3 py-1 ${
                      isGenerating
                        ? "bg-amber-400/20 text-amber-100"
                        : "bg-emerald-400/20 text-emerald-100"
                    }`}
                  >
                    {isGenerating ? "Rendering" : "Ready"}
                  </span>
                </div>
              </div>
              {pollingStatus && (
                <div className="mt-3 flex items-center gap-2 text-sm text-violet-100">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{pollingStatus}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-[420px_1fr] items-start">
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-violet-900/40 backdrop-blur space-y-6">
              {/* Image Upload Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-100">Upload Images (2-4) <span className="text-red-400">*</span></label>
                  <div className="flex items-center gap-2">
                    {/* Reference Bank Button */}
                    {mounted && (
                      <button
                        type="button"
                        onClick={() => setShowReferenceBankSelector(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30 transition-all"
                        disabled={isGenerating || uploadedImages.length >= MAX_IMAGES}
                      >
                        <Library className="w-3.5 h-3.5" />
                        Reference Bank
                      </button>
                    )}
                    <span className="text-xs text-slate-400">{uploadedImages.length}/{MAX_IMAGES}</span>
                  </div>
                </div>
                
                {uploadedImages.length < MAX_IMAGES && (
                  <button
                    onClick={() => !isCompressing && fileInputRef.current?.click()}
                    disabled={isGenerating || isCompressing}
                    className="w-full py-6 border-2 border-dashed border-white/20 hover:border-violet-400/50 rounded-2xl bg-white/5 hover:bg-white/10 transition-all flex flex-col items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCompressing ? (
                      <>
                        <div className="p-3 bg-violet-500/10 rounded-full">
                          <Loader2 className="h-6 w-6 text-violet-300 animate-spin" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-white font-medium">Compressing images...</p>
                          <p className="text-xs text-slate-400 mt-1">Please wait</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-3 bg-violet-500/10 rounded-full group-hover:bg-violet-500/20 transition-colors">
                          <Upload className="h-6 w-6 text-violet-300" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-white font-medium">Click to upload images</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {uploadedImages.length === 0 ? "Upload 2-4 images · Auto-compressed" : `Add ${MAX_IMAGES - uploadedImages.length} more`}
                          </p>
                        </div>
                      </>
                    )}
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isCompressing}
                />

                {/* Image Preview Grid */}
                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {uploadedImages.map((image, index) => (
                      <div key={image.id} className="relative group">
                        <div className="aspect-square rounded-xl overflow-hidden border-2 border-white/10 group-hover:border-violet-400/50 transition-colors">
                          <img
                            src={image.preview}
                            alt={`Upload ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        
                        {/* Image Order Badge */}
                        <div className="absolute top-1 left-1 bg-violet-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                          {index + 1}
                        </div>

                        {/* Action Buttons */}
                        <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {index > 0 && (
                            <button
                              onClick={() => moveImageUp(index)}
                              className="p-1 bg-slate-900/90 hover:bg-slate-800 rounded text-white"
                              title="Move up"
                            >
                              <ChevronDown className="h-3 w-3 rotate-180" />
                            </button>
                          )}
                          {index < uploadedImages.length - 1 && (
                            <button
                              onClick={() => moveImageDown(index)}
                              className="p-1 bg-slate-900/90 hover:bg-slate-800 rounded text-white"
                              title="Move down"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            onClick={() => removeImage(image.id)}
                            className="p-1 bg-red-500/90 hover:bg-red-600 rounded text-white"
                            title="Remove"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Prompt Input with Integrated Quick Settings */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-slate-100">Prompt <span className="text-red-400">*</span></label>
                  <Tooltip text="Describe the transition or animation style between images" />
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the transition or animation style..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent disabled:opacity-50"
                  rows={3}
                  disabled={isGenerating}
                />

                {/* Quick Settings - Integrated in Prompt Section */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-medium text-slate-300">Model</label>
                      <Tooltip text={TOOLTIPS.model} />
                    </div>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      disabled={isGenerating}
                      className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white transition focus:outline-none focus:ring-2 focus:ring-violet-500/50 hover:bg-slate-750 disabled:opacity-50"
                    >
                      {MODEL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-medium text-slate-300">Quality</label>
                      <Tooltip text={TOOLTIPS.mode} />
                    </div>
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                      disabled={isGenerating}
                      className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white transition focus:outline-none focus:ring-2 focus:ring-violet-500/50 hover:bg-slate-750 disabled:opacity-50"
                    >
                      {MODE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-medium text-slate-300">Duration</label>
                      <Tooltip text={TOOLTIPS.duration} />
                    </div>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      disabled={isGenerating}
                      className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white transition focus:outline-none focus:ring-2 focus:ring-violet-500/50 hover:bg-slate-750 disabled:opacity-50"
                    >
                      {DURATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-medium text-slate-300">Aspect Ratio</label>
                      <Tooltip text={TOOLTIPS.aspectRatio} />
                    </div>
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      disabled={isGenerating}
                      className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white transition focus:outline-none focus:ring-2 focus:ring-violet-500/50 hover:bg-slate-750 disabled:opacity-50"
                    >
                      {ASPECT_RATIO_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Negative Prompt - Optional Advanced Setting */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-slate-100">Negative Prompt</label>
                  <Tooltip text={TOOLTIPS.negativePrompt} />
                </div>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="What to avoid: blurry, distorted, low quality..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent disabled:opacity-50"
                  rows={2}
                  disabled={isGenerating}
                />
              </div>

              {/* Folder Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Archive className="w-4 h-4 text-violet-300" />
                  <p className="text-sm font-semibold text-white">Save to Vault</p>
                  {isLoadingVaultData && (
                    <Loader2 className="w-3 h-3 animate-spin text-violet-300" />
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
                        ? 'border-violet-400 bg-violet-500/10 ring-2 ring-violet-400/30' 
                        : 'border-white/10 bg-slate-800/80 hover:border-violet-400/50 hover:bg-slate-800'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`
                        flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
                        ${targetFolder 
                          ? 'bg-gradient-to-br from-violet-500/30 to-purple-500/30 border border-violet-400/30' 
                          : 'bg-slate-700/50 border border-white/5'
                        }
                      `}>
                        <FolderOpen className={`w-4 h-4 ${targetFolder ? 'text-violet-300' : 'text-slate-400'}`} />
                      </div>
                      <div className="text-left min-w-0">
                        <p className={`text-sm font-medium truncate ${targetFolder ? 'text-white' : 'text-slate-400'}`}>
                          {targetFolder 
                            ? vaultFolders.find(f => f.id === targetFolder)?.name || 'Select folder...'
                            : 'Select a folder...'
                          }
                        </p>
                        {targetFolder && (
                          <p className="text-[11px] text-violet-300/70 truncate">
                            {isAllProfiles 
                              ? vaultFolders.find(f => f.id === targetFolder)?.profileName || ''
                              : selectedProfile?.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile?.name || ''
                            }
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${folderDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {folderDropdownOpen && mounted && (
                    <div className="absolute z-50 w-full bottom-full mb-2 py-2 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
                      {/* Clear Selection Option */}
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
                        {!targetFolder && <Check className="w-4 h-4 text-violet-400 ml-auto" />}
                      </button>

                      {vaultFolders.filter(f => !f.isDefault).length > 0 && (
                        <div className="my-2 mx-3 h-px bg-white/5" />
                      )}

                      {/* Folder Options - Grouped by profile when viewing all profiles */}
                      <div className="max-h-[200px] overflow-y-auto">
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
                              <div className="px-4 py-2 text-xs font-semibold text-violet-300 uppercase tracking-wider bg-violet-500/10 sticky top-0">
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
                                        ? 'bg-violet-500/15' 
                                        : 'hover:bg-white/5'
                                      }
                                    `}
                                    style={{ paddingLeft: `${16 + depth * 16}px`, paddingRight: '16px' }}
                                  >
                                    <div className={`
                                      w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0
                                      ${targetFolder === folder.id 
                                        ? 'bg-gradient-to-br from-violet-500/40 to-purple-500/40 border border-violet-400/40' 
                                        : 'bg-slate-700/50 border border-white/5'
                                      }
                                    `}>
                                      {hasChildren ? (
                                        <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? 'text-violet-300' : 'text-slate-400'}`} />
                                      ) : (
                                        <Folder className={`w-4 h-4 ${targetFolder === folder.id ? 'text-violet-300' : 'text-slate-400'}`} />
                                      )}
                                    </div>
                                    <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-white font-medium' : 'text-slate-200'}`}>
                                      {folder.name}
                                    </span>
                                    {depth > 0 && (
                                      <span className="text-xs text-slate-500 flex-shrink-0">L{depth + 1}</span>
                                    )}
                                    {targetFolder === folder.id && (
                                      <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
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
                                    ? 'bg-violet-500/15' 
                                    : 'hover:bg-white/5'
                                  }
                                `}
                                style={{ paddingLeft: `${16 + depth * 16}px`, paddingRight: '16px' }}
                              >
                                <div className={`
                                  w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0
                                  ${targetFolder === folder.id 
                                    ? 'bg-gradient-to-br from-violet-500/40 to-purple-500/40 border border-violet-400/40' 
                                    : 'bg-slate-700/50 border border-white/5'
                                  }
                                `}>
                                  {hasChildren ? (
                                    <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? 'text-violet-300' : 'text-slate-400'}`} />
                                  ) : (
                                    <Folder className={`w-4 h-4 ${targetFolder === folder.id ? 'text-violet-300' : 'text-slate-400'}`} />
                                  )}
                                </div>
                                <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-white font-medium' : 'text-slate-200'}`}>
                                  {folder.name}
                                </span>
                                {depth > 0 && (
                                  <span className="text-xs text-slate-500 flex-shrink-0">L{depth + 1}</span>
                                )}
                                {targetFolder === folder.id && (
                                  <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                                )}
                              </button>
                            );
                          })
                        )}
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

                {/* Status Indicator */}
                {targetFolder && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                    <p className="text-xs text-violet-200 flex-1 truncate">
                      {getSelectedFolderDisplay()}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || isCompressing || uploadedImages.length < 2}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 via-purple-500 to-pink-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : isCompressing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isGenerating ? "Generating..." : isCompressing ? "Processing Images..." : "Generate Video"}
                </button>
                <button
                  onClick={handleReset}
                  type="button"
                  disabled={isGenerating || isCompressing}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
                >
                  <RotateCcw className="w-4 h-4" /> Reset
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="space-y-6">
            {/* Generated Videos */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl shadow-violet-900/30 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Latest output</p>
                  <h2 className="text-lg font-semibold text-white">Generated videos</h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Play className="w-4 h-4" />
                  {generatedVideos.length} clip{generatedVideos.length === 1 ? "" : "s"}
                </div>
              </div>

              {generatedVideos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-slate-300">
                  <Video className="w-6 h-6 mx-auto mb-2 text-slate-400" />
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
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 cursor-pointer"
                    >
                      <video
                        data-role="preview"
                        src={video.videoUrl}
                        className="w-full aspect-video object-cover"
                        muted
                        loop
                        playsInline
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-3">
                        <p className="text-sm text-white font-medium truncate">
                          {video.prompt || "Multi-image interpolation"}
                        </p>
                        <p className="text-xs text-slate-300">
                          {video.imageCount} images · {video.duration}s
                        </p>
                      </div>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(video.videoUrl, `kling-multi-i2v-${video.id}.mp4`);
                          }}
                          className="p-2 bg-white/10 backdrop-blur rounded-full text-white hover:bg-white/20"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Generation History */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl shadow-violet-900/30 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Library</p>
                  <h2 className="text-lg font-semibold text-white">Recent generations</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowHistoryModal(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white transition hover:-translate-y-0.5 hover:shadow"
                  >
                    <Maximize2 className="w-3 h-3" />
                    View All
                  </button>
                  <button
                    type="button"
                    onClick={loadGenerationHistory}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white transition hover:-translate-y-0.5 hover:shadow"
                    disabled={isLoadingHistory}
                  >
                    {isLoadingHistory ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Refresh
                  </button>
                </div>
              </div>

              {generationHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-slate-300">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm">No generation history yet.</p>
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
                      className="group overflow-hidden rounded-xl border border-white/10 bg-white/5 cursor-pointer max-w-[180px]"
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
                        <div className="w-full h-24 flex items-center justify-center bg-slate-800/50">
                          <div className="text-center text-slate-400">
                            <Video className="w-5 h-5 mx-auto mb-1 opacity-50" />
                            <span className="text-[10px]">Unavailable</span>
                          </div>
                        </div>
                      )}
                      <div className="px-2 py-2 text-[10px] text-slate-200">
                        <p className="font-medium text-white truncate text-xs">{video.prompt || "Multi-image"}</p>
                        <p className="text-slate-400 truncate">
                          {video.imageCount} imgs · {video.duration}s · {video.aspectRatio || "16:9"}
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowVideoModal(false);
            }}
          >
            <div
              className="relative w-full max-w-6xl max-h-[85vh] rounded-3xl border border-white/10 bg-slate-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-slate-100 hover:bg-white/20 z-10"
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
                className="w-full h-auto max-h-[70vh] object-contain bg-black rounded-t-3xl"
              />
              <div className="p-4 text-sm text-slate-200">
                <p className="font-semibold text-white mb-1">{selectedVideo.prompt || "Multi-image interpolation"}</p>
                <p className="text-slate-400 mb-3">
                  {selectedVideo.imageCount} images · {selectedVideo.duration}s · {selectedVideo.aspectRatio || "16:9"} · {selectedVideo.model}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReuseSettings(selectedVideo)}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/30 px-4 py-2 text-sm font-medium text-violet-300 transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reuse Settings
                  </button>
                  <button
                    onClick={() => handleDownload(selectedVideo.videoUrl, `kling-multi-i2v-${selectedVideo.id}.mp4`)}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2 text-sm font-medium text-white transition"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4"
            onClick={() => setShowHistoryModal(false)}
          >
            <div
              className="relative w-full max-w-7xl max-h-[90vh] overflow-auto rounded-3xl border border-white/10 bg-slate-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-900/95 backdrop-blur p-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Library</p>
                  <h2 className="text-2xl font-bold text-white">All Recent Generations</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {generationHistory.length} video{generationHistory.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="rounded-full bg-white/10 p-2 text-slate-100 hover:bg-white/20 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                {generationHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
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
                        className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 cursor-pointer transition hover:border-violet-400/50 hover:shadow-lg hover:shadow-violet-900/20"
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
                          <div className="w-full aspect-video flex items-center justify-center bg-slate-800/50">
                            <div className="text-center text-slate-400">
                              <Video className="w-8 h-8 mx-auto mb-2" />
                              <p className="text-xs">Processing...</p>
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
                        <div className="absolute bottom-0 left-0 right-0 p-3 text-white transform translate-y-full group-hover:translate-y-0 transition">
                          <p className="text-xs font-medium line-clamp-2 mb-1">{video.prompt || "Multi-image"}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-300">
                            <span>{video.imageCount} imgs</span>
                            <span>•</span>
                            <span>{video.duration}s</span>
                            <span>•</span>
                            <span>{video.aspectRatio || "16:9"}</span>
                          </div>
                        </div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                          <div className="rounded-full bg-violet-500/20 backdrop-blur-sm px-2 py-1 text-[10px] text-violet-200 border border-violet-400/30">
                            {video.status === "completed" ? "✓ Ready" : "Processing"}
                          </div>
                        </div>
                        {/* Profile badge when viewing all profiles */}
                        {isAllProfiles && video.profileName && (
                          <div className="absolute top-2 left-2">
                            <div className="rounded-full bg-slate-900/80 backdrop-blur-sm px-2 py-1 text-[10px] text-violet-200 border border-violet-400/30">
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

      {/* Help Modal */}
      {showHelpModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
            <div className="relative max-w-3xl w-full rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-slate-100 hover:bg-white/20"
                onClick={() => setShowHelpModal(false)}
              >
                <span className="sr-only">Close</span>
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-6 text-slate-100">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-violet-400" />
                  <h3 className="text-xl font-semibold">Multi-Image to Video Guide</h3>
                </div>
                
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-4">
                    <h4 className="font-semibold text-emerald-100 mb-2">✓ Best Practices</h4>
                    <ul className="text-sm space-y-1 text-emerald-50">
                      <li>• Use 2-4 images in logical sequence</li>
                      <li>• Keep similar composition across images</li>
                      <li>• Use high-quality source images</li>
                      <li>• Consistent lighting helps smooth transitions</li>
                    </ul>
                  </div>
                  <div className="bg-red-500/10 border border-red-400/30 rounded-2xl p-4">
                    <h4 className="font-semibold text-red-100 mb-2">✗ Avoid</h4>
                    <ul className="text-sm space-y-1 text-red-50">
                      <li>• Drastically different scenes</li>
                      <li>• Low resolution images</li>
                      <li>• Inconsistent aspect ratios</li>
                      <li>• Blurry or compressed images</li>
                    </ul>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Zap className="w-4 h-4 text-violet-400" />
                      Standard Mode
                    </h4>
                    <ul className="text-sm space-y-1 text-slate-300 mt-2">
                      <li>• Faster generation time</li>
                      <li>• Good for quick previews</li>
                      <li>• Lower compute cost</li>
                    </ul>
                  </div>
                  <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-pink-400" />
                      Professional Mode
                    </h4>
                    <ul className="text-sm space-y-1 text-slate-300 mt-2">
                      <li>• Higher quality output</li>
                      <li>• Smoother transitions</li>
                      <li>• Better for final renders</li>
                    </ul>
                  </div>
                </div>

                <div className="border border-amber-400/30 bg-amber-500/10 rounded-2xl p-4">
                  <h4 className="font-semibold flex items-center gap-2 text-amber-100">
                    <AlertCircle className="w-4 h-4" />
                    Tips
                  </h4>
                  <ul className="text-sm space-y-1 text-amber-50 list-disc list-inside mt-2">
                    <li>Images are processed in the order you upload them</li>
                    <li>Use drag buttons to reorder images before generating</li>
                    <li>Prompts help guide transition style but are optional</li>
                    <li>10s duration works best with more images (4-5)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Reference Bank Selector with Multi-Select */}
      {showReferenceBankSelector && (
        <ReferenceSelector
          isOpen={true}
          onClose={() => setShowReferenceBankSelector(false)}
          onSelect={handleReferenceBankSelect}
          onSelectMultiple={handleReferenceBankMultiSelect}
          filterType="image"
          multiSelect={true}
          maxSelect={MAX_IMAGES - uploadedImages.length}
          selectedItemIds={uploadedImages.filter(img => img.referenceId).map(img => img.referenceId!)}
        />
      )}

      {/* Toast Notification */}
      {toastError && showToast && mounted &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
            <div className="flex items-start gap-3 rounded-2xl border border-red-400/50 bg-red-500/90 px-4 py-3 text-sm text-white shadow-xl backdrop-blur max-w-md">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="flex-1">{toastError}</p>
              <button
                onClick={() => {
                  setShowToast(false);
                  setTimeout(() => setToastError(null), 300);
                }}
                className="flex-shrink-0 rounded-lg p-1 hover:bg-white/20 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* Toast Notifications */}
      {toastError && showToast && mounted &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
            <div className="flex items-start gap-3 rounded-2xl border border-red-400/50 bg-red-500/90 px-4 py-3 text-sm text-white shadow-xl backdrop-blur max-w-md">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="flex-1">{toastError}</p>
              <button
                onClick={() => {
                  setShowToast(false);
                  setTimeout(() => setToastError(null), 300);
                }}
                className="flex-shrink-0 rounded-lg p-1 hover:bg-white/20 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* Credit Calculator */}
      <CreditCalculator
        path="kling-multi-image-to-video"
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
