"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Heart, 
  MessageCircle, 
  Bookmark,
  MoreVertical,
  RefreshCw,
  Edit3,
  Trash2,
  Link2,
  Flag,
  X,
  Loader2,
  BookmarkX,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { createPortal } from "react-dom";

interface Post {
  id: string;
  imageUrls: string[]; // Changed from imageUrl to imageUrls array
  mediaType?: 'image' | 'video'; // Type of media
  caption: string;
  createdAt: string;
  user: {
    id: string;
    clerkId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    email: string;
    imageUrl: string | null;
  };
  isLiked: boolean;
  isBookmarked: boolean;
  likeCount: number;
  commentCount: number;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    clerkId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    email: string;
    imageUrl: string | null;
  };
}

// ImageCarousel component for displaying images and videos
const ImageCarousel = React.memo(({ 
  images, 
  postId, 
  mediaType = 'image',
  currentImageIndexes,
  setCurrentImageIndexes,
  isPaused = false
}: { 
  images: string[], 
  postId: string, 
  mediaType?: 'image' | 'video',
  currentImageIndexes: Record<string, number>,
  setCurrentImageIndexes: React.Dispatch<React.SetStateAction<Record<string, number>>>,
  isPaused?: boolean
}) => {
  const currentIndex = currentImageIndexes[postId] || 0;
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = React.useState(true);
  const [isVisible, setIsVisible] = React.useState(false);

  // Intersection Observer to detect if video is visible on screen
  React.useEffect(() => {
    if (!containerRef.current || mediaType !== 'video') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      {
        threshold: 0.5,
        rootMargin: '0px'
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [mediaType]);

  // Handle video pause/play based on visibility
  React.useEffect(() => {
    if (videoRef.current && mediaType === 'video') {
      const video = videoRef.current;
      
      if (isPaused || !isVisible) {
        video.pause();
      } else {
        video.play().catch(err => console.log('Play prevented:', err));
      }
    }
  }, [isPaused, isVisible, mediaType]);

  // Handle scroll snap for mobile
  const handleScroll = React.useCallback(() => {
    if (!scrollContainerRef.current || mediaType === 'video') return;
    
    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const itemWidth = container.offsetWidth;
    const newIndex = Math.round(scrollLeft / itemWidth);
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < images.length) {
      setCurrentImageIndexes(prev => ({
        ...prev,
        [postId]: newIndex
      }));
    }
  }, [currentIndex, postId, setCurrentImageIndexes, mediaType, images.length]);

  // Debounce scroll handler
  React.useEffect(() => {
    if (!scrollContainerRef.current || mediaType === 'video') return;
    
    const container = scrollContainerRef.current;
    let scrollTimeout: NodeJS.Timeout;
    
    const onScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleScroll, 100);
    };
    
    container.addEventListener('scroll', onScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', onScroll);
      clearTimeout(scrollTimeout);
    };
  }, [handleScroll, mediaType]);

  const goToNext = () => {
    if (currentIndex < images.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentImageIndexes(prev => ({
        ...prev,
        [postId]: newIndex
      }));
      
      // Scroll to next image
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          left: newIndex * scrollContainerRef.current.offsetWidth,
          behavior: 'smooth'
        });
      }
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentImageIndexes(prev => ({
        ...prev,
        [postId]: newIndex
      }));
      
      // Scroll to previous image
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          left: newIndex * scrollContainerRef.current.offsetWidth,
          behavior: 'smooth'
        });
      }
    }
  };

  const goToIndex = (index: number) => {
    setCurrentImageIndexes(prev => ({ ...prev, [postId]: index }));
    
    // Scroll to specific index
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: index * scrollContainerRef.current.offsetWidth,
        behavior: 'smooth'
      });
    }
  };

  if (images.length === 0) {
    return (
      <div className="relative aspect-square bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
        <ImageIcon className="w-16 h-16 text-gray-400 dark:text-gray-600" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative aspect-square bg-gradient-to-br from-gray-900 via-black to-gray-900 group flex items-center justify-center overflow-hidden">
      {/* Main Media */}
      {mediaType === 'video' ? (
        <>
          <video
            ref={videoRef}
            src={images[0]}
            autoPlay
            loop
            playsInline
            muted={isMuted}
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
            className="absolute max-w-full max-h-full object-contain z-10 cursor-pointer"
          />
          {/* Mute indicator */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
            className="absolute bottom-3 right-3 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full transition-all z-20 border border-white/10"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-white" />
            ) : (
              <Volume2 className="w-4 h-4 text-white" />
            )}
          </button>
        </>
      ) : (
        <>
          {/* Scrollable container for mobile swipe */}
          <div 
            ref={scrollContainerRef}
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide w-full h-full"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {images.map((imageUrl, index) => (
              <div
                key={index}
                className="flex-shrink-0 w-full h-full snap-center flex items-center justify-center"
              >
                <img
                  src={imageUrl}
                  alt={`Post image ${index + 1}`}
                  loading="eager"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Navigation Arrows - Only show on hover for desktop (not for video) */}
      {mediaType !== 'video' && images.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrev();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full shadow-lg md:flex hidden items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200 z-10"
            >
              <ChevronLeft className="w-6 h-6 text-gray-800 dark:text-white" />
            </button>
          )}
          {currentIndex < images.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full shadow-lg md:flex hidden items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200 z-10"
            >
              <ChevronRight className="w-6 h-6 text-gray-800 dark:text-white" />
            </button>
          )}
        </>
      )}

      {/* Image Counter Badge - Only for multiple images (not video) */}
      {mediaType !== 'video' && images.length > 1 && (
        <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/70 backdrop-blur-md rounded-full text-white text-xs font-semibold shadow-lg z-10">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Dots Indicator - Only show if multiple images (not video) */}
      {mediaType !== 'video' && images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                goToIndex(index);
              }}
              className={`transition-all duration-300 rounded-full ${
                index === currentIndex
                  ? 'w-8 h-2 bg-white shadow-lg'
                  : 'w-2 h-2 bg-white/60 hover:bg-white/80 hover:scale-125'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
});

ImageCarousel.displayName = 'ImageCarousel';

export default function BookmarksPage() {
  const { user } = useUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [processingLikes, setProcessingLikes] = useState<Set<string>>(new Set());
  const [processingBookmarks, setProcessingBookmarks] = useState<Set<string>>(new Set());
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [currentImageIndexes, setCurrentImageIndexes] = useState<Record<string, number>>({});

  const loadBookmarkedPosts = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const response = await fetch("/api/feed/bookmarks");
      if (!response.ok) throw new Error("Failed to fetch bookmarked posts");
      const data = await response.json();
      setPosts(data);
    } catch (error) {
      console.error("Error loading bookmarked posts:", error);
      toast.error("Failed to load bookmarked posts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBookmarkedPosts();
  }, []);

  // Click outside handler for dropdown menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-menu')) {
        setOpenMenuPostId(null);
      }
    };

    if (openMenuPostId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenuPostId]);

  const handleLike = async (postId: string) => {
    if (processingLikes.has(postId)) return;

    setProcessingLikes((prev) => new Set(prev).add(postId));

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const wasLiked = post.isLiked;
    const endpoint = `/api/feed/posts/${postId}/like`;

    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId
          ? {
              ...p,
              isLiked: !wasLiked,
              likeCount: wasLiked ? p.likeCount - 1 : p.likeCount + 1,
            }
          : p
      )
    );

    try {
      const response = await fetch(endpoint, {
        method: wasLiked ? "DELETE" : "POST",
      });

      if (!response.ok) throw new Error("Failed to update like");

      const data = await response.json();
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === postId
            ? { ...p, isLiked: data.liked, likeCount: data.likeCount }
            : p
        )
      );
    } catch (error) {
      console.error("Error updating like:", error);
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === postId
            ? {
                ...p,
                isLiked: wasLiked,
                likeCount: wasLiked ? p.likeCount + 1 : p.likeCount - 1,
              }
            : p
        )
      );
      toast.error("Failed to update like");
    } finally {
      setTimeout(() => {
        setProcessingLikes((prev) => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
      }, 300);
    }
  };

  const handleBookmark = async (postId: string) => {
    if (processingBookmarks.has(postId)) return;

    setProcessingBookmarks((prev) => new Set(prev).add(postId));

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const wasBookmarked = post.isBookmarked;
    const endpoint = `/api/feed/posts/${postId}/bookmark`;

    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId ? { ...p, isBookmarked: !wasBookmarked } : p
      )
    );

    try {
      const response = await fetch(endpoint, {
        method: wasBookmarked ? "DELETE" : "POST",
      });

      if (!response.ok) throw new Error("Failed to update bookmark");

      const data = await response.json();
      
      // If unbookmarked, remove from the list after a short delay
      if (!data.bookmarked) {
        setTimeout(() => {
          setPosts((prevPosts) => prevPosts.filter((p) => p.id !== postId));
          toast.success("Removed from bookmarks");
        }, 300);
      } else {
        setPosts((prevPosts) =>
          prevPosts.map((p) =>
            p.id === postId ? { ...p, isBookmarked: data.bookmarked } : p
          )
        );
      }
    } catch (error) {
      console.error("Error updating bookmark:", error);
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === postId ? { ...p, isBookmarked: wasBookmarked } : p
        )
      );
      toast.error("Failed to update bookmark");
    } finally {
      setTimeout(() => {
        setProcessingBookmarks((prev) => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
      }, 300);
    }
  };

  const openCommentsModal = async (post: Post) => {
    setSelectedPostForComments(post);
    setNewComment("");

    try {
      const response = await fetch(`/api/feed/posts/${post.id}/comments`);
      if (!response.ok) throw new Error("Failed to fetch comments");
      const data = await response.json();
      setComments(data);
    } catch (error) {
      console.error("Error loading comments:", error);
      toast.error("Failed to load comments");
      setComments([]);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedPostForComments || submittingComment)
      return;

    setSubmittingComment(true);

    try {
      const response = await fetch(
        `/api/feed/posts/${selectedPostForComments.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newComment.trim() }),
        }
      );

      if (!response.ok) throw new Error("Failed to add comment");

      const data = await response.json();
      setComments([data.comment, ...comments]);
      setNewComment("");

      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === selectedPostForComments.id
            ? { ...p, commentCount: data.commentCount }
            : p
        )
      );

      toast.success("Comment added!");
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedPostForComments) return;

    try {
      const response = await fetch(
        `/api/feed/posts/${selectedPostForComments.id}/comments/${commentId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to delete comment");

      setComments(comments.filter((c) => c.id !== commentId));

      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === selectedPostForComments.id
            ? { ...p, commentCount: Math.max(0, p.commentCount - 1) }
            : p
        )
      );

      toast.success("Comment deleted!");
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setOpenMenuPostId(null);
  };

  const handleUpdatePost = async () => {
    if (!editingPost) return;

    try {
      const response = await fetch(`/api/feed/posts/${editingPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: editingPost.caption }),
      });

      if (!response.ok) throw new Error("Failed to update post");

      const updatedPost = await response.json();
      setPosts((prevPosts) =>
        prevPosts.map((p) => (p.id === editingPost.id ? { ...p, caption: updatedPost.caption } : p))
      );

      toast.success("Post updated!");
      setEditingPost(null);
    } catch (error) {
      console.error("Error updating post:", error);
      toast.error("Failed to update post");
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const response = await fetch(`/api/feed/posts/${postId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete post");

      setPosts((prevPosts) => prevPosts.filter((p) => p.id !== postId));
      toast.success("Post deleted!");
      setOpenMenuPostId(null);
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post");
    }
  };

  const handleCopyLink = (postId: string) => {
    const link = `${window.location.origin}/workspace/user-feed?post=${postId}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard!");
    setOpenMenuPostId(null);
  };

  const handleReportPost = (postId: string) => {
    toast.info("Report functionality coming soon!");
    setOpenMenuPostId(null);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/20 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Enhanced Header */}
        <div className="mb-12">
          <div className="flex items-start justify-between mb-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg">
                  <Bookmark className="w-7 h-7 text-white" />
                </div>
                <h1 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                  Bookmarks
                </h1>
              </div>
              <p className="text-lg text-gray-600 dark:text-gray-400 ml-[4.5rem]">
                {posts.length} saved {posts.length === 1 ? 'item' : 'items'}
              </p>
            </div>

            <button
              onClick={() => loadBookmarkedPosts(true)}
              disabled={refreshing}
              className="group p-4 bg-white dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
            >
              <RefreshCw
                className={`w-6 h-6 text-purple-600 dark:text-purple-400 group-hover:rotate-180 transition-transform duration-500 ${
                  refreshing ? "animate-spin" : ""
                }`}
              />
            </button>
          </div>
          
          {/* Decorative line */}
          <div className="h-1 w-full bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-blue-500/20 rounded-full"></div>
        </div>

        {/* Empty State */}
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="relative mb-8">
              {/* Animated rings */}
              <div className="absolute inset-0 animate-ping opacity-20">
                <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full"></div>
              </div>
              <div className="relative w-32 h-32 bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl">
                <BookmarkX className="w-16 h-16 text-white drop-shadow-lg" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-3">
              No bookmarks yet
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-center max-w-md text-lg leading-relaxed">
              Your saved posts will appear here. Start exploring the feed and bookmark your favorite content!
            </p>
          </div>
        ) : (
          /* Enhanced Posts Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
            {posts.map((post) => (
              <div
                key={post.id}
                className="group bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 overflow-hidden hover:shadow-2xl hover:border-purple-500/30 dark:hover:border-purple-500/30 transition-all duration-500 hover:-translate-y-2"
              >
                {/* Enhanced Post Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-200/70 dark:border-gray-700/70 bg-gradient-to-r from-purple-50/50 via-pink-50/50 to-blue-50/50 dark:from-purple-900/10 dark:via-pink-900/10 dark:to-blue-900/10">
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center ring-2 ring-white dark:ring-gray-800 shadow-lg">
                      {post.user.imageUrl ? (
                        <img 
                          src={post.user.imageUrl} 
                          alt={post.user.username || post.user.email}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-bold text-base">
                          {(post.user.firstName?.[0] || post.user.username?.[0] || post.user.email?.[0] || 'U').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-base">
                        {post.user.username || post.user.email.split("@")[0]}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        {formatTimeAgo(post.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Enhanced More Options */}
                  <div className="relative dropdown-menu">
                    <button
                      onClick={() =>
                        setOpenMenuPostId(
                          openMenuPostId === post.id ? null : post.id
                        )
                      }
                      className="p-2.5 hover:bg-white/80 dark:hover:bg-gray-700/80 rounded-xl transition-all duration-200 active:scale-95 group-hover:bg-white/50 dark:group-hover:bg-gray-700/50"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </button>

                    {/* Enhanced Dropdown Menu */}
                    {openMenuPostId === post.id && (
                      <div className="dropdown-menu absolute right-0 top-full mt-2 w-56 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        {post.user.clerkId === user?.id ? (
                          <>
                            <button
                              onClick={() => handleEditPost(post)}
                              className="w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/20 dark:hover:to-pink-900/20 transition-all duration-200 flex items-center gap-3 text-gray-700 dark:text-gray-300 rounded-xl mx-1"
                            >
                              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <Edit3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <span className="font-medium">Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 dark:hover:from-red-900/20 dark:hover:to-pink-900/20 transition-all duration-200 flex items-center gap-3 text-red-600 dark:text-red-400 rounded-xl mx-1"
                            >
                              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                <Trash2 className="w-4 h-4" />
                              </div>
                              <span className="font-medium">Delete</span>
                            </button>
                            <button
                              onClick={() => handleCopyLink(post.id)}
                              className="w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 dark:hover:from-purple-900/20 dark:hover:to-blue-900/20 transition-all duration-200 flex items-center gap-3 text-gray-700 dark:text-gray-300 rounded-xl mx-1"
                            >
                              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                <Link2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              </div>
                              <span className="font-medium">Copy Link</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleReportPost(post.id)}
                              className="w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 dark:hover:from-red-900/20 dark:hover:to-pink-900/20 transition-all duration-200 flex items-center gap-3 text-red-600 dark:text-red-400 rounded-xl mx-1"
                            >
                              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                <Flag className="w-4 h-4" />
                              </div>
                              <span className="font-medium">Report</span>
                            </button>
                            <button
                              onClick={() => handleCopyLink(post.id)}
                              className="w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 dark:hover:from-purple-900/20 dark:hover:to-blue-900/20 transition-all duration-200 flex items-center gap-3 text-gray-700 dark:text-gray-300 rounded-xl mx-1"
                            >
                              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                <Link2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              </div>
                              <span className="font-medium">Copy Link</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Post Media */}
                <div className="relative overflow-hidden">
                  <ImageCarousel
                    images={post.imageUrls || []}
                    postId={post.id}
                    mediaType={post.mediaType}
                    currentImageIndexes={currentImageIndexes}
                    setCurrentImageIndexes={setCurrentImageIndexes}
                  />
                </div>

                {/* Enhanced Post Actions */}
                <div className="p-5 space-y-4 bg-gradient-to-b from-white to-gray-50/50 dark:from-gray-800 dark:to-gray-900/50">
                  <div className="flex items-center gap-5">
                    <button
                      onClick={() => handleLike(post.id)}
                      disabled={processingLikes.has(post.id)}
                      className="flex items-center gap-2.5 group transition-all duration-300 active:scale-95 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-xl"
                    >
                      <Heart
                        className={`w-6 h-6 transition-all duration-300 ${
                          post.isLiked
                            ? "fill-red-500 text-red-500 scale-110"
                            : "text-gray-600 dark:text-gray-400 group-hover:text-red-500 group-hover:scale-110"
                        }`}
                      />
                      <span className={`text-sm font-semibold ${
                        post.isLiked 
                          ? "text-red-500" 
                          : "text-gray-700 dark:text-gray-300 group-hover:text-red-500"
                      }`}>
                        {post.likeCount}
                      </span>
                    </button>

                    <button
                      onClick={() => openCommentsModal(post)}
                      className="flex items-center gap-2.5 group transition-all duration-300 active:scale-95 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-2 rounded-xl"
                    >
                      <MessageCircle className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-blue-500 group-hover:scale-110 transition-all duration-300" />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-blue-500">
                        {post.commentCount}
                      </span>
                    </button>

                    <button
                      onClick={() => handleBookmark(post.id)}
                      disabled={processingBookmarks.has(post.id)}
                      className="ml-auto group transition-all duration-300 active:scale-95 hover:bg-purple-50 dark:hover:bg-purple-900/20 p-3 rounded-xl"
                    >
                      <Bookmark
                        className={`w-6 h-6 transition-all duration-300 ${
                          post.isBookmarked
                            ? "fill-purple-500 text-purple-500 scale-110"
                            : "text-gray-600 dark:text-gray-400 group-hover:text-purple-500 group-hover:scale-110"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Enhanced Caption */}
                  {post.caption && (
                    <div className="pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 leading-relaxed">
                        <span className="font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                          {post.user.username || post.user.email.split("@")[0]}
                        </span>{" "}
                        <span className="text-gray-600 dark:text-gray-400">
                          {post.caption}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enhanced Comments Modal */}
      {selectedPostForComments &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedPostForComments(null);
              }
            }}
          >
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 flex border border-gray-200/50 dark:border-gray-700/50">
              {/* Left Side - Media */}
              <div className="hidden md:block md:w-1/2 bg-black relative">
                {selectedPostForComments.imageUrls && selectedPostForComments.imageUrls.length > 0 ? (
                  selectedPostForComments.mediaType === 'video' ? (
                    <video
                      src={selectedPostForComments.imageUrls[0]}
                      controls
                      autoPlay
                      loop
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  ) : (
                    <Image
                      src={selectedPostForComments.imageUrls[0]}
                      alt="Post"
                      fill
                      className="object-contain"
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-24 h-24 text-gray-600" />
                  </div>
                )}
              </div>

              {/* Right Side - Comments */}
              <div className="w-full md:w-1/2 flex flex-col max-h-[90vh]">
                {/* Enhanced Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200/70 dark:border-gray-700/70 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10 backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
                      <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                      Comments
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedPostForComments(null)}
                    className="p-2.5 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 rounded-xl transition-all duration-200 active:scale-95 group"
                  >
                    <X className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-red-500 transition-colors" />
                  </button>
                </div>

                {/* Enhanced Comments List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-900/50 dark:to-gray-900">
                  {comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center mb-4">
                        <MessageCircle className="w-10 h-10 text-purple-500 dark:text-purple-400" />
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 font-medium">
                        No comments yet. Be the first to comment!
                      </p>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="flex gap-3 group hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 dark:hover:from-purple-900/10 dark:hover:to-pink-900/10 p-4 rounded-2xl transition-all duration-300 border border-transparent hover:border-purple-200/50 dark:hover:border-purple-700/50"
                      >
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-md ring-2 ring-white dark:ring-gray-900">
                          {comment.user.imageUrl ? (
                            <img
                              src={comment.user.imageUrl}
                              alt={comment.user.username || comment.user.email}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-white font-bold text-sm">
                              {(comment.user.firstName?.[0] || comment.user.username?.[0] || comment.user.email?.[0] || 'U').toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-sm text-gray-900 dark:text-white">
                              {comment.user.username ||
                                comment.user.email.split("@")[0]}
                            </p>
                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatTimeAgo(comment.createdAt)}
                            </p>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            {comment.content}
                          </p>
                        </div>
                        {comment.user.clerkId === user?.id && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="opacity-0 group-hover:opacity-100 p-2.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-all duration-200 self-start"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Enhanced Add Comment */}
                <div className="p-6 border-t border-gray-200/70 dark:border-gray-700/70 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-blue-500/5 backdrop-blur-xl">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAddComment();
                        }
                      }}
                      placeholder="Add a comment..."
                      className="flex-1 px-5 py-3.5 bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-700/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all duration-200 placeholder:text-gray-400"
                      disabled={submittingComment}
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || submittingComment}
                      className="px-7 py-3.5 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white rounded-2xl font-semibold hover:shadow-lg hover:shadow-purple-500/30 hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                    >
                      {submittingComment ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        "Post"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Enhanced Edit Post Modal */}
      {editingPost &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setEditingPost(null);
              }
            }}
          >
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-2xl w-full p-8 animate-in zoom-in-95 duration-300 border border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
                  <Edit3 className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                  Edit Post
                </h2>
              </div>

              <textarea
                value={editingPost.caption}
                onChange={(e) =>
                  setEditingPost({ ...editingPost, caption: e.target.value })
                }
                placeholder="Write a caption..."
                className="w-full px-5 py-4 bg-gray-50/80 dark:bg-gray-800/80 border border-gray-300/50 dark:border-gray-700/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all duration-200 min-h-40 resize-none placeholder:text-gray-400 text-gray-700 dark:text-gray-300"
              />

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setEditingPost(null)}
                  className="flex-1 px-6 py-3.5 bg-gray-200/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 rounded-2xl font-semibold hover:bg-gray-300/80 dark:hover:bg-gray-700/80 transition-all duration-300 active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdatePost}
                  className="flex-1 px-6 py-3.5 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white rounded-2xl font-semibold hover:shadow-lg hover:shadow-purple-500/30 hover:scale-105 active:scale-95 transition-all duration-300"
                >
                  Update
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Global styles for scrollbar-hide */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
