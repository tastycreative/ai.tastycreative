"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Edit2,
  Trash2,
  CheckCircle,
  CheckCircle2,
  Circle,
  X,
  Video,
  Calendar as CalendarIcon,
  Music,
  Hash,
  Lightbulb,
  Upload,
  Clock,
  Sparkles,
  TrendingUp,
  User,
  Users,
  ChevronDown,
  Loader2,
  Video as VideoIcon,
  XCircle,
  FolderOpen,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

interface ReelsPlannerViewProps {
  profileId?: string | null;
}

interface ReelSlot {
  id: string;
  date: Date;
  timeSlot: Date | null;
  reelType: string;
  hookIdea?: string;
  notes?: string;
  caption?: string;
  hashtags?: string[];
  trendingAudio?: string;
  awsS3Url?: string;
  fileName?: string;
  mimeType?: string;
  isPosted?: boolean;
  postedAt?: Date;
  profileId?: string;
  profileName?: string;
}

interface Profile {
  id: string;
  name: string;
}

const REEL_TYPES = [
  { value: "TRENDING", label: "Trending", emoji: "🔥" },
  { value: "TUTORIAL", label: "Tutorial", emoji: "📚" },
  { value: "BEHIND_SCENES", label: "Behind the Scenes", emoji: "🎬" },
  { value: "PROMO", label: "Promo", emoji: "📢" },
  { value: "PRODUCT", label: "Product Showcase", emoji: "🛍️" },
  { value: "LIFESTYLE", label: "Lifestyle", emoji: "🌟" },
  { value: "TRANSITION", label: "Transition", emoji: "✨" },
  { value: "DAY_IN_LIFE", label: "Day in the Life", emoji: "📅" },
  { value: "CHALLENGE", label: "Challenge", emoji: "🎯" },
  { value: "COMEDY", label: "Comedy", emoji: "😂" },
  { value: "EDUCATIONAL", label: "Educational", emoji: "🎓" },
  { value: "OTHER", label: "Other", emoji: "🎥" },
];

