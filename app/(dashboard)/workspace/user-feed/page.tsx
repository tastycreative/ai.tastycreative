// app\(dashboard)\workspace\user-feed\page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import {
  Users,
  Image as ImageIcon,
  Video,
  Heart,
  MessageCircle,
  Share2,
  Clock,
  Loader2,
  Sparkles,
  MoreVertical,
  Bookmark,
  Send,
  Plus,
  X,
  Upload,
  UserPlus,
  Mail,
  TrendingUp,
  Compass,
  RefreshCw,
  Edit3,
  Trash2,
  Link2,
  Flag,
  Copy,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

// Types
interface Post {
  id: string;
  userId: string;
  user: {
    id: string;
    clerkId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    email: string | null;
    imageUrl: string | null;
  };
  imageUrls: string[]; // Changed from imageUrl to imageUrls array
  mediaType?: 'image' | 'video'; // Type of media
  caption: string;
  likes: number;
  comments: number;
  createdAt: string;
  liked: boolean;
  bookmarked: boolean;
  isFriend: boolean;
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

// ImageCarousel component moved outside to prevent recreation on parent re-renders
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
  const [isMuted, setIsMuted] = React.useState(true);
  const [currentTime, setCurrentTime] = React.useState(0);
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
        threshold: 0.5, // Video must be at least 50% visible
        rootMargin: '0px'
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [mediaType]);

  // Handle video pause/play based on visibility and modal state
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

  // Preserve video playback position and mute state
  React.useEffect(() => {
    if (videoRef.current && mediaType === 'video' && !isPaused && isVisible) {
      const video = videoRef.current;
      
      // Restore playback position if it changed
      if (currentTime > 0 && Math.abs(video.currentTime - currentTime) > 0.5) {
        video.currentTime = currentTime;
      }
      
      // Only set muted state, don't interrupt playback
      if (video.muted !== isMuted) {
        video.muted = isMuted;
      }
      
      // Ensure video is playing
      if (video.paused) {
        video.play().catch(err => console.log('Play prevented:', err));
      }
    }
  }, [isMuted, mediaType, currentTime, isPaused, isVisible]);

  // Prevent video reload on component updates
  const videoSrc = React.useMemo(() => images[0], [images[0]]);

  const goToNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentImageIndexes(prev => ({
        ...prev,
        [postId]: currentIndex + 1
      }));
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentImageIndexes(prev => ({
        ...prev,
        [postId]: currentIndex - 1
      }));
    }
  };

  const goToIndex = (index: number) => {
    setCurrentImageIndexes(prev => ({ ...prev, [postId]: index }));
  };

  if (images.length === 0) return null;

  return (
    <div ref={containerRef} className="relative w-full h-[300px] sm:h-[400px] md:h-[500px] bg-gradient-to-br from-gray-900 via-black to-gray-900 group flex items-center justify-center overflow-hidden">
      {/* Main Media */}
      {mediaType === 'video' ? (
        <>
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            disableRemotePlayback
            muted={isMuted}
            onTimeUpdate={(e) => {
              // Track current playback position
              setCurrentTime(e.currentTarget.currentTime);
            }}
            onCanPlay={(e) => {
              // Auto-play when ready, only if not already playing
              const video = e.currentTarget;
              if (video.paused && video.readyState >= 3) {
                video.play().catch(err => console.log('Autoplay prevented:', err));
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
            className="absolute max-w-full max-h-full object-contain z-10 cursor-pointer"
          />
          {/* Mute indicator with modern design */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
            className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 p-2 sm:p-3 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full transition-all z-20 group/mute border border-white/10"
          >
            {isMuted ? (
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
        </>
      ) : (
        images.map((mediaUrl, index) => (
          <img
            key={index}
            src={mediaUrl}
            alt={`Post image ${index + 1}`}
            loading="eager"
            className={`absolute max-w-full max-h-full object-contain transition-opacity duration-500 ease-in-out ${
              index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          />
        ))
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

      {/* Navigation Arrows - Only show if multiple images (not for video) */}
      {mediaType !== 'video' && images.length > 1 && (
        <>
          {/* Previous Button - Only show if not first image */}
          {currentIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrev();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200 z-10"
            >
              <ChevronLeft className="w-6 h-6 text-gray-800 dark:text-white" />
            </button>
          )}
          {/* Next Button - Only show if not last image */}
          {currentIndex < images.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200 z-10"
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

export default function UserFeedPage() {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [showPostModal, setShowPostModal] = useState(false);
  const [postCaption, setPostCaption] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<File[]>([]);
  const [videoPreviews, setVideoPreviews] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [currentImageIndexes, setCurrentImageIndexes] = useState<Record<string, number>>({});
  const [mounted, setMounted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
  const [postComments, setPostComments] = useState<Record<string, Comment[]>>({});
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const [processingLikes, setProcessingLikes] = useState<Set<string>>(new Set());
  const [processingBookmarks, setProcessingBookmarks] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<{ id: string; caption: string } | null>(null);
  const [friendsCount, setFriendsCount] = useState<number>(0);
  const [friendRequestsCount, setFriendRequestsCount] = useState<number>(0);
  const [userStats, setUserStats] = useState({
    posts: 0,
    likes: 0,
    comments: 0,
    bookmarks: 0,
  });
  const [trendingHashtags, setTrendingHashtags] = useState<Array<{ tag: string; count: number }>>([]);
  const [friendSuggestions, setFriendSuggestions] = useState<Array<any>>([]);
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { userId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (userId) {
      loadFeedPosts();
      loadFriendsCounts();
      loadUserStats();
      loadTrendingHashtags();
      loadFriendSuggestions();
      loadCurrentUser();
    }
  }, [userId]);

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

  // Real-time polling effect - DISABLED
  // useEffect(() => {
  //   if (!userId) return;

  //   // Poll every 10 seconds for new posts and updates
  //   // Pause polling when viewing a modal to prevent video restart
  //   const pollInterval = setInterval(() => {
  //     if (!selectedPostForComments && !showPostModal && !editingPost) {
  //       loadFeedPosts(true); // Silent refresh without loading state
  //       loadUserStats(); // Refresh activity stats
  //       loadTrendingHashtags(); // Refresh trending hashtags
  //     }
  //   }, 10000);

  //   return () => clearInterval(pollInterval);
  // }, [userId, selectedPostForComments, showPostModal, editingPost]);

  const loadFriendsCounts = async () => {
    try {
      // Fetch accepted friends count
      const friendsResponse = await fetch('/api/friends');
      if (friendsResponse.ok) {
        const friendsData = await friendsResponse.json();
        setFriendsCount(friendsData.length);
      }
      
      // Fetch pending friend requests count
      const requestsResponse = await fetch('/api/friends/requests?type=received');
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        setFriendRequestsCount(requestsData.length);
      }
    } catch (error) {
      console.error('Error loading friends counts:', error);
    }
  };

  const loadUserStats = async () => {
    try {
      const response = await fetch('/api/feed/stats');
      if (response.ok) {
        const data = await response.json();
        setUserStats(data);
      }
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const loadTrendingHashtags = async () => {
    try {
      const response = await fetch('/api/feed/trending');
      if (response.ok) {
        const data = await response.json();
        setTrendingHashtags(data);
      }
    } catch (error) {
      console.error('Error loading trending hashtags:', error);
    }
  };

  const loadFriendSuggestions = async () => {
    try {
      const response = await fetch('/api/friends/suggestions');
      if (response.ok) {
        const data = await response.json();
        setFriendSuggestions(data);
      }
    } catch (error) {
      console.error('Error loading friend suggestions:', error);
    }
  };

  const handleSendFriendRequest = async (recipientClerkId: string) => {
    if (sendingRequests.has(recipientClerkId)) return;

    setSendingRequests(prev => new Set(prev).add(recipientClerkId));

    try {
      const response = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkId: recipientClerkId }),
      });

      if (response.ok) {
        toast.success('Friend request sent!');
        // Remove from suggestions
        setFriendSuggestions(prev => prev.filter(s => s.clerkId !== recipientClerkId));
        // Reload suggestions to get new ones
        loadFriendSuggestions();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to send friend request');
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast.error('Failed to send friend request');
    } finally {
      setSendingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(recipientClerkId);
        return newSet;
      });
    }
  };

  const loadFeedPosts = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const response = await fetch('/api/feed/posts');
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
        
        // Extract current user's ID from the first post where user.clerkId matches
        if (data.length > 0 && !currentUserId) {
          const currentUserPost = data.find((p: Post) => p.user.clerkId === userId);
          if (currentUserPost) {
            setCurrentUserId(currentUserPost.user.id);
          }
        }
      } else {
        if (!silent) {
          toast.error('Failed to load feed posts');
        }
      }
    } catch (error) {
      console.error('Error loading feed posts:', error);
      if (!silent) {
        toast.error('Failed to load feed posts');
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
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const handleManualRefresh = async () => {
    await loadFeedPosts(true);
    toast.success('Feed refreshed!');
  };

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [userId]);

  const handleLike = async (postId: string) => {
    // Prevent multiple simultaneous requests
    if (processingLikes.has(postId)) return;

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const wasLiked = post.liked;

    // Mark as processing
    setProcessingLikes(prev => new Set(prev).add(postId));

    // Optimistic update
    setPosts(prevPosts => prevPosts.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          liked: !p.liked,
          likes: p.liked ? p.likes - 1 : p.likes + 1,
        };
      }
      return p;
    }));

    try {
      const response = await fetch(`/api/feed/posts/${postId}/like`, {
        method: wasLiked ? 'DELETE' : 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to update like');
      }

      const { likeCount, liked } = await response.json();

      // Update with server response
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === postId) {
          return { ...p, likes: likeCount, liked };
        }
        return p;
      }));
    } catch (error) {
      console.error('Error updating like:', error);
      // Revert on error
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
      // Remove from processing
      setProcessingLikes(prev => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  const handleBookmark = async (postId: string) => {
    // Prevent multiple simultaneous requests
    if (processingBookmarks.has(postId)) return;

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const wasBookmarked = post.bookmarked;

    // Mark as processing
    setProcessingBookmarks(prev => new Set(prev).add(postId));

    // Optimistic update
    setPosts(prevPosts => prevPosts.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          bookmarked: !p.bookmarked,
        };
      }
      return p;
    }));

    toast.success(wasBookmarked ? 'Removed from bookmarks' : 'Added to bookmarks');

    try {
      const response = await fetch(`/api/feed/posts/${postId}/bookmark`, {
        method: wasBookmarked ? 'DELETE' : 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to update bookmark');
      }
    } catch (error) {
      console.error('Error updating bookmark:', error);
      // Revert on error
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
      // Remove from processing
      setProcessingBookmarks(prev => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
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

  const openCommentsModal = async (post: Post) => {
    setSelectedPostForComments(post);
    if (!postComments[post.id]) {
      await loadComments(post.id);
    }
  };

  const closeCommentsModal = () => {
    setSelectedPostForComments(null);
  };

  const loadComments = async (postId: string) => {
    setLoadingComments(prev => new Set(prev).add(postId));

    try {
      const response = await fetch(`/api/feed/posts/${postId}/comments`);
      if (response.ok) {
        const comments = await response.json();
        setPostComments(prev => ({ ...prev, [postId]: comments }));
      } else {
        toast.error('Failed to load comments');
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setLoadingComments(prev => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  const handleAddComment = async (postId: string) => {
    const content = commentTexts[postId]?.trim();
    if (!content) return;

    try {
      const response = await fetch(`/api/feed/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content,
          parentCommentId: replyingTo,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      const { comment, commentCount } = await response.json();

      // If it's a reply, add it to the parent comment's replies
      if (replyingTo) {
        setPostComments(prev => ({
          ...prev,
          [postId]: prev[postId]?.map(c => 
            c.id === replyingTo 
              ? { ...c, replies: [...(c.replies || []), comment], replyCount: c.replyCount + 1 }
              : c
          ) || [],
        }));
      } else {
        // If it's a top-level comment, add it to the list
        setPostComments(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), comment],
        }));
      }

      // Update comment count
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === postId) {
          return { ...p, comments: commentCount };
        }
        return p;
      }));

      // Clear input and reset reply state
      setCommentTexts(prev => ({ ...prev, [postId]: '' }));
      setReplyingTo(null);
      toast.success(replyingTo ? 'Reply added!' : 'Comment added!');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const handleLikeComment = async (postId: string, commentId: string, isReply: boolean = false, parentCommentId?: string) => {
    const comment = isReply 
      ? postComments[postId]?.find(c => c.id === parentCommentId)?.replies?.find(r => r.id === commentId)
      : postComments[postId]?.find(c => c.id === commentId);
    
    if (!comment) return;

    const wasLiked = comment.liked;

    // Optimistic update
    setPostComments(prev => ({
      ...prev,
      [postId]: prev[postId]?.map(c => {
        if (isReply && c.id === parentCommentId) {
          return {
            ...c,
            replies: c.replies?.map(r => 
              r.id === commentId 
                ? { ...r, liked: !r.liked, likeCount: r.liked ? r.likeCount - 1 : r.likeCount + 1 }
                : r
            ),
          };
        } else if (!isReply && c.id === commentId) {
          return {
            ...c,
            liked: !c.liked,
            likeCount: c.liked ? c.likeCount - 1 : c.likeCount + 1,
          };
        }
        return c;
      }) || [],
    }));

    try {
      const response = await fetch(`/api/feed/comments/${commentId}/like`, {
        method: wasLiked ? 'DELETE' : 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to update like');
      }

      const { likeCount, liked } = await response.json();

      // Update with server response
      setPostComments(prev => ({
        ...prev,
        [postId]: prev[postId]?.map(c => {
          if (isReply && c.id === parentCommentId) {
            return {
              ...c,
              replies: c.replies?.map(r => 
                r.id === commentId ? { ...r, liked, likeCount } : r
              ),
            };
          } else if (!isReply && c.id === commentId) {
            return { ...c, liked, likeCount };
          }
          return c;
        }) || [],
      }));
    } catch (error) {
      console.error('Error updating comment like:', error);
      // Revert on error
      setPostComments(prev => ({
        ...prev,
        [postId]: prev[postId]?.map(c => {
          if (isReply && c.id === parentCommentId) {
            return {
              ...c,
              replies: c.replies?.map(r => 
                r.id === commentId 
                  ? { ...r, liked: wasLiked, likeCount: wasLiked ? r.likeCount + 1 : r.likeCount - 1 }
                  : r
              ),
            };
          } else if (!isReply && c.id === commentId) {
            return {
              ...c,
              liked: wasLiked,
              likeCount: wasLiked ? c.likeCount + 1 : c.likeCount - 1,
            };
          }
          return c;
        }) || [],
      }));
      toast.error('Failed to update like');
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    try {
      const response = await fetch(
        `/api/feed/posts/${postId}/comments/${commentId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      const { commentCount } = await response.json();

      // Update comments list
      setPostComments(prev => ({
        ...prev,
        [postId]: prev[postId]?.filter(c => c.id !== commentId) || [],
      }));

      // Update comment count
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === postId) {
          return { ...p, comments: commentCount };
        }
        return p;
      }));

      toast.success('Comment deleted');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
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

      // Update local state
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

      // Remove from local state
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
    // For now, just show a toast. You can implement actual reporting later
    toast.success('Post reported. Thank you for helping keep our community safe.');
    setOpenMenuPostId(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file count (max 10 images)
    if (files.length + selectedImages.length > 10) {
      toast.error('You can upload a maximum of 10 images');
      return;
    }

    // Validate file sizes
    const oversizedFiles = files.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error('Each image must be less than 10MB');
      return;
    }

    // Add new files to existing selection
    setSelectedImages(prev => [...prev, ...files]);

    // Generate previews for new files
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file count (max 1 video for now)
    if (files.length + selectedVideos.length > 1) {
      toast.error('You can upload a maximum of 1 video');
      return;
    }

    // Validate file sizes (max 100MB for videos)
    const oversizedFiles = files.filter(file => file.size > 100 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error('Video must be less than 100MB');
      return;
    }

    // Add new files to existing selection
    setSelectedVideos(prev => [...prev, ...files]);

    // Generate previews for new files
    files.forEach(file => {
      const url = URL.createObjectURL(file);
      setVideoPreviews(prev => [...prev, url]);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeVideo = (index: number) => {
    // Revoke the object URL to free memory
    URL.revokeObjectURL(videoPreviews[index]);
    setSelectedVideos(prev => prev.filter((_, i) => i !== index));
    setVideoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreatePost = async () => {
    if (selectedImages.length === 0 && selectedVideos.length === 0) {
      toast.error('Please select at least one image or video');
      return;
    }
    if (!postCaption.trim()) {
      toast.error('Please add a caption');
      return;
    }

    try {
      setUploading(true);

      const mediaUrls: string[] = [];
      const currentMediaType = selectedVideos.length > 0 ? 'video' : 'image';
      
      // Upload videos if selected
      if (selectedVideos.length > 0) {
        for (const video of selectedVideos) {
          const formData = new FormData();
          formData.append('video', video);

          const uploadResponse = await fetch('/api/feed/upload-video', {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            const error = await uploadResponse.json();
            throw new Error(error.error || 'Failed to upload video');
          }

          const { videoUrl } = await uploadResponse.json();
          mediaUrls.push(videoUrl);
        }
      } else {
        // Upload images
        for (const image of selectedImages) {
          const formData = new FormData();
          formData.append('image', image);

          const uploadResponse = await fetch('/api/feed/upload-image', {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            const error = await uploadResponse.json();
            throw new Error(error.error || 'Failed to upload image');
          }

          const { imageUrl } = await uploadResponse.json();
          mediaUrls.push(imageUrl);
        }
      }

      // Create the post
      const postResponse = await fetch('/api/feed/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrls: mediaUrls,
          mediaType: currentMediaType,
          caption: postCaption,
        }),
      });

      console.log('Post response status:', postResponse.status);
      console.log('Post response headers:', Object.fromEntries(postResponse.headers.entries()));

      // Try to get the response text first
      const responseText = await postResponse.text();
      console.log('Post response text:', responseText);

      if (!postResponse.ok) {
        let error;
        try {
          error = JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse error response:', responseText);
          throw new Error(`Server error (${postResponse.status}): ${responseText}`);
        }
        console.error('Post creation failed:', error);
        throw new Error(error.error || 'Failed to create post');
      }

      // Try to parse the response
      let newPost;
      try {
        newPost = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse success response:', responseText);
        throw new Error('Invalid response from server');
      }

      console.log('New post created:', newPost);

      // Validate response structure
      if (!newPost || !newPost.user) {
        console.error('Invalid post response structure:', newPost);
        throw new Error('Invalid response from server');
      }

      // Add new post to the beginning of the list
      setPosts([newPost, ...posts]);
      toast.success('Post created successfully!');
      
      // Reset form
      setShowPostModal(false);
      setPostCaption('');
      setSelectedImages([]);
      setImagePreviews([]);
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast.error(error.message || 'Failed to create post');
    } finally {
      setUploading(false);
    }
  };

  const closeModal = () => {
    setShowPostModal(false);
    setPostCaption('');
    setSelectedImages([]);
    setImagePreviews([]);
    // Clean up video URLs
    videoPreviews.forEach(url => URL.revokeObjectURL(url));
    setSelectedVideos([]);
    setVideoPreviews([]);
    setMediaType('image');
  };

  // Image/Video Carousel Component
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/30 dark:from-gray-950 dark:via-purple-950/20 dark:to-blue-950/20">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Sidebar Skeleton */}
            <div className="hidden lg:block lg:col-span-3">
              <div className="sticky top-24 space-y-6">
                {/* Quick Links Skeleton */}
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 dark:border-gray-800/50 shadow-lg animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-4"></div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl">
                        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Trending Skeleton */}
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 dark:border-gray-800/50 shadow-lg animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg">
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Feed Skeleton */}
            <div className="lg:col-span-6">
              <div className="max-w-2xl mx-auto space-y-6 pb-8">
                {/* Header Skeleton */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg border border-blue-200 dark:border-purple-800 p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 rounded-full animate-pulse"></div>
                      <div className="space-y-2">
                        <div className="h-6 bg-white/20 rounded w-32"></div>
                        <div className="h-4 bg-white/20 rounded w-48"></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-white/20 rounded-lg"></div>
                      <div className="w-20 h-10 bg-white/20 rounded-lg"></div>
                    </div>
                  </div>
                </div>

                {/* Post Skeletons */}
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-2xl shadow-lg overflow-hidden animate-in fade-in duration-700"
                    style={{ animationDelay: `${i * 150}ms` }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-r from-gray-50/50 to-transparent dark:from-gray-900/30 dark:to-transparent">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 animate-pulse"></div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
                        </div>
                      </div>
                      <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </div>

                    {/* Image Skeleton with Shimmer */}
                    <div className="relative w-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700 aspect-square overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent animate-shimmer"></div>
                    </div>

                    {/* Actions Skeleton */}
                    <div className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-5">
                          {[1, 2, 3].map((j) => (
                            <div key={j} className="w-7 h-7 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                          ))}
                        </div>
                        <div className="w-7 h-7 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                      </div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse"></div>
                      </div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Sidebar Skeleton */}
            <div className="hidden lg:block lg:col-span-3">
              <div className="space-y-6">
                {/* Suggestions Skeleton */}
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 dark:border-gray-800/50 shadow-lg animate-pulse">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                  </div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                          <div className="space-y-2 flex-1">
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                          </div>
                        </div>
                        <div className="w-12 h-7 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity Skeleton */}
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 dark:border-gray-800/50 shadow-lg animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-28 mb-4"></div>
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                        </div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add shimmer animation */}
        <style jsx>{`
          @keyframes shimmer {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }
          .animate-shimmer {
            animation: shimmer 2s infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/30 dark:from-gray-950 dark:via-purple-950/20 dark:to-blue-950/20">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          {/* Left Sidebar */}
          <div className="hidden lg:block lg:col-span-3">
            <div className="sticky top-24 space-y-6">
              {/* Quick Navigation */}
              <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 dark:border-gray-800/50 shadow-lg">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Compass className="w-4 h-4" />
                  Quick Links
                </h3>
                <div className="space-y-2">
                  {currentUserId && (
                    <button 
                      onClick={() => router.push(`/workspace/user-feed/profile/${currentUserId}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-indigo-500/10 hover:to-purple-500/10 text-gray-700 dark:text-gray-300 transition-all group"
                    >
                      <Users className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-medium">My Profile</span>
                    </button>
                  )}
                  <button 
                    onClick={() => router.push('/workspace/friends?tab=friends')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-pink-500/10 text-gray-700 dark:text-gray-300 transition-all group"
                  >
                    <Users className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium">My Friends</span>
                    {friendsCount > 0 && (
                      <span className="ml-auto px-2 py-0.5 bg-purple-500 text-white text-xs font-semibold rounded-full">
                        {friendsCount}
                      </span>
                    )}
                  </button>
                  <button 
                    onClick={() => router.push('/workspace/friends?tab=add')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-cyan-500/10 text-gray-700 dark:text-gray-300 transition-all group"
                  >
                    <UserPlus className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium">Add Friends</span>
                  </button>
                  <button 
                    onClick={() => router.push('/workspace/friends?tab=requests')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-pink-500/10 hover:to-rose-500/10 text-gray-700 dark:text-gray-300 transition-all group"
                  >
                    <Mail className="w-4 h-4 text-pink-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium">Friend Requests</span>
                    {friendRequestsCount > 0 && (
                      <span className="ml-auto px-2 py-0.5 bg-pink-500 text-white text-xs font-semibold rounded-full animate-pulse">
                        {friendRequestsCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Trending Topics */}
              <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 dark:border-gray-800/50 shadow-lg">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Trending Hashtags
                </h3>
                <div className="space-y-3">
                  {trendingHashtags.length > 0 ? (
                    trendingHashtags.map((hashtag, i) => (
                      <div key={i} className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded-lg transition-colors">
                        <span className="text-sm font-medium bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent group-hover:from-purple-500 group-hover:to-pink-500">
                          {hashtag.tag}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {hashtag.count}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                      No trending hashtags yet. Start using hashtags in your posts!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main Feed */}
          <div className="lg:col-span-6">
            <div className="max-w-xl mx-auto space-y-4 sm:space-y-6 pb-4 sm:pb-8">
      {/* Header - Glassmorphism Design */}
      <div className="relative bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/30 p-3 sm:p-4 md:p-6 overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 animate-gradient-x pointer-events-none"></div>
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl sm:rounded-2xl blur-lg opacity-60 animate-pulse"></div>
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                <Share2 className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-base sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-gray-900 via-purple-900 to-blue-900 dark:from-white dark:via-purple-200 dark:to-blue-200 bg-clip-text text-transparent">User Feed</h1>
              <p className="hidden sm:block text-gray-600 dark:text-gray-400 text-xs md:text-sm mt-1">
                ✨ Discover amazing creations
              </p>
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Mobile Menu Button - Only visible on mobile */}
            <button
              onClick={() => setShowMobileMenu(true)}
              className="lg:hidden group relative flex items-center gap-2 px-2 sm:px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg sm:rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 overflow-hidden"
              title="Menu"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Compass className="relative w-4 h-4 sm:w-5 sm:h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="group relative flex items-center gap-2 px-2 sm:px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg sm:rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
              title="Refresh feed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <RefreshCw className={`relative w-4 h-4 sm:w-5 sm:h-5 text-gray-700 dark:text-gray-300 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowPostModal(true)}
              className="group relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-medium rounded-lg sm:rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 opacity-0 group-hover:opacity-30 blur-xl transition-opacity"></div>
              <Plus className="relative w-4 h-4 sm:w-5 sm:h-5" />
              <span className="relative text-sm sm:text-base">Post</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feed Posts */}
      <div className="space-y-6">
        {posts.map((post, index) => {
          // Check if we need to show separator (transition from friends to non-friends)
          const showSeparator = index > 0 && posts[index - 1].isFriend && !post.isFriend;
          
          return (
            <React.Fragment key={post.id}>
              {/* Separator for non-friend posts */}
              {showSeparator && (
                <div className="relative flex items-center justify-center py-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                  </div>
                  <div className="relative flex items-center gap-2 px-4 bg-white dark:bg-gray-900">
                    <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Suggested Posts from the Community
                    </span>
                  </div>
                </div>
              )}
              
              <div
                className="group/card relative bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/30 rounded-2xl sm:rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden"
              >
                {/* Hover gradient effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                <div className="relative">
            {/* Post Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 md:p-5 bg-gradient-to-r from-gray-50/50 to-transparent dark:from-gray-900/30 dark:to-transparent">
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                {/* User Avatar with gradient ring */}
                <button
                  onClick={() => router.push(`/workspace/user-feed/profile/${post.user.id}`)}
                  className="relative cursor-pointer flex-shrink-0"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full blur-sm opacity-75"></div>
                  <div className="relative w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-0.5">
                    <div className="w-full h-full rounded-full bg-white dark:bg-gray-800 flex items-center justify-center">
                      {post.user.imageUrl ? (
                        <img src={post.user.imageUrl} alt={post.user.username || 'User'} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-sm sm:text-base font-bold bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                          {(post.user.firstName?.[0] || post.user.username?.[0] || 'U').toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                {/* User Info */}
                <button
                  onClick={() => router.push(`/workspace/user-feed/profile/${post.user.id}`)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate hover:underline">
                    {post.user.username || `${post.user.firstName || ''} ${post.user.lastName || ''}`.trim() || post.user.email}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                    {post.user.username ? `${post.user.firstName || ''} ${post.user.lastName || ''}`.trim() : post.user.email}
                  </p>
                </button>
              </div>
              {/* More Options */}
              <div className="relative dropdown-menu">
                <button 
                  onClick={() => setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-full transition-all duration-200 active:scale-95"
                >
                  <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>

                {/* Dropdown Menu */}
                {openMenuPostId === post.id && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {post.user.clerkId === userId ? (
                      <>
                        {/* Own post options */}
                        <button
                          onClick={() => handleEditPost(post)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Edit Post</span>
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete Post</span>
                        </button>
                        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                        <button
                          onClick={() => handleCopyLink(post.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Link2 className="w-4 h-4" />
                          <span>Copy Link</span>
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Other user's post options */}
                        <button
                          onClick={() => handleReportPost(post.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Flag className="w-4 h-4" />
                          <span>Report Post</span>
                        </button>
                        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                        <button
                          onClick={() => handleCopyLink(post.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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

            {/* Post Media - Images or Video */}
            <ImageCarousel 
              images={post.imageUrls} 
              postId={post.id} 
              mediaType={post.mediaType}
              currentImageIndexes={currentImageIndexes}
              setCurrentImageIndexes={setCurrentImageIndexes}
              isPaused={selectedPostForComments?.id === post.id}
            />

            {/* Post Actions */}
            <div className="p-3 sm:p-4 md:p-5 space-y-3 sm:space-y-4 bg-gradient-to-b from-transparent to-gray-50/50 dark:to-gray-900/30">
              {/* Action Buttons with micro-interactions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 sm:space-x-6">
                  <button
                    onClick={() => handleLike(post.id)}
                    className="group relative flex items-center gap-1.5 sm:gap-2 transition-all duration-300 active:scale-95"
                  >
                    <div className="relative">
                      <Heart
                        className={`w-6 h-6 sm:w-7 sm:h-7 transition-all duration-300 ${
                          post.liked
                            ? 'fill-red-500 text-red-500 scale-110'
                            : 'text-gray-600 dark:text-gray-400 group-hover:text-red-500 group-hover:scale-110'
                        }`}
                      />
                      {post.liked && (
                        <div className="absolute inset-0 bg-red-500 rounded-full blur-xl opacity-40 animate-pulse"></div>
                      )}
                    </div>
                    <span className={`text-xs sm:text-sm font-medium transition-colors ${
                      post.liked ? 'text-red-500' : 'text-gray-700 dark:text-gray-300 group-hover:text-red-500'
                    }`}>
                      {post.likes > 0 && post.likes.toLocaleString()}
                    </span>
                  </button>
                  <button 
                    onClick={() => openCommentsModal(post)}
                    className="group relative flex items-center gap-1.5 sm:gap-2 transition-all duration-300 active:scale-95"
                  >
                    <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 text-gray-600 dark:text-gray-400 group-hover:text-blue-500 group-hover:scale-110 transition-all duration-300" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-500 transition-colors">
                      {post.comments > 0 && post.comments.toLocaleString()}
                    </span>
                  </button>
                  <button 
                    onClick={() => handleShare(post.id)}
                    className="group relative p-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-full transition-all duration-300 active:scale-95"
                  >
                    <Send className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-400 group-hover:text-purple-500 group-hover:scale-110 transition-all duration-300" />
                  </button>
                </div>
                <button
                  onClick={() => handleBookmark(post.id)}
                  className="group relative p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-full transition-all duration-300 active:scale-95"
                >
                  <Bookmark
                    className={`w-5 h-5 sm:w-6 sm:h-6 transition-all duration-300 ${
                      post.bookmarked
                        ? 'fill-amber-500 text-amber-500 scale-110'
                        : 'text-gray-600 dark:text-gray-400 group-hover:text-amber-500 group-hover:scale-110'
                    }`}
                  />
                </button>
              </div>

              {/* Caption with better typography */}
              <div className="px-1">
                <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 leading-relaxed">
                  <button
                    onClick={() => router.push(`/workspace/user-feed/profile/${post.user.id}`)}
                    className="font-bold mr-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hover:from-blue-700 hover:to-purple-700 transition-all"
                  >
                    {post.user.username || post.user.firstName || 'User'}
                  </button>
                  <span className="text-gray-700 dark:text-gray-300">{post.caption}</span>
                </p>
              </div>

              {/* View Comments with hover effect */}
              {post.comments > 0 && (
                <button 
                  onClick={() => openCommentsModal(post)}
                  className="px-1 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex items-center gap-1 group"
                >
                  <span>View all {post.comments} {post.comments === 1 ? 'comment' : 'comments'}</span>
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              )}

              {/* Time with icon */}
              <div className="px-1 flex items-center gap-1.5">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 dark:text-gray-500" />
                <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 font-medium">
                  {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
                </div>
          </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Load More */}
      <div className="text-center py-6 sm:py-8">
        <button className="group relative px-6 py-2.5 sm:px-8 sm:py-3 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white text-sm sm:text-base font-semibold rounded-xl transition-all shadow-lg hover:shadow-2xl active:scale-95 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 opacity-0 group-hover:opacity-20 blur-xl transition-opacity"></div>
          <span className="relative flex items-center gap-2">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            Load More Posts
          </span>
        </button>
      </div>
            </div>
          </div>

      {/* Mobile Menu Drawer */}
      {mounted && showMobileMenu && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 animate-in fade-in duration-200 lg:hidden"
          onClick={() => setShowMobileMenu(false)}
        >
          <div
            className="fixed right-0 top-0 bottom-0 w-[85vw] max-w-sm bg-white dark:bg-gray-900 shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-900/50 dark:to-gray-800/50 backdrop-blur-xl">
              <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Menu
              </h2>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Quick Navigation */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Compass className="w-4 h-4" />
                  Quick Links
                </h3>
                <div className="space-y-2">
                  {currentUserId && (
                    <button 
                      onClick={() => {
                        router.push(`/workspace/user-feed/profile/${currentUserId}`);
                        setShowMobileMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-indigo-500/10 hover:to-purple-500/10 text-gray-700 dark:text-gray-300 transition-all group"
                    >
                      <Users className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-medium">My Profile</span>
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      router.push('/workspace/friends?tab=friends');
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-pink-500/10 text-gray-700 dark:text-gray-300 transition-all group"
                  >
                    <Users className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium">Friends</span>
                    {friendsCount > 0 && (
                      <span className="ml-auto bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {friendsCount}
                      </span>
                    )}
                  </button>
                  <button 
                    onClick={() => {
                      router.push('/workspace/friends?tab=add');
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-cyan-500/10 text-gray-700 dark:text-gray-300 transition-all group"
                  >
                    <UserPlus className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium">Add Friends</span>
                  </button>
                  <button 
                    onClick={() => {
                      router.push('/workspace/friends?tab=requests');
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-pink-500/10 hover:to-rose-500/10 text-gray-700 dark:text-gray-300 transition-all group"
                  >
                    <Mail className="w-4 h-4 text-pink-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium">Friend Requests</span>
                    {friendRequestsCount > 0 && (
                      <span className="ml-auto bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                        {friendRequestsCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Trending Hashtags */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Trending
                </h3>
                <div className="space-y-2">
                  {trendingHashtags.length > 0 ? (
                    trendingHashtags.slice(0, 5).map((hashtag, index) => (
                      <button
                        key={index}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-700/50 dark:hover:to-gray-600/50 transition-all group"
                      >
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                          #{hashtag.tag}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                          {hashtag.count} posts
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-3">
                      No trending hashtags yet
                    </p>
                  )}
                </div>
              </div>

              {/* Friend Suggestions */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Suggested Friends
                  </h3>
                </div>
                <div className="space-y-3">
                  {friendSuggestions.length > 0 ? (
                    friendSuggestions.slice(0, 3).map((suggestion) => (
                      <div key={suggestion.id} className="flex items-center justify-between group">
                        <button
                          onClick={() => {
                            router.push(`/workspace/user-feed/profile/${suggestion.id}`);
                            setShowMobileMenu(false);
                          }}
                          className="flex items-center gap-2 flex-1 min-w-0"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                            {suggestion.imageUrl ? (
                              <img src={suggestion.imageUrl} alt={suggestion.username || 'User'} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <span className="text-white font-bold text-sm">
                                {(suggestion.username?.[0] || suggestion.firstName?.[0] || 'U').toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {suggestion.username || `${suggestion.firstName || ''} ${suggestion.lastName || ''}`.trim()}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {suggestion.mutualFriendsCount > 0 && `${suggestion.mutualFriendsCount} mutual`}
                            </p>
                          </div>
                        </button>
                        <button
                          onClick={() => handleSendFriendRequest(suggestion.id)}
                          disabled={sendingRequests.has(suggestion.id)}
                          className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white text-xs font-medium rounded-lg transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          {sendingRequests.has(suggestion.id) ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Add'
                          )}
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-3">
                      No suggestions available
                    </p>
                  )}
                </div>
              </div>

              {/* Your Activity */}
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Your Activity
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                        <ImageIcon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Posts</span>
                    </div>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{userStats.posts}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-red-50 to-pink-100 dark:from-red-900/20 dark:to-pink-800/20">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-md">
                        <Heart className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Likes</span>
                    </div>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">{userStats.likes}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-800/20">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md">
                        <MessageCircle className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Comments</span>
                    </div>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">{userStats.comments}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-100 dark:from-amber-900/20 dark:to-yellow-800/20">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-md">
                        <Bookmark className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Saved</span>
                    </div>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{userStats.bookmarks}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create Post Modal */}
      {mounted && showPostModal && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={closeModal}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-gray-200/50 dark:border-gray-700/50 animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative flex items-center justify-between p-5 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-900/50 dark:to-gray-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Create New Post
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-all duration-200 active:scale-95"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 sm:p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)] custom-scrollbar">
              {/* Media Type Selector */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-xl">
                <button
                  onClick={() => {
                    setMediaType('image');
                    // Clear videos when switching to images
                    videoPreviews.forEach(url => URL.revokeObjectURL(url));
                    setSelectedVideos([]);
                    setVideoPreviews([]);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all ${
                    mediaType === 'image'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                      : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <ImageIcon className="w-5 h-5" />
                  Images
                </button>
                <button
                  onClick={() => {
                    setMediaType('video');
                    // Clear images when switching to videos
                    setSelectedImages([]);
                    setImagePreviews([]);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all ${
                    mediaType === 'video'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                      : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Video className="w-5 h-5" />
                  Video
                </button>
              </div>

              {/* Image Upload Area */}
              {mediaType === 'image' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Select Images (Up to 10)
                  </label>
                
                {/* Preview Grid */}
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative group aspect-square">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-md"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all shadow-lg hover:shadow-xl active:scale-95 opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-full text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                          {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button */}
                {imagePreviews.length < 10 && (
                  <label className="relative flex flex-col items-center justify-center w-full h-48 border-3 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-300 bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-900/50 dark:to-blue-900/20 hover:shadow-lg group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 space-y-3">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                        <div className="relative w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Upload className="w-7 h-7 text-white" />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            {imagePreviews.length > 0 ? 'Add more images' : 'Click to upload'}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          PNG, JPG, WebP up to 10MB ({imagePreviews.length}/10)
                        </p>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              )}

              {/* Video Upload Area */}
              {mediaType === 'video' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Select Video (Max 100MB)
                  </label>
                  
                  {/* Video Preview */}
                  {videoPreviews.length > 0 && (
                    <div className="mb-4">
                      {videoPreviews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <video
                            src={preview}
                            controls
                            className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-md"
                          />
                          <button
                            onClick={() => removeVideo(index)}
                            className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all shadow-lg hover:shadow-xl active:scale-95"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Button */}
                  {videoPreviews.length === 0 && (
                    <label className="relative flex flex-col items-center justify-center w-full h-48 border-3 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl cursor-pointer hover:border-purple-500 dark:hover:border-purple-400 transition-all duration-300 bg-gradient-to-br from-gray-50 to-purple-50/30 dark:from-gray-900/50 dark:to-purple-900/20 hover:shadow-lg group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 space-y-3">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                          <div className="relative w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Video className="w-7 h-7 text-white" />
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
                            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                              Click to upload video
                            </span>
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            MP4, WebM, MOV up to 100MB
                          </p>
                        </div>
                      </div>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}

              {/* Caption */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Caption
                </label>
                <textarea
                  value={postCaption}
                  onChange={(e) => setPostCaption(e.target.value)}
                  placeholder="Write a caption for your post... ✨"
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none transition-all"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
              <button
                onClick={closeModal}
                disabled={uploading}
                className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-semibold rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePost}
                disabled={uploading}
                className="relative px-8 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95 overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 opacity-0 group-hover:opacity-20 blur-xl transition-opacity"></div>
                <span className="relative flex items-center gap-2">
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Share Post
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Post Modal */}
      {mounted && editingPost && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full border border-gray-200 dark:border-gray-800">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Edit Post
              </h2>
              <button
                onClick={() => setEditingPost(null)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-all duration-200 active:scale-95"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Caption
              </label>
              <textarea
                value={editingPost.caption}
                onChange={(e) => setEditingPost({ ...editingPost, caption: e.target.value })}
                placeholder="Write a caption..."
                rows={5}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 resize-none"
              />
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setEditingPost(null)}
                className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-semibold rounded-xl transition-all duration-200 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePost}
                disabled={!editingPost.caption.trim()}
                className="relative px-8 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4" />
                  Update Post
                </span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Comments Modal */}
      {mounted && selectedPostForComments && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
          onClick={closeCommentsModal}
        >
          <div 
            className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col md:flex-row border border-gray-200/20 dark:border-gray-700/30 animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Side - Image Carousel */}
            <div className="md:w-[55%] bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center relative">
              <div className="w-full h-full flex items-center justify-center">
                <ImageCarousel 
                  images={selectedPostForComments.imageUrls} 
                  postId={`modal-${selectedPostForComments.id}`} 
                  mediaType={selectedPostForComments.mediaType}
                  currentImageIndexes={currentImageIndexes}
                  setCurrentImageIndexes={setCurrentImageIndexes}
                  isPaused={false}
                />
              </div>
              {/* Decorative blur circles */}
              <div className="absolute top-10 left-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute bottom-10 right-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>
            </div>

            {/* Right Side - Comments */}
            <div className="md:w-[45%] flex flex-col max-h-[95vh] bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur opacity-60"></div>
                    {selectedPostForComments.user.imageUrl ? (
                      <img
                        src={selectedPostForComments.user.imageUrl}
                        alt={selectedPostForComments.user.username || 'User'}
                        className="relative w-11 h-11 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
                      />
                    ) : (
                      <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                        <span className="text-white font-bold text-sm">
                          {(selectedPostForComments.user.username || selectedPostForComments.user.firstName || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">
                      {selectedPostForComments.user.username || selectedPostForComments.user.firstName || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(selectedPostForComments.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeCommentsModal}
                  className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 group"
                >
                  <X className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 transition-colors" />
                </button>
              </div>

              {/* Stats Bar */}
              <div className="flex items-center justify-around py-3 px-5 border-b border-gray-200 dark:border-gray-700/50 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/10 dark:to-purple-900/10">
                <div className="flex items-center gap-2">
                  <Heart className={`w-4 h-4 ${selectedPostForComments.liked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {selectedPostForComments.likes.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {selectedPostForComments.comments.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Bookmark className={`w-4 h-4 ${selectedPostForComments.bookmarked ? 'fill-amber-500 text-amber-500' : 'text-gray-400'}`} />
                </div>
              </div>

              {/* Caption */}
              <div className="p-5 border-b border-gray-200 dark:border-gray-700/50">
                <div className="flex items-start space-x-3">
                  {selectedPostForComments.user.imageUrl ? (
                    <img
                      src={selectedPostForComments.user.imageUrl}
                      alt={selectedPostForComments.user.username || 'User'}
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-800"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-gray-100 dark:ring-gray-800">
                      <span className="text-white text-sm font-bold">
                        {(selectedPostForComments.user.username || selectedPostForComments.user.firstName || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                      <span className="font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mr-2">
                        {selectedPostForComments.user.username || selectedPostForComments.user.firstName || 'User'}
                      </span>
                      {selectedPostForComments.caption}
                    </p>
                  </div>
                </div>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-gray-600">
                {loadingComments.has(selectedPostForComments.id) ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="relative">
                      <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
                      <Loader2 className="relative w-8 h-8 animate-spin text-blue-500" />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">Loading comments...</p>
                  </div>
                ) : postComments[selectedPostForComments.id]?.length > 0 ? (
                  postComments[selectedPostForComments.id].map((comment, index) => (
                    <div key={comment.id} className="space-y-2">
                      {/* Main Comment */}
                      <div 
                        className="flex items-start space-x-3 group hover:bg-gray-50/50 dark:hover:bg-gray-800/30 p-2 rounded-xl transition-all duration-200 animate-in slide-in-from-bottom"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
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
                              {comment.user.username || comment.user.firstName || 'User'}
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
                              onClick={() => handleLikeComment(selectedPostForComments.id, comment.id)}
                              className={`text-xs font-medium transition-colors flex items-center gap-1 ${
                                comment.liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                              }`}
                            >
                              <Heart className={`w-3.5 h-3.5 ${comment.liked ? 'fill-red-500' : ''}`} />
                              {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
                            </button>
                            <button
                              onClick={() => {
                                setReplyingTo(comment.id);
                                setCommentTexts(prev => ({ ...prev, [selectedPostForComments.id]: `@${comment.user.username || comment.user.firstName || 'User'} ` }));
                              }}
                              className="text-xs text-gray-500 hover:text-blue-500 font-medium transition-colors"
                            >
                              Reply
                            </button>
                            {comment.userId === userId && (
                              <button
                                onClick={() => handleDeleteComment(selectedPostForComments.id, comment.id)}
                                className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors hover:underline"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="ml-12 space-y-2 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                          {comment.replies.map((reply, replyIndex) => (
                            <div 
                              key={reply.id} 
                              className="flex items-start space-x-3 group hover:bg-gray-50/50 dark:hover:bg-gray-800/30 p-2 rounded-xl transition-all duration-200"
                            >
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
                                <div className="bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl px-3 py-2 shadow-sm border border-gray-200/50 dark:border-gray-700/30">
                                  <p className="text-xs font-bold text-gray-900 dark:text-white mb-1">
                                    {reply.user.username || reply.user.firstName || 'User'}
                                  </p>
                                  <p className="text-xs text-gray-700 dark:text-gray-300 break-words leading-relaxed">
                                    {reply.content}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-3 mt-1.5 px-3">
                                  <span className="text-xs text-gray-400 font-medium">
                                    {new Date(reply.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <button
                                    onClick={() => handleLikeComment(selectedPostForComments.id, reply.id, true, comment.id)}
                                    className={`text-xs font-medium transition-colors flex items-center gap-1 ${
                                      reply.liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                                    }`}
                                  >
                                    <Heart className={`w-3 h-3 ${reply.liked ? 'fill-red-500' : ''}`} />
                                    {reply.likeCount > 0 && <span>{reply.likeCount}</span>}
                                  </button>
                                  {reply.userId === userId && (
                                    <button
                                      onClick={() => handleDeleteComment(selectedPostForComments.id, reply.id)}
                                      className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="relative mb-4">
                      <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl"></div>
                      <MessageCircle className="relative w-16 h-16 text-gray-300 dark:text-gray-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                      No comments yet
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Be the first to share your thoughts!
                    </p>
                  </div>
                )}
              </div>

              {/* Comment Input */}
              <div className="p-5 border-t border-gray-200 dark:border-gray-700/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
                {replyingTo && (
                  <div className="mb-3 flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      Replying to comment...
                    </span>
                    <button
                      onClick={() => {
                        setReplyingTo(null);
                        setCommentTexts(prev => ({ ...prev, [selectedPostForComments.id]: '' }));
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="flex items-center space-x-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={commentTexts[selectedPostForComments.id] || ''}
                      onChange={(e) => setCommentTexts(prev => ({ ...prev, [selectedPostForComments.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddComment(selectedPostForComments.id);
                        }
                      }}
                      placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
                      className="w-full px-5 py-3 text-sm border-2 border-gray-200 dark:border-gray-700 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                    />
                  </div>
                  <button
                    onClick={() => handleAddComment(selectedPostForComments.id)}
                    disabled={!commentTexts[selectedPostForComments.id]?.trim()}
                    className="px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-full hover:from-blue-700 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 disabled:hover:scale-100"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Right Sidebar */}
      <div className="hidden lg:block lg:col-span-3">
        <div className="space-y-6">
          {/* Friend Suggestions */}
          <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 dark:border-gray-800/50 shadow-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Suggested Friends
              </span>
              <button 
                onClick={() => router.push('/workspace/friends?tab=add')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                See All
              </button>
            </h3>
            <div className="space-y-3">
              {friendSuggestions.length > 0 ? (
                friendSuggestions.map((suggestion) => (
                  <div key={suggestion.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur opacity-30 group-hover:opacity-60 transition-opacity"></div>
                        <div className="relative w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-lg overflow-hidden">
                          {suggestion.imageUrl ? (
                            <img src={suggestion.imageUrl} alt={suggestion.username || suggestion.email} className="w-full h-full object-cover" />
                          ) : (
                            <span>
                              {(suggestion.firstName?.[0] || suggestion.username?.[0] || suggestion.email?.[0] || 'U').toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                          {suggestion.username || `${suggestion.firstName || ''} ${suggestion.lastName || ''}`.trim() || suggestion.email.split('@')[0]}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {suggestion.mutualFriendsCount > 0 ? (
                            <>{suggestion.mutualFriendsCount} mutual {suggestion.mutualFriendsCount === 1 ? 'friend' : 'friends'}</>
                          ) : (
                            'Suggested for you'
                          )}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleSendFriendRequest(suggestion.clerkId)}
                      disabled={sendingRequests.has(suggestion.clerkId)}
                      className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-xs font-semibold rounded-lg transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {sendingRequests.has(suggestion.clerkId) ? 'Sending...' : 'Add'}
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                  No suggestions available. Add more friends to see recommendations!
                </p>
              )}
            </div>
          </div>

          {/* Your Activity */}
          <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200/50 dark:border-gray-800/50 shadow-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Your Activity
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center">
                    <Heart className="w-4 h-4 text-red-500" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Likes</span>
                </div>
                <span className="text-sm font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
                  {userStats.likes}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Comments</span>
                </div>
                <span className="text-sm font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  {userStats.comments}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <Bookmark className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Saved</span>
                </div>
                <span className="text-sm font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                  {userStats.bookmarks}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-4 h-4 text-purple-500" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Posts</span>
                </div>
                <span className="text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {userStats.posts}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-2xl p-4 border border-gray-200/50 dark:border-gray-800/50">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              © 2025 Tasty Creative AI
            </p>
            <div className="flex items-center justify-center gap-3 mt-2">
              <button className="text-xs text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                About
              </button>
              <span className="text-gray-400">•</span>
              <button className="text-xs text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                Help
              </button>
              <span className="text-gray-400">•</span>
              <button className="text-xs text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                Terms
              </button>
            </div>
          </div>
        </div>
      </div>

        </div>
      </div>
    </div>
  );
}
