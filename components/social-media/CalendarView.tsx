"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Image as ImageIcon, Video, Clock } from "lucide-react";
import { fetchInstagramPosts, type InstagramPost } from "@/lib/instagram-posts";
import { useUser } from "@clerk/nextjs";

interface Post {
  id: string;
  fileName: string;
  image: string | null;
  caption: string;
  date: string | null;
  status: InstagramPost["status"];
  type: "POST" | "REEL" | "STORY";
  driveFileId?: string;
}

const CalendarView = () => {
  const { user, isLoaded } = useUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  // Check for Google Drive access token
  useEffect(() => {
    const token = localStorage.getItem("google_drive_access_token");
    if (token) {
      setGoogleAccessToken(token);
    }
  }, []);

  // Fetch posts
  useEffect(() => {
    const loadPosts = async () => {
      if (!isLoaded || !user) return;
      
      try {
        const dbPosts = await fetchInstagramPosts();
        const convertedPosts: Post[] = dbPosts.map((dbPost: InstagramPost) => ({
          id: dbPost.id,
          fileName: dbPost.fileName || "Untitled",
          image: null, // Will be loaded from Google Drive
          caption: dbPost.caption || "",
          date: dbPost.scheduledDate || dbPost.createdAt,
          status: dbPost.status as InstagramPost["status"],
          type: (dbPost.postType || "POST") as "POST" | "REEL" | "STORY",
          driveFileId: dbPost.driveFileId,
        }));
        setPosts(convertedPosts);
      } catch (error) {
        console.error("Failed to load posts:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, [isLoaded, user]);

  // Load blob URLs for posts from Google Drive
  useEffect(() => {
    const loadPostBlobUrls = async () => {
      if (!googleAccessToken) return;

      for (const post of posts) {
        if (post.driveFileId && !post.image) {
          try {
            const downloadUrl = `https://www.googleapis.com/drive/v3/files/${post.driveFileId}?alt=media`;
            const response = await fetch(downloadUrl, {
              headers: {
                Authorization: `Bearer ${googleAccessToken}`,
              },
            });

            if (response.ok) {
              const blob = await response.blob();
              const blobUrl = URL.createObjectURL(blob);
              setPosts((prev) =>
                prev.map((p) =>
                  p.id === post.id ? { ...p, image: blobUrl } : p
                )
              );
            }
          } catch (error) {
            console.error(`Error loading blob for post ${post.id}:`, error);
          }
        }
      }
    };

    loadPostBlobUrls();
  }, [posts.length, googleAccessToken]);

  // Get posts for a specific date
  const getPostsForDate = (date: Date) => {
    return posts.filter((post) => {
      if (!post.date) return false;
      const postDate = new Date(post.date);
      return (
        postDate.getDate() === date.getDate() &&
        postDate.getMonth() === date.getMonth() &&
        postDate.getFullYear() === date.getFullYear()
      );
    });
  };

  // Calendar generation
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty slots for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days in month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return "bg-blue-500";
      case "PUBLISHED":
        return "bg-green-500";
      case "APPROVED":
        return "bg-purple-500";
      case "REVIEW":
        return "bg-yellow-500";
      case "DRAFT":
        return "bg-gray-500";
      default:
        return "bg-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <CalendarIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{monthName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Scheduled This Month</p>
          </div>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {posts.filter((p) => {
              if (!p.date || p.status !== "SCHEDULED") return false;
              const postDate = new Date(p.date);
              return (
                postDate.getMonth() === currentDate.getMonth() &&
                postDate.getFullYear() === currentDate.getFullYear()
              );
            }).length}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
            <p className="text-xs font-medium text-green-700 dark:text-green-300">Posts</p>
          </div>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">
            {posts.filter((p) => p.type === "POST").length}
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Video className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <p className="text-xs font-medium text-purple-700 dark:text-purple-300">Reels</p>
          </div>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {posts.filter((p) => p.type === "REEL").length}
          </p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border border-orange-200 dark:border-orange-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <p className="text-xs font-medium text-orange-700 dark:text-orange-300">Stories</p>
          </div>
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
            {posts.filter((p) => p.type === "STORY").length}
          </p>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="p-3 text-center">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{day}</span>
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {days.map((date, index) => {
            const dayPosts = date ? getPostsForDate(date) : [];
            const today = isToday(date);

            return (
              <div
                key={index}
                className={`min-h-[120px] border-r border-b border-gray-200 dark:border-gray-700 p-2 ${
                  date ? "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors" : "bg-gray-50 dark:bg-gray-900/30"
                } ${today ? "ring-2 ring-blue-500 ring-inset" : ""}`}
                onClick={() => date && setSelectedDate(date)}
              >
                {date && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-sm font-medium ${
                          today
                            ? "bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      {dayPosts.length > 0 && (
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {dayPosts.length}
                        </span>
                      )}
                    </div>

                    {/* Post thumbnails */}
                    <div className="space-y-1">
                      {dayPosts.slice(0, 3).map((post) => (
                        <div
                          key={post.id}
                          className="flex items-center gap-1.5 p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(post.status)}`} />
                          <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">
                            {post.fileName}
                          </span>
                          {post.type === "REEL" && <Video className="w-3 h-3 text-gray-400" />}
                        </div>
                      ))}
                      {dayPosts.length > 3 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                          +{dayPosts.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            {getPostsForDate(selectedDate).length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No posts scheduled for this day</p>
            ) : (
              getPostsForDate(selectedDate).map((post) => (
                <div
                  key={post.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {/* Image or Placeholder */}
                  <div className="w-16 h-16 flex-shrink-0">
                    {post.image ? (
                      post.type === "REEL" ? (
                        <video
                          src={post.image}
                          className="w-full h-full object-cover rounded"
                          muted
                        />
                      ) : (
                        <img 
                          src={post.image} 
                          alt={post.fileName} 
                          className="w-full h-full object-cover rounded" 
                        />
                      )
                    ) : (
                      <div className="w-full h-full bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center">
                        {post.type === "REEL" ? (
                          <Video className="w-6 h-6 text-gray-400" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{post.fileName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{post.caption || "No caption"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(post.status)} text-white`}>
                        {post.status}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{post.type}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
