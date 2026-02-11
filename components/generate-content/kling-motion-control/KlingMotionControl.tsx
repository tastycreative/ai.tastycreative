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
  Film,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Info,
  Loader2,
  Maximize2,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Upload,
  Video,
  Volume2,
  VolumeX,
  X,
  Zap,
  Wand2,
  Check,
  Library,
} from "lucide-react";

// Image compression utility - optimizes large images while preserving quality for AI generation
const compressImage = async (
  file: File,
  maxSizeMB: number = 3.5,  // Target ~3.5MB to stay safely under limits after base64 encoding
  maxWidthOrHeight: number = 2048  // Keep reasonable resolution for AI
): Promise<{ file: File; compressed: boolean; originalSize: number; newSize: number }> => {
  return new Promise((resolve, reject) => {
    const originalSize = file.size;
    
    // If file is already small enough, return as-is
    if (file.size <= maxSizeMB * 1024 * 1024) {
      resolve({
        file,
        compressed: false,
        originalSize,
        newSize: originalSize,
      });
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

      // Start with high quality JPEG
      let quality = 0.92;
      const minQuality = 0.75;  // Don't go below 75% quality to preserve details for AI
      
      const tryCompress = (q: number): Promise<Blob | null> => {
        return new Promise((res) => {
          canvas.toBlob((blob) => res(blob), 'image/jpeg', q);
        });
      };

      const compressLoop = async () => {
        let blob = await tryCompress(quality);
        
        // Reduce quality until size is acceptable
        while (blob && blob.size > maxSizeMB * 1024 * 1024 && quality > minQuality) {
          quality -= 0.05;
          blob = await tryCompress(quality);
        }
        
        // If still too large at min quality, reduce dimensions and try again
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
  profileName?: string;
  isDefault?: boolean;
  parentId?: string | null;
  subfolders?: Array<{ id: string }>;
}

interface GeneratedVideo {
  id: string;
  videoUrl: string;
  prompt?: string;
  mode: string;
  characterOrientation: string;
  duration?: string;
  imageUrl?: string;
  referenceVideoUrl?: string;
  createdAt: string;
  status: "processing" | "completed" | "failed";
  savedToVault?: boolean;
  profileName?: string;
  metadata?: {
    prompt?: string;
    mode?: string;
    character_orientation?: string;
    keep_original_sound?: string;
    imageUrl?: string;
    referenceVideoUrl?: string;
    profileId?: string;
  };
}

// Mode options
const MODE_OPTIONS = [
  { value: "std", label: "Standard", description: "Faster generation" },
  { value: "pro", label: "Professional", description: "Higher quality" },
] as const;

// Character orientation options
const ORIENTATION_OPTIONS = [
  { value: "image", label: "Match Image", description: "Max 10s video" },
  { value: "video", label: "Match Video", description: "Max 30s video" },
] as const;

export default function KlingMotionControl() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();
  const { refreshCredits } = useCredits();
  const { profileId: globalProfileId, selectedProfile } = useInstagramProfile();
  
  // Check if "All Profiles" is selected
  const isAllProfiles = globalProfileId === "all";

  // Hydration fix
  const [mounted, setMounted] = useState(false);

  // Form state
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"std" | "pro">("std");
  const [characterOrientation, setCharacterOrientation] = useState<"image" | "video">("image");
  const [keepOriginalSound, setKeepOriginalSound] = useState(true); // API default is "yes"

  // File state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);
  
  // Reference Bank state (for image)
  const [showReferenceBankSelector, setShowReferenceBankSelector] = useState(false);
  const [isSavingToReferenceBank, setIsSavingToReferenceBank] = useState(false);
  const [fromReferenceBank, setFromReferenceBank] = useState(false);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  
  // Reference Bank state (for video)
  const [showVideoReferenceBankSelector, setShowVideoReferenceBankSelector] = useState(false);
  const [videoFromReferenceBank, setVideoFromReferenceBank] = useState(false);
  const [videoReferenceId, setVideoReferenceId] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  // Folder state
  const [targetFolder, setTargetFolder] = useState<string>("");
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const folderDropdownRef = useRef<HTMLDivElement>(null);

  // Vault folder state
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
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const pauseAllPreviews = () => {
    const previewVideos = document.querySelectorAll<HTMLVideoElement>("video[data-role='preview']");
    previewVideos.forEach((video) => {
      video.pause();
      video.currentTime = 0;
    });
  };

  // Load vault folders for selected profile
  const loadVaultData = useCallback(async () => {
    if (!apiClient || !user || !globalProfileId) {
      setVaultFolders([]);
      return;
    }
    setIsLoadingVaultData(true);
    try {
      const foldersResponse = await apiClient.get(
        `/api/vault/folders?profileId=${globalProfileId}`
      );
      if (foldersResponse.ok) {
        const foldersData = await foldersResponse.json();
        const folders = Array.isArray(foldersData) ? foldersData : (foldersData.folders || []);
        // Add profileName from response if available (for "all" profiles view)
        setVaultFolders(folders.map((f: any) => ({
          ...f,
          profileName: f.profileName || null
        })));
      } else {
        setVaultFolders([]);
      }
    } catch (err) {
      console.error("Failed to load vault folders:", err);
      setVaultFolders([]);
    } finally {
      setIsLoadingVaultData(false);
    }
  }, [apiClient, user, globalProfileId]);

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
    if (!targetFolder) return "Please select a vault folder to save your video";

    const folder = vaultFolders.find((f) => f.id === targetFolder);
    if (folder) {
      // Build folder path for nested folders
      const folderPath = getFolderPath(targetFolder);
      
      // When viewing all profiles, use folder's profileName
      if (isAllProfiles && folder.profileName) {
        return `Videos save to vault: ${folder.profileName} / ${folderPath}`;
      }
      // When viewing specific profile, use selectedProfile
      if (selectedProfile) {
        const profileDisplay = selectedProfile.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile.name;
        return `Videos save to vault: ${profileDisplay} / ${folderPath}`;
      }
      return `Videos save to vault: ${folderPath}`;
    }
    return "Please select a vault folder";
  };

  // Load history
  const loadGenerationHistory = useCallback(async () => {
    if (!apiClient || !user) return;
    setIsLoadingHistory(true);
    try {
      console.log("[Kling Motion Control Frontend] Loading generation history for profileId:", globalProfileId);
      // Add profileId to filter by selected profile
      const url = globalProfileId
        ? `/api/generate/kling-motion-control?history=true&profileId=${globalProfileId}`
        : "/api/generate/kling-motion-control?history=true";
      const response = await apiClient.get(url);
      if (response.ok) {
        // Safely parse JSON response
        const responseText = await response.text();
        try {
          const data = JSON.parse(responseText);
          const videos = data.videos || [];
          console.log("[Kling Motion Control Frontend] Loaded videos:", videos.length);
          console.log("[Kling Motion Control Frontend] Video URLs present:", videos.filter((v: any) => !!v.videoUrl).length);
          setGenerationHistory(videos);
        } catch (parseError) {
          console.error("[Kling Motion Control Frontend] Error parsing history response:", responseText.substring(0, 200));
          setGenerationHistory([]);
        }
      } else {
        console.error("[Kling Motion Control Frontend] Failed to load history, status:", response.status);
      }
    } catch (err) {
      console.error("[Kling Motion Control Frontend] Error loading video history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [apiClient, user, globalProfileId]);

  // Initial data load
  useEffect(() => {
    setMounted(true);
    
    // Check for reuse data from Vault
    const reuseData = sessionStorage.getItem('kling-motion-control-reuse');
    if (reuseData) {
      try {
        const data = JSON.parse(reuseData);
        console.log('Restoring Kling Motion Control settings from Vault:', data);
        
        // Set prompt
        if (data.prompt) setPrompt(data.prompt);
        
        // Set mode
        if (data.mode && MODE_OPTIONS.find(m => m.value === data.mode)) {
          setMode(data.mode);
        }
        
        // Set character orientation
        if (data.characterOrientation && ORIENTATION_OPTIONS.find(o => o.value === data.characterOrientation)) {
          setCharacterOrientation(data.characterOrientation);
        }
        
        // Set keep original sound
        if (typeof data.keepOriginalSound === 'boolean') {
          setKeepOriginalSound(data.keepOriginalSound);
        }
        
        // Load reference image if URL provided
        if (data.imageUrl) {
          console.log('Loading reference image from vault reuse, URL:', data.imageUrl);
          fetch(`/api/proxy-image?url=${encodeURIComponent(data.imageUrl)}`)
            .then(res => {
              if (!res.ok) {
                throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
              }
              return res.blob();
            })
            .then(blob => {
              console.log('Reference image loaded, size:', blob.size);
              const file = new File([blob], 'reference.jpg', { type: blob.type || 'image/jpeg' });
              setImageFile(file);
              setFromReferenceBank(false);
              setReferenceId(null);
              
              const reader = new FileReader();
              reader.onloadend = () => {
                setImagePreview(reader.result as string);
              };
              reader.readAsDataURL(blob);
            })
            .catch(err => {
              console.error('Failed to load reference image from vault:', err);
              setError('Failed to load reference image. Please try uploading manually.');
            });
        }
        
        // Load reference video if URL provided
        if (data.referenceVideoUrl) {
          console.log('Loading reference video from vault reuse, URL:', data.referenceVideoUrl);
          fetch(`/api/proxy-image?url=${encodeURIComponent(data.referenceVideoUrl)}`)
            .then(res => {
              if (!res.ok) {
                throw new Error(`Failed to fetch video: ${res.status} ${res.statusText}`);
              }
              return res.blob();
            })
            .then(blob => {
              console.log('Reference video loaded, size:', blob.size);
              const file = new File([blob], 'reference.mp4', { type: blob.type || 'video/mp4' });
              setVideoFile(file);
              setVideoFromReferenceBank(false);
              setVideoReferenceId(null);
              
              const url = URL.createObjectURL(blob);
              setVideoPreview(url);
              
              // Get video duration
              const video = document.createElement('video');
              video.preload = 'metadata';
              video.onloadedmetadata = () => {
                setVideoDuration(video.duration);
                URL.revokeObjectURL(video.src);
              };
              video.src = URL.createObjectURL(blob);
            })
            .catch(err => {
              console.error('Failed to load reference video from vault:', err);
              setError('Failed to load reference video. Please try uploading manually.');
            });
        }
        
        // Clear the sessionStorage after reading
        sessionStorage.removeItem('kling-motion-control-reuse');
      } catch (err) {
        console.error('Error parsing Kling Motion Control reuse data:', err);
        sessionStorage.removeItem('kling-motion-control-reuse');
      }
    }
  }, []);

  useEffect(() => {
    if (user && apiClient) {
      loadVaultData();
      loadGenerationHistory();
    }
  }, [user, apiClient, loadVaultData, loadGenerationHistory]);

  // Clear target folder when profile changes
  useEffect(() => {
    setTargetFolder("");
  }, [globalProfileId]);

  // Reload generation history when profile changes
  useEffect(() => {
    if (user && apiClient && globalProfileId) {
      loadGenerationHistory();
    }
  }, [globalProfileId, loadGenerationHistory, user, apiClient]);

  // Click outside handler for folder dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(event.target as Node)) {
        setFolderDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle image file selection with automatic compression
  const handleImageSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPEG, PNG, WebP)");
      return;
    }

    // Allow larger initial files since we'll compress them
    if (file.size > 20 * 1024 * 1024) {
      setError("Image must be less than 20MB");
      return;
    }

    setError(null);
    setCompressionInfo(null);
    setIsCompressing(true);
    
    // Reset reference bank tracking for new uploads
    setFromReferenceBank(false);
    setReferenceId(null);

    try {
      // Compress image if needed (target 3MB max for safe upload)
      const result = await compressImage(file, 3, 2048);
      
      setImageFile(result.file);

      // Show compression info if image was compressed
      if (result.compressed) {
        const savedMB = ((result.originalSize - result.newSize) / (1024 * 1024)).toFixed(1);
        const newSizeMB = (result.newSize / (1024 * 1024)).toFixed(1);
        setCompressionInfo(`Image compressed: ${newSizeMB}MB (saved ${savedMB}MB)`);
        console.log(`[Kling Motion Control] Image compressed: ${(result.originalSize / (1024 * 1024)).toFixed(1)}MB → ${newSizeMB}MB`);
      }

      // Create preview from the (possibly compressed) file
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(result.file);
    } catch (err) {
      console.error("Image compression failed:", err);
      setError("Failed to process image. Please try a different file.");
    } finally {
      setIsCompressing(false);
    }
  }, []);

  // Handle video file selection
  const handleVideoSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setError("Please select a video file (MP4, MOV, WebM)");
      return;
    }

    // Reduce max video size to 50MB to avoid "Request Entity Too Large" errors
    // Some CDNs and proxies have stricter limits
    if (file.size > 50 * 1024 * 1024) {
      setError("Video must be less than 50MB. Please compress your video or use a shorter clip.");
      return;
    }

    setError(null);
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreview(url);
    
    // Get video duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      setVideoDuration(video.duration);
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(file);
    
    // Reset reference bank tracking for new uploads
    setVideoFromReferenceBank(false);
    setVideoReferenceId(null);
  }, []);

  // Clear image
  const clearImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    setCompressionInfo(null);
    setFromReferenceBank(false);
    setReferenceId(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }, []);

  // Clear video
  const clearVideo = useCallback(() => {
    setVideoFile(null);
    if (videoPreview && !videoFromReferenceBank) {
      URL.revokeObjectURL(videoPreview);
    }
    setVideoPreview(null);
    setVideoFromReferenceBank(false);
    setVideoReferenceId(null);
    setVideoDuration(null);
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  }, [videoPreview, videoFromReferenceBank]);

  // Save image to Reference Bank (for file-based uploads)
  const saveToReferenceBank = async (file: File, imageBase64: string, skipIfExists?: boolean): Promise<string | null> => {
    if (!globalProfileId || globalProfileId === "all") return null;
    
    try {
      const mimeType = file.type || 'image/jpeg';
      const extension = mimeType === 'image/png' ? 'png' : 'jpg';
      const fileName = file.name || `reference-${Date.now()}.${extension}`;
      
      // Convert base64 to blob
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
        img.src = imageBase64;
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
          tags: ['kling', 'motion-control'],
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

  // Save video to Reference Bank
  const saveVideoToReferenceBank = async (file: File, skipIfExists?: boolean): Promise<string | null> => {
    if (!globalProfileId || globalProfileId === "all") return null;
    
    try {
      const mimeType = file.type || 'video/mp4';
      const extension = mimeType.includes('webm') ? 'webm' : mimeType.includes('quicktime') ? 'mov' : 'mp4';
      const fileName = file.name || `reference-video-${Date.now()}.${extension}`;
      
      // Check if a similar file already exists in Reference Bank (by size)
      if (skipIfExists) {
        try {
          const existingCheck = await fetch(`/api/reference-bank?profileId=${globalProfileId}&checkDuplicate=true&fileSize=${file.size}&fileName=${encodeURIComponent(fileName)}`);
          if (existingCheck.ok) {
            const existing = await existingCheck.json();
            if (existing.duplicate) {
              console.log('⏭️ Skipping duplicate - video already exists in Reference Bank:', existing.existingId);
              return existing.existingId;
            }
          }
        } catch (err) {
          console.warn('Could not check for duplicates:', err);
        }
      }
      
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
        body: file,
      });

      if (!uploadResponse.ok) return null;

      // Create reference item in database
      const createResponse = await fetch('/api/reference-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: globalProfileId,
          name: fileName,
          fileType: 'video',
          mimeType,
          fileSize: file.size,
          awsS3Key: key,
          awsS3Url: url,
          tags: ['kling', 'motion-control', 'reference-video'],
        }),
      });

      if (!createResponse.ok) return null;

      const newReference = await createResponse.json();
      return newReference.id;
    } catch (err) {
      console.error('Error saving video to Reference Bank:', err);
      return null;
    }
  };

  // Handle selection from Reference Bank
  const handleReferenceBankSelect = async (item: ReferenceItem) => {
    try {
      // Fetch image via proxy
      const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(item.awsS3Url)}`);
      
      if (!proxyResponse.ok) {
        setError('Failed to load reference image. Please try again.');
        return;
      }
      
      const blob = await proxyResponse.blob();
      
      // Convert blob to File
      const file = new File([blob], item.name || 'reference.jpg', { type: blob.type || 'image/jpeg' });
      setImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(blob);
      
      setFromReferenceBank(true);
      setReferenceId(item.id);
      setCompressionInfo(null);
      
      // Track usage
      fetch(`/api/reference-bank/${item.id}/use`, { method: 'POST' }).catch(console.error);
    } catch (err) {
      console.error('Error loading reference image:', err);
      setError('Failed to load reference image. Please try again.');
    }

    setShowReferenceBankSelector(false);
  };

  // Handle video selection from Reference Bank
  const handleVideoReferenceBankSelect = async (item: ReferenceItem) => {
    try {
      // Fetch video via proxy
      const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(item.awsS3Url)}`);
      
      if (!proxyResponse.ok) {
        setError('Failed to load reference video. Please try again.');
        return;
      }
      
      const blob = await proxyResponse.blob();
      
      // Convert blob to File
      const file = new File([blob], item.name || 'reference.mp4', { type: blob.type || 'video/mp4' });
      setVideoFile(file);
      
      // Create preview URL
      const url = URL.createObjectURL(blob);
      setVideoPreview(url);
      
      // Get video duration
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        setVideoDuration(video.duration);
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(blob);
      
      setVideoFromReferenceBank(true);
      setVideoReferenceId(item.id);
      
      // Track usage
      fetch(`/api/reference-bank/${item.id}/use`, { method: 'POST' }).catch(console.error);
    } catch (err) {
      console.error('Error loading reference video:', err);
      setError('Failed to load reference video. Please try again.');
    }

    setShowVideoReferenceBankSelector(false);
  };

  // Poll for task status
  const pollTaskStatus = useCallback((taskId: string, localTaskId: string) => {
    const maxAttempts = 240; // 20 minutes (240 × 5s) - Kling AI can take longer for complex videos
    let attempts = 0;
    let lastKnownStatus = "unknown";

    return new Promise<void>((resolve, reject) => {
      const poll = async () => {
        try {
          attempts++;
          const elapsedSeconds = attempts * 5;
          const minutes = Math.floor(elapsedSeconds / 60);
          const seconds = elapsedSeconds % 60;
          
          setPollingStatus(
            `Processing... (${minutes}m ${seconds}s)`
          );
          updateGlobalProgress({
            isGenerating: true,
            progress: Math.min(90, Math.floor((attempts / maxAttempts) * 85)),
            stage: "processing",
            message: `Generating video... ${minutes}m ${seconds}s`,
            generationType: "image-to-video",
            jobId: localTaskId,
          });

          const response = await fetch(`/api/generate/kling-motion-control?taskId=${taskId}`);
          
          // Safely parse JSON response
          let data;
          const responseText = await response.text();
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            console.error("[Kling Motion Control] Failed to parse poll response:", responseText.substring(0, 200));
            throw new Error(
              response.ok
                ? "Received invalid response while checking status. Please try again."
                : `Server error (${response.status}): Unable to check generation status`
            );
          }
          
          if (!response.ok) {
            throw new Error(data.error || data.message || "Failed to check task status");
          }

          // Track last known status for better error messages
          lastKnownStatus = data.status || "unknown";
          console.log(`[Kling Motion Control] Poll attempt ${attempts}/${maxAttempts} - Status: ${lastKnownStatus}`);

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
            setCurrentTaskId(null);
            clearImage();
            clearVideo();
            setPrompt("");
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
            // Timeout with informative message
            throw new Error(
              `Video generation timed out after ${Math.floor(maxAttempts * 5 / 60)} minutes. ` +
              `Last status: ${lastKnownStatus}. The video may still be processing - check your history in a few minutes.`
            );
          }

          // Handle unexpected status
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000);
            return;
          }

          throw new Error(
            `Video generation timed out after ${Math.floor(maxAttempts * 5 / 60)} minutes. ` +
            `Last status: ${lastKnownStatus}. Please try again or contact support if the issue persists.`
          );
        } catch (err: any) {
          console.error("[Kling Motion Control] Polling error:", err);
          setError(err.message || "Failed to check generation status");
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
          setCurrentTaskId(null);
          setTimeout(() => clearGlobalProgress(), 3000);
          reject(err);
        }
      };

      poll();
    });
  }, [updateGlobalProgress, clearGlobalProgress, clearImage, clearVideo, loadGenerationHistory]);

  // Upload file directly to S3 using presigned URL
  const uploadFileToS3 = async (file: File, fileType: 'image' | 'video'): Promise<string> => {
    try {
      // Get presigned URL from our API
      const presignedResponse = await fetch('/api/generate/kling-motion-control/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
        }),
      });

      if (!presignedResponse.ok) {
        throw new Error(`Failed to get upload URL for ${fileType}`);
      }

      const { presignedUrl, url } = await presignedResponse.json();

      // Upload directly to S3
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload ${fileType} to storage`);
      }

      console.log(`[Kling Motion Control] ${fileType} uploaded to S3:`, url);
      return url;
    } catch (err) {
      console.error(`Error uploading ${fileType} to S3:`, err);
      throw err;
    }
  };

  // Generate video
  const handleGenerate = async () => {
    if (!apiClient) {
      setError("API client not available");
      return;
    }
    if (!targetFolder) {
      setError("Please select a vault folder to save your video");
      return;
    }
    if (!imageFile) {
      setError("Please select a reference image");
      return;
    }
    if (!videoFile) {
      setError("Please select a reference video");
      return;
    }
    
    // Validate video duration based on character orientation
    // "image" orientation: max 10 seconds
    // "video" orientation: max 30 seconds
    if (videoDuration !== null) {
      const maxDuration = characterOrientation === "image" ? 10 : 30;
      if (videoDuration > maxDuration) {
        setError(`For character orientation '${characterOrientation === "image" ? "Match Image" : "Match Video"}', the reference video must not exceed ${maxDuration} seconds. Your video is ${Math.round(videoDuration)} seconds. ${characterOrientation === "image" ? "Try switching to 'Match Video' orientation for longer videos (up to 30s)." : "Please use a shorter video."}`);
        return;
      }
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("Uploading files...");
    const localTaskId = `kling-mc-${Date.now()}`;

    // Save to Reference Bank before generating (only for new uploads, not from Reference Bank)
    if (globalProfileId && globalProfileId !== "all" && !fromReferenceBank && imageFile && imagePreview) {
      setIsSavingToReferenceBank(true);
      try {
        // Pass skipIfExists: true to avoid creating duplicates
        const newReferenceId = await saveToReferenceBank(imageFile, imagePreview, true);
        if (newReferenceId) {
          setReferenceId(newReferenceId);
          setFromReferenceBank(true);
          console.log('Image saved to Reference Bank:', newReferenceId);
        }
      } catch (err) {
        console.warn('Failed to save image to Reference Bank:', err);
      } finally {
        setIsSavingToReferenceBank(false);
      }
    }

    // Save video to Reference Bank before generating (only for new uploads)
    if (globalProfileId && globalProfileId !== "all" && !videoFromReferenceBank && videoFile) {
      try {
        // Pass skipIfExists: true to avoid creating duplicates
        const newVideoReferenceId = await saveVideoToReferenceBank(videoFile, true);
        if (newVideoReferenceId) {
          setVideoReferenceId(newVideoReferenceId);
          setVideoFromReferenceBank(true);
          console.log('Video saved to Reference Bank:', newVideoReferenceId);
        }
      } catch (err) {
        console.warn('Failed to save video to Reference Bank:', err);
      }
    }

    let imageS3Url: string | null = null;
    let videoS3Url: string | null = null;

    try {
      updateGlobalProgress({
        isGenerating: true,
        progress: 5,
        stage: "uploading",
        message: "Uploading image to storage...",
        generationType: "image-to-video",
        jobId: localTaskId,
      });

      // Upload image to S3 first
      imageS3Url = await uploadFileToS3(imageFile, 'image');
      
      updateGlobalProgress({
        isGenerating: true,
        progress: 15,
        stage: "uploading",
        message: "Uploading video to storage...",
        generationType: "image-to-video",
        jobId: localTaskId,
      });

      // Upload video to S3
      videoS3Url = await uploadFileToS3(videoFile, 'video');

      updateGlobalProgress({
        isGenerating: true,
        progress: 25,
        stage: "starting",
        message: "Starting Kling Motion Control generation...",
        generationType: "image-to-video",
        jobId: localTaskId,
      });

      setPollingStatus("Submitting task...");

      // Prepare JSON payload with S3 URLs (not FormData with files)
      const payload: any = {
        imageUrl: imageS3Url,
        videoUrl: videoS3Url,
        mode,
        character_orientation: characterOrientation,
        keep_original_sound: keepOriginalSound ? "yes" : "no",
      };

      if (prompt.trim()) {
        payload.prompt = prompt.trim();
      }

      // Add folder selection data - simplified vault folder approach
      if (targetFolder && globalProfileId) {
        payload.saveToVault = true;
        // Use folder's profileId for proper association (works for both single and all profiles views)
        const folderProfileId = vaultFolders.find(f => f.id === targetFolder)?.profileId || globalProfileId;
        if (folderProfileId && folderProfileId !== "all") {
          payload.vaultProfileId = folderProfileId;
        }
        payload.vaultFolderId = targetFolder;
      }

      // Send JSON payload with S3 URLs (much smaller than files)
      const response = await fetch("/api/generate/kling-motion-control", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // Safely parse JSON response - handle cases where server returns non-JSON
      let data;
      const responseText = await response.text();
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("[Kling Motion Control] Failed to parse response:", responseText.substring(0, 200));
        throw new Error(
          response.ok 
            ? "Received invalid response from server. Please try again." 
            : `Server error (${response.status}): ${responseText.substring(0, 100)}`
        );
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to start video generation");
      }

      setCurrentTaskId(data.taskId);

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
      setError(err.message || "Failed to generate video");
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

  // Download video
  const handleDownload = async (videoUrl: string, filename?: string) => {
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `kling-motion-control-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to download video");
    }
  };

  // Reset form
  const handleReset = () => {
    setPrompt("");
    setMode("std");
    setCharacterOrientation("image");
    setKeepOriginalSound(true); // API default is "yes"
    clearImage();
    clearVideo();
    setTargetFolder("");
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("");
  };

  // Handle reuse settings from a selected video
  const handleReuseSettings = async (video: GeneratedVideo) => {
    // Set prompt
    if (video.prompt) {
      setPrompt(video.prompt);
    }
    
    // Set mode from metadata or root level
    const mode = video.metadata?.mode || video.mode;
    if (mode && MODE_OPTIONS.find(m => m.value === mode)) {
      setMode(mode as "std" | "pro");
    }
    
    // Set character orientation from metadata or root level
    const orientation = video.metadata?.character_orientation || video.characterOrientation;
    if (orientation && ORIENTATION_OPTIONS.find(o => o.value === orientation)) {
      setCharacterOrientation(orientation as "image" | "video");
    }
    
    // Set keep original sound from metadata
    if (video.metadata?.keep_original_sound) {
      setKeepOriginalSound(video.metadata.keep_original_sound === "yes");
    }
    
    // Load reference image if URL provided
    const imageUrl = video.metadata?.imageUrl || video.imageUrl;
    if (imageUrl) {
      try {
        const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(imageUrl)}`);
        if (proxyResponse.ok) {
          const blob = await proxyResponse.blob();
          const file = new File([blob], 'reference.jpg', { type: blob.type || 'image/jpeg' });
          setImageFile(file);
          setFromReferenceBank(false);
          setReferenceId(null);
          const reader = new FileReader();
          reader.onloadend = () => {
            setImagePreview(reader.result as string);
          };
          reader.readAsDataURL(blob);
        }
      } catch (err) {
        console.error('Failed to load reference image:', err);
      }
    }
    
    // Load reference video if URL provided
    const referenceVideoUrl = video.metadata?.referenceVideoUrl || video.referenceVideoUrl;
    if (referenceVideoUrl) {
      try {
        const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(referenceVideoUrl)}`);
        if (proxyResponse.ok) {
          const blob = await proxyResponse.blob();
          const file = new File([blob], 'reference.mp4', { type: blob.type || 'video/mp4' });
          setVideoFile(file);
          setVideoFromReferenceBank(false);
          setVideoReferenceId(null);
          const url = URL.createObjectURL(blob);
          setVideoPreview(url);
          
          // Get video duration
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.onloadedmetadata = () => {
            setVideoDuration(video.duration);
            URL.revokeObjectURL(video.src);
          };
          video.src = URL.createObjectURL(blob);
        }
      } catch (err) {
        console.error('Failed to load reference video:', err);
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
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="max-h-[85vh] overflow-y-auto overflow-x-hidden bg-[#F8F8F8] dark:bg-[#0a0a0f] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl shadow-lg custom-scrollbar relative text-sidebar-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-[#EC67A1]/20 dark:bg-[#EC67A1]/10 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-[#5DC3F8]/10 dark:bg-[#5DC3F8]/5 blur-3xl" />
        <div className="absolute inset-x-10 top-20 h-[1px] bg-gradient-to-r from-transparent via-zinc-300 dark:via-white/20 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header Section */}
        <div className="grid gap-4 md:grid-cols-[2fr_1fr] items-start">
          <div className="bg-[#F8F8F8] dark:bg-zinc-800/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F774B9] via-[#EC67A1] to-[#E1518E] shadow-lg shadow-[#EC67A1]/30">
                <Sparkles className="w-6 h-6 text-white" />
                <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#EC67A1]">Motion Studio</p>
                <h1 className="text-3xl sm:text-4xl font-black text-sidebar-foreground">Kling AI — Motion Control</h1>
              </div>
            </div>
            <p className="text-sm sm:text-base text-header-muted leading-relaxed">
              Transfer motion from a reference video to your character image. Upload a character image 
              and a video with the desired movements to create stunning AI-animated content.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EC67A1]/20 text-[#EC67A1]">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-header-muted">Character</p>
                  <p className="text-sm font-semibold text-sidebar-foreground">Image Input</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EC67A1]/20 text-[#EC67A1]">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-header-muted">Motion</p>
                  <p className="text-sm font-semibold text-sidebar-foreground">Video Reference</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5DC3F8]/20 text-[#5DC3F8]">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-header-muted">Duration</p>
                  <p className="text-sm font-semibold text-sidebar-foreground">Up to 30s</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="group inline-flex items-center gap-2 rounded-full bg-white text-slate-900 px-4 py-2 text-sm font-semibold shadow-lg shadow-[#EC67A1]/10 transition hover:-translate-y-0.5 hover:shadow-xl"
                title="View Help & Tips"
              >
                <Info className="w-4 h-4" />
                Quick Guide
              </button>
            </div>

            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-gradient-to-br from-[#EC67A1]/10 via-[#F774B9]/10 to-[#5DC3F8]/10 p-4 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#EC67A1]">Current setup</p>
                  <p className="text-sm font-semibold text-sidebar-foreground">
                    {mode === "pro" ? "Professional" : "Standard"} · {characterOrientation === "image" ? "Match Image" : "Match Video"}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-header-muted">
                  <span className="rounded-full bg-zinc-200 dark:bg-zinc-700 px-3 py-1">
                    {keepOriginalSound ? "🔊 Sound" : "🔇 Muted"}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 ${
                      isGenerating
                        ? "bg-amber-400/20 text-amber-600 dark:text-amber-100"
                        : "bg-emerald-400/20 text-emerald-600 dark:text-emerald-100"
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
        <div className="grid gap-6 lg:grid-cols-[420px_1fr] items-start">
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            <div className="bg-[#F8F8F8] dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur space-y-6">
              {/* Reference Image Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#EC67A1]" />
                    <label className="text-sm font-semibold text-sidebar-foreground">Reference Image (Character) *</label>
                  </div>
                  {/* Reference Bank Button */}
                  {mounted && globalProfileId && (
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

                {imagePreview ? (
                  <div className={`relative aspect-video rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border ${
                    fromReferenceBank ? 'border-[#EC67A1]/50' : 'border-zinc-200 dark:border-zinc-700'
                  }`}>
                    <img
                      src={imagePreview}
                      alt="Reference character"
                      className="w-full h-full object-contain"
                    />
                    <button
                      onClick={clearImage}
                      disabled={isGenerating}
                      className="absolute top-2 right-2 p-2 rounded-xl bg-red-500/80 hover:bg-red-500 text-white transition disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {fromReferenceBank && (
                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-[#EC67A1]/80 text-xs text-white flex items-center gap-1">
                        <Library className="w-3 h-3" />
                        From Reference Bank
                      </div>
                    )}
                    {compressionInfo && !fromReferenceBank && (
                      <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded-lg bg-[#5DC3F8]/80 text-xs text-white text-center">
                        {compressionInfo}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => !isGenerating && !isCompressing && imageInputRef.current?.click()}
                    className={`aspect-video rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 hover:border-[#EC67A1]/50 bg-zinc-50 dark:bg-zinc-800/30 flex flex-col items-center justify-center gap-2 cursor-pointer transition ${
                      isGenerating || isCompressing ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {isCompressing ? (
                      <>
                        <Loader2 className="h-8 w-8 text-[#EC67A1] animate-spin" />
                        <span className="text-sm text-header-muted">Compressing image...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
                        <span className="text-sm text-header-muted">Click to upload character image</span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">Max 20MB · Auto-compressed · JPG, PNG, WebP</span>
                      </>
                    )}
                  </div>
                )}

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImageSelect}
                  disabled={isGenerating || isCompressing}
                />
                <p className="text-xs text-header-muted">Upload the character you want to animate. Large images are automatically compressed.</p>
              </div>

              {/* Reference Video Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-[#EC67A1]" />
                    <label className="text-sm font-semibold text-sidebar-foreground">Reference Video (Motion) *</label>
                  </div>
                  {/* Reference Bank Button for Video */}
                  {mounted && globalProfileId && (
                    <button
                      type="button"
                      onClick={() => setShowVideoReferenceBankSelector(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#EC67A1]/20 hover:bg-[#EC67A1]/30 text-[#EC67A1] border border-[#EC67A1]/30 transition-all"
                      disabled={isGenerating}
                    >
                      <Library className="w-3.5 h-3.5" />
                      Reference Bank
                    </button>
                  )}
                </div>

                {videoPreview ? (
                  <div className={`relative aspect-video rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border ${videoFromReferenceBank ? 'border-[#EC67A1]/50' : 'border-zinc-200 dark:border-zinc-700'}`}>
                    <video
                      src={videoPreview}
                      controls
                      className="w-full h-full object-contain"
                    />
                    <button
                      onClick={clearVideo}
                      disabled={isGenerating}
                      className="absolute top-2 right-2 p-2 rounded-xl bg-red-500/80 hover:bg-red-500 text-white transition disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {/* Duration indicator */}
                    {videoDuration !== null && (
                      <div className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-xs text-white flex items-center gap-1 ${
                        (characterOrientation === "image" && videoDuration > 10) || 
                        (characterOrientation === "video" && videoDuration > 30)
                          ? 'bg-red-500/80'
                          : 'bg-zinc-800/80'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {Math.round(videoDuration)}s
                        {characterOrientation === "image" && videoDuration > 10 && (
                          <span className="ml-1">⚠️ Max 10s</span>
                        )}
                        {characterOrientation === "video" && videoDuration > 30 && (
                          <span className="ml-1">⚠️ Max 30s</span>
                        )}
                      </div>
                    )}
                    {videoFromReferenceBank && (
                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-[#EC67A1]/80 text-xs text-white flex items-center gap-1">
                        <Library className="w-3 h-3" />
                        From Reference Bank
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => !isGenerating && videoInputRef.current?.click()}
                    className={`aspect-video rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 hover:border-[#EC67A1]/50 bg-zinc-50 dark:bg-zinc-800/30 flex flex-col items-center justify-center gap-2 cursor-pointer transition ${
                      isGenerating ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <Upload className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
                    <span className="text-sm text-header-muted">Click to upload reference video</span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">Max 50MB · MP4, MOV, WebM · 3-30s</span>
                  </div>
                )}

                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={handleVideoSelect}
                  disabled={isGenerating}
                />
                <p className="text-xs text-header-muted">Upload a video showing the motion to transfer. Keep videos under 50MB for best results.</p>
              </div>

              {/* Character Orientation */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-[#EC67A1]" />
                  <label className="text-sm font-semibold text-sidebar-foreground">Character Orientation</label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ORIENTATION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCharacterOrientation(option.value as "image" | "video")}
                      className={`rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 ${
                        characterOrientation === option.value
                          ? "border-[#EC67A1]/60 bg-[#EC67A1]/10 text-sidebar-foreground"
                          : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 text-sidebar-foreground"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <p className="text-xs font-semibold">{option.label}</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality Mode */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#EC67A1]" />
                  <label className="text-sm font-semibold text-sidebar-foreground">Quality Mode</label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMode(option.value as "std" | "pro")}
                      className={`rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 ${
                        mode === option.value
                          ? "border-[#EC67A1]/60 bg-[#EC67A1]/10 text-sidebar-foreground"
                          : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 text-sidebar-foreground"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <p className="text-xs font-semibold">{option.label}</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Keep Original Sound */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {keepOriginalSound ? (
                      <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                    )}
                    <label className="text-sm font-semibold text-sidebar-foreground">Keep Original Sound</label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKeepOriginalSound(!keepOriginalSound)}
                    disabled={isGenerating}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      keepOriginalSound ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        keepOriginalSound ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-header-muted">
                  {keepOriginalSound
                    ? "Audio from reference video will be preserved"
                    : "Generated video will be silent"}
                </p>
              </div>

              {/* Optional Prompt */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-sidebar-foreground">Prompt (Optional)</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the desired output or scene..."
                  disabled={isGenerating}
                  maxLength={2500}
                  className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 px-4 py-3 text-sm text-sidebar-foreground placeholder-zinc-400 dark:placeholder-zinc-500 transition focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/50 focus:border-transparent disabled:opacity-50 min-h-[80px] resize-none"
                />
                <p className="text-xs text-header-muted">{prompt.length}/2500 characters</p>
              </div>

              {/* Folder Selection */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-[#EC67A1]" />
                  <label className="text-sm font-semibold text-sidebar-foreground">Save to Vault</label>
                  {isLoadingVaultData && (
                    <Loader2 className="w-3 h-3 animate-spin text-[#EC67A1]" />
                  )}
                </div>
                {mounted && (
                  <div ref={folderDropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setFolderDropdownOpen(!folderDropdownOpen)}
                      disabled={isLoadingVaultData || isGenerating || !globalProfileId}
                      className="w-full flex items-center justify-between rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 px-4 py-3 text-sm text-sidebar-foreground transition hover:bg-zinc-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/50 disabled:opacity-50"
                    >
                      <span className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-[#EC67A1]" />
                        <div className="text-left">
                          <span>{targetFolder
                            ? vaultFolders.find((f) => f.id === targetFolder)?.name || "Select folder..."
                            : "Select a vault folder..."}</span>
                          {targetFolder && (
                            <span className="block text-[11px] text-[#EC67A1]/70">
                              {isAllProfiles 
                                ? vaultFolders.find(f => f.id === targetFolder)?.profileName || ''
                                : selectedProfile?.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile?.name || ''
                              }
                            </span>
                          )}
                        </div>
                      </span>
                      <ChevronDown className={`w-4 h-4 text-zinc-400 dark:text-zinc-500 transition-transform ${folderDropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                    {folderDropdownOpen && (
                      <div className="absolute z-50 bottom-full mb-2 w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/95 backdrop-blur-xl shadow-xl overflow-hidden">
                        <div className="max-h-60 overflow-y-auto py-1">
                          {vaultFolders.filter((f) => !f.isDefault).length === 0 ? (
                            <div className="px-4 py-3 text-sm text-zinc-400 dark:text-zinc-500">
                              No folders available for this profile
                            </div>
                          ) : isAllProfiles ? (
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
                                      className={`w-full flex items-center gap-3 py-2.5 text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-800/50 ${
                                        targetFolder === folder.id
                                          ? "bg-[#EC67A1]/20 text-[#EC67A1]"
                                          : "text-sidebar-foreground"
                                      }`}
                                      style={{ paddingLeft: `${16 + depth * 16}px`, paddingRight: '16px' }}
                                    >
                                      {hasChildren ? (
                                        <FolderOpen className="w-4 h-4 text-[#EC67A1] flex-shrink-0" />
                                      ) : (
                                        <Folder className="w-4 h-4 text-[#EC67A1] flex-shrink-0" />
                                      )}
                                      <span className="flex-1 text-left truncate">{folder.name}</span>
                                      {depth > 0 && (
                                        <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">L{depth + 1}</span>
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
                            sortFoldersHierarchically(vaultFolders.filter((f) => !f.isDefault)).map((folder) => {
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
                                  className={`w-full flex items-center gap-3 py-2.5 text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-800/50 ${
                                    targetFolder === folder.id
                                      ? "bg-[#EC67A1]/20 text-[#EC67A1]"
                                      : "text-sidebar-foreground"
                                  }`}
                                  style={{ paddingLeft: `${16 + depth * 16}px`, paddingRight: '16px' }}
                                >
                                  {hasChildren ? (
                                    <FolderOpen className="w-4 h-4 text-[#EC67A1] flex-shrink-0" />
                                  ) : (
                                    <Folder className="w-4 h-4 text-[#EC67A1] flex-shrink-0" />
                                  )}
                                  <span className="flex-1 text-left truncate">{folder.name}</span>
                                  {depth > 0 && (
                                    <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">L{depth + 1}</span>
                                  )}
                                  {targetFolder === folder.id && (
                                    <Check className="w-4 h-4 text-[#EC67A1] flex-shrink-0" />
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  {getSelectedFolderDisplay()}
                </p>
              </div>

              {/* Error Display */}
              {error && (
                <div className="flex items-center gap-2 rounded-2xl border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || isCompressing || !imageFile || !videoFile}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#EC67A1] to-[#F774B9] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#EC67A1]/30 transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isGenerating ? "Generating..." : isCompressing ? "Processing Image..." : "Generate Video"}
                </button>
                <button
                  onClick={handleReset}
                  type="button"
                  disabled={isGenerating || isCompressing}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-700 px-5 py-3 text-sm font-semibold text-sidebar-foreground transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
                >
                  <RotateCcw className="w-4 h-4" /> Reset
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="space-y-6">
            {/* Generated Videos */}
            <div className="bg-[#F8F8F8] dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-3xl p-6 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur">
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
                <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/30 p-6 text-center text-header-muted">
                  <Video className="w-6 h-6 mx-auto mb-2 text-zinc-400 dark:text-zinc-500" />
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
                      className="group relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/30 cursor-pointer"
                    >
                      <video
                        data-role="preview"
                        src={video.videoUrl}
                        muted
                        playsInline
                        className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(video.videoUrl, `motion-control-${video.id}.mp4`);
                            }}
                            className="rounded-lg bg-white/20 p-2 text-white hover:bg-white/30 transition"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openVideoModal(video);
                            }}
                            className="rounded-lg bg-white/20 p-2 text-white hover:bg-white/30 transition"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Generation History */}
            <div className="bg-[#F8F8F8] dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-3xl p-6 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#EC67A1]">Library</p>
                  <h2 className="text-lg font-semibold text-sidebar-foreground">Recent generations</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowHistoryModal(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 px-3 py-1 text-xs text-sidebar-foreground transition hover:-translate-y-0.5 hover:shadow"
                  >
                    <Maximize2 className="w-3 h-3" />
                    View All
                  </button>
                  <button
                    type="button"
                    onClick={loadGenerationHistory}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 px-3 py-1 text-xs text-sidebar-foreground transition hover:-translate-y-0.5 hover:shadow"
                    disabled={isLoadingHistory}
                  >
                    {isLoadingHistory ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Refresh
                  </button>
                </div>
              </div>

              {generationHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/30 p-6 text-center text-header-muted">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-zinc-400 dark:text-zinc-500" />
                  <p className="text-sm">No previous generations yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[280px] overflow-y-auto pr-1">
                  {generationHistory.map((video) => (
                    <div
                      key={video.id}
                      role="button"
                      aria-label="Open video"
                      tabIndex={0}
                      onClick={() => video.videoUrl && openVideoModal(video)}
                      className="group relative overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/30 cursor-pointer max-w-[160px]"
                    >
                      {video.videoUrl ? (
                        <video
                          data-role="preview"
                          src={video.videoUrl}
                          muted
                          playsInline
                          className="w-full h-20 object-cover group-hover:scale-105 transition-transform duration-300"
                          onMouseEnter={(e) => e.currentTarget.play()}
                          onMouseLeave={(e) => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                          }}
                        />
                      ) : (
                        <div className="w-full h-20 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800/50">
                          <div className="text-center text-zinc-400 dark:text-zinc-500">
                            <Video className="w-5 h-5 mx-auto mb-1 opacity-50" />
                            <span className="text-[9px]">Unavailable</span>
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
                        <p className="text-[9px] text-white truncate">
                          {video.mode === "pro" ? "Pro" : "Std"} · {video.characterOrientation === "image" ? "Img" : "Vid"}
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowVideoModal(false);
            }}
          >
            <div
              className="relative w-full max-w-6xl max-h-[85vh] rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl shadow-[#EC67A1]/10"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full bg-zinc-100 dark:bg-zinc-800 p-2 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 z-10"
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
              <div className="p-4 text-sm text-sidebar-foreground flex justify-between items-start">
                <div>
                  <p className="font-semibold text-sidebar-foreground mb-1">
                    {selectedVideo.prompt || "Motion Control Video"}
                  </p>
                  <p className="text-zinc-400 dark:text-zinc-500">
                    {selectedVideo.mode === "pro" ? "Professional" : "Standard"} · {selectedVideo.characterOrientation === "image" ? "Match Image" : "Match Video"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownload(selectedVideo.videoUrl, `motion-control-${selectedVideo.id}.mp4`)}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 px-3 py-1.5 text-xs text-sidebar-foreground transition hover:-translate-y-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReuseSettings(selectedVideo)}
                    className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#EC67A1] via-[#F774B9] to-[#E1518E] px-3 py-1.5 text-xs text-white font-medium transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reuse Settings
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
              className="relative w-full max-w-7xl max-h-[90vh] overflow-auto rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl shadow-[#EC67A1]/10"
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
                  className="rounded-full bg-zinc-100 dark:bg-zinc-800 p-2 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                {generationHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-500">
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
                        className="group relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/30 cursor-pointer transition hover:border-[#EC67A1]/50 hover:shadow-lg hover:shadow-[#EC67A1]/10"
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
                          <div className="w-full aspect-video flex items-center justify-center bg-zinc-100 dark:bg-zinc-800/50">
                            <div className="text-center text-zinc-400 dark:text-zinc-500">
                              <Video className="w-8 h-8 mx-auto mb-2" />
                              <p className="text-xs">Processing...</p>
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
                        <div className="absolute bottom-0 left-0 right-0 p-3 text-white transform translate-y-full group-hover:translate-y-0 transition">
                          <p className="text-xs font-medium line-clamp-2 mb-1">{video.prompt || "Motion Control Video"}</p>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-300">
                            <span>{video.mode === "pro" ? "Pro" : "Std"}</span>
                            <span>•</span>
                            <span>{video.characterOrientation === "image" ? "Image" : "Video"}</span>
                          </div>
                        </div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                          <div className="rounded-full bg-[#EC67A1]/20 backdrop-blur-sm px-2 py-1 text-[10px] text-white border border-[#EC67A1]/30">
                            {video.status === "completed" ? "✓ Ready" : "Processing"}
                          </div>
                        </div>
                        {/* Profile badge when viewing all profiles */}
                        {isAllProfiles && video.profileName && (
                          <div className="absolute top-2 left-2">
                            <div className="rounded-full bg-zinc-900/80 backdrop-blur-sm px-2 py-1 text-[10px] text-white border border-[#EC67A1]/30">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm">
            <div className="relative max-w-3xl w-full rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-2xl shadow-[#EC67A1]/10 mx-4">
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full bg-zinc-100 dark:bg-zinc-800 p-2 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                onClick={() => setShowHelpModal(false)}
              >
                <span className="sr-only">Close</span>
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-6 text-sidebar-foreground">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-[#EC67A1]" />
                  <h3 className="text-xl font-semibold">Kling AI Motion Control Guide</h3>
                </div>
                
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-4">
                    <h4 className="font-semibold text-emerald-700 dark:text-emerald-100 mb-2">✓ Good Inputs</h4>
                    <ul className="text-sm space-y-1 text-emerald-700 dark:text-emerald-50 list-disc list-inside">
                      <li>Clear, well-lit character images</li>
                      <li>Smooth, stable reference videos</li>
                      <li>Similar body proportions</li>
                      <li>Visible full body or face</li>
                    </ul>
                  </div>
                  <div className="bg-red-500/10 border border-red-400/30 rounded-2xl p-4">
                    <h4 className="font-semibold text-red-700 dark:text-red-100 mb-2">✗ Avoid</h4>
                    <ul className="text-sm space-y-1 text-red-700 dark:text-red-50 list-disc list-inside">
                      <li>Blurry or low-quality images</li>
                      <li>Complex multi-person scenes</li>
                      <li>Very fast movements</li>
                      <li>Heavily occluded subjects</li>
                    </ul>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4 bg-white dark:bg-zinc-800/30">
                    <h4 className="font-semibold text-[#EC67A1] mb-2 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Character Orientation: Image
                    </h4>
                    <ul className="text-sm space-y-1 text-sidebar-foreground">
                      <li>• Output matches image orientation</li>
                      <li>• Maximum duration: 10 seconds</li>
                      <li>• Best for portrait/specific poses</li>
                    </ul>
                  </div>
                  <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4 bg-white dark:bg-zinc-800/30">
                    <h4 className="font-semibold text-[#EC67A1] mb-2 flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      Character Orientation: Video
                    </h4>
                    <ul className="text-sm space-y-1 text-sidebar-foreground">
                      <li>• Output matches video orientation</li>
                      <li>• Maximum duration: 30 seconds</li>
                      <li>• Best for dynamic movements</li>
                    </ul>
                  </div>
                </div>

                <div className="border border-amber-400/30 bg-amber-500/10 rounded-2xl p-4">
                  <h4 className="font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-100">
                    <AlertCircle className="w-4 h-4" />
                    Tips for Best Results
                  </h4>
                  <ul className="text-sm space-y-1 text-amber-700 dark:text-amber-50 list-disc list-inside">
                    <li>Use Professional mode for complex movements</li>
                    <li>Keep reference videos between 3-10 seconds for best quality</li>
                    <li>Ensure character in image has similar pose to video start</li>
                    <li>Enable &quot;Keep Original Sound&quot; for videos with important audio</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Reference Bank Selector for Images */}
      {mounted && globalProfileId && (
        <ReferenceSelector
          isOpen={showReferenceBankSelector}
          onClose={() => setShowReferenceBankSelector(false)}
          onSelect={handleReferenceBankSelect}
          filterType="image"
          profileId={globalProfileId}
        />
      )}

      {/* Reference Bank Selector for Videos */}
      {mounted && globalProfileId && (
        <ReferenceSelector
          isOpen={showVideoReferenceBankSelector}
          onClose={() => setShowVideoReferenceBankSelector(false)}
          onSelect={handleVideoReferenceBankSelect}
          filterType="video"
          profileId={globalProfileId}
        />
      )}

      {/* Credit Calculator */}
      <CreditCalculator
        path="kling-motion-control"
        modifiers={[
          ...(mode === 'pro' ? [{
            label: 'Professional Mode',
            multiplier: 2,
            description: 'Pro mode costs 2x more credits for higher quality'
          }] : []),
        ]}
        position="bottom-right"
      />
    </div>
  );
}
