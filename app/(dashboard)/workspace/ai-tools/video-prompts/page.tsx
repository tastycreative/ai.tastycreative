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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-purple-950/20">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Enhanced Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-500 via-pink-500 to-purple-600 rounded-3xl shadow-2xl mb-6 transform hover:scale-105 transition-all">
            <PlayCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-red-600 via-pink-600 to-purple-600 dark:from-red-400 dark:via-pink-400 dark:to-purple-400 bg-clip-text text-transparent mb-4">
            Video Prompts Generator
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Transform your images into dynamic video concepts with AI-powered
            movement analysis and cinematic suggestions
          </p>
          <div className="flex items-center justify-center space-x-2 mt-4">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              AI-Powered Analysis
            </span>
            <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse delay-75"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Enhanced Upload Section */}
          <div className="bg-gradient-to-br from-white via-gray-50/50 to-red-50/30 dark:from-gray-800 dark:via-gray-800/90 dark:to-red-950/10 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/30 rounded-2xl p-8 shadow-xl">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Upload Your Image
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Start by uploading the image you want to animate
                </p>
              </div>
            </div>

            {!uploadedImage ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-12 text-center cursor-pointer hover:border-red-400 dark:hover:border-red-500 hover:bg-red-50/30 dark:hover:bg-red-950/20 transition-all duration-300 group"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-100 to-pink-100 dark:from-red-900/30 dark:to-pink-900/30 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Drop your image here
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  or click to browse your files
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  Supports PNG, JPG, JPEG up to 10MB
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative rounded-2xl overflow-hidden shadow-lg group">
                  <img
                    src={uploadedImage}
                    alt="Uploaded"
                    className="w-full h-auto max-w-full object-contain bg-gray-50 dark:bg-gray-800"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl hover:bg-white dark:hover:bg-gray-800 transition-all shadow-lg"
                      title="Upload new image"
                    >
                      <Upload className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={handleClearAll}
                      className="p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl hover:bg-white dark:hover:bg-gray-800 transition-all shadow-lg"
                      title="Remove image"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 hover:from-red-600 hover:via-pink-600 hover:to-purple-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Analyzing Movement Patterns...</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-5 h-5" />
                      <span>Generate Video Prompts</span>
                    </>
                  )}
                </button>

                {/* Enhanced Error Display */}
                {error && (
                  <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                        <Upload className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </div>
                      <p className="text-red-700 dark:text-red-400 font-medium">
                        {error}
                      </p>
                    </div>
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

          {/* Enhanced Analysis Results */}
          <div className="bg-gradient-to-br from-white via-gray-50/50 to-purple-50/30 dark:from-gray-800 dark:via-gray-800/90 dark:to-purple-950/10 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/30 rounded-2xl p-8 shadow-xl">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                <FileImage className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Video Analysis
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  AI-generated movement and cinematography insights
                </p>
              </div>
            </div>

            {!analysisResult ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gray-100 to-purple-100 dark:from-gray-800 dark:to-purple-900/30 rounded-2xl mb-6">
                  <FileImage className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Ready for Analysis
                </h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                  Upload and analyze an image to discover cinematic movement
                  possibilities and generate video prompts
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 rounded-xl p-4 border border-red-200/50 dark:border-red-800/30">
                    <label className="flex items-center text-sm font-bold text-red-700 dark:text-red-300 mb-2">
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Current Pose:
                    </label>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {analysisResult.currentPose}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20 rounded-xl p-4 border border-pink-200/50 dark:border-pink-800/30">
                    <label className="flex items-center text-sm font-bold text-pink-700 dark:text-pink-300 mb-2">
                      <Eye className="w-4 h-4 mr-2" />
                      Suggested Movements ("the woman is..."):
                    </label>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {analysisResult.suggestedMovements}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-xl p-4 border border-purple-200/50 dark:border-purple-800/30">
                    <label className="flex items-center text-sm font-bold text-purple-700 dark:text-purple-300 mb-2">
                      <FileImage className="w-4 h-4 mr-2" />
                      Camera Position (Simple Setup):
                    </label>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {analysisResult.cameraAngle}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-4 border border-blue-200/50 dark:border-blue-800/30">
                      <label className="flex items-center text-sm font-bold text-blue-700 dark:text-blue-300 mb-2">
                        <Upload className="w-4 h-4 mr-2" />
                        Duration:
                      </label>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {analysisResult.duration}
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-50 to-cyan-50 dark:from-indigo-950/20 dark:to-cyan-950/20 rounded-xl p-4 border border-indigo-200/50 dark:border-indigo-800/30">
                      <label className="flex items-center text-sm font-bold text-indigo-700 dark:text-indigo-300 mb-2">
                        <Copy className="w-4 h-4 mr-2" />
                        Style (Natural & Seductive):
                      </label>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {analysisResult.style}
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/20 dark:to-teal-950/20 rounded-xl p-4 border border-cyan-200/50 dark:border-cyan-800/30">
                      <label className="flex items-center text-sm font-bold text-cyan-700 dark:text-cyan-300 mb-2">
                        <Download className="w-4 h-4 mr-2" />
                        Natural Transitions:
                      </label>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {analysisResult.transitions}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Generated Video Prompt */}
        {generatedPrompt && (
          <div className="bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30 dark:from-gray-800 dark:via-emerald-950/10 dark:to-teal-950/10 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/30 rounded-2xl p-8 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <PlayCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Generated Video Prompt
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Ready to use in your video generation tool
                  </p>
                </div>
              </div>
              <button
                onClick={handleCopyPrompt}
                className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Prompt</span>
              </button>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-emerald-50 dark:from-gray-900/50 dark:to-emerald-950/20 rounded-xl p-6 border-2 border-emerald-200/50 dark:border-emerald-800/30">
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  <FileImage className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
                    Video Generation Prompt
                  </h3>
                  <p className="text-gray-900 dark:text-white font-mono text-sm leading-relaxed whitespace-pre-wrap bg-white/60 dark:bg-gray-800/60 p-4 rounded-lg border border-emerald-200/30 dark:border-emerald-700/30">
                    {generatedPrompt}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span>Optimized for video generation AI models</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
