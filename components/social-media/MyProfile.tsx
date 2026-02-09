'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createPortal } from 'react-dom';
import { Loader2, Heart, MessageCircle, Bookmark, X, ChevronLeft, ChevronRight, Send, User, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Cropper, { Area, Point } from 'react-easy-crop';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';

interface Post {
  id: string;
  imageUrls: string[];
  mediaType?: 'image' | 'video';
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
  profile?: {
    id: string;
    name: string;
    instagramUsername: string | null;
    profileImageUrl: string | null;
  } | null;
}

export default function MyProfile() {
  const { userId: clerkId } = useAuth();
  const router = useRouter();
  const { selectedProfile, isAllProfiles, loadingProfiles } = useInstagramProfile();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  
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

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Set loading based on profile loading state
  useEffect(() => {
    setLoading(loadingProfiles);
  }, [loadingProfiles]);

  // Fetch posts when profile selection changes
  useEffect(() => {
    if (!selectedProfile || isAllProfiles) {
      setPosts([]);
      return;
    }

    const fetchPosts = async () => {
      try {
        setLoadingPosts(true);
        setPosts([]); // Clear posts immediately when switching profiles

        // Fetch posts for selected profile (only own posts, not friends)
        const postsRes = await fetch(`/api/feed/posts?profileId=${selectedProfile.id}&ownOnly=true`);
        if (postsRes.ok) {
          const postsData = await postsRes.json();
          setPosts(postsData);
        }
      } catch (error) {
        console.error('Error fetching posts:', error);
        toast.error('Failed to load posts');
      } finally {
        setLoadingPosts(false);
      }
    };

    fetchPosts();
  }, [selectedProfile, isAllProfiles]);


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
    
    e.target.value = '';
  };

  const handleCropSave = async () => {
    if (!croppedAreaPixels || !imageToCrop || !originalFile || !selectedProfile?.id) return;

    try {
      setUploadingProfile(true);
      
      const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
      
      const formData = new FormData();
      formData.append('image', croppedBlob, originalFile.name);

      const response = await fetch(`/api/instagram/profiles/${selectedProfile.id}/upload-image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload profile picture');
      const data = await response.json();
      
      toast.success('Profile picture updated!');
      setShowCropModal(false);
      setImageToCrop(null);
      
      // Refresh the page to show updated profile picture
      window.location.reload();
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
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white dark:bg-gray-900 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:scale-110 hover:ring-2 hover:ring-[#5DC3F8] transition-all z-10"
              >
                <ChevronLeft className="w-6 h-6 text-black dark:text-white" />
              </button>
            )}
            {currentIndex < images.length - 1 && (
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white dark:bg-gray-900 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:scale-110 hover:ring-2 hover:ring-[#5DC3F8] transition-all z-10"
              >
                <ChevronRight className="w-6 h-6 text-black dark:text-white" />
              </button>
            )}

            {/* Carousel pagination dots with brand accent */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndexes(prev => ({ ...prev, [postId]: index }))}
                  className={`transition-all duration-300 rounded-full ${
                    index === currentIndex
                      ? 'w-8 h-2 bg-[#5DC3F8] shadow-lg'
                      : 'w-2 h-2 bg-white/60 hover:bg-[#EC67A1]/80'
                  }`}
                />
              ))}
            </div>

            <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/70 backdrop-blur-md rounded-full text-white text-xs font-semibold shadow-lg z-10">
              {currentIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F8F8] dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#5DC3F8]" />
      </div>
    );
  }

  if (isAllProfiles) {
    return (
      <div className="min-h-screen bg-[#F8F8F8] dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white dark:bg-gray-900 border-2 border-[#5DC3F8] flex items-center justify-center">
            <User className="w-10 h-10 text-[#5DC3F8]" />
          </div>
          <h3 className="text-xl font-bold text-black dark:text-white mb-2">Select a Profile</h3>
          <p className="text-gray-600 dark:text-gray-400">Please select a specific profile from the sidebar to view</p>
        </div>
      </div>
    );
  }

  if (!selectedProfile) {
    return (
      <div className="min-h-screen bg-[#F8F8F8] dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">No profile selected</p>
        </div>
      </div>
    );
  }

  const displayName = selectedProfile.instagramUsername || selectedProfile.name;

  return (
    /* Theme-aware main container - light: off-white, dark: near-black */
    <div className="min-h-screen bg-[#F8F8F8] dark:bg-gray-950">
      <div className="overflow-y-auto">
        <div className="max-w-5xl mx-auto p-3 sm:p-4 md:p-6">
          {loadingPosts ? (
              /* Theme-aware skeleton loading */
              <>
                {/* Cover Skeleton */}
                <div className="relative h-48 sm:h-64 md:h-80 rounded-2xl overflow-hidden shadow-xl mb-6 bg-gray-200 dark:bg-gray-800 animate-pulse" />

                {/* Profile Info Skeleton - theme-aware */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 -mt-20 relative z-10 border border-gray-200 dark:border-gray-800">
                  <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
                    {/* Profile Picture Skeleton */}
                    <div className="relative -mt-16 sm:-mt-20">
                      <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse border-4 border-white dark:border-gray-900 shadow-2xl" />
                    </div>

                    {/* Profile Details Skeleton */}
                    <div className="flex-1 text-center sm:text-left space-y-3">
                      <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-lg w-48 mx-auto sm:mx-0 animate-pulse" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-64 mx-auto sm:mx-0 animate-pulse" />
                      <div className="flex gap-6 justify-center sm:justify-start">
                        <div className="text-center">
                          <div className="h-6 w-12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-1" />
                          <div className="h-4 w-12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Posts Grid Skeleton */}
                <div className="mt-8">
                  <div className="h-7 bg-gray-200 dark:bg-gray-800 rounded w-20 mb-4 animate-pulse" />
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    {[...Array(9)].map((_, i) => (
                      <div
                        key={i}
                        className="relative aspect-square rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse"
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
            {/* Cover Photo - Theme-aware with brand accent */}
            <div className="relative h-32 sm:h-48 md:h-64 lg:h-80 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl mb-4 sm:mb-6 group">
              {/* Brand gradient accent background */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#5DC3F8] via-[#EC67A1] to-[#F774B9] animate-gradient-x" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              {/* Floating accent shapes */}
              <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-10 right-10 w-40 h-40 bg-[#F774B9]/10 rounded-full blur-3xl animate-pulse delay-700" />
              {/* Hover effect with brand accent */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#5DC3F8]/0 to-[#F774B9]/0 group-hover:from-[#5DC3F8]/20 group-hover:to-[#F774B9]/20 transition-all duration-700" />
            </div>

            {/* Profile Info Card - Theme-aware white/dark backgrounds */}
            <div className="relative bg-white dark:bg-gray-900 backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 lg:p-8 -mt-16 sm:-mt-20 z-10 border border-gray-200 dark:border-gray-800">
              
              <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6">
                {/* Profile Picture with brand accent ring */}
                <div className="relative -mt-16 sm:-mt-20 lg:-mt-24">
                  <div className="relative">
                    {/* Brand gradient ring for avatar */}
                    <div className="absolute inset-0 -m-1 rounded-full bg-gradient-to-tr from-[#5DC3F8] via-[#EC67A1] to-[#F774B9] p-1 animate-pulse">
                      <div className="w-full h-full rounded-full bg-white dark:bg-gray-900" />
                    </div>
                    {selectedProfile.profileImageUrl ? (
                      <img
                        src={selectedProfile.profileImageUrl}
                        alt={displayName}
                        className="relative w-24 h-24 sm:w-32 sm:h-32 lg:w-44 lg:h-44 rounded-full object-cover border-4 border-white dark:border-gray-900 shadow-2xl hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="relative w-24 h-24 sm:w-32 sm:h-32 lg:w-44 lg:h-44 rounded-full bg-gradient-to-br from-[#5DC3F8] via-[#EC67A1] to-[#F774B9] flex items-center justify-center border-4 border-white dark:border-gray-900 shadow-2xl hover:scale-105 transition-transform duration-300">
                        <User className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 text-white" />
                      </div>
                    )}
                    {/* Camera button with brand accent */}
                    <label className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 p-2 sm:p-3 bg-gradient-to-br from-[#5DC3F8] to-[#EC67A1] rounded-full shadow-lg cursor-pointer hover:scale-110 hover:rotate-12 transition-all duration-300 group">
                      <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-white group-hover:scale-110 transition-transform" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfileImageSelect}
                        className="hidden"
                        disabled={uploadingProfile}
                      />
                    </label>
                  </div>
                </div>

                {/* Profile Details - Neutral text colors */}
                <div className="flex-1 text-center sm:text-left space-y-3 sm:space-y-4">
                  <div>
                    {/* Profile name - neutral black/white text */}
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-2">
                      {displayName}
                    </h1>
                    {/* Username with brand blue accent */}
                    {selectedProfile.instagramUsername && (
                      <p className="text-[#5DC3F8] dark:text-[#5DC3F8] text-base sm:text-lg">@{selectedProfile.instagramUsername}</p>
                    )}
                  </div>

                  {/* Stats Card with brand accent border */}
                  <div className="flex gap-3 sm:gap-4 justify-center sm:justify-start flex-wrap">
                    <div className="group relative overflow-hidden px-4 sm:px-6 py-3 sm:py-4 bg-white dark:bg-gray-800 rounded-2xl border-2 border-[#5DC3F8] hover:border-[#EC67A1] transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#5DC3F8]/20">
                      <div className="relative">
                        {/* Stats number - neutral text */}
                        <div className="text-xl sm:text-2xl font-bold text-black dark:text-white">
                          {posts.length}
                        </div>
                        <div className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">Posts</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Posts Section */}
            <div className="mt-6 sm:mt-8">
              {/* Section heading - neutral text */}
              <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white mb-4 sm:mb-6">Posts</h2>
              
              {posts.length === 0 ? (
                <div className="relative overflow-hidden bg-white dark:bg-gray-900 backdrop-blur-xl rounded-3xl shadow-2xl p-16 text-center border-2 border-[#5DC3F8] dark:border-[#5DC3F8]">
                  <div className="relative">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white dark:bg-gray-800 border-2 border-[#EC67A1] rounded-full mb-4">
                      <Camera className="w-10 h-10 text-[#5DC3F8]" />
                    </div>
                    <p className="text-xl font-semibold text-black dark:text-white mb-2">No posts yet</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Start sharing your moments</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-5">
                  {posts.map((post, index) => (
                    <div
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className="relative aspect-square rounded-2xl overflow-hidden cursor-pointer group"
                      style={{
                        animationDelay: `${index * 50}ms`
                      }}
                    >
                      <img
                        src={post.imageUrls[0]}
                        alt="Post"
                        className="w-full h-full object-cover group-hover:scale-125 transition-transform duration-500"
                      />
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                      {/* Stats overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <div className="flex gap-4 text-white transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full">
                            <Heart className="w-5 h-5 fill-current" />
                            <span className="font-bold">{post.likesCount}</span>
                          </div>
                          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full">
                            <MessageCircle className="w-5 h-5 fill-current" />
                            <span className="font-bold">{post.commentsCount}</span>
                          </div>
                        </div>
                      </div>
                      {/* Corner badge for multiple images */}
                      {post.imageUrls.length > 1 && (
                        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2 py-1 rounded-full text-white text-xs font-bold">
                          {post.imageUrls.length}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
              </>
            )}
          </div>
        </div>

      {/* Post Detail Modal - Theme-aware overlay and container */}
      {mounted && selectedPost && createPortal(
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-900 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row border-2 border-[#5DC3F8] dark:border-[#5DC3F8] animate-in slide-in-from-bottom-4 duration-500">
            {/* Image Section */}
            <div className="md:w-1/2 bg-black flex items-center justify-center">
              <ImageCarousel images={selectedPost.imageUrls} postId={selectedPost.id} />
            </div>

            {/* Details Section */}
            <div className="md:w-1/2 flex flex-col max-h-[90vh]">
              {/* Header - theme-aware */}
              <div className="p-5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Brand accent ring for avatar */}
                  <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#5DC3F8] via-[#EC67A1] to-[#F774B9]">
                    <img
                      src={selectedPost.user.imageUrl || '/default-avatar.png'}
                      alt={displayName || ''}
                      className="w-11 h-11 rounded-full object-cover border-2 border-white dark:border-gray-900"
                    />
                  </div>
                  <div>
                    {/* Neutral text */}
                    <p className="font-bold text-black dark:text-white">{displayName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      {new Date(selectedPost.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all hover:scale-110 hover:rotate-90 duration-300"
                >
                  <X className="w-5 h-5 text-black dark:text-white" />
                </button>
              </div>

              {/* Caption - neutral text */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <p className="text-black dark:text-white whitespace-pre-wrap">
                  {selectedPost.caption}
                </p>
              </div>

              {/* Comments */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingComments.has(selectedPost.id) ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-[#5DC3F8]" />
                  </div>
                ) : postComments[selectedPost.id]?.length > 0 ? (
                  postComments[selectedPost.id].map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <img
                        src={comment.profile?.profileImageUrl || comment.user.imageUrl || '/default-avatar.png'}
                        alt={comment.profile?.instagramUsername || comment.user.username || ''}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                      <div className="flex-1">
                        {/* Comment bubble - theme-aware */}
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2">
                          <p className="font-semibold text-sm text-black dark:text-white">
                            {comment.profile?.instagramUsername || comment.profile?.name || comment.user.username || `${comment.user.firstName || ''} ${comment.user.lastName || ''}`.trim()}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{comment.content}</p>
                        </div>
                        <div className="flex items-center gap-4 mt-1 px-4">
                          <button
                            onClick={() => {/* Handle like comment */}}
                            className="text-xs text-gray-500 hover:text-[#5DC3F8] dark:hover:text-[#5DC3F8]"
                          >
                            Like {comment.likeCount > 0 && `(${comment.likeCount})`}
                          </button>
                          <span className="text-xs text-gray-400">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                    No comments yet
                  </p>
                )}
              </div>

              {/* Actions Section - Theme-aware */}
              <div className="p-5 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="flex items-center gap-3 mb-4">
                  {/* Like button with brand accent when active */}
                  <button
                    onClick={() => handleLikePost(selectedPost.id)}
                    className={`p-3 rounded-full transition-all duration-300 hover:scale-110 ${
                      selectedPost.liked
                        ? 'bg-red-100 dark:bg-red-900/30'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Heart
                      className={`w-6 h-6 transition-all ${
                        selectedPost.liked ? 'fill-red-500 text-red-500 scale-110' : 'text-black dark:text-white'
                      }`}
                    />
                  </button>
                  {/* Comment button - neutral with brand hover */}
                  <button className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all hover:scale-110">
                    <MessageCircle className="w-6 h-6 text-black dark:text-white" />
                  </button>
                  {/* Bookmark button with brand accent when active */}
                  <button
                    onClick={() => handleBookmarkPost(selectedPost.id)}
                    className={`p-3 rounded-full transition-all duration-300 hover:scale-110 ml-auto ${
                      selectedPost.bookmarked
                        ? 'bg-yellow-100 dark:bg-yellow-900/30'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Bookmark
                      className={`w-6 h-6 transition-all ${
                        selectedPost.bookmarked ? 'fill-yellow-500 text-yellow-500 scale-110' : 'text-black dark:text-white'
                      }`}
                    />
                  </button>
                </div>

                {/* Likes count - neutral text */}
                <div className="text-sm font-bold text-black dark:text-white mb-3">
                  {selectedPost.likesCount} {selectedPost.likesCount === 1 ? 'like' : 'likes'}
                </div>

                {/* Add Comment Input - brand accent focus ring */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commentTexts[selectedPost.id] || ''}
                    onChange={(e) =>
                      setCommentTexts((prev) => ({
                        ...prev,
                        [selectedPost.id]: e.target.value,
                      }))
                    }
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment(selectedPost.id);
                      }
                    }}
                    placeholder="Add a comment..."
                    className="flex-1 px-5 py-3 bg-white dark:bg-gray-800 backdrop-blur-sm rounded-full border-2 border-gray-200 dark:border-gray-700 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5DC3F8] focus:border-transparent transition-all"
                  />
                  <button
                    onClick={() => handleAddComment(selectedPost.id)}
                    disabled={!commentTexts[selectedPost.id]?.trim()}
                    className="p-3 bg-gradient-to-r from-[#5DC3F8] to-[#EC67A1] hover:from-[#5DC3F8]/90 hover:to-[#EC67A1]/90 disabled:from-gray-300 disabled:to-gray-400 dark:disabled:from-gray-700 dark:disabled:to-gray-700 text-white rounded-full transition-all hover:scale-110 disabled:scale-100 shadow-lg shadow-[#5DC3F8]/30"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Crop Modal - Theme-aware overlay */}
      {showCropModal && imageToCrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-900 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-2xl w-full mx-4 border-2 border-[#5DC3F8] dark:border-[#5DC3F8] animate-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between rounded-t-3xl">
              {/* Modal title - neutral text */}
              <h3 className="text-2xl font-bold text-black dark:text-white">
                Crop Profile Picture
              </h3>
              <button
                onClick={() => {
                  setShowCropModal(false);
                  setImageToCrop(null);
                }}
                className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all hover:scale-110 hover:rotate-90 duration-300"
              >
                <X className="w-5 h-5 text-black dark:text-white" />
              </button>
            </div>

            {/* Cropper area */}
            <div className="relative h-96 bg-gray-100 dark:bg-gray-800">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            <div className="p-6 space-y-4">
              <div>
                {/* Zoom label - neutral text */}
                <label className="text-sm font-medium text-black dark:text-white mb-2 block">
                  Zoom
                </label>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="flex gap-3">
                {/* Cancel button - neutral */}
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setImageToCrop(null);
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 hover:scale-[1.02] transition-all font-semibold"
                >
                  Cancel
                </button>
                {/* Save button - brand gradient */}
                <button
                  onClick={handleCropSave}
                  disabled={uploadingProfile}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[#5DC3F8] to-[#EC67A1] hover:from-[#5DC3F8]/90 hover:to-[#EC67A1]/90 text-white rounded-xl transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 font-semibold shadow-lg shadow-[#5DC3F8]/30"
                >
                  {uploadingProfile ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Save'
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
