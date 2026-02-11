"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { format, addDays } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ImageIcon,
  Plus,
  Edit,
  Trash2,
  Upload,
  X,
  Hash,
  MapPin,
  Users,
  User,
  Lightbulb,
  CheckCircle,
  Circle,
  Images,
  Loader2,
  Video as VideoIcon,
  XCircle,
  FolderOpen,
} from "lucide-react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";

interface FeedPostPlannerViewProps {
  profileId?: string | null;
}

interface FeedPostSlot {
  id: string;
  date: Date;
  timeSlot: Date | null;
  postType: string;
  caption?: string;
  hashtags?: string[];
  location?: string;
  collaborators?: string[];
  notes?: string;
  files?: Array<{
    awsS3Key: string;
    awsS3Url: string;
    fileName: string;
    mimeType: string;
  }>;
  isPosted?: boolean;
  postedAt?: Date;
  profileId?: string;
  profileName?: string;
}

interface Profile {
  id: string;
  name: string;
}

const POST_TYPES = [
  { value: "SINGLE_IMAGE", label: "Single Image", emoji: "📸" },
  { value: "CAROUSEL", label: "Carousel", emoji: "🎠" },
  { value: "VIDEO", label: "Video", emoji: "🎬" },
  { value: "ALBUM", label: "Photo Album", emoji: "📚" },
];

