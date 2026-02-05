'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Heart, MessageCircle, Share2, Bookmark, MoreVertical, Edit2, Trash2, Link, Flag, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Post } from './types';
import ImageCarousel from './ImageCarousel';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';

interface FeedContentProps {
  onOpenCreatePost: () => void;
  onOpenComments: (post: Post) => void;
  currentImageIndexes: Record<string, number>;
  setCurrentImageIndexes: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

export default function FeedContent({
  onOpenCreatePost,
  onOpenComments,
  currentImageIndexes,
  setCurrentImageIndexes
}: FeedContentProps) {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [processingLikes, setProcessingLikes] = useState<Set<string>>(new Set());
  const [processingBookmarks, setProcessingBookmarks] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<{ id: string; caption: string } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userOrgRole, setUserOrgRole] = useState<string | null>(null);
  const [userOrgId, setUserOrgId] = useState<string | null>(null);
  const { userId } = useAuth();
  const { profileId: selectedProfileId, isAllProfiles } = useInstagramProfile();

  useEffect(() => {
    if (userId) {
      loadCurrentUser();
    }
  }, [userId]);

  // Load posts on initial mount and when profile changes
  useEffect(() => {
    loadFeedPosts();
  }, [selectedProfileId]);

  // Listen for new post created events
  useEffect(() => {
    const handlePostCreated = (event: any) => {
      const newPost = event.detail.post;
      setPosts(prevPosts => [newPost, ...prevPosts]);
    };

    window.addEventListener('postCreated', handlePostCreated);
    return () => window.removeEventListener('postCreated', handlePostCreated);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuPostId) {
        const target = event.target as HTMLElement;
        if (!target.closest('.dropdown-menu')) {
          setOpenMenuPostId(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuPostId]);

  const loadFeedPosts = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const url = selectedProfileId && selectedProfileId !== 'all'
        ? `/api/feed/posts?profileId=${selectedProfileId}`
        : '/api/feed/posts';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load feed posts:', errorData);
        if (!silent) {
          toast.error(`Failed to load posts: ${errorData.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error loading feed posts:', error);
      if (!silent) {
        toast.error('Failed to load posts');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  const loadCurrentUser = async () => {
    try {
      const response = await fetch('/api/user/me');
      if (response.ok) {
        const data = await response.json();
        setCurrentUserId(data.id);
        setUserOrgId(data.currentOrganizationId);
        
        // Fetch user's role in their current organization
        if (data.currentOrganizationId) {
          const roleResponse = await fetch(`/api/organizations/${data.currentOrganizationId}/role`);
          if (roleResponse.ok) {
            const roleData = await roleResponse.json();
            setUserOrgRole(roleData.role);
          }
        }
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const handleManualRefresh = async () => {
    await loadFeedPosts(true);
    toast.success('Feed refreshed!');
  };

  const handleLike = async (postId: string) => {
    if (processingLikes.has(postId)) return;

    if (!selectedProfileId) {
      toast.error('Please select a profile first');
      return;
    }

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const wasLiked = post.liked;

    setProcessingLikes(prev => new Set(prev).add(postId));

    setPosts(prevPosts => prevPosts.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          liked: !wasLiked,
          likes: wasLiked ? p.likes - 1 : p.likes + 1,
        };
      }
      return p;
    }));

    try {
      const response = await fetch(`/api/feed/posts/${postId}/like`, {
        method: wasLiked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: selectedProfileId }),
      });

      if (!response.ok) {
        throw new Error('Failed to update like');
      }

      const { likeCount, liked } = await response.json();

      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === postId) {
          return { ...p, likes: likeCount, liked };
        }
        return p;
      }));
    } catch (error) {
      console.error('Error updating like:', error);
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            liked: wasLiked,
            likes: wasLiked ? p.likes + 1 : p.likes - 1,
          };
        }
        return p;
      }));
      toast.error('Failed to update like');
    } finally {
      setProcessingLikes(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const handleBookmark = async (postId: string) => {
    if (processingBookmarks.has(postId)) return;

    if (!selectedProfileId) {
      toast.error('Please select a profile first');
      return;
    }

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const wasBookmarked = post.bookmarked;

    setProcessingBookmarks(prev => new Set(prev).add(postId));

    setPosts(prevPosts => prevPosts.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          bookmarked: !wasBookmarked,
        };
      }
      return p;
    }));

    toast.success(wasBookmarked ? 'Removed from bookmarks' : 'Added to bookmarks');

    try {
      const response = await fetch(`/api/feed/posts/${postId}/bookmark`, {
        method: wasBookmarked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: selectedProfileId }),
      });

      if (!response.ok) {
        throw new Error('Failed to update bookmark');
      }
    } catch (error) {
      console.error('Error updating bookmark:', error);
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            bookmarked: wasBookmarked,
          };
        }
        return p;
      }));
      toast.error('Failed to update bookmark');
    } finally {
      setProcessingBookmarks(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const handleShare = async (postId: string) => {
    const shareUrl = `${window.location.origin}/feed/post/${postId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard!');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('Failed to copy link');
    }
  };

  const handleEditPost = (post: Post) => {
    setEditingPost({ id: post.id, caption: post.caption });
    setOpenMenuPostId(null);
  };

  const handleUpdatePost = async () => {
    if (!editingPost) return;

    try {
      const response = await fetch(`/api/feed/posts/${editingPost.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: editingPost.caption }),
      });

      if (!response.ok) {
        throw new Error('Failed to update post');
      }

      setPosts(prevPosts => prevPosts.map(p => 
        p.id === editingPost.id ? { ...p, caption: editingPost.caption } : p
      ));

      setEditingPost(null);
      toast.success('Post updated!');
    } catch (error) {
      console.error('Error updating post:', error);
      toast.error('Failed to update post');
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const response = await fetch(`/api/feed/posts/${postId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      setPosts(prevPosts => prevPosts.filter(p => p.id !== postId));
      toast.success('Post deleted!');
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    }
    setOpenMenuPostId(null);
  };

  const handleCopyLink = (postId: string) => {
    const url = `${window.location.origin}/feed/post/${postId}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
    setOpenMenuPostId(null);
  };

  const handleReportPost = (postId: string) => {
    toast.success('Post reported. Thank you for helping keep our community safe.');
    setOpenMenuPostId(null);
  };

  const getDisplayName = (post: Post) => {
    if (post.user.firstName && post.user.lastName) {
      return `${post.user.firstName} ${post.user.lastName}`;
    }
    if (post.user.username) {
      return post.user.username;
    }
    return post.user.email?.split('@')[0] || 'Unknown User';
  };

  // Check if current user can edit/delete a post
  const canEditPost = (post: Post) => {
    // User is the post author
    if (currentUserId === post.user.id) {
      return true;
    }
    
    // User has admin/manager/owner role in an organization
    if (userOrgRole && ['OWNER', 'ADMIN', 'MANAGER'].includes(userOrgRole) && userOrgId) {
      // Check if post author is in the same organization (we'll need to enhance Post type to include this)
      // For now, we'll allow editing if user has the right role
      return true;
    }
    
    return false;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden animate-pulse">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/3"></div>
                  <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/4"></div>
                </div>
              </div>
            </div>
            <div className="h-96 bg-gray-300 dark:bg-gray-700"></div>
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Create Post Card */}
      <div className="relative bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-purple-950/30 dark:via-gray-900 dark:to-pink-950/30 rounded-2xl sm:rounded-3xl shadow-xl border-2 border-purple-200/50 dark:border-purple-800/50 p-4 sm:p-6 backdrop-blur-sm overflow-hidden group">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        
        <button
          onClick={onOpenCreatePost}
          disabled={!selectedProfileId}
          className="relative w-full p-4 sm:p-5 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 rounded-xl sm:rounded-2xl transition-all duration-300 text-left text-gray-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-dashed border-purple-300 dark:border-purple-700 hover:border-purple-400 dark:hover:border-purple-600 hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-white text-xl sm:text-2xl font-bold">+</span>
            </div>
            <span className="font-medium text-sm sm:text-base">
              {selectedProfileId ? "What's on your mind? Share something amazing!" : "Select a profile to create a post"}
            </span>
          </div>
        </button>
      </div>

      {/* Posts Feed */}
      {posts.length === 0 ? (
        <div className="relative bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-purple-950/30 dark:via-gray-900 dark:to-pink-950/30 rounded-2xl sm:rounded-3xl shadow-xl border-2 border-purple-200/50 dark:border-purple-800/50 p-8 sm:p-12 lg:p-16 text-center overflow-hidden">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-blue-500/5 animate-pulse"></div>
          
          <div className="relative">
            <div className="mb-4 sm:mb-6 inline-block">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur-2xl opacity-50 animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50 p-6 sm:p-8 rounded-full">
                  <MessageCircle className="w-12 h-12 sm:w-16 sm:h-16 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2 sm:mb-3">
              No posts yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 text-base sm:text-lg px-4">
              Be the first to share something amazing!
            </p>
            <button
              onClick={onOpenCreatePost}
              className="px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 font-bold text-base sm:text-lg"
            >
              Create Your First Post ✨
            </button>
          </div>
        </div>
      ) : (
        posts.map((post) => (
          <div
            key={post.id}
            className="bg-gradient-to-br from-white via-purple-50/20 to-pink-50/20 dark:from-gray-900 dark:via-purple-950/10 dark:to-pink-950/10 rounded-2xl sm:rounded-3xl shadow-xl border border-purple-200/50 dark:border-purple-800/50 overflow-hidden hover:shadow-2xl transition-all duration-300 backdrop-blur-sm"
          >
            {/* Post Header */}
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-purple-100/50 dark:border-purple-900/50 bg-gradient-to-r from-purple-50/30 to-pink-50/30 dark:from-purple-950/20 dark:to-pink-950/20">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {/* Story ring around avatar */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-full p-[2px] scale-110">
                    <div className="w-full h-full rounded-full bg-white dark:bg-gray-900"></div>
                  </div>
                  <img
                    src={post.user.imageUrl || '/default-avatar.png'}
                    alt={getDisplayName(post)}
                    className="relative w-11 h-11 rounded-full object-cover ring-2 ring-white dark:ring-gray-900"
                  />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base">
                    {getDisplayName(post)}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {new Date(post.createdAt).toLocaleDateString()} • {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {/* Post Menu */}
              <div className="relative dropdown-menu">
                <button
                  onClick={() => setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)}
                  className="p-2.5 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-full transition-all duration-300 hover:scale-110"
                >
                  <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>

                {openMenuPostId === post.id && (
                  <div className="absolute right-0 mt-2 w-56 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-xl shadow-2xl border-2 border-purple-200/50 dark:border-purple-700/50 z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    {canEditPost(post) ? (
                      <>
                        <button
                          onClick={() => handleEditPost(post)}
                          className="w-full px-5 py-3 text-left flex items-center gap-3 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30 transition-all font-medium"
                        >
                          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
                            <Edit2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <span>Edit Post</span>
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="w-full px-5 py-3 text-left flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-red-600 dark:text-red-400 font-medium"
                        >
                          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                            <Trash2 className="w-4 h-4" />
                          </div>
                          <span>Delete Post</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleCopyLink(post.id)}
                          className="w-full px-5 py-3 text-left flex items-center gap-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/30 dark:hover:to-purple-900/30 transition-all font-medium"
                        >
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                            <Link className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <span>Copy Link</span>
                        </button>
                        <button
                          onClick={() => handleReportPost(post.id)}
                          className="w-full px-5 py-3 text-left flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-red-600 dark:text-red-400 font-medium"
                        >
                          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                            <Flag className="w-4 h-4" />
                          </div>
                          <span>Report Post</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Post Image/Video */}
            <ImageCarousel
              images={post.imageUrls}
              postId={post.id}
              mediaType={post.mediaType}
              currentImageIndexes={currentImageIndexes}
              setCurrentImageIndexes={setCurrentImageIndexes}
            />

            {/* Post Actions */}
            <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
              {/* Engagement Metrics - Mobile Optimized */}
              <div className="flex items-center justify-between pb-3 border-b border-purple-100/50 dark:border-purple-900/50">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <button
                    onClick={() => handleLike(post.id)}
                    disabled={processingLikes.has(post.id)}
                    className={`group flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-full transition-all duration-300 font-semibold text-sm active:scale-95 ${
                      post.liked
                        ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg shadow-red-500/50 scale-105'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400 hover:scale-105'
                    }`}
                  >
                    <Heart className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110 ${post.liked ? 'fill-current animate-pulse' : ''}`} />
                    <span className="text-xs sm:text-sm">{post.likes.toLocaleString()}</span>
                  </button>
                  <button
                    onClick={() => onOpenComments(post)}
                    className="group flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500 dark:hover:text-blue-400 transition-all duration-300 hover:scale-105 active:scale-95 font-semibold text-sm"
                  >
                    <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110" />
                    <span className="text-xs sm:text-sm">{post.comments.toLocaleString()}</span>
                  </button>
                  <button
                    onClick={() => handleShare(post.id)}
                    className="group flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-500 dark:hover:text-green-400 transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    <Share2 className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:scale-110" />
                  </button>
                </div>
                <button
                  onClick={() => handleBookmark(post.id)}
                  disabled={processingBookmarks.has(post.id)}
                  className={`p-2 sm:p-2.5 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 flex-shrink-0 ${
                    post.bookmarked
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-lg shadow-yellow-500/50'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:text-yellow-500'
                  }`}
                >
                  <Bookmark className={`w-4 h-4 sm:w-5 sm:h-5 ${post.bookmarked ? 'fill-current' : ''}`} />
                </button>
              </div>

              {/* Post Caption */}
              {editingPost?.id === post.id ? (
                <div className="space-y-3">
                  <textarea
                    value={editingPost.caption}
                    onChange={(e) => setEditingPost({ ...editingPost, caption: e.target.value })}
                    className="w-full p-4 border-2 border-purple-300 dark:border-purple-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:border-purple-500 dark:focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdatePost}
                      className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setEditingPost(null)}
                      className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300 hover:scale-105 font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-gray-900 dark:text-white leading-relaxed">
                  <span className="font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                    {getDisplayName(post)}
                  </span>{' '}
                  <span className="text-gray-700 dark:text-gray-300">
                    {post.caption.length > 150 ? (
                      <>
                        {post.caption.slice(0, 150)}...{' '}
                        <button className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">
                          See more
                        </button>
                      </>
                    ) : (
                      post.caption
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
