"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Calendar,
  Grid3x3,
  Upload,
  Edit3,
  Trash2,
  Check,
  Clock,
  MessageSquare,
  RefreshCw,
  FolderOpen,
  Image as ImageIcon,
  Video,
  Send,
  X,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Search,
  Filter,
  Users,
} from "lucide-react";
import {
  fetchInstagramPosts,
  fetchInstagramPostUsers,
  createInstagramPost,
  updateInstagramPost,
  deleteInstagramPost,
  updatePostsOrder,
  type InstagramPost,
} from "@/lib/instagram-posts";
import {
  initializeS3Folders,
  loadS3Folder,
  S3_UPLOAD_FOLDERS,
  type S3Folder,
  type S3File,
} from "@/lib/s3-helpers";
import QueueTimelineView from "./QueueTimelineView";
import WorkflowGuide from "./WorkflowGuide";
import { useUser } from "@clerk/nextjs";

// Role types
type UserRole = "ADMIN" | "MANAGER" | "CONTENT_CREATOR" | "USER";

// Permission helper functions
const canApprove = (role: UserRole) => role === "ADMIN" || role === "MANAGER";
const canSchedule = (role: UserRole) => role === "ADMIN" || role === "MANAGER";
const canPublish = (role: UserRole) => role === "ADMIN" || role === "MANAGER" || role === "CONTENT_CREATOR";
const canDeleteAny = (role: UserRole) => role === "ADMIN" || role === "MANAGER";
const canSubmitForReview = (role: UserRole) =>
  role === "ADMIN" || role === "MANAGER" || role === "CONTENT_CREATOR";
const canAccessTool = (role: UserRole) =>
  role === "ADMIN" || role === "MANAGER" || role === "CONTENT_CREATOR";

// Workflow status progression
const getNextStatus = (
  currentStatus: InstagramPost["status"]
): InstagramPost["status"] | null => {
  switch (currentStatus) {
    case "DRAFT":
      return "REVIEW";
    case "REVIEW":
      return "APPROVED";
    case "APPROVED":
      return "SCHEDULED";
    case "SCHEDULED":
      return "PENDING"; // Reminder sent
    case "PENDING":
      return "PUBLISHED"; // User manually posted
    default:
      return null;
  }
};

interface Post {
  id: string;
  image: string;
  caption: string;
  status: "DRAFT" | "REVIEW" | "APPROVED" | "SCHEDULED" | "PENDING" | "PUBLISHED";
  type: "POST" | "REEL" | "STORY";
  date: string;
  profileId: string | null;
  driveFileId?: string | null;
  awsS3Key?: string | null;
  awsS3Url?: string | null;
  originalFolder: string;
  order: number;
  fileName: string;
  mimeType?: string;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  rejectedBy?: string | null;
  instagramUrl?: string | null;
  publishedAt?: string | null;
}

// Helper function to convert date to local timezone format (YYYY-MM-DDTHH:mm)
const toLocalDateTimeString = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

interface InstagramStagingToolProps {
  highlightPostId?: string | null;
  profileId?: string | null;
}

