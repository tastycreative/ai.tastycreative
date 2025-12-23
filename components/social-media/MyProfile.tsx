'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createPortal } from 'react-dom';
import { Loader2, Heart, MessageCircle, Bookmark, X, ChevronLeft, ChevronRight, Send, User, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Cropper, { Area, Point } from 'react-easy-crop';

interface UserProfile {
  id: string;
  clerkId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  imageUrl: string | null;
  coverImageUrl: string | null;
  postsCount: number;
  friendsCount: number;
}

interface CreatorProfile {
  id: string;
  name: string;
  description: string | null;
  instagramUsername: string | null;
  profileImageUrl: string | null;
  isDefault: boolean;
  _count?: {
    posts: number;
    feedPosts: number;
  };
}

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
  const [creatorProfiles, setCreatorProfiles] = useState<CreatorProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<CreatorProfile | null>(null);
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

  // Fetch creator profiles
  useEffect(() => {
    if (!clerkId) return;

    const fetchProfiles = async () => {
      try {
        setLoading(true);
        const profilesRes = await fetch('/api/instagram/profiles');
        if (!profilesRes.ok) throw new Error('Failed to fetch creator profiles');
        const profilesData = await profilesRes.json();
        const profiles = Array.isArray(profilesData) ? profilesData : (profilesData.profiles || []);
        setCreatorProfiles(profiles);
        
        // Load saved profile or select first one
        const savedProfileId = localStorage.getItem('selectedProfileId');
        if (savedProfileId && profiles.some((p: CreatorProfile) => p.id === savedProfileId)) {
          setSelectedProfileId(savedProfileId);
        } else if (profiles.length > 0) {
          setSelectedProfileId(profiles[0].id);
        }
      } catch (error) {
        console.error('Error fetching profiles:', error);
        toast.error('Failed to load profiles');
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [clerkId]);

  // Fetch posts when profile selection changes
  useEffect(() => {
    if (!selectedProfileId) return;

    const fetchProfileAndPosts = async () => {
      try {
        setLoadingPosts(true);
        setPosts([]); // Clear posts immediately when switching profiles
        
        // Find the selected profile
        const profile = creatorProfiles.find(p => p.id === selectedProfileId);
        if (profile) {
          setSelectedProfile(profile);
        }

        // Fetch posts for selected profile (only own posts, not friends)
        const postsRes = await fetch(`/api/feed/posts?profileId=${selectedProfileId}&ownOnly=true`);
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

    fetchProfileAndPosts();
  }, [selectedProfileId, creatorProfiles]);


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
    if (!croppedAreaPixels || !imageToCrop || !originalFile || !selectedProfileId) return;

    try {
      setUploadingProfile(true);
      
      const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
      
      const formData = new FormData();
      formData.append('image', croppedBlob, originalFile.name);

      const response = await fetch(`/api/instagram/profiles/${selectedProfileId}/upload-image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload profile picture');
      const data = await response.json();
      
      // Update selected profile
      setSelectedProfile(prev => prev ? { ...prev, profileImageUrl: data.imageUrl } : null);
      setCreatorProfiles(prev => prev.map(p => 
        p.id === selectedProfileId ? { ...p, profileImageUrl: data.imageUrl } : p
      ));
      
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
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-all z-10"
              >
                <ChevronLeft className="w-6 h-6 text-gray-800 dark:text-white" />
              </button>
            )}
            {currentIndex < images.length - 1 && (
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-all z-10"
              >
                <ChevronRight className="w-6 h-6 text-gray-800 dark:text-white" />
              </button>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndexes(prev => ({ ...prev, [postId]: index }))}
                  className={`transition-all duration-300 rounded-full ${
                    index === currentIndex
                      ? 'w-8 h-2 bg-white shadow-lg'
                      : 'w-2 h-2 bg-white/60 hover:bg-white/80'
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/30 dark:from-gray-950 dark:via-purple-950/20 dark:to-blue-950/20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!selectedProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/30 dark:from-gray-950 dark:via-purple-950/20 dark:to-blue-950/20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">No profile selected</p>
        </div>
      </div>
    );
  }

  const displayName = selectedProfile.instagramUsername || selectedProfile.name;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-purple-50/40 dark:from-gray-950 dark:via-blue-950/20 dark:to-purple-950/20">
      {/* Mobile Profile Selector - Only visible on mobile */}
      <div className="md:hidden sticky top-0 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-purple-200/50 dark:border-purple-800/50 shadow-lg">
        <div className="p-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 min-w-max">
            {creatorProfiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => {
                  setSelectedProfileId(profile.id);
                  localStorage.setItem('selectedProfileId', profile.id);
                }}
                className="flex-shrink-0 flex flex-col items-center gap-2"
              >
                <div className={`relative p-[3px] rounded-full transition-all duration-300 ${
                  selectedProfileId === profile.id
                    ? 'bg-gradient-to-tr from-purple-500 via-pink-500 to-blue-500 scale-105 shadow-lg shadow-purple-500/30'
                    : 'bg-gradient-to-tr from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-600'
                }`}>
                  <div className="bg-white dark:bg-gray-900 rounded-full p-[2px]">
                    {profile.profileImageUrl ? (
                      <img
                        src={profile.profileImageUrl}
                        alt={profile.name}
                        className="w-14 h-14 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <User className="w-7 h-7 text-white" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-center max-w-[70px]">
                  <p className={`text-xs font-semibold truncate ${
                    selectedProfileId === profile.id
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {profile.name}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex h-screen overflow-hidden">
        {/* Profile Sidebar - Hidden on mobile */}
        <div className="hidden md:block w-80 border-r border-gray-200/50 dark:border-gray-800/50 bg-gradient-to-br from-white via-purple-50/30 to-pink-50/30 dark:from-gray-900 dark:via-purple-950/20 dark:to-pink-950/20 overflow-y-auto backdrop-blur-xl">
          <div className="p-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-6">My Profiles</h2>
            
            <div className="space-y-3">
              {creatorProfiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => {
                    setSelectedProfileId(profile.id);
                    localStorage.setItem('selectedProfileId', profile.id);
                  }}
                  className={`w-full group relative overflow-hidden rounded-2xl transition-all duration-300 ${
                    selectedProfileId === profile.id
                      ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 text-white shadow-2xl shadow-purple-500/30 scale-[1.02]'
                      : 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 hover:shadow-xl hover:scale-[1.01] text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-gray-700/50'
                  }`}
                >
                  <div className="flex items-center gap-3 p-4">
                    {/* Story Ring */}
                    <div className={`relative ${
                      selectedProfileId === profile.id
                        ? 'p-[3px] rounded-full bg-gradient-to-tr from-white/50 to-white/20'
                        : 'p-[3px] rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-blue-500'
                    }`}>
                      {profile.profileImageUrl ? (
                        <img
                          src={profile.profileImageUrl}
                          alt={profile.name}
                          className="w-14 h-14 rounded-full object-cover border-2 border-white dark:border-gray-900"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-white dark:border-gray-900">
                          <User className="w-7 h-7 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-semibold text-sm truncate">{profile.name}</div>
                      {profile.instagramUsername && (
                        <div className={`text-xs truncate ${
                          selectedProfileId === profile.id ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          @{profile.instagramUsername}
                        </div>
                      )}
                      <div className={`flex items-center gap-3 mt-1 text-xs ${
                        selectedProfileId === profile.id ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        <span className="font-medium">
                          {profile._count?.feedPosts || 0} posts
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Animated background on hover */}
                  {selectedProfileId !== profile.id && (
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-pink-500/0 to-blue-500/0 group-hover:from-purple-500/5 group-hover:via-pink-500/5 group-hover:to-blue-500/5 transition-all duration-300" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-3 sm:p-4 md:p-6">
            {loadingPosts ? (
              /* Skeleton Loading */
              <>
                {/* Cover Skeleton */}
                <div className="relative h-48 sm:h-64 md:h-80 rounded-2xl overflow-hidden shadow-xl mb-6 bg-gray-200 dark:bg-gray-800 animate-pulse" />

                {/* Profile Info Skeleton */}
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
            {/* Cover Photo - Animated Gradient */}
            <div className="relative h-32 sm:h-48 md:h-64 lg:h-80 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl mb-4 sm:mb-6 group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-gradient-x" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              {/* Floating shapes */}
              <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-10 right-10 w-40 h-40 bg-purple-400/10 rounded-full blur-3xl animate-pulse delay-700" />
              {/* Animated overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/0 to-pink-600/0 group-hover:from-purple-600/20 group-hover:to-pink-600/20 transition-all duration-700" />
            </div>

            {/* Profile Info */}
            <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 lg:p-8 -mt-16 sm:-mt-20 z-10 border border-gray-200/50 dark:border-gray-800/50">
              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-blue-500/5 rounded-3xl" />
              
              <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6">
                {/* Profile Picture with story ring */}
                <div className="relative -mt-16 sm:-mt-20 lg:-mt-24">
                  <div className="relative">
                    {/* Story ring */}
                    <div className="absolute inset-0 -m-1 rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-blue-500 p-1 animate-pulse">
                      <div className="w-full h-full rounded-full bg-white dark:bg-gray-900" />
                    </div>
                    {selectedProfile.profileImageUrl ? (
                      <img
                        src={selectedProfile.profileImageUrl}
                        alt={displayName}
                        className="relative w-24 h-24 sm:w-32 sm:h-32 lg:w-44 lg:h-44 rounded-full object-cover border-4 border-white dark:border-gray-900 shadow-2xl shadow-purple-500/20 hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="relative w-24 h-24 sm:w-32 sm:h-32 lg:w-44 lg:h-44 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 flex items-center justify-center border-4 border-white dark:border-gray-900 shadow-2xl shadow-purple-500/20 hover:scale-105 transition-transform duration-300">
                        <User className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 text-white" />
                      </div>
                    )}
                    <label className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 p-2 sm:p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-lg cursor-pointer hover:scale-110 hover:rotate-12 transition-all duration-300 group">
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

                {/* Profile Details */}
                <div className="flex-1 text-center sm:text-left space-y-3 sm:space-y-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2 animate-gradient-x">
                      {displayName}
                    </h1>
                    {selectedProfile.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg">{selectedProfile.description}</p>
                    )}
                  </div>

                  {/* Enhanced Stats Cards */}
                  <div className="flex gap-3 sm:gap-4 justify-center sm:justify-start flex-wrap">
                    <div className="group relative overflow-hidden px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 rounded-2xl border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-pink-500/0 group-hover:from-purple-500/10 group-hover:to-pink-500/10 transition-all duration-300" />
                      <div className="relative">
                        <div className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                          {posts.length}
                        </div>
                        <div className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">Posts</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Posts Grid */}
            <div className="mt-6 sm:mt-8">
              <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-4 sm:mb-6">Posts</h2>
              
              {posts.length === 0 ? (
                <div className="relative overflow-hidden bg-gradient-to-br from-white/90 to-purple-50/50 dark:from-gray-900/90 dark:to-purple-950/30 backdrop-blur-xl rounded-3xl shadow-2xl p-16 text-center border border-gray-200/50 dark:border-gray-800/50">
                  <div className="absolute top-0 left-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
                  <div className="absolute bottom-0 right-0 w-40 h-40 bg-pink-500/10 rounded-full blur-3xl" />
                  <div className="relative">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full mb-4">
                      <Camera className="w-10 h-10 text-purple-600 dark:text-purple-400" />
                    </div>
                    <p className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No posts yet</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">Start sharing your moments</p>
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
      </div>

      {/* Post Detail Modal */}
      {mounted && selectedPost && createPortal(
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row border border-gray-200/50 dark:border-gray-800/50 animate-in slide-in-from-bottom-4 duration-500">
            {/* Image Section */}
            <div className="md:w-1/2 bg-black flex items-center justify-center">
              <ImageCarousel images={selectedPost.imageUrls} postId={selectedPost.id} />
            </div>

            {/* Details Section */}
            <div className="md:w-1/2 flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-5 border-b border-gray-200/50 dark:border-gray-800/50 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-[2px] rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-blue-500">
                    <img
                      src={selectedPost.user.imageUrl || '/default-avatar.png'}
                      alt={displayName || ''}
                      className="w-11 h-11 rounded-full object-cover border-2 border-white dark:border-gray-900"
                    />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{displayName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      {new Date(selectedPost.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="p-2.5 hover:bg-white/80 dark:hover:bg-gray-800/80 rounded-full transition-all hover:scale-110 hover:rotate-90 duration-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Caption */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                  {selectedPost.caption}
                </p>
              </div>

              {/* Comments */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingComments.has(selectedPost.id) ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
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
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">
                            {comment.profile?.instagramUsername || comment.profile?.name || comment.user.username || `${comment.user.firstName || ''} ${comment.user.lastName || ''}`.trim()}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{comment.content}</p>
                        </div>
                        <div className="flex items-center gap-4 mt-1 px-4">
                          <button
                            onClick={() => {/* Handle like comment */}}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
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

              {/* Actions */}
              <div className="p-5 border-t border-gray-200/50 dark:border-gray-800/50 bg-gradient-to-r from-purple-50/30 to-pink-50/30 dark:from-purple-950/10 dark:to-pink-950/10">
                <div className="flex items-center gap-3 mb-4">
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
                        selectedPost.liked ? 'fill-red-500 text-red-500 scale-110' : ''
                      }`}
                    />
                  </button>
                  <button className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all hover:scale-110">
                    <MessageCircle className="w-6 h-6" />
                  </button>
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
                        selectedPost.bookmarked ? 'fill-yellow-500 text-yellow-500 scale-110' : ''
                      }`}
                    />
                  </button>
                </div>

                <div className="text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
                  {selectedPost.likesCount} {selectedPost.likesCount === 1 ? 'like' : 'likes'}
                </div>

                {/* Add Comment */}
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
                    className="flex-1 px-5 py-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full border border-gray-200/50 dark:border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                  <button
                    onClick={() => handleAddComment(selectedPost.id)}
                    disabled={!commentTexts[selectedPost.id]?.trim()}
                    className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-300 disabled:to-gray-400 dark:disabled:from-gray-700 dark:disabled:to-gray-700 text-white rounded-full transition-all hover:scale-110 disabled:scale-100 shadow-lg shadow-purple-500/30"
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

      {/* Crop Modal */}
      {showCropModal && imageToCrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-2xl w-full mx-4 border border-gray-200/50 dark:border-gray-800/50 animate-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 border-b border-gray-200/50 dark:border-gray-800/50 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 flex items-center justify-between rounded-t-3xl">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                Crop Profile Picture
              </h3>
              <button
                onClick={() => {
                  setShowCropModal(false);
                  setImageToCrop(null);
                }}
                className="p-2.5 hover:bg-white/80 dark:hover:bg-gray-800/80 rounded-full transition-all hover:scale-110 hover:rotate-90 duration-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

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
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
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
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setImageToCrop(null);
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 hover:scale-[1.02] transition-all font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCropSave}
                  disabled={uploadingProfile}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 font-semibold shadow-lg shadow-purple-500/30"
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
