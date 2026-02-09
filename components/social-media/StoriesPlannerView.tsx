"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Clock,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  Image as ImageIcon,
  Upload,
  Video,
  XCircle,
  CheckCircle,
  Circle,
  User,
  Users,
  ChevronDown,
  Loader2,
  Video as VideoIcon,
  FolderOpen,
} from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";

interface StoriesPlannerViewProps {
  profileId?: string | null;
}

interface StorySlot {
  id: string;
  date: Date;
  timeSlot: Date | null;
  storyType: string;
  interactiveElement?: string;
  notes?: string;
  caption?: string;
  hashtags?: string[];
  awsS3Url?: string;
  fileName?: string;
  mimeType?: string;
  isPosted?: boolean;
  postedAt?: Date;
  profileId?: string;
  profileName?: string | null;
  linkedPost?: {
    id: string;
    fileName?: string;
    awsS3Url?: string;
    caption?: string;
  };
}

const TIME_SLOTS = [
  { value: "SLOT_9AM", label: "9:00 AM", time: "09:00" },
  { value: "SLOT_11AM", label: "11:00 AM", time: "11:00" },
  { value: "SLOT_1PM", label: "1:00 PM", time: "13:00" },
  { value: "SLOT_3PM", label: "3:00 PM", time: "15:00" },
  { value: "SLOT_5PM", label: "5:00 PM", time: "17:00" },
  { value: "SLOT_7PM", label: "7:00 PM", time: "19:00" },
  { value: "SLOT_9PM", label: "9:00 PM", time: "21:00" },
];

const STORY_TYPES = [
  { value: "SELFIE", label: "Selfie", emoji: "🤳" },
  { value: "BEHIND_SCENES", label: "Behind the Scenes", emoji: "🎬" },
  { value: "PROMO", label: "Promo", emoji: "📢" },
  { value: "PRODUCT", label: "Product", emoji: "🛍️" },
  { value: "GRWM", label: "Get Ready With Me", emoji: "💄" },
  { value: "OOTD", label: "Outfit of the Day", emoji: "👗" },
  { value: "QA", label: "Q&A", emoji: "❓" },
  { value: "TUTORIAL", label: "Tutorial", emoji: "📚" },
  { value: "LIFESTYLE", label: "Lifestyle", emoji: "🌟" },
  { value: "ANNOUNCEMENT", label: "Announcement", emoji: "📣" },
  { value: "USER_CONTENT", label: "User Content", emoji: "👥" },
  { value: "OTHER", label: "Other", emoji: "✨" },
];

const INTERACTIVE_ELEMENTS = [
  { value: "NONE", label: "None", emoji: "" },
  { value: "POLL", label: "Poll", emoji: "📊" },
  { value: "SLIDER", label: "Slider", emoji: "🎚️" },
  { value: "QUESTION", label: "Question Box", emoji: "❓" },
  { value: "QUIZ", label: "Quiz", emoji: "🧩" },
  { value: "COUNTDOWN", label: "Countdown", emoji: "⏱️" },
  { value: "LINK", label: "Link", emoji: "🔗" },
  { value: "MENTION", label: "Mention", emoji: "@" },
  { value: "HASHTAG", label: "Hashtag", emoji: "#" },
  { value: "LOCATION", label: "Location", emoji: "📍" },
  { value: "MUSIC", label: "Music", emoji: "🎵" },
];

