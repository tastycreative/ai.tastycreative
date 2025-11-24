// app\(dashboard)\workspace\user-feed\profile\[userId]\page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter, useParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import type { Point, Area } from 'react-easy-crop';
import {
  Camera,
  Image as ImageIcon,
  Users,
  Heart,
  MessageCircle,
  Bookmark,
  Settings,
  MoreVertical,
  Loader2,
  ArrowLeft,
  Edit3,
  Trash2,
  Flag,
  Link2,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  ZoomIn,
  ZoomOut,
  Send,
  Reply,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

// Add custom CSS for animations
const customStyles = `
  @keyframes gradient {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-20px) rotate(5deg); }
  }

  .animate-gradient {
    background-size: 200% 200%;
    animation: gradient 6s ease infinite;
  }
`;

interface UserProfile {
  id: string;
  clerkId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  imageUrl: string | null;
  coverImageUrl?: string | null;
  postsCount: number;
  friendsCount: number;
  isFriend: boolean;
  isOwnProfile: boolean;
}

interface Post {
  id: string;
  imageUrls: string[];
  caption: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  bookmarksCount: number;
  liked: boolean;
  bookmarked: boolean;
  user: {
    id: string;
    clerkId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    imageUrl: string | null;
  };
}

interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  liked: boolean;
  likeCount: number;
  replyCount: number;
  parentCommentId?: string | null;
  replies?: Comment[];
  user: {
    id: string;
    clerkId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    imageUrl: string | null;
  };
}