export default function ReelsPlannerView({ profileId }: ReelsPlannerViewProps) {
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
  const [reelSlots, setReelSlots] = useState<ReelSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ReelSlot | null>(null);
  const [formData, setFormData] = useState({
    reelType: "TRENDING",
    hookIdea: "",
    notes: "",
    caption: "",
    trendingAudio: "",
  });
  const [timeInput, setTimeInput] = useState({
    hour: "12",
    minute: "00",
    period: "PM",
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [uploadMode, setUploadMode] = useState<"upload" | "vault">("upload");
  const [vaultItems, setVaultItems] = useState<any[]>([]);
  const [vaultFolders, setVaultFolders] = useState<any[]>([]);
  const [selectedVaultFolder, setSelectedVaultFolder] = useState<string>("all");
  const [selectedVaultItem, setSelectedVaultItem] = useState<any | null>(null);
  const [loadingVault, setLoadingVault] = useState(false);
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
    fetchReelSlots();
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

  const fetchReelSlots = async () => {
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
        `/api/instagram/reel-slots?${params}`
      );
      const data = await response.json();
      if (data.slots) {
        setReelSlots(
          data.slots.map((slot: any) => ({
            ...slot,
            date: new Date(slot.date),
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching reel slots:", error);
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
      reelType: "TRENDING",
      hookIdea: "",
      notes: "",
      caption: "",
      trendingAudio: "",
    });
    setTimeInput({
      hour: "12",
      minute: "00",
      period: "PM",
    });
    setHashtags([]);
    setHashtagInput("");
    setUploadedFile(null);
    setUploadPreviewUrl(null);
    setUploadMode("upload");
    setSelectedVaultItem(null);
    setSelectedVaultFolder("all");
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
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "video/mp4",
      "video/quicktime",
      "video/webm",
    ];
    if (!validTypes.includes(file.type)) {
      alert("Please select a valid video file (MP4, MOV, WebM)");
      return;
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("File size must be less than 50MB");
      return;
    }

    setUploadedFile(file);
    const previewUrl = URL.createObjectURL(file);
    setUploadPreviewUrl(previewUrl);
  };

  const handleRemoveFile = () => {
    if (uploadPreviewUrl && uploadedFile) {
      URL.revokeObjectURL(uploadPreviewUrl);
    }
    setUploadedFile(null);
    setUploadPreviewUrl(null);
    setSelectedVaultItem(null);
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
      if (folderId && folderId !== "all") {
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
    setSelectedVaultItem(item);
    setUploadPreviewUrl(item.awsS3Url);
  };

  const openEditModal = (slot: ReelSlot) => {
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
      reelType: slot.reelType,
      hookIdea: slot.hookIdea || "",
      notes: slot.notes || "",
      caption: slot.caption || "",
      trendingAudio: slot.trendingAudio || "",
    });
    setHashtags(slot.hashtags || []);
    setHashtagInput("");

    if (slot.awsS3Url) {
      setUploadPreviewUrl(slot.awsS3Url);
    } else {
      setUploadPreviewUrl(null);
    }
    setUploadedFile(null);
    setUploadMode("upload");
    setSelectedVaultItem(null);
    setSelectedVaultFolder("all");
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

  const handleSave = async () => {
    try {
      if (!timeInput.hour || !timeInput.minute || !timeInput.period) {
        alert("Please select a time for this reel!");
        return;
      }

      // Require profile selection when in All Profiles mode
      if (isAllProfiles && !selectedProfileId) {
        alert("Please select a profile for this reel!");
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

      let fileData: any = {};

      // If there's a vault item selected, use it
      if (selectedVaultItem) {
        fileData = {
          awsS3Key: selectedVaultItem.awsS3Key,
          awsS3Url: selectedVaultItem.awsS3Url,
          fileName: selectedVaultItem.fileName,
          mimeType: selectedVaultItem.fileType,
        };
      }
      // Otherwise, if there's a new file to upload, upload it directly to S3 using presigned URL
      else if (uploadedFile) {
        const targetProfileId = isAllProfiles ? selectedProfileId : profileId;
        
        // Step 1: Get presigned URL from our API
        const presignedResponse = await fetch('/api/instagram/planner/get-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: targetProfileId,
            plannerType: 'reel',
            files: [{
              name: uploadedFile.name,
              type: uploadedFile.type,
              size: uploadedFile.size,
            }],
          }),
        });

        if (!presignedResponse.ok) {
          const errorData = await presignedResponse.json();
          throw new Error(errorData.error || 'Failed to get upload URL');
        }

        const { uploadUrls } = await presignedResponse.json();
        const uploadInfo = uploadUrls[0];

        // Step 2: Upload file directly to S3 using presigned URL
        const s3UploadResponse = await fetch(uploadInfo.uploadUrl, {
          method: 'PUT',
          body: uploadedFile,
          headers: {
            'Content-Type': uploadedFile.type,
          },
        });

        if (!s3UploadResponse.ok) {
          throw new Error('Failed to upload file to S3');
        }

        console.log('✅ File uploaded directly to S3:', uploadInfo.finalUrl);

        fileData = {
          awsS3Key: uploadInfo.key,
          awsS3Url: uploadInfo.finalUrl,
          fileName: uploadInfo.originalName,
          mimeType: uploadedFile.type,
        };
      }

      const requestData = {
        timeSlot: timeSlotDateTime.toISOString(),
        reelType: formData.reelType,
        hookIdea: formData.hookIdea,
        notes: formData.notes,
        caption: formData.caption,
        trendingAudio: formData.trendingAudio,
        hashtags: hashtags,
        profileId: isAllProfiles ? selectedProfileId : profileId,
        ...fileData,
      };

      if (editingSlot) {
        const response = await fetch(`/api/instagram/reel-slots/${editingSlot.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
        });

        if (!response.ok) throw new Error("Failed to update reel");
      } else {
        const response = await fetch("/api/instagram/reel-slots", {
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
            alert("A reel is already planned for this time slot!");
            return;
          }
          throw new Error(error.error || "Failed to create reel");
        }
      }

      setShowModal(false);
      handleRemoveFile();
      fetchReelSlots();
    } catch (error) {
      console.error("Error saving reel:", error);
      alert("Failed to save reel. Please try again.");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleDelete = async (slotId: string) => {
    if (!confirm("Are you sure you want to delete this reel?")) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/instagram/reel-slots/${slotId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete reel");

      fetchReelSlots();
    } catch (error) {
      console.error("Error deleting reel:", error);
      alert("Failed to delete reel. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePosted = async (slotId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/instagram/reel-slots/${slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPosted: !currentStatus,
          postedAt: !currentStatus ? new Date().toISOString() : null,
        }),
      });

      if (!response.ok) throw new Error("Failed to update post status");

      setReelSlots((prevSlots) =>
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
    } catch (error) {
      console.error("Error updating post status:", error);
      alert("Failed to update post status. Please try again.");
    }
  };

  const sortedReelSlots = [...reelSlots].sort((a, b) => {
    const timeA = a.timeSlot ? new Date(a.timeSlot).getTime() : 0;
    const timeB = b.timeSlot ? new Date(b.timeSlot).getTime() : 0;
    return timeA - timeB;
  });

  const getReelTypeLabel = (value: string) => {
    const type = REEL_TYPES.find((t) => t.value === value);
    return type ? `${type.emoji} ${type.label}` : value;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Video className="w-6 h-6 text-[var(--color-brand-mid-pink)]" />
            Reels Planner
            {isAllProfiles && (
              <span className="ml-2 px-3 py-1 bg-gradient-to-r from-[var(--color-brand-mid-pink)]/20 to-[var(--color-brand-light-pink)]/20 text-[var(--color-brand-mid-pink)] rounded-full text-sm font-medium border border-[var(--color-brand-mid-pink)]/30 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                All Profiles
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Plan and schedule your Instagram Reels
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={openCreateModal}
          className="px-6 py-3 bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-[var(--color-brand-light-pink)] hover:from-[var(--color-brand-mid-pink)]/90 hover:to-[var(--color-brand-light-pink)]/90 text-white rounded-xl transition-all shadow-lg shadow-[var(--color-brand-mid-pink)]/30 font-semibold flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Reel
        </motion.button>
      </div>

      {/* All Profiles Info Banner */}
      {isAllProfiles && (
        <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-purple-300">Viewing All Profiles</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Showing reels from all your profiles. When creating a new reel, you&apos;ll need to select which profile to assign it to.
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
            <CalendarIcon className="w-5 h-5 text-[var(--color-brand-mid-pink)]" />
            <div className="text-center">
              <h3 className="text-lg font-bold text-foreground">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {reelSlots.length} {reelSlots.length === 1 ? "reel" : "reels"} planned
              </p>
            </div>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 bg-[var(--color-brand-mid-pink)] hover:bg-[var(--color-brand-mid-pink)]/90 text-white text-sm rounded-lg transition-colors"
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

      {/* Reels Grid */}
      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-brand-mid-pink)]"></div>
          <p className="mt-4 text-muted-foreground">Loading reels...</p>
        </div>
      ) : sortedReelSlots.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4">
            <Video className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No reels planned for this day
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Start planning your reels by clicking the button above
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedReelSlots.map((slot) => (
            <motion.div
              key={slot.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              className="bg-card border-2 border-border rounded-2xl p-5 hover:border-[var(--color-brand-mid-pink)]/30 transition-all shadow-xl hover:shadow-2xl"
            >
              {/* Profile Badge for All Profiles mode */}
              {isAllProfiles && slot.profileName && (
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-300 rounded-full text-xs font-semibold border border-purple-500/30">
                    <User className="w-3 h-3" />
                    {slot.profileName}
                  </span>
                </div>
              )}

              {/* Time Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-border">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-600/20">
                    <Clock className="w-5 h-5 text-purple-400" />
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
                <div className="bg-muted rounded-xl p-3 border border-purple-500/10">
                  <div className="text-xs font-bold text-purple-400 mb-1.5 uppercase tracking-wide">Reel Type</div>
                  <div className="text-foreground font-semibold text-base">
                    {getReelTypeLabel(slot.reelType)}
                  </div>
                </div>

                {slot.hookIdea && (
                  <div className="bg-muted rounded-xl p-3 border border-pink-500/10">
                    <div className="text-xs font-bold text-pink-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Hook Idea
                    </div>
                    <div className="text-foreground font-medium text-sm">
                      {slot.hookIdea}
                    </div>
                  </div>
                )}

                {slot.trendingAudio && (
                  <div className="bg-muted rounded-xl p-3 border border-pink-500/10">
                    <div className="text-xs font-bold text-pink-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                      <Music className="w-3 h-3" />
                      Trending Audio
                    </div>
                    <div className="text-foreground font-medium text-sm truncate">
                      {slot.trendingAudio}
                    </div>
                  </div>
                )}

                {slot.caption && (
                  <div className="bg-muted rounded-xl p-3 border border-blue-500/10">
                    <div className="text-xs font-bold text-blue-400 mb-1.5 uppercase tracking-wide">Caption</div>
                    <div className="text-foreground font-medium text-sm line-clamp-3">
                      {slot.caption}
                    </div>
                  </div>
                )}

                {slot.hashtags && slot.hashtags.length > 0 && (
                  <div className="bg-muted rounded-xl p-3 border border-blue-500/10">
                    <div className="text-xs font-bold text-blue-400 mb-1.5 uppercase tracking-wide">Hashtags</div>
                    <div className="flex flex-wrap gap-1">
                      {slot.hashtags.map((tag, i) => (
                        <span
                          key={i}
                          className="text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {slot.awsS3Url && (
                  <div className="bg-muted rounded-xl p-3 border border-purple-500/10">
                    <div className="text-xs font-bold text-purple-400 mb-1.5 uppercase tracking-wide">Video Preview</div>
                    <div className="relative aspect-[9/16] max-h-64 bg-black rounded-lg overflow-hidden">
                      <video
                        src={slot.awsS3Url}
                        className="w-full h-full object-contain"
                        muted
                      />
                    </div>
                  </div>
                )}

                {slot.notes && (
                  <div className="bg-muted rounded-xl p-3 border border-gray-500/10">
                    <div className="text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">Notes</div>
                    <div className="text-foreground text-sm line-clamp-2">
                      {slot.notes}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openEditModal(slot)}
                    className="flex-1 px-4 py-2.5 bg-muted hover:from-purple-600/20 hover:to-pink-600/20 text-foreground rounded-xl transition-all text-sm flex items-center justify-center gap-2 font-semibold border border-border hover:border-purple-500/30"
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
              <div className="relative bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-purple-600 p-5 text-white">
                <button
                  onClick={() => {
                    setShowModal(false);
                    handleRemoveFile();
                  }}
                  className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">
                      {editingSlot ? "Edit Reel" : "Plan New Reel"}
                    </h3>
                    <p className="text-sm text-purple-100 mt-0.5">
                      {format(selectedDate, "EEEE, MMMM d, yyyy")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 overflow-y-auto max-h-[calc(90vh-180px)] space-y-4">
                {/* Profile Selector for All Profiles Mode */}
                {isAllProfiles && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
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
                      className="w-full px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)]"
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
                    <Clock className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                    Posting Time
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={timeInput.hour}
                      onChange={(e) => setTimeInput({ ...timeInput, hour: e.target.value })}
                      className="px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)]"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <select
                      value={timeInput.minute}
                      onChange={(e) => setTimeInput({ ...timeInput, minute: e.target.value })}
                      className="px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)]"
                    >
                      {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <select
                      value={timeInput.period}
                      onChange={(e) => setTimeInput({ ...timeInput, period: e.target.value })}
                      className="px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)]"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                {/* Reel Type */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Reel Type</label>
                  <select
                    value={formData.reelType}
                    onChange={(e) => setFormData({ ...formData, reelType: e.target.value })}
                    className="w-full px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)]"
                  >
                    {REEL_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.emoji} {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* File Upload */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                    Content Source
                  </label>
                  
                  {/* Mode Toggle */}
                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setUploadMode("upload")}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                        uploadMode === "upload"
                          ? "bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-purple-500 text-white"
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
                          ? "bg-gradient-to-r from-[var(--color-brand-mid-pink)] to-purple-500 text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
                      }`}
                    >
                      🗄️ From Vault
                    </button>
                  </div>

                  {uploadMode === "upload" ? (
                    <>
                      {/* Upload mode - show preview or upload interface */}
                      {selectedVaultItem || uploadPreviewUrl ? (
                        <div className="relative">
                          <div className="relative h-64 bg-black rounded-lg overflow-hidden">
                            <video 
                              src={selectedVaultItem?.awsS3Url || uploadPreviewUrl || ''} 
                              controls 
                              className="w-full h-full object-contain" 
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveFile}
                            className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors z-10"
                          >
                            <XCircle className="w-5 h-5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <label className="block w-full p-8 border-2 border-dashed border-border rounded-lg hover:border-[var(--color-brand-mid-pink)] transition-colors cursor-pointer">
                          <input
                            type="file"
                            accept="video/*"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                          <div className="text-center">
                            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Click to upload video</p>
                            <p className="text-xs text-muted-foreground mt-1">MP4, MOV, WebM (max 50MB)</p>
                          </div>
                        </label>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Vault mode - show folder selector and vault items */}
                      {/* Folder Selector */}
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <FolderOpen className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                          <span className="text-sm font-medium text-foreground">Select Folder</span>
                        </div>
                        <select
                          value={selectedVaultFolder}
                          onChange={(e) => {
                            setSelectedVaultFolder(e.target.value);
                            setSelectedVaultItem(null);
                            setUploadPreviewUrl(null);
                            fetchVaultItems(e.target.value);
                          }}
                          disabled={loadingFolders}
                          className="w-full px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)]"
                        >
                          <option value="all">📁 All Media</option>
                          {vaultFolders
                            .filter((folder) => folder.name.toLowerCase() !== "all media" && folder.name.toLowerCase() !== "all")
                            .map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              📂 {folder.name} ({folder._count?.items || 0} items)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Vault Items Grid */}
                      <div className="bg-muted rounded-xl border-2 border-border p-4 max-h-[400px] overflow-y-auto">
                        {loadingVault || loadingFolders ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-brand-mid-pink)]" />
                          </div>
                        ) : vaultItems.filter(item => item.fileType.startsWith('video/')).length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground">
                            <p>No video items found for this profile</p>
                            <p className="text-sm mt-2">Upload videos to your vault first</p>
                          </div>
                        ) : selectedVaultItem ? (
                          <div className="relative flex items-center justify-center">
                            <video
                              src={selectedVaultItem.awsS3Url}
                              className="max-w-full max-h-[350px] w-auto h-auto rounded-lg"
                              controls
                              style={{ objectFit: 'contain' }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedVaultItem(null);
                                setUploadPreviewUrl(null);
                              }}
                              className="absolute top-2 right-2 p-2 bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                            >
                              <X className="w-5 h-5 text-white" />
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-3">
                            {vaultItems.filter(item => item.fileType.startsWith('video/')).map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectVaultItem(item)}
                                className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-[var(--color-brand-mid-pink)] transition-all group"
                              >
                                <video
                                  src={item.awsS3Url}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                  <VideoIcon className="w-8 h-8 text-white" />
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                  <p className="absolute bottom-1 left-1 right-1 text-xs text-white truncate">
                                    {item.fileName}
                                  </p>
                                </div>
                                {/* Profile indicator for All Profiles mode */}
                                {isAllProfiles && item.profileName && (
                                  <div className="absolute top-1 left-1 right-1">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-600/90 text-white rounded text-[10px] font-medium truncate max-w-full">
                                      <User className="w-2.5 h-2.5 flex-shrink-0" />
                                      <span className="truncate">{item.profileName}</span>
                                    </span>
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Hook Idea */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                    Hook Idea
                  </label>
                  <input
                    type="text"
                    value={formData.hookIdea}
                    onChange={(e) => setFormData({ ...formData, hookIdea: e.target.value })}
                    placeholder="E.g., 'Watch this before...' or 'You won't believe...'"
                    className="w-full px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)] placeholder:text-muted-foreground"
                  />
                </div>

                {/* Trending Audio */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Music className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                    Trending Audio
                  </label>
                  <input
                    type="text"
                    value={formData.trendingAudio}
                    onChange={(e) => setFormData({ ...formData, trendingAudio: e.target.value })}
                    placeholder="Name of trending audio/song"
                    className="w-full px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)] placeholder:text-muted-foreground"
                  />
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
                          ? "bg-[var(--color-brand-blue)] text-white"
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
                          ? "bg-[var(--color-brand-mid-pink)] text-white"
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
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
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
                          className="w-full px-4 py-2 bg-background border-2 border-border rounded-lg text-foreground focus:outline-none focus:border-purple-500"
                        />
                        
                        <div className="grid grid-cols-3 gap-2">
                          <select
                            value={captionCategoryFilter}
                            onChange={(e) => setCaptionCategoryFilter(e.target.value)}
                            className="px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-purple-500"
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
                            className="px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-purple-500"
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
                            className="px-3 py-2 bg-background border-2 border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-purple-500"
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
                            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
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
                                  {/* Profile indicator for All Profiles mode */}
                                  {isAllProfiles && caption.profileName && (
                                    <div className="mb-2">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-purple-600/30 to-pink-600/30 text-purple-300 rounded-full text-xs font-medium border border-purple-500/30">
                                        <User className="w-3 h-3" />
                                        {caption.profileName}
                                      </span>
                                    </div>
                                  )}
                                  <div className="text-foreground text-sm line-clamp-2 mb-2">
                                    {caption.caption}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <span className="text-xs px-2 py-1 bg-blue-600/20 text-blue-400 rounded">
                                      {caption.captionCategory}
                                    </span>
                                    <span className="text-xs px-2 py-1 bg-purple-600/20 text-purple-400 rounded">
                                      {caption.captionTypes}
                                    </span>
                                    <span className="text-xs px-2 py-1 bg-pink-600/20 text-pink-400 rounded">
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
                    <Hash className="w-4 h-4 text-blue-500" />
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
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={addHashtag}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hashtags.map((tag, index) => (
                      <span
                        key={index}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-900/30 text-blue-400 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          onClick={() => removeHashtag(tag)}
                          className="hover:text-red-400 transition-colors"
                        >
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
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
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
                      handleRemoveFile();
                    }}
                    className="px-5 py-2.5 bg-muted hover:bg-muted/80 border border-border text-foreground rounded-xl transition-all text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={uploading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {uploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Save
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
