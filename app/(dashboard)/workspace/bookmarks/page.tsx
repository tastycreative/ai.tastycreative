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
  BookmarkX
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { createPortal } from "react-dom";

interface Post {
  id: string;
  imageUrl: string;
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950/20 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
              Bookmarks
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {posts.length} {posts.length === 1 ? 'post' : 'posts'} saved
            </p>
          </div>

          <button
            onClick={() => loadBookmarkedPosts(true)}
            disabled={refreshing}
            className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-5 h-5 text-purple-600 dark:text-purple-400 ${
                refreshing ? "animate-spin" : ""
              }`}
            />
          </button>
        </div>

        {/* Empty State */}
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-6 shadow-xl">
              <BookmarkX className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
              No bookmarks yet
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
              Posts you bookmark will appear here. Start exploring the feed and save your favorite posts!
            </p>
          </div>
        ) : (
          /* Posts Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-white dark:bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Post Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      {post.user.imageUrl ? (
                        <img 
                          src={post.user.imageUrl} 
                          alt={post.user.username || post.user.email}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-bold text-sm">
                          {(post.user.firstName?.[0] || post.user.username?.[0] || post.user.email?.[0] || 'U').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {post.user.username || post.user.email.split("@")[0]}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimeAgo(post.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* More Options */}
                  <div className="relative dropdown-menu">
                    <button
                      onClick={() =>
                        setOpenMenuPostId(
                          openMenuPostId === post.id ? null : post.id
                        )
                      }
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-full transition-all duration-200 active:scale-95"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </button>

                    {/* Dropdown Menu */}
                    {openMenuPostId === post.id && (
                      <div className="dropdown-menu absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        {post.user.clerkId === user?.id ? (
                          <>
                            <button
                              onClick={() => handleEditPost(post)}
                              className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-300"
                            >
                              <Edit3 className="w-4 h-4" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3 text-red-600 dark:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Delete</span>
                            </button>
                            <button
                              onClick={() => handleCopyLink(post.id)}
                              className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-300"
                            >
                              <Link2 className="w-4 h-4" />
                              <span>Copy Link</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleReportPost(post.id)}
                              className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3 text-red-600 dark:text-red-400"
                            >
                              <Flag className="w-4 h-4" />
                              <span>Report</span>
                            </button>
                            <button
                              onClick={() => handleCopyLink(post.id)}
                              className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-300"
                            >
                              <Link2 className="w-4 h-4" />
                              <span>Copy Link</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Post Image */}
                <div className="relative aspect-square">
                  <Image
                    src={post.imageUrl}
                    alt="Post"
                    fill
                    className="object-cover"
                  />
                </div>

                {/* Post Actions */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleLike(post.id)}
                      disabled={processingLikes.has(post.id)}
                      className="flex items-center gap-2 group transition-all duration-200 active:scale-95"
                    >
                      <Heart
                        className={`w-6 h-6 transition-all duration-200 ${
                          post.isLiked
                            ? "fill-red-500 text-red-500"
                            : "text-gray-600 dark:text-gray-400 group-hover:text-red-500"
                        }`}
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {post.likeCount}
                      </span>
                    </button>

                    <button
                      onClick={() => openCommentsModal(post)}
                      className="flex items-center gap-2 group transition-all duration-200 active:scale-95"
                    >
                      <MessageCircle className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-blue-500 transition-colors" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {post.commentCount}
                      </span>
                    </button>

                    <button
                      onClick={() => handleBookmark(post.id)}
                      disabled={processingBookmarks.has(post.id)}
                      className="ml-auto group transition-all duration-200 active:scale-95"
                    >
                      <Bookmark
                        className={`w-6 h-6 transition-all duration-200 ${
                          post.isBookmarked
                            ? "fill-purple-500 text-purple-500"
                            : "text-gray-600 dark:text-gray-400 group-hover:text-purple-500"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Caption */}
                  {post.caption && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                      <span className="font-semibold">
                        {post.user.username || post.user.email.split("@")[0]}
                      </span>{" "}
                      {post.caption}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comments Modal */}
      {selectedPostForComments &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedPostForComments(null);
              }
            }}
          >
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 flex">
              {/* Left Side - Image */}
              <div className="hidden md:block md:w-1/2 bg-black relative">
                <Image
                  src={selectedPostForComments.imageUrl}
                  alt="Post"
                  fill
                  className="object-contain"
                />
              </div>

              {/* Right Side - Comments */}
              <div className="w-full md:w-1/2 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                    Comments
                  </h2>
                  <button
                    onClick={() => setSelectedPostForComments(null)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all duration-200 active:scale-95"
                  >
                    <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>

                {/* Comments List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <MessageCircle className="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">
                        No comments yet. Be the first to comment!
                      </p>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="flex gap-3 group hover:bg-gray-50 dark:hover:bg-gray-800/50 p-3 rounded-xl transition-all duration-200"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
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
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-gray-900 dark:text-white">
                              {comment.user.username ||
                                comment.user.email.split("@")[0]}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatTimeAgo(comment.createdAt)}
                            </p>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                            {comment.content}
                          </p>
                        </div>
                        {comment.user.clerkId === user?.id && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-blue-500/5">
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
                      className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200"
                      disabled={submittingComment}
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || submittingComment}
                      className="px-6 py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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

      {/* Edit Post Modal */}
      {editingPost &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setEditingPost(null);
              }
            }}
          >
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-2xl w-full p-8 animate-in zoom-in-95 duration-200">
              <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                Edit Post
              </h2>

              <textarea
                value={editingPost.caption}
                onChange={(e) =>
                  setEditingPost({ ...editingPost, caption: e.target.value })
                }
                placeholder="Write a caption..."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 min-h-32 resize-none"
              />

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setEditingPost(null)}
                  className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-700 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdatePost}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
                >
                  Update
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
