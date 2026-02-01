"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";
import { 
  Grid3x3, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  X, 
  ChevronLeft,
  Play,
  Plus,
  FolderOpen,
  MoreVertical,
  Send,
  Eye,
  CheckCheck,
  CalendarClock,
  ExternalLink,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  Filter,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import VaultPickerModal from "./VaultPickerModal";
import {
  fetchInstagramPosts,
  createInstagramPost,
  updateInstagramPost,
  deleteInstagramPost,
  updatePostsOrder,
  type InstagramPost,
} from "@/lib/instagram-posts";

// Role types
type UserRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "CONTENT_CREATOR" | "USER";

// Permission helpers
const canApprove = (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role);
const canSchedule = (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role);
const canPublish = (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER", "CONTENT_CREATOR"].includes(role);
const canAccessTool = (role: UserRole) => ["SUPER_ADMIN", "ADMIN", "MANAGER", "CONTENT_CREATOR"].includes(role);

interface Post {
  id: string;
  image: string;
  caption: string;
  status: "DRAFT" | "REVIEW" | "APPROVED" | "SCHEDULED" | "PENDING" | "PUBLISHED";
  type: "POST" | "REEL" | "STORY";
  date: string;
  profileId: string | null;
  awsS3Key?: string | null;
  awsS3Url?: string | null;
  originalFolder: string;
  order: number;
  fileName: string;
  mimeType?: string;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  instagramUrl?: string | null;
  publishedAt?: string | null;
}

interface InstagramStagingToolProps {
  highlightPostId?: string | null;
  profileId?: string | null;
}

const InstagramStagingTool = ({ highlightPostId, profileId }: InstagramStagingToolProps = {}) => {
  const { user, isLoaded } = useUser();
  
  // States
  const [userRole, setUserRole] = useState<UserRole>("USER");
  const [roleLoading, setRoleLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Post["status"] | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Action dialogs
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingPost, setRejectingPost] = useState<Post | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishingPost, setPublishingPost] = useState<Post | null>(null);
  const [instagramUrl, setInstagramUrl] = useState("");

  // Fetch user role
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!isLoaded || !user) {
        setRoleLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/user/role");
        const data = await response.json();
        if (data.success) {
          setUserRole(data.role as UserRole);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      } finally {
        setRoleLoading(false);
      }
    };

    fetchUserRole();
  }, [isLoaded, user]);

  // Load posts
  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const dbPosts = await fetchInstagramPosts(undefined, profileId || undefined);
      const convertedPosts: Post[] = dbPosts.map((dbPost) => ({
        id: dbPost.id,
        profileId: dbPost.profileId,
        image: dbPost.awsS3Url || dbPost.driveFileUrl || "",
        caption: dbPost.caption,
        status: dbPost.status,
        type: dbPost.postType,
        date: dbPost.scheduledDate || "",
        awsS3Key: dbPost.awsS3Key ?? undefined,
        awsS3Url: dbPost.awsS3Url ?? undefined,
        originalFolder: dbPost.originalFolder || dbPost.folder,
        order: dbPost.order,
        fileName: dbPost.fileName,
        mimeType: dbPost.mimeType || undefined,
        rejectedAt: dbPost.rejectedAt,
        rejectionReason: dbPost.rejectionReason,
        instagramUrl: dbPost.instagramUrl || undefined,
        publishedAt: dbPost.publishedAt || undefined,
      }));
      setPosts(convertedPosts);
    } catch (error) {
      console.error("Error loading posts:", error);
    } finally {
      setPostsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    setPosts([]);
    setSelectedPost(null);
    loadPosts();
  }, [profileId, loadPosts]);

  // Handle vault select
  const handleVaultSelect = async (items: Array<{
    id: string;
    fileName: string;
    fileType: string;
    awsS3Key: string;
    awsS3Url: string;
    folderId: string;
  }>) => {
    if (items.length === 0) return;

    try {
      for (const item of items) {
        const isVideo = item.fileType?.startsWith('video/');
        const postType = isVideo ? 'REEL' : 'POST';

        await createInstagramPost({
          profileId: profileId || undefined,
          fileName: item.fileName,
          mimeType: item.fileType,
          awsS3Key: item.awsS3Key,
          awsS3Url: item.awsS3Url,
          status: 'DRAFT',
          caption: '',
          postType: postType,
          folder: 'vault',
        });
      }

      toast.success(`Added ${items.length} item${items.length > 1 ? 's' : ''}`);
      await loadPosts();
    } catch (error) {
      console.error('Error adding vault items:', error);
      toast.error('Failed to add items');
    }
  };

  // Status update
  const updatePostStatus = async (post: Post, newStatus: Post["status"]) => {
    try {
      await updateInstagramPost(post.id, { status: newStatus } as any);
      setPosts(posts.map(p => p.id === post.id ? { ...p, status: newStatus } : p));
      if (selectedPost?.id === post.id) {
        setSelectedPost({ ...post, status: newStatus });
      }
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Handle reject
  const confirmReject = async () => {
    if (!rejectingPost || !rejectionReason.trim()) {
      toast.warning("Please provide a reason");
      return;
    }

    try {
      await updateInstagramPost(rejectingPost.id, {
        status: "DRAFT",
        rejectionReason: rejectionReason.trim(),
      } as any);

      setPosts(posts.map(p => 
        p.id === rejectingPost.id 
          ? { ...p, status: "DRAFT" as const, rejectionReason: rejectionReason.trim(), rejectedAt: new Date().toISOString() }
          : p
      ));

      setShowRejectDialog(false);
      setRejectingPost(null);
      setRejectionReason("");
      toast.success("Post rejected");
    } catch (error) {
      toast.error("Failed to reject post");
    }
  };

  // Handle publish
  const confirmPublish = async () => {
    if (!publishingPost) return;

    try {
      const now = new Date().toISOString();
      await updateInstagramPost(publishingPost.id, {
        status: "PUBLISHED",
        instagramUrl: instagramUrl.trim() || null,
        publishedAt: now,
      } as any);

      setPosts(posts.map(p =>
        p.id === publishingPost.id
          ? { ...p, status: "PUBLISHED" as const, instagramUrl: instagramUrl.trim() || null, publishedAt: now }
          : p
      ));

      setShowPublishDialog(false);
      setPublishingPost(null);
      setInstagramUrl("");
      toast.success("Post published");
    } catch (error) {
      toast.error("Failed to publish post");
    }
  };

  // Handle delete
  const handleDelete = async (post: Post) => {
    if (!confirm(`Remove "${post.fileName}"?`)) return;

    try {
      await deleteInstagramPost(post.id, { deleteFromStorage: false });
      setPosts(posts.filter(p => p.id !== post.id));
      if (selectedPost?.id === post.id) {
        setSelectedPost(null);
      }
      toast.success("Removed from queue");
    } catch (error) {
      toast.error("Failed to remove post");
    }
  };

  // Update caption
  const updateCaption = async (post: Post, newCaption: string) => {
    try {
      await updateInstagramPost(post.id, { caption: newCaption });
      setPosts(posts.map(p => p.id === post.id ? { ...p, caption: newCaption } : p));
      if (selectedPost?.id === post.id) {
        setSelectedPost({ ...post, caption: newCaption });
      }
    } catch (error) {
      toast.error("Failed to update caption");
    }
  };

  // Filter posts
  const filteredPosts = posts.filter(post => {
    const matchesStatus = statusFilter === "ALL" || post.status === statusFilter;
    const matchesSearch = searchQuery === "" || 
      post.caption.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Status badge
  const StatusBadge = ({ status, isRejected }: { status: Post["status"]; isRejected?: boolean }) => {
    if (isRejected) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <AlertCircle className="w-3 h-3" />
          Rejected
        </span>
      );
    }

    const styles = {
      DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
      REVIEW: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      SCHEDULED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      PENDING: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      PUBLISHED: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    };

    const icons = {
      DRAFT: null,
      REVIEW: <Eye className="w-3 h-3" />,
      APPROVED: <CheckCircle className="w-3 h-3" />,
      SCHEDULED: <CalendarClock className="w-3 h-3" />,
      PENDING: <Clock className="w-3 h-3" />,
      PUBLISHED: <CheckCheck className="w-3 h-3" />,
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {icons[status]}
        {status.charAt(0) + status.slice(1).toLowerCase()}
      </span>
    );
  };

  if (!isLoaded || roleLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!canAccessTool(userRole)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-md text-center">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have permission to access this tool.
          </p>
          <span className="inline-block px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400">
            Current role: <span className="font-semibold">{userRole}</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Modern Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <ImageIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Content Staging</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Instagram Posts</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {!profileId ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">Select a profile</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowVaultPicker(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add Media</span>
                </button>
              )}
            </div>
          </div>

          {/* Search & Filters */}
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {(["ALL", "DRAFT", "REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    statusFilter === status
                      ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
                  {status !== "ALL" && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded">
                      {posts.filter(p => p.status === status).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {postsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No posts yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Start by adding media from your vault</p>
            {profileId && (
              <button
                onClick={() => setShowVaultPicker(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Plus className="w-5 h-5" />
                Add Media
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="group relative aspect-square rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-2xl"
              >
                {/* Media */}
                {post.type === "REEL" ? (
                  <>
                    <video
                      src={post.image}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 right-3 w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <Play className="w-4 h-4 text-white fill-white" />
                    </div>
                  </>
                ) : (
                  <img
                    src={post.image}
                    alt={post.fileName}
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
                    <StatusBadge status={post.status} isRejected={!!post.rejectedAt} />
                    {post.caption && (
                      <p className="text-xs text-white line-clamp-2">{post.caption}</p>
                    )}
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="absolute top-3 left-3">
                  <StatusBadge status={post.status} isRejected={!!post.rejectedAt} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Post Detail Sidebar */}
      {selectedPost && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedPost(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Post Details</h2>
              <button
                onClick={() => setSelectedPost(null)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* Media */}
              <div className="p-6">
                {selectedPost.type === "REEL" ? (
                  <video
                    src={selectedPost.image}
                    controls
                    className="w-full aspect-square object-cover rounded-2xl"
                  />
                ) : (
                  <img
                    src={selectedPost.image}
                    alt={selectedPost.fileName}
                    className="w-full aspect-square object-cover rounded-2xl"
                  />
                )}
              </div>

              {/* Details */}
              <div className="px-6 pb-6 space-y-6">
                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selectedPost.status} isRejected={!!selectedPost.rejectedAt} />
                    {selectedPost.instagramUrl && (
                      <a
                        href={selectedPost.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View on Instagram
                      </a>
                    )}
                  </div>
                </div>

                {/* Rejection Reason */}
                {selectedPost.rejectedAt && selectedPost.rejectionReason && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-900 dark:text-red-300 mb-1">Rejected</p>
                        <p className="text-sm text-red-700 dark:text-red-400">{selectedPost.rejectionReason}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Caption */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Caption</label>
                  <textarea
                    value={selectedPost.caption}
                    onChange={(e) => {
                      setSelectedPost({ ...selectedPost, caption: e.target.value });
                    }}
                    onBlur={(e) => updateCaption(selectedPost, e.target.value)}
                    placeholder="Write a caption..."
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  {selectedPost.status === "DRAFT" && (
                    <button
                      onClick={() => updatePostStatus(selectedPost, "REVIEW")}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-medium transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      Submit for Review
                    </button>
                  )}

                  {selectedPost.status === "REVIEW" && canApprove(userRole) && (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => updatePostStatus(selectedPost, "APPROVED")}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setRejectingPost(selectedPost);
                          setShowRejectDialog(true);
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}

                  {selectedPost.status === "APPROVED" && canSchedule(userRole) && (
                    <button
                      onClick={() => updatePostStatus(selectedPost, "SCHEDULED")}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
                    >
                      <CalendarClock className="w-4 h-4" />
                      Schedule
                    </button>
                  )}

                  {(selectedPost.status === "SCHEDULED" || selectedPost.status === "PENDING") && canPublish(userRole) && (
                    <button
                      onClick={() => {
                        setPublishingPost(selectedPost);
                        setInstagramUrl(selectedPost.instagramUrl || "");
                        setShowPublishDialog(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-xl font-medium transition-colors"
                    >
                      <CheckCheck className="w-4 h-4" />
                      Mark as Published
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(selectedPost)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 rounded-xl font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Vault Picker Modal */}
      {profileId && (
        <VaultPickerModal
          isOpen={showVaultPicker}
          onClose={() => setShowVaultPicker(false)}
          profileId={profileId}
          onSelect={handleVaultSelect}
          multiple={true}
          acceptTypes="all"
          title="Select Media"
        />
      )}

      {/* Reject Dialog */}
      {showRejectDialog && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Reject Post</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Provide a reason for rejection..."
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectingPost(null);
                  setRejectionReason("");
                }}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={!rejectionReason.trim()}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Publish Dialog */}
      {showPublishDialog && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Mark as Published</h3>
            <input
              type="url"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://www.instagram.com/p/..."
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 mb-2"
              autoFocus
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Optional: Add Instagram post URL</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPublishDialog(false);
                  setPublishingPost(null);
                  setInstagramUrl("");
                }}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmPublish}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-xl font-medium transition-colors"
              >
                Publish
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default InstagramStagingTool;
