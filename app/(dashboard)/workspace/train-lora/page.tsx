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
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Brain,
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
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20 rounded-2xl shadow-lg border border-blue-100 dark:border-gray-700">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative p-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-6">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 dark:from-white dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent mb-4">
            Train Custom LoRA Model
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl mx-auto">
            Create a personalized AI model by training on your own images using
            RunPod's powerful infrastructure
          </p>
          <div className="flex items-center justify-center space-x-6 mt-6">
            <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
              RunPod Infrastructure
            </div>
            <div className="flex items-center text-sm text-indigo-600 dark:text-indigo-400">
              <div className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></div>
              Custom Training
            </div>
            <div className="flex items-center text-sm text-purple-600 dark:text-purple-400">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
              High Quality Results
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Progress Steps */}
      <div className="relative">
        <div className="flex justify-between items-center">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <div
                key={step.id}
                className="flex flex-col items-center relative z-10"
              >
                {/* Connection Line */}
                {index < steps.length - 1 && (
                  <div className="absolute top-6 left-1/2 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -z-10">
                    <div
                      className={`h-full transition-all duration-500 ${
                        currentStep > step.id
                          ? "bg-gradient-to-r from-blue-500 to-purple-600"
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}
                      style={{ width: currentStep > step.id ? "100%" : "0%" }}
                    />
                  </div>
                )}

                <div
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-lg
                    ${
                      isActive
                        ? "bg-gradient-to-br from-blue-500 to-indigo-600 border-blue-500 text-white shadow-blue-500/25"
                        : isCompleted
                        ? "bg-gradient-to-br from-green-500 to-green-600 border-green-500 text-white shadow-green-500/25"
                        : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500"
                    }
                  `}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div className="mt-3 text-center">
                  <span
                    className={`text-sm font-medium transition-colors ${
                      isActive
                        ? "text-blue-600 dark:text-blue-400"
                        : isCompleted
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {step.name}
                  </span>
                  {isActive && (
                    <div className="mt-1 w-2 h-2 bg-blue-500 rounded-full mx-auto animate-pulse"></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enhanced Step Content */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-blue-50/30 dark:from-gray-800 dark:via-gray-800 dark:to-blue-900/10 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
        {currentStep === 1 && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg mb-4">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Basic Information
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Let's start with the basics for your LoRA training
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Job Name *
                </label>
                <input
                  type="text"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="e.g., my_character_v1"
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this model is for..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Trigger Word (Optional)
                </label>
                <input
                  type="text"
                  value={triggerWord}
                  onChange={(e) => setTriggerWord(e.target.value)}
                  placeholder="e.g., ohwx person"
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 flex items-center">
                  <Info className="w-4 h-4 mr-1" />A unique word to activate
                  your trained model in prompts
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Training Preset
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(trainingPresets).map(([key, preset]) => (
                    <div
                      key={key}
                      onClick={() => setSelectedPreset(key as TrainingPreset)}
                      className={`
                        p-4 border-2 rounded-xl cursor-pointer text-left transition-all hover:shadow-md
                        ${
                          selectedPreset === key
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-gray-200 dark:border-gray-600 hover:border-gray-300"
                        }
                      `}
                    >
                      <div className="flex items-start space-x-3">
                        <div
                          className={`w-3 h-3 rounded-full mt-1 ${
                            selectedPreset === key
                              ? "bg-blue-500"
                              : "bg-gray-300"
                          }`}
                        />
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {preset.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {preset.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg mb-4">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Upload Training Images
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                High-quality images are key to successful LoRA training
              </p>
            </div>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-8 text-center hover:border-purple-400 transition-colors group">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 rounded-2xl mb-4 group-hover:scale-105 transition-transform">
                <Upload className="w-10 h-10 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Upload Images
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Select 10-100 high-quality images for optimal results
                <br />
                <span className="text-sm">
                  Supported formats: JPG, PNG, WebP
                </span>
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
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 cursor-pointer transform hover:scale-105 transition-all shadow-lg font-semibold"
              >
                <Upload className="w-5 h-5 mr-2" />
                Choose Images
              </label>
            </div>

            {/* Enhanced Image Grid */}
            {images.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Uploaded Images ({images.length})
                  </h3>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {images.length < 10
                      ? "Add more images for better results"
                      : images.length > 50
                      ? "Great collection!"
                      : "Good amount of images"}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {images.map((image, index) => (
                    <div
                      key={index}
                      className="relative group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all"
                    >
                      <img
                        src={image.preview}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-36 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => removeImage(index)}
                          className="bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transform hover:scale-110 transition-all shadow-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="p-3">
                        <input
                          type="text"
                          placeholder="Caption (optional)"
                          value={image.caption}
                          onChange={(e) =>
                            updateImageCaption(index, e.target.value)
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-lg mb-4">
                <Settings className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Configure Training
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Fine-tune your model's training parameters
              </p>
            </div>

            {/* Enhanced Sample Prompts */}
            <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-700/50 dark:to-blue-900/10 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center mr-3">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Sample Prompts
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    These prompts will generate sample images during training
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {samplePrompts.map((prompt, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={prompt}
                        onChange={(e) =>
                          updateSamplePrompt(index, e.target.value)
                        }
                        placeholder={`Sample prompt ${
                          index + 1
                        } - e.g., "a portrait of ${
                          triggerWord || "[trigger]"
                        } person"`}
                        className="w-full pl-4 pr-12 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                        {prompt.length}/200
                      </div>
                    </div>
                    {samplePrompts.length > 1 && (
                      <button
                        onClick={() => removeSamplePrompt(index)}
                        className="flex items-center justify-center w-12 h-12 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addSamplePrompt}
                  className="flex items-center justify-center gap-2 w-full py-3 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Add Sample Prompt
                </button>
              </div>
            </div>

            {/* Enhanced Advanced Settings Toggle */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold transition-colors"
              >
                <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                  {showAdvanced ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
                Advanced Training Settings
                <span className="text-sm text-gray-500 dark:text-gray-400 font-normal">
                  (Optional - defaults work well)
                </span>
              </button>
            </div>
            {/* Enhanced Advanced Settings Panel */}
            {showAdvanced && (
              <div className="bg-gradient-to-br from-gray-50 to-indigo-50/30 dark:from-gray-700/50 dark:to-indigo-900/10 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
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
                      max="10000"
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
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
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
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
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
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
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg mb-4">
                <Play className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Review & Start Training
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Everything looks good? Let's start training your LoRA model!
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Enhanced Training Summary */}
              <div className="bg-gradient-to-br from-gray-50 to-green-50/30 dark:from-gray-700/50 dark:to-green-900/10 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mr-3">
                    <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Training Summary
                  </h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">
                      Job Name:
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {jobName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">
                      Preset:
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {trainingPresets[selectedPreset].name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">
                      Images:
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {images.length} images
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">
                      Training Steps:
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {showAdvanced
                        ? advancedSettings.steps
                        : trainingPresets[selectedPreset].config.train.steps}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">
                      Estimated Time:
                    </span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      ~2-4 hours
                    </span>
                  </div>
                </div>
              </div>

              {/* Enhanced Requirements */}
              <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-700/50 dark:to-blue-900/10 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-3">
                    <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Infrastructure
                  </h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div>
                      <div className="font-semibold text-green-800 dark:text-green-200">
                        RunPod GPU Instance
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-400">
                        High-performance cloud GPU ready
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div>
                      <div className="font-semibold text-green-800 dark:text-green-200">
                        AI-Toolkit Environment
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-400">
                        Optimized training environment
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <Info className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="font-semibold text-blue-800 dark:text-blue-200">
                        Automatic Monitoring
                      </div>
                      <div className="text-sm text-blue-600 dark:text-blue-400">
                        Real-time progress tracking
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Process Info */}
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-200 dark:border-yellow-700 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                    Training Process Overview
                  </h4>
                  <p className="text-yellow-700 dark:text-yellow-300 leading-relaxed">
                    Your images will be uploaded to RunPod's secure cloud
                    infrastructure, training will start automatically using our
                    optimized AI-Toolkit environment, and you'll receive
                    real-time progress updates. The final LoRA model will be
                    available for download once training completes successfully.
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-sm text-yellow-600 dark:text-yellow-400">
                    <Clock className="w-4 h-4" />
                    <span>
                      Training typically completes within 2-4 hours depending on
                      complexity
                    </span>
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

        {/* Enhanced Navigation Buttons */}
        <div className="flex justify-between items-center pt-8 border-t border-gray-200 dark:border-gray-700">
          {currentStep > 1 ? (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-all font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
          ) : (
            <div></div>
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
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all font-semibold"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleStartTraining}
              disabled={createTrainingJobMutation.isPending}
              className="flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:via-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 transition-all font-bold text-lg"
            >
              {createTrainingJobMutation.isPending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Starting Training...
                </>
              ) : (
                <>
                  <Zap className="w-6 h-6" />
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
