// Updated app/(dashboard)/workspace/my-influencers/page.tsx
"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/apiClient"; // Import the new API client
import {
  Upload,
  Users,
  Trash2,
  Download,
  Eye,
  AlertCircle,
  CheckCircle,
  Loader2,
  Plus,
  Image as ImageIcon,
  User,
  Settings,
  Info,
  RefreshCw,
  Clock,
  XCircle,
  Sync,
  FileText,
  Copy,
} from "lucide-react";

// Types remain the same...
interface InfluencerLoRA {
  id: string;
  name: string;
  displayName: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  uploadedAt: string;
  description?: string;
  thumbnailUrl?: string;
  isActive: boolean;
  usageCount: number;
  syncStatus?: "pending" | "synced" | "missing" | "error";
  lastUsedAt?: string;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: "uploading" | "processing" | "completed" | "failed";
  error?: string;
}

interface UploadInstructions {
  title: string;
  steps: string[];
  note: string;
}

export default function MyInfluencersPage() {
  const [influencers, setInfluencers] = useState<InfluencerLoRA[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] =
    useState<UploadInstructions | null>(null);

  // Fetch user's influencers on load - UPDATED
  useEffect(() => {
    fetchInfluencers();
  }, []);

  const fetchInfluencers = async () => {
    try {
      setLoading(true);
      // Use the new API client instead of direct fetch
      const response = await apiClient.get("/api/user/influencers");
      if (!response.ok) throw new Error("Failed to fetch influencers");

      const data = await response.json();
      setInfluencers(data.influencers || []);
    } catch (error) {
      console.error("Error fetching influencers:", error);
      setError("Failed to load your influencers");
    } finally {
      setLoading(false);
    }
  };

  // Sync with ComfyUI - UPDATED
  const syncWithComfyUI = async () => {
    try {
      setSyncing(true);
      // Use the new API client instead of direct fetch
      const response = await apiClient.post("/api/models/loras", {
        action: "sync_user_loras",
      });

      const data = await response.json();

      if (data.success) {
        // Refresh the influencers list
        await fetchInfluencers();

        // Show sync results
        const { summary } = data;
        alert(
          `Sync completed:\n${summary.synced} models synced\n${summary.missing} models missing\n${summary.total} total models checked`
        );
      } else {
        throw new Error(data.error || "Sync failed");
      }
    } catch (error) {
      console.error("Sync error:", error);
      alert("Failed to sync with ComfyUI");
    } finally {
      setSyncing(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter((file) => {
      const isValidType =
        file.name.toLowerCase().endsWith(".safetensors") ||
        file.name.toLowerCase().endsWith(".pt") ||
        file.name.toLowerCase().endsWith(".ckpt");
      const isValidSize = file.size <= 500 * 1024 * 1024; // 500MB limit

      if (!isValidType) {
        alert(
          `${file.name} is not a valid LoRA file. Please upload .safetensors, .pt, or .ckpt files.`
        );
        return false;
      }

      if (!isValidSize) {
        alert(`${file.name} is too large. Maximum file size is 500MB.`);
        return false;
      }

      return true;
    });

    setSelectedFiles(validFiles);
  };

  // Upload influencers - UPDATED
  const uploadInfluencers = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress([]);
    let hasManualInstructions = false;
    let manualInstructions: UploadInstructions | null = null;

    for (const file of selectedFiles) {
      try {
        const progressItem: UploadProgress = {
          fileName: file.name,
          progress: 0,
          status: "uploading",
        };

        setUploadProgress((prev) => [...prev, progressItem]);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("displayName", file.name.replace(/\.[^/.]+$/, "")); // Remove extension
        formData.append("description", ""); // Optional description

        // Use the new API client instead of direct fetch
        const response = await apiClient.postFormData(
          "/api/user/influencers/upload",
          formData
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || `Upload failed for ${file.name}`);
        }

        // Update progress to completed
        setUploadProgress((prev) =>
          prev.map((item) =>
            item.fileName === file.name
              ? { ...item, progress: 100, status: "completed" }
              : item
          )
        );

        // Check if manual setup is required
        if (!result.uploadedToComfyUI && result.instructions) {
          hasManualInstructions = true;
          manualInstructions = result.instructions;
          console.log("Manual setup required:", result.instructions);
        }
      } catch (error) {
        console.error("Upload error:", error);
        setUploadProgress((prev) =>
          prev.map((item) =>
            item.fileName === file.name
              ? {
                  ...item,
                  status: "failed",
                  error:
                    error instanceof Error ? error.message : "Upload failed",
                }
              : item
          )
        );
      }
    }

    // Show manual instructions if needed
    if (hasManualInstructions && manualInstructions) {
      setShowInstructions(manualInstructions);
    }

    // Refresh the influencers list
    await fetchInfluencers();

    setUploading(false);
    setShowUploadModal(false);
    setSelectedFiles([]);
    setUploadProgress([]);
  };

  // Delete influencer - UPDATED
  const deleteInfluencer = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this influencer? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      // Use the new API client instead of direct fetch
      const response = await apiClient.delete(`/api/user/influencers/${id}`);

      if (!response.ok) throw new Error("Failed to delete influencer");

      setInfluencers((prev) => prev.filter((inf) => inf.id !== id));
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete influencer");
    }
  };

  // Toggle influencer status - UPDATED
  const toggleInfluencerStatus = async (id: string, isActive: boolean) => {
    try {
      // Use the new API client instead of direct fetch
      const response = await apiClient.patch(`/api/user/influencers/${id}`, {
        isActive,
      });

      if (!response.ok) throw new Error("Failed to update influencer");

      setInfluencers((prev) =>
        prev.map((inf) => (inf.id === id ? { ...inf, isActive } : inf))
      );
    } catch (error) {
      console.error("Update error:", error);
      alert("Failed to update influencer status");
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getSyncStatusIcon = (syncStatus?: string) => {
    switch (syncStatus) {
      case "synced":
        return (
          <CheckCircle
            className="w-4 h-4 text-green-500"
            title="Synced with ComfyUI"
          />
        );
      case "pending":
        return (
          <Clock className="w-4 h-4 text-yellow-500" title="Pending sync" />
        );
      case "missing":
        return (
          <XCircle
            className="w-4 h-4 text-red-500"
            title="Missing from ComfyUI"
          />
        );
      case "error":
        return (
          <AlertCircle className="w-4 h-4 text-red-500" title="Sync error" />
        );
      default:
        return (
          <Clock className="w-4 h-4 text-gray-400" title="Unknown status" />
        );
    }
  };

  const getSyncStatusText = (syncStatus?: string) => {
    switch (syncStatus) {
      case "synced":
        return "Ready to use";
      case "pending":
        return "Needs setup";
      case "missing":
        return "Not found in ComfyUI";
      case "error":
        return "Sync error";
      default:
        return "Unknown";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const syncedCount = influencers.filter(
    (inf) => inf.syncStatus === "synced"
  ).length;
  const pendingCount = influencers.filter(
    (inf) => inf.syncStatus === "pending"
  ).length;
  const missingCount = influencers.filter(
    (inf) => inf.syncStatus === "missing"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                My Influencers
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage your personal LoRA models for AI-generated content
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={syncWithComfyUI}
              disabled={syncing}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium rounded-lg shadow-sm transition-colors"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>Sync with ComfyUI</span>
            </button>

            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-medium rounded-lg shadow-sm transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              <span>Add Influencer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Manual Instructions Modal - No changes needed */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>{showInstructions.title}</span>
                </h2>
                <button
                  onClick={() => setShowInstructions(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-yellow-800 dark:text-yellow-200">
                  <strong>
                    Upload completed, but manual setup is required.
                  </strong>{" "}
                  ComfyUI doesn't appear to have an automatic file upload API
                  enabled.
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Follow these steps:
                </h3>
                {showInstructions.steps.map((step, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-900 dark:text-white">{step}</p>
                      {step.includes("ComfyUI/models/loras/") && (
                        <button
                          onClick={() => copyToClipboard(step.split(": ")[1])}
                          className="mt-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center space-x-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy path</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                  <strong>Note:</strong> {showInstructions.note}
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowInstructions(null)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  I'll do this later
                </button>
                <button
                  onClick={() => {
                    setShowInstructions(null);
                    syncWithComfyUI();
                  }}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
                >
                  I've completed the setup, sync now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Card - Add user context */}
      {influencers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Your LoRA Models Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {influencers.length}
              </div>
              <div className="text-sm text-gray-500">Your Models</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {syncedCount}
              </div>
              <div className="text-sm text-gray-500">Ready to Use</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {pendingCount}
              </div>
              <div className="text-sm text-gray-500">Need Setup</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {missingCount}
              </div>
              <div className="text-sm text-gray-500">Missing</div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Info Card - Updated text for clarity */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              About Your Personal Influencer LoRA Models
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
              Upload your custom LoRA models to create AI-generated content with
              specific styles or characteristics. These models are private to
              your account and only you can use them.
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              <strong>Status indicators:</strong> Green = Ready to use, Yellow =
              Needs setup, Red = Missing from ComfyUI
            </p>
          </div>
        </div>
      </div>

      {/* Empty state - Updated text */}
      {influencers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full">
              <User className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Personal Influencers Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Upload your first LoRA model to get started with personalized AI
                generation. Your models will be private to your account.
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Your First Influencer</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {influencers.map((influencer) => (
            <div
              key={influencer.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Thumbnail */}
              <div className="h-48 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 flex items-center justify-center">
                {influencer.thumbnailUrl ? (
                  <img
                    src={influencer.thumbnailUrl}
                    alt={influencer.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-16 h-16 text-purple-400" />
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {influencer.displayName}
                  </h3>
                  <div className="flex items-center space-x-1">
                    {getSyncStatusIcon(influencer.syncStatus)}
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      influencer.syncStatus === "synced"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                        : influencer.syncStatus === "pending"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                    }`}
                  >
                    {getSyncStatusText(influencer.syncStatus)}
                  </span>
                  <button
                    onClick={() =>
                      toggleInfluencerStatus(
                        influencer.id,
                        !influencer.isActive
                      )
                    }
                    className={`w-3 h-3 rounded-full ${
                      influencer.isActive
                        ? "bg-green-500"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                    title={influencer.isActive ? "Active" : "Inactive"}
                  />
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {influencer.description || "No description provided"}
                </p>

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                  <span>{formatFileSize(influencer.fileSize)}</span>
                  <span>{influencer.usageCount} uses</span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        /* View details */
                      }}
                      className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        /* Download */
                      }}
                      className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => deleteInfluencer(influencer.id)}
                    className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal - No changes needed in the JSX, as the upload function was already updated */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Upload New Influencer
                </h2>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFiles([]);
                    setUploadProgress([]);
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              {/* File Upload Area */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select LoRA Files
                </label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
                  <input
                    type="file"
                    accept=".safetensors,.pt,.ckpt"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Click to select LoRA files or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Supports .safetensors, .pt, .ckpt files (max 500MB each)
                    </p>
                  </label>
                </div>
              </div>

              {/* Note about potential manual setup */}
              <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  <strong>Note:</strong> Some files may require manual setup in
                  ComfyUI. We'll provide detailed instructions if needed.
                </p>
              </div>

              {/* Selected Files */}
              {selectedFiles.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Selected Files ({selectedFiles.length})
                  </h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {file.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {uploadProgress.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Upload Progress
                  </h3>
                  <div className="space-y-2">
                    {uploadProgress.map((progress, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                            {progress.fileName}
                          </span>
                          <div className="flex items-center space-x-2">
                            {progress.status === "uploading" && (
                              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            )}
                            {progress.status === "completed" && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                            {progress.status === "failed" && (
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-xs text-gray-500">
                              {progress.progress}%
                            </span>
                          </div>
                        </div>
                        {progress.status !== "completed" && (
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                            <div
                              className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                              style={{ width: `${progress.progress}%` }}
                            />
                          </div>
                        )}
                        {progress.error && (
                          <p className="text-xs text-red-500">
                            {progress.error}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFiles([]);
                    setUploadProgress([]);
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  onClick={uploadInfluencers}
                  disabled={uploading || selectedFiles.length === 0}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  {uploading ? "Uploading..." : "Upload Influencers"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
