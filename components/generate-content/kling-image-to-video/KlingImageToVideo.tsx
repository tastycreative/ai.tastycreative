"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
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
  Upload,
  Image as ImageIcon,
  Check,
  Library,
  HelpCircle,
  Save,
  Trash2,
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
  duration: string;
  aspectRatio: string;
  createdAt: string;
  status: "completed" | "processing" | "failed";
  imageUrl?: string;
  profileName?: string;
  metadata?: {
    negativePrompt?: string;
    mode?: string;
    cfgScale?: number;
    sound?: string | null;
    cameraControl?: any;
    imageMode?: string;
    referenceImageUrl?: string;
    tailImageUrl?: string;
    profileId?: string | null;
  };
}

// Kling model options with feature support flags
const MODEL_OPTIONS = [
  { value: "kling-v1", label: "Kling V1", description: "Standard quality", supportsSound: false, supportsCfgScale: true, supportsCameraControl: false },
  { value: "kling-v1-5", label: "Kling V1.5", description: "Enhanced quality", supportsSound: false, supportsCfgScale: true, supportsCameraControl: true },
  { value: "kling-v1-6", label: "Kling V1.6", description: "Enhanced V1", supportsSound: false, supportsCfgScale: true, supportsCameraControl: true },
  { value: "kling-v2-master", label: "Kling V2 Master", description: "V2 high quality", supportsSound: false, supportsCfgScale: false, supportsCameraControl: true },
  { value: "kling-v2-1", label: "Kling V2.1", description: "V2.1 standard", supportsSound: false, supportsCfgScale: false, supportsCameraControl: true },
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

// Camera control type options
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

// Image modes
const IMAGE_MODE_OPTIONS = [
  { value: "normal", label: "Normal", description: "Standard image-to-video" },
  { value: "pro", label: "Pro", description: "Professional quality with enhanced details" },
] as const;

// Tooltip content
const TOOLTIPS = {
  model: "Choose the AI model version. V1.6 is stable and supports CFG scale. V2.6 is the latest with audio support.",
  mode: "Standard mode is faster (~2-3 min). Professional mode produces higher quality but takes longer (~4-6 min).",
  cfgScale: "Controls creativity vs accuracy. Lower values (0-0.4) = more creative and varied. Higher values (0.6-1.0) = more faithful to prompt.",
  cameraControl: "Add cinematic camera movements like zoom, pan, tilt, or predefined motions to your video.",
  duration: "5 seconds for quick clips, 10 seconds for extended scenes. Longer duration increases generation time.",
  sound: "Enable AI-generated audio that matches your video. Only available in Professional mode with V2.6 model.",
  negativePrompt: "Describe what you want to avoid in the video (e.g., 'blurry, distorted, low quality, text, watermark').",
  imageMode: "Normal mode for standard conversion. Pro mode for enhanced details and tail image support (start+end frames).",
} as const;

// Tooltip component - using span instead of button to avoid hydration errors
const Tooltip = ({ content, children }: { content: string; children: React.ReactNode }) => (
  <span className="group relative inline-flex cursor-help">
    {children}
    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-48 rounded-lg bg-zinc-800 dark:bg-zinc-700 px-3 py-2 text-xs text-white shadow-lg group-hover:block z-50">
      {content}
      <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-800 dark:border-t-zinc-700" />
    </span>
  </span>
);

export default function KlingImageToVideo() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();
  const { refreshCredits } = useCredits();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use global profile from header
  const { profileId: globalProfileId, selectedProfile } = useInstagramProfile();
  
  // Check if "All Profiles" is selected
  const isAllProfiles = globalProfileId === "all";

  // Hydration fix - track if component is mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    
    // Check for reuse data from Vault
    const reuseData = sessionStorage.getItem('kling-i2v-reuse');
    if (reuseData) {
      try {
        const data = JSON.parse(reuseData);
        console.log('Restoring Kling I2V settings from Vault:', data);
        
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
        
        // Set CFG scale
        if (typeof data.cfgScale === 'number') {
          console.log('Restoring CFG scale from vault reuse:', data.cfgScale);
          setCfgScale(data.cfgScale);
        } else {
          console.log('No CFG scale in vault reuse data or invalid type:', typeof data.cfgScale, data.cfgScale);
        }
        
        // Set sound
        if (data.sound) {
          setSound(data.sound);
        }
        
        // Set image mode
        if (data.imageMode) {
          setImageMode(data.imageMode);
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
        
        // Load reference image if URL provided
        if (data.referenceImageUrl) {
          console.log('Loading reference image from vault reuse, URL:', data.referenceImageUrl);
          fetch(`/api/proxy-image?url=${encodeURIComponent(data.referenceImageUrl)}`)
            .then(res => {
              if (!res.ok) {
                throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
              }
              console.log('Proxy image response status:', res.status);
              return res.blob();
            })
            .then(blob => {
              console.log('Reference image loaded, size:', blob.size, 'type:', blob.type);
              const file = new File([blob], 'reference.jpg', { type: blob.type || 'image/jpeg' });
              setUploadedImage(file);
              setFromReferenceBank(false);
              setReferenceId(null);
              
              const reader = new FileReader();
              reader.onloadend = () => {
                setImagePreview(reader.result as string);
                console.log('Reference image preview set successfully');
              };
              reader.onerror = (err) => {
                console.error('FileReader error:', err);
              };
              reader.readAsDataURL(blob);
            })
            .catch(err => {
              console.error('Failed to load reference image from vault:', err);
              setError('Failed to load reference image. Please try uploading manually.');
            });
        } else {
          console.log('No reference image URL in vault reuse data');
        }
        
        // Clear the sessionStorage after reading
        sessionStorage.removeItem('kling-i2v-reuse');
      } catch (err) {
        console.error('Error parsing Kling I2V reuse data:', err);
        sessionStorage.removeItem('kling-i2v-reuse');
      }
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

  // Image upload state
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<string>("normal");
  const [tailImage, setTailImage] = useState<File | null>(null);
  const [tailImagePreview, setTailImagePreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);
  
  // Reference Bank state
  const [showReferenceBankSelector, setShowReferenceBankSelector] = useState(false);
  const [isSavingToReferenceBank, setIsSavingToReferenceBank] = useState(false);
  const [fromReferenceBank, setFromReferenceBank] = useState(false);
  const [referenceId, setReferenceId] = useState<string | null>(null);

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

  // Toast notifications state
  const [toastError, setToastError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  // Advanced settings collapse
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Toast notification helper
  const showErrorToast = (message: string) => {
    setToastError(message);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      setTimeout(() => setToastError(null), 300);
    }, 4000);
  };

  const pauseAllPreviews = () => {
    const previewVideos = document.querySelectorAll<HTMLVideoElement>("video[data-role='preview']");
    previewVideos.forEach((video) => {
      video.pause();
      video.currentTime = 0;
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, isTailImage: boolean = false) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showErrorToast("Please upload a valid image file");
      return;
    }

    // Allow larger initial files since we'll compress them
    if (file.size > 20 * 1024 * 1024) {
      showErrorToast("Image must be less than 20MB");
      return;
    }
    setIsCompressing(true);
    if (!isTailImage) {
      setCompressionInfo(null);
    }

    try {
      // Compress image if needed (target 3MB max for safe upload)
      const result = await compressImage(file, 3, 2048);

      if (isTailImage) {
        setTailImage(result.file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setTailImagePreview(reader.result as string);
        };
        reader.readAsDataURL(result.file);
      } else {
        setUploadedImage(result.file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(result.file);

        // Reset reference bank tracking for new uploads
        setFromReferenceBank(false);
        setReferenceId(null);

        // Show compression info if image was compressed
        if (result.compressed) {
          const savedMB = ((result.originalSize - result.newSize) / (1024 * 1024)).toFixed(1);
          const newSizeMB = (result.newSize / (1024 * 1024)).toFixed(1);
          setCompressionInfo(`Image compressed: ${newSizeMB}MB (saved ${savedMB}MB)`);
          console.log(`[Kling I2V] Image compressed: ${(result.originalSize / (1024 * 1024)).toFixed(1)}MB → ${newSizeMB}MB`);
        }
      }
    } catch (err) {
      console.error("Image compression failed:", err);
      showErrorToast("Failed to process image. Please try a different file.");
    } finally {
      setIsCompressing(false);
    }
  };

  const removeImage = (isTailImage: boolean = false) => {
    if (isTailImage) {
      setTailImage(null);
      setTailImagePreview(null);
    } else {
      setUploadedImage(null);
      setImagePreview(null);
      setCompressionInfo(null);
      setFromReferenceBank(false);
      setReferenceId(null);
    }
  };

  // Save image to Reference Bank (for file-based uploads)
  const saveToReferenceBank = async (file: File, imageBase64: string, skipIfExists?: boolean): Promise<string | null> => {
    if (!globalProfileId) return null;
    
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
          tags: ['kling', 'image-to-video'],
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

  // Handle selection from Reference Bank
  const handleReferenceBankSelect = async (item: ReferenceItem) => {
    try {
      // Fetch image via proxy
      const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(item.awsS3Url)}`);
      
      if (!proxyResponse.ok) {
        showErrorToast('Failed to load reference image. Please try again.');
        return;
      }
      
      const blob = await proxyResponse.blob();
      
      // Convert blob to File
      const file = new File([blob], item.name || 'reference.jpg', { type: blob.type || 'image/jpeg' });
      setUploadedImage(file);
      
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
      showErrorToast('Failed to load reference image. Please try again.');
    }

    setShowReferenceBankSelector(false);
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
      console.log("[Kling I2V Frontend] Loading generation history for profile:", globalProfileId);
      // Add profileId to filter by selected profile
      const url = globalProfileId
        ? `/api/generate/kling-image-to-video?history=true&profileId=${globalProfileId}`
        : "/api/generate/kling-image-to-video?history=true";
      console.log("[Kling I2V Frontend] Fetching:", url);
      const response = await apiClient.get(url);
      if (response.ok) {
        const data = await response.json();
        const videos = data.videos || [];
        console.log("[Kling I2V Frontend] Loaded videos:", videos.length);
        console.log("[Kling I2V Frontend] Video URLs present:", videos.filter((v: any) => !!v.videoUrl).length);
        if (videos.length > 0) {
          console.log("[Kling I2V Frontend] First video metadata:", videos[0]?.metadata);
          console.log("[Kling I2V Frontend] First video profileId:", videos[0]?.metadata?.profileId);
        }
        setGenerationHistory(videos);
      } else {
        console.error("[Kling I2V Frontend] Failed to load history, status:", response.status);
      }
    } catch (err) {
      console.error("[Kling I2V Frontend] Failed to load generation history:", err);
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
            `/api/generate/kling-image-to-video?taskId=${taskId}`
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
    if (!uploadedImage) {
      showErrorToast("Please upload an image first");
      return;
    }

    setIsGenerating(true);
    setGeneratedVideos([]);
    setPollingStatus("Submitting task...");
    const localTaskId = `kling-i2v-${Date.now()}`;

    // Save to Reference Bank before generating (only for new uploads, not from Reference Bank)
    if (globalProfileId && !fromReferenceBank && uploadedImage && imagePreview) {
      setIsSavingToReferenceBank(true);
      try {
        // Pass skipIfExists: true to avoid creating duplicates
        const newReferenceId = await saveToReferenceBank(uploadedImage, imagePreview, true);
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

    try {
      updateGlobalProgress({
        isGenerating: true,
        progress: 0,
        stage: "starting",
        message: "Starting Kling Image-to-Video generation...",
        generationType: "image-to-video",
        jobId: localTaskId,
      });
      
      // Create FormData for image upload
      const formData = new FormData();
      formData.append("image", uploadedImage);
      if (prompt.trim()) {
        formData.append("prompt", prompt.trim());
      }
      if (negativePrompt.trim()) {
        formData.append("negative_prompt", negativePrompt.trim());
      }
      formData.append("model_name", model); // API uses model_name, not model
      formData.append("mode", mode);
      formData.append("duration", duration);
      
      // Add CFG scale only for V1 models that support it
      if (currentModelSupportsCfgScale) {
        formData.append("cfg_scale", cfgScale.toString());
      }
      formData.append("image_mode", imageMode);

      // Add sound parameter (only for V2.6+ models)
      if (currentModelSupportsSound) {
        formData.append("sound", sound);
      }

      // Add tail image if provided (for pro mode)
      if (tailImage && imageMode === "pro") {
        formData.append("image_tail", tailImage); // API uses image_tail
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
          formData.append("camera_control", JSON.stringify({
            type: "simple",
            config: Object.keys(config).length > 0 ? config : undefined,
          }));
        } else {
          // For predefined types (down_back, forward_up, etc.), config must be empty
          formData.append("camera_control", JSON.stringify({
            type: cameraControlType,
          }));
        }
      }

      // Use folder's profileId for proper association (works for both single and all profiles views)
      const folderProfileId = targetFolder ? vaultFolders.find(f => f.id === targetFolder)?.profileId || globalProfileId : globalProfileId;
      if (folderProfileId && folderProfileId !== "all") {
        formData.append("vaultProfileId", folderProfileId);
      }
      
      // Add vault folder params if selected
      if (targetFolder && globalProfileId) {
        formData.append("saveToVault", "true");
        formData.append("vaultFolderId", targetFolder);
      }

      const response = await apiClient.post(
        "/api/generate/kling-image-to-video",
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
    setImageMode("normal");
    setUploadedImage(null);
    setImagePreview(null);
    setTailImage(null);
    setTailImagePreview(null);
    setTargetFolder("");
    setGeneratedVideos([]);
    setPollingStatus("");
  };

  // Handle reuse settings from a selected video
  const handleReuseSettings = async (video: GeneratedVideo) => {
    // Set prompt
    if (video.prompt) {
      setPrompt(video.prompt);
    }
    
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
    
    // Set CFG scale from metadata
    if (typeof video.metadata?.cfgScale === 'number') {
      setCfgScale(video.metadata.cfgScale);
    }
    
    // Set sound from metadata
    if (video.metadata?.sound) {
      setSound(video.metadata.sound as "on" | "off");
    }
    
    // Set image mode from metadata
    if (video.metadata?.imageMode) {
      setImageMode(video.metadata.imageMode);
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
    
    // Load reference image if URL provided
    if (video.metadata?.referenceImageUrl) {
      try {
        const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(video.metadata.referenceImageUrl)}`);
        if (proxyResponse.ok) {
          const blob = await proxyResponse.blob();
          const file = new File([blob], 'reference.jpg', { type: blob.type || 'image/jpeg' });
          setUploadedImage(file);
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
    
    // Close modal
    setShowVideoModal(false);
  };

  return (
    <div className="relative min-h-screen bg-white dark:bg-[#1a1625] text-sidebar-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-[#EC67A1]/20 dark:bg-[#EC67A1]/10 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-[#5DC3F8]/10 dark:bg-[#5DC3F8]/5 blur-3xl" />
        <div className="absolute inset-x-10 top-20 h-[1px] bg-gradient-to-r from-transparent via-zinc-300/30 dark:via-white/20 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header Section */}
        <div className="grid gap-4 md:grid-cols-[2fr_1fr] items-start">
          <div className="bg-[#F8F8F8] dark:bg-zinc-800/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F774B9] via-[#EC67A1] to-[#E1518E] shadow-lg shadow-[#EC67A1]/30">
                <Film className="w-6 h-6 text-white" />
                <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#EC67A1]">Motion Studio</p>
                <h1 className="text-3xl sm:text-4xl font-black text-sidebar-foreground">Kling AI — Image to Video</h1>
              </div>
            </div>
            <p className="text-sm sm:text-base text-header-muted leading-relaxed">
              Transform your images into stunning AI-generated videos using Kling AI&apos;s advanced image-to-video technology.
              Upload an image and let AI bring it to life with motion and dynamics.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EC67A1]/20 text-[#EC67A1]">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-sidebar-foreground">Image Input</p>
                  <p className="text-xs text-header-muted">Upload source</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EC67A1]/20 text-[#EC67A1]">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-sidebar-foreground">Camera Control</p>
                  <p className="text-xs text-header-muted">Dynamic motion</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20 bg-white dark:bg-zinc-800/30 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5DC3F8]/20 text-[#5DC3F8]">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-sidebar-foreground">AI Magic</p>
                  <p className="text-xs text-header-muted">Kling models</p>
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

            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-gradient-to-br from-[#EC67A1]/10 via-[#F774B9]/10 to-[#5DC3F8]/10 p-4 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-sidebar-foreground">Generation Status</p>
                  <p className="text-xs text-header-muted">
                    {isGenerating ? "Processing..." : "Ready to generate"}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-header-muted">
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#EC67A1]" />
                      <span className="font-medium text-[#EC67A1]">{pollingStatus || "Working..."}</span>
                    </>
                  ) : (
                    <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-emerald-600 dark:text-emerald-300 font-medium">Ready</span>
                  )}
                </div>
              </div>
              {pollingStatus && (
                <div className="mt-3 h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#EC67A1] to-[#F774B9] rounded-full animate-pulse" style={{ width: "75%" }} />
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
              {/* Image Upload Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-[#EC67A1]" />
                    <h3 className="text-base font-semibold text-sidebar-foreground">Upload Image</h3>
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

                {/* Main Image Upload */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-header-muted">
                    Source Image <span className="text-red-400">*</span>
                  </label>
                  {!imagePreview ? (
                    <div
                      onClick={() => !isCompressing && fileInputRef.current?.click()}
                      className={`border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-2xl p-8 text-center cursor-pointer hover:border-[#EC67A1]/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-all ${
                        isCompressing ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {isCompressing ? (
                        <>
                          <Loader2 className="h-12 w-12 text-[#EC67A1] mx-auto mb-3 animate-spin" />
                          <p className="text-sm text-sidebar-foreground mb-1">
                            Compressing image...
                          </p>
                        </>
                      ) : (
                        <>
                          <Upload className="h-12 w-12 text-zinc-400 dark:text-zinc-500 mx-auto mb-3" />
                          <p className="text-sm text-sidebar-foreground mb-1">
                            Click to upload image
                          </p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500">
                            PNG, JPG, WEBP up to 20MB · Auto-compressed
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Uploaded"
                        className={`w-full h-64 object-cover rounded-2xl border ${
                          fromReferenceBank ? 'border-[#EC67A1]/50' : 'border-zinc-200 dark:border-zinc-700'
                        }`}
                      />
                      <button
                        onClick={() => removeImage(false)}
                        className="absolute top-2 right-2 p-2 bg-red-500/90 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors backdrop-blur-sm"
                      >
                        <X className="h-4 w-4" />
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
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, false)}
                    className="hidden"
                    disabled={isCompressing}
                  />
                </div>

                {/* Image Mode Selection */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-header-muted">
                    Image Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {IMAGE_MODE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setImageMode(option.value)}
                        disabled={isGenerating}
                        className={`p-3 rounded-2xl border-2 transition-all ${
                          imageMode === option.value
                            ? "border-[#EC67A1]/60 bg-[#EC67A1]/10"
                            : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 hover:border-zinc-300 dark:hover:border-zinc-600"
                        } disabled:opacity-50`}
                      >
                        <div className="font-medium text-sm text-sidebar-foreground">
                          {option.label}
                        </div>
                        <div className="text-xs text-header-muted mt-1">
                          {option.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tail Image Upload (Pro Mode Only) */}
                {imageMode === "pro" && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-header-muted">
                      Tail Image (Optional)
                    </label>
                    {!tailImagePreview ? (
                      <div
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "image/*";
                          input.onchange = (e) => handleImageUpload(e as any, true);
                          input.click();
                        }}
                        className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-2xl p-4 text-center cursor-pointer hover:border-[#EC67A1]/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-all"
                      >
                        <Upload className="h-8 w-8 text-zinc-400 dark:text-zinc-500 mx-auto mb-2" />
                        <p className="text-xs text-header-muted">
                          Add ending frame (Pro mode)
                        </p>
                      </div>
                    ) : (
                      <div className="relative">
                        <img
                          src={tailImagePreview}
                          alt="Tail"
                          className="w-full h-32 object-cover rounded-2xl border border-zinc-200 dark:border-zinc-700"
                        />
                        <button
                          onClick={() => removeImage(true)}
                          className="absolute top-2 right-2 p-1 bg-red-500/90 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors backdrop-blur-sm"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Prompt Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className="text-base font-bold text-sidebar-foreground">Prompt (Optional)</label>
                  <Tooltip content={TOOLTIPS.negativePrompt}>
                    <HelpCircle className="w-4 h-4" />
                  </Tooltip>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the motion and scene you want to see in the video..."
                  className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 px-4 py-4 text-base text-sidebar-foreground placeholder-zinc-400 dark:placeholder-zinc-500 transition focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/50 focus:border-transparent disabled:opacity-50 resize-none"
                  rows={4}
                  disabled={isGenerating}
                />
                <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
                  <span>Add motion details for better results</span>
                  <span className={prompt.length > 150 ? 'text-[#EC67A1]' : ''}>{prompt.length} chars</span>
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

                    {/* Image Mode Dropdown */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-medium text-header-muted">Image Mode</label>
                        <Tooltip content={TOOLTIPS.imageMode}>
                          <HelpCircle className="w-3 h-3" />
                        </Tooltip>
                      </div>
                      <select
                        value={imageMode}
                        onChange={(e) => setImageMode(e.target.value)}
                        disabled={isGenerating}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/50 focus:border-transparent disabled:opacity-50 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700"
                      >
                        {IMAGE_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
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
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors border border-zinc-200 dark:border-zinc-700"
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
                          ? "border-[#EC67A1]/60 bg-[#EC67A1]/10 text-sidebar-foreground shadow-[#EC67A1]/10"
                          : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 text-sidebar-foreground"
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
                          ? "border-[#5DC3F8]/60 bg-[#5DC3F8]/10 text-sidebar-foreground shadow-[#5DC3F8]/10"
                          : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 text-sidebar-foreground"
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
                        ? "border-[#EC67A1]/60 bg-[#EC67A1]/10 text-sidebar-foreground shadow-[#EC67A1]/10"
                        : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 text-sidebar-foreground"
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
                                  ? "border-[#EC67A1]/60 bg-[#EC67A1]/10 text-sidebar-foreground"
                                  : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 text-header-muted"
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
                            <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
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

              {/* Folder Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Archive className="w-4 h-4 text-[#EC67A1]" />
                  <p className="text-sm font-semibold text-sidebar-foreground">Save to Vault</p>
                  {isLoadingVaultData && (
                    <Loader2 className="w-3 h-3 animate-spin text-[#EC67A1]" />
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
                        ? 'border-[#EC67A1] bg-[#EC67A1]/10 ring-2 ring-[#EC67A1]/30' 
                        : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 hover:border-[#EC67A1]/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`
                        flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
                        ${targetFolder 
                          ? 'bg-gradient-to-br from-[#EC67A1]/20 to-[#F774B9]/20 border border-[#EC67A1]/30' 
                          : 'bg-zinc-100 dark:bg-zinc-700/50 border border-zinc-200/50 dark:border-white/5'
                        }
                      `}>
                        <FolderOpen className={`w-4 h-4 ${targetFolder ? 'text-[#EC67A1]' : 'text-zinc-400 dark:text-zinc-500'}`} />
                      </div>
                      <div className="text-left min-w-0">
                        <p className={`text-sm font-medium truncate ${targetFolder ? 'text-sidebar-foreground' : 'text-zinc-400 dark:text-zinc-500'}`}>
                          {targetFolder 
                            ? vaultFolders.find(f => f.id === targetFolder)?.name || 'Select folder...'
                            : 'Select a folder...'
                          }
                        </p>
                        {targetFolder && (
                          <p className="text-[11px] text-[#EC67A1]/70 truncate">
                            {isAllProfiles 
                              ? vaultFolders.find(f => f.id === targetFolder)?.profileName || ''
                              : selectedProfile?.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile?.name || ''
                            }
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-zinc-400 dark:text-zinc-500 transition-transform duration-200 flex-shrink-0 ${folderDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {folderDropdownOpen && mounted && (
                    <div className="absolute z-50 w-full bottom-full mb-2 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
                      {/* Clear Selection Option */}
                      <button
                        type="button"
                        onClick={() => {
                          setTargetFolder('');
                          setFolderDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700/50 flex items-center justify-center">
                          <X className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                        </div>
                        <span className="text-sm text-zinc-400 dark:text-zinc-500">No folder selected</span>
                        {!targetFolder && <Check className="w-4 h-4 text-[#EC67A1] ml-auto" />}
                      </button>

                      {vaultFolders.filter(f => !f.isDefault).length > 0 && (
                        <div className="my-2 mx-3 h-px bg-zinc-200 dark:bg-zinc-700" />
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
                                        ? 'bg-[#EC67A1]/15' 
                                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                                      }
                                    `}
                                    style={{ paddingLeft: `${16 + depth * 16}px`, paddingRight: '16px' }}
                                  >
                                    <div className={`
                                      w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0
                                      ${targetFolder === folder.id 
                                        ? 'bg-gradient-to-br from-[#EC67A1]/30 to-[#F774B9]/30 border border-[#EC67A1]/40' 
                                        : 'bg-zinc-100 dark:bg-zinc-700/50 border border-zinc-200/50 dark:border-white/5'
                                      }
                                    `}>
                                      {hasChildren ? (
                                        <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? 'text-[#EC67A1]' : 'text-zinc-400 dark:text-zinc-500'}`} />
                                      ) : (
                                        <Folder className={`w-4 h-4 ${targetFolder === folder.id ? 'text-[#EC67A1]' : 'text-zinc-400 dark:text-zinc-500'}`} />
                                      )}
                                    </div>
                                    <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-sidebar-foreground font-medium' : 'text-sidebar-foreground'}`}>
                                      {folder.name}
                                    </span>
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
                                    ? 'bg-[#EC67A1]/15' 
                                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                                  }
                                `}
                                style={{ paddingLeft: `${16 + depth * 16}px`, paddingRight: '16px' }}
                              >
                                <div className={`
                                  w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0
                                  ${targetFolder === folder.id 
                                    ? 'bg-gradient-to-br from-[#EC67A1]/30 to-[#F774B9]/30 border border-[#EC67A1]/40' 
                                    : 'bg-zinc-100 dark:bg-zinc-700/50 border border-zinc-200/50 dark:border-white/5'
                                  }
                                `}>
                                  {hasChildren ? (
                                    <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? 'text-[#EC67A1]' : 'text-zinc-400 dark:text-zinc-500'}`} />
                                  ) : (
                                    <Folder className={`w-4 h-4 ${targetFolder === folder.id ? 'text-[#EC67A1]' : 'text-zinc-400 dark:text-zinc-500'}`} />
                                  )}
                                </div>
                                <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-sidebar-foreground font-medium' : 'text-sidebar-foreground'}`}>
                                  {folder.name}
                                </span>
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

                      {vaultFolders.filter(f => !f.isDefault).length === 0 && (
                        <div className="px-4 py-6 text-center">
                          <FolderOpen className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                          <p className="text-sm text-zinc-400 dark:text-zinc-500">No folders available</p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Create folders in the Vault tab</p>
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
                      {getSelectedFolderDisplay()}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || isCompressing || !uploadedImage}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#EC67A1] to-[#F774B9] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#EC67A1]/30 transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : isCompressing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Processing Image...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5" />
                      <span>Generate Video</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleReset}
                  disabled={isGenerating || isCompressing}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-200 dark:bg-zinc-700 px-6 py-3 text-sm font-semibold text-sidebar-foreground hover:bg-zinc-300 dark:hover:bg-zinc-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="space-y-6">
            {/* Status Display */}
            {pollingStatus && (
              <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl backdrop-blur">
                <Loader2 className="h-5 w-5 text-blue-400 animate-spin flex-shrink-0" />
                <p className="text-blue-300 text-sm font-medium">
                  {pollingStatus}
                </p>
              </div>
            )}

            {/* Generated Videos */}
            <div className="bg-[#F8F8F8] dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-3xl p-6 shadow-2xl shadow-[#EC67A1]/10 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-[#5DC3F8]" />
                  <h3 className="text-base font-semibold text-sidebar-foreground">Generated Videos</h3>
                </div>
              </div>
              {generatedVideos.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 dark:text-zinc-500">
                  <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Your generated videos will appear here</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {generatedVideos.map((video) => (
                    <div
                      key={video.id}
                      className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow bg-white dark:bg-zinc-800/30 backdrop-blur"
                    >
                      <video
                        src={video.videoUrl}
                        controls
                        className="w-full aspect-video bg-black"
                        data-role="preview"
                      />
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            {video.imageUrl && (
                              <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">
                                Source: Image
                              </p>
                            )}
                            {video.prompt && (
                              <p className="text-sm text-sidebar-foreground mb-2 line-clamp-2">
                                {video.prompt}
                              </p>
                            )}
                            <div className="flex gap-2 text-xs text-zinc-400 dark:text-zinc-500">
                              <span>{video.model}</span>
                              <span>•</span>
                              <span>{video.duration}s</span>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              handleDownload(
                                video.videoUrl,
                                `kling-i2v-${video.id}.mp4`
                              )
                            }
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            title="Download video"
                          >
                            <Download className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
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
                <div className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-[#EC67A1]" />
                  <h3 className="text-base font-semibold text-sidebar-foreground">Recent Generations</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowHistoryModal(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 px-3 py-1 text-xs text-sidebar-foreground transition hover:-translate-y-0.5 hover:shadow"
                  >
                    <Maximize2 className="w-3 h-3" />
                    View All
                  </button>
                  <button
                    onClick={loadGenerationHistory}
                    disabled={isLoadingHistory}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:cursor-not-allowed"
                    title="Refresh history"
                  >
                    <RefreshCw
                      className={`h-4 w-4 text-zinc-400 dark:text-zinc-500 ${
                        isLoadingHistory ? "animate-spin" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>

              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 text-[#EC67A1] animate-spin" />
                </div>
              ) : generationHistory.length === 0 ? (
                <div className="text-center py-6 text-zinc-400 dark:text-zinc-500">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No generation history yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[320px] overflow-y-auto pr-1">
                  {generationHistory.map((video) => (
                    <div
                      key={video.id}
                      className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-600 transition-all cursor-pointer bg-white dark:bg-zinc-800/30 max-w-[180px]"
                      onClick={() => {
                        if (video.videoUrl) {
                          setSelectedVideo(video);
                          setShowVideoModal(true);
                        }
                      }}
                    >
                      <div className="relative h-24 bg-black">
                        {video.videoUrl ? (
                          <video
                            src={video.videoUrl}
                            className="w-full h-full object-cover"
                            data-role="preview"
                            preload="metadata"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800/50">
                            <div className="text-center text-zinc-400 dark:text-zinc-500">
                              <Video className="w-5 h-5 mx-auto mb-1 opacity-50" />
                              <span className="text-[10px]">Unavailable</span>
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                          <Play className="h-8 w-8 text-white" />
                        </div>
                      </div>
                      <div className="px-2 py-2">
                        {video.prompt && (
                          <p className="text-xs text-sidebar-foreground truncate">
                            {video.prompt}
                          </p>
                        )}
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                          {video.model} · {video.duration}s
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
      {showVideoModal && selectedVideo && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
            <div className="relative max-w-4xl w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-3xl shadow-2xl shadow-[#EC67A1]/10">
              <button
                onClick={() => {
                  pauseAllPreviews();
                  setShowVideoModal(false);
                  setSelectedVideo(null);
                }}
                className="absolute -top-4 -right-4 p-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full shadow-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors z-10"
              >
                <X className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
              </button>
              <div className="p-6">
                <video
                  src={selectedVideo.videoUrl}
                  controls
                  autoPlay
                  className="w-full aspect-video bg-black rounded-2xl mb-4"
                />
                <div className="space-y-3">
                  {selectedVideo.imageUrl && (
                    <div>
                      <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500 mb-1">
                        Source Image:
                      </p>
                      <img
                        src={selectedVideo.imageUrl}
                        alt="Source"
                        className="w-32 h-32 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"
                      />
                    </div>
                  )}
                  {selectedVideo.prompt && (
                    <div>
                      <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500 mb-1">
                        Prompt:
                      </p>
                      <p className="text-sm text-sidebar-foreground">
                        {selectedVideo.prompt}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-4 text-sm text-zinc-400 dark:text-zinc-500">
                      <span>Model: {selectedVideo.model}</span>
                      <span>Duration: {selectedVideo.duration}s</span>
                      <span>
                        Created: {new Date(selectedVideo.createdAt).toLocaleString()}
                      </span>
                    </div>
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
                            `kling-i2v-${selectedVideo.id}.mp4`
                          )
                        }
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:shadow-lg text-white rounded-full transition"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* View All History Modal */}
      {showHistoryModal && typeof document !== "undefined" &&
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
                  className="rounded-full bg-zinc-200 dark:bg-zinc-700 p-2 text-sidebar-foreground hover:bg-zinc-300 dark:hover:bg-zinc-600 transition"
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
                            pauseAllPreviews();
                            setSelectedVideo(video);
                            setShowVideoModal(true);
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
                        {video.imageUrl && (
                          <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition">
                            <img
                              src={video.imageUrl}
                              alt="Source"
                              className="w-12 h-12 rounded-lg border border-zinc-200 dark:border-zinc-600 object-cover"
                            />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
                        <div className="absolute bottom-0 left-0 right-0 p-3 text-white transform translate-y-full group-hover:translate-y-0 transition">
                          <p className="text-xs font-medium line-clamp-2 mb-1">{video.prompt || 'No prompt'}</p>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-300">
                            <span>{video.model}</span>
                            <span>•</span>
                            <span>{video.duration}s</span>
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

      {/* Toast Notification */}
      {showToast && toastError && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top">
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-400/30 rounded-2xl backdrop-blur shadow-2xl max-w-md">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
              <p className="text-red-600 dark:text-red-300 text-sm flex-1">{toastError}</p>
              <button
                onClick={() => {
                  setShowToast(false);
                  setTimeout(() => setToastError(null), 300);
                }}
                className="ml-auto p-1 hover:bg-red-500/20 rounded-full transition-colors"
              >
                <X className="h-4 w-4 text-red-300" />
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* Help Modal */}
      {showHelpModal && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
            <div className="relative max-w-2xl w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-3xl shadow-2xl shadow-[#EC67A1]/10 max-h-[80vh] overflow-y-auto">
              <button
                onClick={() => setShowHelpModal(false)}
                className="absolute top-4 right-4 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
              </button>
              <div className="p-8">
                <h2 className="text-2xl font-bold text-sidebar-foreground mb-6">
                  Kling Image to Video - Help Guide
                </h2>
                <div className="space-y-6 text-header-muted">
                  <div>
                    <h3 className="text-lg font-semibold text-sidebar-foreground mb-2">
                      Getting Started
                    </h3>
                    <p className="text-sm leading-relaxed">
                      Transform your images into dynamic videos using Kling AI's advanced
                      image-to-video technology. Upload an image, optionally add a prompt
                      to guide the motion, and let AI bring it to life.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-sidebar-foreground mb-2">
                      Image Modes
                    </h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>
                        <strong className="text-sidebar-foreground">Normal:</strong> Standard image-to-video conversion
                      </li>
                      <li>
                        <strong className="text-sidebar-foreground">Pro:</strong> Professional quality with option to add a
                        tail image (ending frame)
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-sidebar-foreground mb-2">
                      Settings Guide
                    </h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>
                        <strong className="text-sidebar-foreground">Model:</strong> Choose between V1, V1.5, or V1.6 (latest)
                      </li>
                      <li>
                        <strong className="text-sidebar-foreground">Mode:</strong> Standard for speed, Professional for quality
                      </li>
                      <li>
                        <strong className="text-sidebar-foreground">Duration:</strong> 5 or 10 seconds
                      </li>
                      <li>
                        <strong className="text-sidebar-foreground">CFG Scale:</strong> Lower = more creative, Higher = more
                        accurate to prompt
                      </li>
                      <li>
                        <strong className="text-sidebar-foreground">Camera Control:</strong> Add dynamic camera movements
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-sidebar-foreground mb-2">
                      Tips for Best Results
                    </h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Use high-quality, clear images</li>
                      <li>
                        Add prompts to describe the desired motion or scene changes
                      </li>
                      <li>Try different camera controls for varied effects</li>
                      <li>Use Pro mode with tail images for precise beginning and ending</li>
                      <li>Experiment with CFG scale to balance creativity and accuracy</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Reference Bank Selector */}
      {mounted && globalProfileId && (
        <ReferenceSelector
          isOpen={showReferenceBankSelector}
          onClose={() => setShowReferenceBankSelector(false)}
          onSelect={handleReferenceBankSelect}
          filterType="image"
          profileId={globalProfileId}
        />
      )}

      {/* Credit Calculator */}
      <CreditCalculator
        path="kling-image-to-video"
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
