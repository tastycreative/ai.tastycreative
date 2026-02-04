"use client";

import { useState, useEffect, useCallback, useRef } from "react";import { createPortal } from "react-dom";import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import { ReferenceSelector } from "@/components/reference-bank/ReferenceSelector";
import { ReferenceItem } from "@/hooks/useReferenceBank";
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
  ChevronUp,
  RefreshCw,
  Info,
  Settings,
  User,
  Archive,
  FolderOpen,
  Check,
  Library,
  Share2,
} from "lucide-react";

// Image compression utility - optimizes large images while preserving quality for AI generation
const compressImage = async (
  file: File,
  maxSizeMB: number = 3.5,  // Target ~3.5MB to stay safely under limits after base64 encoding
  maxWidthOrHeight: number = 3072  // Keep high resolution for better AI results
): Promise<{ base64: string; compressed: boolean; originalSize: number; newSize: number }> => {
  return new Promise((resolve, reject) => {
    const originalSize = file.size;
    
    // If file is already small enough, just convert to base64
    if (file.size <= maxSizeMB * 1024 * 1024) {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          base64: reader.result as string,
          compressed: false,
          originalSize,
          newSize: originalSize,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    // Need to compress - use canvas
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;
      
      // Only resize if truly massive - preserve resolution when possible
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

      // Use high-quality rendering
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      }

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);

      // Determine output format - prefer PNG for quality if size allows, otherwise JPEG
      const tryCompress = (quality: number, format: 'image/jpeg' | 'image/png' = 'image/jpeg'): string => {
        if (format === 'image/png') {
          return canvas.toDataURL('image/png');
        }
        return canvas.toDataURL('image/jpeg', quality);
      };

      // Start with high quality JPEG
      let quality = 0.92;
      let base64 = tryCompress(quality);
      const minQuality = 0.75;  // Don't go below 75% quality to preserve details for AI
      
      // Reduce quality until size is acceptable (base64 is ~4/3 of binary)
      while (base64.length * 0.75 > maxSizeMB * 1024 * 1024 && quality > minQuality) {
        quality -= 0.05;  // Smaller steps for finer control
        base64 = tryCompress(quality);
      }
      
      // If still too large at min quality, reduce dimensions and try again
      if (base64.length * 0.75 > maxSizeMB * 1024 * 1024) {
        const scale = 0.8;  // Reduce to 80%
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        quality = 0.85;
        base64 = tryCompress(quality);
        
        // One more quality pass if needed
        while (base64.length * 0.75 > maxSizeMB * 1024 * 1024 && quality > minQuality) {
          quality -= 0.05;
          base64 = tryCompress(quality);
        }
      }

      const newSize = Math.round(base64.length * 0.75);
      
      resolve({
        base64,
        compressed: true,
        originalSize,
        newSize,
      });
    };

    img.onerror = () => reject(new Error('Failed to load image for compression'));

    // Load image from file
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
  isDefault?: boolean;
  profileName?: string;
}

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
  profileName?: string;
  // Metadata for reuse functionality
  metadata?: {
    resolution?: "2K" | "4K";
    aspectRatio?: "1:1" | "3:4" | "4:3" | "16:9" | "9:16" | "2:3" | "3:2" | "21:9";
    watermark?: boolean;
    numReferenceImages?: number;
    referenceImageUrls?: string[];
    profileId?: string;
  };
}

interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  category: string;
  description: string;
  resolution?: "2K" | "4K";
  aspectRatio?: "1:1" | "3:4" | "4:3" | "16:9" | "9:16" | "2:3" | "3:2" | "21:9";
}

interface UserPreset {
  id: string;
  name: string;
  resolution: "2K" | "4K";
  aspectRatio: "1:1" | "3:4" | "4:3" | "16:9" | "9:16" | "2:3" | "3:2" | "21:9";
  folderId?: string;
}

interface CompressionProgress {
  imageId: string;
  fileName: string;
  progress: number;
  originalSize: number;
  currentSize?: number;
}

// Maximum number of reference images that can be uploaded (0 = unlimited)
const MAX_REFERENCE_IMAGES = 0;

