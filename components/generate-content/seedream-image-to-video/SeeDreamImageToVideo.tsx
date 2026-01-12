"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useGenerationProgress } from "@/lib/generationContext";
import {
  Video,
  Download,
  Loader2,
  AlertCircle,
  Sparkles,
  RotateCcw,
  Zap,
  Upload,
  Image as ImageIcon,
  X,
  Play,
  Clock,
  Film,
  Folder,
  ChevronDown,
  RefreshCw,
  Info,
  Settings,
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

interface GeneratedVideo {
  id: string;
  videoUrl: string;
  prompt: string;
  modelVersion: string;
  duration: number;
  cameraFixed: boolean;
  createdAt: string;
  status: "completed" | "processing" | "failed";
}

export default function SeeDreamImageToVideo() {
  const apiClient = useApiClient();
  const { user } = useUser();
  const { updateGlobalProgress, clearGlobalProgress } = useGenerationProgress();

  // Form State
  const [prompt, setPrompt] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string>("");
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(4);
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9" | "adaptive">("16:9");
  const [cameraFixed, setCameraFixed] = useState(false);
  const [generateAudio, setGenerateAudio] = useState(true);

  // Duration slider value (0 = Auto, 1-9 = 4-12 seconds)
  const [durationSliderValue, setDurationSliderValue] = useState(1);

  // Convert slider value to actual duration
  const getActualDuration = (sliderValue: number): number => {
    if (sliderValue === 0) return -1; // Auto
    return sliderValue + 3; // 1->4, 2->5, ..., 9->12
  };

  // Convert actual duration to slider value
  const getSliderValue = (actualDuration: number): number => {
    if (actualDuration === -1) return 0; // Auto
    return actualDuration - 3; // 4->1, 5->2, ..., 12->9
  };

  // Modal state for viewing videos
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);

  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState<string>("");

  // Folder Selection State
  const [targetFolder, setTargetFolder] = useState<string>("");
  const [availableFolders, setAvailableFolders] = useState<AvailableFolderOption[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  // Generation History State
  const [generationHistory, setGenerationHistory] = useState<GeneratedVideo[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load available folders
  const loadFolders = useCallback(async () => {
    if (!apiClient || !user) return;
    
    setIsLoadingFolders(true);
    try {
      const response = await apiClient.get("/api/s3/folders/list-custom");
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
      console.error("Failed to load folders:", error);
    } finally {
      setIsLoadingFolders(false);
    }
  }, [apiClient, user]);

  // Load generation history
  useEffect(() => {
    if (apiClient) {
      loadFolders();
      loadGenerationHistory();
    }
  }, [apiClient, loadFolders]);

  const loadGenerationHistory = async () => {
    if (!apiClient) return;
    
    setIsLoadingHistory(true);
    try {
      const response = await apiClient.get("/api/generate/seedream-image-to-video?history=true");
      if (response.ok) {
        const data = await response.json();
        setGenerationHistory(data.videos || []);
      }
    } catch (error) {
      console.error("Failed to load generation history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Seedance 1.5 Pro resolution dimensions
  const resolutionDimensions = {
    "720p": {
      "16:9": "1280×720",
      "4:3": "1112×834",
      "1:1": "960×960",
      "3:4": "834×1112",
      "9:16": "720×1280",
      "21:9": "1470×630",
      "adaptive": "Auto",
    },
    "1080p": {
      "16:9": "1920×1080",
      "4:3": "1440×1080",
      "1:1": "1080×1080",
      "3:4": "1080×1440",
      "9:16": "1080×1920",
      "21:9": "2520×1080",
      "adaptive": "Auto",
    },
  };

  const aspectRatios = ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"] as const;

  // Get current dimensions
  const currentDimensions = resolutionDimensions[resolution][aspectRatio];

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file");
      return;
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setUploadedImage(base64);
      setUploadedImageFile(file);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setUploadedImage("");
    setUploadedImageFile(null);
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

    if (!uploadedImage) {
      setError("Please upload an image");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("Submitting task...");
    
    const taskId = `seedream-i2v-${Date.now()}`;
    
    try {
      updateGlobalProgress({
        isGenerating: true,
        progress: 0,
        stage: "starting",
        message: "Starting SeeDream 4.5 Image-to-Video generation...",
        generationType: "text-to-image",
        jobId: taskId,
      });

      // Prepare request payload
      const payload: any = {
        prompt: prompt.trim(),
        image: uploadedImage,
        model: "ep-20260105171451-cljlk",
        resolution: resolution,
        ratio: aspectRatio,
        duration: duration,
        seed: -1,
        cameraFixed: cameraFixed,
        watermark: false,
        generateAudio: generateAudio,
        targetFolder: targetFolder || undefined,
      };

      console.log("Generating video with payload...");

      // Call API to create task
      const response = await apiClient.post("/api/generate/seedream-image-to-video", payload);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error Response:", errorData);
        // Show detailed error if available
        const errorMessage = errorData.details?.error?.message 
          || errorData.error 
          || "Generation failed";
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("Generation response:", data);
      
      if (data.status === "completed" && data.videos && data.videos.length > 0) {
        // Task completed immediately with saved videos
        updateGlobalProgress({
          isGenerating: false,
          progress: 100,
          stage: "completed",
          message: "Generation completed!",
          generationType: "text-to-image",
          jobId: taskId,
        });

        setGeneratedVideos(data.videos);
        setPollingStatus("");
        loadGenerationHistory();
      } else if (data.taskId) {
        // Need to poll for completion
        setPollingStatus("Task created, waiting for processing...");
        await pollTaskStatus(data.taskId, taskId);
      } else {
        throw new Error("No task ID or videos returned from server");
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      setError(error.message || "Failed to generate video");
      updateGlobalProgress({
        isGenerating: false,
        progress: 0,
        stage: "failed",
        message: error.message || "Generation failed",
        generationType: "text-to-image",
        jobId: taskId,
      });
      setPollingStatus("");
      setIsGenerating(false);
      setTimeout(() => clearGlobalProgress(), 3000);
    }
  };

  const pollTaskStatus = async (serverTaskId: string, localTaskId: string) => {
    const maxAttempts = 120; // 10 minutes max (120 * 5 seconds)
    let attempts = 0;
    const startTime = Date.now();

    const poll = async () => {
      attempts++;
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      setPollingStatus(`Processing video... (${elapsedSeconds}s elapsed)`);

      try {
        const response = await apiClient?.get(
          `/api/generate/seedream-image-to-video?taskId=${serverTaskId}`
        );

        if (!response) {
          throw new Error("No response from server");
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to check status");
        }

        const data = await response.json();

        if (data?.status === "completed" && (data?.videoUrl || (data?.videos && data.videos.length > 0))) {
          console.log("Video generation completed!");
          
          updateGlobalProgress({
            isGenerating: false,
            progress: 100,
            stage: "completed",
            message: "Video generated successfully!",
            generationType: "text-to-image",
            jobId: localTaskId,
          });

          // Use videos from database if available, otherwise use direct URL
          if (data.videos && data.videos.length > 0) {
            setGeneratedVideos(data.videos);
          } else if (data.videoUrl) {
            const video: GeneratedVideo = {
              id: serverTaskId,
              videoUrl: data.videoUrl,
              prompt: prompt,
              modelVersion: "SeeDream 4.5",
              duration: duration,
              cameraFixed: cameraFixed,
              createdAt: new Date().toISOString(),
              status: "completed",
            };
            setGeneratedVideos([video]);
          }

          setPollingStatus("");
          setIsGenerating(false);
          loadGenerationHistory();
        } else if (data?.status === "failed") {
          throw new Error(data?.error || "Video generation failed");
        } else if (attempts < maxAttempts) {
          // Continue polling
          setTimeout(poll, 5000);
        } else {
          throw new Error("Video generation timed out");
        }
      } catch (error: any) {
        console.error("Polling error:", error);
        setError(error.message || "Failed to check generation status");
        updateGlobalProgress({
          isGenerating: false,
          progress: 0,
          stage: "failed",
          message: error.message || "Generation failed",
          generationType: "text-to-image",
          jobId: localTaskId,
        });
        setPollingStatus("");
        setIsGenerating(false);
        setTimeout(() => clearGlobalProgress(), 3000);
      }
    };

    poll();
  };

  const handleDownload = async (videoUrl: string, filename: string) => {
    try {
      // Fetch the video as a blob
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error("Failed to fetch video");
      
      const blob = await response.blob();
      
      // Create a blob URL and trigger download
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up the blob URL
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error("Download failed:", error);
      // Fallback: open in new tab
      window.open(videoUrl, "_blank");
    }
  };

  const handleReset = () => {
    setPrompt("");
    setUploadedImage("");
    setUploadedImageFile(null);
    setDuration(4);
    setDurationSliderValue(1);
    setResolution("720p");
    setAspectRatio("16:9");
    setCameraFixed(false);
    setGenerateAudio(true);
    setError(null);
    setGeneratedVideos([]);
    setPollingStatus("");
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
                <Film className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 dark:from-cyan-400 dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                SeeDream Image to Video
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base mt-1">
                Transform your images into stunning AI-powered videos with SeeDream 4.5
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="p-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl transition-all duration-200 group"
              title="View Help & Tips"
            >
              <Info className="w-5 h-5 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 p-6 space-y-6">
            <div className="flex items-center space-x-3 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">
                Generation Settings
              </h2>
            </div>

            <div className="space-y-6">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Starting Image
                </label>
                {!uploadedImage ? (
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                      disabled={isGenerating}
                    />
                    <label
                      htmlFor="image-upload"
                      className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-cyan-300 dark:border-cyan-600 rounded-xl cursor-pointer hover:border-cyan-400 dark:hover:border-cyan-500 transition-all duration-300 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 hover:scale-[1.02]"
                    >
                      <Upload className="w-12 h-12 text-cyan-500 dark:text-cyan-400 mb-3" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Click to upload image
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        PNG, JPG, WEBP up to 10MB
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="relative group">
                    <img
                      src={uploadedImage}
                      alt="Uploaded"
                      className="w-full h-48 object-contain rounded-xl border-2 border-cyan-200 dark:border-cyan-700 bg-gray-50 dark:bg-gray-900"
                    />
                    <button
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                      disabled={isGenerating}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Prompt Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Video Description
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the motion and style for your video... (e.g., 'Camera slowly zooms in, cinematic lighting, smooth motion')"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300 resize-none"
                  rows={4}
                  disabled={isGenerating}
                />
              </div>

              {/* Resolution Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Resolution
                </label>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    onClick={() => setResolution("720p")}
                    className={`p-3 rounded-xl border-2 transition-all duration-300 hover:scale-105 ${
                      resolution === "720p"
                        ? "border-cyan-500 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/30 dark:to-blue-900/30 shadow-lg shadow-cyan-500/20"
                        : "border-gray-200 dark:border-gray-600 hover:border-cyan-300 dark:hover:border-cyan-600 bg-white dark:bg-gray-800"
                    }`}
                    disabled={isGenerating}
                  >
                    <div className="font-bold text-gray-900 dark:text-gray-100">720p</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">HD Quality</div>
                  </button>
                  <button
                    onClick={() => setResolution("1080p")}
                    className={`p-3 rounded-xl border-2 transition-all duration-300 hover:scale-105 ${
                      resolution === "1080p"
                        ? "border-cyan-500 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/30 dark:to-blue-900/30 shadow-lg shadow-cyan-500/20"
                        : "border-gray-200 dark:border-gray-600 hover:border-cyan-300 dark:hover:border-cyan-600 bg-white dark:bg-gray-800"
                    }`}
                    disabled={isGenerating}
                  >
                    <div className="font-bold text-gray-900 dark:text-gray-100">1080p</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Full HD</div>
                  </button>
                </div>

                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {aspectRatios.map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`p-2.5 rounded-lg border-2 transition-all duration-300 hover:scale-105 ${
                        aspectRatio === ratio
                          ? "border-cyan-500 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/30 dark:to-blue-900/30 shadow-md shadow-cyan-500/20"
                          : "border-gray-200 dark:border-gray-600 hover:border-cyan-300 dark:hover:border-cyan-600 bg-white dark:bg-gray-800"
                      }`}
                      disabled={isGenerating}
                    >
                      <div className="font-semibold text-xs text-gray-900 dark:text-gray-100">
                        {ratio}
                      </div>
                    </button>
                  ))}
                </div>

                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Video Dimensions
                </label>
                <div className="p-3 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border border-cyan-200 dark:border-cyan-700 rounded-lg text-center">
                  <span className="text-sm font-bold bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">
                    {currentDimensions}
                  </span>
                </div>
              </div>

              {/* Folder Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Folder className="w-4 h-4 inline mr-1" />
                  Save to Folder
                </label>
                <div className="relative">
                  <select
                    value={targetFolder}
                    onChange={(e) => setTargetFolder(e.target.value)}
                    disabled={isGenerating || isLoadingFolders}
                    className="w-full px-4 py-2.5 pr-10 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300 appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                    ? `Videos will be saved to: ${availableFolders.find(f => f.prefix === targetFolder)?.displayPath || 'Selected folder'}`
                    : 'Videos will be saved to your root outputs folder'}
                </p>
              </div>

              {/* Duration Slider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Duration: {duration === -1 ? "Auto" : `${duration}s`}
                </label>
                <input
                  type="range"
                  min="0"
                  max="9"
                  value={durationSliderValue}
                  onChange={(e) => {
                    const sliderVal = Number(e.target.value);
                    setDurationSliderValue(sliderVal);
                    setDuration(getActualDuration(sliderVal));
                  }}
                  className="w-full"
                  disabled={isGenerating}
                />
                <div className="relative text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span className="absolute left-0">Auto</span>
                  <span className="absolute" style={{ left: '33.33%', transform: 'translateX(-50%)' }}>6s</span>
                  <span className="absolute" style={{ left: '66.67%', transform: 'translateX(-50%)' }}>9s</span>
                  <span className="absolute right-0">12s</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-5">
                  Auto: Model selects duration (4-12s) | Fixed: 4-12 seconds
                </p>
              </div>

              {/* Generate Audio Toggle */}
              <div>
                <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Generate Audio
                  </span>
                  <button
                    type="button"
                    onClick={() => setGenerateAudio(!generateAudio)}
                    disabled={isGenerating}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      generateAudio
                        ? "bg-cyan-500"
                        : "bg-gray-300 dark:bg-gray-600"
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        generateAudio ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Generate video with synchronized audio (voice, sound effects, or background music)
                </p>
              </div>

              {/* Camera Fixed Toggle */}
              <div>
                <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-2">
                    <Video className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Fixed Camera
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCameraFixed(!cameraFixed)}
                    disabled={isGenerating}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${
                      cameraFixed ? 'bg-cyan-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        cameraFixed ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Enable for static camera position, disable for dynamic camera movement
                </p>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Polling Status */}
              {pollingStatus && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start space-x-3">
                  <Loader2 className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5 animate-spin" />
                  <p className="text-sm text-blue-600 dark:text-blue-400">{pollingStatus}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim() || !uploadedImage}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 dark:disabled:from-gray-700 dark:disabled:to-gray-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-[1.02] disabled:hover:scale-100 disabled:shadow-none"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      <span>Generate Video</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleReset}
                  disabled={isGenerating}
                  className="px-6 py-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl transition-all duration-300 flex items-center justify-center shadow-md hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Output Section */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 p-6">
            <div className="flex items-center space-x-3 pb-4 border-b border-gray-200 dark:border-gray-700 mb-6">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                Generated Videos
              </h2>
            </div>

            {generatedVideos.length === 0 && !isGenerating ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 dark:from-cyan-500/10 dark:to-blue-500/10 rounded-full blur-2xl" />
                  <div className="relative p-6 bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 rounded-full">
                    <Film className="w-16 h-16 text-cyan-600 dark:text-cyan-400" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  No videos generated yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                  Upload an image, add a description, and click Generate Video to create your first AI-powered video
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {generatedVideos.map((video) => (
                  <div
                    key={video.id}
                    className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:scale-[1.02] transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    <video
                      src={video.videoUrl}
                      controls
                      className="w-full rounded-lg mb-4 bg-black"
                    />
                    <div className="space-y-3">
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                        {video.prompt}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{video.modelVersion}</span>
                        <span>{video.duration}s</span>
                      </div>
                      <button
                        onClick={() =>
                          handleDownload(
                            video.videoUrl,
                            `seedream-video-${video.id}.mp4`
                          )
                        }
                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg hover:scale-[1.02]"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Video</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Generations */}
            <div className="mt-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent flex items-center">
                  <RefreshCw className="w-4 h-4 mr-2 text-cyan-500" />
                  Recent Generations
                </h3>
                {generationHistory.length > 0 && (
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                    {generationHistory.length} {generationHistory.length === 1 ? 'video' : 'videos'}
                  </div>
                )}
              </div>

              {isLoadingHistory ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-cyan-500" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading history...</p>
                </div>
              ) : generationHistory.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {generationHistory.slice(0, 8).map((video) => (
                    <div
                      key={video.id}
                      className="group relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-cyan-400 dark:hover:border-cyan-600 hover:shadow-xl hover:shadow-cyan-500/20 transition-all duration-300 cursor-pointer"
                      onClick={() => {
                        setSelectedVideo(video);
                        setShowVideoModal(true);
                      }}
                    >
                      <div className="aspect-video relative">
                        <video
                          src={video.videoUrl}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      <div className="p-2">
                        <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
                          {video.prompt}
                        </p>
                        <div className="flex items-center justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {video.duration}s
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Film className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Your recent generations will appear here
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Video Modal */}
      {showVideoModal && selectedVideo && typeof window !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => {
            setShowVideoModal(false);
            setSelectedVideo(null);
          }}
        >
          <div 
            className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => {
                setShowVideoModal(false);
                setSelectedVideo(null);
              }}
              className="absolute top-4 right-4 z-10 p-2 bg-gray-900/80 hover:bg-gray-900 text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Video container */}
            <div className="p-6">
              <div className="aspect-video bg-black rounded-xl overflow-hidden mb-4">
                <video
                  src={selectedVideo.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              </div>

              {/* Video details */}
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Video Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Prompt:</span>
                    <p className="text-gray-900 dark:text-white mt-1">{selectedVideo.prompt}</p>
                  </div>
                  <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      Duration: {selectedVideo.duration}s
                    </span>
                    <span>
                      Model: {selectedVideo.modelVersion}
                    </span>
                  </div>
                </div>

                {/* Download button */}
                <button
                  onClick={async () => {
                    try {
                      // Use proxy endpoint for authenticated S3 access
                      const proxyUrl = `/api/download/image?url=${encodeURIComponent(selectedVideo.videoUrl)}`;
                      const response = await fetch(proxyUrl);
                      
                      if (!response.ok) {
                        throw new Error(`Failed to download video: ${response.status}`);
                      }
                      
                      const blob = await response.blob();
                      
                      // Create a blob URL and trigger download
                      const blobUrl = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = blobUrl;
                      link.download = `video-${selectedVideo.id}.mp4`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      
                      // Clean up the blob URL
                      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                    } catch (error) {
                      console.error("Download failed:", error);
                      alert("Failed to download video. Please try again.");
                    }
                  }}
                  className="w-full mt-4 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Video
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Help Modal */}
      {showHelpModal && typeof window !== 'undefined' && document?.body && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowHelpModal(false)}
        >
          <div 
            className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowHelpModal(false)}
              className="sticky top-4 float-right mr-4 z-10 p-2 bg-gray-900/80 hover:bg-gray-900 text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl">
                  <Info className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">
                  SeeDream 4.5 Image-to-Video Guide
                </h2>
              </div>

              <div className="space-y-8">
                {/* Prompting Tips */}
                <section>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-cyan-500" />
                    How to Write Effective Prompts
                  </h3>
                  <div className="space-y-4 text-gray-700 dark:text-gray-300">
                    <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4">
                      <p className="font-semibold mb-2">✨ Recommended Structure:</p>
                      <p className="text-sm"><strong>Describe motion + camera movement + environment changes</strong></p>
                      <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
                        Example: "Girl opens her eyes, looks gently at camera. Fox hugs affectionately. Camera slowly pulls out, hair blown by wind."
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <p className="font-semibold text-green-700 dark:text-green-400 mb-2">✓ Good Practices:</p>
                        <ul className="text-sm space-y-1 list-disc list-inside">
                          <li>Upload high-quality images</li>
                          <li>Describe desired motion clearly</li>
                          <li>Match aspect ratio to image</li>
                          <li>Specify camera movements</li>
                          <li>For dialogue, use quotes</li>
                        </ul>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <p className="font-semibold text-red-700 dark:text-red-400 mb-2">✗ Avoid:</p>
                        <ul className="text-sm space-y-1 list-disc list-inside">
                          <li>Low-quality images</li>
                          <li>Extreme aspect ratio mismatches</li>
                          <li>Overly complex actions</li>
                          <li>Contradictory motions</li>
                        </ul>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="font-semibold mb-2">💡 Pro Tips:</p>
                      <ul className="text-sm space-y-1 list-disc list-inside">
                        <li>Image quality significantly impacts results</li>
                        <li>Shorter side must be &gt; 300px, longer side &lt; 6000px</li>
                        <li>Aspect ratio range: 0.4 to 2.5</li>
                        <li>Adaptive ratio automatically adjusts to your image</li>
                      </ul>
                    </div>
                  </div>
                </section>

                {/* Parameters Explanation */}
                <section>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-cyan-500" />
                    Parameter Guide
                  </h3>
                  <div className="space-y-3">
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🖼️ Starting Image</h4>
                      <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300 ml-4">
                        <li><strong>Formats:</strong> JPEG, PNG, WebP, BMP, TIFF, GIF, HEIC, HEIF</li>
                        <li><strong>Size:</strong> Up to 30MB</li>
                        <li><strong>Dimensions:</strong> 300px-6000px, aspect 0.4-2.5</li>
                        <li><strong>Tip:</strong> High-quality images produce better results</li>
                      </ul>
                    </div>

                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">📐 Resolution & Aspect Ratio</h4>
                      <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300 ml-4">
                        <li><strong>720p:</strong> 1280×720 - Faster generation</li>
                        <li><strong>1080p:</strong> 1920×1080 - Higher quality</li>
                        <li><strong>Adaptive:</strong> Auto-adjusts to uploaded image</li>
                        <li><strong>Note:</strong> Different ratios will crop your image (center-based)</li>
                      </ul>
                    </div>

                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">⏱️ Duration (4-12 seconds)</h4>
                      <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300 ml-4">
                        <li><strong>Auto:</strong> Model chooses optimal length</li>
                        <li><strong>Fixed (4-12s):</strong> Set exact duration</li>
                        <li><strong>Note:</strong> Longer videos take more time & cost more</li>
                      </ul>
                    </div>

                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🎵 Generate Audio</h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Automatically generates voice, sound effects, or background music synchronized with visuals. Perfect for dialogue scenes.
                      </p>
                    </div>

                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">📷 Camera Fixed</h4>
                      <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300 ml-4">
                        <li><strong>Enabled:</strong> Static camera, only subject moves</li>
                        <li><strong>Disabled:</strong> Dynamic camera movements (zoom, pan, etc.)</li>
                      </ul>
                    </div>
                  </div>
                </section>

                {/* Example Use Cases */}
                <section>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-cyan-500" />
                    Example Use Cases
                  </h3>
                  <div className="space-y-3">
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                      <p className="font-semibold text-purple-900 dark:text-purple-300 mb-2">🎬 Character Animation</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Portrait → "Girl opens eyes, smiles at camera, gentle head tilt. Soft lighting changes."
                      </p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                      <p className="font-semibold text-amber-900 dark:text-amber-300 mb-2">📸 Product Showcase</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Product photo → "360-degree rotation, dramatic lighting sweep, elegant presentation."
                      </p>
                    </div>
                    <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
                      <p className="font-semibold text-teal-900 dark:text-teal-300 mb-2">🌄 Scene Animation</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Landscape → "Clouds drift slowly, trees sway gently, camera pans across scene."
                      </p>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                      <p className="font-semibold text-indigo-900 dark:text-indigo-300 mb-2">🗣️ Talking Portrait</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Face photo + Audio → "Person looks at camera and says, \\"Hello, welcome!\\""
                      </p>
                    </div>
                  </div>
                </section>

                {/* Important Notes */}
                <section className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-300 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Important Notes
                  </h3>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-disc list-inside">
                    <li>Image quality directly impacts video quality</li>
                    <li>If aspect ratio differs from image, center-based cropping applies</li>
                    <li>Generated videos saved automatically to your S3 storage</li>
                    <li>Processing time: typically 30s - 2min depending on duration</li>
                    <li>Frame rate: 24 fps | Format: MP4</li>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
