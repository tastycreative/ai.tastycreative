// app/(dashboard)/workspace/generate-content/style-transfer/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useApiClient } from "@/lib/apiClient";
import MaskEditor from "@/components/MaskEditor";
import {
  ImageIcon,
  Wand2,
  Settings,
  Download,
  Share2,
  Loader2,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Sliders,
  Copy,
  RefreshCw,
  Upload,
  X,
  Image as ImageIconLucide,
  Palette,
  Monitor,
  Eye,
  Users,
} from "lucide-react";

// Types
interface StyleTransferParams {
  prompt: string;
  width: number;
  height: number;
  batchSize: number;
  steps: number;
  cfg: number;
  samplerName: string;
  scheduler: string;
  guidance: number;
  loraStrength: number;
  selectedLora: string;
  seed: number | null;
  // Style transfer specific params
  weight: number;
  mode: string;
  downsamplingFactor: number;
  downsamplingFunction: string;
  autocropMargin: number;
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

interface LoRAModel {
  fileName: string;
  displayName: string;
  name: string;
}

interface DatabaseImage {
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
  { name: "Portrait", width: 832, height: 1216, ratio: "2:3" },
  { name: "Square", width: 1024, height: 1024, ratio: "1:1" },
  { name: "Landscape", width: 1216, height: 832, ratio: "3:2" },
  { name: "Wide", width: 1344, height: 768, ratio: "16:9" },
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
  "normal",
  "karras",
  "exponential",
  "sgm_uniform",
  "simple",
  "ddim_uniform",
  "beta",
];

const STYLE_MODES = ["center crop (square)", "resize", "crop", "pad"];

const DOWNSAMPLING_FUNCTIONS = ["area", "bicubic", "bilinear", "nearest"];

const formatJobTime = (createdAt: Date | string | undefined): string => {
  try {
    if (!createdAt) {
      return "Unknown time";
    }

    const date =
      typeof createdAt === "string" ? new Date(createdAt) : createdAt;

    if (isNaN(date.getTime())) {
      return "Invalid time";
    }

    return date.toLocaleTimeString();
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Unknown time";
  }
};

export default function StyleTransferPage() {
  const apiClient = useApiClient();

  const [params, setParams] = useState<StyleTransferParams>({
    prompt: "",
    width: 832,
    height: 1216,
    batchSize: 1,
    steps: 40,
    cfg: 1,
    samplerName: "euler",
    scheduler: "beta",
    guidance: 3.5,
    loraStrength: 0.95,
    selectedLora: "AI MODEL 3.safetensors",
    seed: null,
    // Style transfer specific
    weight: 0.8,
    mode: "center crop (square)",
    downsamplingFactor: 1,
    downsamplingFunction: "area",
    autocropMargin: 0.1,
  });

  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [jobHistory, setJobHistory] = useState<GenerationJob[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [availableLoRAs, setAvailableLoRAs] = useState<LoRAModel[]>([
    {
      fileName: "AI MODEL 3.safetensors",
      displayName: "AI MODEL 3",
      name: "ai_model_3",
    },
  ]);
  const [loadingLoRAs, setLoadingLoRAs] = useState(true);

  // Style transfer specific states
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<
    string | null
  >(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [maskData, setMaskData] = useState<string | null>(null);
  const [showMaskEditor, setShowMaskEditor] = useState(false);
  const [uploadedImageFilename, setUploadedImageFilename] = useState<
    string | null
  >(null);

  // Database image states
  const [jobImages, setJobImages] = useState<Record<string, DatabaseImage[]>>(
    {}
  );
  const [imageStats, setImageStats] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize empty job history on mount
  useEffect(() => {
    if (!Array.isArray(jobHistory)) {
      setJobHistory([]);
    }
  }, []);

  // Fetch image stats on mount
  useEffect(() => {
    fetchImageStats();
  }, []);

  // Handle reference image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert("Please select a valid image file");
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert("Image size must be less than 10MB");
        return;
      }

      setReferenceImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setReferenceImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    setReferenceImagePreview(null);
    setMaskData(null);
    setShowMaskEditor(false);
    setUploadedImageFilename(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle mask updates from the mask editor
  const handleMaskUpdate = (maskDataUrl: string | null) => {
    setMaskData(maskDataUrl);
    console.log("🎭 Mask updated:", maskDataUrl ? "Has mask data" : "No mask");
  };

  // Function to fetch images for a completed job
  const fetchJobImages = async (jobId: string): Promise<boolean> => {
    if (!apiClient) return false;

    try {
      console.log("🖼️ Fetching database images for job:", jobId);

      const response = await apiClient.get(`/api/jobs/${jobId}/images`);
      console.log("📡 Image fetch response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Failed to fetch job images:",
          response.status,
          errorText
        );
        return false;
      }

      const data = await response.json();
      console.log("📊 Job images data:", data);

      if (data.success && data.images && Array.isArray(data.images)) {
        setJobImages((prev) => ({
          ...prev,
          [jobId]: data.images,
        }));
        console.log(
          "✅ Updated job images state for job:",
          jobId,
          "Images count:",
          data.images.length
        );
        return data.images.length > 0;
      } else {
        console.warn("⚠️ Invalid response format:", data);
        return false;
      }
    } catch (error) {
      console.error("💥 Error fetching job images:", error);
      return false;
    }
  };

  // Function to fetch user image statistics
  const fetchImageStats = async () => {
    if (!apiClient) return;

    try {
      const response = await apiClient.get("/api/images?stats=true");

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setImageStats(data.stats);
          console.log("📊 Image stats:", data.stats);
        }
      }
    } catch (error) {
      console.error("Error fetching image stats:", error);
    }
  };