export default function UserProfilePage() {
  const { userId: clerkId } = useAuth();
  const router = useRouter();
  const params = useParams();
  const profileUserId = params.userId as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  
  // Crop modal state
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropType, setCropType] = useState<'profile' | 'cover'>('profile');
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  
  // Post detail modal state
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [mounted, setMounted] = useState(false);
  const [currentImageIndexes, setCurrentImageIndexes] = useState<Record<string, number>>({});
  const [postComments, setPostComments] = useState<Record<string, Comment[]>>({});
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const [likeAnimations, setLikeAnimations] = useState<Set<string>>(new Set());
  const [commentAnimations, setCommentAnimations] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Fetch user profile
  useEffect(() => {
    if (!clerkId || !profileUserId) return;

    const fetchProfile = async () => {
      try {
        const response = await fetch(`/api/feed/profile/${profileUserId}`);
        if (!response.ok) throw new Error('Failed to fetch profile');
        const data = await response.json();
        setProfile(data);
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [clerkId, profileUserId]);

  // Fetch user posts
  useEffect(() => {
    if (!profileUserId) return;

    const fetchPosts = async () => {
      try {
        const response = await fetch(`/api/feed/profile/${profileUserId}/posts`);
        if (!response.ok) throw new Error('Failed to fetch posts');
        const data = await response.json();
        setPosts(data);
      } catch (error) {
        console.error('Error fetching posts:', error);
        toast.error('Failed to load posts');
      }
    };

    fetchPosts();
  }, [profileUserId]);

  // Load comments when a post is selected
  useEffect(() => {
    if (selectedPost && !postComments[selectedPost.id]) {
      loadComments(selectedPost.id);
    }
  }, [selectedPost]);

  const loadComments = async (postId: string) => {
    setLoadingComments(prev => new Set(prev).add(postId));
    try {
      const response = await fetch(`/api/feed/posts/${postId}/comments`);
      if (response.ok) {
        const comments = await response.json();
        setPostComments(prev => ({ ...prev, [postId]: comments }));
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setLoadingComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const handleAddComment = async (postId: string) => {
    const commentText = commentTexts[postId]?.trim();
    if (!commentText) return;

    // Trigger comment animation
    setCommentAnimations((prev) => new Set(prev).add(postId));
    setTimeout(() => {
      setCommentAnimations((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }, 500);

    try {
      const response = await fetch(`/api/feed/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: commentText,
          parentCommentId: replyingTo,
        }),
      });

      if (!response.ok) throw new Error('Failed to add comment');

      const { comment: newComment, commentCount } = await response.json();
      
      // Update comments
      setPostComments(prev => ({
        ...prev,
        [postId]: replyingTo
          ? prev[postId]?.map(c =>
              c.id === replyingTo
                ? { ...c, replies: [...(c.replies || []), newComment], replyCount: c.replyCount + 1 }
                : c
            ) || []
          : [newComment, ...(prev[postId] || [])],
      }));

      // Update comment count in posts
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, commentsCount: commentCount } : p
      ));

      if (selectedPost?.id === postId) {
        setSelectedPost(prev => prev ? { ...prev, commentsCount: commentCount } : null);
      }

      // Clear input
      setCommentTexts(prev => ({ ...prev, [postId]: '' }));
      setReplyingTo(null);
      toast.success(replyingTo ? 'Reply added!' : 'Comment added!');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!clerkId) return;

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const wasLiked = post.liked;

    // Trigger heart animation
    if (!wasLiked) {
      setLikeAnimations((prev) => new Set(prev).add(`post-${postId}`));
      setTimeout(() => {
        setLikeAnimations((prev) => {
          const next = new Set(prev);
          next.delete(`post-${postId}`);
          return next;
        });
      }, 600);
    }

    // Optimistic update
    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId
          ? {
              ...p,
              liked: !p.liked,
              likesCount: p.liked ? p.likesCount - 1 : p.likesCount + 1,
            }
          : p
      )
    );

    if (selectedPost && selectedPost.id === postId) {
      setSelectedPost({
        ...selectedPost,
        liked: !selectedPost.liked,
        likesCount: selectedPost.liked
          ? selectedPost.likesCount - 1
          : selectedPost.likesCount + 1,
      });
    }

    try {
      const response = await fetch(`/api/feed/posts/${postId}/like`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to like post');
    } catch (error) {
      console.error('Error liking post:', error);
      toast.error('Failed to like post');

      // Revert on error
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === postId
            ? {
                ...p,
                liked: wasLiked,
                likesCount: wasLiked ? p.likesCount + 1 : p.likesCount - 1,
              }
            : p
        )
      );

      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost({
          ...selectedPost,
          liked: wasLiked,
          likesCount: wasLiked
            ? selectedPost.likesCount + 1
            : selectedPost.likesCount - 1,
        });
      }
    }
  };

  const handleBookmarkPost = async (postId: string) => {
    if (!clerkId) return;

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const wasBookmarked = post.bookmarked;

    // Optimistic update
    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId
          ? {
              ...p,
              bookmarked: !p.bookmarked,
              bookmarksCount: p.bookmarked
                ? p.bookmarksCount - 1
                : p.bookmarksCount + 1,
            }
          : p
      )
    );

    if (selectedPost && selectedPost.id === postId) {
      setSelectedPost({
        ...selectedPost,
        bookmarked: !selectedPost.bookmarked,
        bookmarksCount: selectedPost.bookmarked
          ? selectedPost.bookmarksCount - 1
          : selectedPost.bookmarksCount + 1,
      });
    }

    try {
      const response = await fetch(`/api/feed/posts/${postId}/bookmark`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to bookmark post');
    } catch (error) {
      console.error('Error bookmarking post:', error);
      toast.error('Failed to bookmark post');

      // Revert on error
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === postId
            ? {
                ...p,
                bookmarked: wasBookmarked,
                bookmarksCount: wasBookmarked
                  ? p.bookmarksCount + 1
                  : p.bookmarksCount - 1,
              }
            : p
        )
      );

      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost({
          ...selectedPost,
          bookmarked: wasBookmarked,
          bookmarksCount: wasBookmarked
            ? selectedPost.bookmarksCount + 1
            : selectedPost.bookmarksCount - 1,
        });
      }
    }
  };

  const handleLikeComment = async (postId: string, commentId: string) => {
    const comment = postComments[postId]?.find(c => c.id === commentId || c.replies?.some(r => r.id === commentId));
    if (!comment) return;

    const targetComment = comment.id === commentId ? comment : comment.replies?.find(r => r.id === commentId);
    if (!targetComment) return;

    const wasLiked = targetComment.liked;

    // Trigger heart animation for comment
    if (!wasLiked) {
      setLikeAnimations((prev) => new Set(prev).add(`comment-${commentId}`));
      setTimeout(() => {
        setLikeAnimations((prev) => {
          const next = new Set(prev);
          next.delete(`comment-${commentId}`);
          return next;
        });
      }, 600);
    }

    // Optimistic update
    setPostComments(prev => ({
      ...prev,
      [postId]: prev[postId].map(c => {
        if (c.id === commentId) {
          return { ...c, liked: !wasLiked, likeCount: wasLiked ? c.likeCount - 1 : c.likeCount + 1 };
        }
        if (c.replies) {
          return {
            ...c,
            replies: c.replies.map(r =>
              r.id === commentId
                ? { ...r, liked: !wasLiked, likeCount: wasLiked ? r.likeCount - 1 : r.likeCount + 1 }
                : r
            ),
          };
        }
        return c;
      }),
    }));

    try {
      const response = await fetch(`/api/feed/comments/${commentId}/like`, {
        method: wasLiked ? 'DELETE' : 'POST',
      });

      if (!response.ok) throw new Error('Failed to like comment');
    } catch (error) {
      // Revert on error
      setPostComments(prev => ({
        ...prev,
        [postId]: prev[postId].map(c => {
          if (c.id === commentId) {
            return { ...c, liked: wasLiked, likeCount: wasLiked ? c.likeCount + 1 : c.likeCount - 1 };
          }
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map(r =>
                r.id === commentId
                  ? { ...r, liked: wasLiked, likeCount: wasLiked ? r.likeCount + 1 : r.likeCount - 1 }
                  : r
              ),
            };
          }
          return c;
        }),
      }));
      toast.error('Failed to like comment');
    }
  };

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas is empty'));
        }
      }, 'image/jpeg', 0.95);
    });
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', 'cover');

    try {
      const response = await fetch('/api/feed/profile/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload cover image');
      const data = await response.json();
      
      setProfile(prev => prev ? { ...prev, coverImageUrl: data.imageUrl } : null);
      toast.success('Cover photo updated!');
    } catch (error) {
      console.error('Error uploading cover:', error);
      toast.error('Failed to upload cover photo');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleProfileImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result as string);
      setOriginalFile(file);
      setCropType('profile');
      setShowCropModal(true);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
    
    // Reset input
    e.target.value = '';
  };

  const handleCropSave = async () => {
    if (!croppedAreaPixels || !imageToCrop || !originalFile) return;

    try {
      setUploadingProfile(true);
      
      // Get cropped image blob
      const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
      
      // Create form data
      const formData = new FormData();
      formData.append('image', croppedBlob, originalFile.name);
      formData.append('type', cropType);

      const response = await fetch('/api/feed/profile/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload profile image');
      const data = await response.json();
      
      setProfile(prev => prev ? { ...prev, imageUrl: data.imageUrl } : null);
      toast.success('Profile picture updated!');
      setShowCropModal(false);
      setImageToCrop(null);
    } catch (error) {
      console.error('Error uploading profile:', error);
      toast.error('Failed to upload profile picture');
    } finally {
      setUploadingProfile(false);
    }
  };

  const ImageCarousel = ({ images, postId }: { images: string[]; postId: string }) => {
    const currentIndex = currentImageIndexes[postId] || 0;

    const goToPrevious = () => {
      setCurrentImageIndexes(prev => ({
        ...prev,
        [postId]: Math.max(0, currentIndex - 1)
      }));
    };

    const goToNext = () => {
      setCurrentImageIndexes(prev => ({
        ...prev,
        [postId]: Math.min(images.length - 1, currentIndex + 1)
      }));
    };

    if (images.length === 0) return null;

    return (
      <div className="relative w-full h-[500px] bg-black flex items-center justify-center">
        {images.map((imageUrl, index) => (
          <img
            key={index}
            src={imageUrl}
            alt={`Post image ${index + 1}`}
            loading="eager"
            className={`absolute w-full h-full object-contain transition-opacity duration-300 ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}

        {images.length > 1 && (
          <>
            {currentIndex > 0 && (
              <button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 rounded-full shadow-lg transition-all z-10"
              >
                <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-white" />
              </button>
            )}

            {currentIndex < images.length - 1 && (
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 rounded-full shadow-lg transition-all z-10"
              >
                <ChevronRight className="w-6 h-6 text-gray-900 dark:text-white" />
              </button>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndexes(prev => ({ ...prev, [postId]: index }))}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentIndex
                      ? 'bg-white w-6'
                      : 'bg-white/50 hover:bg-white/75'
                  }`}
                />
              ))}
            </div>

            <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full z-10">
              <span className="text-white text-sm font-medium">
                {currentIndex + 1} / {images.length}
              </span>
            </div>
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/30 dark:from-gray-950 dark:via-purple-950/20 dark:to-blue-950/20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/30 dark:from-gray-950 dark:via-purple-950/20 dark:to-blue-950/20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">User not found</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-purple-600 hover:text-purple-700 font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const displayName = profile.username || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email;
  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-purple-50/40 dark:from-gray-950 dark:via-blue-950/20 dark:to-purple-950/20 relative overflow-hidden">
      {/* Inject Custom Styles */}
      <style>{customStyles}</style>
      
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-400/30 to-purple-400/30 dark:from-blue-500/10 dark:to-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-pink-400/30 to-purple-400/30 dark:from-pink-500/10 dark:to-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-br from-cyan-400/20 to-blue-400/20 dark:from-cyan-500/5 dark:to-blue-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Floating Back Button with Glass Effect */}
        <div className="p-4">
          <button
            onClick={() => router.back()}
            className="group flex items-center gap-2 px-4 py-2 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 text-gray-700 dark:text-gray-300"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back</span>
          </button>
        </div>

        {/* Profile Header with Enhanced Glassmorphism */}
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden border border-white/20 dark:border-gray-800/50 mb-6 hover:shadow-purple-500/20 transition-all duration-500">
          {/* Cover Photo with Dynamic Gradient Overlay */}
          <div className="relative h-48 sm:h-72 overflow-hidden group">
            {profile.coverImageUrl ? (
              <>
                <img 
                  src={profile.coverImageUrl} 
                  alt="Cover" 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-purple-900/20 to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-pink-500/10 group-hover:opacity-0 transition-opacity duration-500"></div>
              </>
            ) : (
              <div className="relative w-full h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 animate-gradient"></div>
                <div className="absolute inset-0 opacity-40" style={{
                  backgroundImage: 'radial-gradient(circle at 25% 50%, rgba(255,255,255,.3) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(255,255,255,.2) 0%, transparent 50%)',
                  animation: 'float 8s ease-in-out infinite'
                }}></div>
              </div>
            )}
            
            {profile.isOwnProfile && (
              <label className="absolute bottom-6 right-6 p-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl shadow-2xl cursor-pointer hover:bg-white dark:hover:bg-gray-900 hover:scale-110 transition-all duration-300 border border-white/20 dark:border-gray-700/30 group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                  disabled={uploadingCover}
                />
                {uploadingCover ? (
                  <Loader2 className="w-5 h-5 animate-spin text-purple-600 dark:text-purple-400" />
                ) : (
                  <Camera className="w-5 h-5 text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                )}
              </label>
            )}
          </div>

          {/* Profile Info */}
          <div className="relative px-4 sm:px-6 pb-6">
            {/* Profile Picture with Animated Glow */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-20 sm:-mt-24">
              <div className="relative group">
                {/* Animated Glow Ring */}
                <div className="absolute -inset-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-full blur-xl opacity-75 group-hover:opacity-100 animate-pulse transition-opacity"></div>
                <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-1.5 shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105">
                  <div className="w-full h-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden ring-4 ring-white/50 dark:ring-gray-900/50">
                    {profile.imageUrl ? (
                      <img 
                        src={profile.imageUrl} 
                        alt={displayName || 'Profile'} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl sm:text-5xl font-bold bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                        {(profile.username?.[0] || profile.firstName?.[0] || 'U').toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {profile.isOwnProfile && (
                  <label className="absolute bottom-3 right-3 p-2.5 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full shadow-xl cursor-pointer hover:scale-110 hover:shadow-2xl transition-all duration-300 border-2 border-white dark:border-gray-900 group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfileImageSelect}
                      className="hidden"
                      disabled={uploadingProfile}
                    />
                    {uploadingProfile ? (
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                    ) : (
                      <Camera className="w-5 h-5 text-white group-hover:rotate-12 transition-transform" />
                    )}
                  </label>
                )}
              </div>

              {/* Action Buttons with Enhanced Effects */}
              <div className="flex items-center gap-3 mt-4 sm:mt-0">
                {profile.isOwnProfile ? (
                  <button className="group flex items-center gap-2 px-6 py-3 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl hover:bg-white dark:hover:bg-gray-900 rounded-2xl transition-all duration-300 border border-gray-200/50 dark:border-gray-700/50 shadow-lg hover:shadow-xl hover:scale-105">
                    <Settings className="w-5 h-5 text-gray-700 dark:text-gray-300 group-hover:rotate-90 transition-transform duration-300" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Edit Profile</span>
                  </button>
                ) : (
                  <button className="relative px-8 py-3 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-500 hover:via-purple-500 hover:to-pink-500 text-white font-bold rounded-2xl transition-all shadow-xl hover:shadow-2xl hover:scale-105 overflow-hidden group">
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    <span className="relative">
                      {profile.isFriend ? 'Friends' : 'Add Friend'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* User Info */}
            <div className="mt-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {displayName}
              </h1>
              {fullName && profile.username && (
                <p className="text-gray-600 dark:text-gray-400 mt-1">{fullName}</p>
              )}
            </div>

            {/* Stats with Glass Cards */}
            <div className="flex items-center gap-4 mt-6">
              <div className="group bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 backdrop-blur-xl px-6 py-3 rounded-2xl border border-blue-200/50 dark:border-blue-700/30 hover:scale-110 hover:shadow-xl transition-all duration-300 cursor-pointer">
                <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{profile.postsCount}</p>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-1">Posts</p>
              </div>
              <div className="group bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 backdrop-blur-xl px-6 py-3 rounded-2xl border border-purple-200/50 dark:border-purple-700/30 hover:scale-110 hover:shadow-xl transition-all duration-300 cursor-pointer">
                <p className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{profile.friendsCount}</p>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-1">Friends</p>
              </div>
            </div>
          </div>
        </div>

        {/* Posts Grid */}
        <div className="p-4 sm:p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Posts</h2>
          
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No posts yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="group relative aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-purple-500/30 transition-all duration-500 hover:scale-105"
                  onClick={() => setSelectedPost(post)}
                >
                  <img
                    src={post.imageUrls[0]}
                    alt="Post"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 group-hover:rotate-2"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  {/* Multiple images indicator */}
                  {post.imageUrls.length > 1 && (
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                      <span className="text-white text-xs font-medium flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" />
                        {post.imageUrls.length}
                      </span>
                    </div>
                  )}

                  {/* Enhanced Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-purple-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-8">
                    <div className="flex items-center gap-2 text-white transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                      <div className="p-2 bg-white/20 backdrop-blur-sm rounded-full">
                        <Heart className="w-5 h-5 fill-white drop-shadow-lg" />
                      </div>
                      <span className="font-bold text-lg drop-shadow-lg">{post.likesCount}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                      <div className="p-2 bg-white/20 backdrop-blur-sm rounded-full">
                        <MessageCircle className="w-5 h-5 fill-white drop-shadow-lg" />
                      </div>
                      <span className="font-bold text-lg drop-shadow-lg">{post.commentsCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Post Detail Modal */}
      {mounted && selectedPost && createPortal(
        <React.Fragment>
          <style>
            {`
              @keyframes particle-burst-0 {
                0% { opacity: 1; transform: translate(-50%, -50%) translate(0, 0) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) translate(0, -30px) scale(0); }
              }
              @keyframes particle-burst-1 {
                0% { opacity: 1; transform: translate(-50%, -50%) translate(0, 0) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) translate(20px, -20px) scale(0); }
              }
              @keyframes particle-burst-2 {
                0% { opacity: 1; transform: translate(-50%, -50%) translate(0, 0) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) translate(30px, 0) scale(0); }
              }
              @keyframes particle-burst-3 {
                0% { opacity: 1; transform: translate(-50%, -50%) translate(0, 0) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) translate(20px, 20px) scale(0); }
              }
              @keyframes particle-burst-4 {
                0% { opacity: 1; transform: translate(-50%, -50%) translate(0, 0) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) translate(0, 30px) scale(0); }
              }
              @keyframes particle-burst-5 {
                0% { opacity: 1; transform: translate(-50%, -50%) translate(0, 0) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) translate(-20px, 20px) scale(0); }
              }
            `}
          </style>
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setSelectedPost(null)}
          >
            <div 
              className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col md:flex-row border border-gray-200/20 dark:border-gray-700/30 animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
            {/* Left Side - Image Carousel */}
            <div className="md:w-[55%] bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center relative">
              <div className="w-full h-full flex items-center justify-center">
                <ImageCarousel images={selectedPost.imageUrls} postId={`modal-${selectedPost.id}`} />
              </div>
              <div className="absolute top-10 left-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute bottom-10 right-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>
            </div>

            {/* Right Side - Details */}
            <div className="md:w-[45%] flex flex-col max-h-[95vh] bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur opacity-60"></div>
                    {selectedPost.user.imageUrl ? (
                      <img
                        src={selectedPost.user.imageUrl}
                        alt={selectedPost.user.username || 'User'}
                        className="relative w-11 h-11 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
                      />
                    ) : (
                      <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                        <span className="text-white font-bold text-sm">
                          {(selectedPost.user.username || selectedPost.user.firstName || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">
                      {selectedPost.user.username || `${selectedPost.user.firstName || ''} ${selectedPost.user.lastName || ''}`.trim() || selectedPost.user.email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(selectedPost.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 group"
                >
                  <X className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 transition-colors" />
                </button>
              </div>

              {/* Stats Bar */}
              <div className="flex items-center justify-around py-3 px-5 border-b border-gray-200 dark:border-gray-700/50 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/10 dark:to-purple-900/10">
                <button 
                  onClick={() => handleLikePost(selectedPost.id)}
                  className="flex items-center gap-2 hover:scale-110 transition-transform relative"
                >
                  <div className="relative">
                    <Heart 
                      className={`w-5 h-5 transition-all duration-300 ${
                        selectedPost.liked ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-400'
                      } ${likeAnimations.has(`post-${selectedPost.id}`) ? 'animate-[ping_0.6s_ease-in-out]' : ''}`} 
                    />
                    {likeAnimations.has(`post-${selectedPost.id}`) && (
                      <>
                        {[...Array(6)].map((_, i) => (
                          <Heart
                            key={i}
                            className="absolute top-1/2 left-1/2 w-3 h-3 fill-red-400 text-red-400 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                            style={{
                              animation: `particle-burst-${i} 0.6s ease-out forwards`,
                            }}
                          />
                        ))}
                      </>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {selectedPost.likesCount.toLocaleString()}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <MessageCircle 
                    className={`w-5 h-5 transition-all duration-300 ${
                      commentAnimations.has(selectedPost.id) ? 'text-blue-500 scale-110' : 'text-blue-500'
                    }`} 
                  />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {selectedPost.commentsCount.toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => handleBookmarkPost(selectedPost.id)}
                  className="hover:scale-110 transition-all duration-300"
                >
                  <Bookmark 
                    className={`w-5 h-5 transition-all duration-300 ${
                      selectedPost.bookmarked ? 'fill-amber-500 text-amber-500 scale-110' : 'text-gray-400'
                    }`} 
                  />
                </button>
              </div>

              {/* Caption */}
              <div className="p-5 border-b border-gray-200 dark:border-gray-700/50">
                <div className="flex items-start space-x-3">
                  {selectedPost.user.imageUrl ? (
                    <img
                      src={selectedPost.user.imageUrl}
                      alt={selectedPost.user.username || 'User'}
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-800"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-gray-100 dark:ring-gray-800">
                      <span className="text-white text-sm font-bold">
                        {(selectedPost.user.username || selectedPost.user.firstName || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                      <span className="font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mr-2">
                        {selectedPost.user.username || `${selectedPost.user.firstName || ''} ${selectedPost.user.lastName || ''}`.trim() || selectedPost.user.email}
                      </span>
                      {selectedPost.caption}
                    </p>
                  </div>
                </div>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full">
                {loadingComments.has(selectedPost.id) ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">Loading comments...</p>
                  </div>
                ) : postComments[selectedPost.id]?.length > 0 ? (
                  postComments[selectedPost.id].map((comment) => {
                    if (!comment || !comment.user) return null;
                    return (
                    <div key={comment.id} className="space-y-2">
                      {/* Main Comment */}
                      <div className="flex items-start space-x-3 group hover:bg-gray-50/50 dark:hover:bg-gray-800/30 p-2 rounded-xl transition-all">
                        <div className="flex-shrink-0">
                          {comment.user.imageUrl ? (
                            <img
                              src={comment.user.imageUrl}
                              alt={comment.user.username || 'User'}
                              className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-800"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-gray-100 dark:ring-gray-800">
                              <span className="text-white text-xs font-bold">
                                {(comment.user.username || comment.user.firstName || 'U')[0].toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800 dark:to-gray-800/50 rounded-2xl px-4 py-3 shadow-sm border border-gray-200/50 dark:border-gray-700/30">
                            <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                              {comment.user.username || `${comment.user.firstName || ''} ${comment.user.lastName || ''}`.trim() || 'User'}
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 break-words leading-relaxed">
                              {comment.content}
                            </p>
                          </div>
                          <div className="flex items-center space-x-4 mt-2 px-4">
                            <span className="text-xs text-gray-400 font-medium">
                              {new Date(comment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              onClick={() => handleLikeComment(selectedPost.id, comment.id)}
                              className={`text-xs font-medium transition-colors flex items-center gap-1 relative ${
                                comment.liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                              }`}
                            >
                              <Heart 
                                className={`w-3.5 h-3.5 transition-all duration-300 ${
                                  comment.liked ? 'fill-red-500 scale-110' : ''
                                } ${
                                  likeAnimations.has(`comment-${comment.id}`) ? 'animate-bounce' : ''
                                }`} 
                              />
                              {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
                            </button>
                            <button
                              onClick={() => {
                                setReplyingTo(comment.id);
                                setCommentTexts(prev => ({ ...prev, [selectedPost.id]: `@${comment.user.username || comment.user.firstName || 'User'} ` }));
                              }}
                              className="text-xs text-gray-500 hover:text-blue-500 font-medium transition-colors"
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="ml-12 space-y-2 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                          {comment.replies.map((reply) => {
                            if (!reply || !reply.user) return null;
                            return (
                            <div key={reply.id} className="flex items-start space-x-3 group hover:bg-gray-50/50 dark:hover:bg-gray-800/30 p-2 rounded-xl transition-all">
                              <div className="flex-shrink-0">
                                {reply.user.imageUrl ? (
                                  <img
                                    src={reply.user.imageUrl}
                                    alt={reply.user.username || 'User'}
                                    className="w-8 h-8 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-800"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center ring-2 ring-gray-100 dark:ring-gray-800">
                                    <span className="text-white text-xs font-bold">
                                      {(reply.user.username || reply.user.firstName || 'U')[0].toUpperCase()}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="bg-gradient-to-br from-blue-50 to-purple-50/30 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl px-4 py-2.5 shadow-sm border border-blue-200/30 dark:border-blue-700/20">
                                  <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                                    {reply.user.username || `${reply.user.firstName || ''} ${reply.user.lastName || ''}`.trim() || 'User'}
                                  </p>
                                  <p className="text-sm text-gray-700 dark:text-gray-300 break-words leading-relaxed">
                                    {reply.content}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-4 mt-2 px-4">
                                  <span className="text-xs text-gray-400 font-medium">
                                    {new Date(reply.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <button
                                    onClick={() => handleLikeComment(selectedPost.id, reply.id)}
                                    className={`text-xs font-medium transition-colors flex items-center gap-1 relative ${
                                      reply.liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                                    }`}
                                  >
                                    <Heart 
                                      className={`w-3.5 h-3.5 transition-all duration-300 ${
                                        reply.liked ? 'fill-red-500 scale-110' : ''
                                      } ${
                                        likeAnimations.has(`comment-${reply.id}`) ? 'animate-bounce' : ''
                                      }`} 
                                    />
                                    {reply.likeCount > 0 && <span>{reply.likeCount}</span>}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                          })}
                        </div>
                      )}
                    </div>
                  );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageCircle className="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No comments yet</p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Be the first to comment!</p>
                  </div>
                )}
              </div>

              {/* Comment Input */}
              <div className="p-5 border-t border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-900">
                {replyingTo && (
                  <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Reply className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Replying to comment</span>
                    <button
                      onClick={() => {
                        setReplyingTo(null);
                        setCommentTexts(prev => ({ ...prev, [selectedPost.id]: '' }));
                      }}
                      className="ml-auto text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={commentTexts[selectedPost.id] || ''}
                    onChange={(e) => setCommentTexts(prev => ({ ...prev, [selectedPost.id]: e.target.value }))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment(selectedPost.id);
                      }
                    }}
                    placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all"
                  />
                  <button
                    onClick={() => handleAddComment(selectedPost.id)}
                    disabled={!commentTexts[selectedPost.id]?.trim()}
                    className="p-3 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          </div>
        </React.Fragment>,
        document.body
      )}

      {/* Crop Modal */}
      {showCropModal && imageToCrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Crop Profile Picture
              </h3>
              <button
                onClick={() => {
                  setShowCropModal(false);
                  setImageToCrop(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Crop Area */}
            <div className="relative w-full h-96 bg-gray-900">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Controls */}
            <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
              {/* Zoom Slider */}
              <div className="flex items-center gap-3">
                <ZoomOut className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <ZoomIn className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setImageToCrop(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCropSave}
                  disabled={uploadingProfile}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploadingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