export default function SeeDreamImageToImage() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();

  // Track which images have been saved to Reference Bank to prevent duplicates
  const savedToReferenceBankRef = useRef<Set<string>>(new Set());

  // Form State
  const [prompt, setPrompt] = useState("");
  const [selectedResolution, setSelectedResolution] = useState<"2K" | "4K">("2K");
  const [selectedRatio, setSelectedRatio] = useState<"1:1" | "3:4" | "4:3" | "16:9" | "9:16" | "2:3" | "3:2" | "21:9">("1:1");
  const [uploadedImages, setUploadedImages] = useState<Array<{ 
    id: string; 
    base64: string; 
    file?: File; 
    wasCompressed?: boolean;
    fromReferenceBank?: boolean;
    referenceId?: string;
    url?: string;
  }>>([]);
  const [maxImages, setMaxImages] = useState(1);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSavingToReferenceBank, setIsSavingToReferenceBank] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  // Drag and Drop State
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<CompressionProgress[]>([]);
  
  // Folder Validation
  const [showFolderValidation, setShowFolderValidation] = useState(false);
  
  // Prompt Templates & Presets
  const [showTemplates, setShowTemplates] = useState(false);
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState("");
  
  // Collapsible Sections for Mobile
  const [sectionsCollapsed, setSectionsCollapsed] = useState({
    upload: false,
    prompt: false,
    framing: false,
    vault: false,
    batch: false
  });

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

  // View All History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Reference Bank Selector State
  const [showReferenceBankSelector, setShowReferenceBankSelector] = useState(false);

  // Folder Selection State
  const [targetFolder, setTargetFolder] = useState<string>("");

  // Use global profile from header
  const { profileId: globalProfileId, selectedProfile, isAllProfiles } = useInstagramProfile();

  // Helper to check if current profile is shared (not owned by current user)
  const isSharedProfile = selectedProfile && selectedProfile.clerkId !== user?.id && selectedProfile.user?.clerkId !== user?.id;
  
  // Helper to get owner display name for shared profiles
  const getOwnerDisplayName = () => {
    if (!selectedProfile?.user) return null;
    if (selectedProfile.user.firstName && selectedProfile.user.lastName) {
      return `${selectedProfile.user.firstName} ${selectedProfile.user.lastName}`;
    }
    if (selectedProfile.user.firstName) return selectedProfile.user.firstName;
    if (selectedProfile.user.name) return selectedProfile.user.name;
    if (selectedProfile.user.email) return selectedProfile.user.email.split('@')[0];
    return null;
  };

  // Hydration fix - track if component is mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    
    // Check for reuse data from Vault or other sources
    const checkForReuseData = async () => {
      try {
        const reuseDataStr = sessionStorage.getItem('seedream-i2i-reuse');
        if (reuseDataStr) {
          const reuseData = JSON.parse(reuseDataStr);
          
          // Clear the sessionStorage immediately to prevent re-applying
          sessionStorage.removeItem('seedream-i2i-reuse');
          
          // Apply the reuse data
          if (reuseData.prompt) {
            setPrompt(reuseData.prompt);
          }
          if (reuseData.resolution) {
            setSelectedResolution(reuseData.resolution as "2K" | "4K");
          }
          if (reuseData.aspectRatio) {
            setSelectedRatio(reuseData.aspectRatio as typeof selectedRatio);
          }
          
          // Load reference images if available
          if (reuseData.referenceImageUrls && reuseData.referenceImageUrls.length > 0) {
            setIsCompressing(true);
            const loadedImages: Array<{
              id: string;
              base64: string;
              wasCompressed: boolean;
              fromReferenceBank: boolean;
              url: string;
            }> = [];

            for (const url of reuseData.referenceImageUrls) {
              try {
                const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
                if (proxyResponse.ok) {
                  const blob = await proxyResponse.blob();
                  const reader = new FileReader();
                  const base64Promise = new Promise<string>((resolve, reject) => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                  });
                  const base64 = await base64Promise;

                  loadedImages.push({
                    id: `reuse-${Date.now()}-${loadedImages.length}`,
                    base64,
                    wasCompressed: false,
                    fromReferenceBank: true,
                    url,
                  });
                }
              } catch (err) {
                console.warn('Failed to load reference image:', url, err);
              }
            }

            if (loadedImages.length > 0) {
              setUploadedImages(loadedImages);
            }
            setIsCompressing(false);
          }
          
          console.log('Applied reuse data from Vault');
        }
      } catch (err) {
        console.error('Error loading reuse data:', err);
      }
    };
    
    checkForReuseData();
  }, []);

  // Load smart defaults from localStorage per profile
  useEffect(() => {
    if (!mounted || !globalProfileId) return;
    
    const savedSettingsKey = `seedream-i2i-settings-${globalProfileId}`;
    const savedSettings = localStorage.getItem(savedSettingsKey);
    
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.resolution) setSelectedResolution(settings.resolution);
        if (settings.aspectRatio) setSelectedRatio(settings.aspectRatio);
        if (settings.folderId) setTargetFolder(settings.folderId);
      } catch (e) {
        console.error('Failed to load saved I2I settings:', e);
      }
    }
  }, [mounted, globalProfileId]);

  // Load user presets
  useEffect(() => {
    if (!mounted) return;
    
    const savedPresets = localStorage.getItem('seedream-i2i-presets');
    if (savedPresets) {
      try {
        setUserPresets(JSON.parse(savedPresets));
      } catch (e) {
        console.error('Failed to load I2I presets:', e);
      }
    }
  }, [mounted]);

  // Save settings when they change
  useEffect(() => {
    if (!mounted || !globalProfileId) return;
    
    const settingsToSave = {
      resolution: selectedResolution,
      aspectRatio: selectedRatio,
      folderId: targetFolder
    };
    
    const savedSettingsKey = `seedream-i2i-settings-${globalProfileId}`;
    localStorage.setItem(savedSettingsKey, JSON.stringify(settingsToSave));
  }, [mounted, globalProfileId, selectedResolution, selectedRatio, targetFolder]);

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

  // Vault Integration State - only folders for the selected profile
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
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

  // I2I-Specific Prompt Templates
  const promptTemplates: PromptTemplate[] = [
    {
      id: "style-transfer",
      name: "Style Transfer",
      category: "Artistic",
      description: "Change artistic style while keeping subject",
      prompt: "Keep the subject and composition exactly as shown, but transform the artistic style to [art style: oil painting/watercolor/anime/3D render/sketch]. Maintain all key features and poses, only change the rendering style and artistic technique.",
      resolution: "4K",
      aspectRatio: "1:1"
    },
    {
      id: "outfit-swap",
      name: "Outfit Swap",
      category: "Fashion",
      description: "Change clothing while keeping pose and face",
      prompt: "Keep the person's face, pose, and body position exactly the same. Only change their outfit to [describe new clothing: elegant evening gown/casual streetwear/business suit]. Maintain the same background, lighting, and camera angle.",
      resolution: "2K",
      aspectRatio: "3:4"
    },
    {
      id: "background-replace",
      name: "Background Replacement",
      category: "Environment",
      description: "Change environment while keeping subject",
      prompt: "Keep the main subject exactly as shown with the same pose, lighting, and details. Replace only the background with [new environment: tropical beach/modern office/fantasy castle/urban street]. Ensure natural integration and consistent lighting.",
      resolution: "4K",
      aspectRatio: "16:9"
    },
    {
      id: "artistic-transform",
      name: "Artistic Transformation",
      category: "Creative",
      description: "Convert photo to different medium",
      prompt: "Convert this photograph into [artistic medium: oil painting/charcoal sketch/digital illustration/3D CGI render/comic book art]. Preserve the composition, subject, and key details while applying the characteristics and techniques of the chosen medium.",
      resolution: "4K",
      aspectRatio: "1:1"
    },
    {
      id: "color-grading",
      name: "Color Grading",
      category: "Mood",
      description: "Adjust color palette and mood",
      prompt: "Keep the composition, subjects, and details identical. Only adjust the color grading and mood to [color palette/mood: cinematic teal and orange/warm golden hour/moody desaturated/vibrant neon/vintage film]. Maintain lighting direction while shifting color temperature.",
      resolution: "2K",
      aspectRatio: "16:9"
    },
    {
      id: "time-of-day",
      name: "Time of Day Change",
      category: "Lighting",
      description: "Change time of day and lighting",
      prompt: "Keep the exact scene and composition, but change the time of day to [time: golden hour sunset/blue hour evening/midday bright sun/night with moonlight]. Adjust lighting, shadows, and sky color accordingly while preserving all elements.",
      resolution: "4K",
      aspectRatio: "21:9"
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
        ? `/api/generate/seedream-image-to-image?profileId=${globalProfileId}`
        : "/api/generate/seedream-image-to-image";
      const response = await apiClient.get(url);
      if (response.ok) {
        const data = await response.json();
        const images = data.images || [];
        console.log('📋 Loaded I2I generation history:', images.length, 'images for profile:', globalProfileId);
        console.log('📋 Image URLs present:', images.filter((i: any) => !!i.imageUrl).length);
        setGenerationHistory(images);
      } else {
        console.error('Failed to load I2I history:', response.status);
      }
    } catch (error) {
      console.error('Error loading I2I history:', error);
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

  // Get display text for the selected folder
  const getSelectedFolderDisplay = (): string => {
    if (!targetFolder || !globalProfileId) return 'Please select a vault folder to save your images';
    
    const folder = vaultFolders.find(f => f.id === targetFolder);
    if (folder) {
      // If viewing all profiles, use the folder's profileName
      if (isAllProfiles && folder.profileName) {
        return `Saving to Vault: ${folder.profileName} / ${folder.name}`;
      }
      // Otherwise use the selected profile
      if (selectedProfile) {
        const profileDisplay = selectedProfile.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile.name;
        const sharedIndicator = isSharedProfile ? ' (Shared)' : '';
        return `Saving to Vault: ${profileDisplay}${sharedIndicator} / ${folder.name}`;
      }
    }
    return 'Please select a vault folder';
  };

  // Save uploaded image to Reference Bank
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
      
      // Check if a similar file already exists in Reference Bank (by size and name pattern)
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
          // Continue with save if check fails
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
          tags: ['seedream', 'reference'],
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
      setError('All selected images are already added');
      setShowReferenceBankSelector(false);
      return;
    }

    setIsCompressing(true);
    const loadedImages: Array<{
      id: string;
      base64: string;
      wasCompressed: boolean;
      fromReferenceBank: boolean;
      referenceId: string;
      url: string;
    }> = [];

    for (const item of newItems) {
      try {
        // Use a proxy to fetch the image to avoid CORS issues
        const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(item.awsS3Url)}`);
        
        if (!proxyResponse.ok) {
          // Fallback: use the URL directly without base64 conversion
          loadedImages.push({
            id: `ref-${item.id}-${Date.now()}`,
            base64: item.awsS3Url, // Use URL as fallback
            wasCompressed: false,
            fromReferenceBank: true,
            referenceId: item.id,
            url: item.awsS3Url,
          });
          continue;
        }
        
        const blob = await proxyResponse.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        loadedImages.push({
          id: `ref-${item.id}-${Date.now()}`,
          base64,
          wasCompressed: false,
          fromReferenceBank: true,
          referenceId: item.id,
          url: item.awsS3Url,
        });
      } catch (err) {
        console.error('Error loading reference image:', item.name, err);
      }
    }

    if (loadedImages.length > 0) {
      setUploadedImages((prev) => [...prev, ...loadedImages]);
    } else {
      setError('Failed to load selected images. Please try again.');
    }

    setIsCompressing(false);
    setShowReferenceBankSelector(false);
  };

  // Preset Management
  const saveAsPreset = () => {
    if (!presetName.trim()) return;
    
    const newPreset: UserPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      resolution: selectedResolution,
      aspectRatio: selectedRatio,
      folderId: targetFolder || undefined
    };
    
    const updatedPresets = [...userPresets, newPreset];
    setUserPresets(updatedPresets);
    localStorage.setItem('seedream-i2i-presets', JSON.stringify(updatedPresets));
    setPresetName("");
    setShowPresetModal(false);
  };

  const loadPreset = (preset: UserPreset) => {
    setSelectedResolution(preset.resolution);
    setSelectedRatio(preset.aspectRatio);
    if (preset.folderId) setTargetFolder(preset.folderId);
  };

  const deletePreset = (presetId: string) => {
    const updatedPresets = userPresets.filter(p => p.id !== presetId);
    setUserPresets(updatedPresets);
    localStorage.setItem('seedream-i2i-presets', JSON.stringify(updatedPresets));
  };

  const applyTemplate = (template: PromptTemplate) => {
    setPrompt(template.prompt);
    if (template.resolution) setSelectedResolution(template.resolution);
    if (template.aspectRatio) setSelectedRatio(template.aspectRatio);
    setShowTemplates(false);
  };

  // Enhanced batch image upload handler
  const handleBatchImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCompressing(true);
    setError(null);
    const newImages: typeof uploadedImages = [];
    
    // Track compression progress
    const progressItems: CompressionProgress[] = Array.from(files).map((file, idx) => ({
      imageId: `img-${Date.now()}-${idx}`,
      fileName: file.name,
      progress: 0,
      originalSize: file.size
    }));
    setCompressionProgress(progressItems);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Update progress
        setCompressionProgress(prev => 
          prev.map(p => p.fileName === file.name ? { ...p, progress: 50 } : p)
        );
        
        // Compress image
        const result = await compressImage(file, 2, 2048);
        
        newImages.push({
          id: progressItems[i].imageId,
          base64: result.base64,
          file,
          wasCompressed: result.compressed,
          fromReferenceBank: false,
        });
        
        // Update progress complete
        setCompressionProgress(prev => 
          prev.map(p => p.fileName === file.name ? { ...p, progress: 100, currentSize: result.newSize } : p)
        );
      }
      
      setUploadedImages(prev => [...prev, ...newImages]);
      
      // Clear progress after a moment
      setTimeout(() => setCompressionProgress([]), 1000);
    } catch (err) {
      console.error('Batch upload failed:', err);
      setError('Failed to process some images. Please try again.');
    } finally {
      setIsCompressing(false);
    }
    
    e.target.value = '';
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDragOverZone = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDropZone = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return;

    setIsCompressing(true);
    setError(null);
    const newImages: typeof uploadedImages = [];
    
    const progressItems: CompressionProgress[] = files.map((file, idx) => ({
      imageId: `img-${Date.now()}-${idx}`,
      fileName: file.name,
      progress: 0,
      originalSize: file.size
    }));
    setCompressionProgress(progressItems);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        setCompressionProgress(prev => 
          prev.map(p => p.fileName === file.name ? { ...p, progress: 50 } : p)
        );
        
        const result = await compressImage(file, 2, 2048);
        
        newImages.push({
          id: progressItems[i].imageId,
          base64: result.base64,
          file,
          wasCompressed: result.compressed,
          fromReferenceBank: false,
        });
        
        setCompressionProgress(prev => 
          prev.map(p => p.fileName === file.name ? { ...p, progress: 100, currentSize: result.newSize } : p)
        );
      }
      
      setUploadedImages(prev => [...prev, ...newImages]);
      setTimeout(() => setCompressionProgress([]), 1000);
    } catch (err) {
      console.error('Drop upload failed:', err);
      setError('Failed to process dropped images.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Use batch handler for consistency
    await handleBatchImageUpload(e);
  };

  const handleRemoveImage = (imageId: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== imageId));
    // Also remove from the saved tracking ref
    savedToReferenceBankRef.current.delete(imageId);
  };

  const handleMoveImageUp = (index: number) => {
    if (index === 0) return;
    setUploadedImages((prev) => {
      const newImages = [...prev];
      [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
      return newImages;
    });
  };

  const handleMoveImageDown = (index: number) => {
    if (index === uploadedImages.length - 1) return;
    setUploadedImages((prev) => {
      const newImages = [...prev];
      [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
      return newImages;
    });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    setUploadedImages((prev) => {
      const newImages = [...prev];
      // Swap the dragged image with the drop target image
      [newImages[draggedIndex], newImages[dropIndex]] = [newImages[dropIndex], newImages[draggedIndex]];
      return newImages;
    });
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
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

    if (uploadedImages.length === 0) {
      setError("Please upload at least one reference image");
      return;
    }

    // Images are already compressed during upload, but do a final sanity check
    const MAX_TOTAL_PAYLOAD_MB = 15; // 15MB total payload limit (generous since images are pre-compressed)
    
    let totalSize = 0;
    for (const img of uploadedImages) {
      // Calculate approximate size of base64 string in bytes
      const base64Size = img.base64.length * 0.75; // base64 is ~4/3 of original
      totalSize += base64Size;
    }
    
    if (totalSize > MAX_TOTAL_PAYLOAD_MB * 1024 * 1024) {
      setError(`Total payload is too large. Please remove some reference images and try again.`);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);
    
    const taskId = `seedream-i2i-${Date.now()}`;
    
    // Track reference image URLs locally (for use in payload)
    // Start with URLs from images already in reference bank
    const savedReferenceUrls: Map<string, string> = new Map();
    uploadedImages.forEach(img => {
      if (img.url) {
        savedReferenceUrls.set(img.id, img.url);
      }
    });
    
    // Save new uploads to Reference Bank before generating (only those not already saved)
    // Additional checks: ensure image doesn't already have a referenceId or url (indicating it's already saved)
    // Also check the savedToReferenceBankRef to prevent re-saving during the same session
    if (globalProfileId) {
      const unsavedImages = uploadedImages.filter(img => 
        !img.fromReferenceBank && 
        !img.referenceId && 
        !img.url && 
        img.file &&
        !savedToReferenceBankRef.current.has(img.id)  // Also check ref to prevent session duplicates
      );
      
      // Debug log to help trace duplicate issues
      console.log('📸 Reference image check:', {
        totalImages: uploadedImages.length,
        unsavedCount: unsavedImages.length,
        alreadySavedInSession: Array.from(savedToReferenceBankRef.current),
        images: uploadedImages.map(img => ({
          id: img.id,
          fromReferenceBank: img.fromReferenceBank,
          hasReferenceId: !!img.referenceId,
          hasUrl: !!img.url,
          hasFile: !!img.file,
          savedInSession: savedToReferenceBankRef.current.has(img.id),
          willBeSaved: !img.fromReferenceBank && !img.referenceId && !img.url && !!img.file && !savedToReferenceBankRef.current.has(img.id)
        }))
      });
      
      if (unsavedImages.length > 0) {
        setIsSavingToReferenceBank(true);
        for (const img of unsavedImages) {
          try {
            // Mark as being saved immediately to prevent race conditions
            savedToReferenceBankRef.current.add(img.id);
            
            // Pass skipIfExists: true to avoid creating duplicates
            const saveResult = await saveToReferenceBank(img.base64, img.file?.name || 'reference.jpg', img.file, true);
            if (saveResult) {
              // Track the URL locally for use in payload
              savedReferenceUrls.set(img.id, saveResult.url);
              
              // Update the uploaded image with the reference ID and URL
              setUploadedImages((prev) => 
                prev.map(existingImg => 
                  existingImg.id === img.id 
                    ? { ...existingImg, referenceId: saveResult.id, url: saveResult.url, fromReferenceBank: true }
                    : existingImg
                )
              );
              console.log('Image saved to Reference Bank:', saveResult.id, 'URL:', saveResult.url);
            }
          } catch (err) {
            console.warn('Failed to save image to Reference Bank:', err);
            // Continue with generation even if save fails
          }
        }
        setIsSavingToReferenceBank(false);
      }
    }
    
    // Build the reference URLs array using our local tracking (to avoid state timing issues)
    const referenceImageUrls = uploadedImages
      .map(img => savedReferenceUrls.get(img.id))
      .filter((url): url is string => !!url);
    
    console.log('Reference image URLs to save:', referenceImageUrls);
    
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
        // Include resolution and aspectRatio for metadata storage
        resolution: selectedResolution,
        aspectRatio: selectedRatio,
        // Store reference image URLs for reuse functionality (using locally tracked URLs)
        referenceImageUrls: referenceImageUrls,
      };

      // Get profileId from the selected folder
      const selectedFolder = vaultFolders.find(f => f.id === targetFolder);
      const folderProfileId = selectedFolder?.profileId || globalProfileId;

      // Handle folder selection
      if (targetFolder && folderProfileId) {
        payload.saveToVault = true;
        payload.vaultProfileId = folderProfileId;
        payload.vaultFolderId = targetFolder;
      }
      
      // Also include profileId even if not saving to vault (for filtering history)
      if (folderProfileId) {
        payload.vaultProfileId = folderProfileId;
      }

      // Add batch generation config
      if (maxImages > 1) {
        payload.sequential_image_generation_options = {
          max_images: maxImages,
        };
      }

      // Calculate dynamic timeout: 1 minute per image (minimum 2 minutes)
      const timeoutMs = Math.max(maxImages * 60000, 120000);
      console.log(`⏱️ Setting timeout to ${timeoutMs / 1000}s for ${maxImages} image(s)`);

      const response = await apiClient.post("/api/generate/seedream-image-to-image", payload, { timeout: timeoutMs });
      
      if (!response.ok) {
        // Handle non-JSON error responses (e.g., "Request Entity Too Large" from CDN/proxy)
        let errorMessage = "Generation failed";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || "Generation failed";
          } else {
            // Non-JSON response (plain text error from CDN/proxy)
            const errorText = await response.text();
            console.error("Non-JSON error response:", errorText);
            
            // Provide user-friendly error messages for common issues
            if (response.status === 413 || errorText.toLowerCase().includes("entity too large") || errorText.toLowerCase().includes("payload too large")) {
              errorMessage = "Image file is too large. Please use smaller images (under 4MB each) or reduce image quality.";
            } else if (response.status === 408 || errorText.toLowerCase().includes("timeout")) {
              errorMessage = "Request timed out. Please try with fewer images (max 5 per batch).";
            } else if (response.status === 504 || errorText.includes("FUNCTION_INVOCATION_TIMEOUT")) {
              errorMessage = "Server timeout: Generation took too long. Please try with fewer images (1-3 recommended) or simpler prompts.";
            } else if (response.status === 502 || response.status === 503) {
              errorMessage = "Server is temporarily unavailable. Please try again in a few moments.";
            } else {
              errorMessage = `Server error (${response.status}): ${errorText.substring(0, 100)}`;
            }
          }
        } catch (parseError) {
          console.error("Error parsing response:", parseError);
          errorMessage = `Request failed with status ${response.status}. Please try with smaller images.`;
        }
        throw new Error(errorMessage);
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

      console.log('📋 Generated I2I images:', images.length);
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
    setError(null);
    setGeneratedImages([]);
    setUploadedImages([]);
    // Clear the saved tracking ref
    savedToReferenceBankRef.current.clear();
  };

  // Handle reusing generation parameters from a previous generation
  const handleReuseGeneration = async (image: GeneratedImage) => {
    // Set the prompt
    if (image.prompt) {
      setPrompt(image.prompt);
    }

    // Set resolution and aspect ratio from metadata
    if (image.metadata?.resolution) {
      setSelectedResolution(image.metadata.resolution);
    }
    if (image.metadata?.aspectRatio) {
      setSelectedRatio(image.metadata.aspectRatio);
    }

    // Load reference images from URLs if available
    if (image.metadata?.referenceImageUrls && image.metadata.referenceImageUrls.length > 0) {
      setIsCompressing(true);
      const loadedImages: Array<{
        id: string;
        base64: string;
        wasCompressed: boolean;
        fromReferenceBank: boolean;
        url: string;
      }> = [];

      for (const url of image.metadata.referenceImageUrls) {
        try {
          // Fetch image via proxy to avoid CORS issues
          const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
          if (proxyResponse.ok) {
            const blob = await proxyResponse.blob();
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            const base64 = await base64Promise;

            loadedImages.push({
              id: `reuse-${Date.now()}-${loadedImages.length}`,
              base64,
              wasCompressed: false,
              fromReferenceBank: true,
              url,
            });
          }
        } catch (err) {
          console.warn('Failed to load reference image:', url, err);
        }
      }

      if (loadedImages.length > 0) {
        setUploadedImages(loadedImages);
      }
      setIsCompressing(false);
    }

    // Close the modal
    setShowImageModal(false);
    setSelectedImage(null);

    // Scroll to the top of the page to show the form
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
        {/* Shared Profile Indicator */}
        {mounted && isSharedProfile && selectedProfile && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Share2 className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-blue-300 mb-1 flex items-center gap-2">
                Working with Shared Profile
              </h3>
              <p className="text-xs text-blue-200/70 leading-relaxed">
                You're generating content for <span className="font-semibold text-blue-300">{selectedProfile.name}</span>
                {getOwnerDisplayName() && (
                  <span> (shared by <span className="font-semibold">{getOwnerDisplayName()}</span>)</span>
                )}. Generated images will be saved to this profile's vault and history.
              </p>
            </div>
          </div>
        )}
        
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
                <div className="flex items-center justify-between w-full group">
                  <label className="text-sm font-semibold text-white">Reference Images</label>
                  <div className="flex items-center gap-2">
                    {/* Reference Bank Button */}
                    {mounted && (
                      <button
                        type="button"
                        onClick={() => setShowReferenceBankSelector(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 transition-all"
                        disabled={isGenerating}
                      >
                        <Library className="w-3.5 h-3.5" />
                        Reference Bank
                      </button>
                    )}
                    <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-[11px] font-semibold text-cyan-100">{uploadedImages.length || 0} added</span>
                    <button
                      type="button"
                      onClick={() => setSectionsCollapsed(prev => ({ ...prev, upload: !prev.upload }))}
                      className="lg:hidden p-1 hover:bg-white/10 rounded-lg transition"
                    >
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${sectionsCollapsed.upload ? '' : 'rotate-180'}`} />
                    </button>
                  </div>
                </div>

                <div className={`space-y-2 ${sectionsCollapsed.upload ? 'hidden lg:block' : ''}`}>

                {/* Uploaded Images Grid with Reordering */}
                {uploadedImages.length > 0 && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      {uploadedImages.map((img, index) => (
                        <div 
                          key={img.id} 
                          className="relative group"
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                        >
                          <div className={`relative overflow-hidden rounded-xl border ${
                            draggedIndex === index 
                              ? 'border-cyan-400 shadow-lg shadow-cyan-400/50 opacity-50 scale-95' 
                              : img.fromReferenceBank 
                                ? 'border-violet-500/30' 
                                : 'border-white/10'
                          } bg-white/5 shadow-lg shadow-cyan-900/30 transition-all hover:-translate-y-1 hover:shadow-2xl ${draggedIndex !== null ? 'cursor-move' : ''}`}>
                            <img
                              src={img.base64}
                              alt={`Reference ${index + 1}`}
                              className="w-full h-32 object-contain p-2"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 transition group-hover:opacity-100" />
                            
                            {/* Reordering Controls (only visible on hover) */}
                            <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              {/* Move Up Button */}
                              {index > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveImageUp(index);
                                  }}
                                  disabled={isGenerating}
                                  className="rounded-md bg-slate-900/90 p-1 text-cyan-300 border border-white/20 hover:bg-cyan-500/20 hover:border-cyan-400 transition"
                                  title="Move up"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                              )}
                              
                              {/* Move Down Button */}
                              {index < uploadedImages.length - 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveImageDown(index);
                                  }}
                                  disabled={isGenerating}
                                  className="rounded-md bg-slate-900/90 p-1 text-cyan-300 border border-white/20 hover:bg-cyan-500/20 hover:border-cyan-400 transition"
                                  title="Move down"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              )}
                              
                              {/* Remove Button */}
                              <button
                                onClick={() => handleRemoveImage(img.id)}
                                disabled={isGenerating}
                                className="rounded-md bg-red-500/20 p-1 text-red-300 border border-red-500/40 hover:bg-red-500/30 hover:border-red-400 transition"
                                title="Remove image"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            {/* Reference Bank indicator */}
                            {img.fromReferenceBank && (
                              <div className="absolute top-2 left-2">
                                <span className="rounded-full bg-violet-500/90 p-1.5 shadow" title="From Reference Bank">
                                  <Library className="w-3 h-3 text-white" />
                                </span>
                              </div>
                            )}
                            
                            {/* Position and Status Badges */}
                            <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-1.5">
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold shadow ${
                                index === 0 ? 'bg-cyan-500/90 text-white' : 'bg-white/90 text-slate-900'
                              }`}>
                                {index === 0 ? '⭐ Primary' : `Ref ${index + 1}`}
                              </span>
                              {img.wasCompressed && !img.fromReferenceBank && (
                                <span className="rounded-full bg-emerald-500/90 px-2 py-1 text-[10px] font-semibold text-white shadow" title="Image was automatically optimized">
                                  ✓ Optimized
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 text-center flex items-center justify-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Drag images to reorder or use arrow buttons • First image is primary reference
                    </p>
                  </div>
                )}

                {/* Compression Progress Indicator */}
                {compressionProgress.length > 0 && (
                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 space-y-2">
                    <p className="text-xs font-semibold text-blue-200 flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Optimizing images...
                    </p>
                    {compressionProgress.map((item) => (
                      <div key={item.imageId} className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-blue-100">
                          <span className="truncate max-w-[150px]">{item.fileName}</span>
                          <span>{item.progress}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-blue-900/40 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        {item.currentSize && (
                          <p className="text-[10px] text-blue-200/70">
                            {(item.originalSize / 1024 / 1024).toFixed(1)}MB → {(item.currentSize / 1024 / 1024).toFixed(1)}MB
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload New Image Button with Drag & Drop */}
                <label 
                  className={`group flex flex-col items-center justify-center w-full h-32 rounded-xl border border-dashed transition-all ${
                    isDraggingOver
                      ? 'border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-400/30 scale-[1.02]'
                      : 'border-white/20 bg-slate-950/60 hover:border-cyan-200/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-900/30'
                  } ${isCompressing || isGenerating ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOverZone}
                  onDrop={handleDropZone}
                >
                  <div className="flex flex-col items-center justify-center py-4 pointer-events-none">
                    <div className="relative mb-2">
                      <div className={`absolute inset-0 blur-xl opacity-20 transition-opacity ${
                        isDraggingOver ? 'bg-cyan-400 opacity-60' : 'bg-cyan-500 group-hover:opacity-40'
                      }`} />
                      {isCompressing ? (
                        <Loader2 className="relative w-8 h-8 text-cyan-200 animate-spin" />
                      ) : isDraggingOver ? (
                        <Download className="relative w-8 h-8 text-cyan-300 animate-bounce" />
                      ) : (
                        <Upload className="relative w-8 h-8 text-cyan-200 group-hover:scale-110 transition-transform" />
                      )}
                    </div>
                    <p className="text-sm text-white">
                      <span className="font-semibold text-cyan-100">
                        {isCompressing 
                          ? 'Optimizing images...' 
                          : isDraggingOver
                            ? 'Drop images here'
                            : uploadedImages.length === 0 
                              ? 'Upload or drop primary image' 
                              : 'Add more references'}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-300 mt-1">
                      {isCompressing 
                        ? 'Large images are automatically compressed' 
                        : isDraggingOver
                          ? 'Release to upload'
                          : 'PNG, JPG, WEBP • Multiple files supported • Auto-optimized'}
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handleBatchImageUpload}
                    disabled={isGenerating || isCompressing}
                  />
                </label>

                {uploadedImages.length > 0 && (
                  <p className="text-xs text-slate-300 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    First image (⭐ Primary) is main reference; others provide style/composition cues.
                  </p>
                )}

                {isSavingToReferenceBank && (
                  <p className="text-xs text-cyan-400 flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Saving to Reference Bank...
                  </p>
                )}
              </div>
              </div>

              {/* Prompt Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between w-full group">
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
                    <button
                      type="button"
                      onClick={() => setSectionsCollapsed(prev => ({ ...prev, prompt: !prev.prompt }))}
                      className="lg:hidden p-1 hover:bg-white/10 rounded-lg transition"
                    >
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${sectionsCollapsed.prompt ? '' : 'rotate-180'}`} />
                    </button>
                  </div>
                </div>

                <div className={`space-y-2 ${sectionsCollapsed.prompt ? 'hidden lg:block' : ''}`}>
                {/* Prompt Templates Dropdown */}
                {showTemplates && (
                  <div className="rounded-2xl border border-indigo-400/30 bg-indigo-950/40 backdrop-blur p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-indigo-200">I2I Templates</p>
                      <button
                        onClick={() => setShowTemplates(false)}
                        className="text-indigo-300 hover:text-indigo-100 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid gap-2 max-h-80 overflow-y-auto">
                      {promptTemplates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => applyTemplate(template)}
                          className="text-left p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-indigo-300/40 transition-all group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-semibold text-white">{template.name}</p>
                                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded">{template.category}</span>
                              </div>
                              <p className="text-xs text-slate-400 mb-2">{template.description}</p>
                              <p className="text-xs text-slate-300 line-clamp-2">{template.prompt}</p>
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
                    placeholder="Describe the changes: keep pose, swap outfit to ..."
                    className="relative w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                    rows={4}
                    disabled={isGenerating}
                  />
                </div>
                
                {/* Character Counter */}
                <div className="flex items-center justify-between text-xs">
                  <p className="text-slate-300">Be explicit about what stays vs. changes. Under 600 words.</p>
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
              </div>

              {/* User Presets */}
              {userPresets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Your Presets</p>
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
                <div className="flex items-center justify-between w-full group">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-cyan-300" />
                    <p className="text-sm font-semibold text-white">Framing</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSectionsCollapsed(prev => ({ ...prev, framing: !prev.framing }))}
                    className="lg:hidden p-1 hover:bg-white/10 rounded-lg transition"
                  >
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${sectionsCollapsed.framing ? '' : 'rotate-180'}`} />
                  </button>
                </div>

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
                <div className="flex items-center justify-between w-full group">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-cyan-300" />
                    <p className="text-sm font-semibold text-white">Save to Vault</p>
                    {!targetFolder && showFolderValidation && (
                      <span className="text-xs bg-red-500/20 text-red-200 px-2 py-1 rounded-full animate-pulse">⚠️ Required</span>
                    )}
                    {isLoadingVaultData && (
                      <Loader2 className="w-3 h-3 animate-spin text-cyan-300" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSectionsCollapsed(prev => ({ ...prev, vault: !prev.vault }))}
                    className="lg:hidden p-1 hover:bg-white/10 rounded-lg transition"
                  >
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${sectionsCollapsed.vault ? '' : 'rotate-180'}`} />
                  </button>
                </div>
                
                <div className={`space-y-3 ${sectionsCollapsed.vault ? 'hidden lg:block' : ''}`}>
                {/* Modern Custom Dropdown */}
                <div ref={folderDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (!(!mounted || isLoadingVaultData || isGenerating || !globalProfileId)) {
                        setFolderDropdownOpen(!folderDropdownOpen);
                        setShowFolderValidation(false);
                      }
                    }}
                    disabled={!mounted || isLoadingVaultData || isGenerating || !globalProfileId}
                    className={`
                      w-full flex items-center justify-between gap-3 px-4 py-3.5
                      rounded-2xl border transition-all duration-200
                      ${folderDropdownOpen 
                        ? 'border-cyan-400 bg-cyan-500/10 ring-2 ring-cyan-400/30' 
                        : !targetFolder && showFolderValidation
                        ? 'border-red-400 bg-red-500/10 ring-2 ring-red-400/30 animate-pulse'
                        : 'border-white/10 bg-slate-800/80 hover:border-cyan-400/50 hover:bg-slate-800'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`
                        flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
                        ${targetFolder 
                          ? 'bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border border-cyan-400/30' 
                          : 'bg-slate-700/50 border border-white/5'
                        }
                      `}>
                        <FolderOpen className={`w-4 h-4 ${targetFolder ? 'text-cyan-300' : 'text-slate-400'}`} />
                      </div>
                      <div className="text-left min-w-0">
                        <p className={`text-sm font-medium truncate ${targetFolder ? 'text-white' : 'text-slate-400'}`}>
                          {targetFolder 
                            ? vaultFolders.find(f => f.id === targetFolder)?.name || 'Select folder...'
                            : 'Select a folder...'
                          }
                        </p>
                        {targetFolder && selectedProfile && (
                          <p className="text-[11px] text-cyan-300/70 truncate">
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
                        {!targetFolder && <Check className="w-4 h-4 text-cyan-400 ml-auto" />}
                      </button>

                      {vaultFolders.filter(f => !f.isDefault).length > 0 && (
                        <div className="my-2 mx-3 h-px bg-white/5" />
                      )}

                      {/* Folder Options */}
                      <div className="max-h-[200px] overflow-y-auto">
                        {isAllProfiles ? (
                          // Group folders by profile when viewing all profiles
                          Object.entries(
                            vaultFolders.filter(f => !f.isDefault).reduce((acc, folder) => {
                              const profileName = folder.profileName || 'Unknown Profile';
                              if (!acc[profileName]) acc[profileName] = [];
                              acc[profileName].push(folder);
                              return acc;
                            }, {} as Record<string, VaultFolder[]>)
                          ).map(([profileName, folders]) => (
                            <div key={profileName}>
                              <div className="px-4 py-2 text-xs font-medium text-cyan-300 bg-cyan-500/10 border-b border-cyan-500/20">
                                {profileName}
                              </div>
                              {folders.map((folder) => (
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
                                      ? 'bg-cyan-500/15' 
                                      : 'hover:bg-white/5'
                                    }
                                  `}
                                >
                                  <div className={`
                                    w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                                    ${targetFolder === folder.id 
                                      ? 'bg-gradient-to-br from-cyan-500/40 to-blue-500/40 border border-cyan-400/40' 
                                      : 'bg-slate-700/50 border border-white/5'
                                    }
                                  `}>
                                    <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? 'text-cyan-300' : 'text-slate-400'}`} />
                                  </div>
                                  <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-white font-medium' : 'text-slate-200'}`}>
                                    {folder.name}
                                  </span>
                                  {targetFolder === folder.id && (
                                    <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                                  )}
                                </button>
                              ))}
                            </div>
                          ))
                        ) : (
                          // Normal folder list for single profile
                          vaultFolders.filter(f => !f.isDefault).map((folder) => (
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
                                ? 'bg-cyan-500/15' 
                                : 'hover:bg-white/5'
                              }
                            `}
                          >
                            <div className={`
                              w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                              ${targetFolder === folder.id 
                                ? 'bg-gradient-to-br from-cyan-500/40 to-blue-500/40 border border-cyan-400/40' 
                                : 'bg-slate-700/50 border border-white/5'
                              }
                            `}>
                              <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? 'text-cyan-300' : 'text-slate-400'}`} />
                            </div>
                            <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-white font-medium' : 'text-slate-200'}`}>
                              {folder.name}
                            </span>
                            {targetFolder === folder.id && (
                              <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                            )}
                          </button>
                        ))
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
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <p className="text-xs text-cyan-200 flex-1 truncate">
                      {getSelectedFolderDisplay()}
                    </p>
                  </div>
                )}
              </div>
              </div>

              {/* Batch Size */}
              <div className="space-y-3">
                <div className="flex items-center justify-between w-full group">
                  <p className="text-sm font-semibold text-white">Batch Size</p>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-slate-200">{maxImages} total</span>
                    <button
                      type="button"
                      onClick={() => setSectionsCollapsed(prev => ({ ...prev, batch: !prev.batch }))}
                      className="lg:hidden p-1 hover:bg-white/10 rounded-lg transition"
                    >
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${sectionsCollapsed.batch ? '' : 'rotate-180'}`} />
                    </button>
                  </div>
                </div>

                <div className={`space-y-3 ${sectionsCollapsed.batch ? 'hidden lg:block' : ''}`}>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={maxImages}
                  onChange={(e) => setMaxImages(Number(e.target.value))}
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
                <p className="text-xs text-slate-300 text-center">
                  Match batch size to how many outputs you request in the prompt.
                </p>
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
                      <p className="text-sm text-slate-200/80">1 for single output; 2-5 for variations. For more, run multiple batches.</p>
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
                    <li>Max 5 images per batch to ensure reliable generation.</li>
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
              <div className="rounded-2xl border border-white/10 bg-slate-900 overflow-hidden max-h-[50vh] flex items-center justify-center">
                <img
                  src={selectedImage.imageUrl}
                  alt={selectedImage.prompt}
                  className="w-full h-auto max-h-[50vh] object-contain"
                />
              </div>

              {/* Image details */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-cyan-200">
                  <Info className="w-4 h-4" />
                  <h3 className="text-base font-semibold">Image details</h3>
                </div>
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-300 mb-1">Prompt</p>
                    <p className="text-sm text-slate-100 leading-relaxed">{selectedImage.prompt}</p>
                  </div>
                  
                  {/* Generation Parameters */}
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-200/80">
                    <span className="rounded-full bg-white/10 px-3 py-1">Size: {selectedImage.size}</span>
                    <span className="rounded-full bg-white/10 px-3 py-1">Model: {selectedImage.modelVersion}</span>
                    {selectedImage.metadata?.resolution && (
                      <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-200">
                        Resolution: {selectedImage.metadata.resolution}
                      </span>
                    )}
                    {selectedImage.metadata?.aspectRatio && (
                      <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-200">
                        Aspect: {selectedImage.metadata.aspectRatio}
                      </span>
                    )}
                    {selectedImage.metadata?.numReferenceImages && (
                      <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-indigo-200">
                        {selectedImage.metadata.numReferenceImages} Reference{selectedImage.metadata.numReferenceImages > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Reference Image Thumbnails */}
                  {selectedImage.metadata?.referenceImageUrls && selectedImage.metadata.referenceImageUrls.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-300 mb-2">Reference Images</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedImage.metadata.referenceImageUrls.map((url, idx) => (
                          <div 
                            key={idx} 
                            className="w-16 h-16 rounded-lg overflow-hidden border border-white/10 bg-slate-800"
                          >
                            <img 
                              src={url} 
                              alt={`Reference ${idx + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="gray"><rect width="24" height="24"/></svg>';
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Created date */}
                  <div className="text-[11px] text-slate-400">
                    Created: {new Date(selectedImage.createdAt).toLocaleString()}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Reuse button */}
                  <button
                    type="button"
                    onClick={() => handleReuseGeneration(selectedImage)}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 hover:-translate-y-0.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reuse Settings
                  </button>
                  
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
                    className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/40 transition hover:-translate-y-0.5"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
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
                          {image.metadata?.resolution && (
                            <span className="bg-cyan-500/30 rounded px-1.5 py-0.5">{image.metadata.resolution}</span>
                          )}
                          {isAllProfiles && image.profileName && (
                            <span className="bg-cyan-600/40 rounded px-1.5 py-0.5 text-cyan-200">{image.profileName}</span>
                          )}
                        </div>
                      </div>
                      {/* Profile badge for all profiles view */}
                      {isAllProfiles && image.profileName && (
                        <div className="absolute top-2 left-2 text-[9px] text-cyan-200 bg-cyan-600/60 rounded px-1.5 py-0.5">
                          {image.profileName}
                        </div>
                      )}
                      {/* Date badge */}
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

      {/* Reference Bank Selector with Multi-Select */}
      {showReferenceBankSelector && (
        <ReferenceSelector
          onSelect={handleReferenceBankSelect}
          onSelectMultiple={handleReferenceBankMultiSelect}
          onClose={() => setShowReferenceBankSelector(false)}
          filterType="image"
          isOpen={true}
          multiSelect={true}
          maxSelect={0}
          selectedItemIds={uploadedImages.filter(img => img.referenceId).map(img => img.referenceId!)}
        />
      )}

      {/* Save Preset Modal */}
      {showPresetModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-700">
            <h3 className="text-xl font-semibold mb-4 text-white">Save Image-to-Image Preset</h3>
            
            <div className="space-y-4">
              {/* Preset Name Input */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Preset Name
                </label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g., My Style Transfer Settings"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              {/* Current Settings Preview */}
              <div className="bg-slate-900 rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Settings to Save:
                </p>
                <div className="space-y-1.5 text-sm text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Resolution:</span>
                    <span className="font-medium">{selectedResolution}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Aspect Ratio:</span>
                    <span className="font-medium">{aspectRatio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Framing:</span>
                    <span className="font-medium">{framingOption}</span>
                  </div>
                  {selectedFolder && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Vault Folder:</span>
                      <span className="font-medium truncate max-w-[180px]">
                        {selectedFolder.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPresetModal(false);
                    setPresetName('');
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAsPreset}
                  disabled={!presetName.trim()}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
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
