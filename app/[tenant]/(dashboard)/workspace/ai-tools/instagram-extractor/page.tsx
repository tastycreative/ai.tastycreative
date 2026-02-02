"use client";

import { useState } from "react";
import {
  Instagram,
  Download,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Loader2,
  ImageIcon,
  Copy,
  Eye,
  Archive,
  Database,
  Sparkles,
  Link as LinkIcon,
} from "lucide-react";
import JSZip from "jszip";

interface ExtractedImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

interface ExtractionResult {
  postUrl: string;
  images: ExtractedImage[];
  caption?: string;
  likes?: number;
  timestamp?: string;
}

export default function InstagramExtractorPage() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [imageLoadingStates, setImageLoadingStates] = useState<{
    [key: number]: boolean;
  }>({});
  const [imageErrorStates, setImageErrorStates] = useState<{
    [key: number]: boolean;
  }>({});

  const validateInstagramUrl = (url: string): boolean => {
    const instagramUrlPattern =
      /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p|reel)\/[A-Za-z0-9_-]+\/?/;
    return instagramUrlPattern.test(url);
  };

  const handleExtract = async () => {
    if (!url.trim()) {
      setError("Please enter an Instagram URL");
      return;
    }

    if (!validateInstagramUrl(url)) {
      setError("Please enter a valid Instagram post URL");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");
    setResult(null);

    try {
      const response = await fetch("/api/instagram-extractor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to extract images");
      }

      const data = await response.json();

      if (!data.images || data.images.length === 0) {
        throw new Error("No images found in this Instagram post");
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while extracting images"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadImage = async (imageUrl: string, index: number) => {
    setError("");
    setSuccess("");
    setDownloadingIndex(index);

    try {
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(
        imageUrl
      )}&download=true`;
      const response = await fetch(proxyUrl);

      if (response.ok) {
        const contentType = response.headers.get("content-type");

        if (contentType?.includes("application/json")) {
          const errorData = await response.json();
          throw new Error("Instagram blocked the download request");
        }

        const blob = await response.blob();

        if (blob.size === 0) {
          throw new Error("Received empty image data");
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `instagram-image-${index + 1}.jpg`;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);

        setSuccess(`Image ${index + 1} downloaded successfully!`);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Download failed";
      setError(
        `${errorMessage}. Opening image in new tab as fallback.`
      );
      window.open(imageUrl, "_blank");
    } finally {
      setDownloadingIndex(null);
    }
  };

  const handleSaveToReferenceBank = async (imageUrl: string, index: number) => {
    setError("");
    setSuccess("");
    setSavingIndex(index);

    try {
      const response = await fetch("/api/reference-bank/direct-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl,
          fileName: `instagram-image-${index + 1}.jpg`,
          fileType: "image/jpeg",
          width: result?.images[index].width || 1080,
          height: result?.images[index].height || 1440,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save to Reference Bank");
      }

      const data = await response.json();
      setSuccess(`Image ${index + 1} saved to Reference Bank!`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save to Reference Bank. Please try again."
      );
    } finally {
      setSavingIndex(null);
    }
  };

  const handleSaveAllToReferenceBank = async () => {
    if (!result?.images || result.images.length === 0) return;

    setSavingAll(true);
    setError("");
    setSuccess("");

    try {
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < result.images.length; i++) {
        try {
          const response = await fetch("/api/reference-bank/direct-upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              imageUrl: result.images[i].url,
              fileName: `instagram-image-${i + 1}.jpg`,
              fileType: "image/jpeg",
              width: result.images[i].width || 1080,
              height: result.images[i].height || 1440,
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
        }
      }

      if (successCount > 0) {
        setSuccess(
          `Saved ${successCount} image${successCount > 1 ? "s" : ""} to Reference Bank!${
            failCount > 0 ? ` (${failCount} failed)` : ""
          }`
        );
        setTimeout(() => setSuccess(""), 5000);
      } else {
        setError("Failed to save any images to Reference Bank.");
      }
    } catch (err) {
      setError("Failed to save images to Reference Bank.");
    } finally {
      setSavingAll(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!result?.images || result.images.length === 0) return;

    setDownloadingAll(true);
    setError("");
    setSuccess("");

    try {
      const zip = new JSZip();
      const imgFolder = zip.folder("instagram-images");
      
      if (!imgFolder) {
        throw new Error("Failed to create zip folder");
      }

      for (let i = 0; i < result.images.length; i++) {
        try {
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(
            result.images[i].url
          )}`;
          const response = await fetch(proxyUrl);

          if (!response.ok) continue;

          const blob = await response.blob();
          
          if (blob.size === 0) continue;

          imgFolder.file(`image-${i + 1}.jpg`, blob);
        } catch (err) {
          console.error(`Error processing image ${i + 1}:`, err);
        }
      }

      const zipBlob = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });

      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `instagram-images-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      setSuccess(`Downloaded ${result.images.length} images as zip!`);
      setTimeout(() => setSuccess(""), 3000);

    } catch (err) {
      setError("Failed to create zip file. Try downloading individually.");
    } finally {
      setDownloadingAll(false);
    }
  };

  const copyImageUrl = async (imageUrl: string, index: number) => {
    try {
      await navigator.clipboard.writeText(imageUrl);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-950 dark:via-gray-900 dark:to-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        
        {/* Modern Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 mb-6 shadow-2xl shadow-purple-500/30 animate-pulse">
            <Instagram className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Instagram Extractor
            </span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Extract high-quality images from any Instagram post instantly
          </p>
        </div>

        {/* Modern Input Card */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 rounded-3xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 p-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Instagram Post URL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <LinkIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.instagram.com/p/..."
                    className="block w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-gray-900 dark:text-white placeholder-gray-400 text-base"
                    disabled={isLoading}
                    onKeyDown={(e) => e.key === "Enter" && handleExtract()}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl animate-in slide-in-from-top-2">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                  <button
                    onClick={() => setError("")}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
              )}

              {success && (
                <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl animate-in slide-in-from-top-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
                  </div>
                  <button
                    onClick={() => setSuccess("")}
                    className="text-green-400 hover:text-green-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
              )}

              <button
                onClick={handleExtract}
                disabled={isLoading || !url.trim()}
                className="w-full py-4 px-6 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:via-purple-500 hover:to-indigo-500 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-2xl transition-all duration-300 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl shadow-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    <span>Extract Images</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Action Bar */}
            <div className="backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 rounded-3xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-6 mb-8">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {result.images.length} Image{result.images.length !== 1 ? "s" : ""} Found
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Ready to download or save
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => window.open(result.postUrl, "_blank")}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>View Original</span>
                  </button>
                  {result.images.length > 1 && (
                    <>
                      <button
                        onClick={handleDownloadAll}
                        disabled={downloadingAll || downloadingIndex !== null}
                        className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium rounded-xl transition-all flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 disabled:cursor-not-allowed"
                      >
                        {downloadingAll ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Creating Zip...</span>
                          </>
                        ) : (
                          <>
                            <Archive className="h-4 w-4" />
                            <span>Download Zip</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleSaveAllToReferenceBank}
                        disabled={savingAll || savingIndex !== null}
                        className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium rounded-xl transition-all flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 disabled:cursor-not-allowed"
                      >
                        {savingAll ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Database className="h-4 w-4" />
                            <span>Save All to Reference Bank</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Caption */}
            {result.caption && (
              <div className="backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 rounded-3xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-6 mb-8">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {result.caption}
                </p>
              </div>
            )}

            {/* Images Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {result.images.map((image, index) => (
                <div
                  key={index}
                  className="group relative backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 rounded-3xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
                >
                  {/* Image Container */}
                  <div className="aspect-square relative overflow-hidden bg-gray-100 dark:bg-gray-800">
                    {imageLoadingStates[index] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100/90 dark:bg-gray-800/90 backdrop-blur-sm z-10">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                      </div>
                    )}

                    {imageErrorStates[index] ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                        <ImageIcon className="h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          Failed to load image
                        </p>
                        <button
                          onClick={() => window.open(image.url, "_blank")}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-all"
                        >
                          Open Original
                        </button>
                      </div>
                    ) : (
                      <img
                        src={`/api/proxy-image?url=${encodeURIComponent(
                          image.url
                        )}&bypass=instagram`}
                        alt={image.alt || `Image ${index + 1}`}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        onLoad={() => {
                          setImageLoadingStates((prev) => ({
                            ...prev,
                            [index]: false,
                          }));
                        }}
                        onLoadStart={() => {
                          setImageLoadingStates((prev) => ({
                            ...prev,
                            [index]: true,
                          }));
                        }}
                        onError={async (e) => {
                          const target = e.target as HTMLImageElement;
                          if (
                            target.src.includes("/api/proxy-image") &&
                            !target.src.includes("format=base64")
                          ) {
                            try {
                              const base64Response = await fetch(
                                `/api/proxy-image?url=${encodeURIComponent(
                                  image.url
                                )}&format=base64&bypass=instagram`
                              );
                              if (base64Response.ok) {
                                const data = await base64Response.json();
                                if (data.success && data.dataUrl) {
                                  target.src = data.dataUrl;
                                  return;
                                }
                              }
                            } catch {}
                            target.src = image.url;
                          } else {
                            setImageLoadingStates((prev) => ({
                              ...prev,
                              [index]: false,
                            }));
                            setImageErrorStates((prev) => ({
                              ...prev,
                              [index]: true,
                            }));
                          }
                        }}
                      />
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Quick Actions */}
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-[-8px] group-hover:translate-y-0">
                      <button
                        onClick={() => window.open(image.url, "_blank")}
                        className="p-2.5 bg-white/90 hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-800 rounded-xl shadow-lg backdrop-blur-sm transition-all hover:scale-110 active:scale-95"
                        title="View full size"
                      >
                        <Eye className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                      </button>
                      <button
                        onClick={() => copyImageUrl(image.url, index)}
                        className="p-2.5 bg-white/90 hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-800 rounded-xl shadow-lg backdrop-blur-sm transition-all hover:scale-110 active:scale-95"
                        title="Copy URL"
                      >
                        {copiedIndex === index ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          Image {index + 1}
                        </p>
                        {image.width && image.height && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {image.width} × {image.height}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {!image.url.includes("c288.0.864.864a") && (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg">
                            HD
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleDownloadImage(image.url, index)}
                        disabled={downloadingIndex === index || downloadingAll}
                        className="px-3 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-gray-400 disabled:to-gray-500 text-white text-xs font-medium rounded-xl transition-all shadow-lg hover:scale-105 active:scale-95 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        {downloadingIndex === index ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleSaveToReferenceBank(image.url, index)}
                        disabled={savingIndex === index || savingAll}
                        className="px-3 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:from-gray-400 disabled:to-gray-500 text-white text-xs font-medium rounded-xl transition-all shadow-lg hover:scale-105 active:scale-95 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        {savingIndex === index ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Database className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => window.open(image.url, "_blank")}
                        className="px-3 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
