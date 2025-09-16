// app/(dashboard)/workspace/my-influencers/page.tsx - Complete component with direct ComfyUI upload
"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";

// Types
interface InfluencerLoRA {
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
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: "uploading" | "processing" | "completed" | "failed";
  error?: string;
  uploadMethod?:
    | "direct"
    | "streaming"
    | "client-blob"
    | "server-fallback"
    | "chunked"
    | "blob-first"
    | "client-direct"
    | "direct-comfyui-fallback"
    | "direct-comfyui"
    | "serverless-function"
    | "direct-s3";
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
  const [comfyUIStatus, setComfyUIStatus] = useState<{
    status: string;
    url: string;
    lastChecked?: Date;
  } | null>(null);
  const [showInstructions, setShowInstructions] =
    useState<UploadInstructions | null>(null);
  const [selectedInfluencer, setSelectedInfluencer] =
    useState<InfluencerLoRA | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // ✅ Get the authenticated API client and user
  const apiClient = useApiClient();
  const { userId } = useAuth();

  // Fetch user's influencers on load
  useEffect(() => {
    if (apiClient) {
      fetchInfluencers();
    }
  }, [apiClient]); // ✅ Depend on apiClient

  const fetchInfluencers = async () => {
    if (!apiClient) {
      console.log("⚠️ API client not ready");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log("Fetching influencers...");

      const response = await apiClient.get("/api/user/influencers");
      console.log("Fetch response status:", response.status);

      if (!response.ok) {
        throw new Error(`Failed to fetch influencers: ${response.status}`);
      }

      const data = await response.json();
      console.log("Fetched influencers data:", data);

      // Backend returns array directly, not wrapped in { influencers: [...] }
      setInfluencers(Array.isArray(data) ? data : []);

      if (Array.isArray(data) && data.length > 0) {
        console.log(`Successfully loaded ${data.length} influencers`);
      } else {
        console.log("No influencers found for this user");
      }
    } catch (error) {
      console.error("Error fetching influencers:", error);
      setError(
        `Failed to load your influencers: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  // Sync with ComfyUI (original function)
  const syncWithComfyUI = async () => {
    if (!apiClient) return;

    try {
      setSyncing(true);
      console.log("=== SYNC WITH COMFYUI ===");
      console.log("Calling sync endpoint...");

      const response = await apiClient.post("/api/models/loras", {
        action: "sync_user_loras",
      });

      console.log("Sync response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Sync response error:", errorText);
        throw new Error(
          `Sync request failed: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      console.log("Sync response data:", data);

      if (data.success) {
        await fetchInfluencers();

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
        if (error.message.includes("Missing workflow data")) {
          alert(
            "Sync endpoint error: Wrong API called. Please check the routing configuration."
          );
        } else if (error.message.includes("Unexpected end of JSON input")) {
          alert(
            "Sync failed: Empty response from server. ComfyUI may not be accessible."
          );
        } else {
          alert(`Sync failed: ${error.message}`);
        }
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
      console.log("Syncing files from Vercel Blob to ComfyUI...");

      const response = await apiClient.post(
        "/api/user/influencers/sync-blob-files",
        {}
      );

      console.log("Sync uploaded files response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Sync uploaded files response error:", errorText);
        throw new Error(
          `Sync request failed: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      console.log("Sync uploaded files response data:", data);

      if (data.success) {
        await fetchInfluencers();

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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter((file) => {
      const isValidType =
        file.name.toLowerCase().endsWith(".safetensors") ||
        file.name.toLowerCase().endsWith(".pt") ||
        file.name.toLowerCase().endsWith(".ckpt");
      const isValidSize = file.size <= 2 * 1024 * 1024 * 1024; // 2GB reasonable limit

      if (!isValidType) {
        alert(
          `${file.name} is not a valid LoRA file. Please upload .safetensors, .pt, or .ckpt files.`
        );
        return false;
      }

      if (!isValidSize) {
        const fileSizeMB = Math.round(file.size / 1024 / 1024);
        alert(
          `${file.name} is too large (${fileSizeMB}MB). Maximum file size is 2GB. Please use a smaller file.`
        );
        return false;
      }

      return true;
    });

    setSelectedFiles(validFiles);
  };

  // Check ComfyUI status
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

  // ✅ Helper function to get ComfyUI URL from server
  const getComfyUIUrl = async (): Promise<string> => {
    try {
      const response = await apiClient!.get("/api/env-check");
      if (response.ok) {
        const data = await response.json();
        // The server should provide the ComfyUI URL
        return (
          data.comfyuiUrl ||
          process.env.NEXT_PUBLIC_COMFYUI_URL ||
          "http://localhost:8188"
        );
      }
    } catch (error) {
      console.warn("Could not fetch ComfyUI URL from server, using defaults");
    }

    // Fallback to environment variables
    return (
      process.env.NEXT_PUBLIC_COMFYUI_URL ||
      process.env.NEXT_PUBLIC_RUNPOD_URL ||
      "http://localhost:8188"
    );
  };

  // ✅ NEW FUNCTION: Direct client-side upload to S3 (for large files)
  const uploadDirectToS3 = async (
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

    // Define chunk size (4MB to stay under Vercel's 6MB limit with FormData overhead)
    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks for faster processing
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    console.log(
      `📦 Using S3 multipart upload: ${totalChunks} parts of ~${Math.round(
        CHUNK_SIZE / 1024 / 1024
      )}MB each`
    );

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

      // Step 2: Upload each part via server with retry logic
      for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        console.log(
          `📤 Uploading part ${partNumber}/${totalChunks} via server (${Math.round(
            chunk.size / 1024
          )}KB)`
        );

        // Retry logic for individual parts
        let partSuccess = false;
        let lastError = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const partFormData = new FormData();
            partFormData.append("action", "upload");
            partFormData.append("chunk", chunk);
            partFormData.append("partNumber", partNumber.toString());
            partFormData.append("sessionId", sessionId);
            // Include session reconstruction data
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
            break; // Success, exit retry loop
          } catch (error) {
            lastError = error;
            if (attempt < 3) {
              console.log(
                `⚠️ Part ${partNumber} failed (attempt ${attempt}/3), retrying...`
              );
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * attempt)
              ); // Exponential backoff
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

        // Update progress
        if (onProgress) {
          const progress = Math.round((partNumber / totalChunks) * 100);
          onProgress(progress);
        }
      }

      // Step 3: Complete multipart upload
      console.log(`🏁 Completing multipart upload...`);

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

      console.log(
        `✅ Multipart S3 upload completed: ${completeResult.uniqueFileName}`
      );

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

  // ✅ FUNCTION: Upload via serverless function (for small files)
  const uploadToNetworkVolume = async (
    file: File,
    displayName: string
  ): Promise<{
    success: boolean;
    uniqueFileName: string;
    comfyUIPath: string;
    networkVolumePath?: string;
  }> => {
    const timestamp = Date.now();
    const uniqueFileName = `${userId}_${timestamp}_${file.name}`;

    console.log(
      `🎯 Uploading ${file.name} to RunPod network volume as ${uniqueFileName}`
    );

    // Create FormData for the upload
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("displayName", displayName);

    // Upload to ComfyUI via our API
    const response = await apiClient!.post(
      "/api/user/influencers/upload-to-runpod",
      uploadFormData
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Upload failed: ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ Direct S3 network volume upload completed:`, result);

    return {
      success: true,
      uniqueFileName: result.fileName,
      comfyUIPath: result.comfyUIPath,
      networkVolumePath: result.networkVolumePath,
    };
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
      console.log(`💾 Creating database record for ${uniqueFileName}`);

      const response = await apiClient.post(
        "/api/user/influencers/create-record",
        {
          name: displayName,
          displayName: displayName,
          fileName: uniqueFileName,
          originalFileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          syncStatus: syncStatus.toUpperCase(), // Convert to enum format
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
        console.warn(
          "⚠️ Failed to create database record, but file was uploaded successfully"
        );
        throw new Error("Database record creation failed");
      }

      const result = await response.json();
      console.log("✅ Database record created successfully:", result);
      return result;
    } catch (error) {
      console.error("❌ Database record creation failed:", error);
      throw error;
    }
  };

  // ✅ UPDATED: Upload influencers with direct ComfyUI upload and fallback
  const uploadInfluencers = async () => {
    if (selectedFiles.length === 0 || !apiClient || !userId) return;

    setUploading(true);
    setUploadProgress([]);

    for (const file of selectedFiles) {
      try {
        const progressItem: UploadProgress = {
          fileName: file.name,
          progress: 0,
          status: "uploading",
          uploadMethod: "direct-comfyui",
        };

        setUploadProgress((prev) => [...prev, progressItem]);

        console.log(
          `🎯 Uploading ${file.name} (${Math.round(file.size / 1024 / 1024)}MB)`
        );

        const displayName = file.name.replace(/\.[^/.]+$/, "");

        // Update progress to show upload starting
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
          // Check file size to determine upload method
          const serverlessMaxSize = 6 * 1024 * 1024; // 6MB limit for serverless functions
          const useDirectS3Upload = file.size > serverlessMaxSize;

          if (useDirectS3Upload) {
            // ✅ DIRECT S3 UPLOAD (for large files > 6MB)
            console.log(
              `🚀 File ${file.name} is ${Math.round(
                file.size / 1024 / 1024
              )}MB, using direct S3 upload...`
            );

            const s3UploadResult = await uploadDirectToS3(
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
                          uploadMethod: "direct-s3",
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

            console.log(`✅ Direct S3 upload successful for ${file.name}`);
          } else {
            // ✅ SERVERLESS FUNCTION UPLOAD (for small files <= 6MB)
            console.log(
              `🚀 File ${file.name} is ${Math.round(
                file.size / 1024 / 1024
              )}MB, using serverless function upload...`
            );
            const networkUploadResult = await uploadToNetworkVolume(
              file,
              displayName
            );

            // Update progress to show completion
            setUploadProgress((prev) =>
              prev.map((item) =>
                item.fileName === file.name
                  ? {
                      ...item,
                      progress: 90,
                      status: "processing",
                      uploadMethod: "serverless-function",
                    }
                  : item
              )
            );

            // Serverless upload completed successfully
            uploadResult = {
              success: true,
              uniqueFileName: networkUploadResult.uniqueFileName,
              comfyResult: {
                networkVolumePath: networkUploadResult.comfyUIPath,
              },
            };
            syncStatus = "synced";
            comfyUIPath = networkUploadResult.comfyUIPath;

            console.log(
              `✅ Serverless function upload successful for ${file.name}`
            );
          }
        } catch (error) {
          console.error(`❌ Upload failed for ${file.name}:`, error);

          const errorMsg =
            error instanceof Error ? error.message : "Unknown upload error";

          throw new Error(`Upload failed: ${errorMsg}`);
        }

        // Create database record via Vercel API (small data, no file)
        console.log("💾 Creating database record...");
        await createDatabaseRecord(
          uploadResult.uniqueFileName,
          file,
          displayName,
          syncStatus,
          comfyUIPath
        );

        // Update progress to completed
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

        // Show success message
        console.log(`✅ Complete upload pipeline finished for ${file.name}`);
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

        // Show user-friendly error message
        if (error instanceof Error) {
          alert(
            `Upload failed for ${file.name}: ${error.message}\n\nPlease try again or contact support if the issue persists.`
          );
        }
      }
    }

    // Show final success message for all uploads
    const completedUploads = uploadProgress.filter(
      (p) => p.status === "completed"
    ).length;
    const failedUploads = uploadProgress.filter(
      (p) => p.status === "failed"
    ).length;

    if (completedUploads > 0) {
      const directS3Uploads = uploadProgress.filter(
        (p) => p.status === "completed" && p.uploadMethod === "direct-s3"
      ).length;
      const serverlessUploads = uploadProgress.filter(
        (p) =>
          p.status === "completed" && p.uploadMethod === "serverless-function"
      ).length;
      const networkUploads = uploadProgress.filter(
        (p) => p.status === "completed" && p.uploadMethod === "direct-comfyui"
      ).length;
      const fallbackUploads = uploadProgress.filter(
        (p) => p.status === "completed" && p.uploadMethod === "server-fallback"
      ).length;

      let message = `🎉 Upload Results:\n\n✅ ${completedUploads} file(s) uploaded successfully\n`;

      if (directS3Uploads > 0) {
        message += `🚀 ${directS3Uploads} large file(s) uploaded directly to S3 network volume (ready for text-to-image generation!)\n`;
      }
      if (serverlessUploads > 0) {
        message += `⚡ ${serverlessUploads} file(s) uploaded via serverless function (ready for text-to-image generation!)\n`;
      }
      if (networkUploads > 0) {
        message += `🎯 ${networkUploads} uploaded to network volume (ready for text-to-image generation!)\n`;
      }
      if (fallbackUploads > 0) {
        message += `💾 ${fallbackUploads} uploaded to storage (will sync to ComfyUI next)\n`;
      }
      if (failedUploads > 0) {
        message += `❌ ${failedUploads} file(s) failed\n`;
      }

      if (fallbackUploads > 0) {
        message += `\n🔧 Some files need to be synced to ComfyUI. Click "Sync Uploaded Files" to complete the process.`;
      }

      alert(message);
    }

    // Refresh the influencers list
    await fetchInfluencers();

    setUploading(false);
    setShowUploadModal(false);
    setSelectedFiles([]);
    setUploadProgress([]);
  };

  // Delete influencer
  const deleteInfluencer = async (id: string) => {
    if (!apiClient) return;

    // Find the influencer to get its name for the confirmation
    const influencer = influencers.find(inf => inf.id === id);
    const influencerName = influencer?.displayName || "this influencer";

    if (
      !confirm(
        `Are you sure you want to delete "${influencerName}"?\n\nThis will permanently remove:\n• The database record\n• The file from network storage\n• All associated data\n\nThis action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      console.log(`🗑️ Deleting influencer: ${influencerName}`);
      
      const response = await apiClient.delete(`/api/user/influencers/${id}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to delete influencer");
      }

      const result = await response.json();
      
      // Remove from local state
      setInfluencers((prev) => prev.filter((inf) => inf.id !== id));
      
      // Show success message
      alert(`✅ Successfully deleted "${influencerName}" from both database and storage!`);
      
      console.log(`✅ Influencer deleted successfully: ${influencerName}`);
    } catch (error) {
      console.error("Delete error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete influencer";
      alert(`❌ Failed to delete "${influencerName}": ${errorMessage}`);
    }
  };

  // Toggle influencer status
  const toggleInfluencerStatus = async (id: string, isActive: boolean) => {
    if (!apiClient) return;

    try {
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

  const showInfluencerDetails = (influencer: InfluencerLoRA) => {
    setSelectedInfluencer(influencer);
    setShowDetailsModal(true);
  };

  // Enhanced loading state if API client isn't ready
  if (!apiClient) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-purple-200 dark:border-purple-800 border-t-purple-600 dark:border-t-purple-400 rounded-full animate-spin mx-auto"></div>
            <Users className="absolute inset-0 w-8 h-8 text-pink-500 animate-pulse m-auto" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              Setting Up Your Influencer Studio
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md">
              Preparing your personal LoRA model management system...
            </p>
          </div>
          <div className="flex items-center justify-center space-x-2 text-sm text-pink-600 dark:text-pink-400">
            <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce"></div>
            <div
              className="w-2 h-2 bg-pink-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="w-2 h-2 bg-pink-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
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
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl shadow-lg border border-purple-200 dark:border-pink-800 p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">My Influencers</h1>
              <p className="text-purple-100">
                Manage your personal LoRA models for AI-generated content
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={syncWithComfyUI}
              disabled={syncing}
              className="flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 disabled:bg-white/10 text-white font-medium rounded-xl shadow-sm transition-all backdrop-blur-sm"
              title="Sync existing ComfyUI models with database"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>Sync Models</span>
            </button>

            <button
              onClick={() => {
                setShowUploadModal(true);
                checkComfyUIStatus();
              }}
              className="flex items-center space-x-2 px-6 py-3 bg-white text-purple-600 hover:bg-gray-50 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              <span>Add Influencer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Card */}
      {influencers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              <span>Models Status Overview</span>
            </h3>
            <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
              Updated {new Date().toLocaleTimeString()}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {influencers.length}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300 font-medium mt-1">
                Your Models
              </div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {syncedCount}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium mt-1">
                Ready to Use
              </div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
              <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                {pendingCount}
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300 font-medium mt-1">
                Need Setup
              </div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl border border-red-200 dark:border-red-800">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                {missingCount}
              </div>
              <div className="text-sm text-red-700 dark:text-red-300 font-medium mt-1">
                Missing
              </div>
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

      {/* Info Card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              About Your Personal Influencer LoRA Models
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
              Upload your custom LoRA models directly to the network volume
              storage where they'll be immediately available for text-to-image
              generation. Smart fallback to secure storage if needed.
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
              <strong>🚀 Network Volume Upload:</strong> Direct upload to
              `/runpod-volume/loras/{userId}/` (ready immediately for
              generation)
            </p>
            <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
              <p>
                <strong>Status indicators:</strong> Green = Ready in network
                volume, Yellow = Needs setup, Red = Missing from storage
              </p>
              <p>
                <strong>Upload Process:</strong> 1) Upload to network volume via
                RunPod, 2) Fallback to secure storage if needed, 3) Use "Sync
                Uploaded Files" if fallback was used
              </p>
              <p>
                <strong>Generation Ready:</strong> Files uploaded to network
                volume are immediately available in the text-to-image generation
                tab
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Empty State */}
      {influencers.length === 0 ? (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl shadow-sm border-2 border-dashed border-purple-200 dark:border-purple-800 p-12 text-center">
          <div className="flex flex-col items-center space-y-6">
            <div className="relative">
              <div className="p-6 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-800/50 dark:to-pink-800/50 rounded-2xl">
                <Users className="w-12 h-12 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center">
                <Plus className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="space-y-4 max-w-md">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Your Influencer Collection Awaits
              </h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Upload your first LoRA model directly to the network volume
                storage. Each model becomes instantly available for
                text-to-image generation with consistent, personalized results.
              </p>

              <div className="grid grid-cols-3 gap-4 py-4">
                <div className="text-center">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Upload className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Smart Upload
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Auto Sync
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                    <ImageIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Generate
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowUploadModal(true);
                  checkComfyUIStatus();
                }}
                className="inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <Upload className="w-5 h-5" />
                <span>Upload Your First Influencer</span>
                <Sparkles className="w-5 h-5" />
              </button>

              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                ✨ Supports .safetensors, .pt, .ckpt • Up to 500MB • Direct
                network volume storage
              </p>
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
              <div className="h-48 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 flex items-center justify-center relative">
                {influencer.thumbnailUrl ? (
                  <img
                    src={influencer.thumbnailUrl}
                    alt={influencer.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-16 h-16 text-purple-400" />
                )}

                {/* Usage badge */}
                {influencer.usageCount > 0 && (
                  <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                    {influencer.usageCount} uses
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {influencer.displayName}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {influencer.fileName}
                    </p>
                  </div>
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

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                  {influencer.description || "No description provided"}
                </p>

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                  <span>{formatFileSize(influencer.fileSize)}</span>
                  <span>
                    {new Date(influencer.uploadedAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => showInfluencerDetails(influencer)}
                      className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        alert("Download functionality coming soon!");
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

      {/* Influencer Details Modal */}
      {showDetailsModal && selectedInfluencer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Influencer Details
                </h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Display Name
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedInfluencer.displayName}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      File Name
                    </label>
                    <p className="text-gray-900 dark:text-white font-mono text-sm">
                      {selectedInfluencer.fileName}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      File Size
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {formatFileSize(selectedInfluencer.fileSize)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Usage Count
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedInfluencer.usageCount} times
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Status
                    </label>
                    <div className="flex items-center space-x-2">
                      {getSyncStatusIcon(selectedInfluencer.syncStatus)}
                      <span className="text-gray-900 dark:text-white">
                        {getSyncStatusText(selectedInfluencer.syncStatus)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Active
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedInfluencer.isActive ? "Yes" : "No"}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Uploaded
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(selectedInfluencer.uploadedAt).toLocaleString()}
                  </p>
                </div>

                {selectedInfluencer.lastUsedAt && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Last Used
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {new Date(selectedInfluencer.lastUsedAt).toLocaleString()}
                    </p>
                  </div>
                )}

                {selectedInfluencer.comfyUIPath && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      ComfyUI Path
                    </label>
                    <div className="flex items-center space-x-2">
                      <p className="text-gray-900 dark:text-white font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded flex-1">
                        {selectedInfluencer.comfyUIPath}
                      </p>
                      <button
                        onClick={() =>
                          copyToClipboard(selectedInfluencer.comfyUIPath!)
                        }
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
                    {selectedInfluencer.description ||
                      "No description provided"}
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
        </div>
      )}

      {/* Manual Instructions Modal */}
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

      {/* Upload Modal */}
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
                      Supports .safetensors, .pt, .ckpt files (max 6MB each)
                    </p>
                  </label>
                </div>
              </div>

              {/* ComfyUI Status Indicator */}
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
                  {comfyUIStatus.status !== "connected" && (
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                      Files will be uploaded to secure storage and can be synced
                      to ComfyUI later.
                    </p>
                  )}
                </div>
              )}

              {/* New upload process info */}
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-300">
                  <strong>🚀 Network Volume Upload:</strong> Your LoRA files
                  will be uploaded directly to the RunPod network volume storage
                  where they'll be immediately available for text-to-image
                  generation. Fallback to secure storage if needed.
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
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>
                            {progress.uploadMethod === "direct-s3" &&
                              "🚀 Direct S3 Upload (Large File)"}
                            {progress.uploadMethod === "serverless-function" &&
                              "⚡ Serverless Function Upload"}
                            {progress.uploadMethod === "direct-comfyui" &&
                              "🎯 Direct ComfyUI Upload"}
                            {progress.uploadMethod === "server-fallback" &&
                              "💾 Secure Storage Upload"}
                            {!progress.uploadMethod && "🚀 Smart Upload"}
                          </span>
                          {progress.status === "uploading" &&
                            progress.uploadMethod === "direct-s3" && (
                              <span>
                                Uploading large file directly to S3...
                              </span>
                            )}
                          {progress.status === "uploading" &&
                            progress.uploadMethod === "serverless-function" && (
                              <span>Uploading via serverless function...</span>
                            )}
                          {progress.status === "uploading" &&
                            progress.uploadMethod === "direct-comfyui" && (
                              <span>Uploading directly to ComfyUI...</span>
                            )}
                          {progress.status === "uploading" &&
                            progress.uploadMethod === "server-fallback" && (
                              <span>Uploading to secure storage...</span>
                            )}
                          {progress.status === "processing" && (
                            <span>Creating database record...</span>
                          )}
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
                  {uploading ? "Uploading to ComfyUI..." : "Upload Influencers"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
