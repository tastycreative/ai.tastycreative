"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import {
  trainingPresets,
  type TrainingPreset,
  type CreateTrainingJobInput,
} from "@/lib/validations/training";
import {
  Upload,
  Settings,
  Play,
  Cpu,
  Zap,
  Clock,
  Image as ImageIcon,
  FileText,
  Info,
  ChevronDown,
  X,
  Plus,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface ImageFile {
  file: File;
  caption: string;
  preview: string;
}

export default function TrainLoRAPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [jobName, setJobName] = useState("my_first_flux_lora_v1");
  const [description, setDescription] = useState("");
  const [triggerWord, setTriggerWord] = useState("");
  const [images, setImages] = useState<ImageFile[]>([]);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState({
    isUploading: false,
    currentChunk: 0,
    totalChunks: 0,
    uploadedImages: 0,
    totalImages: 0,
  });

  // Configuration settings based on YAML
  const [trainingConfig, setTrainingConfig] = useState({
    // Network settings
    networkType: "lora",
    networkLinear: 32,
    networkLinearAlpha: 32,
    
    // Save settings
    saveEvery: 500,
    maxStepSavesToKeep: 4,
    saveFormat: "diffusers",
    pushToHub: false,
    
    // Training settings
    batchSize: 1,
    steps: 2000,
    gradientAccumulation: 1,
    trainUnet: true,
    trainTextEncoder: false,
    gradientCheckpointing: true,
    noiseScheduler: "flowmatch",
    optimizer: "adamw8bit",
    learningRate: 0.0001,
    dtype: "bf16",
    
    // EMA settings
    useEma: true,
    emaDecay: 0.99,
    
    // Model settings
    modelPath: "black-forest-labs/FLUX.1-dev",
    isFlux: true,
    quantize: true,
    lowVram: false,
    
    // Sample settings
    sampler: "flowmatch",
    sampleEvery: 250,
    sampleWidth: 1024,
    sampleHeight: 1024,
    guidanceScale: 4,
    sampleSteps: 20,
    seed: 42,
    walkSeed: true,
    
    // Dataset settings
    captionExt: "txt",
    captionDropoutRate: 0.05,
    shuffleTokens: false,
    cacheLatentsToDisk: true,
    resolution: [512, 768, 1024],
  });

  // Sample prompts
  const [samplePrompts, setSamplePrompts] = useState([
    "woman with red hair, playing chess at the park, bomb going off in the background",
    "a woman holding a coffee cup, in a beanie, sitting at a cafe",
  ]);

  const createTrainingJobMutation = trpc.createTrainingJob.useMutation({
    onSuccess: (data) => {
      router.push(`/workspace/training-jobs/${data.trainingJobId}`);
    },
    onError: (error) => {
      console.error("Training job creation failed:", error);
      // Handle error - show toast notification
    },
  });

  // Validation
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (step === 1) {
      if (!jobName.trim()) {
        newErrors.jobName = "Job name is required";
      } else if (jobName.length < 3) {
        newErrors.jobName = "Job name must be at least 3 characters";
      }
      
      if (trainingConfig.steps < 500 || trainingConfig.steps > 4000) {
        newErrors.steps = "Steps must be between 500 and 4000";
      }
    }
    
    if (step === 2) {
      if (images.length === 0) {
        newErrors.images = "Please upload at least one image";
      } else if (images.length < 10) {
        newErrors.images = "For best results, upload at least 10 images";
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const newImage: ImageFile = {
            file,
            caption: "",
            preview: e.target?.result as string,
          };
          setImages((prev) => [...prev, newImage]);
        };
        reader.readAsDataURL(file);
      }
    });
    
    // Clear errors when images are uploaded
    setErrors(prev => ({ ...prev, images: "" }));
  };

  // Drag and drop handlers
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

    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const newImage: ImageFile = {
            file,
            caption: "",
            preview: event.target?.result as string,
          };
          setImages((prev) => [...prev, newImage]);
        };
        reader.readAsDataURL(file);
      }
    });
    
    setErrors(prev => ({ ...prev, images: "" }));
  }, []);

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const updateImageCaption = (index: number, caption: string) => {
    setImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, caption } : img))
    );
  };

  const addSamplePrompt = () => {
    setSamplePrompts((prev) => [...prev, ""]);
  };

  const updateSamplePrompt = (index: number, prompt: string) => {
    setSamplePrompts((prev) => prev.map((p, i) => (i === index ? prompt : p)));
  };

  const removeSamplePrompt = (index: number) => {
    setSamplePrompts((prev) => prev.filter((_, i) => i !== index));
  };

  // Chunked upload function to handle large batches of images
  const uploadImagesInChunks = async (
    images: Array<{ file: File; caption: string }>
  ) => {
    const CHUNK_SIZE = 3; // Reduced to 3 images per batch to avoid 413 errors
    const chunks = [];

    // Split images into chunks
    for (let i = 0; i < images.length; i += CHUNK_SIZE) {
      chunks.push(images.slice(i, i + CHUNK_SIZE));
    }

    console.log(
      `📦 Uploading ${images.length} images in ${chunks.length} chunks (${CHUNK_SIZE} per chunk)`
    );

    // Initialize progress
    setUploadProgress({
      isUploading: true,
      currentChunk: 0,
      totalChunks: chunks.length,
      uploadedImages: 0,
      totalImages: images.length,
    });

    const allUploadedImages = [];

    // Upload each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkNumber = i + 1;

      console.log(
        `📤 Uploading chunk ${chunkNumber}/${chunks.length} (${chunk.length} images)`
      );

      // Update progress
      setUploadProgress((prev) => ({
        ...prev,
        currentChunk: chunkNumber,
      }));

      const formData = new FormData();

      // Add each image with proper field names and captions
      chunk.forEach((img, index) => {
        formData.append(`image_${index}`, img.file);
        formData.append(`caption_${index}`, img.caption || "");
      });

      console.log(
        `📋 FormData contents for chunk ${chunkNumber}:`,
        chunk.map((img, index) => ({
          file: img.file.name,
          size: img.file.size,
          caption: img.caption || "No caption",
        }))
      );

      const uploadResponse = await fetch("/api/upload/training-images", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error(`❌ Upload error for chunk ${chunkNumber}:`, errorText);
        setUploadProgress((prev) => ({ ...prev, isUploading: false }));
        throw new Error(`Failed to upload chunk ${chunkNumber}: ${errorText}`);
      }

      const chunkResult = await uploadResponse.json();
      console.log(
        `✅ Chunk ${chunkNumber} uploaded: ${chunkResult.count} images`
      );

      // Add uploaded images to the complete list
      allUploadedImages.push(...chunkResult.images);

      // Update progress
      setUploadProgress((prev) => ({
        ...prev,
        uploadedImages: allUploadedImages.length,
      }));

      // Small delay between chunks to avoid overwhelming the server
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500)); // Increased delay
      }
    }

    // Reset progress
    setUploadProgress((prev) => ({ ...prev, isUploading: false }));

    return { images: allUploadedImages, count: allUploadedImages.length };
  };

  const handleStartTraining = async () => {
    if (!jobName.trim()) {
      alert("Please enter a job name");
      return;
    }

    if (images.length === 0) {
      alert("Please upload at least one image");
      return;
    }

    if (samplePrompts.filter((p) => p.trim()).length === 0) {
      alert("Please add at least one sample prompt");
      return;
    }

    try {
      // Upload training images in chunks to avoid 413 payload limits
      console.log("📤 Uploading training images...");
      const uploadedImages = await uploadImagesInChunks(images);
      console.log("✅ All images uploaded:", uploadedImages);

      // Create image files array with the uploaded URLs (maintain original order)
      const uploadedImageFiles = uploadedImages.images.map(
        (img: any, index: number) => {
          // Find the original image that corresponds to this uploaded image
          const originalIndex = images.findIndex(
            (original) => original.file.name === img.originalName
          );
          return {
            filename: img.filename,
            caption:
              originalIndex >= 0 ? images[originalIndex].caption || "" : "",
            url: img.url,
            subfolder: "",
          };
        }
      );

      // Now create the training job with uploaded image URLs
      const trainingJobConfig = {
        name: jobName,
        trigger_word: triggerWord || null,
        network: {
          type: "lora" as const,
          linear: trainingConfig.networkLinear,
          linear_alpha: trainingConfig.networkLinearAlpha,
          conv: Math.floor(trainingConfig.networkLinear / 2),
          conv_alpha: Math.floor(trainingConfig.networkLinearAlpha / 2),
          lokr_full_rank: true,
          lokr_factor: -1,
          network_kwargs: { ignore_if_contains: [] },
        },
        save: {
          dtype: "bf16" as const,
          save_every: trainingConfig.saveEvery,
          max_step_saves_to_keep: trainingConfig.maxStepSavesToKeep,
          save_format: "diffusers" as const,
          push_to_hub: trainingConfig.pushToHub,
        },
        train: {
          batch_size: trainingConfig.batchSize,
          steps: trainingConfig.steps,
          gradient_accumulation: trainingConfig.gradientAccumulation,
          linear_timesteps: false,
          train_unet: trainingConfig.trainUnet,
          train_text_encoder: trainingConfig.trainTextEncoder,
          gradient_checkpointing: trainingConfig.gradientCheckpointing,
          noise_scheduler: "flowmatch" as const,
          optimizer: "adamw8bit" as const,
          timestep_type: "sigmoid" as const,
          content_or_style: "balanced" as const,
          lr: trainingConfig.learningRate,
          optimizer_params: { weight_decay: 0.0001 },
          unload_text_encoder: false,
          cache_text_embeddings: false,
          skip_first_sample: false,
          disable_sampling: false,
          dtype: "bf16" as const,
          diff_output_preservation: false,
          diff_output_preservation_multiplier: 1,
          diff_output_preservation_class: "person",
          ema_config: { 
            use_ema: trainingConfig.useEma, 
            ema_decay: trainingConfig.emaDecay 
          },
        },
        model: {
          name_or_path: trainingConfig.modelPath,
          quantize: trainingConfig.quantize,
          qtype: "qfloat8" as const,
          quantize_te: true,
          qtype_te: "qfloat8" as const,
          arch: "flux" as const,
          low_vram: trainingConfig.lowVram,
          model_kwargs: {},
        },
        sample: {
          sampler: "flowmatch" as const,
          sample_every: trainingConfig.sampleEvery,
          width: trainingConfig.sampleWidth,
          height: trainingConfig.sampleHeight,
          samples: samplePrompts
            .filter((p) => p.trim())
            .map((prompt) => ({ prompt })),
          neg: "",
          seed: trainingConfig.seed,
          walk_seed: trainingConfig.walkSeed,
          guidance_scale: trainingConfig.guidanceScale,
          sample_steps: trainingConfig.sampleSteps,
          num_frames: 1,
          fps: 1,
        },
      };

      const datasets = [
        {
          folder_path: "/workspace/training_data/images",
          control_path: null,
          mask_path: null,
          mask_min_value: 0.1,
          default_caption: "",
          caption_ext: trainingConfig.captionExt,
          caption_dropout_rate: trainingConfig.captionDropoutRate,
          cache_latents_to_disk: trainingConfig.cacheLatentsToDisk,
          is_reg: false,
          network_weight: 1,
          resolution: trainingConfig.resolution,
          controls: [],
          shrink_video_to_frames: true,
          num_frames: 1,
          do_i2v: true,
        },
      ];

      const input: CreateTrainingJobInput = {
        name: jobName,
        description,
        config: trainingJobConfig,
        datasets,
        imageFiles: uploadedImageFiles,
      };

      await createTrainingJobMutation.mutateAsync(input);
    } catch (error) {
      console.error("Failed to start training:", error);
      alert("Failed to start training. Please try again.");
    }
  };

  const steps = [
    { id: 1, name: "Configure Training", icon: Settings },
    { id: 2, name: "Upload Images", icon: ImageIcon },
    { id: 3, name: "Review & Start", icon: Play },
  ];

  // Tooltip component
  const Tooltip = ({ text }: { text: string }) => (
    <div className="group relative inline-block ml-1">
      <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
      <div className="invisible group-hover:visible absolute z-50 w-64 p-2 mt-1 text-xs text-white bg-gray-900 rounded-lg shadow-lg -left-24 top-5">
        {text}
        <div className="absolute w-2 h-2 bg-gray-900 transform rotate-45 -top-1 left-1/2"></div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-3xl shadow-2xl border border-blue-200 dark:border-blue-800 p-12 text-white text-center">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-white/20 rounded-3xl backdrop-blur-sm border border-white/30 shadow-2xl">
              <div className="relative">
                <Cpu className="w-16 h-16 text-white drop-shadow-lg" />
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                  <Zap className="w-4 h-4 text-yellow-800" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl font-bold drop-shadow-lg flex items-center justify-center space-x-4">
              <span>Train Custom LoRA</span>
              <span className="text-4xl">🧠</span>
            </h1>
            <p className="text-xl text-blue-100 font-medium opacity-90 max-w-3xl mx-auto leading-relaxed">
              Create a personalized AI model by training on your own images
              using
              <span className="text-yellow-300 font-bold"> RunPod's </span>
              powerful GPU infrastructure
            </p>

            <div className="flex items-center justify-center space-x-8 text-sm text-blue-100 pt-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="font-medium">GPU Powered</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-purple-300 rounded-full"></div>
                <span className="font-medium">Custom Models</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-300 rounded-full"></div>
                <span className="font-medium">High Quality</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700" style={{ width: `calc(100% - 96px)`, left: '48px' }}>
          <div 
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          ></div>
        </div>

        <div className="relative flex justify-between">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <div key={step.id} className="flex flex-col items-center space-y-2 bg-white dark:bg-gray-900 px-2">
                <button
                  onClick={() => {
                    if (step.id < currentStep || (step.id === currentStep + 1 && validateStep(currentStep))) {
                      setCurrentStep(step.id);
                    }
                  }}
                  disabled={step.id > currentStep + 1}
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 transform hover:scale-110
                    ${
                      isActive
                        ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/50"
                        : isCompleted
                        ? "bg-green-600 border-green-600 text-white cursor-pointer hover:shadow-lg"
                        : "border-gray-300 text-gray-400 dark:border-gray-600"
                    }
                    ${step.id > currentStep + 1 ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <Icon className="w-6 h-6" />
                  )}
                </button>
                <span
                  className={`text-sm font-medium transition-colors ${
                    isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {step.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        {currentStep === 1 && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Configure Training</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>Est. 2-4 hours</span>
              </div>
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Basic Information
              </h3>
              
              <div>
                <label className="text-sm font-medium mb-2 flex items-center">
                  Job Name *
                  <Tooltip text="A unique identifier for your training job. Use descriptive names like 'character_portrait_v1' or 'style_anime_v2'" />
                </label>
                <input
                  type="text"
                  value={jobName}
                  onChange={(e) => {
                    setJobName(e.target.value);
                    setErrors(prev => ({ ...prev, jobName: "" }));
                  }}
                  placeholder="e.g., my_first_flux_lora_v1"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 transition-colors ${
                    errors.jobName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {errors.jobName && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.jobName}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 flex items-center">
                  Description (Optional)
                  <Tooltip text="Add notes about what this model is for, the subject matter, or training goals" />
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this model is for..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 flex items-center">
                  Trigger Word (Optional)
                  <Tooltip text="A unique word that activates your LoRA. Examples: 'ohwx person', 'xyz style'. Leave empty if training on a general style." />
                </label>
                <input
                  type="text"
                  value={triggerWord}
                  onChange={(e) => setTriggerWord(e.target.value)}
                  placeholder="e.g., ohwx person"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                />
              </div>
            </div>

            {/* Training Configuration */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-600" />
                Core Training Settings
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 flex items-center">
                    Training Steps
                    <Tooltip text="Total number of training iterations. More steps = better quality but longer training. 500-1000 for quick tests, 2000+ for production." />
                  </label>
                  <input
                    type="number"
                    value={trainingConfig.steps}
                    onChange={(e) => {
                      setTrainingConfig(prev => ({
                        ...prev,
                        steps: parseInt(e.target.value) || 2000,
                      }));
                      setErrors(prev => ({ ...prev, steps: "" }));
                    }}
                    min="500"
                    max="4000"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 ${
                      errors.steps ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.steps ? (
                    <p className="mt-1 text-xs text-red-600">{errors.steps}</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      Current: {trainingConfig.steps} steps (~{Math.round(trainingConfig.steps / 500 * 0.5)} hours)
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 flex items-center">
                    Learning Rate
                    <Tooltip text="Controls how quickly the model learns. 0.0001 is a safe default. Lower = slower but more stable training." />
                  </label>
                  <input
                    type="number"
                    value={trainingConfig.learningRate}
                    onChange={(e) =>
                      setTrainingConfig(prev => ({
                        ...prev,
                        learningRate: parseFloat(e.target.value) || 0.0001,
                      }))
                    }
                    step="0.00001"
                    min="0.00001"
                    max="0.01"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Default: 0.0001 (recommended)
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 flex items-center">
                    Network Rank (Linear)
                    <Tooltip text="LoRA network size. Higher = more capacity but larger file size. 32 is a good balance, 16 for style, 64+ for complex subjects." />
                  </label>
                  <input
                    type="number"
                    value={trainingConfig.networkLinear}
                    onChange={(e) =>
                      setTrainingConfig(prev => ({
                        ...prev,
                        networkLinear: parseInt(e.target.value) || 32,
                      }))
                    }
                    min="8"
                    max="128"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current: Rank {trainingConfig.networkLinear}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 flex items-center">
                    Network Alpha
                    <Tooltip text="Scaling factor for LoRA weights. Usually set equal to rank for balanced training." />
                  </label>
                  <input
                    type="number"
                    value={trainingConfig.networkLinearAlpha}
                    onChange={(e) =>
                      setTrainingConfig(prev => ({
                        ...prev,
                        networkLinearAlpha: parseInt(e.target.value) || 32,
                      }))
                    }
                    min="8"
                    max="128"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 flex items-center">
                    Sample Every (Steps)
                    <Tooltip text="How often to generate preview images during training. More frequent = better monitoring but slightly slower." />
                  </label>
                  <input
                    type="number"
                    value={trainingConfig.sampleEvery}
                    onChange={(e) =>
                      setTrainingConfig(prev => ({
                        ...prev,
                        sampleEvery: parseInt(e.target.value) || 250,
                      }))
                    }
                    min="50"
                    max="1000"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Will generate ~{Math.floor(trainingConfig.steps / trainingConfig.sampleEvery)} preview images
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 flex items-center">
                    Save Every (Steps)
                    <Tooltip text="How often to save checkpoints. Allows you to pick the best version if training goes too far." />
                  </label>
                  <input
                    type="number"
                    value={trainingConfig.saveEvery}
                    onChange={(e) =>
                      setTrainingConfig(prev => ({
                        ...prev,
                        saveEvery: parseInt(e.target.value) || 500,
                      }))
                    }
                    min="100"
                    max="1000"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.floor(trainingConfig.steps / trainingConfig.saveEvery)} checkpoints will be saved
                  </p>
                </div>
              </div>
            </div>

            {/* Sample Prompts */}
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-green-600" />
                  Sample Prompts
                </h3>
                <span className="text-sm text-gray-500">{samplePrompts.length} prompts</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                These prompts will be used to generate preview images during training to monitor progress
              </p>
              <div className="space-y-2">
                {samplePrompts.map((prompt, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="flex-shrink-0 w-8 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-sm font-medium text-blue-600">
                      {index + 1}
                    </div>
                    <input
                      type="text"
                      value={prompt}
                      onChange={(e) =>
                        updateSamplePrompt(index, e.target.value)
                      }
                      placeholder={`Sample prompt ${index + 1}`}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                    />
                    {samplePrompts.length > 1 && (
                      <button
                        onClick={() => removeSamplePrompt(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remove prompt"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addSamplePrompt}
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Sample Prompt
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Upload Training Images</h2>
              {images.length > 0 && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {images.length} image{images.length !== 1 ? 's' : ''} uploaded
                </span>
              )}
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Best Practices for Training Images:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                    <li>Upload 10-100 high-quality images (20-50 recommended)</li>
                    <li>Use variety: different angles, lighting, backgrounds</li>
                    <li>Keep consistent subject/style across all images</li>
                    <li>Higher resolution is better (1024px+ recommended)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300
                ${isDragging 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105' 
                  : errors.images
                  ? 'border-red-300 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }
              `}
            >
              <div className="flex flex-col items-center gap-4">
                <div className={`p-4 rounded-full ${isDragging ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-100 dark:bg-gray-700'} transition-colors`}>
                  <Upload className={`w-12 h-12 ${isDragging ? 'text-blue-600' : 'text-gray-400'} transition-colors`} />
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">
                    {isDragging ? 'Drop images here' : 'Drag & drop images or click to browse'}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                    Supported formats: JPG, PNG, WebP
                  </p>
                </div>

                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 cursor-pointer transition-all hover:shadow-lg font-medium"
                >
                  <ImageIcon className="w-5 h-5" />
                  Choose Images
                </label>
              </div>
            </div>

            {errors.images && (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errors.images}</span>
              </div>
            )}

            {/* Image Grid */}
            {images.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">
                    Uploaded Images ({images.length})
                  </h3>
                  {images.length < 10 && (
                    <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Consider uploading more images
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {images.map((image, index) => (
                    <div 
                      key={index} 
                      className="relative group bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all"
                    >
                      <div className="aspect-square relative">
                        <img
                          src={image.preview}
                          alt={`Upload ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                          <button
                            onClick={() => removeImage(index)}
                            className="opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100 bg-red-600 text-white rounded-full p-2 hover:bg-red-700 shadow-lg"
                            title="Remove image"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full font-medium">
                          #{index + 1}
                        </div>
                      </div>
                      <div className="p-2">
                        <input
                          type="text"
                          placeholder="Add caption (optional)..."
                          value={image.caption}
                          onChange={(e) =>
                            updateImageCaption(index, e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 transition-all"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Batch Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      if (confirm(`Remove all ${images.length} images?`)) {
                        setImages([]);
                      }
                    }}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 text-sm font-medium flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Clear All
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {images.filter(img => img.caption).length} images have captions
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Review & Start Training</h2>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Ready to Train
              </div>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Images</h3>
                </div>
                <p className="text-3xl font-bold text-blue-600 mb-1">{images.length}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {images.filter(img => img.caption).length} with captions
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-600 rounded-lg">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Steps</h3>
                </div>
                <p className="text-3xl font-bold text-purple-600 mb-1">{trainingConfig.steps.toLocaleString()}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  ~{Math.round(trainingConfig.steps / 500 * 0.5 * 10) / 10}h training time
                </p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-600 rounded-lg">
                    <Settings className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Quality</h3>
                </div>
                <p className="text-3xl font-bold text-green-600 mb-1">Rank {trainingConfig.networkLinear}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {trainingConfig.quantize ? 'Quantized' : 'Full Precision'}
                </p>
              </div>
            </div>

            {/* Detailed Configuration */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Job Configuration
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Job Name</span>
                    <span className="font-medium text-gray-900 dark:text-white">{jobName}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Model</span>
                    <span className="font-medium text-gray-900 dark:text-white">FLUX.1-dev</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Trigger Word</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {triggerWord || <span className="text-gray-400">None</span>}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Network Type</span>
                    <span className="font-medium text-gray-900 dark:text-white uppercase">
                      {trainingConfig.networkType}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-600" />
                  Training Parameters
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Learning Rate</span>
                    <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                      {trainingConfig.learningRate}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Batch Size</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {trainingConfig.batchSize}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Precision</span>
                    <span className="font-medium text-gray-900 dark:text-white uppercase">
                      {trainingConfig.dtype}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Optimizer</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {trainingConfig.optimizer}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">EMA</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {trainingConfig.useEma ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-green-600" />
                  Sampling & Checkpoints
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Sample Every</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {trainingConfig.sampleEvery} steps
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Samples</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      ~{Math.floor(trainingConfig.steps / trainingConfig.sampleEvery)} images
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Save Every</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {trainingConfig.saveEvery} steps
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Checkpoints Kept</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {trainingConfig.maxStepSavesToKeep}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-yellow-600" />
                  Sample Prompts
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2 max-h-[240px] overflow-y-auto">
                  {samplePrompts.filter(p => p.trim()).map((prompt, index) => (
                    <div key={index} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2 py-2 border-b border-gray-200 dark:border-gray-600 last:border-0">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="flex-1">{prompt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Important Notice */}
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
                    <Info className="w-6 h-6 text-yellow-900" />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                    Training Process Overview
                  </h4>
                  <ul className="space-y-2 text-sm text-yellow-800 dark:text-yellow-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Your images will be uploaded securely to RunPod storage</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Training will start automatically on a GPU instance</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>You'll receive progress updates and sample images</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>The final LoRA model will be ready for download when complete</span>
                    </li>
                  </ul>
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">Estimated completion: {Math.round(trainingConfig.steps / 500 * 0.5 * 10) / 10} - {Math.round(trainingConfig.steps / 500 * 0.5 * 15) / 10} hours</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Progress Display */}
        {uploadProgress.isUploading && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-blue-800 dark:text-blue-200">
                Uploading Images...
              </h4>
              <span className="text-sm text-blue-600 dark:text-blue-300">
                Chunk {uploadProgress.currentChunk} of{" "}
                {uploadProgress.totalChunks}
              </span>
            </div>
            <div className="mb-2">
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      (uploadProgress.uploadedImages /
                        uploadProgress.totalImages) *
                      100
                    }%`,
                  }}
                ></div>
              </div>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Uploaded {uploadProgress.uploadedImages} of{" "}
              {uploadProgress.totalImages} images
            </p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-8 border-t border-gray-200 dark:border-gray-700 mt-8">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 transition-all font-medium"
            >
              <ChevronDown className="w-4 h-4 rotate-90" />
              Previous
            </button>
          )}

          {currentStep < 3 ? (
            <button
              onClick={() => {
                if (!validateStep(currentStep)) {
                  return;
                }
                setCurrentStep(currentStep + 1);
              }}
              className="ml-auto flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all hover:shadow-lg font-medium"
            >
              Next
              <ChevronDown className="w-4 h-4 -rotate-90" />
            </button>
          ) : (
            <button
              onClick={handleStartTraining}
              disabled={createTrainingJobMutation.isPending || uploadProgress.isUploading}
              className="ml-auto flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-green-500/50 font-medium text-lg disabled:hover:shadow-none"
            >
              {createTrainingJobMutation.isPending || uploadProgress.isUploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {uploadProgress.isUploading ? 'Uploading Images...' : 'Starting Training...'}
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Start Training
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
