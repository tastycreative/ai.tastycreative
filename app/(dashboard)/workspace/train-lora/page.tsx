"use client";

import { useState } from "react";
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
  ChevronUp,
  X,
  Plus,
} from "lucide-react";

interface ImageFile {
  file: File;
  caption: string;
  preview: string;
}

export default function TrainLoRAPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [jobName, setJobName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerWord, setTriggerWord] = useState("");
  const [selectedPreset, setSelectedPreset] =
    useState<TrainingPreset>("character");
  const [images, setImages] = useState<ImageFile[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState({
    isUploading: false,
    currentChunk: 0,
    totalChunks: 0,
    uploadedImages: 0,
    totalImages: 0,
  });

  // Advanced settings
  const [advancedSettings, setAdvancedSettings] = useState({
    steps: 1500,
    learningRate: 0.0001,
    batchSize: 1,
    networkRank: 32,
    networkAlpha: 32,
    sampleEvery: 250,
    saveEvery: 250,
  });

  // Sample prompts
  const [samplePrompts, setSamplePrompts] = useState([
    "a photo of a person",
    "portrait of a person, professional lighting",
    "a person in casual clothes, outdoor setting",
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
  };

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
    const CHUNK_SIZE = 5; // Upload 5 images per batch to avoid 413 errors
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
      chunk.forEach((img) => {
        formData.append("images", img.file);
      });

      const uploadResponse = await fetch("/api/upload/training-images", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
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
        await new Promise((resolve) => setTimeout(resolve, 1000));
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
      const preset = trainingPresets[selectedPreset];

      const trainingConfig = {
        name: jobName,
        trigger_word: triggerWord || null,
        network: {
          type: "lora" as const,
          linear: showAdvanced
            ? advancedSettings.networkRank
            : preset.config.network.linear,
          linear_alpha: showAdvanced
            ? advancedSettings.networkAlpha
            : preset.config.network.linear_alpha,
          conv: showAdvanced
            ? advancedSettings.networkRank / 2
            : preset.config.network.conv,
          conv_alpha: showAdvanced
            ? advancedSettings.networkAlpha / 2
            : preset.config.network.conv_alpha,
          lokr_full_rank: true,
          lokr_factor: -1,
          network_kwargs: { ignore_if_contains: [] },
        },
        save: {
          dtype: "bf16" as const,
          save_every: showAdvanced ? advancedSettings.saveEvery : 250,
          max_step_saves_to_keep: 4,
          save_format: "diffusers" as const,
          push_to_hub: false,
        },
        train: {
          batch_size: showAdvanced
            ? advancedSettings.batchSize
            : preset.config.train.batch_size,
          steps: showAdvanced
            ? advancedSettings.steps
            : preset.config.train.steps,
          gradient_accumulation: 1, // Fixed to match ai-toolkit exactly
          linear_timesteps: false,
          train_unet: true,
          train_text_encoder: false,
          gradient_checkpointing: true,
          noise_scheduler: "flowmatch" as const,
          optimizer: "adamw8bit" as const,
          timestep_type: "sigmoid" as const,
          content_or_style: preset.config.train.content_or_style,
          lr: showAdvanced
            ? advancedSettings.learningRate
            : preset.config.train.lr,
          optimizer_params: { weight_decay: 0.0001 },
          unload_text_encoder: false,
          cache_text_embeddings: false,
          skip_first_sample: false,
          disable_sampling: false,
          dtype: "bf16" as const,
          diff_output_preservation: false,
          diff_output_preservation_multiplier: 1,
          diff_output_preservation_class: "person",
          ema_config: { use_ema: false, ema_decay: 0.99 },
        },
        model: {
          name_or_path: "black-forest-labs/FLUX.1-dev",
          quantize: true,
          qtype: "qfloat8" as const,
          quantize_te: true,
          qtype_te: "qfloat8" as const,
          arch: "flux" as const,
          low_vram: false,
          model_kwargs: {},
        },
        sample: {
          sampler: "flowmatch" as const,
          sample_every: showAdvanced ? advancedSettings.sampleEvery : 250,
          width: 1024,
          height: 1024,
          samples: samplePrompts
            .filter((p) => p.trim())
            .map((prompt) => ({ prompt })),
          neg: "",
          seed: 42,
          walk_seed: true,
          guidance_scale: 4,
          sample_steps: 25,
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
          caption_ext: "txt",
          caption_dropout_rate: 0.05,
          cache_latents_to_disk: false,
          is_reg: false,
          network_weight: 1,
          resolution: [512, 768, 1024],
          controls: [],
          shrink_video_to_frames: true,
          num_frames: 1,
          do_i2v: true,
        },
      ];

      const imageFiles = images.map((img) => ({
        filename: img.file.name,
        caption: img.caption,
        subfolder: "",
      }));

      const input: CreateTrainingJobInput = {
        name: jobName,
        description,
        config: trainingConfig,
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
    { id: 1, name: "Basic Info", icon: FileText },
    { id: 2, name: "Upload Images", icon: ImageIcon },
    { id: 3, name: "Configure Training", icon: Settings },
    { id: 4, name: "Review & Start", icon: Play },
  ];

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
      <div className="flex justify-between mb-8">
        {steps.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <div key={step.id} className="flex flex-col items-center space-y-2">
              <div
                className={`
                w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors
                ${
                  isActive
                    ? "bg-blue-600 border-blue-600 text-white"
                    : isCompleted
                    ? "bg-green-600 border-green-600 text-white"
                    : "border-gray-300 text-gray-400"
                }
              `}
              >
                <Icon className="w-6 h-6" />
              </div>
              <span
                className={`text-sm font-medium ${
                  isActive ? "text-blue-600" : "text-gray-500"
                }`}
              >
                {step.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold mb-6">Basic Information</h2>

            <div>
              <label className="block text-sm font-medium mb-2">
                Job Name *
              </label>
              <input
                type="text"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="e.g., my_character_v1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Description (Optional)
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
              <label className="block text-sm font-medium mb-2">
                Trigger Word (Optional)
              </label>
              <input
                type="text"
                value={triggerWord}
                onChange={(e) => setTriggerWord(e.target.value)}
                placeholder="e.g., ohwx person"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
              />
              <p className="text-sm text-gray-500 mt-1">
                A unique word to activate your trained model in prompts
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Training Preset
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(trainingPresets).map(([key, preset]) => (
                  <div
                    key={key}
                    onClick={() => setSelectedPreset(key as TrainingPreset)}
                    className={`
                      p-4 border-2 rounded-lg cursor-pointer transition-colors
                      ${
                        selectedPreset === key
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-300 dark:border-gray-600 hover:border-blue-300"
                      }
                    `}
                  >
                    <h3 className="font-medium">{preset.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {preset.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold mb-6">
              Upload Training Images
            </h2>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">Upload Images</h3>
              <p className="text-gray-500 mb-4">
                Select 10-100 high-quality images. Supported formats: JPG, PNG,
                WebP
              </p>
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
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                Choose Images
              </label>
            </div>

            {/* Image Grid */}
            {images.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">
                  Uploaded Images ({images.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {images.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={image.preview}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <input
                        type="text"
                        placeholder="Caption (optional)"
                        value={image.caption}
                        onChange={(e) =>
                          updateImageCaption(index, e.target.value)
                        }
                        className="w-full mt-2 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold mb-6">Configure Training</h2>

            {/* Sample Prompts */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Sample Prompts
              </label>
              <p className="text-sm text-gray-500 mb-4">
                These prompts will be used to generate sample images during
                training
              </p>
              <div className="space-y-2">
                {samplePrompts.map((prompt, index) => (
                  <div key={index} className="flex gap-2">
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
                        className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addSamplePrompt}
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Add Sample Prompt
                </button>
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
              >
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                Advanced Settings
              </button>
            </div>

            {/* Advanced Settings Panel */}
            {showAdvanced && (
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Training Steps
                    </label>
                    <input
                      type="number"
                      value={advancedSettings.steps}
                      onChange={(e) =>
                        setAdvancedSettings((prev) => ({
                          ...prev,
                          steps: parseInt(e.target.value) || 1500,
                        }))
                      }
                      min="100"
                      max="2000"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Maximum 2000 steps to prevent timeout issues. 2000 steps typically takes 2+ hours.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Learning Rate
                    </label>
                    <input
                      type="number"
                      value={advancedSettings.learningRate}
                      onChange={(e) =>
                        setAdvancedSettings((prev) => ({
                          ...prev,
                          learningRate: parseFloat(e.target.value) || 0.0001,
                        }))
                      }
                      step="0.00001"
                      min="0.00001"
                      max="0.01"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Network Rank
                    </label>
                    <input
                      type="number"
                      value={advancedSettings.networkRank}
                      onChange={(e) =>
                        setAdvancedSettings((prev) => ({
                          ...prev,
                          networkRank: parseInt(e.target.value) || 32,
                        }))
                      }
                      min="8"
                      max="128"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Sample Every (Steps)
                    </label>
                    <input
                      type="number"
                      value={advancedSettings.sampleEvery}
                      onChange={(e) =>
                        setAdvancedSettings((prev) => ({
                          ...prev,
                          sampleEvery: parseInt(e.target.value) || 250,
                        }))
                      }
                      min="50"
                      max="1000"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold mb-6">
              Review & Start Training
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Training Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Job Name:
                    </span>
                    <span>{jobName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Preset:
                    </span>
                    <span>{trainingPresets[selectedPreset].name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Images:
                    </span>
                    <span>{images.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Steps:
                    </span>
                    <span>
                      {showAdvanced
                        ? advancedSettings.steps
                        : trainingPresets[selectedPreset].config.train.steps}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Estimated Time:
                    </span>
                    <span>~2-4 hours</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Requirements</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    RunPod GPU Instance
                  </div>
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    AI-Toolkit Environment
                  </div>
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Info className="w-4 h-4" />
                    Training will be monitored automatically
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                    Training Process
                  </h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Your images will be uploaded to RunPod, training will start
                    automatically, and you'll receive progress updates. The
                    final LoRA model will be available for download once
                    training completes.
                  </p>
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
        <div className="flex justify-between pt-8 border-t border-gray-200 dark:border-gray-700">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Previous
            </button>
          )}

          {currentStep < 4 ? (
            <button
              onClick={() => {
                if (currentStep === 1 && !jobName.trim()) {
                  alert("Please enter a job name");
                  return;
                }
                if (currentStep === 2 && images.length === 0) {
                  alert("Please upload at least one image");
                  return;
                }
                setCurrentStep(currentStep + 1);
              }}
              className="ml-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleStartTraining}
              disabled={createTrainingJobMutation.isPending}
              className="ml-auto flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createTrainingJobMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Starting Training...
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
