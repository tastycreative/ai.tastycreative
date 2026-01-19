"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import {
  AlertCircle,
  Archive,
  ChevronDown,
  Clock,
  Download,
  Film,
  Folder,
  Info,
  Loader2,
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

type FolderType = "s3" | "vault";

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

export default function KlingImageToVideo() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Folder state
  const [targetFolder, setTargetFolder] = useState<string>("");

  // Vault folder state
  const [vaultProfiles, setVaultProfiles] = useState<InstagramProfile[]>([]);
  const [vaultFoldersByProfile, setVaultFoldersByProfile] = useState<Record<string, VaultFolder[]>>({});
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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, isTailImage: boolean = false) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file");
      return;
    }

    // Allow larger initial files since we'll compress them
    if (file.size > 20 * 1024 * 1024) {
      setError("Image must be less than 20MB");
      return;
    }

    setError(null);
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
      setError("Failed to process image. Please try a different file.");
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
    }
  };

  // Load vault profiles and folders

  // Load vault profiles and folders
  const loadVaultData = useCallback(async () => {
    if (!apiClient || !user) return;
    setIsLoadingVaultData(true);
    try {
      const profilesResponse = await apiClient.get("/api/instagram/profiles");
      if (profilesResponse.ok) {
        const profilesData = await profilesResponse.json();
        const profiles: InstagramProfile[] = profilesData.profiles || [];
        setVaultProfiles(profiles);

        const foldersByProfile: Record<string, VaultFolder[]> = {};
        for (const profile of profiles) {
          try {
            const foldersResponse = await apiClient.get(
              `/api/vault/folders?profileId=${profile.id}`
            );
            if (foldersResponse.ok) {
              const foldersData = await foldersResponse.json();
              foldersByProfile[profile.id] = Array.isArray(foldersData) ? foldersData : (foldersData.folders || []);
            }
          } catch (err) {
            console.error(`Failed to load folders for profile ${profile.id}:`, err);
            foldersByProfile[profile.id] = [];
          }
        }
        setVaultFoldersByProfile(foldersByProfile);
      }
    } catch (err) {
      console.error("Failed to load vault data:", err);
    } finally {
      setIsLoadingVaultData(false);
    }
  }, [apiClient, user]);

  // Parse the target folder value to determine type and IDs
  const parseTargetFolder = (value: string): { type: FolderType; profileId?: string; folderId?: string; prefix?: string } => {
    if (value.startsWith("vault:")) {
      const parts = value.split(":");
      return {
        type: "vault",
        profileId: parts[1],
        folderId: parts[2],
      };
    }
    return {
      type: "s3",
      prefix: value,
    };
  };

  // Get display name for selected folder
  const getSelectedFolderDisplay = (): string => {
    if (!targetFolder) return "Please select a vault folder to save your video";
    
    const parsed = parseTargetFolder(targetFolder);
    if (parsed.type === "vault" && parsed.profileId && parsed.folderId) {
      const profile = vaultProfiles.find((p) => p.id === parsed.profileId);
      const folders = vaultFoldersByProfile[parsed.profileId] || [];
      const folder = folders.find((f) => f.id === parsed.folderId);
      if (profile && folder) {
        const profileDisplay = profile.instagramUsername ? `@${profile.instagramUsername}` : profile.name;
        return `Videos save to vault: ${profileDisplay} / ${folder.name}`;
      }
    }
    return "Please select a vault folder";
  };

  const loadGenerationHistory = useCallback(async () => {
    if (!apiClient) return;
    setIsLoadingHistory(true);
    try {
      console.log("[Kling I2V Frontend] Loading generation history...");
      const response = await apiClient.get(
        "/api/generate/kling-image-to-video?history=true"
      );
      if (response.ok) {
        const data = await response.json();
        const videos = data.videos || [];
        console.log("[Kling I2V Frontend] Loaded videos:", videos.length);
        console.log("[Kling I2V Frontend] Video URLs present:", videos.filter((v: any) => !!v.videoUrl).length);
        setGenerationHistory(videos);
      } else {
        console.error("[Kling I2V Frontend] Failed to load history, status:", response.status);
      }
    } catch (err) {
      console.error("[Kling I2V Frontend] Failed to load generation history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [apiClient]);

  useEffect(() => {
    if (apiClient) {
      loadVaultData();
      loadGenerationHistory();
    }
  }, [apiClient, loadVaultData, loadGenerationHistory]);

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
    if (!uploadedImage) {
      setError("Please upload an image first");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("Submitting task...");
    const localTaskId = `kling-i2v-${Date.now()}`;

    try {
      updateGlobalProgress({
        isGenerating: true,
        progress: 0,
        stage: "starting",
        message: "Starting Kling Image-to-Video generation...",
        generationType: "image-to-video",
        jobId: localTaskId,
      });

      // Parse target folder for vault vs S3
      const parsedFolder = parseTargetFolder(targetFolder);
      
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

      // Add folder params based on type
      if (parsedFolder.type === "vault" && parsedFolder.profileId && parsedFolder.folderId) {
        formData.append("saveToVault", "true");
        formData.append("vaultProfileId", parsedFolder.profileId);
        formData.append("vaultFolderId", parsedFolder.folderId);
      } else if (parsedFolder.prefix) {
        formData.append("targetFolder", parsedFolder.prefix);
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
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("");
  };

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
                <Film className="w-6 h-6 text-white" />
                <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Motion Studio</p>
                <h1 className="text-3xl sm:text-4xl font-black text-white">Kling AI — Image to Video</h1>
              </div>
            </div>
            <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed">
              Transform your images into stunning AI-generated videos using Kling AI&apos;s advanced image-to-video technology.
              Upload an image and let AI bring it to life with motion and dynamics.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Image Input</p>
                  <p className="text-xs text-slate-300">Upload source</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20 text-pink-200">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Camera Control</p>
                  <p className="text-xs text-slate-300">Dynamic motion</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">AI Magic</p>
                  <p className="text-xs text-slate-300">Kling models</p>
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
                  <p className="text-xs font-semibold text-white">Generation Status</p>
                  <p className="text-xs text-slate-200/80">
                    {isGenerating ? "Processing..." : "Ready to generate"}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-200/80">
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                      <span className="font-medium text-violet-300">{pollingStatus || "Working..."}</span>
                    </>
                  ) : (
                    <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-emerald-300 font-medium">Ready</span>
                  )}
                </div>
              </div>
              {pollingStatus && (
                <div className="mt-3 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full animate-pulse" style={{ width: "75%" }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-400/30 rounded-2xl backdrop-blur">
            <AlertCircle className="h-5 w-5 text-red-300 flex-shrink-0" />
            <p className="text-red-100 text-sm flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto p-1 hover:bg-red-500/20 rounded-full transition-colors"
            >
              <X className="h-4 w-4 text-red-300" />
            </button>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-[420px_1fr] items-start">
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-violet-900/40 backdrop-blur space-y-6">
              {/* Image Upload Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-violet-400" />
                  <h3 className="text-base font-semibold text-white">Upload Image</h3>
                </div>

                {/* Main Image Upload */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">
                    Source Image <span className="text-red-400">*</span>
                  </label>
                  {!imagePreview ? (
                    <div
                      onClick={() => !isCompressing && fileInputRef.current?.click()}
                      className={`border-2 border-dashed border-white/20 rounded-2xl p-8 text-center cursor-pointer hover:border-violet-400/50 hover:bg-white/5 transition-all ${
                        isCompressing ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {isCompressing ? (
                        <>
                          <Loader2 className="h-12 w-12 text-violet-400 mx-auto mb-3 animate-spin" />
                          <p className="text-sm text-slate-200 mb-1">
                            Compressing image...
                          </p>
                        </>
                      ) : (
                        <>
                          <Upload className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                          <p className="text-sm text-slate-200 mb-1">
                            Click to upload image
                          </p>
                          <p className="text-xs text-slate-400">
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
                        className="w-full h-64 object-cover rounded-2xl border border-white/10"
                      />
                      <button
                        onClick={() => removeImage(false)}
                        className="absolute top-2 right-2 p-2 bg-red-500/90 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors backdrop-blur-sm"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      {compressionInfo && (
                        <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded-lg bg-emerald-500/80 text-xs text-white text-center">
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
                  <label className="block text-sm font-medium text-slate-200">
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
                            ? "border-violet-400 bg-violet-500/20"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        } disabled:opacity-50`}
                      >
                        <div className="font-medium text-sm text-white">
                          {option.label}
                        </div>
                        <div className="text-xs text-slate-300 mt-1">
                          {option.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tail Image Upload (Pro Mode Only) */}
                {imageMode === "pro" && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-200">
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
                        className="border-2 border-dashed border-white/20 rounded-2xl p-4 text-center cursor-pointer hover:border-violet-400/50 hover:bg-white/5 transition-all"
                      >
                        <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-xs text-slate-300">
                          Add ending frame (Pro mode)
                        </p>
                      </div>
                    ) : (
                      <div className="relative">
                        <img
                          src={tailImagePreview}
                          alt="Tail"
                          className="w-full h-32 object-cover rounded-2xl border border-white/10"
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
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-400" />
                  <h3 className="text-base font-semibold text-white">Prompt (Optional)</h3>
                </div>
                <div className="space-y-2">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the motion and scene you want to see in the video..."
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent disabled:opacity-50"
                    rows={4}
                    disabled={isGenerating}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">
                    Negative Prompt (Optional)
                  </label>
                  <textarea
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="What to avoid: blurry, distorted, low quality..."
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent disabled:opacity-50"
                    rows={2}
                    disabled={isGenerating}
                  />
                </div>
              </div>

              {/* Generation Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-violet-400" />
                  <h3 className="text-base font-semibold text-white">Generation Settings</h3>
                </div>
                {/* Model Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-200">
                    Model Version
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {MODEL_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setModel(option.value);
                          // Auto-enable sound and pro mode for V2.6 (audio only works in pro mode)
                          if (option.supportsSound) {
                            setSound("on");
                            setMode("pro");
                          } else {
                            // Reset sound if switching to a model that doesn't support it
                            setSound("off");
                          }
                          // Reset camera control if switching to a model that doesn't support it
                          if (!option.supportsCameraControl) {
                            setUseCameraControl(false);
                          }
                        }}
                        disabled={isGenerating}
                        className={`p-3 rounded-2xl border-2 transition-all text-left ${
                          model === option.value
                            ? "border-violet-400 bg-violet-500/20"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        } disabled:opacity-50`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm text-white">
                            {option.label}
                          </span>
                          {option.supportsSound && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">🔊</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-300 mt-1">
                          {option.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sound Toggle (only for V2.6+ in Pro mode) */}
                {currentModelSupportsSound && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-200">
                      Audio Generation
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setSound("off")}
                        disabled={isGenerating}
                        className={`p-3 rounded-2xl border-2 transition-all ${
                          sound === "off"
                            ? "border-violet-400 bg-violet-500/20"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        } disabled:opacity-50`}
                      >
                        <div className="font-medium text-sm text-white">🔇 No Audio</div>
                        <div className="text-xs text-slate-300 mt-1">Video only</div>
                      </button>
                      <button
                        onClick={() => {
                          setSound("on");
                          // Sound only works in Pro mode for V2.6
                          if (mode === "std") {
                            setMode("pro");
                          }
                        }}
                        disabled={isGenerating}
                        className={`p-3 rounded-2xl border-2 transition-all ${
                          sound === "on"
                            ? "border-emerald-400 bg-emerald-500/20"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        } disabled:opacity-50`}
                      >
                        <div className="font-medium text-sm text-white">🔊 With Audio</div>
                        <div className="text-xs text-slate-300 mt-1">Pro mode only</div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Mode Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-200">
                    Quality Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {MODE_OPTIONS.map((option) => {
                      // Standard mode is disabled when sound is on (V2.6 constraint)
                      const isStdDisabledDueToSound = option.value === "std" && sound === "on" && currentModelSupportsSound;
                      const isDisabled = isGenerating || isStdDisabledDueToSound;
                      
                      return (
                        <button
                          key={option.value}
                          onClick={() => {
                            setMode(option.value);
                            // If switching to std mode and sound is on, turn sound off
                            if (option.value === "std" && sound === "on") {
                              setSound("off");
                            }
                          }}
                          disabled={isDisabled}
                          className={`p-3 rounded-2xl border-2 transition-all ${
                            mode === option.value
                              ? "border-violet-400 bg-violet-500/20"
                              : "border-white/10 bg-white/5 hover:border-white/20"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={isStdDisabledDueToSound ? "Standard mode doesn't support audio generation" : undefined}
                        >
                          <div className="font-medium text-sm text-white">
                            {option.label}
                          </div>
                          <div className="text-xs text-slate-300 mt-1">
                            {isStdDisabledDueToSound ? "No audio support" : option.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Duration Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-200">
                    Video Duration
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {DURATION_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setDuration(option.value)}
                        disabled={isGenerating}
                        className={`p-3 rounded-2xl border-2 transition-all ${
                          duration === option.value
                            ? "border-violet-400 bg-violet-500/20"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        } disabled:opacity-50`}
                      >
                        <div className="font-medium text-sm text-white">
                          {option.label}
                        </div>
                        <div className="text-xs text-slate-300 mt-1">
                          {option.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* CFG Scale - Only for V1 models */}
                {currentModelSupportsCfgScale && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-200">
                      CFG Scale: <span className="text-violet-300">{cfgScale.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={cfgScale}
                      onChange={(e) => setCfgScale(parseFloat(e.target.value))}
                      disabled={isGenerating}
                      className="w-full accent-violet-400"
                    />
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>More Creative</span>
                      <span>More Accurate</span>
                    </div>
                  </div>
                )}

                {/* Camera Control - Only for V1.5+ models */}
                {currentModelSupportsCameraControl && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Camera className="h-4 w-4 text-violet-400" />
                        <label className="text-sm font-medium text-slate-200">
                          Camera Control
                        </label>
                      </div>
                      <button
                        onClick={() => setUseCameraControl(!useCameraControl)}
                        disabled={isGenerating}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          useCameraControl
                            ? "bg-violet-500"
                            : "bg-white/10"
                        } disabled:opacity-50`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            useCameraControl ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    {useCameraControl && (
                      <div className="space-y-4">
                        {/* Camera Control Type Selection */}
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-slate-300">Movement Type</label>
                          <div className="grid grid-cols-2 gap-2">
                            {CAMERA_CONTROL_TYPE_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => setCameraControlType(option.value)}
                                disabled={isGenerating}
                                className={`p-2 rounded-xl border-2 transition-all text-left ${
                                  cameraControlType === option.value
                                    ? "border-pink-400 bg-pink-500/20"
                                    : "border-white/10 bg-white/5 hover:border-white/20"
                                } disabled:opacity-50`}
                              >
                                <div className="font-medium text-xs text-white">
                                  {option.label}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {option.description}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 6-Axis Config (only for simple type) */}
                        {cameraControlType === "simple" && (
                          <div className="space-y-3 border-t border-white/10 pt-3">
                            <label className="text-xs font-semibold text-slate-300">6-Axis Configuration</label>
                            <p className="text-[10px] text-slate-400">Select one axis and set its value. Only one axis can be non-zero.</p>
                            
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
                                  disabled={isGenerating}
                                  className={`rounded-lg border px-2 py-1.5 text-center transition ${
                                    selectedCameraAxis === axis.key
                                      ? "border-pink-400/70 bg-pink-500/10 text-white"
                                      : "border-white/10 bg-white/5 text-slate-300"
                                  } disabled:opacity-50`}
                                >
                                  <p className="text-[10px] font-semibold">{axis.label}</p>
                                </button>
                              ))}
                            </div>

                            {/* Selected Axis Slider */}
                            {selectedCameraAxis && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-slate-300">
                                    {CAMERA_AXIS_OPTIONS.find(a => a.key === selectedCameraAxis)?.description}
                                  </span>
                                  <span className="text-xs font-mono text-pink-300">
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
                                  className="w-full accent-pink-400"
                                  disabled={isGenerating}
                                />
                                <div className="flex justify-between text-[10px] text-slate-500">
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

              {/* Folder Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-200">
                  Save Location
                </label>
                <select
                  value={targetFolder}
                  onChange={(e) => setTargetFolder(e.target.value)}
                  disabled={isLoadingVaultData || isGenerating}
                  className="w-full rounded-2xl border border-white/10 bg-slate-800/90 px-4 py-3 text-sm text-slate-100 transition focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent disabled:opacity-50 [&>option]:bg-slate-800 [&>option]:text-slate-100 [&>optgroup]:bg-slate-900 [&>optgroup]:text-violet-300 [&>optgroup]:font-semibold"
                >
                  <option value="" className="bg-slate-800 text-slate-100">Select a vault folder...</option>
                  {vaultProfiles.map((profile) => {
                    const folders = (vaultFoldersByProfile[profile.id] || []).filter(f => !f.isDefault);
                    if (folders.length === 0) return null;
                    const profileDisplay = profile.instagramUsername
                      ? `@${profile.instagramUsername}`
                      : profile.name;
                    return (
                      <optgroup key={profile.id} label={`🔒 ${profileDisplay}`} className="bg-slate-900 text-violet-300">
                        {folders.map((folder) => (
                          <option
                            key={`vault:${profile.id}:${folder.id}`}
                            value={`vault:${profile.id}:${folder.id}`}
                            className="bg-slate-800 text-slate-100 py-2"
                          >
                            {folder.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                <p className="text-xs text-slate-400">
                  {getSelectedFolderDisplay()}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || isCompressing || !uploadedImage}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl shadow-violet-900/30 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-emerald-400" />
                  <h3 className="text-base font-semibold text-white">Generated Videos</h3>
                </div>
              </div>
              {generatedVideos.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Your generated videos will appear here</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {generatedVideos.map((video) => (
                    <div
                      key={video.id}
                      className="border border-white/10 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow bg-white/5 backdrop-blur"
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
                              <p className="text-xs text-slate-400 mb-1">
                                Source: Image
                              </p>
                            )}
                            {video.prompt && (
                              <p className="text-sm text-slate-200 mb-2 line-clamp-2">
                                {video.prompt}
                              </p>
                            )}
                            <div className="flex gap-2 text-xs text-slate-400">
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
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            title="Download video"
                          >
                            <Download className="h-5 w-5 text-slate-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Generation History */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl shadow-violet-900/30 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-violet-400" />
                  <h3 className="text-base font-semibold text-white">Recent Generations</h3>
                </div>
                <button
                  onClick={loadGenerationHistory}
                  disabled={isLoadingHistory}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:cursor-not-allowed"
                  title="Refresh history"
                >
                  <RefreshCw
                    className={`h-4 w-4 text-slate-400 ${
                      isLoadingHistory ? "animate-spin" : ""
                    }`}
                  />
                </button>
              </div>

              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 text-violet-400 animate-spin" />
                </div>
              ) : generationHistory.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No generation history yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[320px] overflow-y-auto pr-1">
                  {generationHistory.map((video) => (
                    <div
                      key={video.id}
                      className="border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all cursor-pointer bg-white/5 max-w-[180px]"
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
                          <div className="w-full h-full flex items-center justify-center bg-slate-800/50">
                            <div className="text-center text-slate-400">
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
                          <p className="text-xs text-slate-200 truncate">
                            {video.prompt}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 truncate">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="relative max-w-4xl w-full bg-slate-900 border border-white/10 rounded-3xl shadow-2xl">
              <button
                onClick={() => {
                  pauseAllPreviews();
                  setShowVideoModal(false);
                  setSelectedVideo(null);
                }}
                className="absolute -top-4 -right-4 p-2 bg-slate-800 border border-white/10 rounded-full shadow-lg hover:bg-slate-700 transition-colors z-10"
              >
                <X className="h-6 w-6 text-slate-400" />
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
                      <p className="text-sm font-medium text-slate-400 mb-1">
                        Source Image:
                      </p>
                      <img
                        src={selectedVideo.imageUrl}
                        alt="Source"
                        className="w-32 h-32 object-cover rounded-lg border border-white/10"
                      />
                    </div>
                  )}
                  {selectedVideo.prompt && (
                    <div>
                      <p className="text-sm font-medium text-slate-400 mb-1">
                        Prompt:
                      </p>
                      <p className="text-sm text-slate-200">
                        {selectedVideo.prompt}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-4 text-sm text-slate-400">
                      <span>Model: {selectedVideo.model}</span>
                      <span>Duration: {selectedVideo.duration}s</span>
                      <span>
                        Created: {new Date(selectedVideo.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        handleDownload(
                          selectedVideo.videoUrl,
                          `kling-i2v-${selectedVideo.id}.mp4`
                        )
                      }
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:shadow-lg text-white rounded-full transition"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Help Modal */}
      {showHelpModal && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="relative max-w-2xl w-full bg-slate-900 border border-white/10 rounded-3xl shadow-2xl max-h-[80vh] overflow-y-auto">
              <button
                onClick={() => setShowHelpModal(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
              <div className="p-8">
                <h2 className="text-2xl font-bold text-white mb-6">
                  Kling Image to Video - Help Guide
                </h2>
                <div className="space-y-6 text-slate-300">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Getting Started
                    </h3>
                    <p className="text-sm leading-relaxed">
                      Transform your images into dynamic videos using Kling AI's advanced
                      image-to-video technology. Upload an image, optionally add a prompt
                      to guide the motion, and let AI bring it to life.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Image Modes
                    </h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>
                        <strong className="text-white">Normal:</strong> Standard image-to-video conversion
                      </li>
                      <li>
                        <strong className="text-white">Pro:</strong> Professional quality with option to add a
                        tail image (ending frame)
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Settings Guide
                    </h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>
                        <strong className="text-white">Model:</strong> Choose between V1, V1.5, or V1.6 (latest)
                      </li>
                      <li>
                        <strong className="text-white">Mode:</strong> Standard for speed, Professional for quality
                      </li>
                      <li>
                        <strong className="text-white">Duration:</strong> 5 or 10 seconds
                      </li>
                      <li>
                        <strong className="text-white">CFG Scale:</strong> Lower = more creative, Higher = more
                        accurate to prompt
                      </li>
                      <li>
                        <strong className="text-white">Camera Control:</strong> Add dynamic camera movements
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">
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
    </div>
  );
}
