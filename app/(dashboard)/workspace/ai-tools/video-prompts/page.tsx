"use client";

import { useState, useRef } from "react";
import {
  Upload,
  FileImage,
  PlayCircle,
  Copy,
  Download,
  Trash2,
  Eye,
  Loader2,
} from "lucide-react";

interface VideoAnalysisResult {
  currentPose: string;
  suggestedMovements: string;
  cameraAngle: string;
  duration: string;
  style: string;
  transitions: string;
}

export default function VideoPrompts() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] =
    useState<VideoAnalysisResult | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // OpenAI video analysis function
  const analyzeImageForVideo = async (
    imageBase64: string
  ): Promise<VideoAnalysisResult> => {
    try {
      const response = await fetch("/api/analyze-video-prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imageBase64,
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        currentPose: data.currentPose || "Standing pose",
        suggestedMovements: data.suggestedMovements || "Gentle swaying motion",
        cameraAngle: data.cameraAngle || "Medium shot",
        duration: data.duration || "3-5 seconds",
        style: data.style || "Elegant and alluring",
        transitions: data.transitions || "Smooth fade transitions",
      };
    } catch (error) {
      console.error("OpenAI video analysis error:", error);
      throw new Error("Failed to analyze image for video. Please try again.");
    }
  };

  const generateVideoPrompt = (analysis: VideoAnalysisResult): string => {
    return `${analysis.suggestedMovements}. Camera: ${analysis.cameraAngle}. Duration: ${analysis.duration}. Style: ${analysis.style}. ${analysis.transitions}.`;
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setUploadedImage(result);
        setAnalysisResult(null);
        setGeneratedPrompt("");
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedImage) return;

    setIsAnalyzing(true);
    setError(null);
    try {
      const base64 = uploadedImage.split(",")[1];
      const analysis = await analyzeImageForVideo(base64);
      setAnalysisResult(analysis);

      const prompt = generateVideoPrompt(analysis);
      setGeneratedPrompt(prompt);
    } catch (error: any) {
      console.error("Analysis failed:", error);
      setError(error.message || "Failed to analyze image. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyPrompt = () => {
    if (generatedPrompt) {
      navigator.clipboard.writeText(generatedPrompt);
    }
  };

  const handleClearAll = () => {
    setUploadedImage(null);
    setAnalysisResult(null);
    setGeneratedPrompt("");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-white to-gray-50/50 dark:from-gray-900/80 dark:to-gray-800/40 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 rounded-xl p-6 shadow-lg">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg">
            <PlayCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              Video Prompts
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Upload an image and generate movement-based video prompts
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <div className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900/80 dark:to-gray-800/40 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 rounded-xl p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Upload Image
          </h2>

          {!uploadedImage ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-red-400 dark:hover:border-red-500 transition-colors"
            >
              <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Click to upload an image
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                PNG, JPG, JPEG up to 10MB
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden">
                <img
                  src={uploadedImage}
                  alt="Uploaded"
                  className="w-full h-auto max-w-full object-contain"
                />
                <div className="absolute top-2 right-2 flex space-x-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
                  >
                    <Upload className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="p-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-5 h-5" />
                    <span>Analyze for Video</span>
                  </>
                )}
              </button>

              {/* Error Display */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-700 dark:text-red-400 text-sm">
                    {error}
                  </p>
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

        {/* Analysis Results */}
        <div className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900/80 dark:to-gray-800/40 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 rounded-xl p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Video Analysis
          </h2>

          {!analysisResult ? (
            <div className="text-center py-8">
              <FileImage className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Upload and analyze an image to see video suggestions
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Current Pose:
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {analysisResult.currentPose}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Suggested Movements ("the woman is..."):
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {analysisResult.suggestedMovements}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Camera Position (Simple Setup):
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {analysisResult.cameraAngle}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Duration:
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {analysisResult.duration}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Style (Natural & Seductive):
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {analysisResult.style}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Natural Transitions:
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {analysisResult.transitions}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generated Video Prompt */}
      {generatedPrompt && (
        <div className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900/80 dark:to-gray-800/40 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Generated Video Prompt
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={handleCopyPrompt}
                className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4" />
                <span>Copy</span>
              </button>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-gray-900 dark:text-white font-mono text-sm leading-relaxed whitespace-pre-wrap">
              {generatedPrompt}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
