"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Trash2,
  GripVertical,
  Upload,
  FolderPlus,
  Edit3,
  Check,
  X,
  Image as ImageIcon,
  Video,
  Loader2,
  Sparkles,
  Heart,
  Flame,
  ChevronDown,
  ChevronUp,
  Calendar,
  Eye,
  EyeOff,
  MoreHorizontal,
  Download,
  Copy,
  Share2,
  FolderOutput,
  Folder,
  CheckCircle2,
  User,
  FileText,
  Mic,
  Volume2,
  Music,
} from "lucide-react";
import KeycardGenerator from "./KeycardGenerator";
import EmbeddedVoiceGenerator from "./EmbeddedVoiceGenerator";

interface InstagramProfile {
  id: string;
  name: string;
  instagramUsername?: string | null;
  isDefault?: boolean;
}

interface SextingImage {
  id: string;
  setId: string;
  url: string;
  name: string;
  type: string;
  sequence: number;
  size: number;
  uploadedAt: string;
}

interface SextingSet {
  id: string;
  userId: string;
  name: string;
  category: string;
  s3FolderPath: string;
  status: string;
  scheduledDate: string | null;
  createdAt: string;
  updatedAt: string;
  images: SextingImage[];
}

interface SextingSetOrganizerProps {
  profileId: string | null;
}

