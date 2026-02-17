"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  Download, 
  Trash2, 
  RefreshCw, 
  Loader2,
  CheckCircle,
  XCircle,
  Settings,
  Share2,
  ChevronDown,
  Wand2,
  AlertCircle,
  Clock,
  Archive,
  FolderOpen,
  Check,
} from 'lucide-react';
import Image from 'next/image';
import { useApiClient } from '@/lib/apiClient';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';
import VaultFolderDropdown from '@/components/generate-content/shared/VaultFolderDropdown';
import { useCredits } from '@/lib/hooks/useCredits.query';
import { CreditCalculator } from '@/components/credits/CreditCalculator';
import { StorageFullBanner, useCanGenerate } from '@/components/generate-content/shared/StorageFullBanner';
import { convertS3ToCdnUrl } from '@/lib/cdnUtils';

interface JobStatus {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress?: number;
  message?: string;
  resultUrls?: string[];
  createdAt: Date;
  params?: any;
}

interface ImageFile {
  file: File;
  preview: string;
  id: string;
}

// Database image interface for fetching from database
interface DatabaseImage {
  id: string;
  filename: string;
  subfolder: string;
  type: string;
  fileSize?: number;
  width?: number;
  height?: number;
  format?: string;
  url?: string | null; // Dynamically constructed URL (includes awsS3Url as priority)
  dataUrl?: string; // Database-served image URL
  createdAt: Date | string;
}

// Vault interface
interface VaultFolder {
  id: string;
  name: string;
  profileId: string;
  clerkId: string; // Owner of the folder (important for shared profiles)
  profileName?: string;
  profileUsername?: string | null;
  isDefault?: boolean;
  isOwnedProfile?: boolean;
  ownerName?: string | null;
}

const PROGRESS_STAGES: Array<{ key: 'queued' | 'enhancing' | 'saving'; label: string; description: string }> = [
  {
    key: 'queued',
    label: 'Queued',
    description: 'Job received and preparing workflow'
  },
  {
    key: 'enhancing',
    label: 'Enhancing',
    description: 'AI retouching skin and refining details'
  },
  {
    key: 'saving',
    label: 'Saving',
    description: 'Uploading enhanced image to your library'
  }
];

const formatDuration = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }
  return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
};

