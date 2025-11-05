"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Star,
  Settings,
  Share2,
  Folder,
  ChevronDown
} from 'lucide-react';
import Image from 'next/image';
import { useApiClient } from '@/lib/apiClient';

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
  const [availableFolders, setAvailableFolders] = useState<Array<{slug: string, name: string, prefix?: string, permission?: 'VIEW' | 'EDIT'}>>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiClient = useApiClient();
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

  // Load available folders
  const loadFolders = useCallback(async () => {
    if (!apiClient || !user) return;

    setIsLoadingFolders(true);
    try {
      const response = await apiClient.get('/api/s3/folders/list-custom');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.folders) {
          // Create folder objects with full prefix, permission, and display name
          const folders = data.folders
            .map((folder: any) => {
              if (typeof folder === 'string') {
                return { slug: folder, name: folder, prefix: `outputs/${user.id}/${folder}`, permission: 'EDIT' as const };
              }
              // Extract slug from prefix: outputs/{userId}/{slug}/
              const parts = folder.prefix.split('/').filter(Boolean);
              const slug = parts[2] || folder.name;
              return { 
                slug, 
                name: folder.name,
                prefix: folder.prefix?.replace(/\/$/, ''), // Store full prefix without trailing slash
                permission: folder.permission || 'EDIT' as const
              };
            })
            // Filter to only show folders with EDIT permission
            .filter((folder: any) => folder.permission === 'EDIT');
          setAvailableFolders(folders);
        }
      }
    } catch (error) {
      console.error('Error loading folders:', error);
    } finally {
      setIsLoadingFolders(false);
    }
  }, [apiClient, user]);

  // Load folders on mount
  useEffect(() => {
    if (apiClient && user) {
      loadFolders();
    }
  }, [apiClient, user, loadFolders]);

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
          "filename_prefix": targetFolder ? `${targetFolder}/SkinEnhancer` : "SkinEnhancer"
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
  }, [targetFolder]);

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

      // Create workflow with fixed parameters
      const workflow = createWorkflowForImageToImageSkinEnhancer(imageBase64);

      const params = {
        ...FIXED_VALUES,
        originalImageName: selectedImage.file.name
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
          user_id: user.id
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
  }, [user, selectedImage, createWorkflowForImageToImageSkinEnhancer]);

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
          console.error("❌ Job failed:", jobData.error);
          setError(jobData.error || 'Generation failed');
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Image-to-Image Skin Enhancer
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Upload an image and get professional skin enhancement with one click using our optimized AI workflow
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Input Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image Upload */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Upload Image</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select an image to enhance (max 10MB)
              </p>
            </div>
            <div className="p-6">
              <div 
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 ease-out shadow-sm focus-within:ring-4 focus-within:ring-blue-300/50 ${
                  isDragging 
                    ? 'border-blue-500 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-blue-900/30 dark:via-gray-900 dark:to-purple-900/30 shadow-lg scale-[1.02]' 
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-md'
                }`}
                aria-label="Upload image dropzone"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer outline-none"
                  tabIndex={0}
                  role="button"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  {selectedImage ? (
                    <div className="space-y-3">
                      <div className="relative w-32 h-32 mx-auto">
                        <Image
                          src={selectedImage.preview}
                          alt="Selected image"
                          fill
                          className="object-cover rounded-lg"
                        />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedImage.file.name}
                      </p>
                      <button
                        type="button"
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          removeImage();
                        }}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 via-white to-gray-200 dark:from-gray-700 dark:via-gray-800 dark:to-gray-700 shadow-inner">
                        <ImageIcon className="w-10 h-10 text-gray-400 dark:text-gray-300 animate-pulse" />
                        <div className="absolute inset-0 rounded-2xl border border-dashed border-gray-300/70 dark:border-gray-500/70" />
                      </div>
                      <div>
                        <p className="text-lg font-medium">
                          {isDragging ? 'Drop image here' : 'Click to upload or drag & drop'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          PNG, JPG, JPEG up to 10MB
                        </p>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Tip: Drag a face photo anywhere on this card to preview before enhancing.
                        </p>
                      </div>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>

          {/* Folder Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Folder className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="text-lg font-semibold">Save to Folder</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose where to save your enhanced image
              </p>
            </div>
            <div className="p-6">
              <div className="relative">
                <select
                  value={targetFolder}
                  onChange={(e) => setTargetFolder(e.target.value)}
                  disabled={isLoadingFolders}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed dark:text-white shadow-sm"
                >
                  <option value="">Select a folder...</option>
                  {availableFolders.map((folder) => {
                    // Check if this is a shared folder by looking at the prefix
                    const isSharedFolder = folder.prefix && !folder.prefix.startsWith(`outputs/${user?.id}/`);
                    const icon = isSharedFolder ? '🔓' : '📁';
                    
                    return (
                      <option key={folder.slug} value={folder.prefix || folder.slug}>
                        {icon} {folder.name}
                      </option>
                    );
                  })}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {isLoadingFolders ? (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>
              {targetFolder && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 flex items-center space-x-1">
                  <span>💡</span>
                  <span>Saving to: {targetFolder.startsWith('outputs/') ? targetFolder : `outputs/${user?.id}/${targetFolder}`}/</span>
                </p>
              )}
            </div>
          </div>

          {/* Generation Parameters Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="w-5 h-5" />
                <h3 className="text-lg font-semibold">AI Enhancement Settings</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Using optimized settings for professional skin enhancement
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">AI Model:</span>
                  <p className="text-gray-600 dark:text-gray-400">{FIXED_VALUES.selectedModel.replace('.safetensors', '')}</p>
                </div>
                <div>
                  <span className="font-medium">LoRA 1:</span>
                  <p className="text-gray-600 dark:text-gray-400">{FIXED_VALUES.selectedLoRA.replace('.safetensors', '')}</p>
                </div>
                <div>
                  <span className="font-medium">LoRA 2:</span>
                  <p className="text-gray-600 dark:text-gray-400">{FIXED_VALUES.moreDetailsLoRA.replace('.safetensors', '')}</p>
                </div>
                <div>
                  <span className="font-medium">Steps:</span>
                  <p className="text-gray-600 dark:text-gray-400">{FIXED_VALUES.steps}</p>
                </div>
                <div>
                  <span className="font-medium">CFG Scale:</span>
                  <p className="text-gray-600 dark:text-gray-400">{FIXED_VALUES.cfg}</p>
                </div>
                <div>
                  <span className="font-medium">Denoise:</span>
                  <p className="text-gray-600 dark:text-gray-400">{FIXED_VALUES.denoise}</p>
                </div>
                <div>
                  <span className="font-medium">Sampler:</span>
                  <p className="text-gray-600 dark:text-gray-400">{FIXED_VALUES.sampler}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  ✨ All parameters are pre-configured for optimal results. Simply upload your image and let our AI enhance your skin!
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={handleGenerate}
                disabled={isProcessing || !selectedImage || !targetFolder}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enhancing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Enhance Image
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={isProcessing}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset
              </button>
            </div>
            
            {(!selectedImage || !targetFolder) && (
              <div className="px-6 pb-4">
                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                  {!selectedImage && "Please upload an image first"}
                  {selectedImage && !targetFolder && "Please select a folder"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Results and Progress */}
        <div className="space-y-6">
          {/* Progress Card */}
          {currentJob && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  {currentJob.status === 'COMPLETED' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : currentJob.status === 'FAILED' ? (
                    <XCircle className="w-5 h-5 text-red-600" />
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  )}
                  <h3 className="text-lg font-semibold">Enhancement Progress</h3>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{currentJob.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${currentJob.progress || 0}%` }}
                      aria-valuenow={currentJob.progress || 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      role="progressbar"
                    />
                  </div>
                </div>
                {currentJob.message && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {currentJob.message}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Elapsed: {formattedElapsed}</span>
                  <span>Typical: 1-3 min</span>
                </div>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  currentJob.status === 'COMPLETED' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  currentJob.status === 'FAILED' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}>
                  {currentJob.status}
                </span>

                <div className="pt-4">
                  <ol className="grid grid-cols-3 gap-2 text-xs">
                    {PROGRESS_STAGES.map((stage, index) => {
                      const isActive = index === activeStageIndex;
                      const isCompleted = index < activeStageIndex || currentJob?.status === 'COMPLETED';
                      return (
                        <li
                          key={stage.key}
                          className={`rounded-md border px-3 py-2 text-center transition-colors ${
                            isActive
                              ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200'
                              : isCompleted
                                ? 'border-green-500 bg-green-50 dark:border-green-400 dark:bg-green-900/30 text-green-700 dark:text-green-200'
                                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300'
                          }`}
                          aria-current={isActive ? 'step' : undefined}
                        >
                          <p className="font-semibold">{stage.label}</p>
                          <p className="mt-1 leading-tight text-[11px] opacity-80">{stage.description}</p>
                        </li>
                      );
                    })}
                  </ol>
                </div>

                {/* Skeleton Loader for Processing Images */}
                {(currentJob.status === 'PROCESSING' || currentJob.status === 'PENDING') && (
                  <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Processing your image...
                    </p>
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 animate-pulse">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent animate-shimmer"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse"></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results */}
          {currentJob && currentJob.status === 'COMPLETED' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <h3 className="text-lg font-semibold">Enhanced Images</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Your enhanced images are ready!
                </p>
              </div>

              {/* Show loading or no images message */}
              {(!currentJob.resultUrls || currentJob.resultUrls.length === 0) &&
                (!jobImages[currentJob.id] || jobImages[currentJob.id].length === 0) && (
                  <div className="p-6">
                    <div className="text-center py-8">
                      <div className="flex items-center justify-center space-x-2 text-gray-500 dark:text-gray-400 mb-3">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Loading enhanced images...</span>
                      </div>
                      <button
                        onClick={async () => {
                          const images = await fetchJobImages(currentJob.id);
                          if (images && images.length > 0) {
                            const mappedImages = images
                              .map((img) => img.dataUrl || img.url || '')
                              .filter(Boolean);
                            if (mappedImages.length > 0) {
                              setResultImages(mappedImages);
                            }
                          }
                        }}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                      >
                        Refresh Images
                      </button>
                    </div>
                  </div>
                )}

              {/* Display images */}
              {((currentJob.resultUrls && currentJob.resultUrls.length > 0) ||
                (jobImages[currentJob.id] && jobImages[currentJob.id].length > 0)) && (
                <div className="p-6 space-y-4">
                  {(() => {
                    const totalImages = jobImages[currentJob.id]?.length || currentJob.resultUrls?.length || 0;
                    return (
                      <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-purple-50 p-4 text-sm shadow-sm dark:border-blue-800 dark:from-blue-900/40 dark:via-gray-900 dark:to-purple-900/30" role="status" aria-live="polite">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">Enhancement Complete</p>
                            <p className="mt-1 text-base font-medium text-gray-800 dark:text-gray-100">
                              {totalImages} {totalImages === 1 ? 'image' : 'images'} enhanced in {lastJobDuration || formattedElapsed}.
                            </p>
                            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                              Results are saved to your gallery. You can rerun with a different photo or download immediately.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => {
                                resetForm();
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="inline-flex items-center rounded-full border border-blue-500 px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-blue-200 dark:hover:bg-blue-900/40"
                            >
                              <Sparkles className="mr-1.5 h-4 w-4" />
                              Enhance another
                            </button>
                            <button
                              onClick={async () => {
                                const images = await fetchJobImages(currentJob.id);
                                if (images && images.length > 0) {
                                  const mappedImages = images.map((img) => img.dataUrl || img.url || '').filter(Boolean);
                                  if (mappedImages.length > 0) {
                                    setResultImages(mappedImages);
                                  }
                                }
                              }}
                              className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                            >
                              <RefreshCw className="mr-1.5 h-4 w-4" />
                              Update gallery
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  {/* Before/After Comparison Toggle */}
                  {selectedImage && jobImages[currentJob.id]?.[0] && (
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        onClick={() => setComparisonMode('side-by-side')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          comparisonMode === 'side-by-side'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        Side by Side
                      </button>
                      <button
                        onClick={() => setComparisonMode('slider')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          comparisonMode === 'slider'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        Slider
                      </button>
                    </div>
                  )}

                  {/* Before/After Comparison View */}
                  {selectedImage && jobImages[currentJob.id]?.[0] && (
                    <div className="mb-6">
                      {comparisonMode === 'side-by-side' ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center">BEFORE</p>
                            <img
                              src={selectedImage.preview}
                              alt="Original image"
                              className="w-full rounded-lg shadow-md"
                            />
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center">AFTER</p>
                            <img
                              src={(jobImages[currentJob.id][0].dataUrl || jobImages[currentJob.id][0].url) as string}
                              alt="Enhanced image"
                              className="w-full rounded-lg shadow-md"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center">DRAG TO COMPARE</p>
                          <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                            <img
                              src={(jobImages[currentJob.id][0].dataUrl || jobImages[currentJob.id][0].url) as string}
                              alt="Enhanced image"
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                            <div 
                              className="absolute inset-0"
                              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                            >
                              <img
                                src={selectedImage.preview}
                                alt="Original image"
                                className="absolute inset-0 w-full h-full object-cover"
                              />
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
                              onMouseDown={(e) => {
                                const container = e.currentTarget.parentElement;
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
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                                <div className="flex gap-0.5">
                                  <div className="w-0.5 h-4 bg-gray-400"></div>
                                  <div className="w-0.5 h-4 bg-gray-400"></div>
                                </div>
                              </div>
                            </div>
                            <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">BEFORE</div>
                            <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">AFTER</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Enhanced Images Grid */}
                  <div className="grid grid-cols-1 gap-3">
                    {jobImages[currentJob.id] && jobImages[currentJob.id].length > 0
                      ? jobImages[currentJob.id].map((dbImage, index) => (
                          <div key={`db-${dbImage.id}`} className="relative group">
                            {(dbImage.dataUrl || dbImage.url) ? (
                              <img
                                src={(dbImage.dataUrl || dbImage.url) as string}
                                alt={`Enhanced image ${index + 1}`}
                                className="w-full rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                                onClick={() => openLightbox((dbImage.dataUrl || dbImage.url) as string, dbImage.filename)}
                                onError={(e) => {
                                  console.error("Image load error for:", dbImage.filename);

                                  const currentSrc = (e.target as HTMLImageElement).src;
                                  
                                  if (currentSrc === dbImage.dataUrl && dbImage.url) {
                                    console.log("Falling back to url");
                                    (e.target as HTMLImageElement).src = dbImage.url;
                                  } else if (currentSrc === dbImage.url && dbImage.dataUrl) {
                                    console.log("Falling back to dataUrl");
                                    (e.target as HTMLImageElement).src = dbImage.dataUrl;
                                  } else {
                                    console.error("All URLs failed for:", dbImage.filename);
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-full h-64 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                <div className="text-center text-gray-500 dark:text-gray-400">
                                  <p className="text-sm">Image not available</p>
                                  <p className="text-xs">{dbImage.filename}</p>
                                  <p className="text-xs">dataUrl={dbImage.dataUrl || 'null'}</p>
                                  <p className="text-xs">url={dbImage.url || 'null'}</p>
                                </div>
                              </div>
                            )}
                            <div className="absolute top-2 right-2 flex space-x-1 transition-opacity">
                              <div className="flex space-x-1 rounded-full bg-white/90 px-1 py-0.5 shadow-md backdrop-blur dark:bg-gray-800/90">
                                <button
                                  onClick={() => downloadDatabaseImage(dbImage)}
                                  className="p-2 rounded-full text-gray-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 dark:text-gray-200 dark:hover:bg-blue-900/40"
                                  aria-label={`Download ${dbImage.filename}`}
                                  title={`Download ${dbImage.filename}`}
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => shareImage(dbImage)}
                                  className="p-2 rounded-full text-gray-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 dark:text-gray-200 dark:hover:bg-blue-900/40"
                                  aria-label={`Copy share link for ${dbImage.filename}`}
                                  title={`Copy share link for ${dbImage.filename}`}
                                >
                                  <Share2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            {dbImage.width && dbImage.height && (
                              <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                                  {dbImage.width}×{dbImage.height}
                                  {dbImage.fileSize && ` • ${Math.round(dbImage.fileSize / 1024)}KB`}
                                  {dbImage.format && ` • ${dbImage.format.toUpperCase()}`}
                                </div>
                              </div>
                            )}
                            <div className="absolute bottom-2 right-2">
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-1 text-[11px] font-medium text-gray-600 shadow-sm backdrop-blur transition group-hover:bg-white dark:bg-gray-900/85 dark:text-gray-200"
                                title={describeImageSource(dbImage)}
                              >
                                <span
                                  className={`inline-block h-2 w-2 rounded-full ${dbImage.url ? 'bg-blue-500' : 'bg-amber-500'}`}
                                  aria-hidden="true"
                                />
                                {dbImage.url ? 'Cloud' : 'Database'}
                              </span>
                            </div>
                          </div>
                        ))
                      : currentJob.resultUrls && currentJob.resultUrls.map((imageUrl, index) => (
                          <div key={`legacy-${index}`} className="relative group">
                            <img
                              src={imageUrl}
                              alt={`Enhanced image ${index + 1}`}
                              className="w-full rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                              onClick={() => openLightbox(imageUrl, `Enhanced image ${index + 1}`)}
                            />
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => downloadImage(imageUrl, `enhanced_image_${index + 1}.png`)}
                                className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
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

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4 animate-fade-in"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
            aria-label="Close lightbox"
          >
            <XCircle className="w-8 h-8" />
          </button>
          
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex flex-col items-center justify-center">
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={lightboxImage as string}
                alt={lightboxTitle}
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            
            {lightboxTitle && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg">
                <p className="text-sm font-medium">{lightboxTitle}</p>
              </div>
            )}
            
            <div className="absolute bottom-4 right-4 text-white text-xs bg-black bg-opacity-50 px-3 py-1 rounded">
              Press ESC to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
}