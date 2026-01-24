"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import { ReferenceSelector } from "@/components/reference-bank/ReferenceSelector";
import { ReferenceItem } from "@/hooks/useReferenceBank";
import {
  AlertCircle,
  Archive,
  ChevronDown,
  Clock,
  Download,
  FolderOpen,
  Info,
  Loader2,
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
  isDefault?: boolean;
}

interface GeneratedVideo {
  id: string;
  videoUrl: string;
  prompt: string;
  model: string;
  duration: string;
  imageCount: number;
  createdAt: string;
  status: "completed" | "processing" | "failed";
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

export default function KlingMultiImageToVideo() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();

  // Use global profile from header
  const { profileId: globalProfileId, selectedProfile } = useInstagramProfile();

  // Hydration fix - track if component is mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
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

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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
        const folders = await foldersResponse.json();
        setVaultFolders(Array.isArray(folders) ? folders : (folders.folders || []));
      }
    } catch (err) {
      console.error("Failed to load vault folders:", err);
      setVaultFolders([]);
    } finally {
      setIsLoadingVaultData(false);
    }
  }, [apiClient, globalProfileId]);

  // Get display name for selected folder
  const getSelectedFolderDisplay = (): string => {
    if (!targetFolder || !globalProfileId) return "Select a vault folder to save videos";
    
    const folder = vaultFolders.find((f) => f.id === targetFolder);
    if (folder && selectedProfile) {
      const profileDisplay = selectedProfile.instagramUsername ? `@${selectedProfile.instagramUsername}` : selectedProfile.name;
      return `Saving to Vault: ${profileDisplay} / ${folder.name}`;
    }
    return "Select a vault folder to save videos";
  };

  const loadGenerationHistory = useCallback(async () => {
    if (!apiClient) return;
    setIsLoadingHistory(true);
    try {
      console.log("[Kling Multi-I2V Frontend] Loading generation history...");
      const response = await apiClient.get(
        "/api/generate/kling-multi-image-to-video?history=true"
      );
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
  }, [apiClient]);

  useEffect(() => {
    if (apiClient) {
      loadVaultData();
      loadGenerationHistory();
      // Clear selected folder when profile changes
      setTargetFolder("");
    }
  }, [apiClient, loadVaultData, loadGenerationHistory]);

  // Handle image upload with compression
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Filter valid image files
    const validFiles = files.filter(file => file.type.startsWith("image/"));
    
    // Check total count - API supports max 4 images
    const totalImages = uploadedImages.length + validFiles.length;
    if (totalImages > MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }

    // Check individual file sizes (allow up to 20MB since we compress)
    const oversizedFiles = validFiles.filter(f => f.size > 20 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setError("Each image must be less than 20MB");
      return;
    }

    setError(null);
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
      setError("Failed to process one or more images. Please try different files.");
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
  const saveToReferenceBank = async (file: File, imageBase64: string): Promise<string | null> => {
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

  // Handle selection from Reference Bank
  const handleReferenceBankSelect = async (item: ReferenceItem) => {
    // Check if max images reached
    if (uploadedImages.length >= MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images allowed`);
      setShowReferenceBankSelector(false);
      return;
    }

    // Check if this reference is already added
    const alreadyAdded = uploadedImages.some(img => img.referenceId === item.id);
    if (alreadyAdded) {
      setError('This reference image is already added');
      setShowReferenceBankSelector(false);
      return;
    }

    try {
      // Fetch image via proxy
      const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(item.awsS3Url)}`);
      
      if (!proxyResponse.ok) {
        setError('Failed to load reference image. Please try again.');
        setShowReferenceBankSelector(false);
        return;
      }
      
      const blob = await proxyResponse.blob();
      
      // Convert blob to File
      const file = new File([blob], item.name || 'reference.jpg', { type: blob.type || 'image/jpeg' });
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImage: UploadedImage = {
          id: `ref-${item.id}-${Date.now()}`,
          file,
          preview: reader.result as string,
          fromReferenceBank: true,
          referenceId: item.id,
        };
        setUploadedImages(prev => [...prev, newImage]);
        
        // Track usage
        fetch(`/api/reference-bank/${item.id}/use`, { method: 'POST' }).catch(console.error);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Error loading reference image:', err);
      setError('Failed to load reference image. Please try again.');
    }

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
          setTimeout(() => clearGlobalProgress(), 3000);
          reject(err);
        }
      };

      poll();
    });
  };

  const handleGenerate = async () => {
    if (!apiClient) {
      setError("API client not available");
      return;
    }
    if (uploadedImages.length < 2) {
      setError("Please upload at least 2 images");
      return;
    }
    if (!prompt.trim()) {
      setError("Prompt is required for multi-image video generation");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("Uploading images...");
    const localTaskId = `kling-multi-i2v-${Date.now()}`;

    try {
      // Save new uploads to Reference Bank before generating
      if (globalProfileId) {
        setIsSavingToReferenceBank(true);
        for (let i = 0; i < uploadedImages.length; i++) {
          const img = uploadedImages[i];
          if (!img.fromReferenceBank) {
            const newReferenceId = await saveToReferenceBank(img.file, img.preview);
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
        formData.append("vaultProfileId", globalProfileId);
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
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("");
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
                  <span className="text-xs text-slate-400">{uploadedImages.length}/{MAX_IMAGES}</span>
                </div>
                
                {uploadedImages.length < MAX_IMAGES && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => !isCompressing && fileInputRef.current?.click()}
                      disabled={isGenerating || isCompressing}
                      className="flex-1 py-6 border-2 border-dashed border-white/20 hover:border-violet-400/50 rounded-2xl bg-white/5 hover:bg-white/10 transition-all flex flex-col items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
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
                    
                    {/* Reference Bank Button */}
                    {mounted && globalProfileId && (
                      <button
                        onClick={() => setShowReferenceBankSelector(true)}
                        disabled={isGenerating || isCompressing}
                        className="px-4 py-6 border-2 border-dashed border-cyan-500/30 hover:border-cyan-400/50 rounded-2xl bg-cyan-500/5 hover:bg-cyan-500/10 transition-all flex flex-col items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Select from Reference Bank"
                      >
                        <div className="p-3 bg-cyan-500/10 rounded-full group-hover:bg-cyan-500/20 transition-colors">
                          <Library className="h-6 w-6 text-cyan-300" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-white font-medium">Reference Bank</p>
                          <p className="text-xs text-slate-400 mt-1">Select saved</p>
                        </div>
                      </button>
                    )}
                  </div>
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

              {/* Prompt Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-100">Prompt <span className="text-red-400">*</span></label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the transition or animation style..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent disabled:opacity-50"
                  rows={3}
                  disabled={isGenerating}
                />
                <p className="text-xs text-slate-300">Required: Describe the transition style between images.</p>
              </div>

              {/* Negative Prompt */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-100">Negative Prompt (Optional)</label>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="What to avoid: blurry, distorted, low quality..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent disabled:opacity-50"
                  rows={2}
                  disabled={isGenerating}
                />
              </div>

              {/* Model Selection */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-100">Model</label>
                <div className="grid grid-cols-3 gap-2">
                  {MODEL_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setModel(option.value)}
                      className={`rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                        model === option.value
                          ? "border-violet-400/70 bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-pink-500/10 text-white shadow-violet-900/40"
                          : "border-white/10 bg-white/5 text-slate-100/90"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="text-xs text-slate-300">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-100">Quality Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  {MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setMode(option.value)}
                      className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                        mode === option.value
                          ? "border-violet-400/70 bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-pink-500/10 text-white shadow-violet-900/40"
                          : "border-white/10 bg-white/5 text-slate-100/90"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="text-xs text-slate-300">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Selection */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-100">Duration</label>
                <div className="grid grid-cols-2 gap-3">
                  {DURATION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setDuration(option.value)}
                      className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                        duration === option.value
                          ? "border-violet-400/70 bg-violet-500/10 text-white shadow-violet-900/30"
                          : "border-white/10 bg-white/5 text-slate-200"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="text-xs text-slate-300">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio Selection */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-100">Aspect Ratio</label>
                <div className="grid grid-cols-3 gap-3">
                  {ASPECT_RATIO_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAspectRatio(option.value)}
                      className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                        aspectRatio === option.value
                          ? "border-violet-400/70 bg-violet-500/10 text-white shadow-violet-900/30"
                          : "border-white/10 bg-white/5 text-slate-200"
                      } disabled:opacity-50`}
                      disabled={isGenerating}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="text-xs text-slate-300">{option.description}</p>
                    </button>
                  ))}
                </div>
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
                        {targetFolder && selectedProfile && (
                          <p className="text-[11px] text-violet-300/70 truncate">
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
                        {!targetFolder && <Check className="w-4 h-4 text-violet-400 ml-auto" />}
                      </button>

                      {vaultFolders.filter(f => !f.isDefault).length > 0 && (
                        <div className="my-2 mx-3 h-px bg-white/5" />
                      )}

                      {/* Folder Options */}
                      <div className="max-h-[200px] overflow-y-auto">
                        {vaultFolders.filter(f => !f.isDefault).map((folder) => (
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
                                ? 'bg-violet-500/15' 
                                : 'hover:bg-white/5'
                              }
                            `}
                          >
                            <div className={`
                              w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                              ${targetFolder === folder.id 
                                ? 'bg-gradient-to-br from-violet-500/40 to-purple-500/40 border border-violet-400/40' 
                                : 'bg-slate-700/50 border border-white/5'
                              }
                            `}>
                              <FolderOpen className={`w-4 h-4 ${targetFolder === folder.id ? 'text-violet-300' : 'text-slate-400'}`} />
                            </div>
                            <span className={`text-sm flex-1 truncate ${targetFolder === folder.id ? 'text-white font-medium' : 'text-slate-200'}`}>
                              {folder.name}
                            </span>
                            {targetFolder === folder.id && (
                              <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                            )}
                          </button>
                        ))}
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

              {/* Error Display */}
              {error && (
                <div className="flex items-center gap-2 rounded-2xl border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

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
                  <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Recent</p>
                  <h2 className="text-lg font-semibold text-white">History</h2>
                </div>
                <button
                  onClick={() => loadGenerationHistory()}
                  disabled={isLoadingHistory}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition"
                >
                  <RefreshCw className={`w-4 h-4 text-slate-300 ${isLoadingHistory ? "animate-spin" : ""}`} />
                </button>
              </div>

              {generationHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-slate-300">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm">No generation history yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[280px] overflow-y-auto pr-1">
                  {generationHistory.map((video) => (
                    <div
                      key={video.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => video.videoUrl && openVideoModal(video)}
                      className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition cursor-pointer overflow-hidden max-w-[160px]"
                    >
                      <div className="w-full h-20 bg-slate-800">
                        {video.videoUrl ? (
                          <video
                            src={video.videoUrl}
                            className="w-full h-full object-cover"
                            muted
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-800/50">
                            <Video className="w-5 h-5 text-slate-500 opacity-50" />
                          </div>
                        )}
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="text-[10px] text-white truncate">
                          {video.prompt || "Multi-image"}
                        </p>
                        <p className="text-[9px] text-slate-400 truncate">
                          {video.imageCount} imgs · {video.duration}s
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
                <p className="text-slate-400">
                  {selectedVideo.imageCount} images · {selectedVideo.duration}s · {selectedVideo.model}
                </p>
                <button
                  onClick={() => handleDownload(selectedVideo.videoUrl, `kling-multi-i2v-${selectedVideo.id}.mp4`)}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 via-purple-500 to-pink-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
                >
                  <Download className="w-4 h-4" />
                  Download Video
                </button>
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
    </div>
  );
}