export default function SextingSetOrganizer({
  profileId,
}: SextingSetOrganizerProps) {
  const [sets, setSets] = useState<SextingSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<SextingSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newSetName, setNewSetName] = useState("");
  const [tempName, setTempName] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [savingOrder, setSavingOrder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  
  // Upload progress state for direct S3 uploads
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  
  // Debounce timer ref for reorder saves
  const reorderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingReorderRef = useRef<{ setId: string; imageIds: string[] } | null>(null);

  // Export to Vault state
  const [showExportModal, setShowExportModal] = useState(false);
  const [profiles, setProfiles] = useState<InstagramProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [selectedExportProfileId, setSelectedExportProfileId] = useState<
    string | null
  >(null);
  const [exportFolderName, setExportFolderName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<{
    folderName: string;
    itemCount: number;
  } | null>(null);

  // Image rename state
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editingImageName, setEditingImageName] = useState("");
  const [savingImageName, setSavingImageName] = useState(false);

  // Image detail modal state
  const [showImageDetailModal, setShowImageDetailModal] = useState(false);
  const [selectedImageForDetail, setSelectedImageForDetail] = useState<SextingImage | null>(null);

  // Tab state: "organizer" | "keycard" | "voice"
  const [activeTab, setActiveTab] = useState<"organizer" | "keycard" | "voice">("organizer");

  // Clear selected set when profile changes
  useEffect(() => {
    setSelectedSet(null);
    setExpandedSets(new Set());
  }, [profileId]);

  // Fetch sets
  const fetchSets = useCallback(async (autoSelectFirst = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (profileId) params.set("profileId", profileId);

      const response = await fetch(`/api/sexting-sets?${params.toString()}`);
      const data = await response.json();

      if (data.sets) {
        setSets(data.sets);
        // Auto-select first set only on initial load
        if (autoSelectFirst && data.sets.length > 0) {
          setSelectedSet(data.sets[0]);
          setExpandedSets(new Set([data.sets[0].id]));
        }
      }
    } catch (error) {
      console.error("Error fetching sets:", error);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  // Initial fetch - only runs when profileId changes
  useEffect(() => {
    fetchSets(true); // Auto-select first set on initial load
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Create new set
  const createSet = async () => {
    if (!newSetName.trim()) return;

    try {
      setCreating(true);
      const response = await fetch("/api/sexting-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSetName,
          profileId,
          category: profileId || "general",
        }),
      });

      const data = await response.json();
      if (data.set) {
        setSets((prev) => [data.set, ...prev]);
        setSelectedSet(data.set);
        setExpandedSets((prev) => new Set([...prev, data.set.id]));
        setNewSetName("");
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error("Error creating set:", error);
    } finally {
      setCreating(false);
    }
  };

  // Delete set
  const deleteSet = async (setId: string) => {
    if (
      !confirm("Are you sure you want to delete this set and all its images?")
    )
      return;

    try {
      await fetch(`/api/sexting-sets?id=${setId}`, { method: "DELETE" });
      setSets((prev) => prev.filter((s) => s.id !== setId));
      if (selectedSet?.id === setId) {
        setSelectedSet(null);
      }
    } catch (error) {
      console.error("Error deleting set:", error);
    }
  };

  // Update set name
  const updateSetName = async (setId: string, name: string) => {
    try {
      const response = await fetch("/api/sexting-sets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: setId, name }),
      });

      const data = await response.json();
      if (data.set) {
        setSets((prev) => prev.map((s) => (s.id === setId ? data.set : s)));
        if (selectedSet?.id === setId) {
          setSelectedSet(data.set);
        }
      }
    } catch (error) {
      console.error("Error updating set name:", error);
    }
    setEditingName(null);
  };

  // Upload images - Direct S3 upload to bypass Vercel's 4.5MB limit
  const handleFileUpload = async (
    files: FileList | null,
    targetSetId?: string,
  ) => {
    const setId = targetSetId || selectedSet?.id;
    if (!files || files.length === 0 || !setId) return;

    try {
      setUploading(true);
      setUploadProgress({ current: 0, total: files.length });

      const fileArray = Array.from(files);
      
      // Step 1: Get presigned URLs for all files
      const urlResponse = await fetch("/api/sexting-sets/get-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId,
          files: fileArray.map(f => ({
            name: f.name,
            type: f.type,
            size: f.size,
          })),
        }),
      });

      const urlData = await urlResponse.json();
      if (!urlData.uploadUrls) {
        throw new Error("Failed to get upload URLs");
      }

      // Step 2: Upload each file directly to S3
      const uploadedFiles = [];
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const uploadInfo = urlData.uploadUrls[i];

        // Upload directly to S3 using presigned URL
        const uploadResponse = await fetch(uploadInfo.uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) {
          console.error(`Failed to upload ${file.name}`);
          continue;
        }

        uploadedFiles.push(uploadInfo);
        setUploadProgress({ current: i + 1, total: files.length });
      }

      // Step 3: Confirm uploads and create database records
      if (uploadedFiles.length > 0) {
        const confirmResponse = await fetch("/api/sexting-sets/confirm-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            setId,
            uploadedFiles,
          }),
        });

        const confirmData = await confirmResponse.json();
        if (confirmData.success) {
          // Refresh the set
          const setResponse = await fetch(`/api/sexting-sets/${setId}`);
          const setData = await setResponse.json();
          if (setData.set) {
            setSets((prev) =>
              prev.map((s) => (s.id === setId ? setData.set : s)),
            );
            if (selectedSet?.id === setId) {
              setSelectedSet(setData.set);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error uploading images:", error);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // Delete image
  const deleteImage = async (setId: string, imageId: string) => {
    try {
      await fetch(`/api/sexting-sets/${setId}?imageId=${imageId}`, {
        method: "DELETE",
      });

      // Update local state
      setSets((prev) =>
        prev.map((s) => {
          if (s.id !== setId) return s;
          return {
            ...s,
            images: s.images
              .filter((img) => img.id !== imageId)
              .map((img, idx) => ({ ...img, sequence: idx + 1 })),
          };
        }),
      );

      if (selectedSet?.id === setId) {
        setSelectedSet((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            images: prev.images
              .filter((img) => img.id !== imageId)
              .map((img, idx) => ({ ...img, sequence: idx + 1 })),
          };
        });
      }
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  // Rename image
  const renameImage = async (setId: string, imageId: string, newName: string) => {
    if (!newName.trim()) return;
    
    try {
      setSavingImageName(true);
      const response = await fetch(`/api/sexting-sets/${setId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId, newName: newName.trim() }),
      });

      const data = await response.json();
      if (data.success && data.image) {
        // Update local state
        setSets((prev) =>
          prev.map((s) => {
            if (s.id !== setId) return s;
            return {
              ...s,
              images: s.images.map((img) =>
                img.id === imageId ? { ...img, name: data.image.name } : img
              ),
            };
          })
        );

        if (selectedSet?.id === setId) {
          setSelectedSet((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              images: prev.images.map((img) =>
                img.id === imageId ? { ...img, name: data.image.name } : img
              ),
            };
          });
        }

        // Update the detail modal if open
        if (selectedImageForDetail?.id === imageId) {
          setSelectedImageForDetail((prev) =>
            prev ? { ...prev, name: data.image.name } : null
          );
        }
      }
    } catch (error) {
      console.error("Error renaming image:", error);
    } finally {
      setSavingImageName(false);
      setEditingImageId(null);
      setEditingImageName("");
    }
  };

  // Open image detail modal
  const openImageDetail = (image: SextingImage) => {
    setSelectedImageForDetail(image);
    setShowImageDetailModal(true);
  };

  // Fetch profiles for export
  const fetchProfiles = async () => {
    try {
      setLoadingProfiles(true);
      const response = await fetch("/api/instagram/profiles");
      const data = await response.json();

      if (data.profiles && Array.isArray(data.profiles)) {
        setProfiles(data.profiles);
        // Auto-select current profile or first one
        if (data.profiles.length > 0 && !selectedExportProfileId) {
          setSelectedExportProfileId(profileId || data.profiles[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
    } finally {
      setLoadingProfiles(false);
    }
  };

  // Open export modal
  const openExportModal = () => {
    if (!selectedSet || selectedSet.images.length === 0) return;
    setShowExportModal(true);
    setExportSuccess(null);
    setExportFolderName(selectedSet.name); // Pre-fill with set name
    setSelectedExportProfileId(profileId); // Default to current profile
    fetchProfiles();
  };

  // Export to vault - creates a new folder with all items
  const exportToVault = async () => {
    if (!selectedSet || !selectedExportProfileId) return;

    if (!exportFolderName.trim()) {
      alert("Please enter a folder name");
      return;
    }

    try {
      setExporting(true);
      const response = await fetch("/api/sexting-sets/export-to-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId: selectedSet.id,
          profileId: selectedExportProfileId,
          folderName: exportFolderName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to export");
      }

      setExportSuccess({
        folderName: data.folderName,
        itemCount: data.itemCount,
      });

      // Reset state after success
      setTimeout(() => {
        setShowExportModal(false);
        setExportSuccess(null);
        setExportFolderName("");
      }, 2000);
    } catch (error) {
      console.error("Error exporting to vault:", error);
      alert(
        error instanceof Error ? error.message : "Failed to export to vault",
      );
    } finally {
      setExporting(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    setDragOverIndex(index);
  };

  // Debounced save function for reordering
  const saveReorderDebounced = useCallback((setId: string, imageIds: string[]) => {
    // Store the pending reorder
    pendingReorderRef.current = { setId, imageIds };
    
    // Clear any existing timeout
    if (reorderTimeoutRef.current) {
      clearTimeout(reorderTimeoutRef.current);
    }
    
    // Set a new timeout to save after 1.5 seconds of no activity
    reorderTimeoutRef.current = setTimeout(async () => {
      const pending = pendingReorderRef.current;
      if (!pending) return;
      
      try {
        setSavingOrder(true);
        await fetch("/api/sexting-sets/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending),
        });
        pendingReorderRef.current = null;
      } catch (error) {
        console.error("Error saving order:", error);
      } finally {
        setSavingOrder(false);
      }
    }, 1500); // 1.5 second debounce
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (reorderTimeoutRef.current) {
        clearTimeout(reorderTimeoutRef.current);
      }
    };
  }, []);

  const handleDragEnd = () => {
    if (draggedIndex === null || dragOverIndex === null || !selectedSet) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    if (draggedIndex !== dragOverIndex) {
      const newImages = [...selectedSet.images];

      // Swap the two elements directly
      const temp = newImages[draggedIndex];
      newImages[draggedIndex] = newImages[dragOverIndex];
      newImages[dragOverIndex] = temp;

      // Update sequences
      const reorderedImages = newImages.map((img, idx) => ({
        ...img,
        sequence: idx + 1,
      }));

      // Optimistic update - instant UI feedback
      const updatedSet = { ...selectedSet, images: reorderedImages };
      setSelectedSet(updatedSet);
      setSets((prev) =>
        prev.map((s) => (s.id === selectedSet.id ? updatedSet : s)),
      );

      // Debounced save - waits for user to finish reordering
      saveReorderDebounced(selectedSet.id, reorderedImages.map((img) => img.id));
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // File drop zone handlers
  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingFile(true);
    }
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    if (e.dataTransfer.files.length > 0 && selectedSet) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  // Toggle set expansion
  const toggleSetExpansion = (setId: string) => {
    setExpandedSets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(setId)) {
        newSet.delete(setId);
      } else {
        newSet.add(setId);
      }
      return newSet;
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const isVideo = (type: string) => type.startsWith("video/");
  const isAudio = (type: string) => type.startsWith("audio/");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-pink-500 mx-auto" />
          <p className="text-gray-400">Loading your sets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with gradient and tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl shadow-lg shadow-pink-500/25">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
              Sexting Set Organizer
            </h2>
            <p className="text-sm text-gray-400">
              {sets.length} set{sets.length !== 1 ? "s" : ""} • Drag to reorder
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Buttons */}
          <div className="flex bg-gray-800/50 rounded-xl p-1">
            <button
              onClick={() => setActiveTab("organizer")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === "organizer"
                  ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Heart className="w-4 h-4" />
              Sets
            </button>
            <button
              onClick={() => setActiveTab("keycard")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === "keycard"
                  ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <FileText className="w-4 h-4" />
              Keycards
            </button>
            <button
              onClick={() => setActiveTab("voice")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === "voice"
                  ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Mic className="w-4 h-4" />
              Voice
            </button>
          </div>

          {activeTab === "organizer" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl font-medium shadow-lg shadow-pink-500/25 transition-all duration-200 hover:scale-105"
            >
              <FolderPlus className="w-5 h-5" />
              <span>New Set</span>
            </button>
          )}
        </div>
      </div>

      {/* Keycard Generator Tab */}
      {activeTab === "keycard" && (
        <KeycardGenerator
          profileId={profileId}
          hasSelectedSet={!!selectedSet}
          onSaveToSet={selectedSet ? async (blob, filename) => {
            // Convert blob to File and upload
            const file = new File([blob], filename, { type: "image/png" });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            await handleFileUpload(dataTransfer.files);
          } : undefined}
          onSaveComplete={() => {
            // Switch to organizer tab to show the saved keycard
            setActiveTab("organizer");
          }}
        />
      )}

      {/* Voice Generator Tab */}
      {activeTab === "voice" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sets sidebar for voice tab */}
          <div className="lg:col-span-1 space-y-3">
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700/50 rounded-2xl p-4 backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-500" />
                Select a Set
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Choose which set to save your voice notes to
              </p>

              {sets.length === 0 ? (
                <div className="text-center py-6">
                  <Sparkles className="w-8 h-8 text-pink-500/50 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No sets yet</p>
                  <button
                    onClick={() => {
                      setActiveTab("organizer");
                      setShowCreateModal(true);
                    }}
                    className="mt-2 text-pink-400 hover:text-pink-300 text-sm font-medium"
                  >
                    Create your first set
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                  {sets.map((set) => (
                    <button
                      key={set.id}
                      onClick={() => {
                        setSelectedSet(set);
                        setExpandedSets((prev) => new Set([...prev, set.id]));
                      }}
                      className={`w-full p-3 rounded-xl text-left transition-all duration-200 ${
                        selectedSet?.id === set.id
                          ? "bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/40"
                          : "bg-gray-800/50 hover:bg-gray-800/80 border border-transparent hover:border-gray-700/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          selectedSet?.id === set.id 
                            ? "bg-gradient-to-br from-violet-500 to-fuchsia-500" 
                            : "bg-gray-700/50"
                        }`}>
                          <Folder className={`w-5 h-5 ${selectedSet?.id === set.id ? "text-white" : "text-gray-400"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${selectedSet?.id === set.id ? "text-white" : "text-gray-300"}`}>
                            {set.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {set.images.length} item{set.images.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {selectedSet?.id === set.id && (
                          <CheckCircle2 className="w-5 h-5 text-violet-400" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Voice Generator */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700/50 rounded-2xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl">
                  <Mic className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Voice Generator</h3>
                  <p className="text-xs text-gray-400">Generate AI voice notes and save to your set</p>
                </div>
              </div>

              <EmbeddedVoiceGenerator
                setId={selectedSet?.id || null}
                onSaveToSet={selectedSet ? async (audioBlob, filename) => {
                  const file = new File([audioBlob], filename, { type: audioBlob.type });
                  const dataTransfer = new DataTransfer();
                  dataTransfer.items.add(file);
                  await handleFileUpload(dataTransfer.files, selectedSet.id);
                } : undefined}
                onSaveComplete={() => {
                  // Refresh to show the saved audio and switch to organizer tab
                  fetchSets();
                  setActiveTab("organizer");
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main content area - only show when on organizer tab */}
      {activeTab === "organizer" && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sets sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700/50 rounded-2xl p-4 backdrop-blur-sm">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-500" />
              Your Sets
            </h3>

            {sets.length === 0 ? (
              <div className="text-center py-8">
                <Sparkles className="w-10 h-10 text-pink-500/50 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No sets yet</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-3 text-pink-400 hover:text-pink-300 text-sm font-medium"
                >
                  Create your first set
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                {sets.map((set) => (
                  <div
                    key={set.id}
                    className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                      selectedSet?.id === set.id
                        ? "bg-gradient-to-r from-pink-500/20 to-rose-500/20 border border-pink-500/40"
                        : "bg-gray-800/50 hover:bg-gray-800/80 border border-transparent hover:border-gray-700/50"
                    }`}
                    onClick={() => {
                      setSelectedSet(set);
                      setExpandedSets((prev) => new Set([...prev, set.id]));
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {editingName === set.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={tempName}
                              onChange={(e) => setTempName(e.target.value)}
                              className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  updateSetName(set.id, tempName);
                                } else if (e.key === "Escape") {
                                  setEditingName(null);
                                }
                              }}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateSetName(set.id, tempName);
                              }}
                              className="p-1 text-green-400 hover:text-green-300"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingName(null);
                              }}
                              className="p-1 text-gray-400 hover:text-gray-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white truncate">
                              {set.name}
                            </span>
                            <span className="text-xs text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded">
                              {set.images.length}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              set.status === "published"
                                ? "bg-green-500/20 text-green-400"
                                : set.status === "scheduled"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : "bg-gray-600/50 text-gray-400"
                            }`}
                          >
                            {set.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingName(set.id);
                            setTempName(set.name);
                          }}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSet(set.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Image organizer area */}
        <div className="lg:col-span-2">
          {selectedSet ? (
            <div
              className={`bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700/50 rounded-2xl overflow-hidden backdrop-blur-sm transition-all duration-200 ${
                isDraggingFile ? "border-pink-500 ring-2 ring-pink-500/50" : ""
              }`}
              onDragOver={handleFileDragOver}
              onDragLeave={handleFileDragLeave}
              onDrop={handleFileDrop}
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white text-lg">
                      {selectedSet.name}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {selectedSet.images.length} item
                      {selectedSet.images.length !== 1 ? "s" : ""}
                      {savingOrder && (
                        <span className="ml-2 text-pink-400">• Saving...</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => handleFileUpload(e.target.files)}
                      multiple
                      accept="image/*,video/*,audio/*"
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500/20 to-rose-500/20 hover:from-pink-500/30 hover:to-rose-500/30 border border-pink-500/30 text-pink-400 rounded-xl font-medium transition-all duration-200"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>
                            {uploadProgress 
                              ? `${uploadProgress.current}/${uploadProgress.total}` 
                              : "Uploading..."}
                          </span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>Upload</span>
                        </>
                      )}
                    </button>
                    {selectedSet.images.length > 0 && (
                      <button
                        onClick={openExportModal}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 border border-purple-500/30 text-purple-400 rounded-xl font-medium transition-all duration-200"
                      >
                        <FolderOutput className="w-4 h-4" />
                        <span>Export to Vault</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Images grid */}
              <div className="p-4">
                {selectedSet.images.length === 0 ? (
                  <div
                    className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
                      isDraggingFile
                        ? "border-pink-500 bg-pink-500/10"
                        : "border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <Upload
                      className={`w-12 h-12 mx-auto mb-4 ${isDraggingFile ? "text-pink-400" : "text-gray-500"}`}
                    />
                    <p
                      className={`font-medium ${isDraggingFile ? "text-pink-400" : "text-gray-400"}`}
                    >
                      {isDraggingFile
                        ? "Drop your files here!"
                        : "Drop images or videos here"}
                    </p>
                    <p className="text-gray-500 text-sm mt-2">
                      or click upload to browse
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {selectedSet.images.map((image, index) => (
                      <div
                        key={image.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        onClick={() => openImageDetail(image)}
                        className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-grab active:cursor-grabbing ${
                          draggedIndex === index
                            ? "opacity-50 scale-95 border-pink-500"
                            : dragOverIndex === index
                              ? "border-pink-500 ring-2 ring-pink-500/50 scale-105"
                              : "border-transparent hover:border-pink-500/50"
                        }`}
                      >
                        {/* Sequence badge */}
                        <div className="absolute top-2 left-2 z-10 w-7 h-7 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center shadow-lg">
                          <span className="text-white text-xs font-bold">
                            {image.sequence}
                          </span>
                        </div>

                        {/* Media */}
                        {isVideo(image.type) ? (
                          <video
                            src={image.url}
                            className="w-full h-full object-cover"
                            muted
                          />
                        ) : isAudio(image.type) ? (
                          <div className="w-full h-full bg-gradient-to-br from-violet-900/50 to-fuchsia-900/50 flex flex-col items-center justify-center p-3">
                            <Music className="w-10 h-10 text-violet-400 mb-2" />
                            <audio
                              src={image.url}
                              controls
                              className="w-full h-8"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-xs text-gray-400 mt-2 truncate max-w-full">
                              {image.name}
                            </span>
                          </div>
                        ) : (
                          <img
                            src={image.url}
                            alt={image.name}
                            className="w-full h-full object-cover"
                          />
                        )}

                        {/* Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          {/* Drag handle */}
                          <div className="absolute top-2 right-2 flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingImageId(image.id);
                                setEditingImageName(image.name.replace(/\.[^/.]+$/, ''));
                              }}
                              className="p-1.5 bg-black/50 hover:bg-blue-500/80 rounded-lg backdrop-blur-sm transition-colors"
                              title="Edit filename"
                            >
                              <Edit3 className="w-4 h-4 text-white" />
                            </button>
                            <div className="p-1.5 bg-black/50 rounded-lg backdrop-blur-sm">
                              <GripVertical className="w-4 h-4 text-white" />
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              {isVideo(image.type) ? (
                                <Video className="w-4 h-4 text-pink-400" />
                              ) : isAudio(image.type) ? (
                                <Volume2 className="w-4 h-4 text-violet-400" />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-pink-400" />
                              )}
                              <span className="text-xs text-white/80 truncate max-w-[80px]">
                                {formatFileSize(image.size)}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteImage(selectedSet.id, image.id);
                              }}
                              className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-white" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700/50 rounded-2xl p-12 text-center backdrop-blur-sm">
              <Sparkles className="w-16 h-16 text-pink-500/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Select a Set
              </h3>
              <p className="text-gray-400 mb-6">
                Choose a set from the sidebar to organize your content
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl font-medium shadow-lg shadow-pink-500/25 transition-all duration-200"
              >
                <FolderPlus className="w-5 h-5" />
                Create New Set
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Create Modal - React Portal */}
      {showCreateModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl">
                    <FolderPlus className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    Create New Set
                  </h3>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Set Name
                  </label>
                  <input
                    type="text"
                    value={newSetName}
                    onChange={(e) => setNewSetName(e.target.value)}
                    placeholder="e.g., Valentine's Day Set"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createSet();
                    }}
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-700 flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewSetName("");
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createSet}
                  disabled={!newSetName.trim() || creating}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl font-medium shadow-lg shadow-pink-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Set
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Export to Vault Modal - React Portal */}
      {showExportModal &&
        selectedSet &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                    <FolderOutput className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Export to Vault
                    </h3>
                    <p className="text-sm text-gray-400">
                      {selectedSet.images.length} item
                      {selectedSet.images.length !== 1 ? "s" : ""} from "
                      {selectedSet.name}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {exportSuccess ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-400" />
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-2">
                      Export Complete!
                    </h4>
                    <p className="text-gray-400">
                      {exportSuccess.itemCount} item
                      {exportSuccess.itemCount !== 1 ? "s" : ""} exported to{" "}
                      <span className="text-purple-400">
                        {exportSuccess.folderName}
                      </span>
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Select Profile */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Select Profile
                      </label>
                      {loadingProfiles ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                        </div>
                      ) : profiles.length === 0 ? (
                        <div className="text-center py-6 bg-gray-800/50 rounded-xl">
                          <User className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                          <p className="text-gray-400 text-sm">
                            No profiles found
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar">
                          {profiles.map((profile) => (
                            <button
                              key={profile.id}
                              onClick={() =>
                                setSelectedExportProfileId(profile.id)
                              }
                              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                                selectedExportProfileId === profile.id
                                  ? "bg-purple-500/20 border border-purple-500/40"
                                  : "bg-gray-800/50 border border-transparent hover:border-gray-700"
                              }`}
                            >
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  selectedExportProfileId === profile.id
                                    ? "bg-purple-500/30"
                                    : "bg-gray-700"
                                }`}
                              >
                                <User
                                  className={`w-4 h-4 ${
                                    selectedExportProfileId === profile.id
                                      ? "text-purple-400"
                                      : "text-gray-500"
                                  }`}
                                />
                              </div>
                              <div className="flex-1 text-left">
                                <span
                                  className={`font-medium block ${
                                    selectedExportProfileId === profile.id
                                      ? "text-white"
                                      : "text-gray-300"
                                  }`}
                                >
                                  {profile.name}
                                </span>
                                {profile.instagramUsername && (
                                  <span className="text-xs text-gray-500">
                                    @{profile.instagramUsername}
                                  </span>
                                )}
                              </div>
                              {profile.isDefault && (
                                <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded-full">
                                  Default
                                </span>
                              )}
                              {selectedExportProfileId === profile.id && (
                                <Check className="w-4 h-4 text-purple-400" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Folder Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Folder Name
                      </label>
                      <input
                        type="text"
                        value={exportFolderName}
                        onChange={(e) => setExportFolderName(e.target.value)}
                        placeholder="e.g., Valentine's Day Collection"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        A new folder will be created in your Vault with this
                        name
                      </p>
                    </div>
                  </>
                )}
              </div>

              {!exportSuccess && (
                <div className="p-6 border-t border-gray-700 flex gap-3">
                  <button
                    onClick={() => {
                      setShowExportModal(false);
                      setExportFolderName("");
                    }}
                    className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={exportToVault}
                    disabled={
                      exporting ||
                      !selectedExportProfileId ||
                      !exportFolderName.trim()
                    }
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl font-medium shadow-lg shadow-purple-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <FolderOutput className="w-4 h-4" />
                        Export as Folder
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* Image Detail/Rename Modal - React Portal */}
      {showImageDetailModal &&
        selectedImageForDetail &&
        selectedSet &&
        typeof document !== "undefined" &&
        createPortal(
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowImageDetailModal(false);
              setSelectedImageForDetail(null);
              setEditingImageId(null);
              setEditingImageName("");
            }}
          >
            <div 
              className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-bold">
                      {selectedImageForDetail.sequence}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Image Details</h3>
                    <p className="text-xs text-gray-400">Click on filename to edit</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowImageDetailModal(false);
                    setSelectedImageForDetail(null);
                    setEditingImageId(null);
                    setEditingImageName("");
                  }}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Preview */}
                <div className="relative aspect-video rounded-xl overflow-hidden bg-black/50">
                  {isVideo(selectedImageForDetail.type) ? (
                    <video
                      src={selectedImageForDetail.url}
                      className="w-full h-full object-contain"
                      controls
                    />
                  ) : isAudio(selectedImageForDetail.type) ? (
                    <div className="w-full h-full bg-gradient-to-br from-violet-900/50 to-fuchsia-900/50 flex flex-col items-center justify-center p-6">
                      <Music className="w-20 h-20 text-violet-400 mb-4" />
                      <audio
                        src={selectedImageForDetail.url}
                        controls
                        className="w-full max-w-md"
                      />
                      <span className="text-sm text-gray-300 mt-4">{selectedImageForDetail.name}</span>
                    </div>
                  ) : (
                    <img
                      src={selectedImageForDetail.url}
                      alt={selectedImageForDetail.name}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Filename - Editable */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Filename
                    </label>
                    {editingImageId === selectedImageForDetail.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingImageName}
                          onChange={(e) => setEditingImageName(e.target.value)}
                          className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              renameImage(selectedSet.id, selectedImageForDetail.id, editingImageName);
                            } else if (e.key === "Escape") {
                              setEditingImageId(null);
                              setEditingImageName("");
                            }
                          }}
                        />
                        <button
                          onClick={() => renameImage(selectedSet.id, selectedImageForDetail.id, editingImageName)}
                          disabled={savingImageName || !editingImageName.trim()}
                          className="px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {savingImageName ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setEditingImageId(null);
                            setEditingImageName("");
                          }}
                          className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          setEditingImageId(selectedImageForDetail.id);
                          setEditingImageName(selectedImageForDetail.name.replace(/\.[^/.]+$/, ''));
                        }}
                        className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white cursor-pointer hover:border-pink-500/50 transition-colors flex items-center justify-between group"
                      >
                        <span className="truncate">{selectedImageForDetail.name}</span>
                        <Edit3 className="w-4 h-4 text-gray-500 group-hover:text-pink-400 transition-colors" />
                      </div>
                    )}
                  </div>

                  {/* Sequence */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Sequence
                    </label>
                    <div className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white">
                      #{selectedImageForDetail.sequence}
                    </div>
                  </div>

                  {/* Size */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      File Size
                    </label>
                    <div className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white">
                      {formatFileSize(selectedImageForDetail.size)}
                    </div>
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Type
                    </label>
                    <div className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white flex items-center gap-2">
                      {isVideo(selectedImageForDetail.type) ? (
                        <>
                          <Video className="w-4 h-4 text-pink-400" />
                          Video
                        </>
                      ) : isAudio(selectedImageForDetail.type) ? (
                        <>
                          <Volume2 className="w-4 h-4 text-violet-400" />
                          Audio
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-4 h-4 text-pink-400" />
                          Image
                        </>
                      )}
                    </div>
                  </div>

                  {/* Uploaded Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Uploaded
                    </label>
                    <div className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white">
                      {new Date(selectedImageForDetail.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-gray-700 flex justify-between">
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this image?")) {
                      deleteImage(selectedSet.id, selectedImageForDetail.id);
                      setShowImageDetailModal(false);
                      setSelectedImageForDetail(null);
                    }
                  }}
                  className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <a
                  href={selectedImageForDetail.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Open Original
                </a>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
