"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Video,
  Image as ImageIcon,
  Clock,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
  Sparkles,
  Music,
  Hash,
  Lightbulb,
  Link as LinkIcon,
  Repeat,
  CheckSquare,
  Square,
  MapPin,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { createPortal } from "react-dom";

type WeeklySlotType = "REEL_1" | "STORY_BATCH" | "FEED_POST";
type WeeklySlotStatus = "PLANNING" | "IN_PROGRESS" | "READY" | "POSTED";

interface WeeklySlot {
  id: string;
  date: string;
  slotType: WeeklySlotType;
  slotIndex: number;
  status: WeeklySlotStatus;
  notes?: string | null;
  hashtags: string[];
  trendingAudio?: string | null;
  contentIdeas?: string | null;
  linkedPostId?: string | null;
  profileId?: string | null;
  storyCount?: number; // Number of stories planned for this date
  reelCount?: number; // Number of reels planned for this date
  postedCount?: number; // Number of stories/reels posted for this date
  linkedPost?: {
    id: string;
    fileName: string;
    awsS3Url?: string | null;
    driveFileUrl?: string | null;
    caption: string;
    status: string;
    postType: string;
  } | null;
}

interface WeeklyCalendarViewProps {
  profileId?: string | null;
}

export default function WeeklyCalendarView({ profileId }: WeeklyCalendarViewProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const params = useParams();
  const tenant = params.tenant as string;
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);
    return start;
  });

  const [slots, setSlots] = useState<WeeklySlot[]>([]);
  const [storyCountsByDate, setStoryCountsByDate] = useState<Record<string, { total: number; posted: number }>>({});
  const [reelCountsByDate, setReelCountsByDate] = useState<Record<string, { total: number; posted: number }>>({});
  const [feedPostCountsByDate, setFeedPostCountsByDate] = useState<Record<string, { total: number; posted: number }>>({});
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, { name: string; profileImageUrl?: string; instagramUsername?: string }>>({});
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<WeeklySlot | null>(null);
  const [selectedDateStories, setSelectedDateStories] = useState<any[]>([]);
  const [selectedDateReels, setSelectedDateReels] = useState<any[]>([]);
  const [selectedDateFeedPosts, setSelectedDateFeedPosts] = useState<any[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);
  const [loadingReels, setLoadingReels] = useState(false);
  const [loadingFeedPosts, setLoadingFeedPosts] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{
    date: Date;
    slotType: WeeklySlotType;
  } | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set());

  const [slotForm, setSlotForm] = useState({
    status: "PLANNING" as WeeklySlotStatus,
    notes: "",
    hashtags: [] as string[],
    hashtagInput: "",
    trendingAudio: "",
    contentIdeas: "",
    linkedPostId: "",
    recurrence: "none" as "none" | "daily" | "weekly" | "every-other-day" | "weekdays" | "custom",
    recurrenceInterval: 1,
    recurrenceEndDate: "",
    recurrenceCount: 4,
  });

  // Generate week dates
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + i);
    return date;
  });

  // Load profiles
  useEffect(() => {
    if (!isLoaded || !user) return;
    const fetchProfiles = async () => {
      try {
        const response = await fetch('/api/instagram/profiles');
        if (response.ok) {
          const data = await response.json();
          const profileMap: Record<string, { name: string; profileImageUrl?: string; instagramUsername?: string }> = {};
          data.profiles?.forEach((p: any) => {
            profileMap[p.id] = {
              name: p.name,
              profileImageUrl: p.profileImageUrl,
              instagramUsername: p.instagramUsername,
            };
          });
          setProfiles(profileMap);
        }
      } catch (error) {
        console.error('Error fetching profiles:', error);
      }
    };
    fetchProfiles();
  }, [isLoaded, user]);

  // Load slots for current week
  useEffect(() => {
    if (!isLoaded || !user) return;
    loadWeeklySlots();
  }, [isLoaded, user, currentWeekStart, profileId]);

  const loadWeeklySlots = async () => {
    setLoading(true);
    try {
      const endDate = new Date(currentWeekStart);
      endDate.setDate(currentWeekStart.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);

      const params = new URLSearchParams({
        startDate: currentWeekStart.toISOString(),
        endDate: endDate.toISOString(),
      });

      if (profileId && profileId !== "all") {
        params.append("profileId", profileId);
      }

      const response = await fetch(`/api/instagram/weekly-slots?${params}`);
      if (!response.ok) throw new Error("Failed to load slots");

      const data = await response.json();
      setSlots(data.slots || []);
      setStoryCountsByDate(data.storyCountsByDate || {});
      setReelCountsByDate(data.reelCountsByDate || {});
      setFeedPostCountsByDate(data.feedPostCountsByDate || {});
    } catch (error) {
      console.error("Error loading weekly slots:", error);
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const goToCurrentWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);
    setCurrentWeekStart(start);
  };

  const getSlotForDateAndType = (date: Date, slotType: WeeklySlotType): WeeklySlot | undefined => {
    return slots.find((slot) => {
      const slotDate = new Date(slot.date);
      return (
        slotDate.getDate() === date.getDate() &&
        slotDate.getMonth() === date.getMonth() &&
        slotDate.getFullYear() === date.getFullYear() &&
        slot.slotType === slotType
      );
    });
  };

  const getStoryCountForDate = (date: Date) => {
    // Format date as YYYY-MM-DD using local timezone to match database storage
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    return storyCountsByDate[dateKey] || { total: 0, posted: 0 };
  };

  const getReelCountForDate = (date: Date) => {
    // Format date as YYYY-MM-DD using local timezone to match database storage
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    return reelCountsByDate[dateKey] || { total: 0, posted: 0 };
  };

  const getStoryBatchStatus = (date: Date): WeeklySlotStatus => {
    const counts = getStoryCountForDate(date);
    
    if (counts.total === 0) {
      return "PLANNING"; // No stories planned yet
    } else if (counts.posted === 0) {
      return "READY"; // Stories planned but none posted
    } else if (counts.posted < counts.total) {
      return "IN_PROGRESS"; // Some stories posted
    } else {
      return "POSTED"; // All stories posted (using POSTED instead of COMPLETED for consistency)
    }
  };

  const getReelStatus = (date: Date): WeeklySlotStatus => {
    const counts = getReelCountForDate(date);
    
    if (counts.total === 0) {
      return "PLANNING"; // No reels planned yet
    } else if (counts.posted === 0) {
      return "READY"; // Reels planned but none posted
    } else if (counts.posted < counts.total) {
      return "IN_PROGRESS"; // Some reels posted
    } else {
      return "POSTED"; // All reels posted
    }
  };

  const getFeedPostCountForDate = (date: Date) => {
    // Format date as YYYY-MM-DD using local timezone to match database storage
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    return feedPostCountsByDate[dateKey] || { total: 0, posted: 0 };
  };

  const getFeedPostStatus = (date: Date): WeeklySlotStatus => {
    const counts = getFeedPostCountForDate(date);
    
    if (counts.total === 0) {
      return "PLANNING"; // No feed posts planned yet
    } else if (counts.posted === 0) {
      return "READY"; // Feed posts planned but none posted
    } else if (counts.posted < counts.total) {
      return "IN_PROGRESS"; // Some feed posts posted
    } else {
      return "POSTED"; // All feed posts posted
    }
  };

  const handleCreateOrEditSlot = async (date: Date, slotType: WeeklySlotType) => {
    // Don't open modal if in selection mode
    if (selectionMode) return;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    // If clicking on STORY_BATCH with existing stories, fetch them
    if (slotType === 'STORY_BATCH') {
      const storyCount = getStoryCountForDate(date);
      if (storyCount.total > 0) {
        setLoadingStories(true);
        try {
          const params = new URLSearchParams({
            startDate: dateStr,
            endDate: dateStr,
          });
          if (profileId && profileId !== "all") {
            params.append("profileId", profileId);
          }
          const response = await fetch(`/api/instagram/story-slots?${params}`);
          if (response.ok) {
            const data = await response.json();
            setSelectedDateStories(data.slots || []);
          }
        } catch (error) {
          console.error('Error fetching stories:', error);
          setSelectedDateStories([]);
        } finally {
          setLoadingStories(false);
        }
      } else {
        setSelectedDateStories([]);
      }
      setSelectedDateReels([]);
      setSelectedDateFeedPosts([]);
    } else if (slotType === 'REEL_1') {
      // Fetch reels for this date
      const reelCount = getReelCountForDate(date);
      if (reelCount.total > 0) {
        setLoadingReels(true);
        try {
          const params = new URLSearchParams({
            startDate: dateStr,
            endDate: dateStr,
          });
          if (profileId && profileId !== "all") {
            params.append("profileId", profileId);
          }
          const response = await fetch(`/api/instagram/reel-slots?${params}`);
          if (response.ok) {
            const data = await response.json();
            setSelectedDateReels(data.slots || []);
          }
        } catch (error) {
          console.error('Error fetching reels:', error);
          setSelectedDateReels([]);
        } finally {
          setLoadingReels(false);
        }
      } else {
        setSelectedDateReels([]);
      }
      setSelectedDateStories([]);
      setSelectedDateFeedPosts([]);
    } else if (slotType === 'FEED_POST') {
      // Fetch feed posts for this date
      const feedPostCount = getFeedPostCountForDate(date);
      if (feedPostCount.total > 0) {
        setLoadingFeedPosts(true);
        try {
          const params = new URLSearchParams({
            startDate: dateStr,
            endDate: dateStr,
          });
          if (profileId && profileId !== "all") {
            params.append("profileId", profileId);
          }
          const response = await fetch(`/api/instagram/feed-post-slots?${params}`);
          if (response.ok) {
            const data = await response.json();
            setSelectedDateFeedPosts(data.slots || []);
          }
        } catch (error) {
          console.error('Error fetching feed posts:', error);
          setSelectedDateFeedPosts([]);
        } finally {
          setLoadingFeedPosts(false);
        }
      } else {
        setSelectedDateFeedPosts([]);
      }
      setSelectedDateStories([]);
      setSelectedDateReels([]);
    } else {
      setSelectedDateStories([]);
      setSelectedDateReels([]);
      setSelectedDateFeedPosts([]);
    }
    
    const existingSlot = getSlotForDateAndType(date, slotType);

    if (existingSlot) {
      setSelectedSlot(existingSlot);
      setSlotForm({
        status: existingSlot.status,
        notes: existingSlot.notes || "",
        hashtags: existingSlot.hashtags || [],
        hashtagInput: "",
        trendingAudio: existingSlot.trendingAudio || "",
        contentIdeas: existingSlot.contentIdeas || "",
        linkedPostId: existingSlot.linkedPostId || "",
        recurrence: "none",
        recurrenceInterval: 1,
        recurrenceEndDate: "",
        recurrenceCount: 4,
      });
    } else {
      setSelectedSlot(null);
      setEditingSlot({ date, slotType });
      setSlotForm({
        status: "PLANNING",
        notes: "",
        hashtags: [],
        hashtagInput: "",
        trendingAudio: "",
        contentIdeas: "",
        linkedPostId: "",
        recurrence: "none",
        recurrenceInterval: 1,
        recurrenceEndDate: "",
        recurrenceCount: 4,
      });
    }

    setShowSlotModal(true);
  };

  const toggleSlotSelection = (slotId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedSlotIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slotId)) {
        newSet.delete(slotId);
      } else {
        newSet.add(slotId);
      }
      return newSet;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedSlotIds.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedSlotIds.size} slot(s)?`)) return;

    try {
      const deletePromises = Array.from(selectedSlotIds).map(slotId =>
        fetch(`/api/instagram/weekly-slots/${slotId}`, {
          method: "DELETE",
        })
      );

      const results = await Promise.allSettled(deletePromises);
      const successCount = results.filter(r => r.status === "fulfilled").length;
      const failCount = results.filter(r => r.status === "rejected").length;

      setSlots(prev => prev.filter(s => !selectedSlotIds.has(s.id)));
      setSelectedSlotIds(new Set());
      setSelectionMode(false);

      if (failCount > 0) {
        alert(`Deleted ${successCount} slot(s). Failed to delete ${failCount} slot(s).`);
      } else {
        alert(`Successfully deleted ${successCount} slot(s).`);
      }
    } catch (error) {
      console.error("Error deleting slots:", error);
      alert("Failed to delete slots. Please try again.");
    }
  };

  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedSlotIds(new Set());
  };

  const handleSaveSlot = async () => {
    try {
      if (selectedSlot) {
        // Update existing slot
        const response = await fetch(`/api/instagram/weekly-slots/${selectedSlot.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: slotForm.status,
            notes: slotForm.notes,
            hashtags: slotForm.hashtags,
            trendingAudio: slotForm.trendingAudio,
            contentIdeas: slotForm.contentIdeas,
            linkedPostId: slotForm.linkedPostId || null,
          }),
        });

        if (!response.ok) throw new Error("Failed to update slot");

        const { slot: updatedSlot } = await response.json();
        setSlots((prev) =>
          prev.map((s) => (s.id === updatedSlot.id ? updatedSlot : s))
        );
      } else if (editingSlot) {
        // Generate recurrence dates
        const datesToCreate = generateRecurrenceDates(
          editingSlot.date,
          slotForm.recurrence,
          slotForm.recurrenceInterval,
          slotForm.recurrenceEndDate,
          slotForm.recurrenceCount
        );

        // Create slots for all dates
        const newSlots: WeeklySlot[] = [];
        const skippedDates: Date[] = [];
        const failedDates: Date[] = [];

        for (const date of datesToCreate) {
          // Check if slot already exists for this date and slot type
          const existingSlot = slots.find((slot) => {
            const slotDate = new Date(slot.date);
            return (
              slotDate.getDate() === date.getDate() &&
              slotDate.getMonth() === date.getMonth() &&
              slotDate.getFullYear() === date.getFullYear() &&
              slot.slotType === editingSlot.slotType
            );
          });

          if (existingSlot) {
            skippedDates.push(date);
            continue;
          }

          try {
            const response = await fetch("/api/instagram/weekly-slots", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                date: date.toISOString(),
                slotType: editingSlot.slotType,
                slotIndex: 0,
                status: slotForm.status,
                notes: slotForm.notes,
                hashtags: slotForm.hashtags,
                trendingAudio: slotForm.trendingAudio,
                contentIdeas: slotForm.contentIdeas,
                linkedPostId: slotForm.linkedPostId || null,
                profileId: profileId || null,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              console.error("Failed to create slot for date:", date, errorData);
              failedDates.push(date);
              continue;
            }

            const { slot: newSlot } = await response.json();
            newSlots.push(newSlot);
          } catch (error) {
            console.error("Error creating slot for date:", date, error);
            failedDates.push(date);
          }
        }

        if (newSlots.length > 0) {
          setSlots((prev) => [...prev, ...newSlots]);
        }

        // Show summary message
        let message = `Successfully created ${newSlots.length} slot(s)`;
        if (skippedDates.length > 0) {
          message += `\n\nSkipped ${skippedDates.length} date(s) that already have content planned:\n${skippedDates.map(d => d.toLocaleDateString()).join(", ")}`;
        }
        if (failedDates.length > 0) {
          message += `\n\nFailed to create ${failedDates.length} slot(s) for:\n${failedDates.map(d => d.toLocaleDateString()).join(", ")}`;
        }
        
        if (newSlots.length > 0 || skippedDates.length > 0) {
          alert(message);
        } else if (failedDates.length > 0) {
          throw new Error("Failed to create any slots. Please try again.");
        }
      }

      setShowSlotModal(false);
      setSelectedSlot(null);
      setEditingSlot(null);
    } catch (error) {
      console.error("Error saving slot:", error);
      alert("Failed to save slot. Please try again.");
    }
  };

  const generateRecurrenceDates = (
    startDate: Date,
    recurrence: string,
    interval: number,
    endDate: string,
    count: number
  ): Date[] => {
    const dates: Date[] = [new Date(startDate)];
    
    if (recurrence === "none") {
      return dates;
    }

    const maxDate = endDate ? new Date(endDate) : null;
    // Set end date to end of day for proper comparison
    if (maxDate) {
      maxDate.setHours(23, 59, 59, 999);
    }
    
    const maxCount = count || 10;
    let currentDate = new Date(startDate);

    // If end date is set, prioritize it over count; otherwise use count
    const iterationLimit = maxDate ? 365 : maxCount; // Use high limit if end date is set

    for (let i = 1; i < iterationLimit; i++) {
      const nextDate = new Date(currentDate);

      switch (recurrence) {
        case "daily":
          nextDate.setDate(currentDate.getDate() + interval);
          break;
        case "weekly":
          nextDate.setDate(currentDate.getDate() + (7 * interval));
          break;
        case "every-other-day":
          nextDate.setDate(currentDate.getDate() + 2);
          break;
        case "weekdays":
          // Skip to next weekday
          do {
            nextDate.setDate(nextDate.getDate() + 1);
          } while (nextDate.getDay() === 0 || nextDate.getDay() === 6);
          break;
        case "custom":
          nextDate.setDate(currentDate.getDate() + interval);
          break;
      }

      // Check end date first (if set)
      if (maxDate && nextDate > maxDate) {
        break;
      }

      // Check count limit only if no end date is set
      if (!maxDate && dates.length >= maxCount) {
        break;
      }

      dates.push(new Date(nextDate));
      currentDate = nextDate;
    }

    return dates;
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm("Are you sure you want to delete this slot?")) return;

    try {
      const response = await fetch(`/api/instagram/weekly-slots/${slotId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete slot");

      setSlots((prev) => prev.filter((s) => s.id !== slotId));
      setShowSlotModal(false);
    } catch (error) {
      console.error("Error deleting slot:", error);
      alert("Failed to delete slot. Please try again.");
    }
  };

  const addHashtag = () => {
    const tag = slotForm.hashtagInput.trim();
    if (tag && !slotForm.hashtags.includes(tag)) {
      setSlotForm({
        ...slotForm,
        hashtags: [...slotForm.hashtags, tag.startsWith("#") ? tag : `#${tag}`],
        hashtagInput: "",
      });
    }
  };

  const removeHashtag = (tag: string) => {
    setSlotForm({
      ...slotForm,
      hashtags: slotForm.hashtags.filter((h) => h !== tag),
    });
  };

  const getStatusColor = (status: WeeklySlotStatus) => {
    switch (status) {
      case "PLANNING":
        return "bg-gray-500";
      case "IN_PROGRESS":
        return "bg-yellow-500";
      case "READY":
        return "bg-blue-500";
      case "POSTED":
        return "bg-green-500";
      default:
        return "bg-gray-400";
    }
  };

  const getSlotTypeLabel = (slotType: WeeklySlotType) => {
    switch (slotType) {
      case "REEL_1":
        return "Reel";
      case "STORY_BATCH":
        return "Stories";
      case "FEED_POST":
        return "Feed Post";
    }
  };

  const getSlotTypeIcon = (slotType: WeeklySlotType) => {
    switch (slotType) {
      case "REEL_1":
        return Video;
      case "STORY_BATCH":
        return Clock;
      case "FEED_POST":
        return ImageIcon;
    }
  };

  const weekStartFormatted = currentWeekStart.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const weekEndDate = new Date(currentWeekStart);
  weekEndDate.setDate(currentWeekStart.getDate() + 6);
  const weekEndFormatted = weekEndDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-brand-blue)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-4">
          <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--color-brand-blue)]" />
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-foreground">
              Week of {weekStartFormatted}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {weekStartFormatted} - {weekEndFormatted}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {!selectionMode ? (
            <>
              <button
                onClick={() => setSelectionMode(true)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-[var(--color-brand-mid-pink)] hover:bg-[var(--color-brand-mid-pink)]/10 rounded-lg transition-colors active:scale-95 flex items-center gap-1.5"
              >
                <CheckSquare className="w-4 h-4" />
                Select
              </button>
              <button
                onClick={goToCurrentWeek}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors active:scale-95"
              >
                This Week
              </button>
            </>
          ) : (
            <>
              <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                {selectedSlotIds.size} selected
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={selectedSlotIds.size === 0}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-muted disabled:cursor-not-allowed rounded-lg transition-colors active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button
                onClick={handleCancelSelection}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors active:scale-95"
              >
                Cancel
              </button>
            </>
          )}
          <button
            onClick={goToPreviousWeek}
            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors active:scale-95"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={goToNextWeek}
            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors active:scale-95"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Weekly Planning Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg">
        {/* Day Headers */}
        <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
          <div className="p-3 border-r border-gray-200 dark:border-gray-700">
            <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300">
              Content Type
            </span>
          </div>
          {weekDates.map((date, index) => {
            const isToday =
              date.getDate() === new Date().getDate() &&
              date.getMonth() === new Date().getMonth() &&
              date.getFullYear() === new Date().getFullYear();

            return (
              <div
                key={index}
                className={`p-2 sm:p-3 text-center ${
                  index < 6 ? "border-r border-border" : ""
                } ${isToday ? "bg-blue-100 dark:bg-blue-900/30" : ""}`}
              >
                <div className="text-[10px] sm:text-xs font-semibold text-gray-600 dark:text-gray-400">
                  {date.toLocaleDateString("en-US", { weekday: "short" })}
                </div>
                <div
                  className={`text-sm sm:text-base font-bold mt-0.5 ${
                    isToday
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-900 dark:text-white"
                  }`}
                >
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Slot Rows */}
        {(["REEL_1", "STORY_BATCH", "FEED_POST"] as WeeklySlotType[]).map(
          (slotType) => {
            const Icon = getSlotTypeIcon(slotType);

            return (
              <div
                key={slotType}
                className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
              >
                {/* Slot Type Label */}
                <div className="p-3 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex items-center gap-2">
                  <Icon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {getSlotTypeLabel(slotType)}
                  </span>
                </div>

                {/* Day Cells */}
                {weekDates.map((date, dayIndex) => {
                  const slot = getSlotForDateAndType(date, slotType);

                  return (
                    <div
                      key={dayIndex}
                      className={`p-2 min-h-[80px] sm:min-h-[100px] relative ${
                        dayIndex < 6 ? "border-r border-gray-200 dark:border-gray-700" : ""
                      } ${selectionMode ? "" : "hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer group"}`}
                      onClick={() => !selectionMode && handleCreateOrEditSlot(date, slotType)}
                    >
                      {slot ? (
                        // Existing slot
                        <div className="space-y-1.5 relative">
                          {selectionMode && (
                            <div
                              className="absolute -top-1 -left-1 z-10"
                              onClick={(e) => toggleSlotSelection(slot.id, e)}
                            >
                              <button className="p-1 bg-white dark:bg-gray-800 rounded border-2 border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 transition-colors">
                                {selectedSlotIds.has(slot.id) ? (
                                  <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                            </div>
                          )}
                          {/* Profile indicator when viewing all profiles */}
                          {profileId === 'all' && slot.profileId && profiles[slot.profileId] && (
                            <div className="flex items-center gap-1 mb-1">
                              {profiles[slot.profileId].profileImageUrl ? (
                                <img
                                  src={profiles[slot.profileId].profileImageUrl}
                                  alt={profiles[slot.profileId].name}
                                  className="w-3 h-3 rounded-full object-cover ring-1 ring-white/20"
                                />
                              ) : (
                                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 ring-1 ring-white/20" />
                              )}
                              <span className="text-[8px] sm:text-[9px] font-medium text-white/60 truncate">
                                {profiles[slot.profileId].name}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full text-white ${getStatusColor(
                                slot.status
                              )}`}
                            >
                              {slot.status}
                            </span>
                            <div className="flex items-center gap-1">
                              {slot.linkedPost && (
                                <LinkIcon className="w-3 h-3 text-green-500" />
                              )}
                              {slotType === "STORY_BATCH" && slot.storyCount !== undefined && slot.storyCount > 0 && (
                                <div className="flex items-center gap-0.5 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded-full">
                                  <Clock className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" />
                                  <span className="text-[9px] font-semibold text-purple-700 dark:text-purple-300">
                                    {slot.postedCount}/{slot.storyCount}
                                  </span>
                                </div>
                              )}
                              {slotType === "REEL_1" && slot.reelCount !== undefined && slot.reelCount > 0 && (
                                <div className="flex items-center gap-0.5 bg-pink-100 dark:bg-pink-900/30 px-1.5 py-0.5 rounded-full">
                                  <Video className="w-2.5 h-2.5 text-pink-600 dark:text-pink-400" />
                                  <span className="text-[9px] font-semibold text-pink-700 dark:text-pink-300">
                                    {slot.postedCount}/{slot.reelCount}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {slotType === "STORY_BATCH" && slot.storyCount !== undefined && slot.storyCount > 0 && (
                            <p className="text-[9px] sm:text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                              {slot.storyCount} {slot.storyCount === 1 ? 'story' : 'stories'} planned
                            </p>
                          )}

                          {slotType === "REEL_1" && slot.reelCount !== undefined && slot.reelCount > 0 && (
                            <p className="text-[9px] sm:text-[10px] text-pink-600 dark:text-pink-400 font-medium">
                              {slot.reelCount} {slot.reelCount === 1 ? 'reel' : 'reels'} planned
                            </p>
                          )}

                          {slot.notes && (
                            <p className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 line-clamp-2">
                              {slot.notes}
                            </p>
                          )}

                          {slot.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-0.5">
                              {slot.hashtags.slice(0, 2).map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-[8px] sm:text-[9px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1 py-0.5 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                              {slot.hashtags.length > 2 && (
                                <span className="text-[8px] sm:text-[9px] text-gray-500">
                                  +{slot.hashtags.length - 2}
                                </span>
                              )}
                            </div>
                          )}

                          {slot.trendingAudio && (
                            <div className="flex items-center gap-1">
                              <Music className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-pink-500" />
                              <span className="text-[8px] sm:text-[9px] text-gray-600 dark:text-gray-400 truncate">
                                {slot.trendingAudio}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        // Empty slot
                        <div className="flex flex-col items-center justify-center h-full gap-1 relative">
                          {slotType === "STORY_BATCH" && getStoryCountForDate(date).total > 0 ? (
                            // Show story count indicator on empty STORY_BATCH cells
                            <>
                              {(() => {
                                const status = getStoryBatchStatus(date);
                                const statusColor = getStatusColor(status);
                                return (
                                  <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 ${statusColor} rounded-full border-2 border-white dark:border-gray-800 z-10`} />
                                );
                              })()}
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-full">
                                  <Clock className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                  <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                                    {getStoryCountForDate(date).posted}/{getStoryCountForDate(date).total}
                                  </span>
                                </div>
                                <p className="text-[9px] text-center text-purple-600 dark:text-purple-400">
                                  {getStoryCountForDate(date).total} {getStoryCountForDate(date).total === 1 ? 'story' : 'stories'}
                                </p>
                                {(() => {
                                  const status = getStoryBatchStatus(date);
                                  return (
                                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                                      status === 'PLANNING' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' :
                                      status === 'READY' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                      status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                    }`}>
                                      {status === 'POSTED' ? 'COMPLETED' : status.replace('_', ' ')}
                                    </span>
                                  );
                                })()}
                              </div>
                            </>
                          ) : slotType === "REEL_1" && getReelCountForDate(date).total > 0 ? (
                            // Show reel count indicator on empty REEL_1 cells
                            <>
                              {(() => {
                                const status = getReelStatus(date);
                                const statusColor = getStatusColor(status);
                                return (
                                  <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 ${statusColor} rounded-full border-2 border-white dark:border-gray-800 z-10`} />
                                );
                              })()}
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 bg-pink-100 dark:bg-pink-900/30 px-2 py-1 rounded-full">
                                  <Video className="w-3 h-3 text-pink-600 dark:text-pink-400" />
                                  <span className="text-[10px] font-semibold text-pink-700 dark:text-pink-300">
                                    {getReelCountForDate(date).posted}/{getReelCountForDate(date).total}
                                  </span>
                                </div>
                                <p className="text-[9px] text-center text-pink-600 dark:text-pink-400">
                                  {getReelCountForDate(date).total} {getReelCountForDate(date).total === 1 ? 'reel' : 'reels'}
                                </p>
                                {(() => {
                                  const status = getReelStatus(date);
                                  return (
                                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                                      status === 'PLANNING' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' :
                                      status === 'READY' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                      status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                    }`}>
                                      {status === 'POSTED' ? 'COMPLETED' : status.replace('_', ' ')}
                                    </span>
                                  );
                                })()}
                              </div>
                            </>
                          ) : slotType === "FEED_POST" && getFeedPostCountForDate(date).total > 0 ? (
                            // Show feed post count indicator on empty FEED_POST cells
                            <>
                              {(() => {
                                const status = getFeedPostStatus(date);
                                const statusColor = getStatusColor(status);
                                return (
                                  <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 ${statusColor} rounded-full border-2 border-white dark:border-gray-800 z-10`} />
                                );
                              })()}
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full">
                                  <ImageIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                  <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                                    {getFeedPostCountForDate(date).posted}/{getFeedPostCountForDate(date).total}
                                  </span>
                                </div>
                                <p className="text-[9px] text-center text-blue-600 dark:text-blue-400">
                                  {getFeedPostCountForDate(date).total} {getFeedPostCountForDate(date).total === 1 ? 'post' : 'posts'}
                                </p>
                                {(() => {
                                  const status = getFeedPostStatus(date);
                                  return (
                                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                                      status === 'PLANNING' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' :
                                      status === 'READY' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                      status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                    }`}>
                                      {status === 'POSTED' ? 'COMPLETED' : status.replace('_', ' ')}
                                    </span>
                                  );
                                })()}
                              </div>
                            </>
                          ) : slotType === "STORY_BATCH" ? (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                              <span className="text-[9px] text-gray-500 dark:text-gray-400">Add Stories</span>
                            </div>
                          ) : slotType === "REEL_1" ? (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                              <span className="text-[9px] text-gray-500 dark:text-gray-400">Add Reel</span>
                            </div>
                          ) : (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                              <span className="text-[9px] text-gray-500 dark:text-gray-400">Add</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          }
        )}
      </div>

      {/* Slot Edit Modal */}
      {showSlotModal && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSlotModal(false)}
          />

          <div
            className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
              <button
                onClick={() => {
                  setShowSlotModal(false);
                  setSelectedDateStories([]);
                  setSelectedDateReels([]);
                  setSelectedDateFeedPosts([]);
                }}
                className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">
                    {selectedSlot ? "Edit Slot" : "Create Planning Slot"}
                  </h3>
                  <p className="text-sm text-purple-100 mt-0.5">
                    {editingSlot &&
                      `${editingSlot.date.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })} - ${getSlotTypeLabel(editingSlot.slotType)}`}
                    {selectedSlot &&
                      `${new Date(selectedSlot.date).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })} - ${getSlotTypeLabel(selectedSlot.slotType)}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] space-y-4">
              {/* Reels Preview - Only show for REEL_1 */}
              {editingSlot?.slotType === 'REEL_1' && selectedDateReels.length > 0 && (
                <div className="bg-gradient-to-r from-pink-50 to-red-50 dark:from-pink-900/20 dark:to-red-900/20 p-4 rounded-xl border-2 border-pink-200 dark:border-pink-800 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Video className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                    <h3 className="text-sm font-bold text-pink-900 dark:text-pink-100">
                      Planned Reels for this Day ({selectedDateReels.length})
                    </h3>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedDateReels.map((reel: any) => (
                      <div key={reel.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-pink-200 dark:border-pink-700">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-pink-600 dark:text-pink-400">
                                {reel.timeSlot ? new Date(reel.timeSlot).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'No time set'}
                              </span>
                              {reel.isPosted && (
                                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">Posted</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">{reel.reelType.replace('_', ' ')}</p>
                            {reel.caption && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{reel.caption}</p>
                            )}
                          </div>
                          {reel.awsS3Url && (
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                              {reel.mimeType?.startsWith('video/') ? (
                                <video src={reel.awsS3Url} className="w-full h-full object-cover" />
                              ) : (
                                <img src={reel.awsS3Url} alt="Reel" className="w-full h-full object-cover" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const year = editingSlot.date.getFullYear();
                      const month = String(editingSlot.date.getMonth() + 1).padStart(2, '0');
                      const day = String(editingSlot.date.getDate()).padStart(2, '0');
                      const dateStr = `${year}-${month}-${day}`;
                      const profileParam = profileId && profileId !== 'all' ? `?profile=${profileId}&date=${dateStr}` : `?date=${dateStr}`;
                      router.push(`/${tenant}/workspace/content-studio/reels${profileParam}`);
                    }}
                    className="mt-3 w-full px-3 py-2 text-xs font-medium text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-900/30 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit Reels in Reels Planner
                  </button>
                </div>
              )}

              {/* Feed Posts Preview - Only show for FEED_POST */}
              {editingSlot?.slotType === 'FEED_POST' && selectedDateFeedPosts.length > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ImageIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100">
                      Planned Feed Posts for this Day ({selectedDateFeedPosts.length})
                    </h3>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedDateFeedPosts.map((post: any) => (
                      <div key={post.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                {post.timeSlot ? new Date(post.timeSlot).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'No time set'}
                              </span>
                              {post.isPosted && (
                                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">Posted</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">{post.postType.replace('_', ' ')}</p>
                            {post.caption && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{post.caption}</p>
                            )}
                            {post.location && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3" />
                                {post.location}
                              </p>
                            )}
                          </div>
                          {post.files && post.files.length > 0 && (
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                              {post.files[0].mimeType?.startsWith('video/') ? (
                                <video src={post.files[0].awsS3Url} className="w-full h-full object-cover" />
                              ) : (
                                <img src={post.files[0].awsS3Url} alt="Feed post" className="w-full h-full object-cover" />
                              )}
                              {post.files.length > 1 && (
                                <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">+{post.files.length - 1}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const year = editingSlot.date.getFullYear();
                      const month = String(editingSlot.date.getMonth() + 1).padStart(2, '0');
                      const day = String(editingSlot.date.getDate()).padStart(2, '0');
                      const dateStr = `${year}-${month}-${day}`;
                      const profileParam = profileId && profileId !== 'all' ? `?profile=${profileId}&date=${dateStr}` : `?date=${dateStr}`;
                      router.push(`/${tenant}/workspace/content-studio/feed-posts${profileParam}`);
                    }}
                    className="mt-3 w-full px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit Feed Posts in Feed Post Planner
                  </button>
                </div>
              )}

              {/* Stories Preview - Only show for STORY_BATCH */}
              {editingSlot?.slotType === 'STORY_BATCH' && selectedDateStories.length > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border-2 border-purple-200 dark:border-purple-800 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <h3 className="text-sm font-bold text-purple-900 dark:text-purple-100">
                      Planned Stories for this Day ({selectedDateStories.length})
                    </h3>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedDateStories.map((story: any) => (
                      <div key={story.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{story.timeSlot}</span>
                              {story.isPosted && (
                                <span className="inline-flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Posted
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">{story.storyType}</p>
                            {story.notes && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{story.notes}</p>
                            )}
                          </div>
                          {story.awsS3Url && (
                            <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-gray-100 dark:bg-gray-700">
                              {story.mimeType?.startsWith('video/') ? (
                                <video src={story.awsS3Url} className="w-full h-full object-cover" />
                              ) : (
                                <img src={story.awsS3Url} alt="Story" className="w-full h-full object-cover" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const year = editingSlot.date.getFullYear();
                      const month = String(editingSlot.date.getMonth() + 1).padStart(2, '0');
                      const day = String(editingSlot.date.getDate()).padStart(2, '0');
                      const dateStr = `${year}-${month}-${day}`;
                      const profileParam = profileId && profileId !== 'all' ? `?profile=${profileId}&date=${dateStr}` : `?date=${dateStr}`;
                      router.push(`/${tenant}/workspace/content-studio/stories${profileParam}`);
                    }}
                    className="mt-3 w-full px-3 py-2 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit Stories in Stories Planner
                  </button>
                </div>
              )}

              {/* For STORY_BATCH, REEL_1, FEED_POST: Show simplified view */}
              {(editingSlot?.slotType === 'STORY_BATCH' || selectedSlot?.slotType === 'STORY_BATCH') ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4">
                    <Clock className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Stories Planning
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    {selectedDateStories.length > 0 
                      ? `You have ${selectedDateStories.length} ${selectedDateStories.length === 1 ? 'story' : 'stories'} planned for this day. Click below to add more or edit them.`
                      : 'No stories planned yet for this day. Click below to start planning your stories.'
                    }
                  </p>
                  <button
                    onClick={() => {
                      const targetDate = selectedSlot?.date || editingSlot?.date;
                      if (targetDate) {
                        const year = new Date(targetDate).getFullYear();
                        const month = String(new Date(targetDate).getMonth() + 1).padStart(2, '0');
                        const day = String(new Date(targetDate).getDate()).padStart(2, '0');
                        const dateStr = `${year}-${month}-${day}`;
                        const profileParam = profileId && profileId !== 'all' ? `?profile=${profileId}&date=${dateStr}` : `?date=${dateStr}`;
                        router.push(`/${tenant}/workspace/content-studio/stories${profileParam}`);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-colors font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    Go to Stories Planner
                  </button>
                </div>
              ) : (editingSlot?.slotType === 'REEL_1' || selectedSlot?.slotType === 'REEL_1') ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-pink-100 dark:bg-pink-900/30 mb-4">
                    <Video className="w-8 h-8 text-pink-600 dark:text-pink-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Reels Planning
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    {selectedDateReels.length > 0 
                      ? `You have ${selectedDateReels.length} ${selectedDateReels.length === 1 ? 'reel' : 'reels'} planned for this day. Click below to add more or edit them.`
                      : 'No reels planned yet for this day. Click below to start planning your reels.'
                    }
                  </p>
                  <button
                    onClick={() => {
                      const targetDate = selectedSlot?.date || editingSlot?.date;
                      if (targetDate) {
                        const year = new Date(targetDate).getFullYear();
                        const month = String(new Date(targetDate).getMonth() + 1).padStart(2, '0');
                        const day = String(new Date(targetDate).getDate()).padStart(2, '0');
                        const dateStr = `${year}-${month}-${day}`;
                        const profileParam = profileId && profileId !== 'all' ? `?profile=${profileId}&date=${dateStr}` : `?date=${dateStr}`;
                        router.push(`/${tenant}/workspace/content-studio/reels${profileParam}`);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-700 hover:to-red-700 text-white rounded-lg transition-colors font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    Go to Reels Planner
                  </button>
                </div>
              ) : (editingSlot?.slotType === 'FEED_POST' || selectedSlot?.slotType === 'FEED_POST') ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
                    <ImageIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Feed Posts Planning
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    {selectedDateFeedPosts.length > 0 
                      ? `You have ${selectedDateFeedPosts.length} feed ${selectedDateFeedPosts.length === 1 ? 'post' : 'posts'} planned for this day. Click below to add more or edit them.`
                      : 'No feed posts planned yet for this day. Click below to start planning your feed posts.'
                    }
                  </p>
                  <button
                    onClick={() => {
                      const targetDate = selectedSlot?.date || editingSlot?.date;
                      if (targetDate) {
                        const year = new Date(targetDate).getFullYear();
                        const month = String(new Date(targetDate).getMonth() + 1).padStart(2, '0');
                        const day = String(new Date(targetDate).getDate()).padStart(2, '0');
                        const dateStr = `${year}-${month}-${day}`;
                        const profileParam = profileId && profileId !== 'all' ? `?profile=${profileId}&date=${dateStr}` : `?date=${dateStr}`;
                        router.push(`/${tenant}/workspace/content-studio/feed-posts${profileParam}`);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg transition-colors font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    Go to Feed Post Planner
                  </button>
                </div>
              ) : (
                <>
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={slotForm.status}
                  onChange={(e) =>
                    setSlotForm({
                      ...slotForm,
                      status: e.target.value as WeeklySlotStatus,
                    })
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="PLANNING">Planning</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="READY">Ready</option>
                  <option value="POSTED">Posted</option>
                </select>
              </div>

              {/* Recurrence - Only show when creating new slot */}
              {!selectedSlot && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border-2 border-purple-200 dark:border-purple-800">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    <Repeat className="w-4 h-4 text-purple-600" />
                    Repeat This Task
                  </label>
                  <select
                    value={slotForm.recurrence}
                    onChange={(e) =>
                      setSlotForm({
                        ...slotForm,
                        recurrence: e.target.value as any,
                      })
                    }
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3"
                  >
                    <option value="none">One-time (no repeat)</option>
                    <option value="daily">Daily</option>
                    <option value="every-other-day">Every other day</option>
                    <option value="weekdays">Weekdays only (Mon-Fri)</option>
                    <option value="weekly">Weekly</option>
                    <option value="custom">Custom interval</option>
                  </select>

                  {slotForm.recurrence !== "none" && (
                    <div className="space-y-3">
                      {(slotForm.recurrence === "custom" || slotForm.recurrence === "daily" || slotForm.recurrence === "weekly") && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            {slotForm.recurrence === "weekly" ? "Repeat every X weeks" : "Repeat every X days"}
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={slotForm.recurrenceInterval}
                            onChange={(e) =>
                              setSlotForm({
                                ...slotForm,
                                recurrenceInterval: parseInt(e.target.value) || 1,
                              })
                            }
                            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Number of occurrences
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="52"
                            value={slotForm.recurrenceCount}
                            onChange={(e) =>
                              setSlotForm({
                                ...slotForm,
                                recurrenceCount: parseInt(e.target.value) || 4,
                              })
                            }
                            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Or end date (optional)
                          </label>
                          <input
                            type="date"
                            value={slotForm.recurrenceEndDate}
                            onChange={(e) =>
                              setSlotForm({
                                ...slotForm,
                                recurrenceEndDate: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-semibold">Preview:</span> This will create{" "}
                          <span className="font-bold text-purple-600 dark:text-purple-400">
                            {generateRecurrenceDates(
                              editingSlot?.date || new Date(),
                              slotForm.recurrence,
                              slotForm.recurrenceInterval,
                              slotForm.recurrenceEndDate,
                              slotForm.recurrenceCount
                            ).length}
                          </span>{" "}
                          recurring slot(s)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Lightbulb className="w-4 h-4 text-yellow-500" />
                  Notes & Ideas
                </label>
                <textarea
                  value={slotForm.notes}
                  onChange={(e) =>
                    setSlotForm({ ...slotForm, notes: e.target.value })
                  }
                  placeholder="Add your content ideas, notes, or reminders..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Trending Audio */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Music className="w-4 h-4 text-pink-500" />
                  Trending Audio
                </label>
                <input
                  type="text"
                  value={slotForm.trendingAudio}
                  onChange={(e) =>
                    setSlotForm({ ...slotForm, trendingAudio: e.target.value })
                  }
                  placeholder="e.g., 'Just Give Me My Money' by The Notorious B.I.G."
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Hashtags */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Hash className="w-4 h-4 text-blue-500" />
                  Hashtags
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={slotForm.hashtagInput}
                    onChange={(e) =>
                      setSlotForm({ ...slotForm, hashtagInput: e.target.value })
                    }
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addHashtag();
                      }
                    }}
                    placeholder="Add hashtag..."
                    className="flex-1 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={addHashtag}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {slotForm.hashtags.map((tag, index) => (
                    <span
                      key={index}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        onClick={() => removeHashtag(tag)}
                        className="hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Content Ideas */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Content Ideas
                </label>
                <textarea
                  value={slotForm.contentIdeas}
                  onChange={(e) =>
                    setSlotForm({ ...slotForm, contentIdeas: e.target.value })
                  }
                  placeholder="Detailed content ideas, hooks, structure, etc."
                  rows={4}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              </>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-900/10 dark:to-pink-900/10">
              {/* Only show footer for slots without planners (not STORY_BATCH, REEL_1, or FEED_POST) */}
              {(editingSlot?.slotType !== 'STORY_BATCH' && selectedSlot?.slotType !== 'STORY_BATCH' && 
                editingSlot?.slotType !== 'REEL_1' && selectedSlot?.slotType !== 'REEL_1' &&
                editingSlot?.slotType !== 'FEED_POST' && selectedSlot?.slotType !== 'FEED_POST') && (
                <>
              {selectedSlot && (
                <button
                  onClick={() => handleDeleteSlot(selectedSlot.id)}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
              <div className={`flex gap-3 ${!selectedSlot ? "w-full justify-end" : ""}`}>
                <button
                  onClick={() => {
                    setShowSlotModal(false);
                    setSelectedDateStories([]);
                    setSelectedDateReels([]);
                    setSelectedDateFeedPosts([]);
                  }}
                  className="px-6 py-2.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSlot}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-medium transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Save
                </button>
              </div>
              </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
