"use client";

import { useState, useEffect, useCallback } from "react";import { createPortal } from "react-dom";import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import {
  ImageIcon,
  Download,
  Loader2,
  AlertCircle,
  Sparkles,
  RotateCcw,
  Zap,
  Upload,
  X,
  Folder,
  ChevronDown,
  RefreshCw,
} from "lucide-react";

interface AvailableFolderOption {
  name: string;
  prefix: string;
  displayPath: string;
  path: string;
  depth: number;
  isShared?: boolean;
  permission?: 'VIEW' | 'EDIT';
  parentPrefix?: string | null;
}

interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  modelVersion: string;
  size: string;
  createdAt: string;
  status: "completed" | "processing" | "failed";
}

export default function SeeDreamImageToImage() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();

  // Form State
  const [prompt, setPrompt] = useState("");
  const [selectedResolution, setSelectedResolution] = useState<"2K" | "4K">("2K");
  const [selectedRatio, setSelectedRatio] = useState<"1:1" | "3:4" | "4:3" | "16:9" | "9:16" | "2:3" | "3:2" | "21:9">("1:1");
  const [uploadedImages, setUploadedImages] = useState<Array<{ id: string; base64: string; file: File }>>([
  ]);
  const [maxImages, setMaxImages] = useState(1);

  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // History State
  const [generationHistory, setGenerationHistory] = useState<GeneratedImage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Modal state for viewing images
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // Folder Selection State
  const [targetFolder, setTargetFolder] = useState<string>("");
  const [availableFolders, setAvailableFolders] = useState<AvailableFolderOption[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  // Resolution and Ratio configurations
  const resolutionRatios = {
    "2K": {
      "1:1": "2048x2048",
      "3:4": "1728x2304",
      "4:3": "2304x1728",
      "16:9": "2560x1440",
      "9:16": "1440x2560",
      "2:3": "1664x2496",
      "3:2": "2496x1664",
      "21:9": "3024x1296",
    },
    "4K": {
      "1:1": "4096x4096",
      "3:4": "3520x4704",
      "4:3": "4704x3520",
      "16:9": "5504x3040",
      "9:16": "3040x5504",
      "2:3": "3328x4992",
      "3:2": "4992x3328",
      "21:9": "6240x2656",
    },
  };

  const aspectRatios = ["1:1", "3:4", "4:3", "16:9", "9:16", "2:3", "3:2", "21:9"] as const;

  // Get current size based on resolution and ratio
  const currentSize = resolutionRatios[selectedResolution][selectedRatio];

  // Load generation history when apiClient is available
  useEffect(() => {
    if (apiClient) {
      loadGenerationHistory();
    }
  }, [apiClient]);

  const loadGenerationHistory = async () => {
    if (!apiClient) return;
    setIsLoadingHistory(true);
    try {
      const response = await apiClient.get("/api/generate/seedream-image-to-image");
      if (response.ok) {
        const data = await response.json();
        setGenerationHistory(data.images || []);
      }
    } catch (error) {
      // Silently fail if endpoint doesn't exist yet
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadFolders = useCallback(async () => {
    if (!apiClient || !user) return;

    setIsLoadingFolders(true);
    try {
      const response = await apiClient.get('/api/s3/folders/list-custom');
      if (!response.ok) {
        throw new Error('Failed to load folders');
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.folders)) {
        const folderOptions: AvailableFolderOption[] = data.folders
          .filter((folder: any) => !folder.permission || folder.permission === 'EDIT')
          .map((folder: any) => ({
            name: folder.name || '',
            prefix: folder.prefix || '',
            displayPath: folder.path || folder.name || '',
            path: folder.path || '',
            depth: folder.depth || 0,
            isShared: folder.isShared || false,
            permission: folder.permission,
            parentPrefix: folder.parentPrefix,
          }));

        setAvailableFolders(folderOptions);
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
    } finally {
      setIsLoadingFolders(false);
    }
  }, [apiClient, user]);

  // Load folders on mount
  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImage = {
          id: `img-${Date.now()}`,
          base64: reader.result as string,
          file,
        };
        setUploadedImages((prev) => [...prev, newImage]);
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    e.target.value = '';
  };

  const handleRemoveImage = (imageId: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const handleGenerate = async () => {
    if (!apiClient) {
      setError("API client not available");
      return;
    }

    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    if (uploadedImages.length === 0) {
      setError("Please upload at least one reference image");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);
    
    const taskId = `seedream-i2i-${Date.now()}`;
    
    try {
      updateGlobalProgress({
        isGenerating: true,
        progress: 0,
        stage: "starting",
        message: "Starting SeeDream 4.5 Image-to-Image generation...",
        generationType: "image-to-image",
        jobId: taskId,
      });

      // Prepare request payload
      const payload: any = {
        prompt: prompt.trim(),
        model: "ep-20260103160511-gxx75",
        image: uploadedImages.length === 1 
          ? uploadedImages[0].base64 
          : uploadedImages.map(img => img.base64), // Array for multiple images, single string for one image
        watermark: false,
        sequential_image_generation: maxImages > 1 ? "auto" : "disabled",
        size: currentSize,
        targetFolder: targetFolder || undefined,
      };

      // Add batch generation config
      if (maxImages > 1) {
        payload.sequential_image_generation_options = {
          max_images: maxImages,
        };
      }

      const response = await apiClient.post("/api/generate/seedream-image-to-image", payload);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Generation failed");
      }

      const data = await response.json();
      
      updateGlobalProgress({
        isGenerating: false,
        progress: 100,
        stage: "completed",
        message: "Generation completed!",
        generationType: "image-to-image",
        jobId: taskId,
      });

      // Use the images returned from the API (already saved to database)
      const images: GeneratedImage[] = data.images.map((img: any) => ({
        id: img.id,
        imageUrl: img.url,
        prompt: img.prompt,
        modelVersion: img.model || "SeeDream 4.5",
        size: img.size,
        createdAt: img.createdAt,
        status: "completed" as const,
      }));

      setGeneratedImages(images);
      
      // Reload history to include newly generated images
      loadGenerationHistory();
      
    } catch (error: any) {
      console.error("Generation error:", error);
      setError(error.message || "Failed to generate images");
      updateGlobalProgress({
        isGenerating: false,
        progress: 0,
        stage: "failed",
        message: error.message || "Generation failed",
        generationType: "image-to-image",
        jobId: taskId,
      });
      setTimeout(() => clearGlobalProgress(), 3000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (imageUrl: string, filename: string) => {
    try {
      let downloadUrl = imageUrl;
      
      // If it's a base64 data URL, use it directly
      if (imageUrl.startsWith('data:')) {
        downloadUrl = imageUrl;
      } else {
        // For regular URLs, use the download proxy API to avoid CORS issues
        const proxyUrl = `/api/download/image?url=${encodeURIComponent(imageUrl)}`;
        downloadUrl = proxyUrl;
      }
      
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
      setError("Failed to download image. Please try again.");
    }
  };

  const handleReset = () => {
    setPrompt("");
    setSelectedResolution("2K");
    setSelectedRatio("1:1");
    setMaxImages(1);
    setError(null);
    setGeneratedImages([]);
    setUploadedImages([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 dark:from-cyan-500/5 dark:via-blue-500/5 dark:to-indigo-500/5 rounded-3xl blur-3xl" />
          <div className="relative flex items-center space-x-4 mb-4 p-6 bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl blur-lg opacity-60 animate-pulse" />
              <div className="relative p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                SeeDream 4.5 - Image to Image
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base flex items-center mt-1">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                Transform images with AI-powered editing by BytePlus
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Generation Controls */}
          <div className="lg:col-span-1">
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 space-y-6 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-cyan-500/10 transition-all duration-300">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reference Images * {uploadedImages.length > 0 && `(${uploadedImages.length})`}
                </label>
                
                {/* Uploaded Images Grid */}
                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {uploadedImages.map((img, index) => (
                      <div key={img.id} className="relative group">
                        <div className="relative overflow-hidden rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                          <img
                            src={img.base64}
                            alt={`Reference ${index + 1}`}
                            className="w-full h-32 object-contain p-2"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          <button
                            onClick={() => handleRemoveImage(img.id)}
                            disabled={isGenerating}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-lg hover:scale-110"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <div className="absolute bottom-2 left-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-lg">
                            Image {index + 1}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Upload New Image Button */}
                <label className="group flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-cyan-300 dark:border-cyan-600 rounded-xl cursor-pointer bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 hover:from-cyan-100 hover:to-blue-100 dark:hover:from-cyan-900/30 dark:hover:to-blue-900/30 transition-all duration-300 hover:border-cyan-400 dark:hover:border-cyan-500 hover:shadow-lg hover:scale-[1.01]">
                  <div className="flex flex-col items-center justify-center py-4">
                    <div className="relative mb-2">
                      <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                      <Upload className="relative w-8 h-8 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">
                        {uploadedImages.length === 0 ? 'Upload Primary Image' : 'Add Reference Image'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      PNG, JPG, WEBP (MAX. 10MB)
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isGenerating}
                  />
                </label>
                
                {uploadedImages.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    First image is primary, others are reference images for style/composition
                  </p>
                )}
              </div>

              {/* Prompt Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Prompt *
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe how you want to transform the image..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                  rows={4}
                  disabled={isGenerating}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Recommended: Keep under 600 words for best results
                </p>
              </div>

              {/* Resolution & Aspect Ratio Configuration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Resolution
                </label>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    onClick={() => setSelectedResolution("2K")}
                    className={`p-3 rounded-xl border-2 transition-all duration-300 hover:scale-105 ${
                      selectedResolution === "2K"
                        ? "border-cyan-500 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/30 dark:to-blue-900/30 shadow-lg shadow-cyan-500/20"
                        : "border-gray-200 dark:border-gray-600 hover:border-cyan-300 dark:hover:border-cyan-600 bg-white dark:bg-gray-800"
                    }`}
                    disabled={isGenerating}
                  >
                    <div className="font-bold text-gray-900 dark:text-gray-100">2K</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">~2048px</div>
                  </button>
                  <button
                    onClick={() => setSelectedResolution("4K")}
                    className={`p-3 rounded-xl border-2 transition-all duration-300 hover:scale-105 ${
                      selectedResolution === "4K"
                        ? "border-cyan-500 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/30 dark:to-blue-900/30 shadow-lg shadow-cyan-500/20"
                        : "border-gray-200 dark:border-gray-600 hover:border-cyan-300 dark:hover:border-cyan-600 bg-white dark:bg-gray-800"
                    }`}
                    disabled={isGenerating}
                  >
                    <div className="font-bold text-gray-900 dark:text-gray-100">4K</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">~4096px</div>
                  </button>
                </div>

                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Aspect Ratio
                </label>
                
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {aspectRatios.map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setSelectedRatio(ratio)}
                      className={`p-2.5 rounded-lg border-2 transition-all duration-300 hover:scale-105 ${
                        selectedRatio === ratio
                          ? "border-cyan-500 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/30 dark:to-blue-900/30 shadow-md shadow-cyan-500/20"
                          : "border-gray-200 dark:border-gray-600 hover:border-cyan-300 dark:hover:border-cyan-600 bg-white dark:bg-gray-800"
                      }`}
                      disabled={isGenerating}
                    >
                      <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                        {ratio}
                      </div>
                    </button>
                  ))}
                </div>

                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Image Size
                </label>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Width
                    </label>
                    <input
                      type="text"
                      value={currentSize.split('x')[0]}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-center font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Height
                    </label>
                    <input
                      type="text"
                      value={currentSize.split('x')[1]}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-center font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Folder Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <div className="flex items-center space-x-2">
                    <Folder className="w-4 h-4" />
                    <span>Save to Folder</span>
                  </div>
                </label>
                <div className="relative">
                  <select
                    value={targetFolder}
                    onChange={(e) => setTargetFolder(e.target.value)}
                    disabled={isGenerating || isLoadingFolders}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
                  >
                    <option value="">Default Folder</option>
                    {availableFolders.map((folder) => (
                      <option key={folder.prefix} value={folder.prefix}>
                        {folder.displayPath}
                        {folder.isShared && ' (Shared)'}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {targetFolder
                    ? `Images will be saved to: ${availableFolders.find(f => f.prefix === targetFolder)?.displayPath || 'Selected folder'}`
                    : 'Images will be saved to your root outputs folder'}
                </p>
              </div>

              {/* Batch Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Batch Size: {maxImages}
                </label>
                <input
                  type="range"
                  min="1"
                  max="15"
                  value={maxImages}
                  onChange={(e) => setMaxImages(Number(e.target.value))}
                  className="w-full"
                  disabled={isGenerating}
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>1</span>
                  <span>15</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                  Generate {maxImages} {maxImages === 1 ? 'image' : 'images'} per request
                </p>
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-300">
                  💡 Tip: If your prompt specifies a number (e.g., "Generate 3 images..."), set batch size to match that number for best results.
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim() || uploadedImages.length === 0}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      <span>Generate</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleReset}
                  disabled={isGenerating}
                  className="p-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Reset form"
                >
                  <RotateCcw className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-2">
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-cyan-500/10 transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent flex items-center">
                  <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg mr-3 shadow-lg">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                  Generated Images
                </h2>
                {generatedImages.length > 0 && (
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                    {generatedImages.length} {generatedImages.length === 1 ? 'image' : 'images'}
                  </div>
                )}
              </div>

              {/* Generated Images Grid */}
              {generatedImages.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {generatedImages.map((image) => (
                    <div
                      key={image.id}
                      className="group relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-cyan-400 dark:hover:border-cyan-600 hover:shadow-2xl hover:shadow-cyan-500/20 transition-all duration-300 hover:scale-[1.02]"
                    >
                      <div className="relative overflow-hidden">
                        <img
                          src={image.imageUrl}
                          alt={image.prompt}
                          className="w-full h-auto transform group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                            <button
                              onClick={() =>
                                handleDownload(
                                  image.imageUrl,
                                  `seedream-i2i-${image.id}.jpg`
                                )
                              }
                              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-lg hover:shadow-xl font-semibold"
                            >
                              <Download className="w-4 h-4" />
                              <span>Download</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      {image.size && (
                        <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
                          {image.size}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-100 dark:bg-cyan-900/20 rounded-full mb-4">
                    <ImageIcon className="w-8 h-8 text-cyan-500" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">
                    {isGenerating
                      ? "Generating your images..."
                      : "Your generated images will appear here"}
                  </p>
                </div>
              )}

              {/* Generation History */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <RefreshCw className="w-5 h-5 mr-2 text-gray-500" />
                  Recent Generations
                </h3>
                {generationHistory.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {generationHistory.slice(0, 8).map((image) => (
                      <div
                        key={image.id}
                        className="group relative aspect-square bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all cursor-pointer"
                        onClick={() => {
                          setSelectedImage(image);
                          setShowImageModal(true);
                        }}
                      >
                        <img
                          src={image.imageUrl}
                          alt={image.prompt}
                          className="w-full h-full object-cover"
                        />

                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      {isLoadingHistory ? "Loading history..." : "No previous generations yet"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {showImageModal && selectedImage && typeof window !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => {
            setShowImageModal(false);
            setSelectedImage(null);
          }}
        >
          <div 
            className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => {
                setShowImageModal(false);
                setSelectedImage(null);
              }}
              className="absolute top-4 right-4 z-10 p-2 bg-gray-900/80 hover:bg-gray-900 text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Image container */}
            <div className="p-6">
              <div className="bg-black rounded-xl overflow-hidden mb-4 max-h-[60vh] flex items-center justify-center">
                <img
                  src={selectedImage.imageUrl}
                  alt={selectedImage.prompt}
                  className="w-full h-auto max-h-[60vh] object-contain"
                />
              </div>

              {/* Image details */}
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Image Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Prompt:</span>
                    <p className="text-gray-900 dark:text-white mt-1">{selectedImage.prompt}</p>
                  </div>
                  <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                    <span>
                      Size: {selectedImage.size}
                    </span>
                    <span>
                      Model: {selectedImage.modelVersion}
                    </span>
                  </div>
                </div>

                {/* Download button */}
                <button
                  onClick={async () => {
                    try {
                      let downloadUrl = selectedImage.imageUrl;
                      
                      if (selectedImage.imageUrl.startsWith('data:')) {
                        downloadUrl = selectedImage.imageUrl;
                      } else {
                        const response = await fetch(selectedImage.imageUrl);
                        const blob = await response.blob();
                        downloadUrl = window.URL.createObjectURL(blob);
                      }
                      
                      const a = document.createElement('a');
                      a.href = downloadUrl;
                      a.download = `seedream-i2i-${selectedImage.id}.jpg`;
                      document.body.appendChild(a);
                      a.click();
                      
                      if (!selectedImage.imageUrl.startsWith('data:')) {
                        window.URL.revokeObjectURL(downloadUrl);
                      }
                      document.body.removeChild(a);
                    } catch (error) {
                      console.error("Download failed:", error);
                    }
                  }}
                  className="w-full mt-4 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Image
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
