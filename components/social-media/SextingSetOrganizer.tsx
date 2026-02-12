"use client";

/**
 * Sexting Set Organizer Component
 * 
 * Recent UX Improvements (Feb 2026):
 * 
 * 1. Better Visual Feedback:
 *    - Custom styled confirmation modals instead of browser alerts
 *    - Toast notifications for all actions (success/error/info)
 *    - Prominent saving order indicator (floating badge)
 *    - Skeleton loaders on initial load
 * 
 * 2. Quick Actions on Hover:
 *    - Floating action buttons on image cards
 *    - Quick delete, rename, preview buttons
 *    - Visual drag handle indicator
 *    - Smooth transitions and delays for better UX
 * 
 * 3. Enhanced Drag & Drop:
 *    - Visual preview while dragging (with move icon)
 *    - Drop zone highlighting with pulsing border
 *    - Enhanced visual feedback (shadows, rings, scale)
 *    - Grid gap highlighting for precise placement
 * 
 * 4. Mobile Optimization:
 *    - Swipe-to-delete gesture on images
 *    - Bottom sheet modals instead of centered dialogs
 *    - Touch-friendly 44px minimum touch targets
 *    - Responsive button labels (hidden on mobile)
 *    - Floating Action Button (FAB) for quick upload
 *    - Simplified mobile layout
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  ChevronRight,
  Calendar,
  Eye,
  EyeOff,
  MoreHorizontal,
  Download,
  Copy,
  Share2,
  FolderOutput,
  FolderInput,
  Folder,
  CheckCircle2,
  XCircle,
  User,
  Users,
  FileText,
  Mic,
  Volume2,
  Music,
  HardDrive,
  RefreshCw,
  Search,
  Link,
  ExternalLink,
  MoreVertical,
  PlusCircle,
  AlertCircle,
  LogOut,
  Info,
  Move,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
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
  profileName?: string | null;
}

interface VaultFolder {
  id: string;
  name: string;
  profileId: string;
  isDefault?: boolean;
  _count?: { items: number };
}

interface VaultItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  awsS3Url: string;
  createdAt: string;
  folderId: string;
  profileId: string;
}

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
}

interface GoogleDriveFolder {
  id: string;
  name: string;
  mimeType: string;
  shared?: boolean;
}

interface GoogleDriveBreadcrumb {
  id: string | null;
  name: string;
}

interface SextingSetOrganizerProps {
  profileId: string | null;
  tenant: string;
}

export default function SextingSetOrganizer({
  profileId,
  tenant,
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

  // Import from Vault state
  const [showImportModal, setShowImportModal] = useState(false);
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [selectedVaultFolderId, setSelectedVaultFolderId] = useState<string | null>(null);
  const [selectedVaultItems, setSelectedVaultItems] = useState<Set<string>>(new Set());
  const [loadingVaultFolders, setLoadingVaultFolders] = useState(false);
  const [loadingVaultItems, setLoadingVaultItems] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<{ itemCount: number } | null>(null);

  // Import from Google Drive state
  const [showGoogleDriveModal, setShowGoogleDriveModal] = useState(false);
  const [googleDriveAccessToken, setGoogleDriveAccessToken] = useState<string | null>(null);
  const [googleDriveFiles, setGoogleDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [googleDriveFolders, setGoogleDriveFolders] = useState<GoogleDriveFolder[]>([]);
  const [googleDriveBreadcrumbs, setGoogleDriveBreadcrumbs] = useState<GoogleDriveBreadcrumb[]>([{ id: null, name: 'My Drive' }]);
  const [currentGoogleDriveFolderId, setCurrentGoogleDriveFolderId] = useState<string | null>(null);
  const [selectedGoogleDriveFiles, setSelectedGoogleDriveFiles] = useState<Set<string>>(new Set());
  const [loadingGoogleDriveFiles, setLoadingGoogleDriveFiles] = useState(false);
  const [importingFromGoogleDrive, setImportingFromGoogleDrive] = useState(false);
  const [googleDriveImportSuccess, setGoogleDriveImportSuccess] = useState<{ itemCount: number } | null>(null);
  const [googleDriveError, setGoogleDriveError] = useState<string | null>(null);
  const [showSharedFolders, setShowSharedFolders] = useState(false);
  const [googleDriveSearchQuery, setGoogleDriveSearchQuery] = useState("");
  const [isGoogleDriveSearchMode, setIsGoogleDriveSearchMode] = useState(false);
  const [googleDriveViewMode, setGoogleDriveViewMode] = useState<'myDrive' | 'shared' | 'link'>('myDrive');
  const [googleDriveLinkInput, setGoogleDriveLinkInput] = useState("");

  // Image rename state
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editingImageName, setEditingImageName] = useState("");
  const [savingImageName, setSavingImageName] = useState(false);

  // Image detail modal state
  const [showImageDetailModal, setShowImageDetailModal] = useState(false);
  const [selectedImageForDetail, setSelectedImageForDetail] = useState<SextingImage | null>(null);

  // Keycard and Voice modal states
  const [showKeycardModal, setShowKeycardModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [actionsMenuPosition, setActionsMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const actionsButtonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmText: string;
    confirmAction: () => void;
    isDangerous?: boolean;
  } | null>(null);

  // Hover state for image cards
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  // Touch gesture state for swipe
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; id: string } | null>(null);
  const [touchOffset, setTouchOffset] = useState<{ id: string; offset: number } | null>(null);

  // Drop zone state for drag between sets
  const [dropTargetSetId, setDropTargetSetId] = useState<string | null>(null);

  // Check if "All Profiles" is selected
  const isAllProfiles = profileId === "all";

  // Access the user and profiles from hooks for shared profile detection
  const { user: clerkUser } = useUser();
  const { profiles: globalProfiles } = useInstagramProfile();

  // Helper to check if selected profile is shared (not owned by current user)
  const isSharedProfile = useMemo(() => {
    if (!profileId || profileId === "all" || !clerkUser?.id) return false;
    const profile = globalProfiles.find(p => p.id === profileId);
    if (!profile) return false;
    // Check if the profile's clerkId matches the current user
    return profile.clerkId !== clerkUser.id;
  }, [profileId, globalProfiles, clerkUser?.id]);

  // Helper to get owner name for shared profiles
  const getSharedProfileOwnerName = useMemo(() => {
    if (!isSharedProfile) return null;
    const profile = globalProfiles.find(p => p.id === profileId);
    if (!profile?.user) return null;
    if (profile.user.firstName && profile.user.lastName) {
      return `${profile.user.firstName} ${profile.user.lastName}`;
    }
    if (profile.user.firstName) return profile.user.firstName;
    if (profile.user.name) return profile.user.name;
    return null;
  }, [isSharedProfile, profileId, globalProfiles]);

  // Set mounted state for portals
  useEffect(() => {
    setMounted(true);
  }, []);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null);
      }, 4000);
    }
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [toast]);

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  // Update dropdown position when menu opens
  useEffect(() => {
    if (showActionsMenu && actionsButtonRef.current) {
      const rect = actionsButtonRef.current.getBoundingClientRect();
      setActionsMenuPosition({
        top: rect.bottom + 8,
        left: rect.right - 224, // 224px = w-56 (14rem)
      });
    }
  }, [showActionsMenu]);

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideMenu = actionsMenuRef.current?.contains(target);
      const isInsideButton = actionsButtonRef.current?.contains(target);
      
      if (!isInsideMenu && !isInsideButton) {
        setShowActionsMenu(false);
      }
    };
    
    if (showActionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActionsMenu]);

  // Clear selected set when profile changes
  useEffect(() => {
    setSelectedSet(null);
    setExpandedSets(new Set());
  }, [profileId]);

  // Fetch sets - accepts profileId as parameter to avoid stale closure
  const fetchSets = useCallback(async (profileIdParam: string | null, autoSelectFirst = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (profileIdParam) params.set("profileId", profileIdParam);

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
  }, []);

  // Initial fetch - only runs when profileId changes
  useEffect(() => {
    fetchSets(profileId, true); // Auto-select first set on initial load
  }, [profileId, fetchSets]);

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
        showToast(`"${data.set.name}" created successfully`, 'success');
      }
    } catch (error) {
      console.error("Error creating set:", error);
      showToast('Failed to create set', 'error');
    } finally {
      setCreating(false);
    }
  };

  // Delete set
  const deleteSet = async (setId: string) => {
    const setToDelete = sets.find(s => s.id === setId);
    if (!setToDelete) return;

    setConfirmModal({
      title: "Delete Set",
      message: `Are you sure you want to delete "${setToDelete.name}" and all ${setToDelete.images.length} image${setToDelete.images.length !== 1 ? 's' : ''}? This action cannot be undone.`,
      confirmText: "Delete Set",
      isDangerous: true,
      confirmAction: async () => {
        try {
          await fetch(`/api/sexting-sets?id=${setId}`, { method: "DELETE" });
          setSets((prev) => prev.filter((s) => s.id !== setId));
          if (selectedSet?.id === setId) {
            setSelectedSet(null);
          }
          showToast(`"${setToDelete.name}" deleted successfully`, 'success');
        } catch (error) {
          console.error("Error deleting set:", error);
          showToast('Failed to delete set', 'error');
        }
      }
    });
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
          showToast(`${uploadedFiles.length} file${uploadedFiles.length !== 1 ? 's' : ''} uploaded successfully`, 'success');
        }
      } else {
        showToast('No files were uploaded', 'error');
      }
    } catch (error) {
      console.error("Error uploading images:", error);
      showToast('Upload failed. Please try again.', 'error');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // Delete image
  const deleteImage = async (setId: string, imageId: string) => {
    const set = sets.find(s => s.id === setId);
    const image = set?.images.find(img => img.id === imageId);
    if (!image) return;

    setConfirmModal({
      title: "Delete Image",
      message: `Are you sure you want to delete "${image.name}"? This action cannot be undone.`,
      confirmText: "Delete",
      isDangerous: true,
      confirmAction: async () => {
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

          showToast(`"${image.name}" deleted successfully`, 'success');
          if (showImageDetailModal) {
            setShowImageDetailModal(false);
            setSelectedImageForDetail(null);
          }
        } catch (error) {
          console.error("Error deleting image:", error);
          showToast('Failed to delete image', 'error');
        }
      }
    });
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

  // Touch gesture handlers for swipe delete
  const handleTouchStart = (e: React.TouchEvent, imageId: string) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY, id: imageId });
  };

  const handleTouchMove = (e: React.TouchEvent, imageId: string) => {
    if (!isMobile || !touchStart || touchStart.id !== imageId) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = Math.abs(touch.clientY - touchStart.y);
    
    // Only track horizontal swipe
    if (deltaY < 30 && Math.abs(deltaX) > 10) {
      setTouchOffset({ id: imageId, offset: deltaX });
    }
  };

  const handleTouchEnd = (imageId: string) => {
    if (!isMobile || !touchOffset || touchOffset.id !== imageId) {
      setTouchStart(null);
      setTouchOffset(null);
      return;
    }

    // If swiped left significantly, trigger delete
    if (touchOffset.offset < -100 && selectedSet) {
      deleteImage(selectedSet.id, imageId);
    }

    setTouchStart(null);
    setTouchOffset(null);
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
    
    // Fetch profiles and pre-select the set's profile when viewing All Profiles
    if (isAllProfiles) {
      fetchProfiles();
      // Pre-select the profile that owns this set (category stores the profileId)
      setSelectedExportProfileId(selectedSet.category);
    }
  };

  // Export to vault - creates a new folder with all items
  const exportToVault = async () => {
    // When viewing All Profiles, use the selected export profile ID
    const targetProfileId = isAllProfiles ? selectedExportProfileId : profileId;
    
    if (!selectedSet || !targetProfileId) return;

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
          profileId: targetProfileId,
          folderName: exportFolderName.trim(),
          organizationSlug: tenant,
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

  // Fetch vault folders for import
  const fetchVaultFolders = async () => {
    if (!profileId) return;
    try {
      setLoadingVaultFolders(true);
      const response = await fetch(`/api/vault/folders?profileId=${profileId}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setVaultFolders(data);
      }
    } catch (error) {
      console.error("Error fetching vault folders:", error);
    } finally {
      setLoadingVaultFolders(false);
    }
  };

  // Fetch vault items for a folder
  const fetchVaultItems = async (folderId: string) => {
    if (!profileId) return;
    try {
      setLoadingVaultItems(true);
      const response = await fetch(`/api/vault/items?profileId=${profileId}&folderId=${folderId}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        // Filter to only show images, videos, and audio files
        const mediaItems = data.filter((item: VaultItem) => 
          item.fileType.startsWith('image/') || item.fileType.startsWith('video/') || item.fileType.startsWith('audio/')
        );
        setVaultItems(mediaItems);
      }
    } catch (error) {
      console.error("Error fetching vault items:", error);
    } finally {
      setLoadingVaultItems(false);
    }
  };

  // Open import modal
  const openImportModal = () => {
    if (!selectedSet) return;
    setShowImportModal(true);
    setImportSuccess(null);
    setSelectedVaultFolderId(null);
    setSelectedVaultItems(new Set());
    setVaultItems([]);
    fetchVaultFolders();
  };

  // Handle vault folder selection
  const handleVaultFolderSelect = (folderId: string) => {
    setSelectedVaultFolderId(folderId);
    setSelectedVaultItems(new Set());
    fetchVaultItems(folderId);
  };

  // Toggle vault item selection
  const toggleVaultItemSelection = (itemId: string) => {
    setSelectedVaultItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Select all vault items
  const selectAllVaultItems = () => {
    if (selectedVaultItems.size === vaultItems.length) {
      setSelectedVaultItems(new Set());
    } else {
      setSelectedVaultItems(new Set(vaultItems.map(item => item.id)));
    }
  };

  // Import from vault
  const importFromVault = async () => {
    if (!selectedSet || selectedVaultItems.size === 0) return;

    try {
      setImporting(true);
      const response = await fetch("/api/sexting-sets/import-from-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId: selectedSet.id,
          vaultItemIds: Array.from(selectedVaultItems),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to import");
      }

      // Update local state with the new set data
      if (data.set) {
        setSets(prev => prev.map(s => s.id === data.set.id ? data.set : s));
        setSelectedSet(data.set);
      }

      setImportSuccess({ itemCount: data.itemCount });

      // Reset and close after success
      setTimeout(() => {
        setShowImportModal(false);
        setImportSuccess(null);
        setSelectedVaultFolderId(null);
        setSelectedVaultItems(new Set());
        setVaultItems([]);
      }, 2000);
    } catch (error) {
      console.error("Error importing from vault:", error);
      alert(
        error instanceof Error ? error.message : "Failed to import from vault",
      );
    } finally {
      setImporting(false);
    }
  };

  // Check for Google Drive access token in URL (after OAuth callback) or localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // First check URL for new token from OAuth callback
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get('access_token');
      if (accessToken) {
        setGoogleDriveAccessToken(accessToken);
        // Save to localStorage for persistence
        localStorage.setItem('googleDriveAccessToken', accessToken);
        // Clean up URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      } else {
        // Try to load from localStorage
        const savedToken = localStorage.getItem('googleDriveAccessToken');
        if (savedToken) {
          setGoogleDriveAccessToken(savedToken);
        }
      }
    }
  }, []);

  // Connect to Google Drive
  const connectToGoogleDrive = async () => {
    try {
      const currentPath = window.location.pathname;
      const response = await fetch(`/api/auth/google?redirect=${encodeURIComponent(currentPath)}`);
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error("Error connecting to Google Drive:", error);
      setGoogleDriveError("Failed to connect to Google Drive");
    }
  };

  // Fetch Google Drive contents (folders and files) for current folder
  const fetchGoogleDriveContents = async (folderId: string | null = null) => {
    if (!googleDriveAccessToken) return;

    try {
      setLoadingGoogleDriveFiles(true);
      setGoogleDriveError(null);
      
      const params = new URLSearchParams({
        accessToken: googleDriveAccessToken,
      });
      if (folderId) {
        params.append('folderId', folderId);
      }
      
      const response = await fetch(`/api/google-drive/browse?${params}`);
      const data = await response.json();

      if (data.authError) {
        setGoogleDriveAccessToken(null);
        localStorage.removeItem('googleDriveAccessToken');
        setGoogleDriveError("Session expired. Please reconnect to Google Drive.");
        return;
      }

      if (data.error) {
        // Check if it's an access/permission error
        if (data.permissionError || data.error.includes('access') || data.error.includes('permission') || data.error.includes('not found')) {
          setGoogleDriveError("Unable to access this folder. You may not have permission or the link may be invalid.");
        } else {
          setGoogleDriveError(data.error);
        }
        return;
      }

      const folders = data.folders || [];
      const mediaFiles = data.mediaFiles || [];
      
      setGoogleDriveFolders(folders);
      setGoogleDriveFiles(mediaFiles);
    } catch (error) {
      console.error("Error fetching Google Drive contents:", error);
      setGoogleDriveError("Failed to fetch contents from Google Drive");
    } finally {
      setLoadingGoogleDriveFiles(false);
    }
  };

  // Navigate into a Google Drive folder
  const navigateToGoogleDriveFolder = (folder: GoogleDriveFolder) => {
    setCurrentGoogleDriveFolderId(folder.id);
    setGoogleDriveBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedGoogleDriveFiles(new Set());
    fetchGoogleDriveContents(folder.id);
  };

  // Navigate to a specific breadcrumb
  const navigateToBreadcrumb = (index: number) => {
    const breadcrumb = googleDriveBreadcrumbs[index];
    setCurrentGoogleDriveFolderId(breadcrumb.id);
    setGoogleDriveBreadcrumbs(prev => prev.slice(0, index + 1));
    setSelectedGoogleDriveFiles(new Set());
    fetchGoogleDriveContents(breadcrumb.id);
  };

  // Fetch shared folders
  const fetchSharedFolders = async () => {
    if (!googleDriveAccessToken) return;

    try {
      setLoadingGoogleDriveFiles(true);
      setGoogleDriveError(null);
      
      const params = new URLSearchParams({
        accessToken: googleDriveAccessToken,
        includeShared: 'true',
      });
      
      const response = await fetch(`/api/google-drive/folders?${params}`);
      const data = await response.json();

      if (data.authError) {
        setGoogleDriveAccessToken(null);
        setGoogleDriveError("Session expired. Please reconnect to Google Drive.");
        return;
      }

      if (data.error) {
        setGoogleDriveError(data.error);
        return;
      }

      // Filter to only show shared folders
      const sharedFolders = (data.folders || []).filter((f: GoogleDriveFolder) => f.shared);
      setGoogleDriveFolders(sharedFolders);
      setGoogleDriveFiles([]);
    } catch (error) {
      console.error("Error fetching shared folders:", error);
      setGoogleDriveError("Failed to fetch shared folders");
    } finally {
      setLoadingGoogleDriveFiles(false);
    }
  };

  // Switch between view modes (My Drive, Shared, Link)
  const switchGoogleDriveViewMode = (mode: 'myDrive' | 'shared' | 'link') => {
    setGoogleDriveViewMode(mode);
    setShowSharedFolders(mode === 'shared');
    setSelectedGoogleDriveFiles(new Set());
    setIsGoogleDriveSearchMode(false);
    setGoogleDriveSearchQuery("");
    
    if (mode === 'myDrive') {
      setGoogleDriveBreadcrumbs([{ id: null, name: 'My Drive' }]);
      setCurrentGoogleDriveFolderId(null);
      fetchGoogleDriveContents(null);
    } else if (mode === 'shared') {
      setGoogleDriveBreadcrumbs([{ id: null, name: 'Shared with me' }]);
      setCurrentGoogleDriveFolderId(null);
      fetchSharedFolders();
    } else if (mode === 'link') {
      // Link mode - wait for user to paste a link
      setGoogleDriveBreadcrumbs([{ id: null, name: 'From Link' }]);
      setGoogleDriveFolders([]);
      setGoogleDriveFiles([]);
    }
  };

  // Extract folder ID from Google Drive link
  const extractFolderIdFromLink = (link: string): string | null => {
    // Handle various Google Drive folder URL formats:
    // https://drive.google.com/drive/folders/FOLDER_ID
    // https://drive.google.com/drive/u/0/folders/FOLDER_ID
    // https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
    // https://drive.google.com/drive/u/1/folders/FOLDER_ID?resourcekey=xxx
    const patterns = [
      /\/folders\/([a-zA-Z0-9_-]+)/,
      /\/drive\/.*folders\/([a-zA-Z0-9_-]+)/,
      /id=([a-zA-Z0-9_-]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = link.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  // Browse a Google Drive folder from a link
  const browseGoogleDriveLink = async () => {
    if (!googleDriveAccessToken || !googleDriveLinkInput.trim()) return;
    
    const folderId = extractFolderIdFromLink(googleDriveLinkInput.trim());
    if (!folderId) {
      setGoogleDriveError("Invalid Google Drive link. Please paste a valid folder link.");
      return;
    }

    try {
      setLoadingGoogleDriveFiles(true);
      setGoogleDriveError(null);
      setGoogleDriveBreadcrumbs([{ id: folderId, name: 'Linked Folder' }]);
      setCurrentGoogleDriveFolderId(folderId);
      
      await fetchGoogleDriveContents(folderId);
    } catch (error) {
      console.error("Error browsing Google Drive link:", error);
      setGoogleDriveError("Failed to access the linked folder. Make sure you have permission.");
    }
  };

  // Global search across all Google Drive
  const searchGoogleDrive = async (query: string) => {
    if (!googleDriveAccessToken || !query.trim()) return;

    try {
      setLoadingGoogleDriveFiles(true);
      setGoogleDriveError(null);
      setIsGoogleDriveSearchMode(true);
      setGoogleDriveBreadcrumbs([{ id: null, name: `Search: "${query}"` }]);
      
      const params = new URLSearchParams({
        accessToken: googleDriveAccessToken,
        search: query.trim(),
      });
      
      const response = await fetch(`/api/google-drive/browse?${params}`);
      const data = await response.json();

      if (data.authError) {
        setGoogleDriveAccessToken(null);
        setGoogleDriveError("Session expired. Please reconnect to Google Drive.");
        return;
      }

      if (data.error) {
        setGoogleDriveError(data.error);
        return;
      }

      setGoogleDriveFolders(data.folders || []);
      setGoogleDriveFiles(data.mediaFiles || []);
    } catch (error) {
      console.error("Error searching Google Drive:", error);
      setGoogleDriveError("Failed to search Google Drive");
    } finally {
      setLoadingGoogleDriveFiles(false);
    }
  };

  // Clear search and go back to link input
  const clearGoogleDriveSearch = () => {
    setGoogleDriveSearchQuery("");
    setIsGoogleDriveSearchMode(false);
    setSelectedGoogleDriveFiles(new Set());
    setGoogleDriveBreadcrumbs([{ id: null, name: 'From Link' }]);
    // Keep current folder contents if browsing a link, otherwise clear
    if (!currentGoogleDriveFolderId) {
      setGoogleDriveFolders([]);
      setGoogleDriveFiles([]);
    }
  };

  // Open Google Drive import modal
  const openGoogleDriveModal = () => {
    if (!selectedSet) return;
    setShowGoogleDriveModal(true);
    setGoogleDriveImportSuccess(null);
    setSelectedGoogleDriveFiles(new Set());
    setGoogleDriveError(null);
    setGoogleDriveViewMode('link');
    setGoogleDriveLinkInput("");
    setGoogleDriveBreadcrumbs([{ id: null, name: 'From Link' }]);
    setCurrentGoogleDriveFolderId(null);
    setGoogleDriveFolders([]);
    setGoogleDriveFiles([]);
    setGoogleDriveSearchQuery("");
    setIsGoogleDriveSearchMode(false);
  };

  // Toggle Google Drive file selection
  const toggleGoogleDriveFileSelection = (fileId: string) => {
    setSelectedGoogleDriveFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  // Select all Google Drive files
  const selectAllGoogleDriveFiles = () => {
    if (selectedGoogleDriveFiles.size === googleDriveFiles.length) {
      setSelectedGoogleDriveFiles(new Set());
    } else {
      setSelectedGoogleDriveFiles(new Set(googleDriveFiles.map(file => file.id)));
    }
  };

  // Import from Google Drive
  const importFromGoogleDrive = async () => {
    if (!selectedSet || selectedGoogleDriveFiles.size === 0 || !googleDriveAccessToken) return;

    try {
      setImportingFromGoogleDrive(true);
      setGoogleDriveError(null);
      const response = await fetch("/api/sexting-sets/import-from-google-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId: selectedSet.id,
          fileIds: Array.from(selectedGoogleDriveFiles),
          accessToken: googleDriveAccessToken,
        }),
      });

      const data = await response.json();

      if (data.authError) {
        setGoogleDriveAccessToken(null);
        setGoogleDriveError("Session expired. Please reconnect to Google Drive.");
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to import");
      }

      // Update local state with the new set data
      if (data.set) {
        setSets(prev => prev.map(s => s.id === data.set.id ? data.set : s));
        setSelectedSet(data.set);
      }

      setGoogleDriveImportSuccess({ itemCount: data.itemCount });

      // Reset and close after success
      setTimeout(() => {
        setShowGoogleDriveModal(false);
        setGoogleDriveImportSuccess(null);
        setSelectedGoogleDriveFiles(new Set());
        setGoogleDriveFiles([]);
      }, 2000);
    } catch (error) {
      console.error("Error importing from Google Drive:", error);
      setGoogleDriveError(
        error instanceof Error ? error.message : "Failed to import from Google Drive"
      );
    } finally {
      setImportingFromGoogleDrive(false);
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
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-muted rounded-xl animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-muted rounded animate-pulse" />
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            </div>
          </div>
          <div className="h-10 w-32 bg-muted rounded-xl animate-pulse" />
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar Skeleton */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="h-5 w-24 bg-muted rounded animate-pulse mb-3" />
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          </div>

          {/* Main Content Skeleton */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="h-12 bg-muted rounded-xl animate-pulse mb-4" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="aspect-square bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with gradient and tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] rounded-xl shadow-lg">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">
                Sexting Set Organizer
              </h2>
              {isSharedProfile && !isAllProfiles && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)] text-xs font-medium rounded-full border border-[var(--color-brand-blue)]/30">
                  <Share2 className="w-3 h-3" />
                  Shared
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {isAllProfiles && <span>All Profiles • </span>}
              {isSharedProfile 
                ? `Viewing ${getSharedProfileOwnerName ? `${getSharedProfileOwnerName}'s` : "shared"} sets`
                : `${sets.length} set${sets.length !== 1 ? "s" : ""} • Drag to reorder`}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          disabled={isAllProfiles}
          className={`flex items-center gap-2 px-4 py-2.5 sm:px-4 sm:py-2.5 min-h-[44px] rounded-xl font-medium shadow-lg transition-all duration-200 ${
            isAllProfiles
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] hover:from-[var(--color-brand-light-pink)] hover:to-[var(--color-brand-mid-pink)] text-white hover:scale-105 active:scale-95"
          }`}
          title={isAllProfiles ? "Select a specific profile to create a new set" : "Create a new set"}
        >
          <FolderPlus className="w-5 h-5" />
          <span className="hidden sm:inline">New Set</span>
        </button>
      </div>

      {/* Shared Profile Notice */}
      {isSharedProfile && !isAllProfiles && (
        <div className="flex items-center gap-3 p-3 bg-[var(--color-brand-blue)]/10 border border-[var(--color-brand-blue)]/30 rounded-xl">
          <Info className="w-5 h-5 text-[var(--color-brand-blue)] shrink-0" />
          <p className="text-sm text-foreground">
            You are viewing a shared profile{getSharedProfileOwnerName ? ` from ${getSharedProfileOwnerName}` : ""}. 
            You can view, organize, and add content to these sets.
          </p>
        </div>
      )}

      {/* All Profiles Notice */}
      {isAllProfiles && (
        <div className="flex items-center gap-3 p-3 bg-[var(--color-brand-mid-pink)]/10 border border-[var(--color-brand-mid-pink)]/30 rounded-xl">
          <Users className="w-5 h-5 text-[var(--color-brand-mid-pink)] shrink-0" />
          <p className="text-sm text-foreground">
            Viewing sets from all profiles. Select a specific profile to create new sets or perform certain actions.
          </p>
        </div>
      )}

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sets sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              {isAllProfiles ? (
                <>
                  <Users className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                  All Profiles&apos; Sets
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                  Your Sets
                </>
              )}
            </h3>

            {sets.length === 0 ? (
              <div className="text-center py-8">
                <Sparkles className="w-10 h-10 text-[var(--color-brand-mid-pink)] mx-auto mb-3" />
                <p className="text-foreground text-sm font-medium">No sets yet</p>
                {!isAllProfiles && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-3 text-[var(--color-brand-mid-pink)] hover:text-[var(--color-brand-dark-pink)] text-sm font-medium transition-colors"
                  >
                    Create your first set
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                {/* Group sets by profile when All Profiles is selected */}
                {isAllProfiles ? (
                  // Group by profile
                  Object.entries(
                    sets.reduce((acc, set) => {
                      const profileName = set.profileName || "Unknown Profile";
                      if (!acc[profileName]) {
                        acc[profileName] = [];
                      }
                      acc[profileName].push(set);
                      return acc;
                    }, {} as Record<string, SextingSet[]>)
                  ).map(([profileName, profileSets]) => (
                    <div key={profileName} className="mb-4">
                      {/* Profile Header */}
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <User className="w-3.5 h-3.5 text-[var(--color-brand-mid-pink)]" />
                        <span className="text-xs font-medium text-[var(--color-brand-mid-pink)]">{profileName}</span>
                        <span className="text-xs text-muted-foreground">({profileSets.length})</span>
                      </div>
                      {/* Profile's Sets */}
                      <div className="space-y-2 pl-2 border-l-2 border-[var(--color-brand-mid-pink)]/20">
                        {profileSets.map((set) => (
                          <div
                            key={set.id}
                            className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                              selectedSet?.id === set.id
                                ? "bg-[var(--color-brand-mid-pink)]/10 border border-[var(--color-brand-mid-pink)]/40"
                                : "bg-muted/50 hover:bg-muted border border-transparent hover:border-border"
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
                                      className="flex-1 px-2 py-1 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)] focus:border-transparent"
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
                                      className="p-1 text-green-500 hover:text-green-600 transition-colors"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingName(null);
                                      }}
                                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-foreground truncate">
                                      {set.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                      {set.images.length}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full ${
                                      set.status === "published"
                                        ? "bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30"
                                        : set.status === "scheduled"
                                          ? "bg-[var(--color-brand-blue)]/20 text-[var(--color-brand-blue)] border border-[var(--color-brand-blue)]/30"
                                          : "bg-muted text-muted-foreground border border-border"
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
                                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSet(set.id);
                                  }}
                                  className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  // Normal view - single profile
                  sets.map((set) => (
                  <div
                    key={set.id}
                    className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                      selectedSet?.id === set.id
                        ? "bg-[var(--color-brand-mid-pink)]/10 border border-[var(--color-brand-mid-pink)]/40"
                        : "bg-muted/50 hover:bg-muted border border-transparent hover:border-border"
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
                              className="flex-1 px-2 py-1 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)] focus:border-transparent"
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
                              className="p-1 text-green-500 hover:text-green-600 transition-colors"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingName(null);
                              }}
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground truncate">
                              {set.name}
                            </span>
                            <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {set.images.length}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              set.status === "published"
                                ? "bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30"
                                : set.status === "scheduled"
                                  ? "bg-[var(--color-brand-blue)]/20 text-[var(--color-brand-blue)] border border-[var(--color-brand-blue)]/30"
                                  : "bg-muted text-muted-foreground border border-border"
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
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSet(set.id);
                          }}
                          className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Image organizer area */}
        <div className="lg:col-span-2">
          {selectedSet ? (
            <div
              className={`bg-card border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 ${
                isDraggingFile ? "border-[var(--color-brand-mid-pink)] ring-2 ring-[var(--color-brand-mid-pink)]/30" : "border-border"
              }`}
              onDragOver={handleFileDragOver}
              onDragLeave={handleFileDragLeave}
              onDrop={handleFileDrop}
            >
              {/* Header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground text-lg">
                        {selectedSet.name}
                      </h3>
                      {/* Profile badge when viewing All Profiles */}
                      {isAllProfiles && selectedSet.profileName && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-brand-mid-pink)]/10 text-[var(--color-brand-mid-pink)] border border-[var(--color-brand-mid-pink)]/30">
                          {selectedSet.profileName}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedSet.images.length} item
                      {selectedSet.images.length !== 1 ? "s" : ""}
                      {savingOrder && (
                        <span className="ml-2 text-[var(--color-brand-mid-pink)]">• Saving...</span>
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
                    
                    {/* Upload Progress - shown outside dropdown */}
                    {uploading && uploadProgress && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand-mid-pink)]/10 border border-[var(--color-brand-mid-pink)]/30 rounded-xl">
                        <Loader2 className="w-4 h-4 text-[var(--color-brand-mid-pink)] animate-spin" />
                        <span className="text-sm text-foreground">
                          Uploading {uploadProgress.current}/{uploadProgress.total}
                        </span>
                      </div>
                    )}
                    
                    {/* Save to Vault button - always visible when there are images */}
                    {selectedSet.images.length > 0 && (
                      <button
                        onClick={openExportModal}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 active:scale-95 text-white rounded-xl font-medium transition-all duration-200 shadow-lg"
                      >
                        <FolderOutput className="w-4 h-4" />
                        <span className="hidden sm:inline">Save to Vault</span>
                        <span className="sm:hidden">Save</span>
                      </button>
                    )}
                    
                    {/* More actions dropdown */}
                    <div className="relative">
                      <button
                        ref={actionsButtonRef}
                        onClick={() => setShowActionsMenu(!showActionsMenu)}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] bg-muted hover:bg-muted/80 active:scale-95 border border-border text-foreground rounded-xl font-medium transition-all duration-200"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">Actions</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showActionsMenu ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {/* Actions dropdown portal */}
                      {showActionsMenu && mounted && actionsMenuPosition && createPortal(
                        <div 
                          ref={actionsMenuRef}
                          className="fixed w-56 bg-card border border-border rounded-xl shadow-xl z-[9999] py-2 overflow-hidden"
                          style={{
                            top: actionsMenuPosition.top,
                            left: actionsMenuPosition.left,
                          }}
                        >
                          <button
                            onClick={() => { fileInputRef.current?.click(); setShowActionsMenu(false); }}
                            disabled={uploading}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Upload className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                            <span>Upload Files</span>
                          </button>
                          <div className="border-t border-border my-2" />
                          <button
                            onClick={() => { openImportModal(); setShowActionsMenu(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-foreground hover:bg-muted transition-colors"
                          >
                            <FolderInput className="w-4 h-4 text-emerald-500" />
                            <span>Import from Vault</span>
                          </button>
                          <button
                            onClick={() => { openGoogleDriveModal(); setShowActionsMenu(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-foreground hover:bg-muted transition-colors"
                          >
                            <HardDrive className="w-4 h-4 text-[var(--color-brand-blue)]" />
                            <span>Import from Google Drive</span>
                          </button>
                          <div className="border-t border-border my-2" />
                          <button
                            onClick={() => { setShowKeycardModal(true); setShowActionsMenu(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-foreground hover:bg-muted transition-colors"
                          >
                            <FileText className="w-4 h-4 text-indigo-500" />
                            <span>Generate Keycard</span>
                          </button>
                          <button
                            onClick={() => { setShowVoiceModal(true); setShowActionsMenu(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-foreground hover:bg-muted transition-colors"
                          >
                            <Mic className="w-4 h-4 text-violet-500" />
                            <span>Generate Voice</span>
                          </button>
                        </div>,
                        document.body
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Images grid */}
              <div className="p-4">
                {selectedSet.images.length === 0 ? (
                  <div
                    className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
                      isDraggingFile
                        ? "border-[var(--color-brand-mid-pink)] bg-[var(--color-brand-mid-pink)]/10"
                        : "border-border hover:border-[var(--color-brand-mid-pink)]/50"
                    }`}
                  >
                    <Upload
                      className={`w-12 h-12 mx-auto mb-4 ${
                        isDraggingFile ? "text-[var(--color-brand-mid-pink)]" : "text-muted-foreground"
                      }`}
                    />
                    <p
                      className={`font-medium ${
                        isDraggingFile ? "text-[var(--color-brand-mid-pink)]" : "text-muted-foreground"
                      }`}
                    >
                      {isDraggingFile
                        ? "Drop your files here!"
                        : "Drop images or videos here"}
                    </p>
                    <p className="text-muted-foreground text-sm mt-2">
                      or click upload to browse
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {selectedSet.images.map((image, index) => {
                      const isHovered = hoveredImageId === image.id;
                      const isDragging = draggedIndex === index;
                      const isDropTarget = dragOverIndex === index;
                      const touchOffsetValue = touchOffset?.id === image.id ? touchOffset.offset : 0;

                      return (
                        <div
                          key={image.id}
                          draggable={!isMobile}
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          onClick={() => !isMobile && openImageDetail(image)}
                          onMouseEnter={() => !isMobile && setHoveredImageId(image.id)}
                          onMouseLeave={() => !isMobile && setHoveredImageId(null)}
                          onTouchStart={(e) => handleTouchStart(e, image.id)}
                          onTouchMove={(e) => handleTouchMove(e, image.id)}
                          onTouchEnd={() => handleTouchEnd(image.id)}
                          className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                            isMobile ? 'active:scale-95' : 'cursor-grab active:cursor-grabbing'
                          } ${
                            isDragging
                              ? "opacity-30 scale-95 border-[var(--color-brand-mid-pink)] shadow-xl"
                              : isDropTarget
                                ? "border-[var(--color-brand-mid-pink)] ring-4 ring-[var(--color-brand-mid-pink)]/30 scale-105 shadow-xl"
                                : isHovered
                                  ? "border-[var(--color-brand-mid-pink)]/50 scale-[1.02]"
                                  : "border-transparent hover:border-[var(--color-brand-mid-pink)]/30"
                          }`}
                          style={{
                            transform: isMobile ? `translateX(${touchOffsetValue}px)` : undefined,
                            transition: touchOffsetValue !== 0 ? 'none' : undefined,
                          }}
                        >
                          {/* Visual drag preview indicator */}
                          {isDragging && (
                            <div className="absolute inset-0 bg-[var(--color-brand-mid-pink)]/10 backdrop-blur-sm flex items-center justify-center z-20">
                              <div className="bg-[var(--color-brand-mid-pink)] rounded-full p-3 shadow-xl">
                                <Move className="w-6 h-6 text-white" />
                              </div>
                            </div>
                          )}

                          {/* Drop target indicator */}
                          {isDropTarget && !isDragging && (
                            <div className="absolute inset-0 border-4 border-dashed border-[var(--color-brand-mid-pink)] rounded-xl pointer-events-none z-10 animate-pulse" />
                          )}

                          {/* Swipe delete indicator (mobile) */}
                          {isMobile && touchOffsetValue < -50 && (
                            <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center">
                              <Trash2 className="w-6 h-6 text-white" />
                            </div>
                          )}

                          {/* Sequence badge */}
                          <div className={`absolute top-2 left-2 z-10 w-7 h-7 bg-gradient-to-br from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] rounded-lg flex items-center justify-center shadow-lg transition-transform ${
                            isHovered ? 'scale-110' : ''
                          }`}>
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
                            <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 dark:from-violet-900/50 dark:to-fuchsia-900/50 flex flex-col items-center justify-center p-3">
                              <Music className="w-10 h-10 text-violet-500 mb-2" />
                              <audio
                                src={image.url}
                                controls
                                className="w-full h-8"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-xs text-muted-foreground mt-2 truncate max-w-full">
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

                          {/* Hover overlay with quick actions */}
                          <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-200 ${
                            isHovered || isMobile ? 'opacity-100' : 'opacity-0'
                          }`}>
                            {/* Top action buttons */}
                            <div className="absolute top-2 right-2 flex gap-1">
                              {/* Drag handle - desktop only */}
                              {!isMobile && (
                                <div className={`p-2 bg-black/70 hover:bg-[var(--color-brand-mid-pink)]/80 rounded-lg backdrop-blur-sm transition-all cursor-grab active:cursor-grabbing ${
                                  isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                                }`}
                                  title="Drag to reorder"
                                  style={{ transitionDelay: '0ms' }}
                                >
                                  <GripVertical className="w-4 h-4 text-white" />
                                </div>
                              )}

                              {/* Quick delete */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteImage(selectedSet.id, image.id);
                                }}
                                className={`p-2 bg-black/70 hover:bg-red-500/80 rounded-lg backdrop-blur-sm transition-all ${
                                  isHovered || isMobile ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                                }`}
                                title="Delete"
                                style={{ transitionDelay: isMobile ? '0ms' : '50ms' }}
                              >
                                <Trash2 className="w-4 h-4 text-white" />
                              </button>
                            </div>

                            {/* Bottom info bar */}
                            <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {isVideo(image.type) ? (
                                  <Video className="w-4 h-4 text-[var(--color-brand-blue)]" />
                                ) : isAudio(image.type) ? (
                                  <Volume2 className="w-4 h-4 text-violet-500" />
                                ) : (
                                  <ImageIcon className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                                )}
                                <span className="text-xs text-white/90 font-medium">
                                  {formatFileSize(image.size)}
                                </span>
                              </div>
                              {isMobile && (
                                <span className="text-xs text-white/70">
                                  Swipe left to delete
                                </span>
                              )}
                            </div>

                            {/* File name on hover */}
                            <div className="absolute bottom-12 left-2 right-2">
                              <p className="text-xs text-white/90 font-medium truncate bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
                                {image.name}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
              <Sparkles className="w-16 h-16 text-[var(--color-brand-mid-pink)]/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Select a Set
              </h3>
              <p className="text-muted-foreground mb-6">
                Choose a set from the sidebar to organize your content
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] hover:from-[var(--color-brand-light-pink)] hover:to-[var(--color-brand-mid-pink)] text-white rounded-xl font-medium shadow-lg transition-all duration-200"
              >
                <FolderPlus className="w-5 h-5" />
                Create New Set
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal - React Portal */}
      {showCreateModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => {
              setShowCreateModal(false);
              setNewSetName("");
            }}
          >
            <div 
              className="bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] rounded-xl">
                    <FolderPlus className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Create New Set
                  </h3>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Set Name
                  </label>
                  <input
                    type="text"
                    value={newSetName}
                    onChange={(e) => setNewSetName(e.target.value)}
                    placeholder="e.g., Valentine's Day Set"
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)] focus:border-transparent"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createSet();
                    }}
                  />
                </div>
              </div>

              <div className="p-6 border-t border-border flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewSetName("");
                  }}
                  className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createSet}
                  disabled={!newSetName.trim() || creating}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] hover:from-[var(--color-brand-light-pink)] hover:to-[var(--color-brand-mid-pink)] text-white rounded-xl font-medium shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => {
              if (!exporting) {
                setShowExportModal(false);
                setExportSuccess(null);
                setExportFolderName("");
              }
            }}
          >
            <div 
              className="bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                    <FolderOutput className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Save to Vault
                    </h3>
                    <p className="text-sm text-muted-foreground">
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
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h4 className="text-lg font-semibold text-foreground mb-2">
                      Export Complete!
                    </h4>
                    <p className="text-muted-foreground">
                      {exportSuccess.itemCount} item
                      {exportSuccess.itemCount !== 1 ? "s" : ""} exported to{" "}
                      <span className="text-purple-500">
                        {exportSuccess.folderName}
                      </span>
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Profile Selector - shown when viewing All Profiles */}
                    {isAllProfiles && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Save to Profile
                        </label>
                        {loadingProfiles ? (
                          <div className="flex items-center gap-2 px-4 py-3 bg-muted border border-border rounded-xl">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            <span className="text-muted-foreground">Loading profiles...</span>
                          </div>
                        ) : (
                          <select
                            value={selectedExportProfileId || ""}
                            onChange={(e) => setSelectedExportProfileId(e.target.value)}
                            className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="" disabled>Select a profile</option>
                            {profiles.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Choose which profile&apos;s vault to save to
                        </p>
                      </div>
                    )}
                    
                    {/* Folder Name */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Folder Name
                      </label>
                      <input
                        type="text"
                        value={exportFolderName}
                        onChange={(e) => setExportFolderName(e.target.value)}
                        placeholder="e.g., Valentine's Day Collection"
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        A new folder will be created in your Vault with this
                        name
                      </p>
                    </div>
                  </>
                )}
              </div>

              {!exportSuccess && (
                <div className="p-6 border-t border-border flex gap-3">
                  <button
                    onClick={() => {
                      setShowExportModal(false);
                      setExportFolderName("");
                    }}
                    className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={exportToVault}
                    disabled={
                      exporting ||
                      (isAllProfiles ? !selectedExportProfileId : !profileId) ||
                      !exportFolderName.trim()
                    }
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl font-medium shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

      {/* Import from Vault Modal - React Portal */}
      {showImportModal &&
        selectedSet &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              if (!importing) {
                setShowImportModal(false);
                setSelectedVaultFolderId(null);
                setSelectedVaultItems(new Set());
                setVaultItems([]);
                setImportSuccess(null);
              }
            }}
          >
            <div
              className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
                    <FolderInput className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Import from Vault
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Add images to "{selectedSet.name}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                {importSuccess ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h4 className="text-xl font-semibold text-foreground mb-2">
                      Import Successful!
                    </h4>
                    <p className="text-muted-foreground">
                      {importSuccess.itemCount} item
                      {importSuccess.itemCount !== 1 ? "s" : ""} imported to{" "}
                      "{selectedSet.name}"
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-6">
                    {/* Folder Selection */}
                    <div className="w-64 shrink-0">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Select Folder
                      </label>
                      {loadingVaultFolders ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : vaultFolders.filter(f => f.name !== 'All Media').length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No folders found</p>
                        </div>
                      ) : (
                        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2">
                          {vaultFolders.filter(f => f.name !== 'All Media').map((folder) => (
                            <button
                              key={folder.id}
                              onClick={() => handleVaultFolderSelect(folder.id)}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                                selectedVaultFolderId === folder.id
                                  ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-500"
                                  : "bg-muted/50 hover:bg-muted text-foreground border border-transparent"
                              }`}
                            >
                              <Folder className="w-4 h-4 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm">{folder.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {folder._count?.items || 0} items
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Items Grid */}
                    <div className="flex-1 min-w-0">
                      {selectedVaultFolderId ? (
                        <>  <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-foreground">
                              Select Items ({selectedVaultItems.size} selected)
                            </label>
                            {vaultItems.length > 0 && (
                              <button
                                onClick={selectAllVaultItems}
                                className="text-sm text-emerald-500 hover:text-emerald-600 transition-colors"
                              >
                                {selectedVaultItems.size === vaultItems.length
                                  ? "Deselect All"
                                  : "Select All"}
                              </button>
                            )}
                          </div>
                          {loadingVaultItems ? (
                            <div className="flex items-center justify-center py-12">
                              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                          ) : vaultItems.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                              <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No media files in this folder</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[350px] overflow-y-auto pr-2">
                              {vaultItems.map((item) => (
                                <div
                                  key={item.id}
                                  onClick={() => toggleVaultItemSelection(item.id)}
                                  className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                                    selectedVaultItems.has(item.id)
                                      ? "border-emerald-500 ring-2 ring-emerald-500/30"
                                      : "border-transparent hover:border-border"
                                  }`}
                                >
                                  {item.fileType.startsWith("video/") ? (
                                    <video
                                      src={item.awsS3Url}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : item.fileType.startsWith("audio/") ? (
                                    <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex flex-col items-center justify-center p-2">
                                      <Music className="w-8 h-8 text-violet-500 mb-1" />
                                      <p className="text-xs text-muted-foreground text-center truncate w-full px-1">
                                        {item.fileName}
                                      </p>
                                    </div>
                                  ) : (
                                    <img
                                      src={item.awsS3Url}
                                      alt={item.fileName}
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  {selectedVaultItems.has(item.id) && (
                                    <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                    </div>
                                  )}
                                  {item.fileType.startsWith("video/") && (
                                    <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1">
                                      <Video className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                  {item.fileType.startsWith("audio/") && (
                                    <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1">
                                      <Volume2 className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center">
                            <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Select a folder to view items</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {!importSuccess && (
                <div className="p-6 border-t border-border flex gap-3 shrink-0">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setSelectedVaultFolderId(null);
                      setSelectedVaultItems(new Set());
                      setVaultItems([]);
                    }}
                    disabled={importing}
                    className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={importFromVault}
                    disabled={importing || selectedVaultItems.size === 0}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-medium shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <FolderInput className="w-4 h-4" />
                        Import {selectedVaultItems.size} Item{selectedVaultItems.size !== 1 ? "s" : ""}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* Import from Google Drive Modal - React Portal */}
      {showGoogleDriveModal &&
        selectedSet &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              if (!importingFromGoogleDrive) {
                setShowGoogleDriveModal(false);
                setSelectedGoogleDriveFiles(new Set());
                setGoogleDriveFiles([]);
                setGoogleDriveImportSuccess(null);
                setGoogleDriveError(null);
              }
            }}
          >
            <div
              className="bg-card border border-border rounded-2xl w-full max-w-6xl max-h-[90vh] shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-[var(--color-brand-blue)] to-cyan-600 rounded-xl">
                    <HardDrive className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">
                      Import from Google Drive
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Add files to "{selectedSet.name}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                {googleDriveImportSuccess ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h4 className="text-xl font-semibold text-foreground mb-2">
                      Import Successful!
                    </h4>
                    <p className="text-muted-foreground">
                      {googleDriveImportSuccess.itemCount} file
                      {googleDriveImportSuccess.itemCount !== 1 ? "s" : ""} imported to{" "}
                      "{selectedSet.name}"
                    </p>
                  </div>
                ) : !googleDriveAccessToken ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-[var(--color-brand-blue)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <HardDrive className="w-10 h-10 text-[var(--color-brand-blue)]" />
                    </div>
                    <h4 className="text-xl font-semibold text-foreground mb-2">
                      Connect to Google Drive
                    </h4>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      To import files from Google Drive, you need to connect your account first.
                    </p>
                    <button
                      onClick={connectToGoogleDrive}
                      className="px-6 py-3 bg-gradient-to-r from-[var(--color-brand-blue)] to-cyan-500 hover:from-[var(--color-brand-blue)] hover:to-cyan-600 text-white rounded-xl font-medium shadow-lg transition-all duration-200 flex items-center gap-2 mx-auto"
                    >
                      <HardDrive className="w-5 h-5" />
                      Connect Google Drive
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {/* Link Input Section */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-foreground">
                        <Link className="w-5 h-5 text-[var(--color-brand-blue)]" />
                        <span className="font-medium">Paste a Google Drive folder link to browse</span>
                      </div>
                      <div className="flex gap-2 p-4 bg-muted/30 rounded-xl border border-border">
                        <div className="flex-1 relative">
                          <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Paste Google Drive folder link here..."
                            value={googleDriveLinkInput}
                            onChange={(e) => setGoogleDriveLinkInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && googleDriveLinkInput.trim()) {
                                browseGoogleDriveLink();
                              }
                            }}
                            className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-[var(--color-brand-blue)]/50 focus:ring-1 focus:ring-[var(--color-brand-blue)]/30 transition-all text-sm"
                          />
                        </div>
                        <button
                          onClick={browseGoogleDriveLink}
                          disabled={loadingGoogleDriveFiles || !googleDriveLinkInput.trim()}
                          className="px-5 py-2.5 bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/90 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Browse
                        </button>
                      </div>
                    </div>

                    {/* Breadcrumb Navigation */}
                    <div className="flex items-center gap-1 text-sm bg-muted/30 rounded-xl px-4 py-2.5 overflow-x-auto">
                      {googleDriveBreadcrumbs.map((crumb, index) => (
                        <div key={index} className="flex items-center">
                          {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />}
                          <button
                            onClick={() => navigateToBreadcrumb(index)}
                            className={`px-2 py-1 rounded-lg hover:bg-muted transition-colors truncate max-w-[180px] ${
                              index === googleDriveBreadcrumbs.length - 1
                                ? "text-[var(--color-brand-blue)] font-medium bg-[var(--color-brand-blue)]/10"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {crumb.name}
                          </button>
                        </div>
                      ))}
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          onClick={() => fetchGoogleDriveContents(currentGoogleDriveFolderId)}
                          disabled={loadingGoogleDriveFiles}
                          className="p-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-lg transition-all"
                          title="Refresh"
                        >
                          <RefreshCw className={`w-4 h-4 ${loadingGoogleDriveFiles ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => {
                            setGoogleDriveAccessToken(null);
                            localStorage.removeItem('googleDriveAccessToken');
                            setGoogleDriveFiles([]);
                            setGoogleDriveFolders([]);
                            setGoogleDriveBreadcrumbs([{ id: null, name: 'My Drive' }]);
                            setGoogleDriveLinkInput('');
                            setGoogleDriveError(null);
                          }}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all"
                          title="Sign out of Google Drive"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {googleDriveError && (
                      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">{googleDriveError.includes("permission") || googleDriveError.includes("access") ? "Access Denied" : "Error"}</p>
                          <p className="text-red-500/80 mt-1">{googleDriveError}</p>
                        </div>
                      </div>
                    )}

                    {/* Content Area */}
                    {loadingGoogleDriveFiles ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : googleDriveFolders.length === 0 && googleDriveFiles.length === 0 && !googleDriveError ? (
                      <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-xl border border-border">
                        <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-base font-medium">This folder is empty</p>
                        <p className="text-sm mt-1">
                          {googleDriveBreadcrumbs.length > 1 
                            ? "Go back or paste a different folder link"
                            : "Paste a folder link above to browse its contents"}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {/* Folders */}
                        {googleDriveFolders.length > 0 && (
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-3">
                              📁 Folders ({googleDriveFolders.length})
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[200px] overflow-y-auto pr-2">
                              {googleDriveFolders.map((folder) => (
                                <button
                                  key={folder.id}
                                  onClick={() => {
                                    setIsGoogleDriveSearchMode(false);
                                    navigateToGoogleDriveFolder(folder);
                                  }}
                                  className="flex items-center gap-3 px-4 py-3 bg-muted/50 hover:bg-muted rounded-xl text-left transition-all border border-border hover:border-[var(--color-brand-blue)]/30 group"
                                >
                                  <div className="p-2 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20 transition-colors">
                                    <Folder className="w-5 h-5 text-yellow-500" />
                                  </div>
                                  <span className="text-sm text-foreground truncate flex-1">{folder.name}</span>
                                  {folder.shared && (
                                    <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Files */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-foreground">
                              🖼️ Media Files ({googleDriveFiles.length})
                              {selectedGoogleDriveFiles.size > 0 && (
                                <span className="ml-2 px-2 py-0.5 bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)] rounded-full text-xs border border-[var(--color-brand-blue)]/30">
                                  {selectedGoogleDriveFiles.size} selected
                                </span>
                              )}
                            </label>
                            {googleDriveFiles.length > 0 && (
                              <button
                                onClick={selectAllGoogleDriveFiles}
                                className="text-sm text-[var(--color-brand-blue)] hover:text-[var(--color-brand-blue)]/80 px-3 py-1 rounded-lg hover:bg-[var(--color-brand-blue)]/10 transition-colors"
                              >
                                {selectedGoogleDriveFiles.size === googleDriveFiles.length
                                  ? "Deselect All"
                                  : "Select All"}
                              </button>
                            )}
                          </div>

                          {googleDriveFiles.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-xl">
                              <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              <p className="text-base">No media files found</p>
                              <p className="text-sm mt-1">
                                {isGoogleDriveSearchMode 
                                  ? "Try a different search term" 
                                  : "Browse into folders or search to find images, videos, and audio files"}
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-[320px] overflow-y-auto pr-2">
                              {googleDriveFiles.map((file) => (
                                <div
                                  key={file.id}
                                  onClick={() => toggleGoogleDriveFileSelection(file.id)}
                                  className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                                    selectedGoogleDriveFiles.has(file.id)
                                      ? "border-[var(--color-brand-blue)] ring-2 ring-[var(--color-brand-blue)]/30"
                                      : "border-transparent hover:border-border"
                                  }`}
                                >
                                  {file.mimeType?.startsWith("video/") ? (
                                    file.thumbnailLink ? (
                                      <img
                                        src={file.thumbnailLink}
                                        alt={file.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-gradient-to-br from-muted to-muted/80 flex flex-col items-center justify-center p-2">
                                        <Video className="w-8 h-8 text-muted-foreground mb-1" />
                                        <p className="text-xs text-muted-foreground text-center truncate w-full px-1">
                                          {file.name}
                                        </p>
                                      </div>
                                    )
                                  ) : file.mimeType?.startsWith("audio/") ? (
                                    <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex flex-col items-center justify-center p-2">
                                      <Music className="w-8 h-8 text-violet-500 mb-1" />
                                      <p className="text-xs text-muted-foreground text-center truncate w-full px-1">
                                        {file.name}
                                      </p>
                                    </div>
                                  ) : file.thumbnailLink ? (
                                    <img
                                      src={file.thumbnailLink}
                                      alt={file.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-muted to-muted/80 flex flex-col items-center justify-center p-2">
                                      <ImageIcon className="w-8 h-8 text-muted-foreground mb-1" />
                                      <p className="text-xs text-muted-foreground text-center truncate w-full px-1">
                                        {file.name}
                                      </p>
                                    </div>
                                  )}
                                  {selectedGoogleDriveFiles.has(file.id) && (
                                    <div className="absolute inset-0 bg-[var(--color-brand-blue)]/20 flex items-center justify-center">
                                      <CheckCircle2 className="w-6 h-6 text-[var(--color-brand-blue)]" />
                                    </div>
                                  )}
                                  {file.mimeType?.startsWith("video/") && (
                                    <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1">
                                      <Video className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                  {file.mimeType?.startsWith("audio/") && (
                                    <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1">
                                      <Volume2 className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!googleDriveImportSuccess && googleDriveAccessToken && (
                <div className="p-6 border-t border-gray-700 flex gap-3 shrink-0">
                  <button
                    onClick={() => {
                      setShowGoogleDriveModal(false);
                      setSelectedGoogleDriveFiles(new Set());
                      setGoogleDriveFiles([]);
                      setGoogleDriveError(null);
                    }}
                    disabled={importingFromGoogleDrive}
                    className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={importFromGoogleDrive}
                    disabled={importingFromGoogleDrive || selectedGoogleDriveFiles.size === 0}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium shadow-lg shadow-blue-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {importingFromGoogleDrive ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <HardDrive className="w-4 h-4" />
                        Import {selectedGoogleDriveFiles.size} File{selectedGoogleDriveFiles.size !== 1 ? "s" : ""}
                      </>
                    )}
                  </button>
                </div>
              )}

              {!googleDriveAccessToken && (
                <div className="p-6 border-t border-gray-700 shrink-0">
                  <button
                    onClick={() => setShowGoogleDriveModal(false)}
                    className="w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                  >
                    Close
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
              className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-bold">
                      {selectedImageForDetail.sequence}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Image Details</h3>
                    <p className="text-xs text-muted-foreground">Click on filename to edit</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowImageDetailModal(false);
                    setSelectedImageForDetail(null);
                    setEditingImageId(null);
                    setEditingImageName("");
                  }}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
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
                    <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 dark:from-violet-900/50 dark:to-fuchsia-900/50 flex flex-col items-center justify-center p-6">
                      <Music className="w-20 h-20 text-violet-500 mb-4" />
                      <audio
                        src={selectedImageForDetail.url}
                        controls
                        className="w-full max-w-md"
                      />
                      <span className="text-sm text-foreground mt-4">{selectedImageForDetail.name}</span>
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
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Filename
                    </label>
                    {editingImageId === selectedImageForDetail.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingImageName}
                          onChange={(e) => setEditingImageName(e.target.value)}
                          className="flex-1 px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)] focus:border-transparent"
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
                          className="px-4 py-2.5 bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] hover:from-[var(--color-brand-light-pink)] hover:to-[var(--color-brand-mid-pink)] text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                          className="px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium transition-colors"
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
                        className="px-4 py-2.5 bg-muted border border-border rounded-xl text-foreground cursor-pointer hover:border-[var(--color-brand-mid-pink)]/50 transition-colors flex items-center justify-between group"
                      >
                        <span className="truncate">{selectedImageForDetail.name}</span>
                        <Edit3 className="w-4 h-4 text-muted-foreground group-hover:text-[var(--color-brand-mid-pink)] transition-colors" />
                      </div>
                    )}
                  </div>

                  {/* Sequence */}
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Sequence
                    </label>
                    <div className="px-4 py-2.5 bg-muted border border-border rounded-xl text-foreground">
                      #{selectedImageForDetail.sequence}
                    </div>
                  </div>

                  {/* Size */}
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      File Size
                    </label>
                    <div className="px-4 py-2.5 bg-muted border border-border rounded-xl text-foreground">
                      {formatFileSize(selectedImageForDetail.size)}
                    </div>
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Type
                    </label>
                    <div className="px-4 py-2.5 bg-muted border border-border rounded-xl text-foreground flex items-center gap-2">
                      {isVideo(selectedImageForDetail.type) ? (
                        <>
                          <Video className="w-4 h-4 text-[var(--color-brand-blue)]" />
                          Video
                        </>
                      ) : isAudio(selectedImageForDetail.type) ? (
                        <>
                          <Volume2 className="w-4 h-4 text-violet-500" />
                          Audio
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                          Image
                        </>
                      )}
                    </div>
                  </div>

                  {/* Uploaded Date */}
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Uploaded
                    </label>
                    <div className="px-4 py-2.5 bg-muted border border-border rounded-xl text-foreground">
                      {new Date(selectedImageForDetail.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-border flex justify-between">
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this image?")) {
                      deleteImage(selectedSet.id, selectedImageForDetail.id);
                      setShowImageDetailModal(false);
                      setSelectedImageForDetail(null);
                    }
                  }}
                  className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <a
                  href={selectedImageForDetail.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Open Original
                </a>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Keycard Generator Modal - React Portal */}
      {showKeycardModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowKeycardModal(false)}
          >
            <div 
              className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 p-4 border-b border-border bg-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Keycard Generator</h3>
                    <p className="text-xs text-muted-foreground">Create custom keycards for your set</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowKeycardModal(false)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                <KeycardGenerator
                  profileId={profileId}
                  hasSelectedSet={!!selectedSet}
                  directSaveMode={true}
                  onSaveToSet={selectedSet ? async (blob, filename) => {
                    // Convert blob to File and upload
                    const file = new File([blob], filename, { type: "image/png" });
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    await handleFileUpload(dataTransfer.files);
                  } : undefined}
                  onSaveComplete={() => {
                    // Close modal after saving
                    setShowKeycardModal(false);
                  }}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Voice Generator Modal - React Portal */}
      {showVoiceModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowVoiceModal(false)}
          >
            <div 
              className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 p-4 border-b border-border bg-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl">
                    <Mic className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Voice Generator</h3>
                    <p className="text-xs text-muted-foreground">Generate AI voice notes for your set</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowVoiceModal(false)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                <EmbeddedVoiceGenerator
                  setId={selectedSet?.id || null}
                  onSaveToSet={selectedSet ? async (audioBlob, filename, thumbnailBlob, thumbnailFilename) => {
                    // Upload the thumbnail first (it will display as the visual in the grid)
                    if (thumbnailBlob && thumbnailFilename) {
                      const thumbnailFile = new File([thumbnailBlob], thumbnailFilename, { type: "image/png" });
                      const thumbnailTransfer = new DataTransfer();
                      thumbnailTransfer.items.add(thumbnailFile);
                      await handleFileUpload(thumbnailTransfer.files, selectedSet.id);
                    }
                    
                    // Then upload the audio file
                    const audioFile = new File([audioBlob], filename, { type: audioBlob.type });
                    const audioTransfer = new DataTransfer();
                    audioTransfer.items.add(audioFile);
                    await handleFileUpload(audioTransfer.files, selectedSet.id);
                  } : undefined}
                  onSaveComplete={() => {
                    // Refresh to show the saved audio and close modal
                    fetchSets(profileId);
                    setShowVoiceModal(false);
                  }}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Toast Notification - React Portal */}
      {toast &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed top-4 right-4 z-[60] animate-in slide-in-from-top-2 duration-300">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-sm border max-w-md ${
              toast.type === 'success' ? 'bg-green-500/90 border-green-400/50 text-white' :
              toast.type === 'error' ? 'bg-red-500/90 border-red-400/50 text-white' :
              'bg-blue-500/90 border-blue-400/50 text-white'
            }`}>
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
              {toast.type === 'error' && <XCircle className="w-5 h-5 shrink-0" />}
              {toast.type === 'info' && <Info className="w-5 h-5 shrink-0" />}
              <p className="text-sm font-medium">{toast.message}</p>
              <button
                onClick={() => setToast(null)}
                className="ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>,
          document.body,
        )}

      {/* Confirmation Modal - React Portal */}
      {confirmModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          >
            <div 
              className="bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-200"
            >
              <div className="p-6 border-b border-border">
                <h3 className="text-xl font-bold text-foreground">{confirmModal.title}</h3>
              </div>

              <div className="p-6">
                <p className="text-foreground">{confirmModal.message}</p>
              </div>

              <div className="p-6 border-t border-border flex gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    confirmModal.confirmAction();
                    setConfirmModal(null);
                  }}
                  className={`flex-1 px-4 py-2.5 text-white rounded-xl font-medium transition-all duration-200 shadow-lg ${
                    confirmModal.isDangerous
                      ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                      : 'bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] hover:from-[var(--color-brand-light-pink)] hover:to-[var(--color-brand-mid-pink)]'
                  }`}
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Prominent Saving Order Indicator */}
      {savingOrder && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] text-white rounded-full shadow-2xl">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-medium">Saving order...</span>
          </div>
        </div>
      )}

      {/* Mobile FAB - Quick Upload (only on mobile when set is selected) */}
      {isMobile && selectedSet && (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-dark-pink)] hover:from-[var(--color-brand-light-pink)] hover:to-[var(--color-brand-mid-pink)] active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-200"
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Upload className="w-6 h-6" />
          )}
        </button>
      )}
    </div>
  );
}
