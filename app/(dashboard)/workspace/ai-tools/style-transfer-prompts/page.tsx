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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-pink-50/50 dark:from-gray-900 dark:via-purple-950/20 dark:to-pink-950/20">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Enhanced Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 via-pink-500 to-rose-600 rounded-3xl shadow-2xl mb-6 transform hover:scale-105 transition-all">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 dark:from-purple-400 dark:via-pink-400 dark:to-rose-400 bg-clip-text text-transparent mb-4">
            Style Transfer Prompts
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Upload an image and generate natural, photorealistic Flux Dev
            prompts optimized for style transfer and character consistency
          </p>
          <div className="flex items-center justify-center space-x-2 mt-4">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              AI-Powered Style Analysis
            </span>
            <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse delay-75"></div>
          </div>
        </div>

        {/* Enhanced Trigger Word Section */}
        <div className="bg-gradient-to-br from-white via-purple-50/20 to-pink-50/30 dark:from-gray-800 dark:via-purple-950/10 dark:to-pink-950/20 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/30 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg flex items-center justify-center mr-3">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Character Configuration
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Set your unique trigger word for style consistency
              </p>
            </div>
          </div>

          <div className="max-w-md">
            <label
              htmlFor="triggerWord"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3"
            >
              Trigger Word
            </label>
            <input
              type="text"
              id="triggerWord"
              value={triggerWord}
              onChange={(e) => setTriggerWord(e.target.value)}
              placeholder="e.g., person, model, character"
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500 dark:placeholder-gray-400 transition-all font-medium"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center">
              <FileImage className="w-3 h-3 mr-1" />
              This word will be used to reference the subject in generated
              prompts
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Enhanced Upload Section */}
          <div className="bg-gradient-to-br from-white via-purple-50/30 to-pink-50/30 dark:from-gray-800 dark:via-purple-950/10 dark:to-pink-950/10 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/30 rounded-2xl p-8 shadow-xl">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Upload Reference Image
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Upload the image you want to analyze for style transfer
                </p>
              </div>
            </div>

            {!uploadedImage ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-12 text-center cursor-pointer hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 transition-all duration-300 group"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-purple-600 dark:text-purple-400" />
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
                  className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 hover:from-purple-600 hover:via-pink-600 hover:to-rose-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Analyzing Style Elements...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Analyze for Style Transfer</span>
                    </>
                  )}
                </button>

                {/* Enhanced Error Display */}
                {error && (
                  <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-red-600 dark:text-red-400" />
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
          <div className="bg-gradient-to-br from-white via-pink-50/30 to-rose-50/30 dark:from-gray-800 dark:via-pink-950/10 dark:to-rose-950/10 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/30 rounded-2xl p-8 shadow-xl">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                <FileImage className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Style Analysis Results
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  AI-detected style elements for prompt generation
                </p>
              </div>
            </div>

            {!analysisResult ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gray-100 to-pink-100 dark:from-gray-800 dark:to-pink-900/30 rounded-2xl mb-6">
                  <FileImage className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Ready for Analysis
                </h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                  Upload and analyze an image to extract detailed style elements
                  for Flux Dev prompt generation
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl p-4 border border-purple-200/50 dark:border-purple-800/30">
                    <label className="flex items-center text-sm font-bold text-purple-700 dark:text-purple-300 mb-2">
                      <Eye className="w-4 h-4 mr-2" />
                      Camera Distance:
                    </label>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {analysisResult.cameraDistance}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20 rounded-xl p-4 border border-pink-200/50 dark:border-pink-800/30">
                    <label className="flex items-center text-sm font-bold text-pink-700 dark:text-pink-300 mb-2">
                      <FileImage className="w-4 h-4 mr-2" />
                      Pose:
                    </label>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {analysisResult.pose}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/20 dark:to-orange-950/20 rounded-xl p-4 border border-rose-200/50 dark:border-rose-800/30">
                    <label className="flex items-center text-sm font-bold text-rose-700 dark:text-rose-300 mb-2">
                      <Upload className="w-4 h-4 mr-2" />
                      Location:
                    </label>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {analysisResult.location}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 rounded-xl p-4 border border-orange-200/50 dark:border-orange-800/30">
                      <label className="flex items-center text-sm font-bold text-orange-700 dark:text-orange-300 mb-2">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Outfit:
                      </label>
                      <p className="text-gray-900 dark:text-white font-medium text-sm">
                        {analysisResult.outfit}
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 rounded-xl p-4 border border-amber-200/50 dark:border-amber-800/30">
                      <label className="flex items-center text-sm font-bold text-amber-700 dark:text-amber-300 mb-2">
                        <Copy className="w-4 h-4 mr-2" />
                        Facial Expression:
                      </label>
                      <p className="text-gray-900 dark:text-white font-medium text-sm">
                        {analysisResult.facialExpression}
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-50 to-green-50 dark:from-yellow-950/20 dark:to-green-950/20 rounded-xl p-4 border border-yellow-200/50 dark:border-yellow-800/30">
                      <label className="flex items-center text-sm font-bold text-yellow-700 dark:text-yellow-300 mb-2">
                        <Download className="w-4 h-4 mr-2" />
                        Hair Color:
                      </label>
                      <p className="text-gray-900 dark:text-white font-medium text-sm">
                        {analysisResult.hairColor}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Generated Flux Prompt */}
        {generatedPrompt && (
          <div className="bg-gradient-to-br from-white via-green-50/30 to-emerald-50/30 dark:from-gray-800 dark:via-green-950/10 dark:to-emerald-950/10 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/30 rounded-2xl p-8 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Generated Flux Dev Prompt
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Optimized for photorealistic style transfer
                  </p>
                </div>
              </div>
              <button
                onClick={handleCopyPrompt}
                className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Prompt</span>
              </button>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-green-50 dark:from-gray-900/50 dark:to-green-950/20 rounded-xl p-6 border-2 border-green-200/50 dark:border-green-800/30">
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  <FileImage className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-green-700 dark:text-green-300 mb-2">
                    Flux Dev Style Transfer Prompt
                  </h3>
                  <p className="text-gray-900 dark:text-white font-mono text-sm leading-relaxed whitespace-pre-wrap bg-white/60 dark:bg-gray-800/60 p-4 rounded-lg border border-green-200/30 dark:border-green-700/30">
                    {generatedPrompt}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-green-600 dark:text-green-400 bg-green-100/50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Optimized for photorealistic results</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Trigger word:{" "}
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    [{analysisResult?.triggerWord}]
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