const InstagramStagingTool = ({ highlightPostId, profileId }: InstagramStagingToolProps = {}) => {
  const { user, isLoaded } = useUser();
  const currentUserId = user?.id || "";

  // Fetch user role from database instead of Clerk metadata
  const [userRole, setUserRole] = useState<UserRole>("USER");
  const [roleLoading, setRoleLoading] = useState(true);

  const [view, setView] = useState<"grid" | "queue">("grid");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const initialS3Folders = useMemo(() => initializeS3Folders(), []);
  const [s3Folders, setS3Folders] = useState<S3Folder[]>(initialS3Folders);
  const [selectedFolder, setSelectedFolder] = useState<string>(
    initialS3Folders[0]?.name || "All Generations"
  );
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [fileBlobUrls, setFileBlobUrls] = useState<Record<string, string>>({});
  const [draggedPost, setDraggedPost] = useState<Post | null>(null);
  const [dragOverPost, setDragOverPost] = useState<string | null>(null);

  // User selection for Admin/Manager
  const [availableUsers, setAvailableUsers] = useState<
    Array<{
      clerkId: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      imageUrl: string;
      role: string;
      postCount: number;
    }>
  >([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Rejection dialog state
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingPost, setRejectingPost] = useState<Post | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Publish dialog state
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishingPost, setPublishingPost] = useState<Post | null>(null);
  const [instagramUrl, setInstagramUrl] = useState("");

  // Bulk schedule dialog state
  const [showBulkScheduleDialog, setShowBulkScheduleDialog] = useState(false);
  const [bulkScheduleDate, setBulkScheduleDate] = useState("");
  const [bulkScheduleTime, setBulkScheduleTime] = useState("");
  
  // Media library filter state
  const [mediaLibraryStatusFilter, setMediaLibraryStatusFilter] = useState<string>("ALL");
  
  // Media library visibility for mobile
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);

  // Upload dialog state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFolder, setUploadFolder] = useState("instagram/posts/");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [postsLoading, setPostsLoading] = useState(false);

  // Fetch user role from database on mount
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

  // Auto-select and scroll to highlighted post from URL
  useEffect(() => {
    if (highlightPostId && posts.length > 0) {
      const postToHighlight = posts.find(p => p.id === highlightPostId);
      if (postToHighlight) {
        setSelectedPost(postToHighlight);
        // Scroll to the post card
        setTimeout(() => {
          const element = document.getElementById(`post-${highlightPostId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add a temporary highlight effect
            element.classList.add('ring-4', 'ring-blue-500', 'ring-opacity-50');
            setTimeout(() => {
              element.classList.remove('ring-4', 'ring-blue-500', 'ring-opacity-50');
            }, 3000);
          }
        }, 500);
      }
    }
  }, [highlightPostId, posts]);

  // Load posts from database on mount
  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      // Admin/Manager can view specific user's posts, otherwise view own posts
      const userIdToFetch =
        (userRole === "ADMIN" || userRole === "MANAGER") && selectedUserId
          ? selectedUserId
          : undefined;

      const dbPosts = await fetchInstagramPosts(userIdToFetch, profileId || undefined);
      // Convert database posts to component format
      const convertedPosts: Post[] = dbPosts.map((dbPost) => ({
        id: dbPost.id,
        profileId: dbPost.profileId,
        image: dbPost.awsS3Url || dbPost.driveFileUrl || "",
        caption: dbPost.caption,
        status: dbPost.status,
        type: dbPost.postType,
        date: dbPost.scheduledDate
          ? toLocalDateTimeString(dbPost.scheduledDate)
          : "", // Keep empty if no scheduled date (don't default to now)
        driveFileId: dbPost.driveFileId ?? undefined,
        awsS3Key: dbPost.awsS3Key ?? undefined,
        awsS3Url: dbPost.awsS3Url ?? undefined,
        originalFolder: dbPost.originalFolder || dbPost.folder, // Use originalFolder if available, fallback to folder
        order: dbPost.order,
        fileName: dbPost.fileName,
        mimeType: dbPost.mimeType || undefined,
        rejectedAt: dbPost.rejectedAt,
        rejectionReason: dbPost.rejectionReason,
        rejectedBy: dbPost.rejectedBy,
        instagramUrl: dbPost.instagramUrl || undefined,
        publishedAt: dbPost.publishedAt || undefined,
      }));
      setPosts(convertedPosts);
      console.log(`✅ Loaded ${convertedPosts.length} posts from database for profile ${profileId || 'none'}`);
    } catch (error) {
      console.error("❌ Error loading posts from database:", error);
    } finally {
      setPostsLoading(false);
    }
  }, [userRole, selectedUserId, profileId]);

  // Clear posts and reload when profile changes
  useEffect(() => {
    // Clear existing posts immediately to prevent showing wrong profile's content
    setPosts([]);
    setSelectedPost(null);
    loadPosts();
  }, [selectedUserId, userRole, profileId, loadPosts]); // Reload when selected user or profile changes

  // Load available users for Admin/Manager
  useEffect(() => {
    const loadUsers = async () => {
      if (userRole !== "ADMIN" && userRole !== "MANAGER") return;

      try {
        setLoadingUsers(true);
        const users = await fetchInstagramPostUsers();
        setAvailableUsers(users);
      } catch (error) {
        console.error("❌ Error loading users:", error);
      } finally {
        setLoadingUsers(false);
      }
    };

    if (isLoaded) {
      loadUsers();
    }
  }, [userRole, isLoaded]);

  // Real-time updates: SSE for local dev, polling for Vercel production
  useEffect(() => {
    if (!isLoaded || !user) return;

    // Detect if we're in production (Vercel) or local development
    const isProduction =
      typeof window !== "undefined" &&
      (window.location.hostname.includes("vercel.app") ||
        window.location.hostname !== "localhost");

    // Try SSE first (instant updates for local dev)
    if (!isProduction) {
      console.log("🔴 Using SSE (Server-Sent Events) for real-time updates");
      const eventSource = new EventSource("/api/instagram-posts/stream");

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "connected") {
            console.log("✅ Connected to real-time SSE stream");
            return;
          }

          if (
            data.action === "update" ||
            data.action === "create" ||
            data.action === "delete"
          ) {
            // Refresh all posts to get latest state
            const refreshPosts = async () => {
              try {
                const params = new URLSearchParams();
                if (selectedUserId) {
                  params.append("userId", selectedUserId);
                }
                if (profileId) {
                  params.append("profileId", profileId);
                }

                const response = await fetch(`/api/instagram-posts?${params}`);
                const result = await response.json();

                if (result.success && result.posts) {
                  setPosts((prev) => {
                    const blobUrls = new Map(prev.map((p) => [p.id, p.image]));
                    return result.posts.map((post: any) => ({
                      id: post.id,
                      profileId: post.profileId,
                      image:
                        blobUrls.get(post.id) || post.awsS3Url || post.driveFileUrl,
                      caption: post.caption,
                      status: post.status,
                      type: post.postType,
                      date: post.scheduledDate || post.createdAt,
                      driveFileId: post.driveFileId,
                      awsS3Key: post.awsS3Key,
                      awsS3Url: post.awsS3Url,
                      originalFolder: post.originalFolder || post.folder,
                      order: post.order,
                      fileName: post.fileName,
                      mimeType: post.mimeType,
                      rejectedAt: post.rejectedAt,
                      rejectionReason: post.rejectionReason,
                      rejectedBy: post.rejectedBy,
                      instagramUrl: post.instagramUrl,
                      publishedAt: post.publishedAt,
                    }));
                  });
                  console.log(
                    `🔄 SSE: Real-time update (${data.action}) for post ${data.postId}`
                  );
                }
              } catch (error) {
                console.error("Error refreshing posts:", error);
              }
            };

            refreshPosts();
          }
        } catch (error) {
          console.error("Error parsing SSE message:", error);
        }
      };

      eventSource.onerror = () => {
        console.error("❌ SSE connection error");
        eventSource.close();
      };

      return () => {
        console.log("🔴 Closing SSE connection");
        eventSource.close();
      };
    } else {
      // Fallback to polling for production (Vercel)
      console.log("📊 Using polling for real-time updates (Production mode)");
      let lastCheck = Date.now();
      let isActive = true;

      const checkForChanges = async () => {
        if (!isActive) return;

        try {
          const params = new URLSearchParams({
            lastCheck: lastCheck.toString(),
          });

          if (selectedUserId) {
            params.append("userId", selectedUserId);
          }
          if (profileId) {
            params.append("profileId", profileId);
          }

          const response = await fetch(
            `/api/instagram-posts/changes?${params}`
          );
          const data = await response.json();

          if (data.hasChanges && data.posts) {
            setPosts((prev) => {
              const blobUrls = new Map(prev.map((p) => [p.id, p.image]));
              return data.posts.map((post: any) => ({
                id: post.id,
                profileId: post.profileId,
                image:
                  blobUrls.get(post.id) || post.awsS3Url || post.driveFileUrl,
                caption: post.caption,
                status: post.status,
                type: post.postType,
                date: post.scheduledDate || post.createdAt,
                driveFileId: post.driveFileId,
                awsS3Key: post.awsS3Key,
                awsS3Url: post.awsS3Url,
                originalFolder: post.originalFolder || post.folder,
                order: post.order,
                fileName: post.fileName,
                mimeType: post.mimeType,
                rejectedAt: post.rejectedAt,
                rejectionReason: post.rejectionReason,
                rejectedBy: post.rejectedBy,
                instagramUrl: post.instagramUrl,
                publishedAt: post.publishedAt,
              }));
            });
            console.log(
              `🔄 Polling: Received ${data.posts.length} updated posts`
            );
          }

          lastCheck = data.timestamp;
        } catch (error) {
          console.error("Error checking for changes:", error);
        }
      };

      const interval = setInterval(checkForChanges, 3000);

      return () => {
        isActive = false;
        clearInterval(interval);
      };
    }
  }, [isLoaded, user, selectedUserId, profileId]);

  const loadFolderContents = useCallback(
    async (prefix: string, folderName: string) => {
      setS3Folders((prev) =>
        prev.map((folder) =>
          folder.name === folderName
            ? { ...folder, loading: true, error: undefined }
            : folder
        )
      );

      try {
        const files = await loadS3Folder(prefix);

        setS3Folders((prev) =>
          prev.map((folder) =>
            folder.name === folderName
              ? { ...folder, files, loading: false, error: undefined }
              : folder
          )
        );

        setFileBlobUrls((prev) => {
          const next = { ...prev };
          files.forEach((file: S3File) => {
            next[file.id] = file.url;
          });
          return next;
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load folder";

        setS3Folders((prev) =>
          prev.map((folder) =>
            folder.name === folderName
              ? { ...folder, loading: false, error: errorMessage }
              : folder
          )
        );
      }
    },
    [setS3Folders, setFileBlobUrls]
  );

  const loadAllFolders = useCallback(async () => {
    setIsLoadingFolders(true);
    try {
      for (const folder of initialS3Folders) {
        await loadFolderContents(folder.prefix, folder.name);
      }
    } finally {
      setIsLoadingFolders(false);
    }
  }, [initialS3Folders, loadFolderContents]);

  useEffect(() => {
    loadAllFolders();
  }, [loadAllFolders]);

  const getStatusColor = (status: Post["status"], isRejected?: boolean) => {
    if (isRejected && status === "DRAFT") {
      return "bg-red-500";
    }

    switch (status) {
      case "APPROVED":
        return "bg-green-500";
      case "REVIEW":
        return "bg-yellow-500";
      case "DRAFT":
        return "bg-gray-400";
      case "SCHEDULED":
        return "bg-blue-500";
      case "PUBLISHED":
        return "bg-purple-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusText = (status: Post["status"], isRejected?: boolean) => {
    if (isRejected && status === "DRAFT") {
      return "Rejected";
    }

    switch (status) {
      case "APPROVED":
        return "Approved";
      case "REVIEW":
        return "In Review";
      case "DRAFT":
        return "Draft";
      case "SCHEDULED":
        return "Scheduled";
      case "PUBLISHED":
        return "Published";
      default:
        return "Draft";
    }
  };

  const updatePost = async (updatedPost: Post) => {
    // Update local state immediately for responsive UI
    setPosts(posts.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
    setSelectedPost(updatedPost);

    // Save to database
    try {
      // Convert local datetime to ISO string with timezone
      // The datetime-local input gives us "2025-10-04T16:38" which is local time
      // We need to convert this to a Date object that represents that exact local time
      let scheduledDateISO = updatedPost.date;
      if (updatedPost.date) {
        const localDate = new Date(updatedPost.date);
        // Convert to ISO string which will be in UTC
        scheduledDateISO = localDate.toISOString();
      }

      await updateInstagramPost(updatedPost.id, {
        caption: updatedPost.caption,
        scheduledDate: scheduledDateISO,
        status: updatedPost.status,
        postType: updatedPost.type,
        awsS3Key: updatedPost.awsS3Key,
        awsS3Url: updatedPost.awsS3Url,
      });
      console.log(`✅ Updated post ${updatedPost.id} in database`);
    } catch (error) {
      console.error("❌ Error updating post in database:", error);
      toast.error("Failed to save changes. Please try again.");
    }
  };

  // Handle workflow status changes
  const handleStatusChange = async (
    post: Post,
    newStatus: InstagramPost["status"]
  ) => {
    try {
      // No longer moving files to status folders - just update the status
      const updatedPost = { ...post, status: newStatus };
      await updatePost(updatedPost);
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      console.error('❌ Error changing status:', error);
      toast.error('Failed to change status. Please try again.');
    }
  };

  // Workflow action buttons
  const handleSubmitForReview = async (post: Post) => {
    if (!canSubmitForReview(userRole)) {
      toast.warning("You don't have permission to submit posts for review.");
      return;
    }
    await handleStatusChange(post, "REVIEW");
  };

  const handleApprove = async (post: Post) => {
    if (!canApprove(userRole)) {
      toast.warning("You don't have permission to approve posts.");
      return;
    }
    await handleStatusChange(post, "APPROVED");
  };

  const handleReject = async (post: Post) => {
    if (!canApprove(userRole)) {
      toast.warning("You don't have permission to reject posts.");
      return;
    }
    // Show rejection dialog
    setRejectingPost(post);
    setRejectionReason("");
    setShowRejectDialog(true);
  };

  const confirmReject = async () => {
    if (!rejectingPost || !rejectionReason.trim()) {
      toast.warning("Please provide a reason for rejection.");
      return;
    }

    try {
      // No longer moving files - just update status and rejection info
      await updateInstagramPost(rejectingPost.id, {
        status: "DRAFT",
        rejectionReason: rejectionReason.trim(),
      } as any);

      // Update local state
      setPosts(
        posts.map((p) =>
          p.id === rejectingPost.id
            ? {
                ...p,
                status: "DRAFT" as const,
                rejectionReason: rejectionReason.trim(),
                rejectedAt: new Date().toISOString(),
              }
            : p
        )
      );

      if (selectedPost?.id === rejectingPost.id) {
        setSelectedPost({
          ...rejectingPost,
          status: "DRAFT" as const,
          rejectionReason: rejectionReason.trim(),
          rejectedAt: new Date().toISOString(),
        });
      }

      // Close dialog
      setShowRejectDialog(false);
      setRejectingPost(null);
      setRejectionReason("");
      
      toast.success("Post rejected");
    } catch (error) {
      console.error("❌ Error rejecting post:", error);
      toast.error("Failed to reject post. Please try again.");
    }
  };

  const confirmPublish = async () => {
    if (!publishingPost) return;

    try {
      const now = new Date().toISOString();
      const hasUrl = instagramUrl.trim().length > 0;
      
      // No longer moving files - just update status and publish info
      await updateInstagramPost(publishingPost.id, {
        status: "PUBLISHED",
        instagramUrl: instagramUrl.trim() || null,
        publishedAt: now,
      } as any);

      // Notify admins/managers when content creator publishes
      if (userRole === "CONTENT_CREATOR") {
        try {
          await fetch('/api/notifications/notify-admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'POST_PUBLISHED',
              postId: publishingPost.id,
              fileName: publishingPost.fileName,
              instagramUrl: hasUrl ? instagramUrl.trim() : null,
              publishedAt: now,
            }),
          });
        } catch (notifError) {
          console.error('Failed to notify admins:', notifError);
          // Don't fail the publish operation if notification fails
        }
      }

      // Update local state
      setPosts(
        posts.map((p) =>
          p.id === publishingPost.id
            ? {
                ...p,
                status: "PUBLISHED" as const,
                instagramUrl: instagramUrl.trim() || null,
                publishedAt: now,
              }
            : p
        )
      );

      if (selectedPost?.id === publishingPost.id) {
        setSelectedPost({
          ...publishingPost,
          status: "PUBLISHED" as const,
          instagramUrl: instagramUrl.trim() || null,
          publishedAt: now,
        });
      }

      // Close dialog
      setShowPublishDialog(false);
      setPublishingPost(null);
      setInstagramUrl("");
      
      toast.success("Post published");
    } catch (error) {
      console.error("❌ Error marking post as published:", error);
      toast.error("Failed to mark post as published. Please try again.");
    }
  };

  const confirmBulkSchedule = async () => {
    if (!bulkScheduleDate || !bulkScheduleTime) {
      toast.warning("Please select both date and time.");
      return;
    }

    const approvedSelected = posts.filter(p => 
      selectedPostIds.includes(p.id) && p.status === 'APPROVED'
    );

    if (approvedSelected.length === 0) {
      toast.warning('No approved posts selected.');
      return;
    }

    try {
      // Combine date and time into a Date object
      const scheduleDate = new Date(`${bulkScheduleDate}T${bulkScheduleTime}`);
      
      if (isNaN(scheduleDate.getTime())) {
        toast.error('Invalid date/time selection.');
        return;
      }

      // Update all selected approved posts - no longer moving files
      const updatedPosts: Post[] = [];
      
      for (const post of approvedSelected) {
        await updateInstagramPost(post.id, {
          status: 'SCHEDULED',
          scheduledDate: scheduleDate.toISOString(),
        } as any);
        
        updatedPosts.push({
          ...post,
          status: 'SCHEDULED' as const,
          date: scheduleDate.toISOString(),
        });
      }

      // Update local state
      setPosts(posts.map(p => {
        const updated = updatedPosts.find(up => up.id === p.id);
        return updated || p;
      }));

      // Clear selection and close dialog
      setSelectedPostIds([]);
      setShowBulkScheduleDialog(false);
      setBulkScheduleDate("");
      setBulkScheduleTime("");
      
      toast.success(`${approvedSelected.length} post(s) scheduled!`);
    } catch (error) {
      console.error("❌ Error bulk scheduling posts:", error);
      toast.error('Failed to schedule some posts. Please try again.');
    }
  };

  // Handle file upload
  const handleUpload = async () => {
    if (uploadFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploadedFiles = [];
      const totalFiles = uploadFiles.length;

      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i];
        console.log(`Uploading file ${i + 1}/${totalFiles}:`, file.name);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', uploadFolder);

        const response = await fetch('/api/s3/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const data = await response.json();
        uploadedFiles.push(data.file);
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      // Refresh the folder contents to show new files
      const folderName = S3_UPLOAD_FOLDERS.find(f => f.prefix === uploadFolder)?.name || 'Misc';
      await loadFolderContents(uploadFolder, folderName);

      toast.success(`Successfully uploaded ${uploadedFiles.length} file(s)!`);
      
      // Reset and close dialog
      setUploadFiles([]);
      setShowUploadDialog(false);
      setUploadProgress(0);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  };

  // Return all posts (filters removed)
  const getFilteredPosts = () => {
    return [...posts];
  };

  const handleSchedule = async (post: Post) => {
    if (!canSchedule(userRole)) {
      toast.warning("You don't have permission to schedule posts.");
      return;
    }
    if (!post.date) {
      toast.warning("Please set a scheduled date before marking as scheduled.");
      return;
    }
    await handleStatusChange(post, "SCHEDULED");
  };

  const handleMarkAsPublished = async (post: Post) => {
    if (!canPublish(userRole)) {
      toast.warning("You don't have permission to mark posts as published.");
      return;
    }
    // Show dialog to enter Instagram URL
    setPublishingPost(post);
    setInstagramUrl(post.instagramUrl || "");
    setShowPublishDialog(true);
  };

  const handleUnpublish = async (post: Post) => {
    if (!canPublish(userRole)) {
      toast.warning("You don't have permission to unpublish posts.");
      return;
    }
    if (confirm(`Revert "${post.fileName}" to scheduled status?`)) {
      await handleStatusChange(post, "SCHEDULED");
    }
  };

  // Backward workflow actions
  const handleRevertToApproved = async (post: Post) => {
    if (!canSchedule(userRole)) {
      toast.warning("You don't have permission to revert scheduled posts.");
      return;
    }
    if (confirm(`Revert "${post.fileName}" back to approved status?`)) {
      await handleStatusChange(post, "APPROVED");
    }
  };

  const handleRevertToReview = async (post: Post) => {
    if (!canApprove(userRole)) {
      toast.warning("You don't have permission to send posts back to review.");
      return;
    }
    if (confirm(`Send "${post.fileName}" back to review?`)) {
      await handleStatusChange(post, "REVIEW");
    }
  };

  const handleRevertToDraft = async (post: Post) => {
    if (!canSubmitForReview(userRole)) {
      toast.warning("You don't have permission to revert posts to draft.");
      return;
    }
    if (confirm(`Revert "${post.fileName}" back to draft?`)) {
      await handleStatusChange(post, "DRAFT");
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, post: Post) => {
    setDraggedPost(post);
    e.dataTransfer.effectAllowed = "move";
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDraggedPost(null);
    setDragOverPost(null);
  };

  const handleDragOver = (e: React.DragEvent, post: Post) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverPost(post.id);
  };

  const handleDragLeave = () => {
    setDragOverPost(null);
  };

  const handleDrop = async (e: React.DragEvent, targetPost: Post) => {
    e.preventDefault();
    setDragOverPost(null);

    if (!draggedPost || draggedPost.id === targetPost.id) return;

    // Reorder posts
    const currentPosts = [...posts];
    const draggedIndex = currentPosts.findIndex((p) => p.id === draggedPost.id);
    const targetIndex = currentPosts.findIndex((p) => p.id === targetPost.id);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Remove dragged item and insert at target position
    currentPosts.splice(draggedIndex, 1);
    currentPosts.splice(targetIndex, 0, draggedPost);

    // Update order property
    const reorderedPosts = currentPosts.map((post, index) => ({
      ...post,
      order: index,
    }));

    setPosts(reorderedPosts);

    // Save order to database
    try {
      await updatePostsOrder(
        reorderedPosts.map((p) => ({ id: p.id, order: p.order }))
      );
      console.log("✅ Updated post order in database");
    } catch (error) {
      console.error("❌ Error updating post order:", error);
      toast.error("Failed to save order. Please try again.");
    }
  };

  // Delete post function
  const handleDeletePost = async (post: Post) => {
    if (!confirm(`Remove "${post.fileName}" from feed preview?\n\nThe image will be moved back to its original folder.`)) {
      return;
    }

    try {
      // If post has S3 file and an original folder, move it back
      if (post.awsS3Key && post.originalFolder) {
        try {
          // Get the S3 prefix for the original folder
          const originalFolderData = s3Folders.find(f => f.name === post.originalFolder);
          
          if (originalFolderData) {
            console.log('🔄 Moving file back to original folder:', {
              postId: post.id,
              currentKey: post.awsS3Key,
              originalFolder: post.originalFolder,
              destinationPrefix: originalFolderData.prefix
            });

            const moveResponse = await fetch('/api/s3/move', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sourceKey: post.awsS3Key,
                destinationFolder: originalFolderData.prefix,
                keepOriginal: false,
              }),
            });

            if (moveResponse.ok) {
              console.log('✅ File moved back to original folder successfully');
              toast.success(`File moved back to ${post.originalFolder} folder`);
            } else {
              console.warn('⚠️ Failed to move file back, but will continue with deletion');
            }
          }
        } catch (moveError) {
          console.error('❌ Error moving file back to original folder:', moveError);
          // Continue with deletion even if move fails
        }
      }

      // Delete from database only (file has been restored to original location)
      await deleteInstagramPost(post.id, {
        deleteFromStorage: false, // Don't delete from storage, we moved it back
      });

      // Remove from local state
      setPosts((prev) => prev.filter((p) => p.id !== post.id));

      // Close editor if this post was selected
      if (selectedPost?.id === post.id) {
        setSelectedPost(null);
      }

      console.log(`✅ Removed post ${post.id} from feed preview`);
      toast.success("Removed from feed preview - file restored to original folder");
    } catch (error) {
      console.error("❌ Error removing post:", error);
      toast.error("Failed to remove post. Please try again.");
    }
  };

  // Delete file from media library (and from queue if exists)
  const handleDeleteFileFromLibrary = async (file: S3File) => {
    const queuedPost = posts.find(p => p.awsS3Key === file.key);
    
    const confirmMessage = queuedPost
      ? `Delete "${file.name}"?\n\nThis file is in your queue and will also be removed from there.`
      : `Delete "${file.name}"?\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      // Delete from S3
      const deleteResponse = await fetch('/api/s3/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: file.key,
        }),
      });

      if (!deleteResponse.ok) {
        throw new Error('Failed to delete file from S3');
      }

      // If file is queued, delete from database too
      if (queuedPost) {
        await deleteInstagramPost(queuedPost.id);
        setPosts(posts.filter(p => p.id !== queuedPost.id));
        
        if (selectedPost?.id === queuedPost.id) {
          setSelectedPost(null);
        }
      }

      // Refresh the folder to update the file list
      const folderToRefresh = selectedFolder === "All Folders" 
        ? s3Folders 
        : s3Folders.filter(f => f.name === selectedFolder);
      
      for (const folder of folderToRefresh) {
        await loadFolderContents(folder.prefix, folder.name);
      }

      toast.success(queuedPost ? "File deleted from library and queue" : "File deleted from library");
    } catch (error) {
      console.error('❌ Error deleting file:', error);
      toast.error('Failed to delete file. Please try again.');
    }
  };

  // Show loading state while checking role
  if (!isLoaded || roleLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading Instagram Staging Tool...
          </p>
        </div>
      </div>
    );
  }

  // Check access permissions - render access denied if user doesn't have permission
  if (!canAccessTool(userRole)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md text-center border border-white/20">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-300 mb-4">
            You don't have permission to access the Instagram Staging Tool.
          </p>
          <p className="text-sm text-gray-400">
            Only ADMIN, MANAGER, and CONTENT_CREATOR roles can access this tool.
          </p>
          <p className="text-xs text-gray-500 mt-4">
            Current role: <span className="font-semibold">{userRole}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <h1 className="text-base sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
              Instagram Content Staging
            </h1>
            {/* Role Badge */}
            <span
              className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${
                userRole === "ADMIN"
                  ? "bg-red-500/20 text-red-600 dark:text-red-400"
                  : userRole === "MANAGER"
                  ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                  : "bg-green-500/20 text-green-600 dark:text-green-400"
              }`}
            >
              {userRole}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {/* Selection Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Show message if no profile selected */}
              {!profileId && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300">
                    Select a profile to get started
                  </span>
                </div>
              )}
              
              {posts.length > 0 && (
                <button
                  onClick={() => {
                    const filteredPosts = getFilteredPosts();
                    const allFilteredSelected = filteredPosts.every(p => selectedPostIds.includes(p.id));
                    
                    if (allFilteredSelected) {
                      // Deselect all filtered posts
                      setSelectedPostIds(selectedPostIds.filter(id => !filteredPosts.find(p => p.id === id)));
                    } else {
                      // Select all filtered posts
                      const newSelected = [...selectedPostIds];
                      filteredPosts.forEach(p => {
                        if (!newSelected.includes(p.id)) {
                          newSelected.push(p.id);
                        }
                      });
                      setSelectedPostIds(newSelected);
                    }
                  }}
                  className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium active:scale-95"
                >
                  {getFilteredPosts().every(p => selectedPostIds.includes(p.id)) && getFilteredPosts().length > 0 ? '☐ Deselect All' : '☑ Select All'}
                </button>
              )}
              
              {selectedPostIds.length > 0 && (
                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {selectedPostIds.length} selected
                </span>
              )}
              
              <button 
                onClick={() => setShowUploadDialog(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm active:scale-95"
              >
                <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Upload</span>
                <span className="xs:hidden">Upload</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats Dashboard */}
        <div className="mt-4 sm:mt-6 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          {/* Pending Review */}
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border border-yellow-200 dark:border-yellow-700/30 rounded-lg p-3 sm:p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-500/20 dark:bg-yellow-500/30 rounded-full flex items-center justify-center">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <span className="text-xl sm:text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                {posts.filter(p => p.status === 'REVIEW').length}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-yellow-700 dark:text-yellow-300">Pending Review</p>
            <p className="text-[10px] sm:text-xs text-yellow-600 dark:text-yellow-400 mt-0.5 sm:mt-1">Awaiting approval</p>
          </div>

          {/* Ready to Schedule */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-700/30 rounded-lg p-3 sm:p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500/20 dark:bg-green-500/30 rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-300">
                {posts.filter(p => p.status === 'APPROVED').length}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-green-700 dark:text-green-300">Ready to Schedule</p>
            <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 mt-0.5 sm:mt-1">Approved posts</p>
          </div>

          {/* Scheduled Today */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700/30 rounded-lg p-3 sm:p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/20 dark:bg-blue-500/30 rounded-full flex items-center justify-center">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-300">
                {posts.filter(p => {
                  if (!p.date || p.status !== 'SCHEDULED') return false;
                  const today = new Date();
                  const postDate = new Date(p.date);
                  return postDate.toDateString() === today.toDateString();
                }).length}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300">Scheduled Today</p>
            <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 mt-0.5 sm:mt-1">Going out today</p>
          </div>

          {/* Needs Attention */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border border-red-200 dark:border-red-700/30 rounded-lg p-3 sm:p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-500/20 dark:bg-red-500/30 rounded-full flex items-center justify-center">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400" />
              </div>
              <span className="text-xl sm:text-2xl font-bold text-red-700 dark:text-red-300">
                {posts.filter(p => p.rejectedAt).length}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-red-700 dark:text-red-300">Needs Attention</p>
            <p className="text-[10px] sm:text-xs text-red-600 dark:text-red-400 mt-0.5 sm:mt-1">Rejected posts</p>
          </div>
        </div>

        {/* User Selector for Admin/Manager */}
        {(userRole === "ADMIN" || userRole === "MANAGER") && (
          <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
            <div className="flex-1 w-full sm:max-w-md">
              <select
                value={selectedUserId || ""}
                onChange={(e) => setSelectedUserId(e.target.value || null)}
                disabled={loadingUsers}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              >
                <option value="">📋 All My Posts (Personal View)</option>
                <optgroup label="👥 Content Creators">
                  {availableUsers
                    .filter((u) => u.role === "CONTENT_CREATOR")
                    .map((u) => (
                      <option key={u.clerkId} value={u.clerkId}>
                        {u.firstName && u.lastName
                          ? `${u.firstName} ${u.lastName}`
                          : u.email}{" "}
                        ({u.postCount} {u.postCount === 1 ? "post" : "posts"})
                      </option>
                    ))}
                </optgroup>
                <optgroup label="👔 Managers & Admins">
                  {availableUsers
                    .filter((u) => u.role === "ADMIN" || u.role === "MANAGER")
                    .map((u) => (
                      <option key={u.clerkId} value={u.clerkId}>
                        {u.firstName && u.lastName
                          ? `${u.firstName} ${u.lastName}`
                          : u.email}{" "}
                        [{u.role}] ({u.postCount}{" "}
                        {u.postCount === 1 ? "post" : "posts"})
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>
            {selectedUserId && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
                <span className="font-medium">Viewing:</span>
                <span>
                  {availableUsers.find((u) => u.clerkId === selectedUserId)
                    ?.firstName ||
                    availableUsers.find((u) => u.clerkId === selectedUserId)
                      ?.email}
                  's posts
                </span>
              </div>
            )}
          </div>
        )}

        {/* View Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mt-3 sm:mt-4">
          <div className="flex gap-2">
            <button
              onClick={() => setView("grid")}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm active:scale-95 ${
                view === "grid"
                  ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              <Grid3x3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Feed Preview</span>
              <span className="xs:hidden">Feed</span>
            </button>
            <button
              onClick={() => setView("queue")}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm active:scale-95 ${
                view === "queue"
                  ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Queue Timeline</span>
              <span className="xs:hidden">Queue</span>
            </button>
          </div>

          {/* Workflow Guide */}
          <div className="flex-1 w-full sm:max-w-md">
            <WorkflowGuide userRole={userRole} />
          </div>
        </div>

        {/* Bulk Actions Toolbar - Shows when posts are selected */}
        {selectedPostIds.length > 0 && (
          <div className="mt-3 sm:mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-semibold text-xs sm:text-sm text-blue-900 dark:text-blue-100">
                    {selectedPostIds.length} post{selectedPostIds.length > 1 ? 's' : ''} selected
                  </span>
                </div>
                <button
                  onClick={() => setSelectedPostIds([])}
                  className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium active:scale-95"
                >
                  Clear selection
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {/* Bulk Approve - Admin/Manager only */}
                {canApprove(userRole) && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Approve ${selectedPostIds.length} posts?`)) return;
                      try {
                        for (const postId of selectedPostIds) {
                          const post = posts.find(p => p.id === postId);
                          if (post && post.status === 'REVIEW') {
                            await handleStatusChange(post, 'APPROVED');
                          }
                        }
                        setSelectedPostIds([]);
                        toast.success(`${selectedPostIds.length} posts approved!`);
                      } catch (error) {
                        toast.error('Failed to approve some posts');
                      }
                    }}
                    className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors active:scale-95"
                  >
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline">Approve All</span>
                    <span className="xs:hidden">Approve</span>
                  </button>
                )}

                {/* Bulk Schedule - Admin/Manager only */}
                {canSchedule(userRole) && (
                  <button
                    onClick={() => {
                      const approvedSelected = posts.filter(p => 
                        selectedPostIds.includes(p.id) && p.status === 'APPROVED'
                      );
                      if (approvedSelected.length === 0) {
                        toast.warning('No approved posts selected. Only approved posts can be scheduled.');
                        return;
                      }
                      // Set default date/time to current date and time
                      const now = new Date();
                      const defaultDate = now.toISOString().split('T')[0];
                      const defaultTime = now.toTimeString().slice(0, 5);
                      setBulkScheduleDate(defaultDate);
                      setBulkScheduleTime(defaultTime);
                      setShowBulkScheduleDialog(true);
                    }}
                    className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors active:scale-95"
                  >
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline">Bulk Schedule</span>
                    <span className="xs:hidden">Schedule</span>
                  </button>
                )}

                {/* Change Post Type */}
                <div className="relative group">
                  <button className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors active:scale-95">
                    <Edit3 className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline">Change Type</span>
                    <span className="xs:hidden">Type</span>
                  </button>
                  <div className="absolute right-0 mt-2 w-40 sm:w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    {['POST', 'REEL', 'STORY'].map(type => (
                      <button
                        key={type}
                        onClick={async () => {
                          if (!confirm(`Change ${selectedPostIds.length} posts to ${type}?`)) return;
                          try {
                            for (const postId of selectedPostIds) {
                              await updateInstagramPost(postId, { postType: type as any } as any);
                            }
                            setPosts(posts.map(p => 
                              selectedPostIds.includes(p.id) ? { ...p, type: type as any } : p
                            ));
                            setSelectedPostIds([]);
                            toast.success(`Changed to ${type}!`);
                          } catch (error) {
                            toast.error('Failed to change type');
                          }
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm first:rounded-t-lg last:rounded-b-lg"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bulk Delete */}
                {(canDeleteAny(userRole) || selectedPostIds.every(id => {
                  const post = posts.find(p => p.id === id);
                  return post?.status === 'DRAFT';
                })) && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Remove ${selectedPostIds.length} posts from feed preview?\n\nFiles will be moved back to their original folders.`)) return;
                      try {
                        for (const postId of selectedPostIds) {
                          const post = posts.find(p => p.id === postId);
                          if (post) {
                            await handleDeletePost(post);
                          }
                        }
                        setSelectedPostIds([]);
                        toast.success(`${selectedPostIds.length} posts removed and files restored!`);
                      } catch (error) {
                        toast.error('Failed to remove some posts');
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove All
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-200px)]">
        {/* Main Content Area */}
        <div className={`flex-1 overflow-y-auto p-3 sm:p-6 ${
          showMediaLibrary ? 'hidden lg:block' : 'block'
        }`}>
          {view === "grid" ? (
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                  Feed Preview
                </h2>
                {/* Mobile toggle button for media library */}
                <button
                  onClick={() => setShowMediaLibrary(true)}
                  className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors active:scale-95"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Add Images
                </button>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-6 max-w-4xl mx-auto border border-gray-200 dark:border-gray-700">
                {postsLoading ? (
                  // Skeleton Loader
                  <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
                    {[...Array(9)].map((_, i) => (
                      <div
                        key={i}
                        className="relative aspect-square bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600"></div>
                      </div>
                    ))}
                  </div>
                ) : getFilteredPosts().length === 0 ? (
                  <div className="text-center py-16">
                    <Grid3x3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      {posts.length === 0 ? "No posts in queue" : "No posts match your filters"}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {posts.length === 0 
                        ? "Add images from your Google Drive library to start building your Instagram feed."
                        : "Try adjusting your filters or search query to see more posts."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
                    {getFilteredPosts().map((post) => (
                      <div
                        key={post.id}
                        id={`post-${post.id}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, post)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, post)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, post)}
                        onClick={() => setSelectedPost(post)}
                        className={`relative aspect-square cursor-move group overflow-hidden bg-gray-100 dark:bg-gray-700 transition-all ${
                          dragOverPost === post.id
                            ? "ring-4 ring-blue-500 ring-opacity-50 scale-105"
                            : ""
                        } ${
                          selectedPostIds.includes(post.id)
                            ? "ring-2 ring-green-500"
                            : ""
                        }`}
                      >
                        {/* Selection Checkbox */}
                        <div 
                          className="absolute top-1 sm:top-2 left-1 sm:left-2 z-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedPostIds.includes(post.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPostIds([...selectedPostIds, post.id]);
                              } else {
                                setSelectedPostIds(selectedPostIds.filter(id => id !== post.id));
                              }
                            }}
                            className="w-4 h-4 sm:w-5 sm:h-5 rounded cursor-pointer accent-green-600 shadow-lg"
                          />
                        </div>

                        {!post.image ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
                          </div>
                        ) : post.type === "REEL" ? (
                          <video
                            src={post.image}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            muted
                            playsInline
                            onMouseEnter={(e) =>
                              (e.target as HTMLVideoElement).play()
                            }
                            onMouseLeave={(e) => {
                              const video = e.target as HTMLVideoElement;
                              video.pause();
                              video.currentTime = 0;
                            }}
                          />
                        ) : (
                          <img
                            src={post.image}
                            alt={`Post ${post.id}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        )}
                        {/* VIDEO Indicator - Top Right Corner */}
                        {post.type === "REEL" && (
                          <div className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold shadow-lg flex items-center gap-0.5 sm:gap-1 z-10">
                            <Video className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            <span className="hidden xs:inline">VIDEO</span>
                          </div>
                        )}
                        {/* Status Badge - Top Right, below VIDEO indicator if present */}
                        <div
                          className={`absolute ${post.type === "REEL" ? "top-8 sm:top-10" : "top-1 sm:top-2"} right-1 sm:right-2 ${getStatusColor(
                            post.status,
                            !!post.rejectedAt
                          )} text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full z-10`}
                        >
                          {getStatusText(post.status, !!post.rejectedAt)}
                        </div>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPost(post);
                              }}
                              className="bg-white text-gray-900 p-1.5 sm:p-2 rounded-full hover:bg-gray-100 transition-colors active:scale-95"
                              title="Edit post"
                            >
                              <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Content Queue
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <QueueTimelineView
                  posts={posts.map((p) => {
                    const driveFileId = p.driveFileId ?? null;
                    const awsS3Url = p.awsS3Url ?? (driveFileId ? p.image : null);

                    return {
                      id: p.id,
                      clerkId: currentUserId,
                      profileId: p.profileId,
                      driveFileId,
                      driveFileUrl: driveFileId ? p.image : null,
                      awsS3Key: p.awsS3Key ?? null,
                      awsS3Url,
                      fileName: p.fileName,
                      caption: p.caption,
                      scheduledDate: p.date || null,
                      status: p.status,
                      postType: p.type,
                      folder: p.originalFolder,
                      originalFolder: p.originalFolder,
                      order: p.order,
                      mimeType: p.mimeType ?? null,
                      rejectedAt: p.rejectedAt ?? null,
                      rejectionReason: p.rejectionReason ?? null,
                      rejectedBy: p.rejectedBy ?? null,
                      instagramUrl: p.instagramUrl ?? null,
                      publishedAt: p.publishedAt ?? null,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      image: p.image,
                    };
                  })}
                  onEditPost={(queuePost) => {
                    // Convert back to Post type
                    const post = posts.find((p) => p.id === queuePost.id);
                    if (post) setSelectedPost(post);
                  }}
                  onDeletePost={async (postId) => {
                    const post = posts.find((p) => p.id === postId);
                    if (post) await handleDeletePost(post);
                  }}
                  onStatusChange={async (postId, newStatus) => {
                    const post = posts.find((p) => p.id === postId);
                    if (!post) return;

                    try {
                      const updatedPost = { ...post, status: newStatus };
                      await updatePost(updatedPost);
                      console.log(`✅ Status updated to ${newStatus}`);
                    } catch (error) {
                      console.error("❌ Failed to update status:", error);
                      toast.error("Failed to update status. Please try again.");
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Editor or Library */}
        <div className={`${
          showMediaLibrary ? 'fixed inset-0 z-50 lg:relative lg:inset-auto' : 'hidden'
        } lg:block lg:w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto`}>
          {/* Mobile overlay backdrop */}
          {showMediaLibrary && (
            <div 
              className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm -z-10"
              onClick={() => setShowMediaLibrary(false)}
            />
          )}
          
          {/* Sidebar content wrapper for mobile slide-in */}
          <div className={`${
            showMediaLibrary ? 'lg:relative absolute inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-gray-800 shadow-2xl' : ''
          } lg:w-full h-full overflow-y-auto`}>
            {/* Mobile close button */}
            {!selectedPost && (
              <div className="lg:hidden sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Add Images to Feed
                </h3>
                <button
                  onClick={() => setShowMediaLibrary(false)}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            
          {selectedPost ? (
            <div className="p-3 sm:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                  Edit Post
                </h3>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 active:scale-95"
                >
                  ✕
                </button>
              </div>

              {!selectedPost.image ? (
                <div className="w-full aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center mb-4">
                  <RefreshCw className="w-12 h-12 text-gray-400 animate-spin" />
                </div>
              ) : selectedPost.type === "REEL" ? (
                <video
                  src={selectedPost.image}
                  controls
                  className="w-full aspect-square object-cover rounded-lg mb-4"
                  playsInline
                />
              ) : (
                <img
                  src={selectedPost.image}
                  alt=""
                  className="w-full aspect-square object-cover rounded-lg mb-4"
                />
              )}

              {/* Rejection Notice */}
              {selectedPost.rejectedAt && selectedPost.rejectionReason && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
                        Post Rejected
                      </h4>
                      <p className="text-sm text-red-800 dark:text-red-300 mb-2">
                        {selectedPost.rejectionReason}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400">
                        Rejected{" "}
                        {new Date(selectedPost.rejectedAt).toLocaleDateString()}{" "}
                        at{" "}
                        {new Date(selectedPost.rejectedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Caption
                  </label>
                  <textarea
                    className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={6}
                    placeholder="Write your caption here... Use #hashtags and @mentions"
                    value={selectedPost.caption}
                    onChange={(e) => {
                      const updatedPost = {
                        ...selectedPost,
                        caption: e.target.value,
                      };
                      updatePost(updatedPost);
                    }}
                  />
                  <div className="flex items-center justify-between text-xs mt-1">
                    <div className="text-gray-500 dark:text-gray-400">
                      💡 Tip: Use <span className="text-blue-500">#hashtags</span> and <span className="text-purple-500">@mentions</span>
                    </div>
                    <div className={`font-medium ${
                      selectedPost.caption.length > 2200 ? 'text-red-500' :
                      selectedPost.caption.length > 2000 ? 'text-yellow-500' :
                      'text-gray-500 dark:text-gray-400'
                    }`}>
                      {selectedPost.caption.length} / 2,200 characters
                      {selectedPost.caption.length > 2200 && ' ⚠️ Too long!'}
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
                        className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={selectedPost.date.split('T')[0]}
                        onChange={(e) => {
                          const currentTime = selectedPost.date.split('T')[1] || '12:00';
                          const updatedPost = {
                            ...selectedPost,
                            date: `${e.target.value}T${currentTime}`,
                          };
                          updatePost(updatedPost);
                        }}
                      />
                    </div>

                    {/* Time Picker */}
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Time
                      </label>
                      <input
                        type="time"
                        className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={selectedPost.date.split('T')[1] || '12:00'}
                        onChange={(e) => {
                          const currentDate = selectedPost.date.split('T')[0];
                          const updatedPost = {
                            ...selectedPost,
                            date: `${currentDate}T${e.target.value}`,
                          };
                          updatePost(updatedPost);
                        }}
                      />
                    </div>
                  </div>

                  {/* Quick Time Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const now = new Date();
                        now.setHours(now.getHours() + 1);
                        const updatedPost = {
                          ...selectedPost,
                          date: toLocalDateTimeString(now),
                        };
                        updatePost(updatedPost);
                      }}
                      className="px-3 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                    >
                      +1 Hour
                    </button>
                    <button
                      onClick={() => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        tomorrow.setHours(12, 0, 0, 0);
                        const updatedPost = {
                          ...selectedPost,
                          date: toLocalDateTimeString(tomorrow),
                        };
                        updatePost(updatedPost);
                      }}
                      className="px-3 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                    >
                      Tomorrow 12pm
                    </button>
                    <button
                      onClick={() => {
                        const nextWeek = new Date();
                        nextWeek.setDate(nextWeek.getDate() + 7);
                        nextWeek.setHours(12, 0, 0, 0);
                        const updatedPost = {
                          ...selectedPost,
                          date: toLocalDateTimeString(nextWeek),
                        };
                        updatePost(updatedPost);
                      }}
                      className="px-3 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                    >
                      Next Week
                    </button>
                  </div>

                  {/* Formatted Display */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {selectedPost.status === 'SCHEDULED' ? 'Will publish on' : 'Schedule for'}:
                      </span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {new Date(selectedPost.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                        {' at '}
                        {new Date(selectedPost.date).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>
                    {selectedPost.status === 'SCHEDULED' && new Date(selectedPost.date) > new Date() && (
                      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        {(() => {
                          const diff = new Date(selectedPost.date).getTime() - new Date().getTime();
                          const hours = Math.floor(diff / (1000 * 60 * 60));
                          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                          
                          if (hours < 24) {
                            return `⏱️ Publishing in ${hours}h ${minutes}m`;
                          } else {
                            const days = Math.floor(hours / 24);
                            return `⏱️ Publishing in ${days} day${days > 1 ? 's' : ''}`;
                          }
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Instagram Post Link (for Published posts) */}
                {selectedPost.status === "PUBLISHED" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Instagram Post
                    </label>
                    {selectedPost.instagramUrl ? (
                      <a
                        href={selectedPost.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800 hover:shadow-md transition-all group"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            View on Instagram
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {selectedPost.instagramUrl}
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ) : (
                      <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          📎 No Instagram URL added yet
                        </p>
                        <button
                          onClick={() => {
                            setPublishingPost(selectedPost);
                            setInstagramUrl("");
                            setShowPublishDialog(true);
                          }}
                          className="mt-2 text-xs text-purple-600 dark:text-purple-400 hover:underline"
                        >
                          + Add Instagram URL
                        </button>
                      </div>
                    )}
                    {selectedPost.publishedAt && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        📅 Published on {new Date(selectedPost.publishedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`${getStatusColor(
                        selectedPost.status,
                        !!selectedPost.rejectedAt
                      )} text-white text-xs px-3 py-1 rounded-full font-medium`}
                    >
                      {getStatusText(
                        selectedPost.status,
                        !!selectedPost.rejectedAt
                      )}
                    </span>
                    <span className="text-xs text-gray-500">({userRole})</span>
                  </div>

                  {/* Workflow Progress Bar */}
                  <div className="flex items-center gap-1 mb-4">
                    <div
                      className={`flex-1 h-1 rounded ${
                        selectedPost.status === "DRAFT" ||
                        selectedPost.status === "REVIEW" ||
                        selectedPost.status === "APPROVED" ||
                        selectedPost.status === "SCHEDULED" ||
                        selectedPost.status === "PUBLISHED"
                          ? "bg-blue-500"
                          : "bg-gray-300"
                      }`}
                    />
                    <div
                      className={`flex-1 h-1 rounded ${
                        selectedPost.status === "REVIEW" ||
                        selectedPost.status === "APPROVED" ||
                        selectedPost.status === "SCHEDULED" ||
                        selectedPost.status === "PUBLISHED"
                          ? "bg-yellow-500"
                          : "bg-gray-300"
                      }`}
                    />
                    <div
                      className={`flex-1 h-1 rounded ${
                        selectedPost.status === "APPROVED" ||
                        selectedPost.status === "SCHEDULED" ||
                        selectedPost.status === "PUBLISHED"
                          ? "bg-green-500"
                          : "bg-gray-300"
                      }`}
                    />
                    <div
                      className={`flex-1 h-1 rounded ${
                        selectedPost.status === "SCHEDULED" ||
                        selectedPost.status === "PUBLISHED"
                          ? "bg-purple-500"
                          : "bg-gray-300"
                      }`}
                    />
                    <div
                      className={`flex-1 h-1 rounded ${
                        selectedPost.status === "PUBLISHED"
                          ? "bg-pink-500"
                          : "bg-gray-300"
                      }`}
                    />
                  </div>

                  {/* Workflow Action Buttons */}
                  <div className="space-y-2">
                    {selectedPost.status === "DRAFT" &&
                      canSubmitForReview(userRole) && (
                        <button
                          onClick={() => handleSubmitForReview(selectedPost)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                          <Send size={16} />
                          Submit for Review
                        </button>
                      )}

                    {selectedPost.status === "REVIEW" && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          {canApprove(userRole) && (
                            <>
                              <button
                                onClick={() => handleApprove(selectedPost)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                              >
                                <CheckCircle size={16} />
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(selectedPost)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
                              >
                                <X size={16} />
                                Reject
                              </button>
                            </>
                          )}
                          {!canApprove(userRole) && (
                            <div className="text-sm text-gray-500 italic text-center py-2">
                              Waiting for Manager/Admin approval
                            </div>
                          )}
                        </div>
                        {/* Backward action for REVIEW */}
                        {canSubmitForReview(userRole) && (
                          <button
                            onClick={() => handleRevertToDraft(selectedPost)}
                            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-xs"
                          >
                            <ArrowLeft size={14} />
                            Back to Draft
                          </button>
                        )}
                      </div>
                    )}

                    {selectedPost.status === "APPROVED" &&
                      canSchedule(userRole) && (
                        <div className="space-y-2">
                          <button
                            onClick={() => handleSchedule(selectedPost)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
                          >
                            <Clock size={16} />
                            Mark as Scheduled
                          </button>
                          {/* Backward action for APPROVED */}
                          {canApprove(userRole) && (
                            <button
                              onClick={() => handleRevertToReview(selectedPost)}
                              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-xs"
                            >
                              <ArrowLeft size={14} />
                              Back to Review
                            </button>
                          )}
                        </div>
                      )}

                    {selectedPost.status === "SCHEDULED" &&
                      canPublish(userRole) && (
                        <div className="space-y-2">
                          <button
                            onClick={() => handleMarkAsPublished(selectedPost)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors text-sm font-medium"
                          >
                            <CheckCircle size={16} />
                            Mark as Published
                          </button>
                          {/* Backward action for SCHEDULED */}
                          {canSchedule(userRole) && (
                            <button
                              onClick={() =>
                                handleRevertToApproved(selectedPost)
                              }
                              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-xs"
                            >
                              <ArrowLeft size={14} />
                              Back to Approved
                            </button>
                          )}
                        </div>
                      )}

                    {selectedPost.status === "PUBLISHED" &&
                      canPublish(userRole) && (
                        <button
                          onClick={() => handleUnpublish(selectedPost)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                          <X size={16} />
                          Revert to Scheduled
                        </button>
                      )}
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setSelectedPost(null)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    Close
                  </button>
                  {(canDeleteAny(userRole) ||
                    selectedPost.status === "DRAFT") && (
                    <button
                      onClick={() => handleDeletePost(selectedPost)}
                      className="p-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete post"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 hidden lg:block">
                Media Library (AWS S3)
              </h3>

              <div className="space-y-3 sm:space-y-4">
                {/* Folder Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Select Folder
                    </span>
                    <button
                      onClick={loadAllFolders}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 disabled:opacity-60"
                      title="Refresh folders"
                      disabled={isLoadingFolders}
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${isLoadingFolders ? "animate-spin" : ""}`}
                      />
                      {isLoadingFolders ? "Refreshing" : "Refresh"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {/* All Folders Option */}
                    <button
                      onClick={() => setSelectedFolder("All Folders")}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        selectedFolder === "All Folders"
                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300"
                          : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4" />
                        <div>
                          <div className="text-xs font-medium">
                            All Folders
                          </div>
                          <div className="text-xs opacity-60">
                            {s3Folders.reduce((sum, folder) => sum + folder.files.length, 0)} files
                          </div>
                        </div>
                      </div>
                    </button>
                    {s3Folders.map((folder) => (
                      <button
                        key={folder.name}
                        onClick={() => setSelectedFolder(folder.name)}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          selectedFolder === folder.name
                            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300"
                            : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FolderOpen className="w-4 h-4" />
                          <div>
                            <div className="text-xs font-medium">
                              {folder.name}
                            </div>
                            <div className="text-xs opacity-60">
                              {folder.loading
                                ? "Loading..."
                                : `${folder.files.length} files`}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status Filter for Media Library */}
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Filter by Status
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {["ALL", "NOT_QUEUED", "QUEUED", "DRAFT", "REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "REJECTED"].map((status) => (
                      <button
                        key={status}
                        onClick={() => setMediaLibraryStatusFilter(status)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          mediaLibraryStatusFilter === status
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                      >
                        {status === "ALL" ? "All Files" : status === "NOT_QUEUED" ? "Not Queued" : status === "QUEUED" ? "Any Queued" : status.charAt(0) + status.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selected Folder Contents */}
                <div>
                  <div className="mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {selectedFolder} Files
                    </span>
                  </div>

                  {(() => {
                    // Handle "All Folders" option
                    if (selectedFolder === "All Folders") {
                      const allFiles = s3Folders.flatMap(folder => folder.files);
                      
                      if (allFiles.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                              No files found in any folder
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                              Upload files from Generated Content tab to see
                              them here
                            </p>
                          </div>
                        );
                      }

                      // Filter files based on media library status filter
                      const filteredFiles = allFiles.filter((file) => {
                        if (mediaLibraryStatusFilter === "ALL") return true;
                        
                        const queuedPost = posts.find(p => p.awsS3Key === file.key);
                        
                        if (mediaLibraryStatusFilter === "NOT_QUEUED") {
                          return !queuedPost;
                        }
                        
                        if (mediaLibraryStatusFilter === "QUEUED") {
                          return !!queuedPost;
                        }
                        
                        if (!queuedPost) {
                          return false;
                        }
                        
                        if (mediaLibraryStatusFilter === "REJECTED") {
                          return queuedPost.status === "DRAFT" && !!queuedPost.rejectedAt;
                        }
                        
                        return queuedPost.status === mediaLibraryStatusFilter;
                      });

                      if (filteredFiles.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <Filter className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                              No files match the selected filter
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                              Try selecting a different status filter
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                          {filteredFiles.map((file) => {
                            const isVideo = file.isVideo || file.mimeType.startsWith("video/");
                            const previewUrl = fileBlobUrls[file.id] || file.url;

                            return (
                              <div
                                key={file.id}
                                className="relative group cursor-pointer"
                              >
                                {isVideo ? (
                                  <video
                                    src={previewUrl}
                                    className="w-full aspect-square object-cover rounded-lg"
                                    muted
                                    playsInline
                                    onMouseEnter={(e) =>
                                      (e.target as HTMLVideoElement).play()
                                    }
                                    onMouseLeave={(e) => {
                                      const video = e.target as HTMLVideoElement;
                                      video.pause();
                                      video.currentTime = 0;
                                    }}
                                  />
                                ) : (
                                  <img
                                    src={previewUrl}
                                    alt={file.name}
                                    className="w-full aspect-square object-cover rounded-lg"
                                    loading="lazy"
                                  />
                                )}

                                {isVideo && (
                                  <div className="absolute top-2 right-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-lg flex items-center gap-1">
                                    <Video className="w-3 h-3" />
                                    VIDEO
                                  </div>
                                )}

                                {/* Status Badge - Small circle indicator if file is queued */}
                                {(() => {
                                  const queuedPost = posts.find(p => p.awsS3Key === file.key);
                                  if (queuedPost) {
                                    const isRejected = !!queuedPost.rejectedAt;
                                    return (
                                      <div
                                        className={`absolute ${isVideo ? "top-10" : "top-2"} right-2 w-3 h-3 rounded-full ${getStatusColor(
                                          queuedPost.status,
                                          isRejected
                                        )} border-2 border-white shadow-lg`}
                                        title={getStatusText(queuedPost.status, isRejected)}
                                      />
                                    );
                                  }
                                  return null;
                                })()}

                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded-lg flex items-center justify-center">
                                  {(() => {
                                    const queuedPost = posts.find(p => p.awsS3Key === file.key);
                                    
                                    if (queuedPost) {
                                      return (
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => {
                                              setSelectedPost(queuedPost);
                                              setView("grid");
                                            }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700 flex items-center gap-1"
                                          >
                                            <Edit3 className="w-3 h-3" />
                                            View Details
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteFileFromLibrary(file);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 text-white p-2 rounded hover:bg-red-700"
                                            title="Delete file"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      );
                                    }
                                    
                                    return (
                                      <div className="flex gap-2">
                                        <button
                                          onClick={async () => {
                                            // Ensure a profile is selected
                                            if (!profileId) {
                                              toast.error('Please select a profile first');
                                              return;
                                            }

                                            try {
                                              const dbPost = await createInstagramPost({
                                                profileId: profileId,
                                                driveFileId: null,
                                                driveFileUrl: null,
                                                awsS3Key: file.key,
                                                awsS3Url: file.url,
                                                fileName: file.name,
                                                caption: "",
                                                status: "DRAFT",
                                                postType: isVideo ? "REEL" : "POST",
                                                folder: "All Folders",
                                                originalFolder: "All Folders",
                                                mimeType: file.mimeType,
                                              });

                                              const newPost: Post = {
                                                id: dbPost.id,
                                                profileId: dbPost.profileId,
                                                image: file.url,
                                                caption: "",
                                                status: "DRAFT",
                                                type: isVideo ? "REEL" : "POST",
                                                date: new Date()
                                                  .toISOString()
                                                  .split("T")[0],
                                                driveFileId: null,
                                                awsS3Key: file.key,
                                                awsS3Url: file.url,
                                                originalFolder: "All Folders",
                                                order: dbPost.order,
                                                fileName: file.name,
                                                mimeType: file.mimeType,
                                              };

                                              // Reload posts from database to ensure sync
                                              await loadPosts();
                                              
                                              toast.success("Added to Instagram queue");
                                            } catch (error) {
                                              console.error("Error adding file to queue:", error);
                                              toast.error("Failed to add file to queue. Please try again.");
                                            }
                                          }}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-gray-900 px-3 py-1 rounded text-xs font-medium hover:bg-gray-100"
                                        >
                                          Add to Queue
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteFileFromLibrary(file);
                                          }}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 text-white p-2 rounded hover:bg-red-700"
                                          title="Delete file"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    );
                                  })()}
                                </div>
                                <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                  {file.name.length > 15
                                    ? file.name.substring(0, 15) + "..."
                                    : file.name}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    // Handle individual folder selection
                    const currentFolder = s3Folders.find(
                      (f) => f.name === selectedFolder
                    );

                    if (!currentFolder) {
                      return (
                        <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                          Folder not found
                        </div>
                      );
                    }

                    if (currentFolder.error) {
                      return (
                        <div className="text-center py-4 text-red-500 dark:text-red-400 text-sm">
                          Error: {currentFolder.error}
                        </div>
                      );
                    }

                    if (currentFolder.loading && currentFolder.files.length === 0) {
                      return (
                        <div className="text-center py-4">
                          <RefreshCw className="w-6 h-6 text-gray-400 mx-auto mb-2 animate-spin" />
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            Loading files...
                          </p>
                        </div>
                      );
                    }

                    if (currentFolder.files.length === 0) {
                      return (
                        <div className="text-center py-8">
                          <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            No files in {selectedFolder}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            Upload files from Generated Content tab to see
                            them here
                          </p>
                        </div>
                      );
                    }

                    // Filter files based on media library status filter
                    const filteredFiles = currentFolder.files.filter((file) => {
                      if (mediaLibraryStatusFilter === "ALL") return true;
                      
                      const queuedPost = posts.find(p => p.awsS3Key === file.key);
                      
                      if (mediaLibraryStatusFilter === "NOT_QUEUED") {
                        return !queuedPost; // Show only files that are NOT queued
                      }
                      
                      if (mediaLibraryStatusFilter === "QUEUED") {
                        return !!queuedPost; // Show any queued file
                      }
                      
                      if (!queuedPost) {
                        return false; // Not queued, so can't match specific statuses
                      }
                      
                      // Check if post is rejected
                      if (mediaLibraryStatusFilter === "REJECTED") {
                        return queuedPost.status === "DRAFT" && !!queuedPost.rejectedAt;
                      }
                      
                      return queuedPost.status === mediaLibraryStatusFilter;
                    });

                    if (filteredFiles.length === 0) {
                      return (
                        <div className="text-center py-8">
                          <Filter className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            No files match the selected filter
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            Try selecting a different status filter
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                        {filteredFiles.map((file) => {
                          const isVideo = file.isVideo || file.mimeType.startsWith("video/");
                          const previewUrl = fileBlobUrls[file.id] || file.url;

                          return (
                            <div
                              key={file.id}
                              className="relative group cursor-pointer"
                            >
                              {isVideo ? (
                                <video
                                  src={previewUrl}
                                  className="w-full aspect-square object-cover rounded-lg"
                                  muted
                                  playsInline
                                  onMouseEnter={(e) =>
                                    (e.target as HTMLVideoElement).play()
                                  }
                                  onMouseLeave={(e) => {
                                    const video = e.target as HTMLVideoElement;
                                    video.pause();
                                    video.currentTime = 0;
                                  }}
                                />
                              ) : (
                                <img
                                  src={previewUrl}
                                  alt={file.name}
                                  className="w-full aspect-square object-cover rounded-lg"
                                  loading="lazy"
                                />
                              )}

                              {isVideo && (
                                <div className="absolute top-2 right-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-lg flex items-center gap-1">
                                  <Video className="w-3 h-3" />
                                  VIDEO
                                </div>
                              )}

                              {/* Status Badge - Small circle indicator if file is queued */}
                              {(() => {
                                const queuedPost = posts.find(p => p.awsS3Key === file.key);
                                if (queuedPost) {
                                  const isRejected = !!queuedPost.rejectedAt;
                                  return (
                                    <div
                                      className={`absolute ${isVideo ? "top-10" : "top-2"} right-2 w-3 h-3 rounded-full ${getStatusColor(
                                        queuedPost.status,
                                        isRejected
                                      )} border-2 border-white shadow-lg`}
                                      title={getStatusText(queuedPost.status, isRejected)}
                                    />
                                  );
                                }
                                return null;
                              })()}

                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded-lg flex items-center justify-center gap-2">
                                {(() => {
                                  const queuedPost = posts.find(p => p.awsS3Key === file.key);
                                  
                                  if (queuedPost) {
                                    // If already queued, show "View Details" button + delete button
                                    return (
                                      <>
                                        <button
                                          onClick={() => {
                                            setSelectedPost(queuedPost);
                                            setView("grid");
                                          }}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700 flex items-center gap-1"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                          View Details
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteFileFromLibrary(file);
                                          }}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 text-white p-2 rounded text-xs font-medium hover:bg-red-700"
                                          title="Delete file"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </>
                                    );
                                  }
                                  
                                  // Not queued yet, show "Add to Queue" button + delete button
                                  return (
                                    <>
                                      <button
                                        onClick={async () => {
                                          // Ensure a profile is selected
                                          if (!profileId) {
                                            toast.error('Please select a profile first');
                                            return;
                                          }

                                          try {
                                            // Keep file in original location - no longer moving to status folders
                                            // Create Instagram post with existing S3 location
                                            const dbPost = await createInstagramPost({
                                              profileId: profileId,
                                              driveFileId: null,
                                              driveFileUrl: null,
                                              awsS3Key: file.key,
                                              awsS3Url: file.url,
                                              fileName: file.name,
                                              caption: "",
                                              status: "DRAFT",
                                              postType: isVideo ? "REEL" : "POST",
                                              folder: selectedFolder,
                                              originalFolder: selectedFolder,
                                              mimeType: file.mimeType,
                                            });

                                            const newPost: Post = {
                                              id: dbPost.id,
                                              profileId: dbPost.profileId,
                                              image: file.url,
                                              caption: "",
                                              status: "DRAFT",
                                              type: isVideo ? "REEL" : "POST",
                                              date: new Date()
                                                .toISOString()
                                                .split("T")[0],
                                              driveFileId: null,
                                              awsS3Key: file.key,
                                              awsS3Url: file.url,
                                              originalFolder: selectedFolder,
                                              order: dbPost.order,
                                              fileName: file.name,
                                              mimeType: file.mimeType,
                                            };

                                            // Reload posts from database to ensure sync
                                            await loadPosts();
                                            
                                            toast.success("Added to Instagram queue");
                                          } catch (error) {
                                            console.error("Error adding file to queue:", error);
                                            toast.error("Failed to add file to queue. Please try again.");
                                          }
                                        }}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-gray-900 px-3 py-1 rounded text-xs font-medium hover:bg-gray-100"
                                      >
                                        Add to Queue
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteFileFromLibrary(file);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 text-white p-2 rounded text-xs font-medium hover:bg-red-700"
                                        title="Delete file"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </>
                                  );
                                })()}
                              </div>
                              <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                {file.name.length > 15
                                  ? file.name.substring(0, 15) + "..."
                                  : file.name}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Rejection Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <X className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Reject Post
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Provide a reason for rejection
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="E.g., Image quality is too low, Caption needs improvement, Wrong format..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowRejectDialog(false);
                      setRejectingPost(null);
                      setRejectionReason("");
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmReject}
                    disabled={!rejectionReason.trim()}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reject Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Publish Dialog */}
      {showPublishDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Mark as Published
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {publishingPost?.fileName}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Instagram Post URL <span className="text-gray-400 text-xs">(Optional)</span>
                  </label>
                  <input
                    type="url"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    placeholder="https://www.instagram.com/p/..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    autoFocus
                  />
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    💡 Paste the link to your published Instagram post to track it later
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowPublishDialog(false);
                      setPublishingPost(null);
                      setInstagramUrl("");
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmPublish}
                    className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium"
                  >
                    Mark as Published ✓
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Schedule Dialog */}
      {showBulkScheduleDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Bulk Schedule Posts
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {posts.filter(p => selectedPostIds.includes(p.id) && p.status === 'APPROVED').length} approved post(s) will be scheduled
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    📅 Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={bulkScheduleDate}
                    onChange={(e) => setBulkScheduleDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    🕐 Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={bulkScheduleTime}
                    onChange={(e) => setBulkScheduleTime(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {bulkScheduleDate && bulkScheduleTime && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded-lg">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      📌 Scheduled for:
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                      {new Date(`${bulkScheduleDate}T${bulkScheduleTime}`).toLocaleString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowBulkScheduleDialog(false);
                      setBulkScheduleDate("");
                      setBulkScheduleTime("");
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmBulkSchedule}
                    disabled={!bulkScheduleDate || !bulkScheduleTime}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    Schedule Posts
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Dialog */}
      {showUploadDialog && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Upload Files
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Upload photos or videos to AWS S3
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Folder Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Destination Folder <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={uploadFolder}
                    onChange={(e) => setUploadFolder(e.target.value)}
                    disabled={isUploading}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {S3_UPLOAD_FOLDERS.map((folder) => (
                      <option key={folder.prefix} value={folder.prefix}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    💡 Files will be saved in your user folder: {uploadFolder}{currentUserId}/
                  </p>
                </div>

                {/* File Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Files <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setUploadFiles(files);
                    }}
                    disabled={isUploading}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300 dark:hover:file:bg-blue-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {uploadFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Selected Files ({uploadFiles.length}):
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {uploadFiles.map((file, index) => (
                          <div key={index} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            {file.type.startsWith('image/') ? (
                              <ImageIcon className="w-3 h-3 text-blue-500" />
                            ) : (
                              <Video className="w-3 h-3 text-purple-500" />
                            )}
                            <span className="truncate">{file.name}</span>
                            <span className="text-gray-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload Progress */}
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">Uploading...</span>
                      <span className="text-blue-600 dark:text-blue-400 font-medium">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowUploadDialog(false);
                      setUploadFiles([]);
                      setUploadProgress(0);
                    }}
                    disabled={isUploading}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploadFiles.length === 0 || isUploading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload {uploadFiles.length > 0 && `(${uploadFiles.length})`}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default InstagramStagingTool;
