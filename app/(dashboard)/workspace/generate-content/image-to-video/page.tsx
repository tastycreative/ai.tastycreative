// app/(dashboard)/workspace/generate-content/image-to-video/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useApiClient } from "@/lib/apiClient";
import {
  Video,
  Upload,
  Wand2,
  Settings,
  Download,
  Share2,
  Loader2,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Sliders,
  RefreshCw,
  X,
  Play,
  Pause,
  ImageIcon,
} from "lucide-react";

// Types
interface GenerationParams {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  length: number;
  batchSize: number;
  steps: number;
  cfg: number;
  samplerName: string;
  scheduler: string;
  seed: number | null;
  uploadedImage: string | null;
}

interface GenerationJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  resultUrls?: string[];
  error?: string;
  createdAt?: Date | string;
  userId?: string;
  lastChecked?: string;
  comfyUIPromptId?: string;
}

interface DatabaseVideo {
  id: string;
  filename: string;
  subfolder: string;
  type: string;
  fileSize?: number;
  width?: number;
  height?: number;
  format?: string;
  url?: string;
  dataUrl?: string;
  createdAt: Date | string;
}

// Constants
const ASPECT_RATIOS = [
  { name: "Portrait", width: 480, height: 720, ratio: "2:3" },
  { name: "Square", width: 720, height: 720, ratio: "1:1" },
  { name: "Landscape", width: 720, height: 480, ratio: "3:2" },
  { name: "Wide", width: 1280, height: 720, ratio: "16:9" },
];

const SAMPLERS = [
  "euler",
  "euler_ancestral",
  "heun",
  "dpm_2",
  "dpm_2_ancestral",
  "lms",
  "dpm_fast",
  "dpm_adaptive",
];

const SCHEDULERS = [
  "simple",
  "normal",
  "karras",
  "exponential",
  "sgm_uniform",
  "ddim_uniform",
  "beta",
];

const formatJobTime = (createdAt: Date | string | undefined): string => {
  try {
    if (!createdAt) return "Unknown time";
    const date =
      typeof createdAt === "string" ? new Date(createdAt) : createdAt;
    if (isNaN(date.getTime())) return "Invalid time";
    return date.toLocaleTimeString();
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Unknown time";
  }
};

