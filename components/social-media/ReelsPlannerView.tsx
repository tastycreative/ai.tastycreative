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
  ChevronDown,
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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchReelSlots();
  }, [selectedDate, profileId]);

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
    setShowModal(true);
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
    if (uploadPreviewUrl) {
      URL.revokeObjectURL(uploadPreviewUrl);
    }
    setUploadedFile(null);
    setUploadPreviewUrl(null);
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
    setShowModal(true);
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

      if (uploadedFile) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", uploadedFile);
        formDataUpload.append("folder", "instagram/reels");

        const uploadResponse = await fetch("/api/s3/upload", {
          method: "POST",
          body: formDataUpload,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file");
        }

        const uploadData = await uploadResponse.json();
        fileData = {
          awsS3Key: uploadData.file.key,
          awsS3Url: uploadData.file.url,
          fileName: uploadData.file.name,
          mimeType: uploadData.file.mimeType,
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
        profileId: profileId,
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Video className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            Reels Planner
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Plan and schedule your Instagram Reels
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={openCreateModal}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl transition-all shadow-lg shadow-purple-600/30 font-semibold flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Reel
        </motion.button>
      </div>

      {/* Date Navigator */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#1a1a1a] border-2 border-[#2a2a2a] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevDay}
            className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>

          <div className="flex items-center gap-4">
            <CalendarIcon className="w-5 h-5 text-purple-500" />
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </h3>
              <p className="text-sm text-gray-400">
                {reelSlots.length} {reelSlots.length === 1 ? "reel" : "reels"} planned
              </p>
            </div>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
            >
              Today
            </button>
          </div>

          <button
            onClick={handleNextDay}
            className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Reels Grid */}
      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading reels...</p>
        </div>
      ) : sortedReelSlots.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4">
            <Video className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No reels planned for this day
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
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
              className="bg-gradient-to-br from-[#1a1a1a] to-[#252525] border-2 border-[#2a2a2a] rounded-2xl p-5 hover:border-purple-500/30 transition-all shadow-xl hover:shadow-2xl hover:shadow-purple-600/10"
            >
              {/* Time Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-[#2a2a2a]">
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
                    <Circle className="w-5 h-5 text-gray-400" />
                  )}
                </motion.button>
              </div>

              {/* Slot Content */}
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-[#2a2a2a] to-[#252525] rounded-xl p-3 border border-purple-500/10">
                  <div className="text-xs font-bold text-purple-400 mb-1.5 uppercase tracking-wide">Reel Type</div>
                  <div className="text-white font-semibold text-base">
                    {getReelTypeLabel(slot.reelType)}
                  </div>
                </div>

                {slot.hookIdea && (
                  <div className="bg-gradient-to-r from-[#2a2a2a] to-[#252525] rounded-xl p-3 border border-pink-500/10">
                    <div className="text-xs font-bold text-pink-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Hook Idea
                    </div>
                    <div className="text-white font-medium text-sm">
                      {slot.hookIdea}
                    </div>
                  </div>
                )}

                {slot.trendingAudio && (
                  <div className="bg-gradient-to-r from-[#2a2a2a] to-[#252525] rounded-xl p-3 border border-pink-500/10">
                    <div className="text-xs font-bold text-pink-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                      <Music className="w-3 h-3" />
                      Trending Audio
                    </div>
                    <div className="text-white font-medium text-sm truncate">
                      {slot.trendingAudio}
                    </div>
                  </div>
                )}

                {slot.caption && (
                  <div className="bg-gradient-to-r from-[#2a2a2a] to-[#252525] rounded-xl p-3 border border-blue-500/10">
                    <div className="text-xs font-bold text-blue-400 mb-1.5 uppercase tracking-wide">Caption</div>
                    <div className="text-white font-medium text-sm line-clamp-3">
                      {slot.caption}
                    </div>
                  </div>
                )}

                {slot.hashtags && slot.hashtags.length > 0 && (
                  <div className="bg-gradient-to-r from-[#2a2a2a] to-[#252525] rounded-xl p-3 border border-blue-500/10">
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
                  <div className="bg-gradient-to-r from-[#2a2a2a] to-[#252525] rounded-xl p-3 border border-purple-500/10">
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
                  <div className="bg-gradient-to-r from-[#2a2a2a] to-[#252525] rounded-xl p-3 border border-gray-500/10">
                    <div className="text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Notes</div>
                    <div className="text-gray-300 text-sm line-clamp-2">
                      {slot.notes}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openEditModal(slot)}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#2a2a2a] to-[#252525] hover:from-purple-600/20 hover:to-pink-600/20 text-white rounded-xl transition-all text-sm flex items-center justify-center gap-2 font-semibold border border-transparent hover:border-purple-500/30"
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
              className="relative bg-gradient-to-br from-[#1a1a1a] to-[#252525] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border-2 border-[#2a2a2a]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative bg-gradient-to-r from-purple-600 to-pink-600 p-5 text-white">
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
                {/* Time Picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-500" />
                    Posting Time
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={timeInput.hour}
                      onChange={(e) => setTimeInput({ ...timeInput, hour: e.target.value })}
                      className="px-3 py-2 bg-[#252525] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                      className="px-3 py-2 bg-[#252525] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                      className="px-3 py-2 bg-[#252525] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                {/* Reel Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Reel Type</label>
                  <select
                    value={formData.reelType}
                    onChange={(e) => setFormData({ ...formData, reelType: e.target.value })}
                    className="w-full px-3 py-2 bg-[#252525] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-purple-500" />
                    Upload Reel
                  </label>
                  {uploadPreviewUrl ? (
                    <div className="relative">
                      <div className="relative h-64 bg-black rounded-lg overflow-hidden">
                        <video src={uploadPreviewUrl} controls className="w-full h-full object-contain" />
                      </div>
                      <button
                        onClick={handleRemoveFile}
                        className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ) : (
                    <label className="block w-full p-8 border-2 border-dashed border-[#2a2a2a] rounded-lg hover:border-purple-500 transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <div className="text-center">
                        <Upload className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">Click to upload video</p>
                        <p className="text-xs text-gray-500 mt-1">MP4, MOV, WebM (max 50MB)</p>
                      </div>
                    </label>
                  )}
                </div>

                {/* Hook Idea */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-pink-500" />
                    Hook Idea
                  </label>
                  <input
                    type="text"
                    value={formData.hookIdea}
                    onChange={(e) => setFormData({ ...formData, hookIdea: e.target.value })}
                    placeholder="E.g., 'Watch this before...' or 'You won't believe...'"
                    className="w-full px-3 py-2 bg-[#252525] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500"
                  />
                </div>

                {/* Trending Audio */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Music className="w-4 h-4 text-pink-500" />
                    Trending Audio
                  </label>
                  <input
                    type="text"
                    value={formData.trendingAudio}
                    onChange={(e) => setFormData({ ...formData, trendingAudio: e.target.value })}
                    placeholder="Name of trending audio/song"
                    className="w-full px-3 py-2 bg-[#252525] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500"
                  />
                </div>

                {/* Caption */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Caption</label>
                  <textarea
                    value={formData.caption}
                    onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                    placeholder="Write your caption..."
                    rows={3}
                    className="w-full px-3 py-2 bg-[#252525] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 resize-none"
                  />
                </div>

                {/* Hashtags */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
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
                      className="flex-1 px-3 py-2 bg-[#252525] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500"
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
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    Notes & Ideas
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes, reminders, or ideas..."
                    rows={2}
                    className="w-full px-3 py-2 bg-[#252525] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[#2a2a2a] flex items-center justify-between">
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
                    className="px-5 py-2.5 bg-[#252525] hover:bg-[#2a2a2a] border border-[#2a2a2a] text-gray-300 rounded-xl transition-all text-sm"
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