  // Function to download image with dynamic URL support
  const downloadDatabaseImage = async (image: DatabaseImage) => {
    if (!apiClient) return;

    try {
      console.log("📥 Downloading image:", image.filename);

      if (image.dataUrl) {
        const response = await apiClient.get(image.dataUrl);

        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);

          const link = document.createElement("a");
          link.href = url;
          link.download = image.filename;
          link.click();

          URL.revokeObjectURL(url);
          console.log("✅ Database image downloaded");
          return;
        }
      }

      if (image.url) {
        const link = document.createElement("a");
        link.href = image.url;
        link.download = image.filename;
        link.click();
        console.log("✅ ComfyUI image downloaded");
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

  // Fetch available LoRA models on component mount
  useEffect(() => {
    const fetchLoRAModels = async () => {
      if (!apiClient) return;

      try {
        setLoadingLoRAs(true);
        console.log("=== FETCHING LORA MODELS ===");

        const response = await apiClient.get("/api/models/loras");
        console.log("LoRA API response status:", response.status);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("LoRA API response data:", data);

        if (data.success && data.models && Array.isArray(data.models)) {
          console.log("Available LoRA models:", data.models);
          setAvailableLoRAs(data.models);

          // Set default LoRA for style transfer (AI MODEL 3)
          const aiModel3 = data.models.find(
            (lora: LoRAModel) => lora.fileName === "AI MODEL 3.safetensors"
          );
          if (aiModel3) {
            setParams((prev) => ({
              ...prev,
              selectedLora: aiModel3.fileName,
            }));
          } else {
            const defaultLora = data.models[0]?.fileName || "None";
            setParams((prev) => ({
              ...prev,
              selectedLora: defaultLora,
            }));
          }
        } else {
          console.error("Invalid LoRA API response:", data);
          setAvailableLoRAs([
            {
              fileName: "AI MODEL 3.safetensors",
              displayName: "AI MODEL 3",
              name: "ai_model_3",
            },
          ]);
        }
      } catch (error) {
        console.error("Error fetching LoRA models:", error);
        setAvailableLoRAs([
          {
            fileName: "AI MODEL 3.safetensors",
            displayName: "AI MODEL 3",
            name: "ai_model_3",
          },
        ]);
      } finally {
        setLoadingLoRAs(false);
      }
    };

    fetchLoRAModels();
  }, [apiClient]);

  const generateRandomSeed = () => {
    const seed = Math.floor(Math.random() * 1000000000);
    setParams((prev) => ({ ...prev, seed }));
  };

  const handleAspectRatioChange = (width: number, height: number) => {
    setParams((prev) => ({ ...prev, width, height }));
  };

  // Upload reference image to server
  const uploadReferenceImageToServer = async (
    file: File,
    maskDataUrl?: string | null
  ): Promise<{ filename: string; maskFilename?: string; base64?: string; maskBase64?: string; dataUrl?: string; maskDataUrl?: string }> => {
    if (!apiClient) throw new Error("API client not ready");

    const formData = new FormData();
    formData.append("image", file);

    // Add mask data if present
    if (maskDataUrl) {
      // Convert data URL to blob
      const maskResponse = await fetch(maskDataUrl);
      const maskBlob = await maskResponse.blob();
      formData.append("mask", maskBlob, "mask.png");
    }

    setUploadingImage(true);

    try {
      const response = await apiClient.postFormData(
        "/api/upload/image",
        formData
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload image");
      }

      const data = await response.json();
      console.log("✅ Image uploaded successfully:", data);

      return {
        filename: data.filename,
        maskFilename: data.maskFilename,
        base64: data.base64,
        maskBase64: data.maskBase64,
        dataUrl: data.dataUrl,
        maskDataUrl: data.maskDataUrl,
      };
    } catch (error) {
      console.error("💥 Error uploading image:", error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  // Submit generation - Updated for serverless
  const handleGenerate = async () => {
    if (!apiClient) {
      alert("API client not ready. Please try again.");
      return;
    }

    if (!params.prompt.trim()) {
      alert("Please enter a prompt");
      return;
    }

    if (!referenceImage) {
      alert("Please select a reference image for style transfer");
      return;
    }

    setIsGenerating(true);
    setCurrentJob(null);

    try {
      console.log("=== STARTING STYLE TRANSFER GENERATION (SERVERLESS) ===");
      console.log("Generation params:", params);

      // Upload reference image first
      console.log("📤 Uploading reference image...");
      const uploadResult = await uploadReferenceImageToServer(
        referenceImage,
        maskData
      );
      console.log("✅ Reference image uploaded:", uploadResult.filename);
      if (uploadResult.maskFilename) {
        console.log("✅ Mask uploaded:", uploadResult.maskFilename);
      }

      const workflow = createWorkflowJson(
        params,
        uploadResult.filename,
        uploadResult.maskFilename
      );
      console.log("Created style transfer workflow for serverless submission");

      // Submit to serverless API endpoint instead of local ComfyUI
      const response = await apiClient.post("/api/generate/serverless", {
        workflow,
        params,
        action: "generate_style_transfer",
        generation_type: "style_transfer",
        referenceImage: uploadResult.filename,
        maskImage: uploadResult.maskFilename,
        // Include base64 data for direct use by RunPod
        referenceImageData: uploadResult.base64,
        maskImageData: uploadResult.maskBase64,
      });

      console.log("Serverless API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Serverless generation failed:",
          response.status,
          errorText
        );
        throw new Error(
          `Serverless generation failed: ${response.status} - ${errorText}`
        );
      }

      const { jobId } = await response.json();
      console.log("Received serverless job ID:", jobId);

      if (!jobId) {
        throw new Error("No job ID received from serverless endpoint");
      }

      const newJob: GenerationJob = {
        id: jobId,
        status: "pending",
        createdAt: new Date(),
        progress: 0,
      };

      setCurrentJob(newJob);
      setJobHistory((prev) => [newJob, ...prev.filter(Boolean)]);

      // Start polling for job status (serverless webhooks + polling)
      pollJobStatus(jobId);
    } catch (error) {
      console.error("Serverless generation error:", error);
      setIsGenerating(false);
      alert(
        error instanceof Error ? error.message : "Serverless generation failed"
      );
    }
  };

  // Updated poll job status for serverless with database image fetching
  const pollJobStatus = async (jobId: string) => {
    if (!apiClient) {
      console.error("API client not ready for polling");
      return;
    }

    console.log("=== STARTING SERVERLESS STYLE TRANSFER JOB POLLING ===");
    console.log("Polling serverless style transfer job ID:", jobId);

    const maxAttempts = 180; // 6 minutes for serverless style transfer (webhooks handle most updates)
    let attempts = 0;

    const poll = async () => {
      if (!apiClient) return;

      try {
        attempts++;
        console.log(
          `📡 Polling attempt ${attempts}/${maxAttempts} for serverless job: ${jobId}`
        );

        const response = await apiClient.get(`/api/jobs/${jobId}/status`);

        if (response.ok) {
          const jobStatus = await response.json();
          console.log("📊 Serverless job status:", jobStatus);

          const updatedJob: GenerationJob = {
            id: jobId,
            status: jobStatus.status || "pending",
            progress: jobStatus.progress || 0,
            error: jobStatus.error,
            createdAt: currentJob?.createdAt || new Date(),
            lastChecked: new Date().toISOString(),
            comfyUIPromptId: jobStatus.comfyUIPromptId,
          };

          setCurrentJob(updatedJob);

          // Update job history
          setJobHistory((prev) =>
            prev.map((job) => (job.id === jobId ? updatedJob : job))
          );

          if (jobStatus.status === "completed") {
            console.log("🎉 Serverless style transfer job completed!");

            // Fetch database images for completed job
            const imagesLoaded = await fetchJobImages(jobId);
            console.log("📸 Database images loaded:", imagesLoaded);

            // Refresh image stats
            await fetchImageStats();

            setIsGenerating(false);
            console.log(
              "✅ Serverless style transfer polling completed successfully"
            );
            return;
          } else if (jobStatus.status === "failed") {
            console.error(
              "💥 Serverless style transfer job failed:",
              jobStatus.error
            );
            setIsGenerating(false);
            alert(`Serverless style transfer failed: ${jobStatus.error}`);
            return;
          }
        } else {
          console.warn(`⚠️ Status check failed: ${response.status}`);
        }
      } catch (error) {
        console.error("💥 Polling error:", error);
      }

      // Continue polling if not complete and within limits
      if (attempts < maxAttempts) {
        setTimeout(poll, 3000); // Poll every 3 seconds for serverless
      } else {
        console.error("❌ Serverless style transfer polling timeout");
        setIsGenerating(false);
        alert(
          "Style transfer generation timeout - please check your job status"
        );
      }
    };

    // Start polling after 3 seconds (give serverless time to start)
    setTimeout(poll, 3000);
  };

  // Create workflow JSON for style transfer - matches your ComfyUI workflow exactly
  const createWorkflowJson = (
    params: StyleTransferParams,
    imageFilename: string,
    maskFilename?: string
  ) => {
    const seed = params.seed || Math.floor(Math.random() * 1000000000);

    const workflow: any = {
      "8": {
        inputs: {
          samples: ["31", 0],
          vae: ["50", 0],
        },
        class_type: "VAEDecode",
      },
      "154": {
        inputs: {
          filename_prefix: "ComfyUI",
          images: ["8", 0],
        },
        class_type: "SaveImage",
      },
      "33": {
        inputs: {
          text: "", // Negative prompt - empty for style transfer
          clip: ["51", 1],
        },
        class_type: "CLIPTextEncode",
      },
      "31": {
        inputs: {
          model: ["51", 0],
          positive: ["41", 0],
          negative: ["33", 0],
          latent_image: ["27", 0],
          seed: seed,
          steps: params.steps,
          cfg: params.cfg,
          sampler_name: params.samplerName,
          scheduler: params.scheduler,
          denoise: 1,
        },
        class_type: "KSampler",
      },
      "37": {
        inputs: {
          unet_name: "flux1-dev.safetensors",
          weight_dtype: "fp8_e4m3fn",
        },
        class_type: "UNETLoader",
      },
      "51": {
        inputs: {
          model: ["37", 0],
          clip: ["38", 0],
          lora_name: params.selectedLora,
          strength_model: params.loraStrength,
          strength_clip: 1,
        },
        class_type: "LoraLoader",
      },
      "38": {
        inputs: {
          clip_name1: "t5xxl_fp16.safetensors",
          clip_name2: "ViT-L-14-TEXT-detail-improved-hiT-GmP-HF.safetensors",
          type: "flux",
          device: "default",
        },
        class_type: "DualCLIPLoader",
      },
      "42": {
        inputs: {
          style_model_name: "flux1-redux-dev.safetensors",
        },
        class_type: "StyleModelLoader",
      },
      "43": {
        inputs: {
          clip_name: "model.safetensors",
        },
        class_type: "CLIPVisionLoader",
      },
      "44": {
        inputs: {
          clip_vision: ["43", 0],
          image: ["155", 0],
        },
        class_type: "CLIPVisionEncode",
      },
      "44_redux": {
        inputs: {
          conditioning: ["6", 0], // Text conditioning
          style_model: ["42", 0], // Style model
          clip_vision_output: ["44", 0], // Image conditioning
          strength: params.weight,
          strength_type: "multiply",
        },
        class_type: "StyleModelApplyAdvanced",
      },
      "50": {
        inputs: {
          vae_name: "ae.safetensors",
        },
        class_type: "VAELoader",
      },
      "41": {
        inputs: {
          conditioning: ["44_redux", 0],
          guidance: params.guidance,
        },
        class_type: "FluxGuidance",
      },
      "27": {
        inputs: {
          width: params.width,
          height: params.height,
          batch_size: params.batchSize,
        },
        class_type: "EmptySD3LatentImage",
      },
      "6": {
        inputs: {
          text: params.prompt,
          clip: ["51", 1],
        },
        class_type: "CLIPTextEncode",
      },
      "155": {
        inputs: {
          image: imageFilename,
        },
        class_type: "LoadImage",
      },
    };

    // Add mask processing nodes if mask is provided
    if (maskFilename) {
      // Load mask image
      workflow["156"] = {
        inputs: {
          image: maskFilename,
        },
        class_type: "LoadImage",
      };

      // Convert image to mask (takes the red channel and converts to mask)
      workflow["157"] = {
        inputs: {
          image: ["156", 0],
          channel: "red", // Use red channel for mask
        },
        class_type: "ImageToMask",
      };
    }

    return workflow;
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
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Enhanced Header */}
        <div className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 p-1">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Palette className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">
                    AI Style Transfer
                  </h1>
                  <p className="text-purple-100 text-lg">
                    Transform your images with artistic styles using FLUX Redux
                  </p>
                </div>
              </div>

              {/* Status Indicators */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 bg-white/20 rounded-lg px-3 py-2">
                  <Monitor className="w-4 h-4 text-white" />
                  <span className="text-white text-sm font-medium">
                    FLUX Redux
                  </span>
                </div>
                <div className="flex items-center space-x-2 bg-white/20 rounded-lg px-3 py-2">
                  <Eye className="w-4 h-4 text-white" />
                  <span className="text-white text-sm font-medium">
                    {isGenerating ? "Generating..." : "Ready"}
                  </span>
                </div>
                <div className="flex items-center space-x-2 bg-white/20 rounded-lg px-3 py-2">
                  <Users className="w-4 h-4 text-white" />
                  <span className="text-white text-sm font-medium">Pro</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Reference Image Upload */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center">
                <Palette className="w-5 h-5 mr-2 text-pink-600" />
                Style Reference Image
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Upload your reference image for style transfer
                  </label>
                  {referenceImage && (
                    <button
                      onClick={removeReferenceImage}
                      className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {!referenceImagePreview ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 border-slate-300 hover:border-pink-400 hover:bg-pink-50/50 dark:border-slate-600 dark:hover:border-pink-500 dark:hover:bg-pink-900/20 cursor-pointer group"
                  >
                    <div className="w-16 h-16 mx-auto bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center group-hover:bg-pink-200 dark:group-hover:bg-pink-900/50 transition-colors mb-4">
                      <Upload className="w-8 h-8 text-pink-600 dark:text-pink-400" />
                    </div>
                    <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Upload Style Reference Image
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Choose an image whose artistic style you want to apply
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                      Supports PNG, JPG, WebP (max 10MB)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Image Preview and Mask Editor Toggle */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Reference Image {maskData && "(Masked)"}
                      </h3>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setShowMaskEditor(!showMaskEditor)}
                          className={`px-4 py-2 text-sm rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                            showMaskEditor
                              ? "bg-purple-600 text-white shadow-md"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                          }`}
                        >
                          <Wand2 className="w-4 h-4" />
                          <span>
                            {showMaskEditor ? "Hide Mask Editor" : "Edit Mask"}
                          </span>
                        </button>
                        <button
                          onClick={removeReferenceImage}
                          className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                        >
                          <X className="w-4 h-4" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>

                    {/* Mask Editor or Simple Preview */}
                    {showMaskEditor ? (
                      <MaskEditor
                        imageUrl={referenceImagePreview}
                        onMaskUpdate={handleMaskUpdate}
                        className="w-full"
                      />
                    ) : (
                      <div className="relative group">
                        <img
                          src={referenceImagePreview}
                          alt="Reference"
                          className="w-full h-64 object-cover rounded-xl shadow-md group-hover:shadow-lg transition-shadow"
                        />
                        {maskData && (
                          <div className="absolute top-3 right-3 bg-purple-600 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg">
                            🎭 Masked
                          </div>
                        )}
                        {uploadingImage && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-xl backdrop-blur-sm">
                            <div className="flex items-center space-x-3 text-white bg-black/30 px-4 py-2 rounded-lg">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Uploading...</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mask Status */}
                    {maskData && (
                      <div className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                        ✅ Mask applied - Only white areas will be
                        style-transferred
                      </div>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Prompt Input */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-lg font-semibold text-slate-800 dark:text-white flex items-center">
                    <Sparkles className="w-5 h-5 mr-2 text-indigo-600" />
                    Style Description
                  </label>
                  <button
                    onClick={() =>
                      setParams((prev) => ({ ...prev, prompt: "" }))
                    }
                    className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    Clear
                  </button>
                </div>
                <textarea
                  value={params.prompt}
                  onChange={(e) =>
                    setParams((prev) => ({ ...prev, prompt: e.target.value }))
                  }
                  placeholder="Describe the artistic style you want to apply (e.g., 'oil painting style with thick brushstrokes and vibrant colors')"
                  className="w-full h-32 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
                <div className="flex justify-between items-center">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {params.prompt.length}/1000 characters
                  </div>
                  <div className="text-xs text-indigo-600 dark:text-indigo-400">
                    💡 Tip: Be specific about the artistic style you want
                  </div>
                </div>
              </div>
            </div>

            {/* Basic Settings */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center">
                <Sliders className="w-5 h-5 mr-2 text-indigo-600" />
                Style Transfer Settings
              </h3>

              {/* Style Weight */}
              <div className="space-y-4 mb-6 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl">
                <label className="text-sm font-semibold text-slate-800 dark:text-white flex items-center">
                  <Sliders className="w-4 h-4 mr-2 text-indigo-600" />
                  Style Weight:{" "}
                  <span className="ml-2 text-indigo-600 font-bold">
                    {params.weight}
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={params.weight}
                  onChange={(e) =>
                    setParams((prev) => ({
                      ...prev,
                      weight: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer slider-thumb"
                />
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span>💫 Subtle</span>
                  <span>🎨 Strong</span>
                </div>
              </div>

              {/* Style Mode */}
              <div className="space-y-3 mb-6">
                <label className="text-sm font-semibold text-slate-800 dark:text-white flex items-center">
                  <Settings className="w-4 h-4 mr-2 text-purple-600" />
                  Style Mode
                </label>
                <select
                  value={params.mode}
                  onChange={(e) =>
                    setParams((prev) => ({
                      ...prev,
                      mode: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {STYLE_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>

              {/* LoRA Model Selection */}
              <div className="space-y-3 mb-6">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  LoRA Model
                </label>

                {loadingLoRAs ? (
                  <div className="flex items-center space-x-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-gray-500">
                      Loading LoRA models...
                    </span>
                  </div>
                ) : (
                  <select
                    value={params.selectedLora}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        selectedLora: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {availableLoRAs.map((lora, index) => (
                      <option
                        key={`${lora.fileName}-${index}`}
                        value={lora.fileName}
                      >
                        {lora.displayName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Aspect Ratio */}
              <div className="space-y-3 mb-6">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Output Size
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
                      min="10"
                      max="100"
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

                  {/* Guidance */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Guidance: {params.guidance}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="0.5"
                      value={params.guidance}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          guidance: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  {/* LoRA Strength */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      LoRA Strength: {params.loraStrength}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={params.loraStrength}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          loraStrength: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Downsampling Factor */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Downsampling Factor: {params.downsamplingFactor}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="0.5"
                      value={params.downsamplingFactor}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          downsamplingFactor: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Downsampling Function */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Downsampling Function
                    </label>
                    <select
                      value={params.downsamplingFunction}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          downsamplingFunction: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {DOWNSAMPLING_FUNCTIONS.map((func) => (
                        <option key={func} value={func}>
                          {func}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Autocrop Margin */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Autocrop Margin: {params.autocropMargin}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.5"
                      step="0.05"
                      value={params.autocropMargin}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          autocropMargin: parseFloat(e.target.value),
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
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
              <button
                onClick={handleGenerate}
                disabled={
                  isGenerating ||
                  !params.prompt.trim() ||
                  !referenceImage ||
                  uploadingImage
                }
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Applying Style Transfer...</span>
                  </>
                ) : uploadingImage ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Uploading Image...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    <span>Apply Style Transfer</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="space-y-6">
            {/* Image Statistics */}
            {imageStats && (
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center">
                  <ImageIcon className="w-5 h-5 mr-2 text-green-600" />
                  Your Image Library
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                    <div className="text-slate-600 dark:text-slate-400 text-xs mb-1">
                      Total Images
                    </div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                      {imageStats.totalImages}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                    <div className="text-slate-600 dark:text-slate-400 text-xs mb-1">
                      Storage Used
                    </div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                      {Math.round((imageStats.totalSize / 1024 / 1024) * 100) /
                        100}{" "}
                      MB
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Current Generation */}
            {currentJob && (
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center">
                    <Wand2 className="w-5 h-5 mr-2 text-purple-600" />
                    Generation Status
                  </h3>
                  {currentJob.status === "completed" && (
                    <button
                      onClick={() => fetchJobImages(currentJob.id)}
                      className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                      title="Refresh generated images"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Status
                    </span>
                    <div className="flex items-center space-x-2">
                      {(currentJob.status === "pending" ||
                        currentJob.status === "processing") && (
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      )}
                      {currentJob.status === "completed" && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                      {currentJob.status === "failed" && (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-sm font-semibold capitalize text-slate-900 dark:text-white">
                        {currentJob.status}
                      </span>
                    </div>
                  </div>

                  {currentJob.progress !== undefined && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Progress
                        </span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {currentJob.progress}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 h-full rounded-full transition-all duration-300 relative"
                          style={{ width: `${currentJob.progress}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Show loading or no images message for completed jobs */}
                  {currentJob.status === "completed" &&
                    (!currentJob.resultUrls ||
                      currentJob.resultUrls.length === 0) &&
                    (!jobImages[currentJob.id] ||
                      jobImages[currentJob.id].length === 0) && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Generated Images
                        </h4>
                        <div className="text-center py-8">
                          <div className="flex items-center justify-center space-x-2 text-gray-500 dark:text-gray-400 mb-3">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span className="text-sm">
                              Loading generated images...
                            </span>
                          </div>
                          <button
                            onClick={() => fetchJobImages(currentJob.id)}
                            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm"
                          >
                            Refresh Images
                          </button>
                        </div>
                      </div>
                    )}

                  {/* Enhanced image display with dynamic URL support */}
                  {((currentJob.resultUrls &&
                    currentJob.resultUrls.length > 0) ||
                    (jobImages[currentJob.id] &&
                      jobImages[currentJob.id].length > 0)) && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Generated Images
                      </h4>

                      <div className="grid grid-cols-1 gap-3">
                        {/* Show database images if available */}
                        {jobImages[currentJob.id] &&
                        jobImages[currentJob.id].length > 0
                          ? // Database images with dynamic URLs
                            jobImages[currentJob.id].map((dbImage, index) => (
                              <div
                                key={`db-${dbImage.id}`}
                                className="relative group"
                              >
                                <img
                                  src={dbImage.dataUrl || dbImage.url}
                                  alt={`Style transfer result ${index + 1}`}
                                  className="w-full rounded-lg shadow-md hover:shadow-lg transition-shadow"
                                  onError={(e) => {
                                    console.error(
                                      "Image load error for:",
                                      dbImage.filename
                                    );

                                    // Smart fallback logic
                                    const currentSrc = (
                                      e.target as HTMLImageElement
                                    ).src;

                                    if (
                                      currentSrc === dbImage.dataUrl &&
                                      dbImage.url
                                    ) {
                                      console.log(
                                        "Falling back to ComfyUI URL"
                                      );
                                      (e.target as HTMLImageElement).src =
                                        dbImage.url;
                                    } else if (
                                      currentSrc === dbImage.url &&
                                      dbImage.dataUrl
                                    ) {
                                      console.log(
                                        "Falling back to database URL"
                                      );
                                      (e.target as HTMLImageElement).src =
                                        dbImage.dataUrl;
                                    } else {
                                      console.error(
                                        "All URLs failed for:",
                                        dbImage.filename
                                      );
                                      (
                                        e.target as HTMLImageElement
                                      ).style.display = "none";
                                    }
                                  }}
                                />
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() =>
                                        downloadDatabaseImage(dbImage)
                                      }
                                      className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
                                      title={`Download ${dbImage.filename}`}
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => shareImage(dbImage)}
                                      className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
                                    >
                                      <Share2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* Image metadata */}
                                <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                                    {dbImage.width && dbImage.height
                                      ? `${dbImage.width}×${dbImage.height}`
                                      : "Unknown size"}
                                    {dbImage.fileSize &&
                                      ` • ${Math.round(
                                        dbImage.fileSize / 1024
                                      )}KB`}
                                    {dbImage.format &&
                                      ` • ${dbImage.format.toUpperCase()}`}
                                  </div>
                                </div>
                              </div>
                            ))
                          : // Fallback to legacy URLs if no database images
                            currentJob.resultUrls &&
                            currentJob.resultUrls.length > 0 &&
                            currentJob.resultUrls.map((url, index) => (
                              <div
                                key={`legacy-${currentJob.id}-${index}`}
                                className="relative group"
                              >
                                <img
                                  src={url}
                                  alt={`Style transfer result ${index + 1}`}
                                  className="w-full rounded-lg shadow-md hover:shadow-lg transition-shadow"
                                  onError={(e) => {
                                    console.error(
                                      "Legacy image load error:",
                                      url
                                    );
                                    (
                                      e.target as HTMLImageElement
                                    ).style.display = "none";
                                  }}
                                />
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() =>
                                        downloadFromUrl(
                                          url,
                                          `style-transfer-${index + 1}.png`
                                        )
                                      }
                                      className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(url);
                                        alert("Image URL copied to clipboard!");
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
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                  Recent Style Transfers
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {jobHistory
                    .filter((job) => job && job.id)
                    .slice(0, 10)
                    .map((job, index) => (
                      <div
                        key={job.id || `job-${index}`}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors"
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
                              onClick={() => fetchJobImages(job.id)}
                              className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                              title="Refresh images"
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
    </div>
  );
}
