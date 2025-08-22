"use client";

import { useState, useRef } from "react";
import {
  Upload,
  FileImage,
  Sparkles,
  Copy,
  Download,
  Trash2,
  Eye,
  Loader2,
} from "lucide-react";

interface AnalysisResult {
  cameraDistance: string;
  pose: string;
  location: string;
  outfit: string;
  facialExpression: string;
  hairColor: string;
  triggerWord: string;
}

export default function StyleTransferPrompts() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const [triggerWord, setTriggerWord] = useState("person");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // OpenAI image analysis function
  const analyzeImageWithOpenAI = async (
    imageBase64: string
  ): Promise<AnalysisResult> => {
    try {
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imageBase64,
          triggerWord: triggerWord,
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        cameraDistance: data.cameraDistance || "medium shot",
        pose: data.pose || "natural pose",
        location: data.location || "casual indoor setting",
        outfit: data.outfit || "casual clothing",
        facialExpression: data.facialExpression || "neutral expression",
        hairColor: data.hairColor || "brown hair",
        triggerWord: triggerWord,
      };
    } catch (error) {
      console.error("OpenAI analysis error:", error);
      throw new Error("Failed to analyze image. Please try again.");
    }
  };

  const generateFluxPrompt = (analysis: AnalysisResult): string => {
    return `${analysis.cameraDistance} [${analysis.triggerWord}] with ${analysis.hairColor}, ${analysis.pose}, located in ${analysis.location}, wearing ${analysis.outfit}, ${analysis.facialExpression}, natural lighting, photorealistic, high quality, detailed, authentic atmosphere, candid moment, real-world setting, organic composition`;
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
      // Convert image to base64 for API call
      const base64 = uploadedImage.split(",")[1];
      const analysis = await analyzeImageWithOpenAI(base64);
      setAnalysisResult(analysis);

      const prompt = generateFluxPrompt(analysis);
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
      // You could add a toast notification here
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
          <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              Style Transfer Prompts
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Upload an image and generate natural Flux Dev prompts for style
              transfer
            </p>
          </div>
        </div>

        {/* Trigger Word Input */}
        <div className="mb-4">
          <label
            htmlFor="triggerWord"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Trigger Word
          </label>
          <input
            type="text"
            id="triggerWord"
            value={triggerWord}
            onChange={(e) => setTriggerWord(e.target.value)}
            placeholder="e.g., person, model, character"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
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
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-purple-400 dark:hover:border-purple-500 transition-colors"
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
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-5 h-5" />
                    <span>Analyze Image</span>
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
            Analysis Results
          </h2>

          {!analysisResult ? (
            <div className="text-center py-8">
              <FileImage className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Upload and analyze an image to see results
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Camera Distance:
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {analysisResult.cameraDistance}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Pose:
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {analysisResult.pose}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Location:
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {analysisResult.location}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Outfit:
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {analysisResult.outfit}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Facial Expression:
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {analysisResult.facialExpression}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Hair Color:
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {analysisResult.hairColor}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generated Prompt */}
      {generatedPrompt && (
        <div className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900/80 dark:to-gray-800/40 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/30 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Generated Flux Prompt
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
