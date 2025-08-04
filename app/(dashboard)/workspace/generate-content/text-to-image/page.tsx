// app/(dashboard)/workspace/generate-content/text-to-image/page.tsx - CLEAN VERSION
"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/apiClient";
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
} from "lucide-react";

// Types
interface GenerationParams {
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
    
    const date = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
    
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
  const [params, setParams] = useState<GenerationParams>({
    prompt: "",
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
    { fileName: 'None', displayName: 'No LoRA (Base Model)', name: 'none' }
  ]);
  const [loadingLoRAs, setLoadingLoRAs] = useState(true);

  // Initialize empty job history on mount
  useEffect(() => {
    if (!Array.isArray(jobHistory)) {
      setJobHistory([]);
    }
  }, []);

  // Fetch available LoRA models on component mount
  useEffect(() => {
    const fetchLoRAModels = async () => {
      try {
        setLoadingLoRAs(true);
        console.log('=== FETCHING LORA MODELS ===');
        
        const response = await apiClient.get("/api/models/loras");
        console.log('LoRA API response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('LoRA API response data:', data);

        if (data.success && data.models && Array.isArray(data.models)) {
          console.log('Available LoRA models:', data.models);
          setAvailableLoRAs(data.models);
          
          // Set default LoRA if current selection isn't available
          const currentLoRAExists = data.models.some((lora: LoRAModel) => lora.fileName === params.selectedLora);
          if (!currentLoRAExists) {
            const defaultLora = data.models.find((lora: LoRAModel) => lora.fileName === "None")?.fileName || data.models[0]?.fileName || "None";
            console.log('Setting default LoRA to:', defaultLora);
            setParams((prev) => ({
              ...prev,
              selectedLora: defaultLora,
            }));
          }
        } else {
          console.error('Invalid LoRA API response:', data);
          setAvailableLoRAs([{ fileName: 'None', displayName: 'No LoRA (Base Model)', name: 'none' }]);
        }
      } catch (error) {
        console.error('Error fetching LoRA models:', error);
        setAvailableLoRAs([{ fileName: 'None', displayName: 'No LoRA (Base Model)', name: 'none' }]);
      } finally {
        setLoadingLoRAs(false);
      }
    };

    fetchLoRAModels();
  }, []);

  const generateRandomSeed = () => {
    const seed = Math.floor(Math.random() * 1000000000);
    setParams((prev) => ({ ...prev, seed }));
  };

  const handleAspectRatioChange = (width: number, height: number) => {
    setParams((prev) => ({ ...prev, width, height }));
  };

  // Submit generation
  const handleGenerate = async () => {
    if (!params.prompt.trim()) {
      alert("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    setCurrentJob(null);
    
    try {
      console.log('=== STARTING GENERATION ===');
      console.log('Generation params:', params);
      
      const workflow = createWorkflowJson(params);
      console.log('Created workflow for submission');
      
      const response = await apiClient.post("/api/generate/text-to-image", {
        workflow,
        params,
      });

      console.log('Generation API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Generation failed:', response.status, errorText);
        throw new Error(`Generation failed: ${response.status} - ${errorText}`);
      }

      const { jobId } = await response.json();
      console.log('Received job ID:', jobId);

      if (!jobId) {
        throw new Error('No job ID received from server');
      }

      const newJob: GenerationJob = {
        id: jobId,
        status: "pending",
        createdAt: new Date(),
        progress: 0
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

  // Poll job status
  const pollJobStatus = async (jobId: string) => {
    console.log('=== STARTING JOB POLLING ===');
    console.log('Polling job ID:', jobId);
    
    const maxAttempts = 120; // 2 minutes
    let attempts = 0;

    const poll = async () => {
      try {
        attempts++;
        console.log(`Polling attempt ${attempts}/${maxAttempts} for job ${jobId}`);
        
        const response = await apiClient.get(`/api/jobs/${jobId}`);
        console.log('Job status response:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Job status error:', response.status, errorText);
          
          if (response.status === 404) {
            console.error('Job not found - this might be a storage issue');
            if (attempts < 10) { // Retry a few times for new jobs
              setTimeout(poll, 2000);
              return;
            }
          }
          
          throw new Error(`Job status check failed: ${response.status}`);
        }

        const job = await response.json();
        console.log('Job status data:', job);

        // Handle date conversion safely
        if (job.createdAt && typeof job.createdAt === "string") {
          job.createdAt = new Date(job.createdAt);
        }

        setCurrentJob(job);
        setJobHistory((prev) =>
          prev.map((j) => {
            if (j?.id === jobId) {
              return {
                ...job,
                createdAt: job.createdAt || j.createdAt
              };
            }
            return j;
          }).filter(Boolean)
        );

        if (job.status === "completed") {
          console.log('Job completed successfully!');
          setIsGenerating(false);
          return;
        } else if (job.status === "failed") {
          console.log('Job failed:', job.error);
          setIsGenerating(false);
          return;
        }

        // Continue polling
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        } else {
          console.error('Polling timeout reached');
          setIsGenerating(false);
          setCurrentJob(prev => prev ? {
            ...prev,
            status: "failed" as const,
            error: "Polling timeout - generation may still be running"
          } : null);
        }
      } catch (error) {
        console.error("Polling error:", error);
        
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000); // Retry with longer delay
        } else {
          setIsGenerating(false);
          setCurrentJob(prev => prev ? {
            ...prev,
            status: "failed" as const,
            error: "Failed to get job status"
          } : null);
        }
      }
    };

    // Start polling after a short delay
    setTimeout(poll, 1000);
  };

  // Create workflow JSON
  const createWorkflowJson = (params: GenerationParams) => {
    const seed = params.seed || Math.floor(Math.random() * 1000000000);
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
          filename_prefix: "ComfyUI",
          images: ["3", 0],
        },
        class_type: "SaveImage",
      },
    };

    if (useLoRA) {
      workflow["14"] = {
        inputs: {
          model: ["6", 0],
          lora_name: params.selectedLora,
          strength_model: params.loraStrength,
        },
        class_type: "LoraLoaderModelOnly",
      };
    }

    return workflow;
  };

  // Manual job check
  const manualJobCheck = async () => {
    if (!currentJob?.id) {
      alert('No current job to check');
      return;
    }
    
    try {
      console.log('=== MANUAL JOB CHECK ===');
      console.log('Checking job:', currentJob.id);
      
      const response = await apiClient.get(`/api/jobs/${currentJob.id}`);
      console.log('Manual check response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Manual check failed:', errorText);
        alert(`Job check failed: ${response.status} - ${errorText}`);
        return;
      }
      
      const job = await response.json();
      console.log('Manual check result:', job);
      
      // Handle date conversion
      if (job.createdAt && typeof job.createdAt === "string") {
        job.createdAt = new Date(job.createdAt);
      }
      
      setCurrentJob(job);
      setJobHistory(prev => 
        prev.map(j => j?.id === currentJob.id ? job : j).filter(Boolean)
      );
      
      alert(`Job Status: ${job.status}\nProgress: ${job.progress || 0}%`);
    } catch (error) {
      console.error('Manual check error:', error);
      alert('Manual check failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
            <ImageIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Text to Image
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Generate stunning images from text descriptions using Flux AI
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prompt Input */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Prompt
                </label>
                <button
                  onClick={() => setParams((prev) => ({ ...prev, prompt: "" }))}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Clear
                </button>
              </div>
              <textarea
                value={params.prompt}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, prompt: e.target.value }))
                }
                placeholder="Describe the image you want to generate..."
                className="w-full h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {params.prompt.length}/1000 characters
              </div>
            </div>
          </div>

          {/* Basic Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Settings
            </h3>

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
                    <option key={`${lora.fileName}-${index}`} value={lora.fileName}>
                      {lora.displayName}
                    </option>
                  ))}
                </select>
              )}
              
              {params.selectedLora !== "None" && (
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  Using LoRA: {availableLoRAs.find(lora => lora.fileName === params.selectedLora)?.displayName || params.selectedLora}
                </div>
              )}
            </div>

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
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <div>{ratio.name}</div>
                    <div className="text-xs opacity-75">{ratio.ratio}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Batch Size */}
            <div className="space-y-3 mb-6">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Number of Images: {params.batchSize}
              </label>
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
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>1</span>
                <span>4</span>
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
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

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !params.prompt.trim()}
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center space-x-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                <span>Generate Image</span>
              </>
            )}
          </button>
        </div>

        {/* Right Panel - Results */}
        <div className="space-y-6">
          {/* Current Generation */}
          {currentJob && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Current Generation
                </h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Status
                  </span>
                  <div className="flex items-center space-x-2">
                    {(currentJob.status === "pending" || currentJob.status === "processing") && (
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

                {currentJob.resultUrls && currentJob.resultUrls.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Generated Images
                    </h4>
                    <div className="grid grid-cols-1 gap-3">
                      {currentJob.resultUrls.map((url, index) => (
                        <div key={`result-${currentJob.id}-${index}`} className="relative group">
                          <img
                            src={url}
                            alt={`Generated image ${index + 1}`}
                            className="w-full rounded-lg shadow-md hover:shadow-lg transition-shadow"
                            onError={(e) => {
                              console.error('Image load error:', url);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex space-x-1">
                              <button 
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.download = `generated-image-${index + 1}.png`;
                                  link.click();
                                }}
                                className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(url);
                                  alert('Image URL copied to clipboard!');
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Recent Generations
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {jobHistory.filter(job => job && job.id).slice(0, 10).map((job, index) => (
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
                          {job.status || 'unknown'}
                        </p>
                      </div>
                    </div>
                    {job.resultUrls && job.resultUrls.length > 0 && (
                      <div className="flex space-x-1">
                        <button className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                          <Download className="w-4 h-4" />
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