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
  Eye,
  Settings,
  Palette,
  Share2
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
  url?: string | null;
  dataUrl?: string;
  createdAt: Date | string;
}

export default function ImageToImageSkinEnhancerPage() {
  const { user } = useUser();
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentJob, setCurrentJob] = useState<JobStatus | null>(null);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [jobImages, setJobImages] = useState<Record<string, DatabaseImage[]>>({});
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiClient = useApiClient();

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

  // Function to fetch images for a completed job from database
  const fetchJobImages = useCallback(async (jobId: string): Promise<boolean> => {
    if (!apiClient) return false;

    try {
      console.log("🖼️ Fetching database images for job:", jobId);
      
      const response = await apiClient.get(`/api/jobs/${jobId}/images`);
      console.log("📡 Image fetch response status:", response.status);

      if (!response.ok) {
        console.error("Failed to fetch job images:", response.status);
        return false;
      }

      const data = await response.json();
      console.log("📊 Job images data:", data);

      if (data.success && data.images && Array.isArray(data.images)) {
        console.log(`✅ Fetched ${data.images.length} database images for job ${jobId}`);
        
        setJobImages((prev) => ({
          ...prev,
          [jobId]: data.images,
        }));

        return true;
      } else {
        console.warn("No images found in response");
        return false;
      }
    } catch (error) {
      console.error("💥 Error fetching job images:", error);
      return false;
    }
  }, [apiClient]);

  // Function to download database image
  const downloadDatabaseImage = async (image: DatabaseImage) => {
    if (!apiClient) return;

    try {
      console.log("📥 Downloading image:", image.filename);

      if (image.dataUrl) {
        // Priority 1: Download from database URL
        const response = await apiClient.get(image.dataUrl);
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          downloadFromUrl(url, image.filename);
          window.URL.revokeObjectURL(url);
          return;
        }
      }

      if (image.url) {
        // Priority 2: Download from ComfyUI URL
        downloadFromUrl(image.url, image.filename);
        return;
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
          "filename_prefix": "ComfyUI"
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

    if (!selectedImage) {
      setError('Please select an image to enhance');
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

        // Update progress
        setCurrentJob(prev => prev ? {
          ...prev,
          status: jobData.status,
          progress: jobData.progress || prev.progress,
          message: jobData.message || prev.message,
          resultUrls: jobData.resultUrls || prev.resultUrls
        } : null);

        // Handle completion
        if (jobData.status === 'COMPLETED') {
          console.log("✅ Job completed! ResultUrls:", jobData.resultUrls);
          setIsProcessing(false);

          // Fetch database images
          console.log("🖼️ Calling fetchJobImages...");
          const fetchSuccess = await fetchJobImages(currentJob.id);
          console.log("📸 fetchJobImages result:", fetchSuccess);

          // Fallback to resultUrls if database fetch fails
          if (!fetchSuccess && jobData.resultUrls?.length > 0) {
            console.log("⚠️ Using fallback resultUrls:", jobData.resultUrls);
            setResultImages(jobData.resultUrls);
          } else if (!fetchSuccess) {
            // Retry after delay
            console.log("🔄 Retrying image fetch after 3s...");
            setTimeout(() => fetchJobImages(currentJob.id), 3000);
          }

          return; // Stop polling
        }

        // Handle failure
        if (jobData.status === 'FAILED') {
          console.error("❌ Job failed:", jobData.error);
          setError(jobData.error || 'Generation failed');
          setIsProcessing(false);
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
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label htmlFor="image-upload" className="cursor-pointer">
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
                      <ImageIcon className="w-12 h-12 text-gray-400 mx-auto" />
                      <div>
                        <p className="text-lg font-medium">Click to upload image</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          PNG, JPG, JPEG up to 10MB
                        </p>
                      </div>
                    </div>
                  )}
                </label>
              </div>
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
                disabled={isProcessing || !selectedImage}
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
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${currentJob.progress || 0}%` }}
                    />
                  </div>
                </div>
                {currentJob.message && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {currentJob.message}
                  </p>
                )}
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  currentJob.status === 'COMPLETED' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                  currentJob.status === 'FAILED' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}>
                  {currentJob.status}
                </span>
              </div>
            </div>
          )}

          {/* Results */}
          {(currentJob && (jobImages[currentJob.id]?.length > 0 || resultImages.length > 0)) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Enhanced Images</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Your enhanced images are ready!
                </p>
              </div>
              <div className="p-6 space-y-4">
                {/* Debug info */}
                <div className="text-xs text-gray-500 mb-4 p-2 bg-gray-100 dark:bg-gray-900 rounded">
                  <div>Current Job ID: {currentJob?.id}</div>
                  <div>Job Images Count: {currentJob ? jobImages[currentJob.id]?.length || 0 : 0}</div>
                  <div>Result Images Count: {resultImages.length}</div>
                  <div>Job Status: {currentJob?.status}</div>
                  <div>Has ResultUrls: {currentJob?.resultUrls?.length || 0}</div>
                </div>
                
                {/* Show database images if available */}
                {currentJob && jobImages[currentJob.id] && jobImages[currentJob.id].length > 0
                  ? // Database images with dynamic URLs
                    jobImages[currentJob.id].map((dbImage, index) => (
                      <div key={`db-${dbImage.id}`} className="space-y-3">
                        <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 group">
                          {/* Only render img if we have a valid URL */}
                          {(dbImage.dataUrl || dbImage.url) ? (
                            <Image
                              src={(dbImage.dataUrl || dbImage.url) as string}
                              alt={`Enhanced image ${index + 1}`}
                              fill
                              className="object-cover"
                              onError={(e) => {
                                console.error("Image load error for:", dbImage.filename);
                                
                                // Smart fallback logic
                                const currentSrc = (e.target as HTMLImageElement).src;
                                
                                if (currentSrc === dbImage.dataUrl && dbImage.url) {
                                  console.log("Falling back to URL");
                                  (e.target as HTMLImageElement).src = dbImage.url;
                                } else if (currentSrc === dbImage.url && dbImage.dataUrl) {
                                  console.log("Falling back to database URL");
                                  (e.target as HTMLImageElement).src = dbImage.dataUrl;
                                } else {
                                  console.error("All URLs failed for:", dbImage.filename);
                                }
                              }}
                            />
                          ) : (
                            // Fallback for images without valid URLs
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-center text-gray-500 dark:text-gray-400">
                                <p className="text-sm">Image not available</p>
                                <p className="text-xs">{dbImage.filename}</p>
                              </div>
                            </div>
                          )}
                          
                          {/* Image metadata overlay */}
                          <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                              {dbImage.width && dbImage.height
                                ? `${dbImage.width}×${dbImage.height}`
                                : "Unknown size"}
                              {dbImage.fileSize &&
                                ` • ${Math.round(dbImage.fileSize / 1024)}KB`}
                              {dbImage.format &&
                                ` • ${dbImage.format.toUpperCase()}`}
                            </div>
                          </div>
                        </div>
                        
                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => downloadDatabaseImage(dbImage)}
                            className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </button>
                          <button
                            onClick={() => shareImage(dbImage)}
                            className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                            title="Copy image URL"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  : // Fallback to legacy URLs if no database images
                    resultImages.map((imageUrl, index) => (
                      <div key={`legacy-${index}`} className="space-y-3">
                        <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                          <Image
                            src={imageUrl}
                            alt={`Enhanced image ${index + 1}`}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <button
                          onClick={() => downloadImage(imageUrl, `enhanced_image_${index + 1}.png`)}
                          className="w-full inline-flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </button>
                      </div>
                    ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}