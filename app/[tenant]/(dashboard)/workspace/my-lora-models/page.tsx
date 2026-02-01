// app/(dashboard)/workspace/my-lora-models/page.tsx - LoRA Model management with direct ComfyUI upload
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useApiClient } from "@/lib/apiClient";
import { useAuth } from "@clerk/nextjs";
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
  ImagePlus,
  User,
  Settings,
  Info,
  RefreshCw,
  Clock,
  XCircle,
  FileText,
  Copy,
  Calendar,
  HardDrive,
  BarChart3,
  Sparkles,
  Share2,
  X,
  Box,
} from "lucide-react";
import { toast } from "sonner";
import ShareLoRAModal from "@/components/ShareLoRAModal";
import SelectThumbnailModal from "@/components/SelectThumbnailModal";

// Types
interface LoRAModel {
  id: string;
  userId: string;
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
  comfyUIPath?: string;
  isShared?: boolean;
  sharedBy?: string;
  ownerClerkId?: string;
  hasShares?: boolean;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: "uploading" | "processing" | "completed" | "failed";
  error?: string;
  uploadMethod?: "multipart-s3";
}

interface UploadInstructions {
  title: string;
  steps: string[];
  note: string;
}

export default function MyLoRAModelsPage() {
  const [loraModels, setLoraModels] = useState<LoRAModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [comfyUIStatus, setComfyUIStatus] = useState<{
    status: string;
    url: string;
    lastChecked?: Date;
  } | null>(null);
  const [showInstructions, setShowInstructions] =
    useState<UploadInstructions | null>(null);
  const [selectedModel, setSelectedModel] =
    useState<LoRAModel | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [thumbnailUploadingId, setThumbnailUploadingId] = useState<string | null>(
    null
  );
  const [deleteCandidate, setDeleteCandidate] = useState<LoRAModel | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareLoRAModalOpen, setShareLoRAModalOpen] = useState(false);
  const [loraToShare, setLoraToShare] = useState<LoRAModel | null>(null);
  const [selectThumbnailModalOpen, setSelectThumbnailModalOpen] = useState(false);
  const [loraForThumbnail, setLoraForThumbnail] = useState<LoRAModel | null>(null);
  const [thumbnailOptionsModalOpen, setThumbnailOptionsModalOpen] = useState(false);
  const [thumbnailOptionsModel, setThumbnailOptionsModel] = useState<LoRAModel | null>(null);
  const [activeView, setActiveView] = useState<'my-loras' | 'shared'>('my-loras');

  // ✅ Get the authenticated API client and user
  const apiClient = useApiClient();
  const { userId } = useAuth();

  // Fetch user's LoRA models on load
  useEffect(() => {
    if (apiClient) {
      fetchLoRAModels();
    }
  }, [apiClient]);

  const fetchLoRAModels = async () => {
    if (!apiClient) {
      console.log("⚠️ API client not ready");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log("Fetching LoRA models...");

      const response = await apiClient.get("/api/user/influencers");
      console.log("Fetch response status:", response.status);

      if (!response.ok) {
        throw new Error(`Failed to fetch LoRA models: ${response.status}`);
      }

      const data = await response.json();
      console.log("Fetched LoRA models data:", data);

      setLoraModels(Array.isArray(data) ? data : []);

      if (Array.isArray(data) && data.length > 0) {
        console.log(`Successfully loaded ${data.length} LoRA models`);
      } else {
        console.log("No LoRA models found for this user");
      }
    } catch (error) {
      console.error("Error fetching LoRA models:", error);
      setError(
        `Failed to load your LoRA models: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  // Sync with ComfyUI
  const syncWithComfyUI = async () => {
    if (!apiClient) return;

    try {
      setSyncing(true);
      console.log("=== SYNC WITH COMFYUI ===");

      const response = await apiClient.post("/api/models/loras", {
        action: "sync_user_loras",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Sync request failed: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();

      if (data.success) {
        await fetchLoRAModels();

        const { summary } = data;
        alert(
          `Sync completed:\n${summary.synced} models synced\n${summary.missing} models missing\n${summary.total} total models checked`
        );
      } else {
        throw new Error(data.error || "Sync failed");
      }
    } catch (error) {
      console.error("Sync error:", error);

      if (error instanceof Error) {
        alert(`Sync failed: ${error.message}`);
      } else {
        alert("Sync failed: Unknown error");
      }
    } finally {
      setSyncing(false);
    }
  };

  // Sync uploaded files from Blob to ComfyUI
  const syncUploadedFiles = async () => {
    if (!apiClient) return;

    try {
      setSyncing(true);
      console.log("=== SYNC UPLOADED FILES ===");

      const response = await apiClient.post(
        "/api/user/influencers/sync-blob-files",
        {}
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Sync request failed: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();

      if (data.success) {
        await fetchLoRAModels();

        alert(
          `Sync completed:\n${data.synced} files synced to ComfyUI\n${data.failed} files failed\n${data.total} total files processed`
        );
      } else {
        throw new Error(data.error || "Sync failed");
      }
    } catch (error) {
      console.error("Sync uploaded files error:", error);

      if (error instanceof Error) {
        alert(`Sync failed: ${error.message}`);
      } else {
        alert("Sync failed: Unknown error");
      }
    } finally {
      setSyncing(false);
    }
  };

  const uploadThumbnail = async (modelId: string, file: File) => {
    if (!apiClient) return;

    setThumbnailUploadingId(modelId);

    try {
      const formData = new FormData();
      formData.append("thumbnail", file);

      const response = await apiClient.postFormData(
        `/api/user/influencers/${modelId}/thumbnail`,
        formData
      );

      if (!response.ok) {
        let message = `Failed to upload thumbnail (status ${response.status})`;
        try {
          const errorBody = await response.json();
          if (errorBody?.error) {
            message = errorBody.error;
          }
        } catch (parseError) {
          console.warn("Could not parse thumbnail upload error:", parseError);
        }

        throw new Error(message);
      }

      const data = await response.json();

      setLoraModels((prev) =>
        prev.map((model) =>
          model.id === modelId
            ? {
                ...model,
                thumbnailUrl:
                  data?.influencer?.thumbnailUrl ?? data?.thumbnailUrl ?? model.thumbnailUrl,
              }
            : model
        )
      );
      
      toast.success("Thumbnail updated successfully!");
    } catch (error) {
      console.error("Thumbnail upload error:", error);
      alert(
        `Failed to upload thumbnail: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setThumbnailUploadingId(null);
    }
  };

  const setThumbnailFromGeneratedImage = async (modelId: string, imageUrl: string) => {
    if (!apiClient) return;

    setThumbnailUploadingId(modelId);

    try {
      const formData = new FormData();
      formData.append("imageUrl", imageUrl);

      const response = await apiClient.postFormData(
        `/api/user/influencers/${modelId}/thumbnail`,
        formData
      );

      if (!response.ok) {
        let message = `Failed to set thumbnail (status ${response.status})`;
        try {
          const errorBody = await response.json();
          if (errorBody?.error) {
            message = errorBody.error;
          }
        } catch (parseError) {
          console.warn("Could not parse thumbnail set error:", parseError);
        }

        throw new Error(message);
      }

      const data = await response.json();

      setLoraModels((prev) =>
        prev.map((model) =>
          model.id === modelId
            ? {
                ...model,
                thumbnailUrl:
                  data?.influencer?.thumbnailUrl ?? data?.thumbnailUrl ?? model.thumbnailUrl,
              }
            : model
        )
      );
      
      toast.success("Thumbnail set successfully!");
    } catch (error) {
      console.error("Thumbnail set error:", error);
      throw error;
    } finally {
      setThumbnailUploadingId(null);
    }
  };

  const handleThumbnailSelect = async (
    modelId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (JPG, PNG, WebP).");
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      alert("Thumbnail image is too large. Please choose a file under 5MB.");
      return;
    }

    await uploadThumbnail(modelId, file);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter((file) => {
      const isValidType =
        file.name.toLowerCase().endsWith(".safetensors") ||
        file.name.toLowerCase().endsWith(".pt") ||
        file.name.toLowerCase().endsWith(".ckpt");
      const isValidSize = file.size <= 2 * 1024 * 1024 * 1024;

      if (!isValidType) {
        alert(
          `${file.name} is not a valid LoRA file. Please upload .safetensors, .pt, or .ckpt files.`
        );
        return false;
      }

      if (!isValidSize) {
        const fileSizeMB = Math.round(file.size / 1024 / 1024);
        alert(
          `${file.name} is too large (${fileSizeMB}MB). Maximum file size is 2GB.`
        );
        return false;
      }

      return true;
    });

    setSelectedFiles(validFiles);
  };

  const checkComfyUIStatus = async () => {
    try {
      const response = await apiClient!.get("/api/env-check");
      if (response.ok) {
        const data = await response.json();
        setComfyUIStatus({
          status: data.comfyuiStatus,
          url: data.comfyuiUrl,
          lastChecked: new Date(),
        });
      }
    } catch (error) {
      console.error("Failed to check ComfyUI status:", error);
      setComfyUIStatus({
        status: "check-failed",
        url: "unknown",
        lastChecked: new Date(),
      });
    }
  };

  const getComfyUIUrl = async (): Promise<string> => {
    try {
      const response = await apiClient!.get("/api/env-check");
      if (response.ok) {
        const data = await response.json();
        return (
          data.comfyuiUrl ||
          process.env.NEXT_PUBLIC_COMFYUI_URL ||
          "http://localhost:8188"
        );
      }
    } catch (error) {
      console.warn("Could not fetch ComfyUI URL from server, using defaults");
    }

    return (
      process.env.NEXT_PUBLIC_COMFYUI_URL ||
      process.env.NEXT_PUBLIC_RUNPOD_URL ||
      "http://localhost:8188"
    );
  };

  // Multipart chunked upload to S3
  const uploadToS3 = async (
    file: File,
    displayName: string,
    onProgress?: (progress: number) => void
  ): Promise<{
    success: boolean;
    uniqueFileName: string;
    comfyUIPath: string;
    networkVolumePath?: string;
  }> => {
    console.log(
      `🚀 Starting multipart S3 upload for ${file.name} (${Math.round(
        file.size / 1024 / 1024
      )}MB)`
    );

    if (!apiClient) {
      throw new Error("API client is not initialized");
    }

    const CHUNK_SIZE = 4 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    try {
      // Step 1: Start multipart upload
      const startFormData = new FormData();
      startFormData.append("action", "start");
      startFormData.append("fileName", file.name);
      startFormData.append("displayName", displayName);
      startFormData.append("totalParts", totalChunks.toString());

      const startResponse = await apiClient.postFormData(
        "/api/user/influencers/multipart-s3-upload",
        startFormData
      );
      if (!startResponse.ok) {
        const errorData = await startResponse
          .json()
          .catch(() => ({ error: `HTTP ${startResponse.status}` }));
        throw new Error(
          errorData.error ||
            `Failed to start multipart upload: ${startResponse.status}`
        );
      }

      const startResult = await startResponse.json();
      const { sessionId, uploadId, uniqueFileName, s3Key } = startResult;

      console.log(`✅ Multipart upload started: ${uploadId}`);

      // Step 2: Upload all parts
      for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        let partSuccess = false;
        let lastError = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const partFormData = new FormData();
            partFormData.append("action", "upload");
            partFormData.append("chunk", chunk);
            partFormData.append("partNumber", partNumber.toString());
            partFormData.append("sessionId", sessionId);
            partFormData.append("uploadId", uploadId);
            partFormData.append("s3Key", s3Key);
            partFormData.append("uniqueFileName", uniqueFileName);
            partFormData.append("totalParts", totalChunks.toString());

            const partResponse = await apiClient.postFormData(
              "/api/user/influencers/multipart-s3-upload",
              partFormData
            );
            
            if (!partResponse.ok) {
              const errorData = await partResponse
                .json()
                .catch(() => ({ error: `HTTP ${partResponse.status}` }));
              throw new Error(
                errorData.error ||
                  `Part ${partNumber} upload failed: ${partResponse.status}`
              );
            }

            const partResult = await partResponse.json();
            if (!partResult.success) {
              throw new Error(
                `Part ${partNumber} upload failed: ${
                  partResult.error || "Unknown error"
                }`
              );
            }

            partSuccess = true;
            break;
          } catch (error) {
            lastError = error;
            if (attempt < 3) {
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * attempt)
              );
            }
          }
        }

        if (!partSuccess) {
          throw new Error(
            `Part ${partNumber} failed after 3 attempts: ${
              lastError instanceof Error ? lastError.message : "Unknown error"
            }`
          );
        }

        if (onProgress) {
          const progress = Math.round((partNumber / totalChunks) * 100);
          onProgress(progress);
        }
      }

      // Step 3: Complete multipart upload
      const completeFormData = new FormData();
      completeFormData.append("action", "complete");
      completeFormData.append("sessionId", sessionId);

      const completeResponse = await apiClient.postFormData(
        "/api/user/influencers/multipart-s3-upload",
        completeFormData
      );
      if (!completeResponse.ok) {
        const errorData = await completeResponse
          .json()
          .catch(() => ({ error: `HTTP ${completeResponse.status}` }));
        throw new Error(
          errorData.error ||
            `Failed to complete multipart upload: ${completeResponse.status}`
        );
      }

      const completeResult = await completeResponse.json();
      if (!completeResult.success) {
        throw new Error(
          `Failed to complete multipart upload: ${
            completeResult.error || "Unknown error"
          }`
        );
      }

      return {
        success: true,
        uniqueFileName: completeResult.uniqueFileName,
        comfyUIPath: completeResult.comfyUIPath,
        networkVolumePath: completeResult.networkVolumePath,
      };
    } catch (error) {
      console.error(`❌ Multipart upload failed:`, error);
      throw error;
    }
  };

  const createDatabaseRecord = async (
    uniqueFileName: string,
    file: File,
    displayName: string,
    syncStatus: "synced" | "pending" = "pending",
    comfyUIPath?: string
  ) => {
    if (!apiClient) {
      throw new Error("API client is not initialized.");
    }
    try {
      const response = await apiClient.post(
        "/api/user/influencers/create-record",
        {
          name: displayName,
          displayName: displayName,
          fileName: uniqueFileName,
          originalFileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          syncStatus: syncStatus.toUpperCase(),
          isActive: true,
          usageCount: 0,
          comfyUIPath:
            comfyUIPath ||
            (syncStatus === "synced"
              ? `models/loras/${userId}/${uniqueFileName}`
              : undefined),
        }
      );

      if (!response.ok) {
        throw new Error("Database record creation failed");
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("❌ Database record creation failed:", error);
      throw error;
    }
  };

  const uploadLoRAModels = async () => {
    if (selectedFiles.length === 0 || !apiClient || !userId) return;

    setUploading(true);
    setUploadProgress([]);

    for (const file of selectedFiles) {
      try {
        const progressItem: UploadProgress = {
          fileName: file.name,
          progress: 0,
          status: "uploading",
          uploadMethod: "multipart-s3",
        };

        setUploadProgress((prev) => [...prev, progressItem]);

        const displayName = file.name.replace(/\.[^/.]+$/, "");

        setUploadProgress((prev) =>
          prev.map((item) =>
            item.fileName === file.name
              ? { ...item, progress: 5, status: "uploading" }
              : item
          )
        );

        let uploadResult;
        let syncStatus: "synced" | "pending" = "pending";
        let comfyUIPath: string | undefined;

        try {
          const s3UploadResult = await uploadToS3(
            file,
            displayName,
            (progress: number) => {
              setUploadProgress((prev) =>
                prev.map((item) =>
                  item.fileName === file.name
                    ? {
                        ...item,
                        progress: Math.round(progress),
                        status: "uploading",
                        uploadMethod: "multipart-s3",
                      }
                    : item
                )
              );
            }
          );

          uploadResult = {
            success: true,
            uniqueFileName: s3UploadResult.uniqueFileName,
            comfyResult: {
              networkVolumePath: s3UploadResult.networkVolumePath,
            },
          };
          syncStatus = "synced";
          comfyUIPath = s3UploadResult.comfyUIPath;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "Unknown upload error";

          throw new Error(`Upload failed: ${errorMsg}`);
        }

        await createDatabaseRecord(
          uploadResult.uniqueFileName,
          file,
          displayName,
          syncStatus,
          comfyUIPath
        );

        setUploadProgress((prev) =>
          prev.map((item) =>
            item.fileName === file.name
              ? {
                  ...item,
                  progress: 100,
                  status: "completed",
                }
              : item
          )
        );
      } catch (error) {
        console.error("❌ Upload pipeline error:", error);
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

        if (error instanceof Error) {
          alert(
            `Upload failed for ${file.name}: ${error.message}\n\nPlease try again or contact support if the issue persists.`
          );
        }
      }
    }

    const completedUploads = uploadProgress.filter(
      (p) => p.status === "completed"
    ).length;
    const failedUploads = uploadProgress.filter(
      (p) => p.status === "failed"
    ).length;

    if (completedUploads > 0) {
      const multipartUploads = uploadProgress.filter(
        (p) => p.status === "completed" && p.uploadMethod === "multipart-s3"
      ).length;

      let message = `🎉 Upload Results:\n\n✅ ${completedUploads} file(s) uploaded successfully\n`;

      if (multipartUploads > 0) {
        message += `🚀 ${multipartUploads} file(s) uploaded to S3 network volume (ready for text-to-image generation!)\n`;
      }
      if (failedUploads > 0) {
        message += `❌ ${failedUploads} file(s) failed\n`;
      }

      alert(message);
    }

    await fetchLoRAModels();

    setUploading(false);
    setShowUploadModal(false);
    setSelectedFiles([]);
    setUploadProgress([]);
  };

  const deleteModel = async (model: LoRAModel) => {
    if (!apiClient) return;

    try {
      setIsDeleting(true);

      const response = await apiClient.delete(
        `/api/user/influencers/${model.id}`
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to delete model");
      }

      await response.json();

      setLoraModels((prev) =>
        prev.filter((m) => m.id !== model.id)
      );

      toast.success(`Deleted ${model.displayName}`, {
        description: "Removed from database and storage.",
      });
    } catch (error) {
      console.error("Delete error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete model";
      toast.error(`Failed to delete ${model.displayName}`, {
        description: errorMessage,
      });
    } finally {
      setIsDeleting(false);
      setDeleteCandidate(null);
    }
  };

  const toggleModelStatus = async (id: string, isActive: boolean) => {
    if (!apiClient) return;

    try {
      const response = await apiClient.patch(`/api/user/influencers/${id}`, {
        isActive,
      });

      if (!response.ok) throw new Error("Failed to update model");

      setLoraModels((prev) =>
        prev.map((model) => (model.id === id ? { ...model, isActive } : model))
      );
    } catch (error) {
      console.error("Update error:", error);
      alert("Failed to update model status");
    }
  };

  const handleShareLoRA = (model: LoRAModel) => {
    setLoraToShare(model);
    setShareLoRAModalOpen(true);
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
          <span title="Synced with ComfyUI">
            <CheckCircle className="w-4 h-4 text-green-500" />
          </span>
        );
      case "pending":
        return (
          <span title="Pending sync">
            <Clock className="w-4 h-4 text-yellow-500" />
          </span>
        );
      case "missing":
        return (
          <span title="Missing from ComfyUI">
            <XCircle className="w-4 h-4 text-red-500" />
          </span>
        );
      case "error":
        return (
          <span title="Sync error">
            <AlertCircle className="w-4 h-4 text-red-500" />
          </span>
        );
      default:
        return (
          <span title="Unknown status">
            <Clock className="w-4 h-4 text-gray-400" />
          </span>
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

  const showModelDetails = (model: LoRAModel) => {
    setSelectedModel(model);
    setShowDetailsModal(true);
  };

  // Loading state
  if (!apiClient) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto"></div>
            <Box className="absolute inset-0 w-8 h-8 text-blue-500 animate-pulse m-auto" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              Setting Up LoRA Model Studio
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md">
              Preparing your LoRA model management system...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const syncedCount = loraModels.filter(
    (m) => m.syncStatus === "synced"
  ).length;
  const pendingCount = loraModels.filter(
    (m) => m.syncStatus === "pending"
  ).length;
  const missingCount = loraModels.filter(
    (m) => m.syncStatus === "missing"
  ).length;

  const ownedModels = loraModels.filter((m) => !m.isShared);
  const sharedModels = loraModels.filter((m) => m.isShared);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl shadow-lg border border-blue-200 dark:border-cyan-800 p-4 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="p-2 sm:p-3 bg-white/20 rounded-xl backdrop-blur-sm flex-shrink-0">
              <Box className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">My LoRA Models</h1>
              <p className="text-blue-100 text-xs sm:text-sm hidden sm:block">
                Manage your personal LoRA models for AI-generated content
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={() => {
                setShowUploadModal(true);
                checkComfyUIStatus();
              }}
              className="flex items-center justify-center space-x-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white text-blue-600 hover:bg-gray-50 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 w-full sm:w-auto text-sm sm:text-base"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Add LoRA Model</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Filter Buttons */}
      {loraModels.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 pb-2">
          <button
            onClick={() => setActiveView('my-loras')}
            className={`flex items-center justify-center sm:justify-start gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold transition-all duration-200 text-sm sm:text-base ${
              activeView === 'my-loras'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg sm:scale-105'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Box className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>My LoRAs</span>
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
              activeView === 'my-loras'
                ? 'bg-white/20'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            }`}>
              {ownedModels.length}
            </span>
          </button>

          <button
            onClick={() => setActiveView('shared')}
            className={`flex items-center justify-center sm:justify-start gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold transition-all duration-200 text-sm sm:text-base ${
              activeView === 'shared'
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg sm:scale-105'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Shared With Me</span>
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
              activeView === 'shared'
                ? 'bg-white/20'
                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
            }`}>
              {sharedModels.length}
            </span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {loraModels.length === 0 ? (
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl shadow-sm border-2 border-dashed border-blue-200 dark:border-blue-800 p-12 text-center">
          <div className="flex flex-col items-center space-y-6">
            <div className="relative">
              <div className="p-6 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-800/50 dark:to-cyan-800/50 rounded-2xl">
                <Box className="w-12 h-12 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center">
                <Plus className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="space-y-4 max-w-md">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Your LoRA Model Collection Awaits
              </h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Upload your first LoRA model directly to the network volume storage. Each model becomes instantly available for text-to-image generation with consistent, personalized results.
              </p>

              <button
                onClick={() => {
                  setShowUploadModal(true);
                  checkComfyUIStatus();
                }}
                className="inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold rounded-xl transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <Upload className="w-5 h-5" />
                <span>Upload Your First LoRA Model</span>
                <Sparkles className="w-5 h-5" />
              </button>

              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                ✨ Supports .safetensors, .pt, .ckpt • Up to 2GB • Direct network volume storage
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* My Own LoRAs */}
          {activeView === 'my-loras' && ownedModels.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                {ownedModels.map((model) => {
                  const isThumbnailUploading = thumbnailUploadingId === model.id;
                  const statusClass =
                    model.syncStatus === "synced"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : model.syncStatus === "pending"
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                      : model.syncStatus === "missing" || model.syncStatus === "error"
                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                      : "bg-gray-200 text-gray-700 dark:bg-gray-700/40 dark:text-gray-200";
                  const activeButtonClass = model.isActive
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700/50 dark:hover:bg-gray-600 dark:text-gray-200";
                  const uploadInputId = `thumbnail-upload-${model.id}`;

                  return (
                    <div
                      key={model.id}
                      className="bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800/50 dark:to-blue-900/20 shadow-md rounded-xl border border-blue-200/30 dark:border-blue-700/20 p-3 sm:p-4 backdrop-blur-sm hover:shadow-lg transition-all duration-300"
                    >
                      <div className="space-y-2 sm:space-y-2.5">
                        <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-blue-100/40 dark:from-gray-700/40 dark:to-blue-900/30 flex items-center justify-center">
                          {model.thumbnailUrl ? (
                            <img
                              src={model.thumbnailUrl}
                              alt={model.displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Box className="w-12 h-12 text-blue-400" />
                          )}

                          {isThumbnailUploading && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Loader2 className="w-5 h-5 text-white animate-spin" />
                            </div>
                          )}

                          {model.usageCount > 0 && (
                            <div className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-sm">
                              {model.usageCount} uses
                            </div>
                          )}
                        </div>

                        <div className="text-center space-y-1.5">
                          <div className="space-y-0.5">
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white line-clamp-1">
                              {model.displayName}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {model.fileName}
                            </p>
                          </div>

                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2 min-h-[24px] sm:min-h-[28px]">
                            {model.description || "No description provided"}
                          </p>

                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusClass}`}>
                              {getSyncStatusText(model.syncStatus)}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleModelStatus(model.id, !model.isActive)}
                              className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${activeButtonClass}`}
                            >
                              {model.isActive ? "Active" : "Inactive"}
                            </button>
                          </div>

                          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <span>{formatFileSize(model.fileSize)}</span>
                            <span>•</span>
                            <span>{new Date(model.uploadedAt).toLocaleDateString()}</span>
                          </div>

                          {/* Action Buttons */}
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                              <button
                                type="button"
                                onClick={() => showModelDetails(model)}
                                className="flex-1 inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors active:scale-95"
                              >
                                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span className="hidden xs:inline">View</span>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => {
                                  setThumbnailOptionsModel(model);
                                  setThumbnailOptionsModalOpen(true);
                                }}
                                disabled={isThumbnailUploading}
                                className={`flex-1 inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-sm transition-all active:scale-95 ${
                                  isThumbnailUploading ? "opacity-70 cursor-not-allowed" : ""
                                }`}
                              >
                                {isThumbnailUploading ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                                    <span className="hidden xs:inline">Uploading...</span>
                                  </>
                                ) : (
                                  <>
                                    <ImagePlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    <span className="hidden xs:inline">Image</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <div className="flex items-center justify-between px-1 sm:px-2">
                              <button
                                type="button"
                                onClick={() => {
                                  alert("Download functionality coming soon!");
                                }}
                                className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors p-1.5 rounded active:scale-95"
                              >
                                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span className="hidden xs:inline">Download</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeleteCandidate(model)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors p-1.5 rounded active:scale-95"
                              >
                                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span className="hidden xs:inline">Delete</span>
                              </button>
                            </div>

                            {!model.isShared && (
                              <button
                                type="button"
                                onClick={() => handleShareLoRA(model)}
                                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/40 transition-colors"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                <span>{model.hasShares ? 'Shared' : 'Share'}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <input
                          id={uploadInputId}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => handleThumbnailSelect(model.id, event)}
                          disabled={isThumbnailUploading}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Shared With Me LoRAs */}
          {activeView === 'shared' && (
            <div className="space-y-4">
              {sharedModels.length > 0 ? (
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                  {sharedModels.map((model) => {
                    const statusClass =
                      model.syncStatus === "synced"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : model.syncStatus === "pending"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                        : model.syncStatus === "missing" || model.syncStatus === "error"
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                        : "bg-gray-200 text-gray-700 dark:bg-gray-700/40 dark:text-gray-200";

                    return (
                      <div
                        key={model.id}
                        className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 shadow-lg rounded-xl border-2 border-purple-300 dark:border-purple-700 p-3 sm:p-4 backdrop-blur-sm hover:shadow-xl transition-all duration-300 relative"
                      >
                        <div className="absolute top-2 right-2 z-10">
                          <div className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs font-semibold rounded-full shadow-sm">
                            <Users className="w-3 h-3" />
                            <span>Shared</span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-purple-100/40 dark:from-gray-700/40 dark:to-purple-900/30 flex items-center justify-center">
                            {model.thumbnailUrl ? (
                              <img
                                src={model.thumbnailUrl}
                                alt={model.displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Box className="w-14 h-14 text-purple-400" />
                            )}

                            {model.usageCount > 0 && (
                              <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full shadow-sm">
                                {model.usageCount} uses
                              </div>
                            )}
                          </div>

                          <div className="text-center space-y-2">
                            <div className="space-y-1">
                              <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white line-clamp-1">
                                {model.displayName}
                              </h3>
                              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                Shared by {model.sharedBy}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {model.fileName}
                              </p>
                            </div>

                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2 min-h-[32px]">
                              {model.description || "No description provided"}
                            </p>

                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusClass}`}>
                                {getSyncStatusText(model.syncStatus)}
                              </span>
                            </div>

                            <div className="flex items-center justify-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                              <span>{formatFileSize(model.fileSize)}</span>
                              <span>•</span>
                              <span>{new Date(model.uploadedAt).toLocaleDateString()}</span>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => showModelDetails(model)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View Details</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl shadow-sm border-2 border-dashed border-purple-200 dark:border-purple-800 p-12 text-center">
                  <div className="flex flex-col items-center space-y-6">
                    <div className="relative">
                      <div className="p-6 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-800/50 dark:to-blue-800/50 rounded-2xl">
                        <Share2 className="w-12 h-12 text-purple-600 dark:text-purple-400" />
                      </div>
                    </div>

                    <div className="space-y-4 max-w-md">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                        No Shared LoRAs Yet
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                        When other users share their LoRA models with you, they will appear here. You'll be able to use them in your text-to-image generations.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Model Details Modal */}
      {showDetailsModal && selectedModel && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  LoRA Model Details
                </h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {selectedModel.thumbnailUrl && (
                  <div className="w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                    <img
                      src={selectedModel.thumbnailUrl}
                      alt={selectedModel.displayName}
                      className="w-full h-64 object-cover"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Display Name
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedModel.displayName}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      File Name
                    </label>
                    <p className="text-gray-900 dark:text-white font-mono text-sm">
                      {selectedModel.fileName}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      File Size
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {formatFileSize(selectedModel.fileSize)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Usage Count
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedModel.usageCount} times
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Status
                    </label>
                    <div className="flex items-center space-x-2">
                      {getSyncStatusIcon(selectedModel.syncStatus)}
                      <span className="text-gray-900 dark:text-white">
                        {getSyncStatusText(selectedModel.syncStatus)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Active
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedModel.isActive ? "Yes" : "No"}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Uploaded
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(selectedModel.uploadedAt).toLocaleString()}
                  </p>
                </div>

                {selectedModel.lastUsedAt && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Last Used
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {new Date(selectedModel.lastUsedAt).toLocaleString()}
                    </p>
                  </div>
                )}

                {selectedModel.comfyUIPath && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      ComfyUI Path
                    </label>
                    <div className="flex items-center space-x-2">
                      <p className="text-gray-900 dark:text-white font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded flex-1">
                        {selectedModel.comfyUIPath}
                      </p>
                      <button
                        onClick={() => copyToClipboard(selectedModel.comfyUIPath!)}
                        className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Description
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {selectedModel.description || "No description provided"}
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteCandidate && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md border-t sm:border border-gray-200 dark:border-gray-700">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Delete LoRA Model
                </h3>
                <button
                  onClick={() => {
                    if (!isDeleting) {
                      setDeleteCandidate(null);
                    }
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  disabled={isDeleting}
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <p>
                  Are you sure you want to delete <strong>{deleteCandidate.displayName}</strong>?
                </p>
                <p className="text-xs text-red-500 dark:text-red-400">
                  This permanently removes the model, associated files, and cannot be undone.
                </p>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg text-xs text-gray-500 dark:text-gray-400">
                <span>File name</span>
                <span className="font-mono truncate max-w-[180px]">
                  {deleteCandidate.fileName}
                </span>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => {
                    if (!isDeleting) {
                      setDeleteCandidate(null);
                    }
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-60"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteModel(deleteCandidate)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Upload Modal */}
      {showUploadModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Upload New LoRA Model
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
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
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
                      Supports .safetensors, .pt, .ckpt files (max 2GB each)
                    </p>
                  </label>
                </div>
              </div>

              {/* ComfyUI Status */}
              {comfyUIStatus && (
                <div
                  className={`mb-4 p-3 rounded-lg border ${
                    comfyUIStatus.status === "connected"
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                      : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {comfyUIStatus.status === "connected" ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                      )}
                      <span
                        className={`text-sm font-medium ${
                          comfyUIStatus.status === "connected"
                            ? "text-green-800 dark:text-green-200"
                            : "text-yellow-800 dark:text-yellow-200"
                        }`}
                      >
                        ComfyUI Status:{" "}
                        {comfyUIStatus.status === "connected"
                          ? "Ready for direct upload"
                          : "Will use fallback storage"}
                      </span>
                    </div>
                    <button
                      onClick={checkComfyUIStatus}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Info */}
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>🚀 Network Volume Upload:</strong> Your LoRA files
                  will be uploaded directly to the RunPod network volume storage
                  where they'll be immediately available for text-to-image
                  generation.
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
                            {progress.status === "processing" && (
                              <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
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
                          <p className="text-xs text-red-500">{progress.error}</p>
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
                  onClick={uploadLoRAModels}
                  disabled={uploading || selectedFiles.length === 0}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  {uploading ? "Uploading..." : "Upload LoRA Models"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Share LoRA Modal */}
      {loraToShare && (
        <ShareLoRAModal
          isOpen={shareLoRAModalOpen}
          onClose={() => {
            setShareLoRAModalOpen(false);
            setLoraToShare(null);
          }}
          loraId={loraToShare.id}
          loraName={loraToShare.displayName}
          onShareComplete={() => {
            fetchLoRAModels();
          }}
        />
      )}

      {/* Select Thumbnail Modal */}
      {loraForThumbnail && (
        <SelectThumbnailModal
          isOpen={selectThumbnailModalOpen}
          onClose={() => {
            setSelectThumbnailModalOpen(false);
            setLoraForThumbnail(null);
          }}
          influencerId={loraForThumbnail.id}
          influencerName={loraForThumbnail.displayName}
          onThumbnailSelected={async (imageUrl) => {
            await setThumbnailFromGeneratedImage(loraForThumbnail.id, imageUrl);
            await fetchLoRAModels();
          }}
        />
      )}

      {/* Thumbnail Options Modal */}
      {thumbnailOptionsModel && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => {
            setThumbnailOptionsModalOpen(false);
            setThumbnailOptionsModel(null);
          }}
        >
          <div 
            className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md border-t sm:border border-gray-200 dark:border-gray-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <ImagePlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Set Thumbnail</h3>
                    <p className="text-sm text-blue-100">{thumbnailOptionsModel.displayName}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setThumbnailOptionsModalOpen(false);
                    setThumbnailOptionsModel(null);
                  }}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-3">
              <label
                htmlFor={`thumbnail-upload-${thumbnailOptionsModel.id}`}
                className="flex items-center gap-4 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-all group"
              >
                <div className="flex-shrink-0 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                  <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Upload Image</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Choose a file from your computer</p>
                </div>
              </label>

              <button
                type="button"
                onClick={() => {
                  setLoraForThumbnail(thumbnailOptionsModel);
                  setSelectThumbnailModalOpen(true);
                  setThumbnailOptionsModalOpen(false);
                  setThumbnailOptionsModel(null);
                }}
                className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-cyan-500 dark:hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-all group"
              >
                <div className="flex-shrink-0 p-3 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg group-hover:bg-cyan-200 dark:group-hover:bg-cyan-800/40 transition-colors">
                  <ImageIcon className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="flex-1 text-left">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Select from Generations</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Choose from images you've generated</p>
                </div>
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 flex justify-end">
              <button
                onClick={() => {
                  setThumbnailOptionsModalOpen(false);
                  setThumbnailOptionsModel(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