export default function FeedPostPlannerView({ profileId }: FeedPostPlannerViewProps) {
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(() => {
    const dateParam = searchParams.get("date");
    if (dateParam) {
      const parsedDate = new Date(dateParam + "T00:00:00");
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
    return new Date();
  });
  const [feedPostSlots, setFeedPostSlots] = useState<FeedPostSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<FeedPostSlot | null>(null);
  const [formData, setFormData] = useState({
    postType: "SINGLE_IMAGE",
    caption: "",
    location: "",
    notes: "",
  });
  const [timeInput, setTimeInput] = useState({
    hour: "12",
    minute: "00",
    period: "PM",
  });
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadPreviewUrls, setUploadPreviewUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [collaboratorInput, setCollaboratorInput] = useState("");
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [uploadMode, setUploadMode] = useState<"upload" | "vault">("upload");
  const [vaultItems, setVaultItems] = useState<any[]>([]);
  const [selectedVaultItems, setSelectedVaultItems] = useState<any[]>([]);
  const [loadingVault, setLoadingVault] = useState(false);
  const [vaultFolders, setVaultFolders] = useState<any[]>([]);
  const [selectedVaultFolder, setSelectedVaultFolder] = useState<string>("");
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [captionMode, setCaptionMode] = useState<"custom" | "bank">("custom");
  const [availableCaptions, setAvailableCaptions] = useState<any[]>([]);
  const [loadingCaptions, setLoadingCaptions] = useState(false);
  const [captionSearchQuery, setCaptionSearchQuery] = useState("");
  const [captionCategoryFilter, setCaptionCategoryFilter] = useState("All");
  const [captionTypeFilter, setCaptionTypeFilter] = useState("All");
  const [captionBankFilter, setCaptionBankFilter] = useState("All");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");

  const isAllProfiles = profileId === "all";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isAllProfiles) {
      fetchProfiles();
    }
  }, [profileId]);

  useEffect(() => {
    fetchFeedPostSlots();
  }, [selectedDate, profileId]);

  const fetchProfiles = async () => {
    try {
      const response = await fetch("/api/instagram/profiles");
      if (response.ok) {
        const data = await response.json();
        // API returns { success: true, profiles: [...] }
        if (data.profiles && Array.isArray(data.profiles)) {
          setProfiles(data.profiles);
        } else if (Array.isArray(data)) {
          setProfiles(data);
        }
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  const fetchFeedPostSlots = async () => {
    try {
      setLoading(true);
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const params = new URLSearchParams({
        startDate: dateStr,
        endDate: dateStr,
      });
      
      if (profileId && profileId !== "all") {
        params.append("profileId", profileId);
      }
      
      const response = await fetch(
        `/api/instagram/feed-post-slots?${params}`
      );
      const data = await response.json();
      if (data.slots) {
        setFeedPostSlots(
          data.slots.map((slot: any) => ({
            ...slot,
            date: new Date(slot.date),
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching feed post slots:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevDay = () => {
    setSelectedDate((prev) => addDays(prev, -1));
  };

  const handleNextDay = () => {
    setSelectedDate((prev) => addDays(prev, 1));
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const openCreateModal = () => {
    setEditingSlot(null);
    setFormData({
      postType: "SINGLE_IMAGE",
      caption: "",
      location: "",
      notes: "",
    });
    setTimeInput({
      hour: "12",
      minute: "00",
      period: "PM",
    });
    setHashtags([]);
    setHashtagInput("");
    setCollaborators([]);
    setCollaboratorInput("");
    clearAllFiles();
    setUploadMode("upload");
    setSelectedVaultItems([]);
    setSelectedVaultFolder("");
    setCaptionMode("custom");
    setCaptionSearchQuery("");
    setCaptionCategoryFilter("All");
    setCaptionTypeFilter("All");
    setCaptionBankFilter("All");
    setSelectedProfileId("");
    setShowModal(true);
    
    // Fetch vault and captions based on mode
    if (isAllProfiles) {
      // In All Profiles mode, fetch all vault items and captions
      fetchVaultFolders();
      fetchVaultItems();
      fetchCaptionsBank();
    } else if (profileId) {
      fetchVaultFolders(profileId);
      fetchVaultItems(undefined, profileId);
      fetchCaptionsBank(profileId);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/quicktime",
      "video/webm",
    ];
    
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));
    if (invalidFiles.length > 0) {
      alert("Please select valid image or video files (JPEG, PNG, GIF, WebP, MP4, MOV, WebM)");
      return;
    }

    const maxSize = 50 * 1024 * 1024;
    const oversizedFiles = files.filter(file => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      alert("Each file must be less than 50MB");
      return;
    }

    // Add new files to existing ones
    const newFiles = [...uploadedFiles, ...files];
    setUploadedFiles(newFiles);
    
    // Create preview URLs for new files
    const newPreviewUrls = files.map(file => URL.createObjectURL(file));
    setUploadPreviewUrls([...uploadPreviewUrls, ...newPreviewUrls]);
  };

  const handleRemoveFile = (index: number) => {
    // Revoke URL to prevent memory leak
    if (uploadPreviewUrls[index]) {
      URL.revokeObjectURL(uploadPreviewUrls[index]);
    }
    
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    uploadPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    setUploadedFiles([]);
    setUploadPreviewUrls([]);
  };

  const fetchVaultFolders = async (targetProfileId?: string) => {
    const effectiveProfileId = targetProfileId || (isAllProfiles ? undefined : profileId);
    
    try {
      setLoadingFolders(true);
      const params = new URLSearchParams();
      if (effectiveProfileId) {
        params.append("profileId", effectiveProfileId);
      }
      const response = await fetch(`/api/vault/folders?${params}`);
      
      if (!response.ok) {
        console.warn("Vault folders not available");
        setVaultFolders([]);
        return;
      }

      const data = await response.json();
      setVaultFolders(data);
    } catch (error) {
      console.error("Error loading vault folders:", error);
      setVaultFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  };

  const fetchVaultItems = async (folderId?: string, targetProfileId?: string) => {
    const effectiveProfileId = targetProfileId || (isAllProfiles ? undefined : profileId);
    
    try {
      setLoadingVault(true);
      const params = new URLSearchParams();
      if (effectiveProfileId) {
        params.append("profileId", effectiveProfileId);
      }
      if (folderId) {
        params.append("folderId", folderId);
      }
      const response = await fetch(`/api/vault/items?${params}`);
      
      if (!response.ok) {
        console.warn("Vault items not available");
        setVaultItems([]);
        return;
      }

      const data = await response.json();
      setVaultItems(data.map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      })));
    } catch (error) {
      console.error("Error loading vault items:", error);
      setVaultItems([]);
    } finally {
      setLoadingVault(false);
    }
  };

  const fetchCaptionsBank = async (targetProfileId?: string) => {
    const effectiveProfileId = targetProfileId || (isAllProfiles ? undefined : profileId);
    
    if (!effectiveProfileId && !isAllProfiles) return;

    try {
      setLoadingCaptions(true);
      
      if (isAllProfiles && !effectiveProfileId) {
        // Fetch captions for all profiles
        const allCaptions: any[] = [];
        if (Array.isArray(profiles) && profiles.length > 0) {
          for (const profile of profiles) {
            try {
              const response = await fetch(`/api/captions?profileId=${profile.id}`);
              if (response.ok) {
                const data = await response.json();
                // Add profileName to each caption
                const captionsWithProfile = data.map((caption: any) => ({
                  ...caption,
                  profileName: profile.name,
                }));
                allCaptions.push(...captionsWithProfile);
              }
            } catch (err) {
              console.error(`Error fetching captions for profile ${profile.id}:`, err);
            }
          }
        }
        setAvailableCaptions(allCaptions);
      } else {
        const response = await fetch(`/api/captions?profileId=${effectiveProfileId}`);
        
        if (!response.ok) {
          console.warn("Captions not available");
          setAvailableCaptions([]);
          return;
        }

        const data = await response.json();
        setAvailableCaptions(data);
      }
    } catch (error) {
      console.error("Error loading captions:", error);
      setAvailableCaptions([]);
    } finally {
      setLoadingCaptions(false);
    }
  };

  const handleSelectVaultItem = (item: any) => {
    // Toggle selection
    const isSelected = selectedVaultItems.some(i => i.id === item.id);
    if (isSelected) {
      setSelectedVaultItems(prev => prev.filter(i => i.id !== item.id));
    } else {
      setSelectedVaultItems(prev => [...prev, item]);
    }
  };

  const handleRemoveVaultItem = (itemId: string) => {
    setSelectedVaultItems(prev => prev.filter(i => i.id !== itemId));
  };

  const openEditModal = (slot: FeedPostSlot) => {
    setEditingSlot(slot);
    if (slot.timeSlot) {
      const timeDate = new Date(slot.timeSlot);
      let hours = timeDate.getHours();
      const minutes = timeDate.getMinutes();
      const period = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;

      setTimeInput({
        hour: String(hours),
        minute: String(minutes).padStart(2, "0"),
        period: period,
      });
    }

    setFormData({
      postType: slot.postType,
      caption: slot.caption || "",
      location: slot.location || "",
      notes: slot.notes || "",
    });
    setHashtags(slot.hashtags || []);
    setHashtagInput("");
    setCollaborators(slot.collaborators || []);
    setCollaboratorInput("");

    // Load existing files
    if (slot.files && slot.files.length > 0) {
      setUploadPreviewUrls(slot.files.map(f => f.awsS3Url));
    } else {
      setUploadPreviewUrls([]);
    }
    setUploadedFiles([]);
    setUploadMode("upload");
    setSelectedVaultItems([]);
    setSelectedVaultFolder("");
    setCaptionMode("custom");
    setCaptionSearchQuery("");
    setCaptionCategoryFilter("All");
    setCaptionTypeFilter("All");
    setCaptionBankFilter("All");
    // Set the profile for editing
    setSelectedProfileId(slot.profileId || "");
    setShowModal(true);
    
    // Fetch vault and captions for the slot's profile or all profiles
    const targetProfile = slot.profileId || (isAllProfiles ? undefined : profileId);
    if (isAllProfiles) {
      fetchVaultFolders();
      fetchVaultItems();
      fetchCaptionsBank();
    } else if (targetProfile) {
      fetchVaultFolders(targetProfile);
      fetchVaultItems(undefined, targetProfile);
      fetchCaptionsBank(targetProfile);
    }
  };

  const addHashtag = () => {
    const tag = hashtagInput.trim();
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag.startsWith("#") ? tag : `#${tag}`]);
      setHashtagInput("");
    }
  };

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter((h) => h !== tag));
  };

  const addCollaborator = () => {
    const collab = collaboratorInput.trim();
    if (collab && !collaborators.includes(collab)) {
      setCollaborators([...collaborators, collab.startsWith("@") ? collab : `@${collab}`]);
      setCollaboratorInput("");
    }
  };

  const removeCollaborator = (collab: string) => {
    setCollaborators(collaborators.filter((c) => c !== collab));
  };

  const handleSave = async () => {
    try {
      if (!timeInput.hour || !timeInput.minute || !timeInput.period) {
        alert("Please select a time for this feed post!");
        return;
      }

      // Require profile selection when in All Profiles mode
      if (isAllProfiles && !selectedProfileId) {
        alert("Please select a profile for this feed post!");
        return;
      }

      let hours = parseInt(timeInput.hour);
      if (timeInput.period === "PM" && hours !== 12) {
        hours += 12;
      } else if (timeInput.period === "AM" && hours === 12) {
        hours = 0;
      }

      const timeSlotDateTime = new Date(selectedDate);
      timeSlotDateTime.setHours(hours, parseInt(timeInput.minute), 0, 0);

      setLoading(true);
      setUploading(true);
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      let filesData: any[] = [];

      // If there are vault items selected, use them
      if (selectedVaultItems.length > 0) {
        filesData = selectedVaultItems.map(item => ({
          awsS3Key: item.awsS3Key,
          awsS3Url: item.awsS3Url,
          fileName: item.fileName,
          mimeType: item.fileType,
        }));
      }
      // Otherwise, upload new files if any - use direct S3 upload via presigned URLs
      else if (uploadedFiles.length > 0) {
        const targetProfileId = isAllProfiles ? selectedProfileId : profileId;
        
        // Step 1: Get presigned URLs for all files at once
        const presignedResponse = await fetch('/api/instagram/planner/get-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: targetProfileId,
            plannerType: 'feed-post',
            files: uploadedFiles.map(file => ({
              name: file.name,
              type: file.type,
              size: file.size,
            })),
          }),
        });

        if (!presignedResponse.ok) {
          const errorData = await presignedResponse.json();
          throw new Error(errorData.error || 'Failed to get upload URLs');
        }

        const { uploadUrls } = await presignedResponse.json();

        // Step 2: Upload each file directly to S3 using presigned URLs
        for (let i = 0; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i];
          const uploadInfo = uploadUrls[i];

          const s3UploadResponse = await fetch(uploadInfo.uploadUrl, {
            method: 'PUT',
            body: file,
            headers: {
              'Content-Type': file.type,
            },
          });

          if (!s3UploadResponse.ok) {
            throw new Error(`Failed to upload file ${file.name} to S3`);
          }

          console.log('✅ File uploaded directly to S3:', uploadInfo.finalUrl);

          filesData.push({
            awsS3Key: uploadInfo.key,
            awsS3Url: uploadInfo.finalUrl,
            fileName: uploadInfo.originalName,
            mimeType: file.type,
          });
        }
      }

      // If editing, preserve existing files that weren't removed
      if (editingSlot && editingSlot.files) {
        const existingFileUrls = uploadPreviewUrls.filter(url => 
          editingSlot.files?.some(f => f.awsS3Url === url)
        );
        const preservedFiles = editingSlot.files.filter(f => 
          existingFileUrls.includes(f.awsS3Url)
        );
        filesData = [...preservedFiles, ...filesData];
      }

      const requestData = {
        timeSlot: timeSlotDateTime.toISOString(),
        postType: formData.postType,
        caption: formData.caption,
        location: formData.location,
        notes: formData.notes,
        hashtags: hashtags,
        collaborators: collaborators,
        profileId: isAllProfiles ? selectedProfileId : profileId,
        files: filesData.length > 0 ? filesData : null,
      };

      if (editingSlot) {
        const response = await fetch(`/api/instagram/feed-post-slots/${editingSlot.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
        });

        if (!response.ok) throw new Error("Failed to update feed post");
      } else {
        const response = await fetch("/api/instagram/feed-post-slots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...requestData,
            date: dateStr,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          if (response.status === 409) {
            alert("A feed post is already planned for this time slot!");
            return;
          }
          throw new Error(error.error || "Failed to create feed post");
        }
      }

      setShowModal(false);
      clearAllFiles();
      fetchFeedPostSlots();
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('feedPostCreated'));
    } catch (error) {
      console.error("Error saving feed post:", error);
      alert("Failed to save feed post. Please try again.");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleDelete = async (slotId: string) => {
    if (!confirm("Are you sure you want to delete this feed post?")) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/instagram/feed-post-slots/${slotId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete feed post");

      fetchFeedPostSlots();
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('feedPostCreated'));
    } catch (error) {
      console.error("Error deleting feed post:", error);
      alert("Failed to delete feed post. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePosted = async (slotId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/instagram/feed-post-slots/${slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPosted: !currentStatus,
          postedAt: !currentStatus ? new Date().toISOString() : null,
        }),
      });

      if (!response.ok) throw new Error("Failed to update post status");

      setFeedPostSlots((prevSlots) =>
        prevSlots.map((slot) =>
          slot.id === slotId
            ? {
                ...slot,
                isPosted: !currentStatus,
                postedAt: !currentStatus ? new Date() : undefined,
              }
            : slot
        )
      );
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('feedPostCreated'));
    } catch (error) {
      console.error("Error updating post status:", error);
      alert("Failed to update post status. Please try again.");
    }
  };

  const sortedFeedPostSlots = [...feedPostSlots].sort((a, b) => {
    const timeA = a.timeSlot ? new Date(a.timeSlot).getTime() : 0;
    const timeB = b.timeSlot ? new Date(b.timeSlot).getTime() : 0;
    return timeA - timeB;
  });

  const getPostTypeLabel = (value: string) => {
    const type = POST_TYPES.find((t) => t.value === value);
    return type ? `${type.emoji} ${type.label}` : value;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Feed Post Planner
            {isAllProfiles && (
              <span className="ml-2 px-3 py-1 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 text-blue-400 rounded-full text-sm font-medium border border-blue-500/30 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                All Profiles
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Plan and schedule your Instagram feed posts
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={openCreateModal}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl transition-all shadow-lg shadow-blue-600/30 font-semibold flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Feed Post
        </motion.button>
      </div>

      {/* All Profiles Info Banner */}
      {isAllProfiles && (
        <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-blue-300">Viewing All Profiles</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Showing feed posts from all your profiles. When creating a new post, you&apos;ll need to select which profile to assign it to.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Date Navigator */}
      <div className="bg-card border-2 border-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevDay}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-4">
            <CalendarIcon className="w-5 h-5 text-blue-500" />
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {feedPostSlots.length} {feedPostSlots.length === 1 ? "post" : "posts"} planned
              </p>
            </div>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
            >
              Today
            </button>
          </div>

          <button
            onClick={handleNextDay}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Feed Posts Grid */}
      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-muted-foreground">Loading feed posts...</p>
        </div>
      ) : sortedFeedPostSlots.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
            <ImageIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No feed posts planned for this day
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Start planning your feed posts by clicking the button above
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedFeedPostSlots.map((slot) => (
            <motion.div
              key={slot.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              className="bg-card border-2 border-border rounded-2xl p-5 hover:border-[var(--color-brand-blue)]/30 transition-all shadow-xl hover:shadow-2xl"
            >
              {/* Profile Badge for All Profiles mode */}
              {isAllProfiles && slot.profileName && (
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 text-blue-300 rounded-full text-xs font-semibold border border-blue-500/30">
                    <User className="w-3 h-3" />
                    {slot.profileName}
                  </span>
                </div>
              )}

              {/* Time Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-border">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-600/20">
                    <CalendarIcon className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="font-bold text-white text-lg">
                    {slot.timeSlot ? format(new Date(slot.timeSlot), "h:mm a") : "No time set"}
                  </span>
                </div>
                
                {/* Posted Status Circle */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTogglePosted(slot.id, slot.isPosted || false);
                  }}
                  type="button"
                  className={`p-2 rounded-full transition-all ${
                    slot.isPosted
                      ? "bg-green-600/30 border-2 border-green-500"
                      : "bg-gray-600/20 border-2 border-gray-500/30 hover:border-green-500/50"
                  }`}
                  title={slot.isPosted ? "Mark as unposted" : "Mark as posted"}
                >
                  {slot.isPosted ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground" />
                  )}
                </motion.button>
              </div>

              {/* Slot Content */}
              <div className="space-y-4">
                <div className="bg-muted rounded-xl p-3 border border-blue-500/10">
                  <div className="text-xs font-bold text-blue-400 mb-1.5 uppercase tracking-wide">Post Type</div>
                  <div className="text-foreground font-semibold text-base">
                    {getPostTypeLabel(slot.postType)}
                  </div>
                </div>

                {slot.caption && (
                  <div className="bg-muted rounded-xl p-3 border border-cyan-500/10">
                    <div className="text-xs font-bold text-cyan-400 mb-1.5 uppercase tracking-wide">Caption</div>
                    <div className="text-foreground font-medium text-sm line-clamp-3">
                      {slot.caption}
                    </div>
                  </div>
                )}

                {slot.location && (
                  <div className="bg-muted rounded-xl p-3 border border-green-500/10">
                    <div className="text-xs font-bold text-green-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Location
                    </div>
                    <div className="text-foreground font-medium text-sm">
                      {slot.location}
                    </div>
                  </div>
                )}

                {slot.hashtags && slot.hashtags.length > 0 && (
                  <div className="bg-muted rounded-xl p-3 border border-purple-500/10">
                    <div className="text-xs font-bold text-purple-400 mb-1.5 uppercase tracking-wide">Hashtags</div>
                    <div className="flex flex-wrap gap-1">
                      {slot.hashtags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="text-xs px-2 py-1 bg-purple-600/20 text-purple-300 rounded-full border border-purple-500/30"
                        >
                          {tag}
                        </span>
                      ))}
                      {slot.hashtags.length > 3 && (
                        <span className="text-xs px-2 py-1 text-muted-foreground">+{slot.hashtags.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}

                {slot.collaborators && slot.collaborators.length > 0 && (
                  <div className="bg-muted rounded-xl p-3 border border-pink-500/10">
                    <div className="text-xs font-bold text-pink-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Collaborators
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {slot.collaborators.map((collab, index) => (
                        <span
                          key={index}
                          className="text-xs px-2 py-1 bg-pink-600/20 text-pink-300 rounded-full border border-pink-500/30"
                        >
                          {collab}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {slot.files && slot.files.length > 0 && (
                  <div className="bg-muted rounded-xl p-3 border border-blue-500/10">
                    <div className="text-xs font-bold text-blue-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                      <Images className="w-3 h-3" />
                      Media ({slot.files.length})
                    </div>
                    <div className={`grid gap-2 ${slot.files.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {slot.files.slice(0, 4).map((file, index) => (
                        file.mimeType?.startsWith("video/") ? (
                          <video key={index} src={file.awsS3Url} className="w-full h-24 object-contain bg-black rounded-lg" />
                        ) : (
                          <img key={index} src={file.awsS3Url} alt={`Preview ${index + 1}`} className="w-full h-24 object-contain bg-black rounded-lg" />
                        )
                      ))}
                    </div>
                    {slot.files.length > 4 && (
                      <p className="text-xs text-muted-foreground mt-2">+{slot.files.length - 4} more files</p>
                    )}
                  </div>
                )}

                {slot.notes && (
                  <div className="bg-muted rounded-xl p-3 border border-gray-500/10">
                    <div className="text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">Notes</div>
                    <div className="text-foreground font-medium text-sm line-clamp-2">
                      {slot.notes}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openEditModal(slot)}
                    className="flex-1 px-4 py-2.5 bg-muted hover:from-blue-600/20 hover:to-cyan-600/20 text-foreground rounded-xl transition-all text-sm flex items-center justify-center gap-2 font-semibold border border-border hover:border-blue-500/30"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDelete(slot.id)}
                    className="px-4 py-2.5 bg-gradient-to-r from-red-600/20 to-red-600/30 hover:from-red-600/30 hover:to-red-600/40 text-red-400 rounded-xl transition-all border border-red-500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      {mounted &&
        showModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div
              className="relative bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border-2 border-border"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative bg-gradient-to-r from-[var(--color-brand-blue)] to-cyan-600 p-5 text-white">
                <button
                  onClick={() => {
                    setShowModal(false);
                    clearAllFiles();
                  }}
                  className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{editingSlot ? "Edit Feed Post" : "Add Feed Post"}</h3>
                    <p className="text-sm text-white/80">{format(selectedDate, "MMMM d, yyyy")}</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 overflow-y-auto max-h-[calc(90vh-180px)] space-y-4">
                {/* Profile Selector for All Profiles Mode */}
                {isAllProfiles && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4 text-[var(--color-brand-blue)]" />
                      Select Profile <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={selectedProfileId}
                      onChange={(e) => {
                        setSelectedProfileId(e.target.value);
                        // Refresh vault and captions for selected profile
                        if (e.target.value) {
                          fetchVaultFolders(e.target.value);
                          fetchVaultItems(undefined, e.target.value);
                          fetchCaptionsBank(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-blue)]"
                    >
                      <option value="">-- Select a Profile --</option>
                      {Array.isArray(profiles) && profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          @{profile.name}
                        </option>
                      ))}
                    </select>
                    {!selectedProfileId && (
                      <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                        ⚠️ Profile selection is required when viewing All Profiles
                      </p>
                    )}
                  </div>
                )}

                {/* Time Picker */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-[var(--color-brand-blue)]" />
                    Posting Time
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={timeInput.hour}
                      onChange={(e) => setTimeInput({ ...timeInput, hour: e.target.value })}
                      className="px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-blue)]"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                        <option key={hour} value={hour}>{hour}</option>
                      ))}
                    </select>
                    <select
                      value={timeInput.minute}
                      onChange={(e) => setTimeInput({ ...timeInput, minute: e.target.value })}
                      className="px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-blue)]"
                    >
                      {["00", "15", "30", "45"].map((min) => (
                        <option key={min} value={min}>{min}</option>
                      ))}
                    </select>
                    <select
                      value={timeInput.period}
                      onChange={(e) => setTimeInput({ ...timeInput, period: e.target.value })}
                      className="px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-blue)]"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                {/* Post Type */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Post Type</label>
                  <select
                    value={formData.postType}
                    onChange={(e) => setFormData({ ...formData, postType: e.target.value })}
                    className="w-full px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-blue)]"
                  >
                    {POST_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.emoji} {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* File Upload */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[var(--color-brand-blue)]" />
                    Content Source
                  </label>
                  
                  {/* Mode Toggle */}
                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setUploadMode("upload")}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                        uploadMode === "upload"
                          ? "bg-gradient-to-r from-[var(--color-brand-blue)] to-cyan-500 text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      📤 Upload New
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadMode("vault");
                        const targetProfile = isAllProfiles ? selectedProfileId : profileId;
                        if (targetProfile) {
                          if (vaultFolders.length === 0) {
                            fetchVaultFolders(targetProfile);
                          }
                          if (vaultItems.length === 0) {
                            fetchVaultItems(undefined, targetProfile);
                          }
                        }
                      }}
                      disabled={!profileId || (isAllProfiles && !selectedProfileId)}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                        uploadMode === "vault"
                          ? "bg-gradient-to-r from-[var(--color-brand-blue)] to-cyan-500 text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
                      }`}
                    >
                      🗄️ From Vault
                    </button>
                  </div>

                  {uploadMode === "upload" ? (
                    <>
                      {/* Upload mode */}
                      {uploadPreviewUrls.length > 0 || selectedVaultItems.length > 0 ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            {/* Show selected vault items */}
                            {selectedVaultItems.map((item) => (
                              <div key={item.id} className="relative group">
                                {item.fileType.startsWith("video/") ? (
                                  <video src={item.awsS3Url} className="w-full h-32 object-contain bg-background rounded-lg" />
                                ) : (
                                  <img src={item.awsS3Url} alt={item.fileName} className="w-full h-32 object-contain bg-background rounded-lg" />
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveVaultItem(item.id)}
                                  className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <X className="w-3 h-3 text-white" />
                                </button>
                              </div>
                            ))}
                            {/* Show uploaded files */}
                            {uploadPreviewUrls.map((url, index) => {
                              const isVideo = uploadedFiles[index]?.type.startsWith("video/") || 
                                            (editingSlot?.files?.[index]?.mimeType?.startsWith("video/"));
                              return (
                                <div key={`upload-${index}`} className="relative group">
                                  {isVideo ? (
                                    <video src={url} className="w-full h-32 object-contain bg-background rounded-lg" />
                                  ) : (
                                    <img src={url} alt={`Preview ${index + 1}`} className="w-full h-32 object-contain bg-background rounded-lg" />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFile(index)}
                                    className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <X className="w-3 h-3 text-white" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-[var(--color-brand-blue)]/50 transition-colors bg-muted">
                            <Plus className="w-6 h-6 text-muted-foreground mb-1" />
                            <span className="text-xs text-muted-foreground">Add more files</span>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
                              onChange={handleFileSelect}
                              multiple
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-[var(--color-brand-blue)]/50 transition-colors bg-muted">
                          <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">Click to upload images or videos</span>
                          <span className="text-xs text-muted-foreground mt-1">Max 50MB each • Multiple files supported</span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
                            onChange={handleFileSelect}
                            multiple
                          />
                        </label>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Vault mode */}
                      {/* Folder Selection Dropdown */}
                      <div className="mb-4">
                        <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                          <FolderOpen className="w-4 h-4 text-[var(--color-brand-blue)]" />
                          Select Folder
                        </label>
                        <select
                          value={selectedVaultFolder}
                          onChange={(e) => {
                            setSelectedVaultFolder(e.target.value);
                            setSelectedVaultItems([]);
                            fetchVaultItems(e.target.value || undefined);
                          }}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={loadingFolders}
                        >
                          <option value="">All Media</option>
                          {vaultFolders
                            .filter((folder) => folder.name.toLowerCase() !== "all media" && folder.name.toLowerCase() !== "all")
                            .map((folder) => (
                              <option key={folder.id} value={folder.id}>
                                {folder.name} ({folder._count?.items || 0} items)
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="bg-muted rounded-xl border-2 border-border p-4 max-h-[400px] overflow-y-auto">
                        {loadingVault ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                          </div>
                        ) : vaultItems.length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground">
                            <p>No vault items found for this profile</p>
                            <p className="text-sm mt-2">Upload media to your vault first</p>
                          </div>
                        ) : (
                          <>
                            {selectedVaultItems.length > 0 && (
                              <div className="mb-4 p-3 bg-blue-600/10 border border-blue-500/30 rounded-lg">
                                <p className="text-sm text-blue-300 font-medium">
                                  {selectedVaultItems.length} item{selectedVaultItems.length !== 1 ? 's' : ''} selected
                                </p>
                              </div>
                            )}
                            <div className="grid grid-cols-3 gap-3">
                              {vaultItems.map((item) => {
                                const isSelected = selectedVaultItems.some(i => i.id === item.id);
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleSelectVaultItem(item)}
                                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all group ${
                                      isSelected 
                                        ? 'border-blue-500 ring-2 ring-blue-500/50' 
                                        : 'border-transparent hover:border-blue-500'
                                    }`}
                                  >
                                    {item.fileType.startsWith('video/') ? (
                                      <>
                                        <video
                                          src={item.awsS3Url}
                                          className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                          <VideoIcon className="w-8 h-8 text-white" />
                                        </div>
                                      </>
                                    ) : (
                                      <img
                                        src={item.awsS3Url}
                                        alt={item.fileName}
                                        className="w-full h-full object-cover"
                                      />
                                    )}
                                    {isSelected && (
                                      <div className="absolute top-1 right-1 p-1 bg-blue-600 rounded-full">
                                        <CheckCircle className="w-4 h-4 text-white" />
                                      </div>
                                    )}
                                    {/* Profile indicator for All Profiles mode */}
                                    {isAllProfiles && item.profileName && (
                                      <div className="absolute top-1 left-1 right-8">
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-600/90 text-white rounded text-[10px] font-medium truncate max-w-full">
                                          <User className="w-2.5 h-2.5 flex-shrink-0" />
                                          <span className="truncate">{item.profileName}</span>
                                        </span>
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                      <p className="absolute bottom-1 left-1 right-1 text-xs text-white truncate">
                                        {item.fileName}
                                      </p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Caption */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Caption</label>
                  
                  {/* Caption Mode Toggle */}
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setCaptionMode("custom")}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                        captionMode === "custom"
                          ? "bg-blue-600 text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      ✍️ Write Your Own
                    </button>
                    <button
                      type="button"
                      onClick={() => setCaptionMode("bank")}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                        captionMode === "bank"
                          ? "bg-cyan-600 text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      🏦 Select from Bank
                    </button>
                  </div>

                  {captionMode === "custom" ? (
                    <textarea
                      value={formData.caption}
                      onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                      placeholder="Write your caption..."
                      rows={3}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  ) : (
                    <div className="space-y-3">
                      {/* Search and Filters */}
                      <div className="bg-muted rounded-xl border-2 border-border p-4 space-y-3">
                        <input
                          type="text"
                          placeholder="🔍 Search captions..."
                          value={captionSearchQuery}
                          onChange={(e) => setCaptionSearchQuery(e.target.value)}
                          className="w-full px-4 py-2 bg-background border-2 border-border rounded-lg text-foreground focus:outline-none focus:border-cyan-500"
                        />
                        
                        <div className="grid grid-cols-3 gap-2">
                          <select
                            value={captionCategoryFilter}
                            onChange={(e) => setCaptionCategoryFilter(e.target.value)}
                            className="px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-cyan-500"
                          >
                            <option value="All">All Categories</option>
                            <option value="Dick rating">Dick rating</option>
                            <option value="Solo DILDO">Solo DILDO</option>
                            <option value="Solo FINGERS">Solo FINGERS</option>
                            <option value="Solo VIBRATOR">Solo VIBRATOR</option>
                            <option value="JOI">JOI</option>
                            <option value="Squirting">Squirting</option>
                            <option value="Cream Pie">Cream Pie</option>
                            <option value="BG">BG</option>
                            <option value="BJ">BJ</option>
                            <option value="GG">GG</option>
                            <option value="GGG">GGG</option>
                            <option value="BGG">BGG</option>
                            <option value="BBG">BBG</option>
                            <option value="ORGY">ORGY</option>
                            <option value="ANAL butt plug">ANAL butt plug</option>
                            <option value="Anal SOLO">Anal SOLO</option>
                            <option value="Anal BG">Anal BG</option>
                            <option value="Lives">Lives</option>
                          </select>

                          <select
                            value={captionTypeFilter}
                            onChange={(e) => setCaptionTypeFilter(e.target.value)}
                            className="px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-cyan-500"
                          >
                            <option value="All">All Types</option>
                            <option value="Bundle Unlocks">Bundle Unlocks</option>
                            <option value="Tip Me">Tip Me</option>
                            <option value="BIO">BIO</option>
                            <option value="VIP GIFT">VIP GIFT</option>
                            <option value="Short Unlocks">Short Unlocks</option>
                            <option value="Solo Unlocks">Solo Unlocks</option>
                            <option value="Follow up Normal">Follow up Normal</option>
                            <option value="Mass Message Bumps">Mass Message Bumps</option>
                            <option value="Wall Bumps">Wall Bumps</option>
                            <option value="DM Funnels">DM Funnels</option>
                            <option value="GIF Bumps">GIF Bumps</option>
                            <option value="Renew On">Renew On</option>
                            <option value="VIP Post">VIP Post</option>
                            <option value="Link Drop">Link Drop</option>
                            <option value="Live Streams">Live Streams</option>
                            <option value="Live Mass Message">Live Mass Message</option>
                            <option value="Holiday Unlocks">Holiday Unlocks</option>
                            <option value="Live Preview">Live Preview</option>
                            <option value="Games">Games</option>
                            <option value="New Sub Promo">New Sub Promo</option>
                            <option value="Winner Unlocks">Winner Unlocks</option>
                            <option value="Descriptive">Descriptive</option>
                            <option value="OTP Style">OTP Style</option>
                            <option value="List Unlocks">List Unlocks</option>
                            <option value="Model Specific">Model Specific</option>
                            <option value="SOP">SOP</option>
                            <option value="Holiday Non-PPV">Holiday Non-PPV</option>
                            <option value="Timebound">Timebound</option>
                            <option value="Follow Up Incentives">Follow Up Incentives</option>
                            <option value="Collab">Collab</option>
                            <option value="Tip Me Post">Tip Me Post</option>
                            <option value="Tip Me CTA">Tip Me CTA</option>
                            <option value="MM Renew">MM Renew</option>
                            <option value="Renew Post">Renew Post</option>
                            <option value="Porn Post">Porn Post</option>
                            <option value="1 Person Tip Campaign">1 Person Tip Campaign</option>
                            <option value="VIP Membership">VIP Membership</option>
                            <option value="DM Funnel (GF)">DM Funnel (GF)</option>
                            <option value="Expired Sub Promo">Expired Sub Promo</option>
                          </select>

                          <select
                            value={captionBankFilter}
                            onChange={(e) => setCaptionBankFilter(e.target.value)}
                            className="px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-cyan-500"
                          >
                            <option value="All">All Banks</option>
                            <option value="Main Porn Caption Bank">Main Porn Caption Bank</option>
                            <option value="Post Generation Caption Bank">Post Generation Caption Bank</option>
                            <option value="High Sales Caption">High Sales Caption</option>
                            <option value="Better Bump Bank">Better Bump Bank</option>
                            <option value="Custom">Custom</option>
                            <option value="Borrowed Captions">Borrowed Captions</option>
                            <option value="CST - Post Generation Harvest Caption Bank">CST - Post Generation Harvest Caption Bank</option>
                          </select>
                        </div>
                      </div>

                      {/* Captions List */}
                      <div className="bg-muted rounded-xl border-2 border-border max-h-[300px] overflow-y-auto">
                        {loadingCaptions ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
                          </div>
                        ) : (() => {
                          const filteredCaptions = availableCaptions.filter((caption) => {
                            const matchesSearch = caption.caption.toLowerCase().includes(captionSearchQuery.toLowerCase());
                            const matchesCategory = captionCategoryFilter === "All" || caption.captionCategory === captionCategoryFilter;
                            const matchesType = captionTypeFilter === "All" || caption.captionTypes === captionTypeFilter;
                            const matchesBank = captionBankFilter === "All" || caption.captionBanks === captionBankFilter;
                            return matchesSearch && matchesCategory && matchesType && matchesBank;
                          });

                          return filteredCaptions.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <p>No captions found</p>
                              <p className="text-sm mt-1">Try adjusting your filters</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-border">
                              {filteredCaptions.map((caption: any) => (
                                <button
                                  key={caption.id}
                                  type="button"
                                  onClick={() => {
                                    setFormData({ ...formData, caption: caption.caption });
                                    setCaptionMode("custom");
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-muted/80 transition-colors"
                                >
                                  {isAllProfiles && caption.profileName && (
                                    <div className="flex items-center gap-1 mb-1">
                                      <User className="w-3 h-3 text-pink-400" />
                                      <span className="text-xs text-pink-400 font-medium">{caption.profileName}</span>
                                    </div>
                                  )}
                                  <div className="text-foreground text-sm line-clamp-2 mb-2">
                                    {caption.caption}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <span className="text-xs px-2 py-1 bg-blue-600/20 text-blue-400 rounded">
                                      {caption.captionCategory}
                                    </span>
                                    <span className="text-xs px-2 py-1 bg-cyan-600/20 text-cyan-400 rounded">
                                      {caption.captionTypes}
                                    </span>
                                    <span className="text-xs px-2 py-1 bg-teal-600/20 text-teal-400 rounded">
                                      {caption.captionBanks}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Hashtags */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Hash className="w-4 h-4 text-purple-500" />
                    Hashtags
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={hashtagInput}
                      onChange={(e) => setHashtagInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addHashtag();
                        }
                      }}
                      placeholder="Add hashtag..."
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={addHashtag}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hashtags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-purple-600/20 text-purple-300 rounded-full text-sm border border-purple-500/30"
                      >
                        {tag}
                        <button onClick={() => removeHashtag(tag)} className="hover:text-purple-100">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-500" />
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Add location..."
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Collaborators */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4 text-pink-500" />
                    Collaborators
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={collaboratorInput}
                      onChange={(e) => setCollaboratorInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCollaborator();
                        }
                      }}
                      placeholder="Add collaborator (@username)..."
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={addCollaborator}
                      className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {collaborators.map((collab, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-pink-600/20 text-pink-300 rounded-full text-sm border border-pink-500/30"
                      >
                        {collab}
                        <button onClick={() => removeCollaborator(collab)} className="hover:text-pink-100">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    Notes & Ideas
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes, reminders, or ideas..."
                    rows={2}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border flex items-center justify-between">
                {editingSlot && (
                  <button
                    onClick={() => handleDelete(editingSlot.id)}
                    className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
                <div className={`flex gap-3 ${!editingSlot ? "w-full justify-end" : ""}`}>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      clearAllFiles();
                    }}
                    className="px-5 py-2.5 bg-muted hover:bg-muted/80 border border-border text-foreground rounded-xl transition-all text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={uploading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {uploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        {editingSlot ? "Update" : "Create"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
