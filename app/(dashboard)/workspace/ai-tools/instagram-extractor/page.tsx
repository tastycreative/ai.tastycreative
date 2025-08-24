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
} from "lucide-react";

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

      // Validate that we got some images
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
    // Clear any previous messages and set loading state
    setError("");
    setSuccess("");
    setDownloadingIndex(index);

    try {
      console.log(`Attempting to download image ${index + 1}...`);

      // Use proxy with download=true parameter for downloads
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(
        imageUrl
      )}&download=true`;
      const response = await fetch(proxyUrl);

      if (response.ok) {
        const contentType = response.headers.get("content-type");

        // Check if it's JSON (error response) or actual image
        if (contentType?.includes("application/json")) {
          const errorData = await response.json();
          console.log("Proxy returned error:", errorData);
          throw new Error("Instagram blocked the download request");
        }

        // Success: Download the image
        const blob = await response.blob();

        // Verify we got actual image data
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

        // Clean up
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);

        console.log(`✅ Successfully downloaded image ${index + 1}`);
        setSuccess(`Image ${index + 1} downloaded successfully!`);

        // Clear success message after a few seconds
        setTimeout(() => setSuccess(""), 3000);
      } else if (response.status === 500) {
        // Check if it's our custom error response
        try {
          const errorData = await response.json();
          if (!errorData.success) {
            throw new Error("Instagram blocked the download request");
          }
        } catch {
          throw new Error(`Server error: ${response.status}`);
        }
      } else {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
    } catch (err) {
      console.error("Failed to download image:", err);

      // Show error but also provide fallback
      const errorMessage =
        err instanceof Error ? err.message : "Download failed";
      setError(
        `${errorMessage}. Opening image in new tab as fallback - you can right-click and save manually.`
      );

      // Fallback: Open the original Instagram image in new tab
      window.open(imageUrl, "_blank");
    } finally {
      setDownloadingIndex(null);
    }
  };

  const handleDownloadAll = async () => {
    if (!result?.images) return;

    for (let i = 0; i < result.images.length; i++) {
      await handleDownloadImage(result.images[i].url, i);
      // Add a small delay between downloads
      await new Promise((resolve) => setTimeout(resolve, 1000));
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

  const openImageInNewTab = (imageUrl: string) => {
    window.open(imageUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-pink-50/30 to-purple-50/50 dark:from-gray-900 dark:via-pink-950/10 dark:to-purple-950/20">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Enhanced Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 rounded-3xl shadow-2xl mb-6 transform hover:scale-105 transition-all">
            <Instagram className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 dark:from-pink-400 dark:via-purple-400 dark:to-indigo-400 bg-clip-text text-transparent mb-4">
            Instagram Image Extractor
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Extract and download high-quality images from any Instagram post
            instantly. Simply paste the URL and get professional-grade images
            with full metadata.
          </p>
          <div className="flex items-center justify-center space-x-2 mt-4">
            <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              Secure & Fast Extraction
            </span>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-75"></div>
          </div>
        </div>

        {/* Enhanced URL Input Form */}
        <div className="bg-gradient-to-br from-white via-pink-50/20 to-purple-50/30 dark:from-gray-800 dark:via-pink-950/10 dark:to-purple-950/20 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/30 rounded-3xl shadow-2xl p-8 mb-10">
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30 rounded-2xl mb-4">
                <Instagram className="w-6 h-6 text-pink-600 dark:text-pink-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Paste Instagram URL
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Enter any Instagram post or reel URL to extract images
              </p>
            </div>

            <div>
              <label
                htmlFor="instagram-url"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3"
              >
                Instagram Post URL
              </label>
              <div className="relative">
                <input
                  id="instagram-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.instagram.com/p/..."
                  className="w-full px-6 py-4 pr-14 border-2 border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all font-medium text-lg"
                  disabled={isLoading}
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30 rounded-lg flex items-center justify-center">
                  <Instagram className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-800 dark:text-red-200 mb-1">
                        Extraction Failed
                      </h3>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {error}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setError("")}
                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 p-1"
                  >
                    <span className="sr-only">Dismiss</span>×
                  </button>
                </div>
              </div>
            )}

            {success && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-800 rounded-2xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-green-800 dark:text-green-200 mb-1">
                        Success!
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {success}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSuccess("")}
                    className="text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-200 p-1"
                  >
                    <span className="sr-only">Dismiss</span>×
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleExtract}
              disabled={isLoading || !url.trim()}
              className="w-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600 hover:from-pink-600 hover:via-purple-600 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 disabled:cursor-not-allowed flex items-center justify-center space-x-3 shadow-xl hover:shadow-2xl transform hover:scale-105"
            >
              {isLoading ? (
                <>
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Extracting Images...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-6 h-6" />
                  <span>Extract Images</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-white/80 dark:bg-gray-900/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/30 p-6">
            {/* Result Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Extraction Complete
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Found {result.images.length} image
                    {result.images.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.open(result.postUrl, "_blank")}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>View Original</span>
                </button>
                {result.images.length > 1 && (
                  <button
                    onClick={handleDownloadAll}
                    disabled={downloadingAll || downloadingIndex !== null}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg transition-all duration-300 shadow-md disabled:cursor-not-allowed"
                  >
                    {downloadingAll ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Downloading...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        <span>Download All</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Post Info */}
            {result.caption && (
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                  {result.caption}
                </p>
              </div>
            )}

            {/* Images Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {result.images.map((image, index) => (
                <div
                  key={index}
                  className="group relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700"
                >
                  <div className="aspect-square relative overflow-hidden bg-gray-100 dark:bg-gray-800">
                    {imageLoadingStates[index] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                        <div className="flex flex-col items-center space-y-2">
                          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Loading image...
                          </span>
                        </div>
                      </div>
                    )}

                    {imageErrorStates[index] ? (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-600">
                        <div className="text-center p-4">
                          <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                            Image preview blocked
                          </p>
                          <button
                            onClick={() => window.open(image.url, "_blank")}
                            className="text-xs text-blue-500 hover:text-blue-600 underline"
                          >
                            Open directly
                          </button>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={`/api/proxy-image?url=${encodeURIComponent(
                          image.url
                        )}`}
                        alt={image.alt || `Instagram image ${index + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onLoad={() => {
                          console.log(
                            `✅ Successfully loaded image ${index + 1}`
                          );
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
                        onError={(e) => {
                          console.log(
                            `❌ Failed to load proxied image ${
                              index + 1
                            }, trying original URL`
                          );
                          const target = e.target as HTMLImageElement;

                          if (target.src.includes("/api/proxy-image")) {
                            // Try original URL as fallback
                            target.src = image.url;
                          } else {
                            // Both proxied and original failed
                            console.log(
                              `❌ Both proxied and original URLs failed for image ${
                                index + 1
                              }`
                            );
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

                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

                    {/* Image Overlay Actions */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex space-x-2">
                      <button
                        onClick={() => openImageInNewTab(image.url)}
                        className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-md hover:bg-white dark:hover:bg-gray-800 transition-colors"
                        title="View full size"
                      >
                        <Eye className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                      </button>
                      <button
                        onClick={() => copyImageUrl(image.url, index)}
                        className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-md hover:bg-white dark:hover:bg-gray-800 transition-colors"
                        title="Copy image URL"
                      >
                        {copiedIndex === index ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Image Actions */}
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Image {index + 1}
                        {image.width && image.height && (
                          <span className="ml-2">
                            {image.width} × {image.height}
                          </span>
                        )}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {/* Quality indicators */}
                          {!image.url.includes("c288.0.864.864a") && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Uncropped
                            </span>
                          )}
                          {image.url.includes("s1080x1080") && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              HD
                            </span>
                          )}
                          {image.url.includes("_e15_") && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                              HQ
                            </span>
                          )}
                          {!image.url.includes("stp=") && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                              Original
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleDownloadImage(image.url, index)}
                          disabled={
                            downloadingIndex === index || downloadingAll
                          }
                          className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white text-sm rounded-lg transition-all duration-300 shadow-md hover:shadow-lg disabled:cursor-not-allowed"
                        >
                          {downloadingIndex === index ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Downloading...</span>
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4" />
                              <span>Download</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => window.open(image.url, "_blank")}
                          className="flex items-center space-x-2 px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg transition-all duration-300 shadow-md hover:shadow-lg"
                          title="Open in new tab for manual save"
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span>Open</span>
                        </button>
                      </div>
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