export default function ImageToVideoPage() {
  const apiClient = useApiClient();

  const [params, setParams] = useState<GenerationParams>({
    prompt: "",
    negativePrompt:
      "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走",
    width: 480,
    height: 720,
    length: 65,
    batchSize: 1,
    steps: 4,
    cfg: 1,
    samplerName: "euler",
    scheduler: "simple",
    seed: null,
    uploadedImage: null,
  });

  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [jobHistory, setJobHistory] = useState<GenerationJob[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<
    string | null
  >(null);

  // Video-specific states
  const [jobVideos, setJobVideos] = useState<Record<string, DatabaseVideo[]>>(
    {}
  );
  const [videoStats, setVideoStats] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize and fetch data
  useEffect(() => {
    if (!Array.isArray(jobHistory)) {
      setJobHistory([]);
    }
    fetchVideoStats();
  }, []);

  // Fetch video statistics
  const fetchVideoStats = async () => {
    if (!apiClient) return;

    try {
      const response = await apiClient.get("/api/videos?stats=true");

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVideoStats(data.stats);
          console.log("📊 Video stats:", data.stats);
        }
      }
    } catch (error) {
      console.error("Error fetching video stats:", error);
    }
  };

  // Fetch videos for a completed job
  const fetchJobVideos = async (jobId: string): Promise<boolean> => {
    if (!apiClient) return false;

    try {
      console.log("🎬 Fetching database videos for job:", jobId);

      const response = await apiClient.get(`/api/jobs/${jobId}/videos`);
      console.log("📡 Video fetch response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Failed to fetch job videos:",
          response.status,
          errorText
        );
        return false;
      }

      const data = await response.json();
      console.log("📊 Job videos data:", data);

      if (data.success && data.videos && Array.isArray(data.videos)) {
        setJobVideos((prev) => ({
          ...prev,
          [jobId]: data.videos,
        }));
        console.log(
          "✅ Updated job videos state for job:",
          jobId,
          "Videos count:",
          data.videos.length
        );
        return data.videos.length > 0;
      } else {
        console.warn("⚠️ Invalid response format:", data);
        return false;
      }
    } catch (error) {
      console.error("💥 Error fetching job videos:", error);
      return false;
    }
  };

  // Handle image upload
  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !apiClient) return;

    setIsUploading(true);

    try {
      console.log("=== UPLOADING IMAGE FOR I2V ===");
      console.log("File:", file.name, file.size, file.type);

      const formData = new FormData();
      formData.append("image", file);

      const response = await apiClient.postFormData(
        "/api/upload/image",
        formData
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upload failed:", response.status, errorText);
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      console.log("Upload result:", result);

      if (result.success && result.filename) {
        setParams((prev) => ({
          ...prev,
          uploadedImage: result.filename,
        }));

        // Create preview URL
        const previewUrl = URL.createObjectURL(file);
        setUploadedImagePreview(previewUrl);

        console.log("✅ Image uploaded successfully:", result.filename);
      } else {
        throw new Error("Upload succeeded but no filename returned");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert(
        "Failed to upload image: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Remove uploaded image
  const removeUploadedImage = () => {
    setParams((prev) => ({
      ...prev,
      uploadedImage: null,
    }));
    setUploadedImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Generate random seed
  const generateRandomSeed = () => {
    const seed = Math.floor(Math.random() * 1000000000);
    setParams((prev) => ({ ...prev, seed }));
  };

  // Handle aspect ratio change
  const handleAspectRatioChange = (width: number, height: number) => {
    setParams((prev) => ({ ...prev, width, height }));
  };

  // Create workflow JSON based on the provided ComfyUI workflow with fixed values
  const createWorkflowJson = (params: GenerationParams) => {
    const seed = params.seed || Math.floor(Math.random() * 1000000000);

    const workflow: any = {
      "6": {
        inputs: {
          text: params.prompt,
          clip: ["38", 0], // Direct connection to CLIPLoader
        },
        class_type: "CLIPTextEncode",
      },
      "7": {
        inputs: {
          text: params.negativePrompt,
          clip: ["38", 0], // Direct connection to CLIPLoader
        },
        class_type: "CLIPTextEncode",
      },
      "37": {
        inputs: {
          unet_name: "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
          weight_dtype: "default",
        },
        class_type: "UNETLoader",
      },
      "38": {
        inputs: {
          clip_name: "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
          type: "wan",
          device: "default",
        },
        class_type: "CLIPLoader",
      },
      "39": {
        inputs: {
          vae_name: "wan_2.1_vae.safetensors",
        },
        class_type: "VAELoader",
      },
      "48": {
        inputs: {
          model: ["89", 0], // Connected to LoRA high noise model
          shift: 8,
        },
        class_type: "ModelSamplingSD3",
      },
      "56": {
        inputs: {
          image: params.uploadedImage || "",
          upload: "image",
        },
        class_type: "LoadImage",
      },
      "65": {
        inputs: {
          image: ["56", 0],
          width: params.width,
          height: params.height,
          upscale_method: "nearest-exact",
          keep_proportion: "crop",
          pad_color: "0, 0, 0",
          crop_position: "center",
          divisible_by: 2,
          device: "cpu",
        },
        class_type: "ImageResizeKJv2",
      },
      "81": {
        inputs: {
          unet_name: "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
          weight_dtype: "default",
        },
        class_type: "UNETLoader",
      },
      "89": {
        inputs: {
          model: ["37", 0],
          lora_name:
            "lightx2v_14B_T2V_cfg_step_distill_lora_adaptive_rank_quantile_0.15_bf16.safetensors",
          strength_model: 2.5,
        },
        class_type: "LoraLoaderModelOnly",
      },
      "90": {
        inputs: {
          model: ["81", 0],
          lora_name:
            "Wan21_T2V_14B_lightx2v_cfg_step_distill_lora_rank32.safetensors",
          strength_model: 1.5,
        },
        class_type: "LoraLoaderModelOnly",
      },
      "91": {
        inputs: {
          noise_seed: seed,
          steps: params.steps,
          cfg: params.cfg,
          sampler_name: params.samplerName,
          scheduler: params.scheduler,
          denoise: 1,
          model: ["94", 0],
          positive: ["93", 0],
          negative: ["93", 1],
          latent_image: ["92", 0],
          add_noise: "disable",
          start_at_step: 2,
          end_at_step: 10000,
          return_with_leftover_noise: "disable",
        },
        class_type: "KSamplerAdvanced",
      },
      "92": {
        inputs: {
          noise_seed: seed,
          steps: params.steps,
          cfg: params.cfg,
          sampler_name: params.samplerName,
          scheduler: params.scheduler,
          denoise: 1,
          model: ["48", 0],
          positive: ["93", 0],
          negative: ["93", 1],
          latent_image: ["93", 2],
          add_noise: "enable",
          start_at_step: 0,
          end_at_step: 2,
          return_with_leftover_noise: "enable",
        },
        class_type: "KSamplerAdvanced",
      },
      "93": {
        inputs: {
          positive: ["6", 0],
          negative: ["7", 0],
          vae: ["39", 0], // Direct connection to VAELoader
          start_image: ["65", 0], // Direct connection to ImageResize
          width: params.width,
          height: params.height,
          length: params.length,
          batch_size: params.batchSize,
        },
        class_type: "WanImageToVideo",
      },
      "94": {
        inputs: {
          model: ["90", 0], // Connected to LoRA low noise model
          shift: 8,
        },
        class_type: "ModelSamplingSD3",
      },
      "8": {
        inputs: {
          samples: ["91", 0],
          vae: ["39", 0], // Direct connection to VAELoader
        },
        class_type: "VAEDecode",
      },
      "57": {
        inputs: {
          images: ["8", 0],
          fps: 16,
        },
        class_type: "CreateVideo",
      },
      "131": {
        inputs: {
          video: ["57", 0],
          filename_prefix: "video/ComfyUI/wan2.2",
          format: "auto",
          codec: "auto",
        },
        class_type: "SaveVideo",
      },
    };

    return workflow;
  };

  // Handle generation
  const handleGenerate = async () => {
    if (!apiClient) {
      alert("API client not ready. Please try again.");
      return;
    }

    if (!params.prompt.trim()) {
      alert("Please enter a prompt");
      return;
    }

    if (!params.uploadedImage) {
      alert("Please upload an image first");
      return;
    }

    setIsGenerating(true);
    setCurrentJob(null);

    try {
      console.log("=== STARTING I2V GENERATION ===");
      console.log("Generation params:", params);

      const workflow = createWorkflowJson(params);
      console.log("Created I2V workflow for submission");

      const response = await apiClient.post("/api/generate/image-to-video", {
        workflow,
        params,
      });

      console.log("I2V Generation API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("I2V Generation failed:", response.status, errorText);
        throw new Error(`Generation failed: ${response.status} - ${errorText}`);
      }

      const { jobId } = await response.json();
      console.log("Received I2V job ID:", jobId);

      if (!jobId) {
        throw new Error("No job ID received from server");
      }

      const newJob: GenerationJob = {
        id: jobId,
        status: "pending",
        createdAt: new Date(),
        progress: 0,
      };

      setCurrentJob(newJob);
      setJobHistory((prev) => [newJob, ...prev.filter(Boolean)]);

      // Start polling for job status
      pollJobStatus(jobId);
    } catch (error) {
      console.error("I2V Generation error:", error);
      setIsGenerating(false);
      alert(error instanceof Error ? error.message : "Generation failed");
    }
  };

  // Poll job status (similar to text-to-image but adapted for videos)
  const pollJobStatus = async (jobId: string) => {
    if (!apiClient) {
      console.error("API client not ready for polling");
      return;
    }

    console.log("=== STARTING I2V JOB POLLING ===");
    console.log("Polling I2V job ID:", jobId);

    const maxAttempts = 300; // 5 minutes for video generation
    let attempts = 0;

    const poll = async () => {
      if (!apiClient) return;

      try {
        attempts++;
        console.log(
          `Polling attempt ${attempts}/${maxAttempts} for I2V job ${jobId}`
        );

        const response = await apiClient.get(`/api/jobs/${jobId}`);
        console.log("I2V Job status response:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("I2V Job status error:", response.status, errorText);

          if (response.status === 404) {
            console.error("I2V Job not found - this might be a storage issue");
            if (attempts < 10) {
              setTimeout(poll, 2000);
              return;
            }
          }

          throw new Error(`Job status check failed: ${response.status}`);
        }

        const job = await response.json();
        console.log("I2V Job status data:", job);

        if (job.createdAt && typeof job.createdAt === "string") {
          job.createdAt = new Date(job.createdAt);
        }

        setCurrentJob(job);
        setJobHistory((prev) =>
          prev
            .map((j) => {
              if (j?.id === jobId) {
                return {
                  ...job,
                  createdAt: job.createdAt || j.createdAt,
                };
              }
              return j;
            })
            .filter(Boolean)
        );

        if (job.status === "completed") {
          console.log("I2V Job completed successfully!");
          setIsGenerating(false);

          // Fetch videos for completed job
          console.log("🔄 Attempting to fetch job videos...");
          const fetchSuccess = await fetchJobVideos(jobId);

          if (!fetchSuccess) {
            console.log("🔄 Retrying video fetch after delay...");
            setTimeout(() => {
              fetchJobVideos(jobId);
            }, 3000);
          }

          return;
        } else if (job.status === "failed") {
          console.log("I2V Job failed:", job.error);
          setIsGenerating(false);
          return;
        }

        // Continue polling
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000); // Longer interval for video generation
        } else {
          console.error("I2V Polling timeout reached");
          setIsGenerating(false);
          setCurrentJob((prev) =>
            prev
              ? {
                  ...prev,
                  status: "failed" as const,
                  error: "Polling timeout - generation may still be running",
                }
              : null
          );
        }
      } catch (error) {
        console.error("I2V Polling error:", error);

        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        } else {
          setIsGenerating(false);
          setCurrentJob((prev) =>
            prev
              ? {
                  ...prev,
                  status: "failed" as const,
                  error: "Failed to get job status",
                }
              : null
          );
        }
      }
    };

    setTimeout(poll, 2000);
  };

  // Download video
  const downloadVideo = async (video: DatabaseVideo) => {
    if (!apiClient) return;

    try {
      console.log("📥 Downloading video:", video.filename);

      if (video.dataUrl) {
        const response = await apiClient.get(video.dataUrl);

        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);

          const link = document.createElement("a");
          link.href = url;
          link.download = video.filename;
          link.click();

          URL.revokeObjectURL(url);
          console.log("✅ Database video downloaded");
          return;
        }
      }

      if (video.url) {
        const link = document.createElement("a");
        link.href = video.url;
        link.download = video.filename;
        link.click();
        console.log("✅ ComfyUI video downloaded");
        return;
      }

      throw new Error("No download URL available");
    } catch (error) {
      console.error("Error downloading video:", error);
      alert(
        "Failed to download video: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  // Share video
  const shareVideo = (video: DatabaseVideo) => {
    let urlToShare = "";

    if (video.dataUrl) {
      urlToShare = `${window.location.origin}${video.dataUrl}`;
    } else if (video.url) {
      urlToShare = video.url;
    } else {
      alert("No shareable URL available for this video");
      return;
    }

    navigator.clipboard.writeText(urlToShare);
    alert("Video URL copied to clipboard!");
  };

  // Show loading state while API client initializes
  if (!apiClient) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Initializing API client...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-rose-700 rounded-3xl shadow-2xl border border-purple-200 dark:border-purple-800 p-8 text-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30 shadow-lg">
              <div className="relative">
                <Video className="w-10 h-10 text-white drop-shadow-sm" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-rose-400 rounded-full flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-rose-800" />
                </div>
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2 drop-shadow-sm flex items-center space-x-3">
                <span>Image to Video</span>
                <span className="text-2xl">🎬</span>
              </h1>
              <p className="text-purple-100 text-lg font-medium opacity-90 mb-2">
                Transform static images into captivating videos with AI motion
              </p>
              <div className="flex items-center space-x-4 text-sm text-purple-100">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>WAN 2.2 AI</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-purple-300 rounded-full"></div>
                  <span>Smooth Motion</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-pink-300 rounded-full"></div>
                  <span>HD Quality</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 mb-1">
                  <Video className="w-4 h-4 text-pink-300" />
                  <span className="text-sm font-semibold text-white">
                    Video AI
                  </span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-200 font-medium">
                    Ready
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Enhanced Image Upload */}
          <div className="group bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
                  <ImageIcon className="w-6 h-6 text-white" />
                </div>
                <span>Source Image</span>
                <div className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                  Required
                </div>
              </h3>
            </div>

            {!uploadedImagePreview ? (
              <div
                className="relative border-2 border-dashed border-purple-300 dark:border-purple-600 rounded-2xl p-12 text-center cursor-pointer hover:border-purple-400 dark:hover:border-purple-500 transition-all duration-300 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 group-hover:scale-105"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-100/50 to-pink-100/50 dark:from-purple-800/20 dark:to-pink-800/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>

                {isUploading ? (
                  <div className="relative flex flex-col items-center space-y-4">
                    <div className="relative">
                      <Loader2 className="w-16 h-16 animate-spin text-purple-500" />
                      <div className="absolute inset-0 w-16 h-16 border-4 border-purple-200 dark:border-purple-700 rounded-full animate-ping"></div>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-purple-700 dark:text-purple-300 mb-1">
                        Uploading Your Image
                      </p>
                      <p className="text-sm text-purple-600 dark:text-purple-400">
                        Preparing for video transformation...
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative flex flex-col items-center space-y-4">
                    <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                      <Upload className="w-10 h-10 text-white" />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        Upload Your Image
                      </p>
                      <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-3">
                        Choose the image you want to bring to life with AI
                        motion
                      </p>
                      <div className="flex items-center justify-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg px-3 py-1">
                          PNG, JPG, WebP
                        </div>
                        <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg px-3 py-1">
                          Max 10MB
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative group">
                <div className="relative overflow-hidden rounded-2xl shadow-lg">
                  <img
                    src={uploadedImagePreview}
                    alt="Uploaded image"
                    className="w-full max-h-80 object-contain bg-gray-50 dark:bg-gray-900 transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="absolute bottom-4 left-4 right-4 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-lg font-semibold mb-1">
                      Ready for Animation
                    </p>
                    <p className="text-sm opacity-90">
                      This image will be transformed into a video
                    </p>
                  </div>
                </div>
                <button
                  onClick={removeUploadedImage}
                  className="absolute top-3 right-3 p-2 bg-red-500/90 backdrop-blur-sm text-white rounded-xl hover:bg-red-600 transition-all duration-200 shadow-lg hover:scale-110"
                  title="Remove image"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">
                      Image uploaded: {params.uploadedImage}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={isUploading}
            />
          </div>

          {/* Enhanced Prompt Input */}
          <div className="group bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-300">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <label className="text-xl font-bold text-gray-900 dark:text-white flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl">
                    <Wand2 className="w-5 h-5 text-white" />
                  </div>
                  <span>Video Motion Prompt</span>
                  <div className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
                    Optional
                  </div>
                </label>
                <button
                  onClick={() => setParams((prev) => ({ ...prev, prompt: "" }))}
                  className="text-sm text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 font-medium transition-colors"
                >
                  Clear
                </button>
              </div>

              <div className="relative">
                <textarea
                  value={params.prompt}
                  onChange={(e) =>
                    setParams((prev) => ({ ...prev, prompt: e.target.value }))
                  }
                  placeholder="Describe the motion and animation you want to see... e.g., 'gentle wind blowing through hair, camera slowly zooming in, soft lighting changes'"
                  className="w-full h-32 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-300 text-sm leading-relaxed"
                  maxLength={500}
                />
                {params.prompt && (
                  <div className="absolute top-3 right-3">
                    <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-lg text-xs font-medium">
                      Ready ✓
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center">
                <div
                  className={`text-sm font-medium transition-colors ${
                    params.prompt.length > 400
                      ? "text-red-500"
                      : params.prompt.length > 250
                      ? "text-yellow-500"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {params.prompt.length}/500 characters
                </div>

                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                    <span className="font-medium">Pro Tip:</span>
                  </div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Leave blank for natural motion
                  </span>
                </div>
              </div>

              {/* Enhanced Negative Prompt */}
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <label className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-white" />
                    </div>
                    <span>Avoid in Video</span>
                    <div className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-xs font-medium">
                      Optional
                    </div>
                  </label>
                </div>

                <div className="relative">
                  <textarea
                    value={params.negativePrompt}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        negativePrompt: e.target.value,
                      }))
                    }
                    placeholder="Describe motions or effects you want to avoid... e.g., 'shaky camera, blurry motion, distorted faces, flickering'"
                    className="w-full h-24 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-4 focus:ring-red-500/20 focus:border-red-500 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-300 text-sm leading-relaxed"
                    maxLength={300}
                  />
                  {params.negativePrompt && (
                    <div className="absolute top-3 right-3">
                      <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-lg text-xs font-medium">
                        Filtering ⚠️
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {params.negativePrompt.length}/300 characters
                </div>
              </div>
            </div>
          </div>

          {/* Video Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Video Settings
            </h3>

            {/* Aspect Ratio */}
            <div className="space-y-3 mb-6">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.name}
                    onClick={() =>
                      handleAspectRatioChange(ratio.width, ratio.height)
                    }
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                      params.width === ratio.width &&
                      params.height === ratio.height
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <div>{ratio.name}</div>
                    <div className="text-xs opacity-75">{ratio.ratio}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Video Length */}
            <div className="space-y-3 mb-6">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Video Length (frames): {params.length}
              </label>
              <input
                type="range"
                min="16"
                max="120"
                value={params.length}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    length: parseInt(e.target.value),
                  }))
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>16 frames (~1s)</span>
                <span>120 frames (~7.5s)</span>
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
            >
              <Sliders className="w-4 h-4" />
              <span>{showAdvanced ? "Hide" : "Show"} Advanced Settings</span>
            </button>

            {/* Advanced Settings */}
            {showAdvanced && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-6">
                {/* Steps */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Steps: {params.steps}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={params.steps}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        steps: parseInt(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>

                {/* CFG */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    CFG Scale: {params.cfg}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={params.cfg}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        cfg: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>

                {/* Sampler */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sampler
                  </label>
                  <select
                    value={params.samplerName}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        samplerName: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {SAMPLERS.map((sampler) => (
                      <option key={sampler} value={sampler}>
                        {sampler}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scheduler */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Scheduler
                  </label>
                  <select
                    value={params.scheduler}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        scheduler: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {SCHEDULERS.map((scheduler) => (
                      <option key={scheduler} value={scheduler}>
                        {scheduler}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Seed */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Seed (Optional)
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={params.seed || ""}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          seed: e.target.value
                            ? parseInt(e.target.value)
                            : null,
                        }))
                      }
                      placeholder="Random"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <button
                      onClick={generateRandomSeed}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={
              isGenerating || !params.prompt.trim() || !params.uploadedImage
            }
            className="w-full py-4 px-6 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center space-x-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating Video...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                <span>Generate Video</span>
              </>
            )}
          </button>
        </div>

        {/* Right Panel - Results */}
        <div className="space-y-6">
          {/* Video Statistics */}
          {videoStats && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Your Video Library
              </h3>
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Total Videos:
                  </span>
                  <span className="ml-2 font-medium">
                    {videoStats.totalVideos}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Total Size:
                  </span>
                  <span className="ml-2 font-medium">
                    {Math.round((videoStats.totalSize / 1024 / 1024) * 100) /
                      100}{" "}
                    MB
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Current Generation */}
          {currentJob && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Current Generation
                </h3>
                {currentJob.status === "completed" && (
                  <button
                    onClick={() => fetchJobVideos(currentJob.id)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Refresh generated videos"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Status
                  </span>
                  <div className="flex items-center space-x-2">
                    {(currentJob.status === "pending" ||
                      currentJob.status === "processing") && (
                      <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                    )}
                    {currentJob.status === "completed" && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    {currentJob.status === "failed" && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium capitalize">
                      {currentJob.status}
                    </span>
                  </div>
                </div>

                {currentJob.progress !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Progress
                      </span>
                      <span className="text-sm font-medium">
                        {currentJob.progress}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-pink-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${currentJob.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Video Display */}
                {((currentJob.resultUrls && currentJob.resultUrls.length > 0) ||
                  (jobVideos[currentJob.id] &&
                    jobVideos[currentJob.id].length > 0)) && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Generated Videos
                    </h4>

                    <div className="grid grid-cols-1 gap-3">
                      {/* Show database videos if available */}
                      {jobVideos[currentJob.id] &&
                      jobVideos[currentJob.id].length > 0
                        ? jobVideos[currentJob.id].map((dbVideo, index) => (
                            <div
                              key={`db-${dbVideo.id}`}
                              className="relative group"
                            >
                              <video
                                ref={videoRef}
                                controls
                                className="w-full rounded-lg shadow-md hover:shadow-lg transition-shadow"
                                poster="/video-placeholder.jpg"
                              >
                                <source
                                  src={dbVideo.dataUrl || dbVideo.url}
                                  type="video/mp4"
                                />
                                Your browser does not support the video tag.
                              </video>
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() => downloadVideo(dbVideo)}
                                    className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
                                    title={`Download ${dbVideo.filename}`}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => shareVideo(dbVideo)}
                                    className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Video metadata */}
                              <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                                  {dbVideo.width && dbVideo.height
                                    ? `${dbVideo.width}×${dbVideo.height}`
                                    : "Unknown size"}
                                  {dbVideo.fileSize &&
                                    ` • ${
                                      Math.round(
                                        (dbVideo.fileSize / 1024 / 1024) * 100
                                      ) / 100
                                    }MB`}
                                </div>
                              </div>
                            </div>
                          ))
                        : // Fallback to legacy URLs
                          currentJob.resultUrls &&
                          currentJob.resultUrls.length > 0 &&
                          currentJob.resultUrls.map((url, index) => (
                            <div
                              key={`legacy-${currentJob.id}-${index}`}
                              className="relative group"
                            >
                              <video
                                controls
                                className="w-full rounded-lg shadow-md hover:shadow-lg transition-shadow"
                                poster="/video-placeholder.jpg"
                              >
                                <source src={url} type="video/mp4" />
                                Your browser does not support the video tag.
                              </video>
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() => {
                                      const link = document.createElement("a");
                                      link.href = url;
                                      link.download = `generated-video-${
                                        index + 1
                                      }.mp4`;
                                      link.click();
                                    }}
                                    className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(url);
                                      alert("Video URL copied to clipboard!");
                                    }}
                                    className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                    </div>
                  </div>
                )}

                {/* Loading message for completed jobs without videos */}
                {currentJob.status === "completed" &&
                  (!currentJob.resultUrls ||
                    currentJob.resultUrls.length === 0) &&
                  (!jobVideos[currentJob.id] ||
                    jobVideos[currentJob.id].length === 0) && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Generated Videos
                      </h4>
                      <div className="text-center py-8">
                        <div className="flex items-center justify-center space-x-2 text-gray-500 dark:text-gray-400 mb-3">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span className="text-sm">
                            Loading generated videos...
                          </span>
                        </div>
                        <button
                          onClick={() => fetchJobVideos(currentJob.id)}
                          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm"
                        >
                          Refresh Videos
                        </button>
                      </div>
                    </div>
                  )}

                {currentJob.error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {currentJob.error}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Generation History */}
          {jobHistory.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Recent Generations
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {jobHistory
                  .filter((job) => job && job.id)
                  .slice(0, 10)
                  .map((job, index) => (
                    <div
                      key={job.id || `job-${index}`}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        {job.status === "completed" && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        {job.status === "failed" && (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        {(job.status === "pending" ||
                          job.status === "processing") && (
                          <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatJobTime(job.createdAt)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {job.status || "unknown"}
                          </p>
                        </div>
                      </div>
                      {job.resultUrls && job.resultUrls.length > 0 && (
                        <div className="flex space-x-1">
                          <button
                            onClick={() => fetchJobVideos(job.id)}
                            className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                            title="Refresh videos"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                      )}
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
