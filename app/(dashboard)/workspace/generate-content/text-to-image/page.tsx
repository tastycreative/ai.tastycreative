// app/(dashboard)/workspace/generate-content/text-to-image/page.tsx - COMPLETE WITH DYNAMIC URLS
"use client";

import { useState, useEffect } from "react";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  ImageIcon,
  Wand2,
  Settings,
  Download,
  Share2,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  Sliders,
  Copy,
  RefreshCw,
  RotateCcw,
  ExternalLink,
  Monitor,
  User,
  ChevronDown,
} from "lucide-react";

// Types
interface GenerationParams {
  prompt: string;
  negativePrompt: string;
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
  id: string;
  fileSize: number;
  uploadedAt: string;
  usageCount: number;
  networkVolumePath: string | null;
  originalFileName?: string;
  comfyUIPath?: string;
}

// Updated DatabaseImage interface for dynamic URLs
interface DatabaseImage {
  id: string;
  filename: string;
  subfolder: string;
  type: string;
  fileSize?: number;
  width?: number;
  height?: number;
  format?: string;
  url?: string | null; // Dynamically constructed ComfyUI URL (can be null for serverless)
  dataUrl?: string; // Database-served image URL
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

export default function TextToImagePage() {
  const apiClient = useApiClient();
  const { user } = useUser();

  const [params, setParams] = useState<GenerationParams>({
    prompt: "",
    negativePrompt: "",
    width: 832,
    height: 1216,
    batchSize: 1,
    steps: 40,
    cfg: 1,
    samplerName: "euler",
    scheduler: "beta",
    guidance: 4,
    loraStrength: 0.95,
    selectedLora: "None",
    seed: null,
  });

  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [jobHistory, setJobHistory] = useState<GenerationJob[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [availableLoRAs, setAvailableLoRAs] = useState<LoRAModel[]>([
    {
      fileName: "None",
      displayName: "No LoRA (Base Model)",
      name: "none",
      id: "none",
      fileSize: 0,
      uploadedAt: new Date().toISOString(),
      usageCount: 0,
      networkVolumePath: null,
    },
  ]);
  const [loadingLoRAs, setLoadingLoRAs] = useState(true);

  // Database image states
  const [jobImages, setJobImages] = useState<Record<string, DatabaseImage[]>>(
    {}
  );
  const [imageStats, setImageStats] = useState<any>(null);

  // Initialize empty job history on mount
  useEffect(() => {
    if (!Array.isArray(jobHistory)) {
      setJobHistory([]);
    }
  }, []);

  // Fetch image stats on mount
  useEffect(() => {
    if (apiClient) {
      fetchImageStats();
    }
  }, [apiClient]);

  // Function to fetch images for a completed job
  const fetchJobImages = async (jobId: string): Promise<boolean> => {
    try {
      if (!apiClient) {
        console.error("API client is not available");
        return false;
      }

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

        // Log sample image data for debugging
        if (data.images.length > 0) {
          console.log("📸 Sample image:", {
            filename: data.images[0].filename,
            hasDataUrl: !!data.images[0].dataUrl,
            hasUrl: !!data.images[0].url,
            id: data.images[0].id,
          });
        }

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
    if (!apiClient) {
      console.error("❌ API client not available for image stats");
      return;
    }

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
    if (!apiClient) {
      alert("API client not available");
      return;
    }

    try {
      console.log("📥 Downloading image:", image.filename);

      if (image.dataUrl) {
        // Priority 1: Download from database
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
        // Priority 2: Download from ComfyUI (dynamic URL)
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
      // Priority 1: Share database URL (more reliable)
      urlToShare = `${window.location.origin}${image.dataUrl}`;
    } else if (image.url) {
      // Priority 2: Share ComfyUI URL (dynamic, may not work for serverless)
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
    if (!apiClient) {
      console.log("⏳ API client not ready yet, skipping LoRA fetch");
      return;
    }

    const fetchLoRAModels = async () => {
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

          // Set default LoRA if current selection isn't available
          const currentLoRAExists = data.models.some(
            (lora: LoRAModel) => lora.fileName === params.selectedLora
          );
          if (!currentLoRAExists) {
            const defaultLora =
              data.models.find((lora: LoRAModel) => lora.fileName === "None")
                ?.fileName ||
              data.models[0]?.fileName ||
              "None";
            console.log("Setting default LoRA to:", defaultLora);
            setParams((prev) => ({
              ...prev,
              selectedLora: defaultLora,
            }));
          }
        } else {
          console.error("Invalid LoRA API response:", data);
          setAvailableLoRAs([
            {
              fileName: "None",
              displayName: "No LoRA (Base Model)",
              name: "none",
              id: "none",
              fileSize: 0,
              uploadedAt: new Date().toISOString(),
              usageCount: 0,
              networkVolumePath: "",
            },
          ]);
        }
      } catch (error) {
        console.error("Error fetching LoRA models:", error);
        setAvailableLoRAs([
          {
            fileName: "None",
            displayName: "No LoRA (Base Model)",
            name: "none",
            id: "none",
            fileSize: 0,
            uploadedAt: new Date().toISOString(),
            usageCount: 0,
            networkVolumePath: "",
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

  // Submit generation
  const handleGenerate = async () => {
    if (!apiClient) {
      alert("API client not available - please try again");
      return;
    }

    if (!params.prompt.trim()) {
      alert("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    setCurrentJob(null);

    try {
      console.log("=== STARTING GENERATION ===");
      console.log("🎯 Current form state:", {
        prompt: params.prompt,
        selectedLora: params.selectedLora,
        width: params.width,
        height: params.height,
        steps: params.steps,
        guidance: params.guidance,
        loraStrength: params.loraStrength,
      });

      // Verify form state before submission
      if (params.prompt !== "ohwx woman wearing a sexy red lingerie") {
        console.warn("⚠️ Prompt value may be incorrect:", params.prompt);
      }

      const workflow = createWorkflowJson(params);
      console.log("Created workflow for submission");

      const response = await apiClient.post(
        "/api/generate/text-to-image-runpod",
        {
          workflow,
          params,
        }
      );

      console.log("Generation API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Generation failed:", response.status, errorText);
        throw new Error(`Generation failed: ${response.status} - ${errorText}`);
      }

      const { jobId } = await response.json();
      console.log("Received job ID:", jobId);

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
      console.error("Generation error:", error);
      setIsGenerating(false);
      alert(error instanceof Error ? error.message : "Generation failed");
    }
  };

  // Manual status refresh function for testing
  const refreshJobStatus = async (jobId: string) => {
    if (!apiClient) {
      console.error("❌ API client not available for status refresh");
      return;
    }

    try {
      console.log("🔄 Manually refreshing job status for:", jobId);

      // Try the manual RunPod status check endpoint
      const runpodResponse = await apiClient.get(
        `/api/jobs/${jobId}/runpod-status`
      );

      if (runpodResponse.ok) {
        const result = await runpodResponse.json();
        console.log("✅ Manual status refresh result:", result);

        // Refresh the regular job status
        const jobResponse = await apiClient.get(`/api/jobs/${jobId}`);
        if (jobResponse.ok) {
          const job = await jobResponse.json();

          // Handle date conversion safely
          if (job.createdAt && typeof job.createdAt === "string") {
            job.createdAt = new Date(job.createdAt);
          }

          setCurrentJob(job);
          console.log("🔄 Job status updated:", job.status);

          // If job is completed, fetch the generated images
          if (job.status === "completed") {
            await fetchJobImages(jobId);
            await fetchImageStats();
          }
        }
      } else {
        const errorText = await runpodResponse.text();
        console.error(
          "Manual refresh failed:",
          runpodResponse.status,
          errorText
        );
      }
    } catch (error) {
      console.error("Error during manual status refresh:", error);
    }
  };

  // Manual image download and save function for when URLs fail
  const forceDownloadAndSaveImages = async (jobId: string) => {
    if (!apiClient) {
      console.error("❌ API client not available for image download");
      return false;
    }

    try {
      console.log("🔧 Force downloading and saving images for job:", jobId);

      // Call a special endpoint to force download and save images
      const response = await apiClient.post(
        `/api/jobs/${jobId}/force-save-images`
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Force download result:", result);

        // Refresh job images after successful download
        setTimeout(() => {
          fetchJobImages(jobId);
        }, 2000);

        return true;
      } else {
        const errorText = await response.text();
        console.error("Force download failed:", response.status, errorText);
        return false;
      }
    } catch (error) {
      console.error("Error during force image download:", error);
      return false;
    }
  };

  // Updated poll job status with database image fetching and gallery refresh notification
  const pollJobStatus = async (jobId: string) => {
    if (!apiClient) {
      console.error("❌ API client not available for job polling");
      setIsGenerating(false);
      return;
    }

    console.log("=== STARTING JOB POLLING ===");
    console.log("Polling job ID:", jobId);

    const maxAttempts = 300; // 5 minutes
    let attempts = 0;

    const poll = async () => {
      try {
        attempts++;
        console.log(
          `Polling attempt ${attempts}/${maxAttempts} for job ${jobId}`
        );

        let response = await apiClient.get(`/api/jobs/${jobId}`);
        console.log("Job status response:", response.status);

        // If job status endpoint fails, try RunPod status endpoint as fallback
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Job status error:", response.status, errorText);

          // Try RunPod serverless completion check as fallback
          if (response.status === 404 || response.status >= 500) {
            console.log(
              "🔄 Trying RunPod serverless completion check as fallback..."
            );
            try {
              const serverlessResponse = await apiClient.post(
                "/api/jobs/check-runpod-serverless",
                {
                  jobId,
                }
              );

              if (serverlessResponse.ok) {
                response = serverlessResponse;
                console.log("✅ RunPod serverless check successful");
              } else {
                console.error("❌ RunPod serverless check also failed");
              }
            } catch (serverlessError) {
              console.error(
                "❌ RunPod serverless check error:",
                serverlessError
              );
            }
          }

          if (!response.ok) {
            if (response.status === 404) {
              console.error("Job not found - this might be a storage issue");
              if (attempts < 10) {
                // Retry a few times for new jobs
                setTimeout(poll, 2000);
                return;
              }
            }

            throw new Error(`Job status check failed: ${response.status}`);
          }
        }

        const job = await response.json();
        console.log("Job status data:", job);

        // Handle date conversion safely
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
          console.log("Job completed successfully!");
          setIsGenerating(false);

          // Fetch database images for completed job with retry logic
          console.log("🔄 Attempting to fetch job images...");
          const fetchSuccess = await fetchJobImages(jobId);

          // If fetch failed or no images found, retry after a short delay
          if (!fetchSuccess) {
            console.log("🔄 Retrying image fetch after delay...");
            setTimeout(() => {
              fetchJobImages(jobId);
            }, 3000);
          }

          // Also trigger auto-processing for serverless jobs (fallback)
          try {
            console.log("🔄 Triggering auto-processing for serverless jobs...");
            const autoProcessResponse = await apiClient.post(
              "/api/jobs/auto-process-serverless"
            );
            if (autoProcessResponse.ok) {
              console.log("✅ Auto-processing triggered successfully");
              // Refresh images again after auto-processing
              setTimeout(() => {
                fetchJobImages(jobId);
                fetchImageStats();
              }, 2000);
            }
          } catch (autoProcessError) {
            console.error("❌ Auto-processing failed:", autoProcessError);
          }

          // Refresh image stats after completion
          console.log("📊 Refreshing image stats after generation completion");
          await fetchImageStats();

          // Show success notification in console only
          console.log(
            "✅ Generation completed! Images should appear automatically in the gallery and below."
          );

          return;
        } else if (job.status === "failed") {
          console.log("Job failed:", job.error);
          setIsGenerating(false);
          alert(`❌ Generation failed: ${job.error || "Unknown error"}`);
          return;
        }

        // Continue polling
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        } else {
          console.error("Polling timeout reached");
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
          alert(
            "⏰ Generation polling timed out. Your images may still be processing in the background."
          );
        }
      } catch (error) {
        console.error("Polling error:", error);

        if (attempts < maxAttempts) {
          setTimeout(poll, 2000); // Retry with longer delay
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
          alert(
            "❌ Failed to get generation status. Please check the Generated Content gallery manually."
          );
        }
      }
    };

    // Start polling after a short delay
    setTimeout(poll, 1000);
  };

  // Create workflow JSON
  const createWorkflowJson = (params: GenerationParams) => {
    // Always generate a truly random seed to prevent caching issues
    const seed = params.seed || Math.floor(Math.random() * 2147483647);
    console.log(`🎲 Using seed: ${seed}`);

    const useLoRA = params.selectedLora !== "None";

    const workflow: any = {
      "1": {
        inputs: {
          width: params.width,
          height: params.height,
          batch_size: params.batchSize,
        },
        class_type: "EmptyLatentImage",
      },
      "2": {
        inputs: {
          text: params.prompt,
          clip: ["5", 0],
        },
        class_type: "CLIPTextEncode",
      },
      "3": {
        inputs: {
          samples: ["12", 0],
          vae: ["4", 0],
        },
        class_type: "VAEDecode",
      },
      "4": {
        inputs: {
          vae_name: "ae.safetensors",
        },
        class_type: "VAELoader",
      },
      "5": {
        inputs: {
          clip_name1: "t5xxl_fp16.safetensors",
          clip_name2: "clip_l.safetensors",
          type: "flux",
        },
        class_type: "DualCLIPLoader",
      },
      "6": {
        inputs: {
          unet_name: "flux1-dev.safetensors",
          weight_dtype: "fp8_e4m3fn",
        },
        class_type: "UNETLoader",
      },
      "7": {
        inputs: {
          conditioning: ["2", 0],
          guidance: params.guidance,
        },
        class_type: "FluxGuidance",
      },
      "9": {
        inputs: {
          model: useLoRA ? ["14", 0] : ["6", 0],
          max_shift: 1.15,
          base_shift: 0.3,
          width: params.width,
          height: params.height,
        },
        class_type: "ModelSamplingFlux",
      },
      "10": {
        inputs: {
          conditioning: ["2", 0],
        },
        class_type: "ConditioningZeroOut",
      },
      "12": {
        inputs: {
          seed: seed,
          steps: params.steps,
          cfg: params.cfg,
          sampler_name: params.samplerName,
          scheduler: params.scheduler,
          denoise: 1,
          model: ["9", 0],
          positive: ["7", 0],
          negative: ["10", 0],
          latent_image: ["1", 0],
        },
        class_type: "KSampler",
      },
      "13": {
        inputs: {
          filename_prefix: `ComfyUI_${Date.now()}_${seed}`,
          images: ["3", 0],
        },
        class_type: "SaveImage",
      },
    };

    if (useLoRA) {
      // Format the LoRA path correctly for ComfyUI network volume
      // ComfyUI expects: subdirectory/filename format for files in subdirectories
      // Our files are stored as: /runpod-volume/loras/{user_id}/{filename}
      // So ComfyUI should reference them as: {user_id}/{filename}
      let loraPath = params.selectedLora;

      if (params.selectedLora.startsWith("user_") && user?.id) {
        // Extract the user ID from the filename and use it as subdirectory
        // Format: user_id/filename.safetensors
        loraPath = `${user.id}/${params.selectedLora}`;
        console.log(`🎯 ComfyUI LoRA path: ${loraPath}`);
        console.log(`🎯 Selected LoRA filename: ${params.selectedLora}`);
        console.log(`🎯 User ID: ${user.id}`);
        console.log(
          `🎯 Expected storage path: /runpod-volume/loras/${loraPath}`
        );
      }

      workflow["14"] = {
        inputs: {
          model: ["6", 0],
          lora_name: loraPath,
          strength_model: params.loraStrength,
        },
        class_type: "LoraLoaderModelOnly",
      };

      console.log(
        `🎯 LoRA workflow node 14:`,
        JSON.stringify(workflow["14"], null, 2)
      );
    }

    // Final workflow debugging
    console.log("🔍 === FINAL WORKFLOW DEBUG ===");
    console.log(`🎲 Seed: ${seed}`);
    console.log(`🎭 Prompt: ${params.prompt}`);
    console.log(`🖼️ Filename prefix: ComfyUI_${Date.now()}_${seed}`);
    if (useLoRA) {
      console.log(`🎯 LoRA being used: ${workflow["14"].inputs.lora_name}`);
      console.log(`💪 LoRA strength: ${workflow["14"].inputs.strength_model}`);
    } else {
      console.log(`🚫 No LoRA selected`);
    }
    console.log("🔍 === END WORKFLOW DEBUG ===");

    return workflow;
  };

  // Manual job check
  const manualJobCheck = async () => {
    if (!apiClient) {
      alert("API client not available");
      return;
    }

    if (!currentJob?.id) {
      alert("No current job to check");
      return;
    }

    try {
      console.log("=== MANUAL JOB CHECK ===");
      console.log("Checking job:", currentJob.id);

      const response = await apiClient.get(`/api/jobs/${currentJob.id}`);
      console.log("Manual check response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Manual check failed:", errorText);
        alert(`Job check failed: ${response.status} - ${errorText}`);
        return;
      }

      const job = await response.json();
      console.log("Manual check result:", job);

      // Handle date conversion
      if (job.createdAt && typeof job.createdAt === "string") {
        job.createdAt = new Date(job.createdAt);
      }

      setCurrentJob(job);
      setJobHistory((prev) =>
        prev.map((j) => (j?.id === currentJob.id ? job : j)).filter(Boolean)
      );

      alert(`Job Status: ${job.status}\nProgress: ${job.progress || 0}%`);
    } catch (error) {
      console.error("Manual check error:", error);
      alert(
        "Manual check failed: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  if (!apiClient) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-[600px] bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900 rounded-3xl">
          <div className="text-center space-y-8 p-8">
            <div className="relative">
              <div className="w-28 h-28 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto shadow-2xl"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                  <Sparkles className="w-8 h-8 text-white animate-pulse" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Preparing AI Studio ✨
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-lg max-w-lg mx-auto leading-relaxed">
                Setting up your creative workspace with the latest FLUX AI
                models and artistic tools...
              </p>
            </div>

            <div className="flex items-center justify-center space-x-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce shadow-lg"></div>
              <div
                className="w-3 h-3 bg-purple-500 rounded-full animate-bounce shadow-lg"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce shadow-lg"
                style={{ animationDelay: "0.2s" }}
              ></div>
            </div>

            <div className="mt-8 p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-blue-200/50 dark:border-gray-700/50 max-w-sm mx-auto">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Loading AI Models...
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full animate-pulse"
                  style={{ width: "75%" }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 rounded-3xl shadow-2xl border border-blue-200 dark:border-indigo-800 p-8 text-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center space-x-6">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30 shadow-lg">
              <div className="relative">
                <Wand2 className="w-10 h-10 text-white drop-shadow-sm" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-yellow-800" />
                </div>
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2 drop-shadow-sm flex items-center space-x-3">
                <span>Text to Image</span>
                <span className="text-2xl">🎨</span>
              </h1>
              <p className="text-blue-100 text-lg font-medium opacity-90 mb-2">
                Transform your imagination into stunning visuals with AI
              </p>
              <div className="flex items-center space-x-4 text-sm text-blue-100">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>FLUX AI Powered</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-purple-300 rounded-full"></div>
                  <span>Ultra High Quality</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-yellow-300 rounded-full"></div>
                  <span>Instant Results</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {imageStats && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white drop-shadow-sm mb-1">
                    {imageStats.totalImages?.toLocaleString() || 0}
                  </div>
                  <div className="text-sm text-blue-100 font-medium">
                    Images Created
                  </div>
                  {imageStats.totalSize && (
                    <div className="text-xs text-blue-200 mt-1">
                      {(imageStats.totalSize / 1024 / 1024).toFixed(1)} MB used
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 shadow-lg">
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 mb-1">
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <span className="text-sm font-semibold text-white">
                    AI Status
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
          {/* Enhanced Prompt Input */}
          <div className="group bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xl font-bold text-gray-900 dark:text-white flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <span>Describe Your Vision</span>
                  <div className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                    Required
                  </div>
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() =>
                      setParams((prev) => ({
                        ...prev,
                        prompt:
                          "A futuristic cityscape at sunset with flying cars and neon lights reflecting on glass buildings",
                      }))
                    }
                    className="px-3 py-1.5 text-xs bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 font-medium shadow-lg"
                    title="Try example prompt"
                  >
                    ✨ Example
                  </button>
                  <button
                    onClick={() =>
                      setParams((prev) => ({ ...prev, prompt: "" }))
                    }
                    className="text-sm text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 font-medium transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={params.prompt}
                  onChange={(e) =>
                    setParams((prev) => ({ ...prev, prompt: e.target.value }))
                  }
                  placeholder="Describe your dream image in vivid detail... The more specific you are, the better the AI can understand and create your vision. Include details like style, mood, colors, composition, and artistic techniques."
                  className="w-full h-36 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-2xl focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-300 text-sm leading-relaxed"
                  maxLength={1000}
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
                    params.prompt.length > 800
                      ? "text-red-500"
                      : params.prompt.length > 500
                      ? "text-yellow-500"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {params.prompt.length}/1000 characters
                </div>

                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="font-medium">AI Tip:</span>
                  </div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Include style, mood, and composition details
                  </span>
                </div>
              </div>

              {/* Quick Prompt Suggestions */}
              <div className="flex flex-wrap gap-2 pt-2">
                {[
                  "cinematic lighting",
                  "photorealistic",
                  "vibrant colors",
                  "detailed background",
                  "professional photography",
                  "artistic style",
                ].map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (!params.prompt.includes(suggestion)) {
                        setParams((prev) => ({
                          ...prev,
                          prompt:
                            prev.prompt +
                            (prev.prompt ? ", " : "") +
                            suggestion,
                        }));
                      }
                    }}
                    className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300 transition-all duration-200 font-medium border border-gray-200 dark:border-gray-600"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Enhanced Basic Settings */}
          <div className="group bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <span>Generation Settings</span>
              </h3>
              <div className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
                Fine-tune Your Creation
              </div>
            </div>

            {/* Enhanced LoRA Model Selection */}
            <div className="space-y-4 mb-6 p-4 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-teal-900/20 rounded-2xl border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <label className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <span>AI Style Model</span>
                  <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                    Custom Trained
                  </div>
                </label>
                {params.selectedLora !== "None" && (
                  <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Active</span>
                  </div>
                )}
              </div>

              {loadingLoRAs ? (
                <div className="flex items-center space-x-3 p-4 border-2 border-dashed border-green-300 dark:border-green-600 rounded-2xl bg-green-50 dark:bg-green-900/10 backdrop-blur-sm">
                  <Loader2 className="w-5 h-5 animate-spin text-green-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                    Loading your custom AI models...
                  </span>
                  <div className="ml-auto">
                    <div className="w-16 h-2 bg-green-200 dark:bg-green-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full animate-pulse"
                        style={{ width: "60%" }}
                      ></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={params.selectedLora}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        selectedLora: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-4 border-2 border-green-200 dark:border-green-600 rounded-2xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300 appearance-none text-lg font-medium shadow-sm"
                  >
                    {availableLoRAs.map((lora, index) => (
                      <option
                        key={`${lora.fileName}-${index}`}
                        value={lora.fileName}
                      >
                        {lora.displayName}
                        {lora.fileName !== "None" &&
                          lora.fileSize > 0 &&
                          ` (${(lora.fileSize / 1024 / 1024).toFixed(1)}MB)`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-green-500 pointer-events-none" />
                </div>
              )}

              {params.selectedLora !== "None" && (
                <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-700 rounded-2xl shadow-sm">
                  <div className="p-2 bg-green-500 rounded-xl">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-green-800 dark:text-green-200 mb-1">
                      Using Custom Style Model
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400 mb-1">
                      {availableLoRAs.find(
                        (lora) => lora.fileName === params.selectedLora
                      )?.displayName || params.selectedLora}
                    </div>
                    {(() => {
                      const selectedLoRA = availableLoRAs.find(
                        (lora) => lora.fileName === params.selectedLora
                      );
                      return selectedLoRA && selectedLoRA.fileSize > 0 ? (
                        <div className="text-xs text-green-500 dark:text-green-300 space-y-0.5">
                          <div>
                            Size:{" "}
                            {(selectedLoRA.fileSize / 1024 / 1024).toFixed(1)}MB
                          </div>
                          <div>
                            Uploaded:{" "}
                            {new Date(
                              selectedLoRA.uploadedAt
                            ).toLocaleDateString()}
                          </div>
                          {selectedLoRA.usageCount > 0 && (
                            <div>Used {selectedLoRA.usageCount} times</div>
                          )}
                        </div>
                      ) : null;
                    })()}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                      Strength: {(params.loraStrength * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Enhanced Aspect Ratio */}
            <div className="space-y-4 mb-6 p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <label className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl">
                    <Monitor className="w-5 h-5 text-white" />
                  </div>
                  <span>Image Dimensions</span>
                  <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                    Choose Aspect
                  </div>
                </label>
                <div className="text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                  {params.width} × {params.height}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.name}
                    onClick={() =>
                      handleAspectRatioChange(ratio.width, ratio.height)
                    }
                    className={`group relative p-4 rounded-2xl border-2 text-sm font-medium transition-all duration-300 hover:scale-105 ${
                      params.width === ratio.width &&
                      params.height === ratio.height
                        ? "border-blue-500 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-2xl scale-105 ring-4 ring-blue-500/20"
                        : "border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-300 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 shadow-sm hover:shadow-lg"
                    }`}
                  >
                    {/* Visual Representation */}
                    <div className="flex justify-center mb-2">
                      <div
                        className={`border rounded-sm ${
                          params.width === ratio.width &&
                          params.height === ratio.height
                            ? "border-white/60 bg-white/20"
                            : "border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-700"
                        }`}
                        style={{
                          width: ratio.width > ratio.height ? "24px" : "18px",
                          height: ratio.height > ratio.width ? "24px" : "18px",
                          aspectRatio: `${ratio.width}/${ratio.height}`,
                        }}
                      ></div>
                    </div>

                    <div className="text-center">
                      <div className="font-bold text-base mb-1">
                        {ratio.name}
                      </div>
                      <div
                        className={`text-xs mb-1 ${
                          params.width === ratio.width &&
                          params.height === ratio.height
                            ? "text-blue-100"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {ratio.ratio}
                      </div>
                      <div
                        className={`text-xs ${
                          params.width === ratio.width &&
                          params.height === ratio.height
                            ? "text-blue-200"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        {ratio.width}×{ratio.height}
                      </div>
                    </div>

                    {/* Selection indicator */}
                    {params.width === ratio.width &&
                      params.height === ratio.height && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                          <CheckCircle className="w-4 h-4 text-yellow-800" />
                        </div>
                      )}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-sm pt-2">
                <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="font-medium">Pro Tip:</span>
                </div>
                <span className="text-gray-600 dark:text-gray-400">
                  Portrait works best for people, landscape for scenes
                </span>
              </div>
            </div>

            {/* Enhanced Batch Size */}
            <div className="space-y-4 mb-6 p-4 bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-900/20 dark:via-amber-900/20 dark:to-yellow-900/20 rounded-2xl border border-orange-200 dark:border-orange-800">
              <div className="flex items-center justify-between">
                <label className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl">
                    <Copy className="w-5 h-5 text-white" />
                  </div>
                  <span>Batch Generation</span>
                  <div className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-xs font-medium">
                    Multiple Images
                  </div>
                </label>
                <div className="flex items-center space-x-3">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-4 py-2 rounded-2xl shadow-sm">
                    {params.batchSize}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    image{params.batchSize !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="range"
                    min="1"
                    max="4"
                    value={params.batchSize}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        batchSize: parseInt(e.target.value),
                      }))
                    }
                    className="w-full h-3 bg-gradient-to-r from-orange-200 to-amber-200 dark:from-orange-800 dark:to-amber-800 rounded-lg appearance-none cursor-pointer slider-thumb"
                    style={{
                      background: `linear-gradient(to right, 
                        rgb(249 115 22) 0%, 
                        rgb(249 115 22) ${((params.batchSize - 1) / 3) * 100}%, 
                        rgb(209 213 219) ${
                          ((params.batchSize - 1) / 3) * 100
                        }%, 
                        rgb(209 213 219) 100%)`,
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 font-medium mt-2">
                    {[1, 2, 3, 4].map((num) => (
                      <div
                        key={num}
                        className={`flex flex-col items-center ${
                          params.batchSize === num
                            ? "text-orange-600 dark:text-orange-400 font-bold"
                            : ""
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full mb-1 ${
                            params.batchSize >= num
                              ? "bg-orange-500"
                              : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        ></div>
                        <span>
                          {num} image{num !== 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-2xl border border-orange-200 dark:border-orange-700">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                      <Copy className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm font-bold text-orange-800 dark:text-orange-200">
                      Generating {params.batchSize} variation
                      {params.batchSize !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                    {params.batchSize === 1 && "Single image"}
                    {params.batchSize === 2 && "More variety"}
                    {params.batchSize === 3 && "Good selection"}
                    {params.batchSize === 4 && "Maximum choice"}
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Advanced Settings Toggle */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full p-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-indigo-500" />
                  <span>Advanced Settings</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showAdvanced ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>

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
                {params.selectedLora !== "None" && (
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
                )}

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

          {/* Enhanced Generate Button */}
          <div className="mt-6">
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-3xl p-4 border border-gray-200 dark:border-gray-700 shadow-lg">
              {/* Current Settings Summary */}
              <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Current Generation Settings:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Prompt:
                    </span>{" "}
                    <span className="text-gray-900 dark:text-white font-medium">
                      {params.prompt.substring(0, 40)}
                      {params.prompt.length > 40 ? "..." : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Style Model:
                    </span>{" "}
                    <span className="text-gray-900 dark:text-white font-medium">
                      {availableLoRAs
                        .find((l) => l.fileName === params.selectedLora)
                        ?.displayName?.substring(0, 20) || params.selectedLora}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Size:
                    </span>{" "}
                    <span className="text-gray-900 dark:text-white font-medium">
                      {params.width}×{params.height}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Style Strength:
                    </span>{" "}
                    <span className="text-gray-900 dark:text-white font-medium">
                      {Math.round(params.loraStrength * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Generation Info */}
              <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700 rounded-2xl">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-green-400 to-blue-500 rounded-xl">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white text-sm">
                      Ready to Generate
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {params.batchSize} image
                      {params.batchSize !== 1 ? "s" : ""} • {params.width}×
                      {params.height}
                      {params.selectedLora !== "None" && " • Custom Style"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Ready
                  </span>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !params.prompt.trim()}
                className={`group relative w-full py-5 px-8 rounded-2xl transition-all duration-500 flex items-center justify-center space-x-4 font-bold text-xl overflow-hidden ${
                  isGenerating || !params.prompt.trim()
                    ? "bg-gradient-to-r from-gray-400 to-gray-500 cursor-not-allowed text-white/80"
                    : "bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 hover:from-purple-700 hover:via-blue-700 hover:to-indigo-700 text-white shadow-2xl hover:shadow-purple-500/30 hover:scale-105 active:scale-95"
                }`}
              >
                {/* Animated background */}
                <div
                  className={`absolute inset-0 rounded-2xl transition-opacity duration-500 ${
                    isGenerating || !params.prompt.trim()
                      ? "opacity-0"
                      : "opacity-100 bg-gradient-to-r from-purple-400/20 via-blue-400/20 to-indigo-400/20 animate-pulse"
                  }`}
                ></div>

                {/* Button content */}
                <div className="relative flex items-center justify-center space-x-4">
                  {isGenerating ? (
                    <>
                      <div className="relative">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <div className="absolute inset-0 w-8 h-8 border-2 border-white/30 rounded-full animate-ping"></div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-lg">
                          Creating Your Masterpiece
                        </span>
                        <span className="text-sm opacity-80 font-normal">
                          AI is working its magic...
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="relative">
                        <Sparkles className="w-8 h-8 group-hover:rotate-12 transition-transform duration-300 drop-shadow-lg" />
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse"></div>
                        </div>
                      </div>
                      <span className="drop-shadow-sm">Generate AI Art</span>
                      <Wand2 className="w-8 h-8 group-hover:rotate-12 transition-transform duration-300 drop-shadow-lg" />
                    </>
                  )}
                </div>
              </button>

              {/* Status messages */}
              {!params.prompt.trim() ? (
                <div className="text-center mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <div className="flex items-center justify-center space-x-2 text-amber-700 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Enter a creative prompt to begin
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                  <div className="flex items-center justify-center space-x-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Ready to create amazing art!
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="space-y-6">
          {/* Enhanced Image Statistics */}
          {imageStats && (
            <div className="group bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl">
                    <ImageIcon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    AI Art Gallery
                  </h3>
                </div>
                <Link
                  href="/dashboard/workspace/generated-content"
                  className="group flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                >
                  <span>View Gallery</span>
                  <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-500 rounded-xl">
                        <ImageIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                          {imageStats.totalImages?.toLocaleString() || 0}
                        </div>
                        <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                          Total Masterpieces
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                        {Math.round(
                          (imageStats.totalSize / 1024 / 1024) * 100
                        ) / 100}{" "}
                        MB
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Storage Used
                      </div>
                    </div>
                  </div>
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
                <div className="flex items-center space-x-2">
                  {/* Manual status refresh button for processing jobs */}
                  {(currentJob.status === "processing" ||
                    currentJob.status === "pending") && (
                    <button
                      onClick={() => refreshJobStatus(currentJob.id)}
                      className="p-2 text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30"
                      title="Check RunPod status and sync if completed"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  {/* Image refresh button for completed jobs */}
                  {currentJob.status === "completed" && (
                    <button
                      onClick={() => fetchJobImages(currentJob.id)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Refresh generated images"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Status
                  </span>
                  <div className="flex items-center space-x-2">
                    {(currentJob.status === "pending" ||
                      currentJob.status === "processing") && (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
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
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${currentJob.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Enhanced no images message for completed jobs */}
                {currentJob.status === "completed" &&
                  (!currentJob.resultUrls ||
                    currentJob.resultUrls.length === 0) &&
                  (!jobImages[currentJob.id] ||
                    jobImages[currentJob.id].length === 0) && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Generated Images
                      </h4>
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-2">
                              ⚠️ Images generated but not loaded yet
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                              The generation completed successfully, but images
                              may still be processing or need to be downloaded
                              from the server.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => fetchJobImages(currentJob.id)}
                                className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors flex items-center space-x-1"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Refresh Images</span>
                              </button>
                              <button
                                onClick={async () => {
                                  const success =
                                    await forceDownloadAndSaveImages(
                                      currentJob.id
                                    );
                                  if (success) {
                                    console.log(
                                      "✅ Images downloaded successfully! They should appear shortly."
                                    );
                                    // Re-fetch job images to update the display
                                    await fetchJobImages(currentJob.id);
                                  } else {
                                    console.error(
                                      "❌ Failed to download images. Please try again or check the Generated Content gallery."
                                    );
                                  }
                                }}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors flex items-center space-x-1"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download Images</span>
                              </button>
                              <button
                                onClick={() => refreshJobStatus(currentJob.id)}
                                className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors flex items-center space-x-1"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Refresh Status</span>
                              </button>
                              <button
                                onClick={() =>
                                  window.open(
                                    "/dashboard/workspace/generated-content",
                                    "_blank"
                                  )
                                }
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors flex items-center space-x-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>View Gallery</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Enhanced image display with dynamic URL support */}
                {((currentJob.resultUrls && currentJob.resultUrls.length > 0) ||
                  (jobImages[currentJob.id] &&
                    jobImages[currentJob.id].length > 0)) && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Generated Images
                    </h4>

                    <div className="grid grid-cols-1 gap-3">
                      {/* Show database images if available */}
                      {jobImages[currentJob.id] &&
                      jobImages[currentJob.id].length > 0 ? (
                        // Database images with dynamic URLs - only show images that have data
                        jobImages[currentJob.id]
                          .filter((dbImage) => dbImage.dataUrl) // Only show images with data
                          .map((dbImage, index) => (
                            <div
                              key={`db-${dbImage.id}`}
                              className="relative group"
                            >
                              <img
                                src={dbImage.dataUrl}
                                alt={`Generated image ${index + 1}`}
                                className="w-full rounded-lg shadow-md hover:shadow-lg transition-shadow"
                                onError={(e) => {
                                  // Fallback to placeholder for serverless RunPod
                                  console.warn(
                                    "⚠️ Database image failed to load:",
                                    dbImage.filename,
                                    "- switching to placeholder"
                                  );

                                  (e.target as HTMLImageElement).src =
                                    "/api/placeholder-image";
                                }}
                              />
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() =>
                                      downloadDatabaseImage(dbImage)
                                    }
                                    className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
                                    title={`Download ${dbImage.filename} (${
                                      dbImage.fileSize
                                        ? `${Math.round(
                                            dbImage.fileSize / 1024
                                          )}KB`
                                        : "Unknown size"
                                    })`}
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
                      ) : // Check if there are images without data (still processing)
                      jobImages[currentJob.id] &&
                        jobImages[currentJob.id].length > 0 &&
                        jobImages[currentJob.id].some((img) => !img.dataUrl) ? (
                        <div className="text-center py-8">
                          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 mb-2">
                            Images are being processed...
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-500">
                            {
                              jobImages[currentJob.id].filter(
                                (img) => !img.dataUrl
                              ).length
                            }{" "}
                            image(s) saving to database
                          </p>
                          <button
                            onClick={() =>
                              currentJob.id && fetchJobImages(currentJob.id)
                            }
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                          >
                            Check Again
                          </button>
                        </div>
                      ) : (
                        // Fallback to legacy URLs if no database images
                        currentJob.resultUrls &&
                        currentJob.resultUrls.length > 0 &&
                        currentJob.resultUrls.map((url, index) => (
                          <div
                            key={`legacy-${currentJob.id}-${index}`}
                            className="relative group"
                          >
                            <img
                              src={url}
                              alt={`Generated image ${index + 1}`}
                              className="w-full rounded-lg shadow-md hover:shadow-lg transition-shadow"
                              onError={(e) => {
                                console.error("Legacy image load error:", url);
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="flex space-x-1">
                                <button
                                  onClick={() =>
                                    downloadFromUrl(
                                      url,
                                      `generated-image-${index + 1}.png`
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
                        ))
                      )}
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
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
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
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
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
  );
}
