"use client";

import React, { useState, useEffect } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Image as ImageIcon, 
  Video, 
  Clock,
  X,
  Eye,
  Edit2,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { fetchInstagramPosts, type InstagramPost } from "@/lib/instagram-posts";
import { useUser } from "@clerk/nextjs";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface Post {
  id: string;
  fileName: string;
  image: string | null;
  caption: string;
  date: string | null;
  status: InstagramPost["status"];
  type: "POST" | "REEL" | "STORY";
  driveFileId?: string | null;
  driveFileUrl?: string | null;
  awsS3Key?: string | null;
  awsS3Url?: string | null;
  mimeType?: string | null;
}

const CalendarView = () => {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingPost, setViewingPost] = useState<Post | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editForm, setEditForm] = useState({
    caption: "",
    scheduledDate: "",
    status: "DRAFT" as Post["status"],
    postType: "POST" as Post["type"],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch posts
  useEffect(() => {
    const loadPosts = async () => {
      if (!isLoaded || !user) return;
      
      try {
        const dbPosts = await fetchInstagramPosts();
        const convertedPosts: Post[] = dbPosts.map((dbPost: InstagramPost) => ({
          id: dbPost.id,
          fileName: dbPost.fileName || "Untitled",
          image: dbPost.awsS3Url || dbPost.driveFileUrl || null,
          caption: dbPost.caption || "",
          date: dbPost.scheduledDate || dbPost.createdAt,
          status: dbPost.status as InstagramPost["status"],
          type: (dbPost.postType || "POST") as "POST" | "REEL" | "STORY",
          driveFileId: dbPost.driveFileId,
          driveFileUrl: dbPost.driveFileUrl,
          awsS3Key: dbPost.awsS3Key,
          awsS3Url: dbPost.awsS3Url,
          mimeType: dbPost.mimeType,
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

  const handleViewPost = (post: Post) => {
    setViewingPost(post);
    setShowViewModal(true);
  };

  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setEditForm({
      caption: post.caption || "",
      scheduledDate: post.date ? new Date(post.date).toISOString().slice(0, 16) : "",
      status: post.status,
      postType: post.type,
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/instagram/posts/${editingPost.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caption: editForm.caption,
          scheduledDate: editForm.scheduledDate ? new Date(editForm.scheduledDate).toISOString() : null,
          status: editForm.status,
          postType: editForm.postType,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update post");
      }

      // Update local state
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === editingPost.id
            ? {
                ...post,
                caption: editForm.caption,
                date: editForm.scheduledDate ? new Date(editForm.scheduledDate).toISOString() : post.date,
                status: editForm.status,
                type: editForm.postType,
              }
            : post
        )
      );

      setShowEditModal(false);
      setEditingPost(null);
      
      // Show success message
      alert("✅ Post updated successfully!");
    } catch (error) {
      console.error("Error updating post:", error);
      alert("❌ Failed to update post. Please try again.");
    } finally {
      setIsSaving(false);
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-4">
          <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{monthName}</h2>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={goToToday}
            className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors active:scale-95"
          >
            Today
          </button>
          <button
            onClick={goToPreviousMonth}
            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors active:scale-95"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={goToNextMonth}
            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors active:scale-95"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Calendar Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700/30 rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
            <p className="text-[10px] sm:text-xs font-medium text-blue-700 dark:text-blue-300">Scheduled This Month</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-300">
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

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-700/30 rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 dark:text-green-400" />
            <p className="text-[10px] sm:text-xs font-medium text-green-700 dark:text-green-300">Posts</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-300">
            {posts.filter((p) => p.type === "POST").length}
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-700/30 rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 dark:text-purple-400" />
            <p className="text-[10px] sm:text-xs font-medium text-purple-700 dark:text-purple-300">Reels</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-purple-700 dark:text-purple-300">
            {posts.filter((p) => p.type === "REEL").length}
          </p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border border-orange-200 dark:border-orange-700/30 rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600 dark:text-orange-400" />
            <p className="text-[10px] sm:text-xs font-medium text-orange-700 dark:text-orange-300">Stories</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-orange-700 dark:text-orange-300">
            {posts.filter((p) => p.type === "STORY").length}
          </p>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="p-2 sm:p-3 text-center">
              <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">{day}</span>
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
                className={`min-h-[80px] sm:min-h-[100px] md:min-h-[120px] border-r border-b border-gray-200 dark:border-gray-700 p-1 sm:p-2 relative group ${
                  date ? "bg-white dark:bg-gray-800 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 cursor-pointer transition-all duration-300" : "bg-gray-50 dark:bg-gray-900/30"
                } ${today ? "ring-1 sm:ring-2 ring-blue-500 ring-inset bg-blue-50/30 dark:bg-blue-900/10" : ""} ${
                  dayPosts.length > 0 ? "hover:shadow-lg hover:scale-[1.02] hover:z-10" : ""
                }`}
                onClick={() => {
                  if (date) {
                    setSelectedDate(date);
                    setShowModal(true);
                  }
                }}
              >
                {date && (
                  <>
                    <div className="flex items-center justify-between mb-1 sm:mb-2">
                      <span
                        className={`text-xs sm:text-sm font-semibold ${
                          today
                            ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white w-5 h-5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shadow-lg text-[10px] sm:text-sm"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      {dayPosts.length > 0 && (
                        <span className="text-[9px] sm:text-xs font-bold px-1 sm:px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-sm">
                          {dayPosts.length}
                        </span>
                      )}
                    </div>

                    {/* Post density indicator */}
                    {dayPosts.length > 0 && (
                      <div className="absolute top-0 left-0 right-0 h-0.5 sm:h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" 
                           style={{ opacity: Math.min(dayPosts.length * 0.2, 1) }}
                      />
                    )}

                    {/* Post thumbnails */}
                    <div className="space-y-0.5 sm:space-y-1">
                      {dayPosts.slice(0, 2).map((post) => (
                        <div
                          key={post.id}
                          className="flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-700/30 rounded hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 transition-all duration-200 group-hover:scale-105"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${getStatusColor(post.status)} shadow-sm`} />
                          <span className="text-[9px] sm:text-xs text-gray-600 dark:text-gray-400 truncate flex-1 font-medium">
                            {post.fileName}
                          </span>
                          {post.type === "REEL" && <Video className="w-2 h-2 sm:w-3 sm:h-3 text-purple-500" />}
                          {post.type === "STORY" && <Clock className="w-2 h-2 sm:w-3 sm:h-3 text-orange-500" />}
                        </div>
                      ))}
                      {dayPosts.length > 2 && (
                        <div className="text-[9px] sm:text-xs text-blue-600 dark:text-blue-400 font-semibold text-center mt-0.5 sm:mt-1 bg-blue-50 dark:bg-blue-900/20 rounded py-0.5">
                          +{dayPosts.length - 2} more
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

      {/* Modal for Selected Date */}
      {showModal && selectedDate && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden border border-gray-200 dark:border-gray-700 animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-6 text-white overflow-hidden">
              {/* Animated background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                  backgroundSize: '40px 40px'
                }} />
              </div>
              
              <div className="relative flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold mb-1">
                    {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </h3>
                  <p className="text-blue-100 text-sm flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {getPostsForDate(selectedDate).length} {getPostsForDate(selectedDate).length === 1 ? 'post' : 'posts'} scheduled
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)] custom-scrollbar">
              {getPostsForDate(selectedDate).length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 mb-4">
                    <CalendarIcon className="w-10 h-10 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    No posts scheduled
                  </h4>
                  <p className="text-gray-500 dark:text-gray-400">
                    Add posts to your queue to see them here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getPostsForDate(selectedDate)
                    .sort((a, b) => {
                      const timeA = a.date ? new Date(a.date).getTime() : 0;
                      const timeB = b.date ? new Date(b.date).getTime() : 0;
                      return timeA - timeB;
                    })
                    .map((post, index) => (
                    <div
                      key={post.id}
                      className="group relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-700/30 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 hover:shadow-lg hover:scale-[1.01] transition-all duration-300"
                    >
                      {/* Post number indicator */}
                      <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-lg z-10">
                        {index + 1}
                      </div>

                      <div className="flex gap-4 p-4">
                        {/* Image/Video Preview */}
                        <div className="flex-shrink-0">
                          <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-600 relative group-hover:ring-2 group-hover:ring-purple-500 transition-all">
                            {post.image ? (
                              post.type === "REEL" ? (
                                <video
                                  src={post.image}
                                  className="w-full h-full object-cover"
                                  muted
                                />
                              ) : (
                                <img 
                                  src={post.image} 
                                  alt={post.fileName} 
                                  className="w-full h-full object-cover" 
                                />
                              )
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                {post.type === "REEL" ? (
                                  <Video className="w-12 h-12 text-gray-400" />
                                ) : (
                                  <ImageIcon className="w-12 h-12 text-gray-400" />
                                )}
                              </div>
                            )}
                            {/* Type badge */}
                            <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold text-white shadow-lg ${
                              post.type === "REEL" ? "bg-gradient-to-r from-purple-500 to-pink-500" :
                              post.type === "STORY" ? "bg-gradient-to-r from-orange-500 to-red-500" :
                              "bg-gradient-to-r from-blue-500 to-cyan-500"
                            }`}>
                              {post.type}
                            </div>
                          </div>
                        </div>
                        
                        {/* Post Details */}
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 dark:text-white truncate mb-1">
                                {post.fileName}
                              </h4>
                              {post.date && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(post.date).toLocaleTimeString("en-US", { 
                                    hour: "numeric", 
                                    minute: "2-digit",
                                    hour12: true 
                                  })}
                                </p>
                              )}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm ${getStatusColor(post.status)}`}>
                              {post.status}
                            </span>
                          </div>
                          
                          {/* Caption */}
                          {post.caption && (
                            <div className="mb-3 flex-1">
                              <div className="flex items-center gap-1.5 mb-1">
                                <MessageSquare className="w-3 h-3 text-gray-400" />
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Caption:</span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 bg-white/50 dark:bg-gray-800/50 rounded p-2">
                                {post.caption}
                              </p>
                            </div>
                          )}
                          
                          {/* Actions */}
                          <div className="flex gap-2 mt-auto">
                            <button 
                              onClick={() => handleViewPost(post)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-600 transition-all">
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* View Post Modal */}
      {showViewModal && viewingPost && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setShowViewModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700 animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${
                    viewingPost.type === "REEL" ? "bg-purple-500/30" :
                    viewingPost.type === "STORY" ? "bg-orange-500/30" :
                    "bg-blue-500/30"
                  } backdrop-blur-sm`}>
                    {viewingPost.type === "REEL" ? (
                      <Video className="w-6 h-6" />
                    ) : (
                      <ImageIcon className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{viewingPost.fileName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full font-medium">
                        {viewingPost.type}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(viewingPost.status)} text-white`}>
                        {viewingPost.status}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] custom-scrollbar">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Media Preview */}
                <div className="space-y-4">
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 relative group">
                    {viewingPost.image ? (
                      viewingPost.type === "REEL" ? (
                        <video
                          src={viewingPost.image}
                          controls
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <img 
                          src={viewingPost.image} 
                          alt={viewingPost.fileName} 
                          className="w-full h-full object-contain" 
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {viewingPost.type === "REEL" ? (
                          <Video className="w-24 h-24 text-gray-400" />
                        ) : (
                          <ImageIcon className="w-24 h-24 text-gray-400" />
                        )}
                      </div>
                    )}
                    
                    {/* Image overlay info */}
                    {viewingPost.mimeType && (
                      <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-white text-xs font-medium">
                        {viewingPost.mimeType}
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2">
                    {viewingPost.image && (
                      <a
                        href={viewingPost.image}
                        download={viewingPost.fileName}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Download
                      </a>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  {/* Schedule Info */}
                  {viewingPost.date && (
                    <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <h4 className="font-semibold text-gray-900 dark:text-white">Scheduled Time</h4>
                      </div>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {new Date(viewingPost.date).toLocaleDateString("en-US", { 
                          weekday: "long", 
                          year: "numeric", 
                          month: "long", 
                          day: "numeric" 
                        })}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {new Date(viewingPost.date).toLocaleTimeString("en-US", { 
                          hour: "numeric", 
                          minute: "2-digit",
                          hour12: true 
                        })}
                      </p>
                    </div>
                  )}

                  {/* Caption */}
                  <div className="bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <h4 className="font-semibold text-gray-900 dark:text-white">Caption</h4>
                    </div>
                    {viewingPost.caption ? (
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {viewingPost.caption}
                      </p>
                    ) : (
                      <p className="text-gray-400 dark:text-gray-500 italic">No caption added</p>
                    )}
                  </div>

                  {/* Post Details */}
                  <div className="bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Post Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Type:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{viewingPost.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Status:</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusColor(viewingPost.status)} text-white`}>
                          {viewingPost.status}
                        </span>
                      </div>
                      {viewingPost.driveFileId && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Google Drive:</span>
                          <span className="font-medium text-green-600 dark:text-green-400">Linked</span>
                        </div>
                      )}
                      {viewingPost.awsS3Key && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">AWS S3:</span>
                          <span className="font-medium text-blue-600 dark:text-blue-400">Stored</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Post Modal */}
      {showEditModal &&
        editingPost &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => {
              if (!isSaving) {
                setShowEditModal(false);
                setEditingPost(null);
              }
            }}
          >
            <div
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-50 to-pink-50 dark:from-orange-900/20 dark:to-pink-900/20">
                <button
                  onClick={() => {
                    if (!isSaving) {
                      setShowEditModal(false);
                      setEditingPost(null);
                    }
                  }}
                  disabled={isSaving}
                  className="absolute top-4 right-4 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl">
                    <Edit2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
                      Edit Post
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      ID: {editingPost.id.substring(0, 8)}...
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] custom-scrollbar space-y-4">
                {/* Media Preview */}
                <div className="relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-gray-200 dark:border-gray-700">
                  {(editingPost.driveFileUrl || editingPost.awsS3Url || editingPost.image) ? (
                    editingPost.type === "REEL" ? (
                      <video
                        src={editingPost.driveFileUrl || editingPost.awsS3Url || editingPost.image || ""}
                        controls
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={editingPost.driveFileUrl || editingPost.awsS3Url || editingPost.image || ""}
                        alt="Post content"
                        className="w-full h-full object-cover"
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <MessageSquare className="w-16 h-16 text-gray-300 dark:text-gray-600" />
                    </div>
                  )}
                </div>

                {/* Caption */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Caption
                  </label>
                  <textarea
                    value={editForm.caption}
                    onChange={(e) =>
                      setEditForm({ ...editForm, caption: e.target.value })
                    }
                    disabled={isSaving}
                    placeholder="Write your caption here... Use #hashtags and @mentions"
                    rows={6}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed custom-scrollbar"
                  />
                  <div className="flex items-center justify-between text-xs mt-1">
                    <div className="text-gray-500 dark:text-gray-400">
                      💡 Tip: Use <span className="text-blue-500">#hashtags</span> and <span className="text-purple-500">@mentions</span>
                    </div>
                    <div className={`font-medium ${
                      editForm.caption.length > 2200 ? 'text-red-500' :
                      editForm.caption.length > 2000 ? 'text-yellow-500' :
                      'text-gray-500 dark:text-gray-400'
                    }`}>
                      {editForm.caption.length} / 2,200 characters
                      {editForm.caption.length > 2200 && ' ⚠️ Too long!'}
                    </div>
                  </div>
                </div>

                {/* Scheduled Date & Time with Better UX */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Schedule Post
                  </label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Date Picker */}
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={editForm.scheduledDate.split('T')[0]}
                        onChange={(e) => {
                          const currentTime = editForm.scheduledDate.split('T')[1] || '12:00';
                          setEditForm({
                            ...editForm,
                            scheduledDate: `${e.target.value}T${currentTime}`,
                          });
                        }}
                        disabled={isSaving}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Time Picker */}
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Time
                      </label>
                      <input
                        type="time"
                        value={editForm.scheduledDate.split('T')[1] || '12:00'}
                        onChange={(e) => {
                          const currentDate = editForm.scheduledDate.split('T')[0];
                          setEditForm({
                            ...editForm,
                            scheduledDate: `${currentDate}T${e.target.value}`,
                          });
                        }}
                        disabled={isSaving}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Quick Time Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        now.setHours(now.getHours() + 1);
                        setEditForm({
                          ...editForm,
                          scheduledDate: now.toISOString().slice(0, 16),
                        });
                      }}
                      disabled={isSaving}
                      className="px-3 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      +1 Hour
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        tomorrow.setHours(12, 0, 0, 0);
                        setEditForm({
                          ...editForm,
                          scheduledDate: tomorrow.toISOString().slice(0, 16),
                        });
                      }}
                      disabled={isSaving}
                      className="px-3 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Tomorrow 12pm
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextWeek = new Date();
                        nextWeek.setDate(nextWeek.getDate() + 7);
                        nextWeek.setHours(12, 0, 0, 0);
                        setEditForm({
                          ...editForm,
                          scheduledDate: nextWeek.toISOString().slice(0, 16),
                        });
                      }}
                      disabled={isSaving}
                      className="px-3 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next Week
                    </button>
                  </div>

                  {/* Formatted Display */}
                  {editForm.scheduledDate && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-gray-700 dark:text-gray-300">
                          Schedule for:
                        </span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {new Date(editForm.scheduledDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                          {' at '}
                          {new Date(editForm.scheduledDate).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status and Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Status
                    </label>
                    <select
                      value={editForm.status}
                      onChange={(e) =>
                        setEditForm({ ...editForm, status: e.target.value as InstagramPost["status"] })
                      }
                      disabled={isSaving}
                      className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="PUBLISHED">Published</option>
                      <option value="REVIEW">Review</option>
                      <option value="APPROVED">Approved</option>
                      <option value="PENDING">Pending</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Type
                    </label>
                    <select
                      value={editForm.postType}
                      onChange={(e) =>
                        setEditForm({ ...editForm, postType: e.target.value as "POST" | "REEL" | "STORY" })
                      }
                      disabled={isSaving}
                      className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="POST">Post</option>
                      <option value="REEL">Reel</option>
                      <option value="STORY">Story</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-900/10 dark:to-pink-900/10">
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      if (!isSaving) {
                        setShowEditModal(false);
                        setEditingPost(null);
                      }
                    }}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Edit2 className="w-4 h-4" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #2563eb, #7c3aed);
        }
        @keyframes slide-in-from-bottom-4 {
          from {
            transform: translateY(1rem);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-in {
          animation-fill-mode: both;
        }
        .slide-in-from-bottom-4 {
          animation-name: slide-in-from-bottom-4;
        }
        .fade-in {
          animation-name: fadeIn;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default CalendarView;