export default function ImageToImageSkinEnhancerPage() {
  const { user } = useUser();
  const apiClient = useApiClient();
  const { refreshCredits } = useCredits();
  const { canGenerate, storageError } = useCanGenerate();

  // Use global profile from header
  const { profileId: globalProfileId, selectedProfile, isAllProfiles } = useInstagramProfile();
  
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentJob, setCurrentJob] = useState<JobStatus | null>(null);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [jobImages, setJobImages] = useState<Record<string, DatabaseImage[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [comparisonMode, setComparisonMode] = useState<'side-by-side' | 'slider'>('side-by-side');
  const [sliderPosition, setSliderPosition] = useState(50);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState<string>('');
  const [jobStartTime, setJobStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastJobDuration, setLastJobDuration] = useState<string | null>(null);
  const [targetFolder, setTargetFolder] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  
  // Folder selection dropdown state
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  
  // Vault folder states - single list based on selected profile
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  const [isLoadingVaultData, setIsLoadingVaultData] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const adjustSlider = useCallback((delta: number) => {
    setSliderPosition(prev => Math.max(0, Math.min(100, prev + delta)));
  }, []);

  // Fixed values from your JSON workflow - no user modifications needed
  const FIXED_VALUES = {
    positivePrompt: 'closeup photo of a young woman with natural skin imperfections, fine skin pores, and realistic skin tones, photorealistic, soft diffused lighting, subsurface scattering, hyper-detailed shading, dynamic shadows, 8K resolution, cinematic lighting, masterpiece, intricate details, shot on a DSLR with a 50mm lens.',
    negativePrompt: 'Blurred, out of focus, low resolution, pixelated, cartoonish, unrealistic, overexposed, underexposed, flat lighting, distorted, artifacts, noise, extra limbs, deformed features, plastic skin, airbrushed, CGI, over-saturated colors, watermarks, text.',
    selectedModel: 'epicrealismXL_vxviLastfameRealism.safetensors',
    selectedLoRA: 'real-humans-PublicPrompts.safetensors',  // Using real-humans instead of corrupted Real.People
    loraStrength: 1.0,
    moreDetailsLoRA: 'more_details.safetensors',
    moreDetailsStrength: 1.0,
    steps: 25,
    cfg: 1.5,
    denoise: 0.3,
    seed: 6,
    sampler: 'dpmpp_2m',
    scheduler: 'karras'
  };

  // Load vault folders for the selected profile (or all profiles)
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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.title = 'TastyCreative AI - Image-to-Image Skin Enhancer';
    
    return () => {
      document.title = 'TastyCreative AI - Image-to-Image Skin Enhancer';
    };
  }, []);

  // Cleanup preview URLs
  useEffect(() => {
    return () => {
      if (selectedImage) {
        URL.revokeObjectURL(selectedImage.preview);
      }
    }
  }, [selectedImage]);

  // Restore comparison preference
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedMode = window.localStorage.getItem('image-to-image-comparison-mode');
    if (storedMode === 'side-by-side' || storedMode === 'slider') {
      setComparisonMode(storedMode);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('image-to-image-comparison-mode', comparisonMode);
  }, [comparisonMode]);

  useEffect(() => {
    if (currentJob?.status === 'PROCESSING' && !jobStartTime) {
      setJobStartTime(Date.now());
      setElapsedSeconds(0);
    }
    if (!currentJob || currentJob.status === 'COMPLETED' || currentJob.status === 'FAILED') {
      setJobStartTime(null);
    }
  }, [currentJob, jobStartTime]);

  useEffect(() => {
    if (!jobStartTime || !currentJob || currentJob.status === 'COMPLETED' || currentJob.status === 'FAILED') {
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - jobStartTime) / 1000));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [jobStartTime, currentJob]);

  useEffect(() => {
    const handleKeyShortcuts = (event: KeyboardEvent) => {
      if (!currentJob || currentJob.status !== 'COMPLETED') return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        setComparisonMode('side-by-side');
        event.preventDefault();
      } else if (event.key === 'ArrowRight') {
        setComparisonMode('slider');
        event.preventDefault();
      } else if ((event.key === '+' || event.key === '=') && comparisonMode === 'slider') {
        adjustSlider(5);
        event.preventDefault();
      } else if ((event.key === '-' || event.key === '_') && comparisonMode === 'slider') {
        adjustSlider(-5);
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyShortcuts);
    return () => window.removeEventListener('keydown', handleKeyShortcuts);
  }, [currentJob, comparisonMode, adjustSlider]);

  const activeStageIndex = React.useMemo(() => {
    if (!currentJob) return -1;
    if (currentJob.status === 'FAILED') return 0;
    if (currentJob.status === 'COMPLETED') return PROGRESS_STAGES.length - 1;
    if (currentJob.status === 'PROCESSING') return 1;
    return 0;
  }, [currentJob]);

  const formattedElapsed = React.useMemo(() => {
    const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
    const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [elapsedSeconds]);

  const describeImageSource = useCallback((image: DatabaseImage) => {
    if (image.url && image.dataUrl) {
      return 'Stored in cloud & cached';
    }
    if (image.url) {
      return 'Served from cloud storage';
    }
    if (image.dataUrl) {
      return 'Served from database';
    }
    return 'Source unknown';
  }, []);

  // Function to fetch images for a completed job from database
  const fetchJobImages = useCallback(async (jobId: string): Promise<DatabaseImage[] | null> => {
    if (!apiClient) return null;

    try {
      console.log("🖼️ Fetching database images for job:", jobId);
      
      const response = await apiClient.get(`/api/jobs/${jobId}/images`);
      console.log("📡 Image fetch response status:", response.status);

      if (!response.ok) {
        console.error("Failed to fetch job images:", response.status);
        return null;
      }

      const data = await response.json();
      console.log("📊 Job images data:", data);

      if (data.success && data.images && Array.isArray(data.images)) {
        console.log("📊 Raw images from database:", data.images);
        setJobImages((prev) => ({
          ...prev,
          [jobId]: data.images,
        }));
        console.log(`✅ Updated job images state for job: ${jobId}, Images count: ${data.images.length}`);

        return data.images;
      } else {
        console.warn("⚠️ Invalid response format:", data);
        return null;
      }
    } catch (error) {
      console.error("💥 Error fetching job images:", error);
      return null;
    }
  }, [apiClient]);

  // Function to download database image
  const downloadDatabaseImage = async (image: DatabaseImage) => {
    if (!apiClient) return;

    try {
      console.log("📥 Downloading image:", image.filename);
      console.log("📥 Available URLs:", {
        dataUrl: image.dataUrl,
        url: image.url
      });

      // Priority 1: Download from URL (which includes AWS S3 URL)
      if (image.url) {
        console.log("Using url for download");
        downloadFromUrl(image.url, image.filename);
        return;
      }

      // Priority 2: Download from database URL
      if (image.dataUrl) {
        const response = await apiClient.get(image.dataUrl);
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          downloadFromUrl(url, image.filename);
          window.URL.revokeObjectURL(url);
          return;
        }
      }

      throw new Error("No download URL available");
    } catch (error) {
      console.error("Error downloading image:", error);
      alert(
        "Failed to download image: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  // Function to share image URL
  const shareImage = (image: DatabaseImage) => {
    let urlToShare = "";

    if (image.dataUrl) {
      urlToShare = `${window.location.origin}${image.dataUrl}`;
    } else if (image.url) {
      urlToShare = image.url;
    } else {
      alert("No shareable URL available for this image");
      return;
    }

    navigator.clipboard.writeText(urlToShare);
    alert("Image URL copied to clipboard!");
  };

  // Helper function for legacy URL downloads
  const downloadFromUrl = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  };

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    processImageFile(file);
  }, []);

  const processImageFile = useCallback((file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB');
      return;
    }

    // Clear previous image
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage.preview);
    }

    const imageFile: ImageFile = {
      file,
      preview: URL.createObjectURL(file),
      id: `img_${Date.now()}`
    };

    setSelectedImage(imageFile);
    setError(null);
  }, [selectedImage]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  }, [processImageFile]);

  const removeImage = useCallback(() => {
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage.preview);
      setSelectedImage(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [selectedImage]);

  const createWorkflowForImageToImageSkinEnhancer = useCallback((
    inputImageBase64: string
  ) => {
    // Use fixed values from your JSON workflow
    const workflow = {
      "1": {
        "inputs": {
          "samples": ["16", 0],
          "mask": ["14", 1]
        },
        "class_type": "SetLatentNoiseMask",
        "_meta": {
          "title": "SetLatentNoiseMask"
        }
      },
      "2": {
        "inputs": {
          "samples": ["31", 0],
          "vae": ["39", 2]
        },
        "class_type": "VAEDecode",
        "_meta": {
          "title": "VAEDecode"
        }
      },
      "3": {
        "inputs": {},
        "class_type": "FaceParsingProcessorLoader(FaceParsing)",
        "_meta": {
          "title": "FaceParsingProcessorLoader(FaceParsing)"
        }
      },
      "4": {
        "inputs": {
          "model": ["32", 0],
          "processor": ["3", 0],
          "image": ["25", 0]
        },
        "class_type": "FaceParse(FaceParsing)",
        "_meta": {
          "title": "FaceParse(FaceParsing)"
        }
      },
      "5": {
        "inputs": {
          "result": ["4", 1],
          "background": false,
          "skin": false,
          "nose": false,
          "eye_g": false,
          "r_eye": true,
          "l_eye": true,
          "r_brow": false,
          "l_brow": false,
          "r_ear": false,
          "l_ear": false,
          "mouth": true,
          "u_lip": true,
          "l_lip": true,
          "hair": false,
          "hat": false,
          "ear_r": false,
          "neck_l": false,
          "neck": false,
          "cloth": false
        },
        "class_type": "FaceParsingResultsParser(FaceParsing)",
        "_meta": {
          "title": "FaceParsingResultsParser(FaceParsing)"
        }
      },
      "6": {
        "inputs": {
          "mask": ["30", 0]
        },
        "class_type": "MaskToImage",
        "_meta": {
          "title": "MaskToImage"
        }
      },
      "7": {
        "inputs": {
          "mask": ["5", 0]
        },
        "class_type": "MaskPreview+",
        "_meta": {
          "title": "MaskPreview+"
        }
      },
      "8": {
        "inputs": {
          "images": ["10", 0]
        },
        "class_type": "PreviewImage",
        "_meta": {
          "title": "PreviewImage"
        }
      },
      "9": {
        "inputs": {
          "images": ["4", 0]
        },
        "class_type": "PreviewImage",
        "_meta": {
          "title": "PreviewImage"
        }
      },
      "10": {
        "inputs": {
          "image": ["25", 0],
          "mask": ["6", 0],
          "force_resize_width": 0,
          "force_resize_height": 0
        },
        "class_type": "Cut By Mask",
        "_meta": {
          "title": "Cut By Mask"
        }
      },
      "11": {
        "inputs": {
          "destination": ["25", 0],
          "source": ["26", 0],
          "mask": ["30", 0],
          "x": 0,
          "y": 0,
          "resize_source": false
        },
        "class_type": "ImageCompositeMasked",
        "_meta": {
          "title": "ImageCompositeMasked"
        }
      },
      "12": {
        "inputs": {
          "image": ["11", 0],
          "width": ["19", 3],
          "height": ["19", 4],
          "interpolation": "lanczos",
          "method": "keep proportion",
          "condition": "always",
          "multiple_of": 0
        },
        "class_type": "ImageResize+",
        "_meta": {
          "title": "ImageResize+"
        }
      },
      "13": {
        "inputs": {
          "destination": ["2", 0],
          "source": ["12", 0],
          "mask": ["30", 0],
          "x": ["19", 1],
          "y": ["19", 2],
          "resize_source": false
        },
        "class_type": "ImageCompositeMasked",
        "_meta": {
          "title": "ImageCompositeMasked"
        }
      },
      "14": {
        "inputs": {
          "images": ["40", 0],
          "face": true,
          "hair": true,
          "body": true,
          "clothes": false,
          "accessories": false,
          "background": false,
          "confidence": 0.2,
          "detail_method": "VITMatte(local)",
          "detail_erode": 6,
          "detail_dilate": 6,
          "black_point": 0.01,
          "white_point": 0.99,
          "process_detail": true,
          "device": "cuda",
          "max_megapixels": 2
        },
        "class_type": "LayerMask: PersonMaskUltra V2",
        "_meta": {
          "title": "LayerMask: PersonMaskUltra V2"
        }
      },
      "15": {
        "inputs": {
          "images": ["2", 0]
        },
        "class_type": "PreviewImage",
        "_meta": {
          "title": "PreviewImage"
        }
      },
      "16": {
        "inputs": {
          "pixels": ["14", 0],
          "vae": ["39", 2]
        },
        "class_type": "VAEEncode",
        "_meta": {
          "title": "VAEEncode"
        }
      },
      "17": {
        "inputs": {
          "clip": ["29", 1],
          "text": FIXED_VALUES.negativePrompt
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
          "title": "CLIPTextEncode"
        }
      },
      "18": {
        "inputs": {
          "clip": ["29", 1],
          "text": FIXED_VALUES.positivePrompt
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
          "title": "CLIPTextEncode"
        }
      },
      "19": {
        "inputs": {
          "analysis_models": ["20", 0],
          "image": ["2", 0],
          "padding": 300,
          "padding_percent": 0,
          "index": 0
        },
        "class_type": "FaceBoundingBox",
        "_meta": {
          "title": "FaceBoundingBox"
        }
      },
      "20": {
        "inputs": {
          "library": "insightface",
          "provider": "CUDA"
        },
        "class_type": "FaceAnalysisModels",
        "_meta": {
          "title": "FaceAnalysisModels"
        }
      },
      "21": {
        "inputs": {
          "mask": ["14", 1]
        },
        "class_type": "MaskPreview+",
        "_meta": {
          "title": "MaskPreview+"
        }
      },
      "22": {
        "inputs": {
          "analysis_models": ["23", 0],
          "image": ["40", 0],
          "padding": 300,
          "padding_percent": 0,
          "index": 0
        },
        "class_type": "FaceBoundingBox",
        "_meta": {
          "title": "FaceBoundingBox"
        }
      },
      "23": {
        "inputs": {
          "library": "insightface",
          "provider": "CUDA"
        },
        "class_type": "FaceAnalysisModels",
        "_meta": {
          "title": "FaceAnalysisModels"
        }
      },
      "24": {
        "inputs": {
          "images": ["25", 0]
        },
        "class_type": "PreviewImage",
        "_meta": {
          "title": "PreviewImage"
        }
      },
      "25": {
        "inputs": {
          "image": ["19", 0],
          "width": 1000,
          "height": 1000,
          "interpolation": "lanczos",
          "method": "keep proportion",
          "condition": "always",
          "multiple_of": 0
        },
        "class_type": "ImageResize+",
        "_meta": {
          "title": "ImageResize+"
        }
      },
      "26": {
        "inputs": {
          "image": ["22", 0],
          "width": 1000,
          "height": 1000,
          "interpolation": "lanczos",
          "method": "keep proportion",
          "condition": "always",
          "multiple_of": 0
        },
        "class_type": "ImageResize+",
        "_meta": {
          "title": "ImageResize+"
        }
      },
      "28": {
        "inputs": {
          "images": ["26", 0]
        },
        "class_type": "PreviewImage",
        "_meta": {
          "title": "PreviewImage"
        }
      },
      "30": {
        "inputs": {
          "mask": ["5", 0],
          "expand": 30,
          "incremental_expandrate": 0,
          "tapered_corners": true,
          "flip_input": false,
          "blur_radius": 6,
          "lerp_alpha": 1,
          "decay_factor": 1,
          "fill_holes": false
        },
        "class_type": "GrowMaskWithBlur",
        "_meta": {
          "title": "GrowMaskWithBlur"
        }
      },
      "31": {
        "inputs": {
          "model": ["29", 0],
          "positive": ["18", 0],
          "negative": ["17", 0],
          "latent_image": ["1", 0],
          "seed": FIXED_VALUES.seed,
          "steps": FIXED_VALUES.steps,
          "cfg": FIXED_VALUES.cfg,
          "sampler_name": FIXED_VALUES.sampler,
          "scheduler": FIXED_VALUES.scheduler,
          "denoise": FIXED_VALUES.denoise
        },
        "class_type": "KSampler",
        "_meta": {
          "title": "KSampler"
        }
      },
      "32": {
        "inputs": {
          "device": "cuda"
        },
        "class_type": "FaceParsingModelLoader(FaceParsing)",
        "_meta": {
          "title": "FaceParsingModelLoader(FaceParsing)"
        }
      },
      "33": {
        "inputs": {
          "images": ["11", 0]
        },
        "class_type": "PreviewImage",
        "_meta": {
          "title": "PreviewImage"
        }
      },
      "34": {
        "inputs": {
          "image_a": ["13", 0],
          "image_b": ["40", 0]
        },
        "class_type": "Image Comparer (rgthree)",
        "_meta": {
          "title": "Image Comparer (rgthree)"
        }
      },
      "38": {
        "inputs": {
          "images": ["13", 0],
          "filename_prefix": "SkinEnhancer"
        },
        "class_type": "SaveImage",
        "_meta": {
          "title": "SaveImage"
        }
      },
      "39": {
        "inputs": {
          "ckpt_name": FIXED_VALUES.selectedModel
        },
        "class_type": "CheckpointLoaderSimple",
        "_meta": {
          "title": "CheckpointLoaderSimple"
        }
      },
      "40": {
        "inputs": {
          "image": inputImageBase64,
          "upload": "image"
        },
        "class_type": "LoadImage",
        "_meta": {
          "title": "LoadImage"
        }
      },
      "29": {
        "inputs": {
          "model": ["39", 0],
          "clip": ["39", 1],
          "lora_01": FIXED_VALUES.selectedLoRA,
          "strength_01": FIXED_VALUES.loraStrength,
          "lora_02": FIXED_VALUES.moreDetailsLoRA,
          "strength_02": FIXED_VALUES.moreDetailsStrength,
          "lora_03": "None",
          "strength_03": 1,
          "lora_04": "None",
          "strength_04": 1
        },
        "class_type": "Lora Loader Stack (rgthree)",
        "_meta": {
          "title": "Lora Loader Stack (rgthree)"
        }
      }
    };

    console.log("📋 Image-to-Image Skin Enhancer workflow created with fixed settings:", FIXED_VALUES);

    return workflow;
  }, []);

  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix to get just the base64 data
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleGenerate = useCallback(async () => {
    if (!user?.id) {
      setError('Please log in to generate images');
      return;
    }

    // Check storage availability
    if (!canGenerate) {
      setError(storageError || 'Storage is full. Please add more storage or free up space before generating.');
      return;
    }

    if (!selectedImage) {
      setError('Please select an image to enhance');
      return;
    }

    if (!targetFolder) {
      setError('Please select a folder to save the output');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      setResultImages([]);

      // Convert image to base64
      const imageBase64 = await convertImageToBase64(selectedImage.file);

      // Get vault profile and folder IDs from selected folder
      const selectedFolder = vaultFolders.find(f => f.id === targetFolder);
      const vaultProfileId = selectedFolder?.profileId;
      const vaultFolderId = targetFolder;
      
      const saveToVault = !!vaultProfileId && !!vaultFolderId;

      // For vault, use temp path
      const effectiveTargetFolder = saveToVault 
        ? `outputs/${user.id}/temp/` 
        : `outputs/${user.id}/`;

      // Create workflow with fixed parameters (using effective folder)
      const workflow = createWorkflowForImageToImageSkinEnhancer(imageBase64);
      
      // Update the SaveImage node with effective folder if needed
      if (workflow["38"]?.inputs?.filename_prefix && saveToVault) {
        workflow["38"].inputs.filename_prefix = `${effectiveTargetFolder}SkinEnhancer`;
      }

      const params = {
        ...FIXED_VALUES,
        originalImageName: selectedImage.file.name,
        // Vault params
        saveToVault,
        vaultProfileId: saveToVault ? vaultProfileId : undefined,
        vaultFolderId: saveToVault ? vaultFolderId : undefined,
      };

      // Send to API
      const response = await fetch('/api/generate/image-to-image-skin-enhancer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflow,
          params,
          user_id: user.id,
          // Also send vault params at top level for route.ts
          saveToVault,
          vaultProfileId: saveToVault ? vaultProfileId : undefined,
          vaultFolderId: saveToVault ? vaultFolderId : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Generation started:', result);

      // Set initial job status
      setCurrentJob({
        id: result.jobId,
        status: 'PROCESSING',
        progress: 0,
        message: 'Starting image-to-image skin enhancement...',
        createdAt: new Date(),
        params
      });
      setJobStartTime(Date.now());
      setElapsedSeconds(0);
      setLastJobDuration(null);

    } catch (error) {
      console.error('❌ Generation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to start generation');
      setIsProcessing(false);
    }
  }, [user, selectedImage, targetFolder, vaultFolders, createWorkflowForImageToImageSkinEnhancer, canGenerate, storageError]);

  // Poll for job updates with custom polling function (not useEffect-based)
  useEffect(() => {
    if (!currentJob || !apiClient) {
      return;
    }

    // If job already finished, don't poll
    if (currentJob.status === 'COMPLETED' || currentJob.status === 'FAILED') {
      setIsProcessing(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 150; // 5 minutes max

    const pollJob = async () => {
      attempts++;
      
      try {
        const response = await fetch(`/api/jobs/${currentJob.id}`);
        
        if (!response.ok) {
          console.error("Poll request failed:", response.status);
          if (attempts < maxAttempts) {
            setTimeout(pollJob, 2000);
          }
          return;
        }

        const jobData = await response.json();
        console.log("📊 Poll response:", jobData);

        const normalizedStatus = typeof jobData.status === 'string'
          ? jobData.status.toUpperCase()
          : undefined;

        // Update progress
        setCurrentJob(prev => prev ? {
          ...prev,
          status: (normalizedStatus as JobStatus['status']) || prev.status,
          progress: jobData.progress || prev.progress,
          message: jobData.message || prev.message,
          resultUrls: jobData.resultUrls || prev.resultUrls
        } : null);

        // Handle completion
        if (normalizedStatus === 'COMPLETED') {
          console.log("✅ Job completed! ResultUrls:", jobData.resultUrls);
          if (jobStartTime) {
            setLastJobDuration(formatDuration(Date.now() - jobStartTime));
          } else if (currentJob.createdAt) {
            const createdTimestamp = new Date(currentJob.createdAt).getTime();
            setLastJobDuration(formatDuration(Date.now() - createdTimestamp));
          }
          setIsProcessing(false);

          // Refresh credits after successful completion
          refreshCredits();

          const jobId = currentJob.id;
          console.log("🖼️ Calling fetchJobImages for job:", jobId);
          const images = await fetchJobImages(jobId);

          if (images && images.length > 0) {
            const mappedImages = images
              .map((img) => img.dataUrl || img.url || '')
              .filter(Boolean);

            if (mappedImages.length > 0) {
              setResultImages(mappedImages);
              console.log("🖼️ Updated resultImages with database images", mappedImages.length);
            }
          } else if (jobData.resultUrls?.length > 0) {
            console.log("⚠️ Using fallback resultUrls:", jobData.resultUrls.length);
            setResultImages(jobData.resultUrls);
          } else {
            console.log("🔄 Retrying image fetch after 3s...");
            setTimeout(async () => {
              const retryImages = await fetchJobImages(jobId);
              if (retryImages && retryImages.length > 0) {
                const mappedRetry = retryImages
                  .map((img) => img.dataUrl || img.url || '')
                  .filter(Boolean);
                if (mappedRetry.length > 0) {
                  setResultImages(mappedRetry);
                  console.log("🖼️ Updated resultImages after retry", mappedRetry.length);
                }
              }
            }, 3000);
          }

          return; // Stop polling
        }

        // Handle failure
        if (normalizedStatus === 'FAILED') {
          const errorMessage = jobData.error || jobData.message || 'Generation failed';
          console.error("❌ Job failed:", errorMessage);
          setError(errorMessage);
          setIsProcessing(false);
          setLastJobDuration(null);
          return; // Stop polling
        }

        // Continue polling if still processing
        if (attempts < maxAttempts) {
          setTimeout(pollJob, 2000);
        } else {
          console.error("⏰ Polling timeout after", maxAttempts, "attempts");
          setError("Processing timeout. Please try again.");
          setIsProcessing(false);
        }

      } catch (error) {
        console.error("💥 Polling error:", error);
        if (attempts < maxAttempts) {
          setTimeout(pollJob, 2000);
        }
      }
    };

    // Start polling
    pollJob();

    // Cleanup function
    return () => {
      // Polling cleanup happens via return statements in pollJob
    };
  }, [currentJob?.id, apiClient]); // Only depend on job ID and apiClient

  const generateRandomSeed = useCallback(() => {
    // Not needed since seed is fixed, but kept for potential future use
    console.log('Using fixed seed from workflow:', FIXED_VALUES.seed);
  }, []);

  const downloadImage = useCallback(async (url: string, filename?: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || `enhanced_image_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error);
      setError('Failed to download image');
    }
  }, []);

  const resetForm = useCallback(() => {
    setSelectedImage(null);
    setResultImages([]);
    setError(null);
    setCurrentJob(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const openLightbox = useCallback((imageUrl: string, title: string) => {
    setLightboxImage(imageUrl);
    setLightboxTitle(title);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxImage(null);
    setLightboxTitle('');
  }, []);

  // Close lightbox on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxImage) {
        closeLightbox();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [lightboxImage, closeLightbox]);

  // Debug: Log state changes
  useEffect(() => {
    console.log("🔍 State Debug:", {
      currentJob: currentJob?.id,
      status: currentJob?.status,
      jobImagesCount: currentJob ? jobImages[currentJob.id]?.length || 0 : 0,
      resultImagesCount: resultImages.length,
      hasResultUrls: currentJob?.resultUrls?.length || 0,
      jobImages: jobImages
    });
  }, [currentJob, jobImages, resultImages]);

  const currentJobImages = currentJob?.id ? jobImages[currentJob.id] : undefined;
  const hasLegacyUrls = Boolean(currentJob?.resultUrls && currentJob.resultUrls.length > 0);

  return (
    <div className="relative max-h-[85vh] overflow-y-auto overflow-x-hidden bg-[#F8F8F8] dark:bg-[#0a0a0f] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl shadow-lg custom-scrollbar text-foreground">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="mb-6 sm:mb-8 md:mb-10 text-center">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-brand-mid-pink via-brand-light-pink to-brand-blue rounded-xl sm:rounded-2xl shadow-lg animate-pulse">
              <Wand2 className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-brand-mid-pink via-brand-light-pink to-brand-blue bg-clip-text text-transparent">
              Image-to-Image Skin Enhancer
            </h1>
          </div>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
            Bring professional-grade retouching to any portrait. Upload once, let Flux-inspired magic refine every pore, tone, and highlight.
          </p>
        </div>

        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/30 dark:to-pink-950/30 border-2 border-red-300 dark:border-red-700 rounded-2xl flex items-start gap-2 sm:gap-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="p-1.5 sm:p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-red-900 dark:text-red-100 text-base sm:text-lg">We hit a snag</h3>
              <p className="text-xs sm:text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 transition-colors p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg active:scale-95"
              aria-label="Dismiss error"
            >
              <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            <div className="bg-[#F8F8F8] dark:bg-[#0a0a0f] backdrop-blur-md rounded-2xl shadow-xl border-2 border-[#EC67A1]/20 dark:border-[#EC67A1]/30 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-brand-mid-pink" />
                  <h2 className="text-base sm:text-lg md:text-xl font-bold text-foreground">Upload Image</h2>
                </div>
                {selectedImage && (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white/70 dark:bg-gray-900/40 border border-gray-200 dark:border-slate-700/50 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Remove
                  </button>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                Upload a high-quality portrait (PNG or JPG, up to 10MB). We will preserve details while smoothing skin naturally.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="skin-enhancer-upload"
              />

              {selectedImage ? (
                <div className="relative group">
                  <div className="relative w-full h-80 bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/30 dark:via-pink-900/20 dark:to-blue-900/30 rounded-2xl border-2 border-purple-200/70 dark:border-purple-800/60 overflow-hidden shadow-inner">
                    <Image
                      src={selectedImage.preview}
                      alt="Selected image"
                      fill
                      className="object-contain"
                      priority
                    />
                  </div>
                  <div className="absolute bottom-4 left-4 px-4 py-2 bg-black/70 backdrop-blur-sm text-white text-xs rounded-full shadow-lg border border-white/10">
                    {selectedImage.file.name}
                  </div>
                </div>
              ) : (
                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
                    isDragging
                      ? 'border-brand-mid-pink bg-brand-mid-pink/10 scale-[1.02] shadow-xl'
                      : 'border-border hover:border-brand-mid-pink hover:bg-muted/50'
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  aria-label="Upload image"
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className={`p-5 rounded-full ${isDragging ? 'bg-brand-mid-pink/20' : 'bg-muted'}`}>
                      <Upload className={`w-10 h-10 ${isDragging ? 'text-brand-mid-pink' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">
                        {isDragging ? 'Release to upload' : 'Click or drag your image'}
                      </p>
                      <p className="text-sm text-muted-foreground">PNG or JPG up to 10MB</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Pro tip: centered portraits with even lighting deliver the cleanest enhancements.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#F8F8F8] dark:bg-[#0a0a0f] backdrop-blur-md rounded-2xl shadow-xl border-2 border-[#EC67A1]/20 dark:border-[#EC67A1]/30 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                <Archive className="w-4 h-4 sm:w-5 sm:h-5 text-brand-mid-pink" />
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-foreground">Save to Vault</h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                Pick where your enhanced image should live. We only show folders you can edit.
              </p>
              
              {/* Vault Folder Dropdown */}
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
              />
              
              {/* Folder type indicator */}
              <div className="flex items-center gap-2 mt-3">
                {targetFolder && (
                  <div className="flex items-center gap-1.5 rounded-full bg-brand-mid-pink/20 px-2.5 py-1 text-[11px] text-brand-mid-pink">
                    <Archive className="w-3 h-3" />
                    <span>Vault Storage</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#F8F8F8] dark:bg-[#0a0a0f] backdrop-blur-md rounded-2xl shadow-xl border-2 border-[#EC67A1]/20 dark:border-[#EC67A1]/30 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-brand-blue" />
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-foreground">AI Enhancement Settings</h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                Tuned for lifelike skin: balanced retouching, pore retention, cinematic lighting, and zero plastic sheen.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm">
                <div className="rounded-xl bg-muted/40 border border-border px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
                  <span className="block text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground">Model</span>
                  <p className="mt-1 font-semibold text-foreground">{FIXED_VALUES.selectedModel.replace('.safetensors', '')}</p>
                </div>
                <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 shadow-sm">
                  <span className="block text-xs uppercase tracking-wide text-muted-foreground">LoRA 1</span>
                  <p className="mt-1 font-semibold text-foreground">{FIXED_VALUES.selectedLoRA.replace('.safetensors', '')}</p>
                </div>
                <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 shadow-sm">
                  <span className="block text-xs uppercase tracking-wide text-muted-foreground">LoRA 2</span>
                  <p className="mt-1 font-semibold text-foreground">{FIXED_VALUES.moreDetailsLoRA.replace('.safetensors', '')}</p>
                </div>
                <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 shadow-sm">
                  <span className="block text-xs uppercase tracking-wide text-muted-foreground">Steps</span>
                  <p className="mt-1 font-semibold text-foreground">{FIXED_VALUES.steps}</p>
                </div>
                <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 shadow-sm">
                  <span className="block text-xs uppercase tracking-wide text-muted-foreground">CFG Scale</span>
                  <p className="mt-1 font-semibold text-foreground">{FIXED_VALUES.cfg}</p>
                </div>
                <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 shadow-sm">
                  <span className="block text-xs uppercase tracking-wide text-muted-foreground">Denoise</span>
                  <p className="mt-1 font-semibold text-foreground">{FIXED_VALUES.denoise}</p>
                </div>
                <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 shadow-sm">
                  <span className="block text-xs uppercase tracking-wide text-muted-foreground">Sampler</span>
                  <p className="mt-1 font-semibold text-foreground">{FIXED_VALUES.sampler}</p>
                </div>
                <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 shadow-sm">
                  <span className="block text-xs uppercase tracking-wide text-muted-foreground">Seed</span>
                  <p className="mt-1 font-semibold text-foreground">{FIXED_VALUES.seed}</p>
                </div>
              </div>
              <div className="mt-4 sm:mt-6 rounded-2xl bg-gradient-to-r from-brand-mid-pink/10 via-card to-brand-blue/10 border border-brand-mid-pink/30 px-3 sm:px-4 md:px-5 py-3 sm:py-4 text-xs sm:text-sm text-muted-foreground shadow-inner">
                ✨ All parameters are pre-configured for cinematic realism. Just upload, choose a destination, and tap enhance.
              </div>
            </div>

            {/* Storage Warning */}
            <StorageFullBanner showWarning={true} />

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleGenerate}
                disabled={isProcessing || !selectedImage || !targetFolder || !canGenerate}
                className="group flex-1 py-3 sm:py-4 md:py-5 bg-gradient-to-r from-brand-mid-pink via-brand-light-pink to-brand-blue text-white font-semibold text-sm sm:text-base md:text-lg rounded-2xl hover:from-brand-dark-pink hover:via-brand-mid-pink hover:to-brand-blue disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 sm:gap-3 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Enhancing...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
                    <span>Enhance Image</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={isProcessing}
                className="px-5 py-4 rounded-2xl border border-border text-sm font-medium text-foreground bg-muted/50 hover:bg-muted transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline-block mr-1.5 sm:mr-2" /> Reset
              </button>
            </div>

            {(!selectedImage || !targetFolder) && (
              <p className="text-center text-xs sm:text-sm text-muted-foreground">
                {!selectedImage && 'Please upload an image to begin.'}
                {selectedImage && !targetFolder && 'Select a folder so we know where to save your results.'}
              </p>
            )}
          </div>

          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {currentJob && (
              <div className="bg-[#F8F8F8] dark:bg-[#0a0a0f] backdrop-blur-md rounded-2xl shadow-xl border-2 border-[#EC67A1]/20 dark:border-[#EC67A1]/30 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-right">
                <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div
                      className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg ${
                        currentJob.status === 'COMPLETED'
                          ? 'bg-gradient-to-br from-green-400 to-green-600 text-white'
                          : currentJob.status === 'FAILED'
                            ? 'bg-gradient-to-br from-red-500 to-red-600 text-white'
                            : 'bg-gradient-to-br from-brand-mid-pink to-brand-blue text-white'
                      }`}
                    >
                      {currentJob.status === 'COMPLETED' ? (
                        <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                      ) : currentJob.status === 'FAILED' ? (
                        <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                      ) : (
                        <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg md:text-xl font-bold text-foreground">Enhancement Status</h2>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {currentJob.status === 'COMPLETED'
                          ? 'Your image finished processing successfully.'
                          : currentJob.status === 'FAILED'
                            ? 'Something went wrong. Review the message below.'
                            : 'We are retouching skin and rebalancing tones in real-time.'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center justify-center px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide rounded-full ${
                      currentJob.status === 'COMPLETED'
                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                        : currentJob.status === 'FAILED'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-brand-mid-pink/20 text-brand-mid-pink border border-brand-mid-pink/30'
                    }`}
                  >
                    {currentJob.status}
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-semibold text-foreground">
                      <span>Progress</span>
                      <span>{Math.min(currentJob.progress || 0, 100)}%</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-mid-pink via-brand-light-pink to-brand-blue transition-all duration-500"
                        style={{ width: `${Math.min(currentJob.progress || 0, 100)}%` }}
                        aria-valuenow={Math.min(currentJob.progress || 0, 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        role="progressbar"
                      />
                    </div>
                  </div>
                  {currentJob.message && (
                    <div className="rounded-2xl border border-brand-mid-pink/30 bg-gradient-to-r from-brand-mid-pink/10 to-brand-blue/10 px-4 py-3 text-sm text-muted-foreground shadow-inner">
                      {currentJob.message}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Elapsed: {formattedElapsed}</span>
                    <span>Typical runtime: 1-3 min</span>
                  </div>
                </div>

                <div className="mt-6 sm:mt-8 space-y-4 sm:space-y-6">
                  {PROGRESS_STAGES.map((stage, index) => {
                    const isActive = index === activeStageIndex;
                    const isComplete = index < activeStageIndex || currentJob.status === 'COMPLETED';
                    return (
                      <div key={stage.key} className="relative flex gap-4">
                        <div className="relative flex-shrink-0">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-500 shadow-md ${
                              isComplete
                                ? 'bg-gradient-to-br from-green-400 to-green-600 text-white scale-105'
                                : isActive
                                  ? 'bg-gradient-to-br from-brand-mid-pink to-brand-blue text-white scale-105 animate-pulse'
                                  : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {isComplete ? (
                              <CheckCircle className="w-6 h-6" />
                            ) : isActive ? (
                              <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                              <span className="text-sm font-semibold">{index + 1}</span>
                            )}
                          </div>
                          {index < PROGRESS_STAGES.length - 1 && (
                            <div className={`absolute left-1/2 top-12 -ml-[1px] h-10 w-[2px] ${isComplete ? 'bg-green-400' : 'bg-muted'}`} />
                          )}
                        </div>
                        <div className="flex-1 rounded-2xl border-2 border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-[#F8F8F8] dark:bg-[#0a0a0f] px-4 py-3 shadow-sm backdrop-blur">
                          <p className={`text-sm font-semibold ${
                            isActive
                              ? 'text-brand-mid-pink'
                              : isComplete
                                ? 'text-green-600 dark:text-green-300'
                                : 'text-muted-foreground'
                          }`}>
                            {stage.label}
                            {isActive ? ' • in progress' : isComplete ? ' • done' : ''}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{stage.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(currentJob.status === 'PROCESSING' || currentJob.status === 'PENDING') && (
                  <div className="mt-8 space-y-4 border-t border-border pt-6">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rendering preview</p>
                    <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-muted via-card to-muted">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 rounded-full bg-muted animate-pulse" />
                      <div className="h-3 rounded-full bg-muted w-2/3 animate-pulse" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentJob && currentJob.status === 'COMPLETED' && (
              <div className="bg-[#F8F8F8] dark:bg-[#0a0a0f] backdrop-blur-md rounded-2xl shadow-xl border-2 border-[#EC67A1]/20 dark:border-[#EC67A1]/30 p-3 sm:p-4 md:p-6 hover:shadow-2xl transition-all duration-300 animate-in fade-in zoom-in">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-brand-mid-pink to-brand-blue rounded-xl shadow-lg">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground">Enhanced Images</h2>
                      <p className="text-sm text-muted-foreground">Ready to review, download, or share immediately.</p>
                    </div>
                  </div>
                  {lastJobDuration && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/30 dark:to-blue-900/30 border border-green-200 dark:border-green-800 text-sm font-medium text-green-700 dark:text-green-200">
                      <Clock className="w-4 h-4" />
                      {lastJobDuration}
                    </div>
                  )}
                </div>

                {!currentJobImages?.length && !hasLegacyUrls && (
                  <div className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-medium">Fetching results from your gallery...</span>
                    </div>
                    <button
                      onClick={async () => {
                        if (!currentJob) return;
                        const images = await fetchJobImages(currentJob.id);
                        if (images && images.length > 0) {
                          const mappedImages = images.map((img) => img.dataUrl || img.url || '').filter(Boolean);
                          if (mappedImages.length > 0) {
                            setResultImages(mappedImages);
                          }
                        }
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-brand-mid-pink to-brand-blue text-white text-sm font-medium shadow-md hover:shadow-lg transition"
                    >
                      <RefreshCw className="w-4 h-4" /> Refresh images
                    </button>
                  </div>
                )}

                {(currentJobImages?.length || hasLegacyUrls) && (
                  <div className="space-y-5">
                    {(() => {
                      const totalImages = currentJobImages?.length || currentJob.resultUrls?.length || 0;
                      return (
                        <div className="rounded-2xl border border-brand-blue/30 bg-gradient-to-r from-brand-blue/10 via-card to-brand-mid-pink/10 px-5 py-4 shadow-inner">
                          <p className="text-xs font-semibold uppercase tracking-wider text-brand-blue">Enhancement complete</p>
                          <p className="mt-1 text-foreground font-semibold">
                            {totalImages} {totalImages === 1 ? 'image' : 'images'} enhanced in {lastJobDuration || formattedElapsed}.
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            We saved everything to your chosen folder. Download, share, or run another pass anytime.
                          </p>
                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              onClick={() => {
                                resetForm();
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="inline-flex items-center gap-2 rounded-full border border-brand-blue px-4 py-2 text-sm font-medium text-brand-blue transition hover:bg-brand-blue/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
                            >
                              <Sparkles className="w-4 h-4" /> Enhance another
                            </button>
                            <button
                              onClick={async () => {
                                if (!currentJob) return;
                                const images = await fetchJobImages(currentJob.id);
                                if (images && images.length > 0) {
                                  const mappedImages = images.map((img) => img.dataUrl || img.url || '').filter(Boolean);
                                  if (mappedImages.length > 0) {
                                    setResultImages(mappedImages);
                                  }
                                }
                              }}
                              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-mid-pink to-brand-blue px-4 py-2 text-sm font-medium text-white shadow-md transition hover:shadow-lg"
                            >
                              <RefreshCw className="w-4 h-4" /> Update gallery
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {selectedImage && currentJobImages?.[0] && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <button
                            onClick={() => setComparisonMode('side-by-side')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                              comparisonMode === 'side-by-side'
                                ? 'bg-brand-mid-pink/20 text-brand-mid-pink'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                          >
                            Side by side
                          </button>
                          <button
                            onClick={() => setComparisonMode('slider')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                              comparisonMode === 'slider'
                                ? 'bg-brand-mid-pink/20 text-brand-mid-pink'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                          >
                            Slider
                          </button>
                        </div>
                        {comparisonMode === 'side-by-side' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="rounded-2xl border-2 border-[#EC67A1]/20 dark:border-[#EC67A1]/30 overflow-hidden bg-[#F8F8F8] dark:bg-[#0a0a0f] shadow-sm">
                              <p className="px-4 py-2 text-xs font-semibold text-muted-foreground tracking-wider">BEFORE</p>
                              <img src={selectedImage.preview} alt="Original" className="w-full object-cover" />
                            </div>
                            <div className="rounded-2xl border-2 border-[#EC67A1]/20 dark:border-[#EC67A1]/30 overflow-hidden bg-[#F8F8F8] dark:bg-[#0a0a0f] shadow-sm">
                              <p className="px-4 py-2 text-xs font-semibold text-muted-foreground tracking-wider">AFTER</p>
                              <img src={convertS3ToCdnUrl((currentJobImages[0].dataUrl || currentJobImages[0].url) as string)} alt="Enhanced" className="w-full object-cover" />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground text-center tracking-wider">DRAG TO COMPARE</p>
                            <div className="relative aspect-square rounded-2xl overflow-hidden border border-border bg-muted">
                              <img src={convertS3ToCdnUrl((currentJobImages[0].dataUrl || currentJobImages[0].url) as string)} alt="Enhanced" className="absolute inset-0 w-full h-full object-cover" />
                              <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
                                <img src={selectedImage.preview} alt="Original" className="absolute inset-0 w-full h-full object-cover" />
                              </div>
                              <div
                                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
                                style={{ left: `${sliderPosition}%` }}
                                role="slider"
                                tabIndex={0}
                                aria-label="Comparison slider"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.round(sliderPosition)}
                                onKeyDown={(event) => {
                                  if (event.key === 'ArrowLeft') {
                                    adjustSlider(-5);
                                    event.preventDefault();
                                  } else if (event.key === 'ArrowRight') {
                                    adjustSlider(5);
                                    event.preventDefault();
                                  }
                                }}
                                onMouseDown={(event) => {
                                  const container = event.currentTarget.parentElement;
                                  if (!container) return;
                                  const handleMove = (moveEvent: MouseEvent) => {
                                    const rect = container.getBoundingClientRect();
                                    const x = moveEvent.clientX - rect.left;
                                    const percentage = (x / rect.width) * 100;
                                    setSliderPosition(Math.max(0, Math.min(100, percentage)));
                                  };
                                  const handleUp = () => {
                                    document.removeEventListener('mousemove', handleMove);
                                    document.removeEventListener('mouseup', handleUp);
                                  };
                                  document.addEventListener('mousemove', handleMove);
                                  document.addEventListener('mouseup', handleUp);
                                }}
                                onTouchStart={(event) => {
                                  const container = event.currentTarget.parentElement;
                                  if (!container) return;
                                  const handleTouchMove = (touchEvent: TouchEvent) => {
                                    const rect = container.getBoundingClientRect();
                                    const touch = touchEvent.touches[0];
                                    const x = touch.clientX - rect.left;
                                    const percentage = (x / rect.width) * 100;
                                    setSliderPosition(Math.max(0, Math.min(100, percentage)));
                                  };
                                  const cleanup = () => {
                                    document.removeEventListener('touchmove', handleTouchMove);
                                    document.removeEventListener('touchend', cleanup);
                                    document.removeEventListener('touchcancel', cleanup);
                                  };
                                  document.addEventListener('touchmove', handleTouchMove, { passive: false });
                                  document.addEventListener('touchend', cleanup);
                                  document.addEventListener('touchcancel', cleanup);
                                }}
                              >
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
                                  <div className="flex gap-0.5">
                                    <div className="w-0.5 h-4 bg-gray-400" />
                                    <div className="w-0.5 h-4 bg-gray-400" />
                                  </div>
                                </div>
                              </div>
                              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 text-white text-xs">BEFORE</div>
                              <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/70 text-white text-xs">AFTER</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4">
                      {currentJobImages?.length
                        ? currentJobImages.map((dbImage) => (
                            <div key={dbImage.id} className="relative group">
                              {(dbImage.dataUrl || dbImage.url) ? (
                                <img
                                  src={convertS3ToCdnUrl((dbImage.dataUrl || dbImage.url) as string)}
                                  alt={dbImage.filename}
                                  className="w-full rounded-2xl border border-border shadow-lg hover:shadow-2xl transition-transform duration-500 cursor-pointer hover:scale-[1.01]"
                                  onClick={() => openLightbox(convertS3ToCdnUrl((dbImage.dataUrl || dbImage.url) as string), dbImage.filename)}
                                  onError={(event) => {
                                    const target = event.target as HTMLImageElement;
                                    if (target.src === convertS3ToCdnUrl(dbImage.dataUrl || '') && dbImage.url) {
                                      target.src = convertS3ToCdnUrl(dbImage.url);
                                    } else if (target.src === convertS3ToCdnUrl(dbImage.url || '') && dbImage.dataUrl) {
                                      target.src = convertS3ToCdnUrl(dbImage.dataUrl);
                                    } else {
                                      target.style.display = 'none';
                                    }
                                  }}
                                />
                              ) : (
                                <div className="w-full h-64 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground text-sm">
                                  Image not available ({dbImage.filename})
                                </div>
                              )}
                              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => downloadDatabaseImage(dbImage)}
                                  className="p-3 rounded-xl bg-[#F8F8F8] dark:bg-[#0a0a0f] border-2 border-[#EC67A1]/20 dark:border-[#EC67A1]/30 shadow-md hover:bg-gradient-to-br hover:from-brand-blue hover:to-brand-blue/80 hover:text-white transition"
                                  aria-label={`Download ${dbImage.filename}`}
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => shareImage(dbImage)}
                                  className="p-3 rounded-xl bg-[#F8F8F8] dark:bg-[#0a0a0f] border-2 border-[#EC67A1]/20 dark:border-[#EC67A1]/30 shadow-md hover:bg-gradient-to-br hover:from-brand-mid-pink hover:to-brand-dark-pink hover:text-white transition"
                                  aria-label={`Share ${dbImage.filename}`}
                                >
                                  <Share2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-black/70 text-white text-xs backdrop-blur-sm border border-white/10">
                                {dbImage.filename}
                              </div>
                              <div className="absolute bottom-4 right-4">
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#F8F8F8] dark:bg-[#0a0a0f] border-2 border-[#EC67A1]/20 dark:border-[#EC67A1]/30 px-3 py-1 text-[11px] font-medium text-foreground">
                                  <span className={`inline-block h-2 w-2 rounded-full ${dbImage.url ? 'bg-brand-blue' : 'bg-amber-500'}`} />
                                  {describeImageSource(dbImage)}
                                </span>
                              </div>
                            </div>
                          ))
                        : currentJob.resultUrls?.map((imageUrl, index) => (
                            <div key={imageUrl} className="relative group">
                              <img
                                src={imageUrl}
                                alt={`Enhanced image ${index + 1}`}
                                className="w-full rounded-2xl border border-border shadow-lg hover:shadow-2xl transition-transform duration-500 cursor-pointer hover:scale-[1.01]"
                                onClick={() => openLightbox(imageUrl, `Enhanced image ${index + 1}`)}
                              />
                              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => downloadImage(imageUrl, `enhanced_image_${index + 1}.png`)}
                                  className="p-3 rounded-xl bg-[#F8F8F8] dark:bg-[#0a0a0f] border-2 border-[#EC67A1]/20 dark:border-[#EC67A1]/30 shadow-md hover:bg-gradient-to-br hover:from-brand-blue hover:to-brand-blue/80 hover:text-white transition"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={closeLightbox}
        >
          <div className="relative max-w-7xl max-h-full w-full">
            <div className="relative bg-gradient-to-br from-brand-mid-pink/20 via-brand-light-pink/10 to-brand-blue/20 rounded-3xl p-4 border border-white/10 shadow-2xl">
              <img
                src={lightboxImage}
                alt={lightboxTitle}
                className="max-w-full max-h-[85vh] object-contain mx-auto rounded-2xl shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              />
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-black/80 backdrop-blur-md text-white rounded-full border border-white/20 shadow-xl text-sm font-semibold">
                📁 {lightboxTitle || 'Enhanced image'}
              </div>
            </div>
            <button
              onClick={closeLightbox}
              className="absolute top-8 right-8 p-3 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-full hover:from-red-600 hover:to-red-700 transition-all shadow-xl hover:scale-110 transform duration-200"
              title="Close (ESC)"
            >
              <XCircle className="w-6 h-6" />
            </button>
            <div className="absolute top-8 left-8 px-4 py-2 bg-black/80 backdrop-blur-md text-white rounded-full border border-white/20 shadow-xl text-sm font-semibold">
              Press ESC to close
            </div>
          </div>
        </div>
      )}

      {/* Credit Calculator */}
      <CreditCalculator
        path="image-to-image-skin-enhancer"
        modifiers={[]}
        position="bottom-right"
      />
    </div>
  );
}