export default function StoriesPlannerView({ profileId }: StoriesPlannerViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Initialize date from URL params or default to today
  const [selectedDate, setSelectedDate] = useState(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const parsedDate = new Date(dateParam + 'T00:00:00');
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
    return new Date();
  });
  const [storySlots, setStorySlots] = useState<StorySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<StorySlot | null>(null);
  const [formData, setFormData] = useState({
    timeSlot: "",
    storyType: "SELFIE",
    interactiveElement: "NONE",
    notes: "",
    caption: "",
  });
  const [timeInput, setTimeInput] = useState({
    hour: "9",
    minute: "00",
    period: "AM",
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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

  // All Profiles state
  const isAllProfiles = profileId === "all";
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch profiles when All Profiles is selected
  useEffect(() => {
    if (isAllProfiles) {
      fetchProfiles();
    }
  }, [isAllProfiles]);

  const fetchProfiles = async () => {
    try {
      setLoadingProfiles(true);
      const response = await fetch("/api/instagram/profiles");
      const data = await response.json();
      if (data.profiles && Array.isArray(data.profiles)) {
        setProfiles(data.profiles);
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
    } finally {
      setLoadingProfiles(false);
    }
  };

  useEffect(() => {
    fetchStorySlots();
  }, [selectedDate, profileId]);

  const fetchStorySlots = async () => {
    try {
      setLoading(true);
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const params = new URLSearchParams({
        startDate: dateStr,
        endDate: dateStr,
      });
      
      if (profileId) {
        params.append("profileId", profileId);
      }
      
      const response = await fetch(
        `/api/instagram/story-slots?${params}`
      );
      const data = await response.json();
      if (data.slots) {
        setStorySlots(
          data.slots.map((slot: any) => ({
            ...slot,
            date: new Date(slot.date),
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching story slots:", error);
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
      timeSlot: "",
      storyType: "SELFIE",
      interactiveElement: "NONE",
      notes: "",
      caption: "",
    });
    setTimeInput({
      hour: "9",
      minute: "00",
      period: "AM",
    });
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
    setSelectedProfileId(null); // Reset profile selection
    setShowModal(true);
    
    // Fetch vault and captions for specific profile or all profiles
    if (isAllProfiles) {
      // For all profiles, we'll fetch when a profile is selected
      fetchProfiles();
    } else if (profileId) {
      fetchVaultFolders();
      fetchVaultItems();
      fetchCaptionsBank();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      alert('Please select a valid image or video file (JPEG, PNG, GIF, WebP, MP4, MOV, WebM)');
      return;
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size must be less than 50MB');
      return;
    }

    setUploadedFile(file);
    
    // Create preview URL
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
    const pId = targetProfileId || (isAllProfiles ? selectedProfileId : profileId);
    if (!pId) return;

    try {
      setLoadingFolders(true);
      const response = await fetch(`/api/vault/folders?profileId=${pId}`);
      
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
    const pId = targetProfileId || (isAllProfiles ? selectedProfileId : profileId);
    if (!pId) return;

    try {
      setLoadingVault(true);
      const params = new URLSearchParams({ profileId: pId });
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
    const pId = targetProfileId || (isAllProfiles ? selectedProfileId : profileId);
    if (!pId) return;

    try {
      setLoadingCaptions(true);
      const response = await fetch(`/api/captions?profileId=${pId}`);
      
      if (!response.ok) {
        console.warn("Captions not available");
        setAvailableCaptions([]);
        return;
      }

      const data = await response.json();
      setAvailableCaptions(data);
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

  const openEditModal = (slot: StorySlot) => {
    setEditingSlot(slot);
    // Parse timeSlot DateTime to hour, minute, period
    if (slot.timeSlot) {
      const timeDate = new Date(slot.timeSlot);
      let hours = timeDate.getHours();
      const minutes = timeDate.getMinutes();
      const period = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12; // Convert to 12-hour format
      
      setTimeInput({
        hour: String(hours),
        minute: String(minutes).padStart(2, "0"),
        period: period,
      });
    } else {
      setTimeInput({
        hour: "9",
        minute: "00",
        period: "AM",
      });
    }
    
    setFormData({
      timeSlot: slot.timeSlot ? format(new Date(slot.timeSlot), "HH:mm") : "",
      storyType: slot.storyType,
      interactiveElement: slot.interactiveElement || "NONE",
      notes: slot.notes || "",
      caption: slot.caption || "",
    });
    // Set preview from direct file fields or linked post
    if (slot.awsS3Url) {
      setUploadPreviewUrl(slot.awsS3Url);
    } else if (slot.linkedPost?.awsS3Url) {
      setUploadPreviewUrl(slot.linkedPost.awsS3Url);
    } else {
      setUploadPreviewUrl(null);
    }
    setUploadedFile(null);
    setCaptionMode("custom");
    setCaptionSearchQuery("");
    setCaptionCategoryFilter("All");
    setCaptionTypeFilter("All");
    setCaptionBankFilter("All");
    setShowModal(true);
    if (profileId && profileId !== "all") {
      fetchCaptionsBank();
    }
  };

  const handleSave = async () => {
    try {
      if (!timeInput.hour || !timeInput.minute || !timeInput.period) {
        alert("Please select a time for this story slot!");
        return;
      }

      // Require profile selection when viewing All Profiles
      if (isAllProfiles && !selectedProfileId) {
        alert("Please select a profile to save this story to!");
        return;
      }

      // Convert 12-hour format to 24-hour format
      let hours = parseInt(timeInput.hour);
      if (timeInput.period === "PM" && hours !== 12) {
        hours += 12;
      } else if (timeInput.period === "AM" && hours === 12) {
        hours = 0;
      }

      // Combine selected date with time input to create full DateTime
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
            plannerType: 'story',
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

        // Store file info directly on the slot
        fileData = {
          awsS3Key: uploadInfo.key,
          awsS3Url: uploadInfo.finalUrl,
          fileName: uploadInfo.originalName,
          mimeType: uploadedFile.type,
        };
      }

      const requestData = {
        timeSlot: timeSlotDateTime.toISOString(),
        storyType: formData.storyType,
        interactiveElement: formData.interactiveElement,
        notes: formData.notes,
        caption: formData.caption,
        profileId: isAllProfiles ? selectedProfileId : profileId,
        ...fileData,
      };

      if (editingSlot) {
        // Update existing slot
        const response = await fetch(
          `/api/instagram/story-slots/${editingSlot.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestData),
          }
        );

        if (!response.ok) throw new Error("Failed to update slot");
      } else {
        // Create new slot
        const response = await fetch("/api/instagram/story-slots", {
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
            setLoading(false);
            setUploading(false);
            alert("A story is already planned for this time slot. Please choose a different time.");
            return;
          }
          throw new Error(error.error || "Failed to create slot");
        }
      }

      setShowModal(false);
      handleRemoveFile(); // Clean up preview URLs
      fetchStorySlots();
    } catch (error) {
      console.error("Error saving slot:", error);
      alert("Failed to save story slot. Please try again.");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleDelete = async (slotId: string) => {
    if (!confirm("Are you sure you want to delete this story slot?")) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/instagram/story-slots/${slotId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete slot");

      fetchStorySlots();
    } catch (error) {
      console.error("Error deleting slot:", error);
      alert("Failed to delete story slot. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePosted = async (slotId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/instagram/story-slots/${slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPosted: !currentStatus,
          postedAt: !currentStatus ? new Date().toISOString() : null,
        }),
      });

      if (!response.ok) throw new Error("Failed to update post status");

      // Optimistically update the local state instead of refetching
      setStorySlots((prevSlots) =>
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

  const getSlotForTime = (timeSlotValue: string) => {
    return storySlots.find((slot) => {
      if (!slot.timeSlot) return false;
      const slotTime = format(new Date(slot.timeSlot), "HH:mm");
      return slotTime === timeSlotValue;
    });
  };

  const sortedStorySlots = [...storySlots].sort((a, b) => {
    const timeA = a.timeSlot ? new Date(a.timeSlot).getTime() : 0;
    const timeB = b.timeSlot ? new Date(b.timeSlot).getTime() : 0;
    return timeA - timeB;
  });

  const getStoryTypeLabel = (value: string) => {
    const type = STORY_TYPES.find((t) => t.value === value);
    return type ? `${type.emoji} ${type.label}` : value;
  };

  const getInteractiveLabel = (value: string) => {
    const elem = INTERACTIVE_ELEMENTS.find((e) => e.value === value);
    return elem ? `${elem.emoji} ${elem.label}` : value;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[var(--color-brand-blue)]/20 to-[var(--color-brand-mid-pink)]/20 border border-[var(--color-brand-blue)]/30">
              <Clock className="w-7 h-7 text-[var(--color-brand-blue)]" />
            </div>
            Stories Planner
          </h2>
          <p className="text-muted-foreground mt-2">
            {isAllProfiles && <span className="text-[var(--color-brand-mid-pink)]">All Profiles • </span>}
            Plan your Instagram stories throughout the day with interactive elements
          </p>
        </div>
        
        {/* Add Story Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={openCreateModal}
          className="px-6 py-3 bg-gradient-to-r from-[var(--color-brand-blue)] to-[var(--color-brand-mid-pink)] hover:from-[var(--color-brand-blue)]/90 hover:to-[var(--color-brand-mid-pink)]/90 text-white rounded-xl transition-all shadow-lg shadow-[var(--color-brand-blue)]/30 font-semibold flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Add Story</span>
        </motion.button>
      </div>

      {/* All Profiles Notice */}
      {isAllProfiles && (
        <div className="flex items-center gap-3 p-3 bg-[var(--color-brand-mid-pink)]/10 border border-[var(--color-brand-mid-pink)]/30 rounded-xl">
          <Users className="w-5 h-5 text-[var(--color-brand-mid-pink)] shrink-0" />
          <p className="text-sm text-[var(--color-brand-mid-pink)]">
            Viewing stories from all profiles. Select a profile when creating a new story.
          </p>
        </div>
      )}

      {/* Date Navigator */}
      <div className="bg-card border-2 border-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <motion.button
            whileHover={{ scale: 1.1, x: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={handlePrevDay}
            className="p-3 hover:bg-[var(--color-brand-blue)]/20 rounded-xl transition-colors border border-transparent hover:border-[var(--color-brand-blue)]/30"
          >
            <ChevronLeft className="w-6 h-6 text-[var(--color-brand-blue)]" />
          </motion.button>

          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold bg-gradient-to-r from-[var(--color-brand-blue)] to-[var(--color-brand-mid-pink)] bg-clip-text text-transparent">
                {format(selectedDate, "EEEE")}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {format(selectedDate, "MMMM d, yyyy")}
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleToday}
              className="px-6 py-3 bg-gradient-to-r from-[var(--color-brand-blue)] to-[var(--color-brand-mid-pink)] hover:from-[var(--color-brand-blue)]/90 hover:to-[var(--color-brand-mid-pink)]/90 text-white rounded-xl transition-all shadow-lg shadow-[var(--color-brand-blue)]/30 font-semibold"
            >
              Today
            </motion.button>
          </div>

          <motion.button
            whileHover={{ scale: 1.1, x: 2 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleNextDay}
            className="p-3 hover:bg-[var(--color-brand-blue)]/20 rounded-xl transition-colors border border-transparent hover:border-[var(--color-brand-blue)]/30"
          >
            <ChevronRight className="w-6 h-6 text-[var(--color-brand-blue)]" />
          </motion.button>
        </div>
      </div>

      {/* Time Slots Grid */}
      {loading ? (
        <div className="text-center py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block"
          >
            <Clock className="w-12 h-12 text-[var(--color-brand-blue)]" />
          </motion.div>
          <p className="text-muted-foreground mt-4">Loading story slots...</p>
        </div>
      ) : sortedStorySlots.length === 0 ? (
        <div className="text-center py-16">
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-block p-6 rounded-2xl bg-gradient-to-br from-[var(--color-brand-blue)]/10 to-[var(--color-brand-mid-pink)]/10 mb-4"
          >
            <Clock className="w-16 h-16 text-[var(--color-brand-blue)]" />
          </motion.div>
          <p className="text-muted-foreground text-lg mb-6">No stories planned for this day</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={openCreateModal}
            className="px-6 py-3 bg-gradient-to-r from-[var(--color-brand-blue)] to-[var(--color-brand-mid-pink)] hover:from-[var(--color-brand-blue)]/90 hover:to-[var(--color-brand-mid-pink)]/90 text-white rounded-xl transition-all shadow-lg shadow-[var(--color-brand-blue)]/30 font-semibold flex items-center gap-2 mx-auto"
          >
            <Plus className="w-5 h-5" />
            Add Your First Story
          </motion.button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedStorySlots.map((slot) => (
            <motion.div
              key={slot.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              className="bg-card border-2 border-border rounded-2xl p-5 hover:border-[var(--color-brand-blue)]/30 transition-all shadow-xl hover:shadow-2xl hover:shadow-[var(--color-brand-blue)]/10"
            >
              {/* Time Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-border">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[var(--color-brand-blue)]/20">
                    <Clock className="w-5 h-5 text-[var(--color-brand-blue)]" />
                  </div>
                  <span className="font-bold text-foreground text-lg">
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
                {/* Profile Badge - shown when viewing All Profiles */}
                {isAllProfiles && slot.profileName && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[var(--color-brand-mid-pink)]/20 to-[var(--color-brand-light-pink)]/20 rounded-xl border border-[var(--color-brand-mid-pink)]/30">
                    <User className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                    <span className="text-sm font-medium text-[var(--color-brand-mid-pink)]">{slot.profileName}</span>
                  </div>
                )}

                <div className="bg-muted rounded-xl p-3 border border-border">
                  <div className="text-xs font-bold text-[var(--color-brand-blue)] mb-1.5 uppercase tracking-wide">Story Type</div>
                  <div className="text-foreground font-semibold text-base">
                    {getStoryTypeLabel(slot.storyType)}
                  </div>
                </div>

                {slot.interactiveElement && slot.interactiveElement !== "NONE" && (
                  <div className="bg-muted rounded-xl p-3 border border-border">
                    <div className="text-xs font-bold text-[var(--color-brand-mid-pink)] mb-1.5 uppercase tracking-wide">
                      Interactive
                    </div>
                    <div className="text-foreground font-medium">
                      {getInteractiveLabel(slot.interactiveElement)}
                    </div>
                  </div>
                )}

                {slot.notes && (
                  <div className="bg-muted rounded-xl p-3 border border-border">
                    <div className="text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">Notes</div>
                    <div className="text-foreground text-sm line-clamp-2">
                      {slot.notes}
                    </div>
                  </div>
                )}

                {(slot.awsS3Url || slot.linkedPost?.awsS3Url) && (
                  <div className="bg-muted rounded-xl p-3 border border-border">
                    <div className="text-xs font-bold text-[var(--color-brand-blue)] mb-2 uppercase tracking-wide flex items-center gap-1.5">
                      {(slot.fileName || slot.linkedPost?.fileName)?.match(/\.(mp4|mov|webm)$/i) ? (
                        <Video className="w-3.5 h-3.5" />
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5" />
                      )}
                      Content
                    </div>
                    <div className="flex items-center justify-center bg-background rounded-lg p-2" style={{ maxHeight: '240px' }}>
                      {(slot.fileName || slot.linkedPost?.fileName)?.match(/\.(mp4|mov|webm)$/i) ? (
                        <video
                          src={slot.awsS3Url || slot.linkedPost?.awsS3Url}
                          className="max-w-full max-h-[224px] w-auto h-auto rounded"
                          controls
                          style={{ objectFit: 'contain' }}
                        />
                      ) : (
                        <img
                          src={slot.awsS3Url || slot.linkedPost?.awsS3Url}
                          alt={(slot.fileName || slot.linkedPost?.fileName) || 'Story content'}
                          className="max-w-full max-h-[224px] w-auto h-auto rounded"
                          style={{ objectFit: 'contain' }}
                        />
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openEditModal(slot)}
                    className="flex-1 px-4 py-2.5 bg-muted hover:bg-[var(--color-brand-blue)]/20 text-foreground rounded-xl transition-all text-sm flex items-center justify-center gap-2 font-semibold border border-border hover:border-[var(--color-brand-blue)]/30"
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
      {mounted && showModal && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="bg-card border-2 border-border rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl shadow-[var(--color-brand-blue)]/20"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[var(--color-brand-blue)]/20 to-[var(--color-brand-mid-pink)]/20 border border-[var(--color-brand-blue)]/30">
                  <Clock className="w-6 h-6 text-[var(--color-brand-blue)]" />
                </div>
                {editingSlot ? "Edit Story Slot" : "Add Story Slot"}
              </h3>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-muted rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-muted-foreground" />
              </motion.button>
            </div>

            <div className="space-y-6">
              {/* Profile Selector - shown when viewing All Profiles */}
              {isAllProfiles && (
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">
                    👤 Profile *
                  </label>
                  {loadingProfiles ? (
                    <div className="flex items-center gap-2 px-4 py-3 bg-muted border-2 border-border rounded-xl">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground">Loading profiles...</span>
                    </div>
                  ) : (
                    <select
                      value={selectedProfileId || ""}
                      onChange={(e) => {
                        const newProfileId = e.target.value;
                        setSelectedProfileId(newProfileId);
                        // Reset vault and captions when profile changes
                        setSelectedVaultItem(null);
                        setUploadPreviewUrl(null);
                        setVaultItems([]);
                        setVaultFolders([]);
                        setSelectedVaultFolder("all");
                        setAvailableCaptions([]);
                        // Fetch vault and captions for the selected profile
                        if (newProfileId) {
                          fetchVaultFolders(newProfileId);
                          fetchVaultItems(undefined, newProfileId);
                          fetchCaptionsBank(newProfileId);
                        }
                      }}
                      className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:border-[var(--color-brand-mid-pink)] focus:ring-2 focus:ring-[var(--color-brand-mid-pink)]/20 transition-all"
                    >
                      <option value="">Select a profile...</option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <span>ℹ️</span>
                    Select which profile this story belongs to
                  </p>
                </div>
              )}

              {/* Time Input */}
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  ⏰ Time *
                </label>
                
                <div className="grid grid-cols-3 gap-3">
                  {/* Hour Dropdown */}
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Hour</label>
                    <select
                      value={timeInput.hour}
                      onChange={(e) => setTimeInput({ ...timeInput, hour: e.target.value })}
                      className="w-full px-3 py-3 bg-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:border-[var(--color-brand-blue)] focus:ring-2 focus:ring-[var(--color-brand-blue)]/20 transition-all"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                        <option key={hour} value={hour}>
                          {hour}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Minute Dropdown */}
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Minute</label>
                    <select
                      value={timeInput.minute}
                      onChange={(e) => setTimeInput({ ...timeInput, minute: e.target.value })}
                      className="w-full px-3 py-3 bg-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:border-[var(--color-brand-blue)] focus:ring-2 focus:ring-[var(--color-brand-blue)]/20 transition-all"
                    >
                      {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                        <option key={minute} value={String(minute).padStart(2, "0")}>
                          {String(minute).padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* AM/PM Dropdown */}
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Period</label>
                    <select
                      value={timeInput.period}
                      onChange={(e) => setTimeInput({ ...timeInput, period: e.target.value })}
                      className="w-full px-3 py-3 bg-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:border-[var(--color-brand-blue)] focus:ring-2 focus:ring-[var(--color-brand-blue)]/20 transition-all"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <span>ℹ️</span>
                  Select hour (1-12), minute (0-59), and AM/PM
                </p>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  📸 Content Source
                </label>
                
                {/* Mode Toggle */}
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setUploadMode("upload")}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      uploadMode === "upload"
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    📤 Upload New
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadMode("vault");
                      const targetProfileId = isAllProfiles ? selectedProfileId : profileId;
                      if (targetProfileId) {
                        if (vaultFolders.length === 0) {
                          fetchVaultFolders(targetProfileId);
                        }
                        if (vaultItems.length === 0) {
                          fetchVaultItems(undefined, targetProfileId);
                        }
                      }
                    }}
                    disabled={isAllProfiles ? !selectedProfileId : !profileId}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      uploadMode === "vault"
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
                    }`}
                  >
                    🗄️ From Vault
                  </button>
                </div>

                {uploadMode === "upload" ? (
                  <>
                    {/* Upload mode - show preview or upload interface */}
                    {selectedVaultItem || uploadedFile ? (
                      <div className="relative w-full h-64 bg-muted rounded-xl overflow-hidden">
                        {(selectedVaultItem?.fileType || uploadedFile?.type)?.startsWith('video/') ? (
                          <video
                            src={selectedVaultItem?.awsS3Url || uploadPreviewUrl || ''}
                            className="w-full h-full object-contain"
                            controls
                          />
                        ) : (
                          <img
                            src={selectedVaultItem?.awsS3Url || uploadPreviewUrl || ''}
                            alt="Preview"
                            className="w-full h-full object-contain"
                          />
                        )}
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={handleRemoveFile}
                          className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors z-10"
                          type="button"
                        >
                          <XCircle className="w-5 h-5 text-white" />
                        </motion.button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-border rounded-xl hover:border-[var(--color-brand-blue)]/50 transition-all cursor-pointer bg-muted hover:bg-muted/80">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <motion.div
                            whileHover={{ scale: 1.1 }}
                            className="p-4 rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 mb-4"
                          >
                            <Upload className="w-10 h-10 text-blue-400" />
                          </motion.div>
                          <p className="mb-2 text-sm text-foreground font-semibold">
                            <span className="font-bold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Image (JPEG, PNG, GIF, WebP) or Video (MP4, MOV, WebM)
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            Max file size: 50MB
                          </p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
                          onChange={handleFileSelect}
                        />
                      </label>
                    )}
                  </>
                ) : (
                  <>
                    {/* Vault mode - show folder selector and vault items */}
                    {/* Folder Selector */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <FolderOpen className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-medium text-foreground">Select Folder</span>
                      </div>
                      <select
                        value={selectedVaultFolder}
                        onChange={(e) => {
                          setSelectedVaultFolder(e.target.value);
                          setSelectedVaultItem(null);
                          setUploadPreviewUrl(null);
                          const targetProfileId = isAllProfiles ? selectedProfileId : profileId;
                          fetchVaultItems(e.target.value, targetProfileId || undefined);
                        }}
                        disabled={loadingFolders}
                        className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
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
                          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                        </div>
                      ) : vaultItems.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <p>No vault items found for this profile</p>
                          <p className="text-sm mt-2">Upload media to your vault first</p>
                        </div>
                      ) : selectedVaultItem ? (
                        <div className="relative flex items-center justify-center">
                          {selectedVaultItem.fileType.startsWith('video/') ? (
                            <video
                              src={selectedVaultItem.awsS3Url}
                              className="max-w-full max-h-[350px] w-auto h-auto rounded-lg"
                              controls
                              style={{ objectFit: 'contain' }}
                            />
                          ) : (
                            <img
                              src={selectedVaultItem.awsS3Url}
                              alt={selectedVaultItem.fileName}
                              className="max-w-full max-h-[350px] w-auto h-auto rounded-lg"
                              style={{ objectFit: 'contain' }}
                            />
                          )}
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
                          {vaultItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelectVaultItem(item)}
                              className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-purple-500 transition-all group"
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
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="absolute bottom-1 left-1 right-1 text-xs text-white truncate">
                                  {item.fileName}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Story Type */}
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  📱 Story Type *
                </label>
                <select
                  value={formData.storyType}
                  onChange={(e) =>
                    setFormData({ ...formData, storyType: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                >
                  {STORY_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.emoji} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Interactive Element */}
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  ✨ Interactive Element
                </label>
                <select
                  value={formData.interactiveElement}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      interactiveElement: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all"
                >
                  {INTERACTIVE_ELEMENTS.map((elem) => (
                    <option key={elem.value} value={elem.value}>
                      {elem.emoji} {elem.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Caption */}
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  💬 Caption
                </label>
                
                {/* Caption Mode Toggle */}
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setCaptionMode("custom")}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
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
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      captionMode === "bank"
                        ? "bg-purple-600 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    🏦 Select from Bank
                  </button>
                </div>

                {captionMode === "custom" ? (
                  <textarea
                    value={formData.caption}
                    onChange={(e) =>
                      setFormData({ ...formData, caption: e.target.value })
                    }
                    rows={3}
                    className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none transition-all"
                    placeholder="Story caption..."
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

              {/* Notes */}
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  📝 Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-3 bg-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 resize-none transition-all"
                  placeholder="Planning notes, ideas, reminders..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 mt-8 pt-6 border-t-2 border-border">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowModal(false)}
                className="flex-1 px-6 py-3 bg-muted hover:bg-muted/80 text-foreground rounded-xl transition-all font-semibold"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={loading || uploading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-600/30 font-semibold"
              >
                <Save className="w-5 h-5" />
                {uploading ? "Uploading..." : loading ? "Saving..." : "Save Story"}
              </motion.button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
}
