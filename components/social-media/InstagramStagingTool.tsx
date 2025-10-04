"use client";

import React, { useState, useEffect } from "react";
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
  Users,
  ArrowLeft,
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
import QueueTimelineView from "./QueueTimelineView";
import WorkflowGuide from "./WorkflowGuide";
import { ExportButton } from "./ExportButton";
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
  driveFileId: string;
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

interface GoogleDriveFile {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink: string;
  thumbnailLink?: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
}

interface GoogleDriveFolder {
  name: string;
  id: string;
  files: GoogleDriveFile[];
  loading: boolean;
  error?: string;
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

const InstagramStagingTool = () => {
  const { user, isLoaded } = useUser();
  const currentUserId = user?.id || "";

  // Fetch user role from database instead of Clerk metadata
  const [userRole, setUserRole] = useState<UserRole>("USER");
  const [roleLoading, setRoleLoading] = useState(true);

  const [view, setView] = useState<"grid" | "queue">("grid");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(
    null
  );
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [selectedFolder, setSelectedFolder] =
    useState<string>("All Generations");
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

  // Google Drive folders with their IDs from env
  const [driveFolders, setDriveFolders] = useState<GoogleDriveFolder[]>([
    {
      name: "All Generations",
      id: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_ALL_GENERATIONS_FOLDER_ID || "",
      files: [],
      loading: false,
    },
    {
      name: "IG Posts",
      id: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_IG_POSTS_FOLDER_ID || "",
      files: [],
      loading: false,
    },
    {
      name: "IG Reels",
      id: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_IG_REELS_FOLDER_ID || "",
      files: [],
      loading: false,
    },
    {
      name: "Misc",
      id: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_MISC_FOLDER_ID || "",
      files: [],
      loading: false,
    },
  ]);

  // Check for OAuth token on component mount
  useEffect(() => {
    // First check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get("access_token");

    if (accessToken) {
      setGoogleAccessToken(accessToken);
      // Store in localStorage for persistence across tabs/pages
      localStorage.setItem("google_drive_access_token", accessToken);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      console.log("✅ Google Drive access token received and stored");
    } else {
      // Check localStorage for existing token
      const storedToken = localStorage.getItem("google_drive_access_token");
      if (storedToken) {
        setGoogleAccessToken(storedToken);
        console.log("✅ Google Drive access token loaded from storage");
      }
    }

    // Handle OAuth errors
    const error = urlParams.get("error");
    if (error) {
      console.error("❌ OAuth error:", error);
      alert(`Google Drive authentication failed: ${error}`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Load posts from database on mount
  useEffect(() => {
    const loadPosts = async () => {
      try {
        // Admin/Manager can view specific user's posts, otherwise view own posts
        const userIdToFetch =
          (userRole === "ADMIN" || userRole === "MANAGER") && selectedUserId
            ? selectedUserId
            : undefined;

        const dbPosts = await fetchInstagramPosts(userIdToFetch);
        // Convert database posts to component format
        const convertedPosts: Post[] = dbPosts.map((dbPost) => ({
          id: dbPost.id,
          image: "", // Will be loaded via blob URL
          caption: dbPost.caption,
          status: dbPost.status,
          type: dbPost.postType,
          date: dbPost.scheduledDate
            ? toLocalDateTimeString(dbPost.scheduledDate)
            : "", // Keep empty if no scheduled date (don't default to now)
          driveFileId: dbPost.driveFileId,
          originalFolder: dbPost.folder,
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
        console.log(`✅ Loaded ${convertedPosts.length} posts from database`);
      } catch (error) {
        console.error("❌ Error loading posts from database:", error);
      }
    };

    loadPosts();
  }, [selectedUserId, userRole]); // Reload when selected user changes

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

                const response = await fetch(`/api/instagram-posts?${params}`);
                const result = await response.json();

                if (result.success && result.posts) {
                  setPosts((prev) => {
                    const blobUrls = new Map(prev.map((p) => [p.id, p.image]));
                    return result.posts.map((post: any) => ({
                      id: post.id,
                      image: blobUrls.get(post.id) || post.driveFileUrl,
                      caption: post.caption,
                      status: post.status,
                      type: post.postType,
                      date: post.scheduledDate || post.createdAt,
                      driveFileId: post.driveFileId,
                      originalFolder: post.folder,
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

          const response = await fetch(
            `/api/instagram-posts/changes?${params}`
          );
          const data = await response.json();

          if (data.hasChanges && data.posts) {
            setPosts((prev) => {
              const blobUrls = new Map(prev.map((p) => [p.id, p.image]));
              return data.posts.map((post: any) => ({
                id: post.id,
                image: blobUrls.get(post.id) || post.driveFileUrl,
                caption: post.caption,
                status: post.status,
                type: post.postType,
                date: post.scheduledDate || post.createdAt,
                driveFileId: post.driveFileId,
                originalFolder: post.folder,
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
  }, [isLoaded, user, selectedUserId]);

  // Load blob URLs for posts from Google Drive
  useEffect(() => {
    const loadPostBlobUrls = async () => {
      if (!googleAccessToken) return;

      for (const post of posts) {
        if (post.driveFileId && !post.image) {
          try {
            const downloadUrl = `https://www.googleapis.com/drive/v3/files/${post.driveFileId}?alt=media`;
            const response = await fetch(downloadUrl, {
              headers: {
                Authorization: `Bearer ${googleAccessToken}`,
              },
            });

            if (response.ok) {
              const blob = await response.blob();
              const blobUrl = URL.createObjectURL(blob);
              setPosts((prev) =>
                prev.map((p) =>
                  p.id === post.id ? { ...p, image: blobUrl } : p
                )
              );
            }
          } catch (error) {
            console.error(`Error loading blob for post ${post.id}:`, error);
          }
        }
      }
    };

    loadPostBlobUrls();
  }, [posts.length, googleAccessToken]);

  // Load folder contents when access token is available
  useEffect(() => {
    if (googleAccessToken) {
      loadAllFolders();
    }
  }, [googleAccessToken]);

  // Download and create blob URLs for files in current folder
  useEffect(() => {
    const downloadFilesForPreview = async () => {
      const currentFolder = driveFolders.find((f) => f.name === selectedFolder);
      if (!currentFolder || !googleAccessToken) return;

      const filesToDownload = currentFolder.files.filter(
        (file) => !fileBlobUrls[file.id]
      );

      for (const file of filesToDownload) {
        try {
          const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
          const response = await fetch(downloadUrl, {
            headers: {
              Authorization: `Bearer ${googleAccessToken}`,
            },
          });

          if (response.ok) {
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            setFileBlobUrls((prev) => ({ ...prev, [file.id]: blobUrl }));
          }
        } catch (error) {
          console.error(`Error downloading file ${file.name}:`, error);
        }
      }
    };

    downloadFilesForPreview();
  }, [selectedFolder, driveFolders, googleAccessToken]);

  const authenticateGoogleDrive = async () => {
    try {
      setIsAuthenticating(true);
      // Pass current page as redirect parameter
      const currentPage = "/workspace/social-media";
      const response = await fetch(
        `/api/auth/google?redirect=${encodeURIComponent(currentPage)}`
      );
      const data = await response.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error("Failed to get authorization URL");
      }
    } catch (error) {
      console.error("Authentication error:", error);
      alert("Failed to start Google Drive authentication");
      setIsAuthenticating(false);
    }
  };

  const loadFolderContents = async (folderId: string, folderName: string) => {
    if (!googleAccessToken) return;

    // Update loading state
    setDriveFolders((prev) =>
      prev.map((folder) =>
        folder.name === folderName
          ? { ...folder, loading: true, error: undefined }
          : folder
      )
    );

    try {
      console.log(`📂 Loading ${folderName} (ID: ${folderId})...`);
      const response = await fetch(
        `/api/google-drive/files?folderId=${folderId}&accessToken=${encodeURIComponent(
          googleAccessToken
        )}`
      );

      if (!response.ok) {
        // Check if it's an authentication error
        if (response.status === 401 || response.status === 403) {
          throw new Error(
            "Authentication expired. Please reconnect to Google Drive."
          );
        }
        throw new Error(
          `Failed to load folder contents: ${response.statusText}`
        );
      }

      const data = await response.json();

      // Check if the response contains an error (even with 200 status)
      if (data.error && data.error.includes("authentication")) {
        throw new Error(
          "Authentication expired. Please reconnect to Google Drive."
        );
      }

      console.log(
        `✅ Loaded ${data.files?.length || 0} files from ${folderName}`
      );
      console.log(
        "📋 Files received:",
        data.files?.map((f: any) => `${f.name} (${f.mimeType})`)
      );

      // Update folder with files
      setDriveFolders((prev) =>
        prev.map((folder) =>
          folder.name === folderName
            ? { ...folder, files: data.files || [], loading: false }
            : folder
        )
      );
    } catch (error) {
      console.error(`❌ Error loading ${folderName}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load";

      // If it's an auth error, clear the token to show reconnect button
      if (
        errorMessage.includes("Authentication expired") ||
        errorMessage.includes("authentication")
      ) {
        setGoogleAccessToken(null);
        localStorage.removeItem("google_drive_access_token");
      }

      setDriveFolders((prev) =>
        prev.map((folder) =>
          folder.name === folderName
            ? { ...folder, loading: false, error: errorMessage }
            : folder
        )
      );
    }
  };

  const loadAllFolders = async () => {
    for (const folder of driveFolders) {
      if (folder.id) {
        await loadFolderContents(folder.id, folder.name);
      }
    }
  };

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
      });
      console.log(`✅ Updated post ${updatedPost.id} in database`);
    } catch (error) {
      console.error("❌ Error updating post in database:", error);
      alert("Failed to save changes. Please try again.");
    }
  };

  // Handle workflow status changes
  const handleStatusChange = async (
    post: Post,
    newStatus: InstagramPost["status"]
  ) => {
    const updatedPost = { ...post, status: newStatus };
    await updatePost(updatedPost);
  };

  // Workflow action buttons
  const handleSubmitForReview = async (post: Post) => {
    if (!canSubmitForReview(userRole)) {
      alert("You don't have permission to submit posts for review.");
      return;
    }
    await handleStatusChange(post, "REVIEW");
  };

  const handleApprove = async (post: Post) => {
    if (!canApprove(userRole)) {
      alert("You don't have permission to approve posts.");
      return;
    }
    await handleStatusChange(post, "APPROVED");
  };

  const handleReject = async (post: Post) => {
    if (!canApprove(userRole)) {
      alert("You don't have permission to reject posts.");
      return;
    }
    // Show rejection dialog
    setRejectingPost(post);
    setRejectionReason("");
    setShowRejectDialog(true);
  };

  const confirmReject = async () => {
    if (!rejectingPost || !rejectionReason.trim()) {
      alert("Please provide a reason for rejection.");
      return;
    }

    try {
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
    } catch (error) {
      console.error("❌ Error rejecting post:", error);
      alert("Failed to reject post. Please try again.");
    }
  };

  const confirmPublish = async () => {
    if (!publishingPost) return;

    try {
      const now = new Date().toISOString();
      const hasUrl = instagramUrl.trim().length > 0;
      
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
    } catch (error) {
      console.error("❌ Error marking post as published:", error);
      alert("Failed to mark post as published. Please try again.");
    }
  };

  const handleSchedule = async (post: Post) => {
    if (!canSchedule(userRole)) {
      alert("You don't have permission to schedule posts.");
      return;
    }
    if (!post.date) {
      alert("Please set a scheduled date before marking as scheduled.");
      return;
    }
    await handleStatusChange(post, "SCHEDULED");
  };

  const handleMarkAsPublished = async (post: Post) => {
    if (!canPublish(userRole)) {
      alert("You don't have permission to mark posts as published.");
      return;
    }
    // Show dialog to enter Instagram URL
    setPublishingPost(post);
    setInstagramUrl(post.instagramUrl || "");
    setShowPublishDialog(true);
  };

  const handleUnpublish = async (post: Post) => {
    if (!canPublish(userRole)) {
      alert("You don't have permission to unpublish posts.");
      return;
    }
    if (confirm(`Revert "${post.fileName}" to scheduled status?`)) {
      await handleStatusChange(post, "SCHEDULED");
    }
  };

  // Backward workflow actions
  const handleRevertToApproved = async (post: Post) => {
    if (!canSchedule(userRole)) {
      alert("You don't have permission to revert scheduled posts.");
      return;
    }
    if (confirm(`Revert "${post.fileName}" back to approved status?`)) {
      await handleStatusChange(post, "APPROVED");
    }
  };

  const handleRevertToReview = async (post: Post) => {
    if (!canApprove(userRole)) {
      alert("You don't have permission to send posts back to review.");
      return;
    }
    if (confirm(`Send "${post.fileName}" back to review?`)) {
      await handleStatusChange(post, "REVIEW");
    }
  };

  const handleRevertToDraft = async (post: Post) => {
    if (!canSubmitForReview(userRole)) {
      alert("You don't have permission to revert posts to draft.");
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
      alert("Failed to save order. Please try again.");
    }
  };

  // Delete post function
  const handleDeletePost = async (post: Post) => {
    const deleteFromDrive = confirm(
      `Delete "${post.fileName}"?\n\nDo you also want to delete it from Google Drive?\n\nClick OK to delete from both database and Google Drive.\nClick Cancel to delete from database only.`
    );

    if (deleteFromDrive === null) return; // User cancelled

    try {
      // Delete from database (and optionally from Google Drive)
      await deleteInstagramPost(post.id, {
        deleteFromDrive: deleteFromDrive,
        accessToken: googleAccessToken || undefined,
      });

      // Remove from local state
      setPosts((prev) => prev.filter((p) => p.id !== post.id));

      // Close editor if this post was selected
      if (selectedPost?.id === post.id) {
        setSelectedPost(null);
      }

      console.log(`✅ Deleted post ${post.id}`);
      alert(
        `Successfully deleted from ${
          deleteFromDrive ? "database and Google Drive" : "database only"
        }`
      );
    } catch (error) {
      console.error("❌ Error deleting post:", error);
      alert("Failed to delete post. Please try again.");
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
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Instagram Content Staging
            </h1>
            {/* Role Badge */}
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
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
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Upload size={18} />
              Import from Drive
            </button>
            
            {/* Export Button with Selection */}
            <div className="flex items-center gap-3">
              {posts.length > 0 && (
                <button
                  onClick={() => {
                    if (selectedPostIds.length === posts.length) {
                      setSelectedPostIds([]);
                    } else {
                      setSelectedPostIds(posts.map(p => p.id));
                    }
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  {selectedPostIds.length === posts.length ? '☐ Deselect All' : '☑ Select All'}
                </button>
              )}
              
              {selectedPostIds.length > 0 && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedPostIds.length} selected
                </span>
              )}
              
              <ExportButton 
                selectedPostIds={selectedPostIds}
                onExportComplete={() => {
                  setSelectedPostIds([]);
                }}
              />
            </div>
          </div>
        </div>

        {/* User Selector for Admin/Manager */}
        {(userRole === "ADMIN" || userRole === "MANAGER") && (
          <div className="mt-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <div className="flex-1 max-w-md">
              <select
                value={selectedUserId || ""}
                onChange={(e) => setSelectedUserId(e.target.value || null)}
                disabled={loadingUsers}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
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
        <div className="flex items-center gap-4 mt-4">
          <div className="flex gap-2">
            <button
              onClick={() => setView("grid")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                view === "grid"
                  ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              <Grid3x3 size={18} />
              Feed Preview
            </button>
            <button
              onClick={() => setView("queue")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                view === "queue"
                  ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              <Calendar size={18} />
              Queue Timeline
            </button>
          </div>

          {/* Workflow Guide */}
          <div className="flex-1 max-w-md">
            <WorkflowGuide userRole={userRole} />
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-200px)]">
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {view === "grid" ? (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Feed Preview
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl mx-auto border border-gray-200 dark:border-gray-700">
                {posts.length === 0 ? (
                  <div className="text-center py-16">
                    <Grid3x3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No posts in queue
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Add images from your Google Drive library to start
                      building your Instagram feed.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1">
                    {posts.map((post) => (
                      <div
                        key={post.id}
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
                          className="absolute top-2 left-2 z-10"
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
                            className="w-5 h-5 rounded cursor-pointer accent-green-600 shadow-lg"
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
                        {/* REEL Indicator - Top Right Corner */}
                        {post.type === "REEL" && (
                          <div className="absolute top-2 right-2 bg-black/70 rounded-full p-1 z-10">
                            <div className="w-4 h-4 border-2 border-white border-l-transparent rounded-full" />
                          </div>
                        )}
                        {/* Status Badge - Top Right, below REEL indicator if present */}
                        <div
                          className={`absolute ${post.type === "REEL" ? "top-10" : "top-2"} right-2 ${getStatusColor(
                            post.status,
                            !!post.rejectedAt
                          )} text-white text-xs px-2 py-1 rounded-full z-10`}
                        >
                          {getStatusText(post.status, !!post.rejectedAt)}
                        </div>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPost(post);
                              }}
                              className="bg-white text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors"
                              title="Edit post"
                            >
                              <Edit3 size={18} />
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (
                                  !confirm(
                                    `Delete "${post.fileName}" from feed?\n\nThis will remove the post from your database. The file will remain in Google Drive.`
                                  )
                                ) {
                                  return;
                                }

                                try {
                                  // Delete from database (but keep in Google Drive)
                                  await deleteInstagramPost(post.id, {
                                    deleteFromDrive: false, // Keep file in Drive
                                  });

                                  // Remove from local state
                                  setPosts((prev) =>
                                    prev.filter((p) => p.id !== post.id)
                                  );

                                  if (selectedPost?.id === post.id) {
                                    setSelectedPost(null);
                                  }

                                  // Revoke blob URL to free memory
                                  if (post.image) {
                                    URL.revokeObjectURL(post.image);
                                  }

                                  console.log(
                                    "✅ Deleted post from database (file remains in Drive)"
                                  );
                                } catch (error) {
                                  console.error(
                                    "❌ Failed to delete post:",
                                    error
                                  );
                                  alert(
                                    "Failed to delete post. Please try again."
                                  );
                                }
                              }}
                              className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition-colors"
                              title="Delete from feed"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                        {/* Status Badge - Top Right */}
                        <div
                          className={`absolute top-2 right-2 ${getStatusColor(
                            post.status,
                            !!post.rejectedAt
                          )} text-white text-xs px-2 py-1 rounded-full z-10`}
                        >
                          {getStatusText(post.status, !!post.rejectedAt)}
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
                  posts={posts.map((p) => ({
                    id: p.id,
                    clerkId: "", // Not needed for display
                    driveFileId: p.driveFileId,
                    driveFileUrl: "", // Not needed for display
                    fileName: p.fileName,
                    caption: p.caption,
                    scheduledDate: p.date,
                    status: p.status,
                    postType: p.type,
                    folder: p.originalFolder,
                    order: p.order,
                    mimeType: p.mimeType || null,
                    rejectedAt: p.rejectedAt || null,
                    rejectionReason: p.rejectionReason || null,
                    rejectedBy: p.rejectedBy || null,
                    instagramUrl: p.instagramUrl || null,
                    publishedAt: p.publishedAt || null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    image: p.image,
                  }))}
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
                      alert("Failed to update status. Please try again.");
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Editor or Library */}
        <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
          {selectedPost ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Edit Post
                </h3>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Google Drive Library
              </h3>

              {!googleAccessToken ? (
                <div className="text-center py-8">
                  <div className="mb-4">
                    <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                      Connect to Google Drive to access your folders
                    </p>
                  </div>
                  <button
                    onClick={authenticateGoogleDrive}
                    disabled={isAuthenticating}
                    className="flex items-center justify-center space-x-2 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
                  >
                    {isAuthenticating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Connect Google Drive</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Folder Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Select Folder
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={loadAllFolders}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
                          title="Refresh folders"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Refresh
                        </button>
                        <button
                          onClick={() => {
                            setGoogleAccessToken(null);
                            localStorage.removeItem(
                              "google_drive_access_token"
                            );
                            alert(
                              'Disconnected from Google Drive. Click "Connect Google Drive" to reconnect.'
                            );
                          }}
                          className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1"
                          title="Disconnect Google Drive"
                        >
                          <Upload className="w-3 h-3" />
                          Reconnect
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {driveFolders.map((folder) => (
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

                  {/* Selected Folder Contents */}
                  <div>
                    <div className="mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {selectedFolder} Files
                      </span>
                    </div>

                    {(() => {
                      const currentFolder = driveFolders.find(
                        (f) => f.name === selectedFolder
                      );

                      if (!currentFolder) {
                        return (
                          <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                            Folder not found
                          </div>
                        );
                      }

                      if (currentFolder.loading) {
                        return (
                          <div className="text-center py-4">
                            <RefreshCw className="w-6 h-6 text-gray-400 mx-auto mb-2 animate-spin" />
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                              Loading files...
                            </p>
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

                      console.log(
                        `📋 Rendering ${currentFolder.files.length} files from ${selectedFolder}`
                      );

                      return (
                        <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                          {currentFolder.files.map((file) => {
                            const isVideo = file.mimeType.startsWith("video/");
                            const blobUrl = fileBlobUrls[file.id];

                            return (
                              <div
                                key={file.id}
                                className="relative group cursor-pointer"
                              >
                                {blobUrl ? (
                                  isVideo ? (
                                    <video
                                      src={blobUrl}
                                      className="w-full aspect-square object-cover rounded-lg"
                                      muted
                                      playsInline
                                      onMouseEnter={(e) =>
                                        (e.target as HTMLVideoElement).play()
                                      }
                                      onMouseLeave={(e) => {
                                        const video =
                                          e.target as HTMLVideoElement;
                                        video.pause();
                                        video.currentTime = 0;
                                      }}
                                    />
                                  ) : (
                                    <img
                                      src={blobUrl}
                                      alt={file.name}
                                      className="w-full aspect-square object-cover rounded-lg"
                                      loading="lazy"
                                    />
                                  )
                                ) : (
                                  <div className="w-full aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                    <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                                  </div>
                                )}

                                {/* Video indicator badge */}
                                {isVideo && (
                                  <div className="absolute top-2 right-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-lg flex items-center gap-1">
                                    <Video className="w-3 h-3" />
                                    VIDEO
                                  </div>
                                )}

                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded-lg flex items-center justify-center gap-2">
                                  <button
                                    onClick={async () => {
                                      // Add to staging queue with downloaded file
                                      try {
                                        // If we already have the blob URL, use it directly
                                        const fileUrl = fileBlobUrls[file.id];

                                        if (!fileUrl) {
                                          alert(
                                            "File is still loading. Please wait a moment."
                                          );
                                          return;
                                        }

                                        const isVideo =
                                          file.mimeType.startsWith("video/");

                                        // Save to database first
                                        const dbPost =
                                          await createInstagramPost({
                                            driveFileId: file.id,
                                            driveFileUrl: file.webViewLink,
                                            fileName: file.name,
                                            caption: "",
                                            status: "DRAFT",
                                            postType: isVideo ? "REEL" : "POST",
                                            folder: selectedFolder,
                                            mimeType: file.mimeType,
                                          });

                                        // Add to local state
                                        const newPost: Post = {
                                          id: dbPost.id,
                                          image: fileUrl,
                                          caption: "",
                                          status: "DRAFT",
                                          type: isVideo ? "REEL" : "POST",
                                          date: new Date()
                                            .toISOString()
                                            .split("T")[0],
                                          driveFileId: file.id,
                                          originalFolder: selectedFolder,
                                          order: dbPost.order,
                                          fileName: file.name,
                                          mimeType: file.mimeType,
                                        };

                                        setPosts((prev) => [newPost, ...prev]);
                                        console.log(
                                          "✅ Added post to queue and database"
                                        );
                                      } catch (error) {
                                        console.error(
                                          "Error adding file to queue:",
                                          error
                                        );
                                        alert(
                                          "Failed to add file to queue. Please try again."
                                        );
                                      }
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-gray-900 px-3 py-1 rounded text-xs font-medium hover:bg-gray-100"
                                  >
                                    Add to Queue
                                  </button>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (
                                        !confirm(
                                          `Delete "${file.name}" from Google Drive?\n\nThis will permanently delete the file from Google Drive.`
                                        )
                                      ) {
                                        return;
                                      }

                                      try {
                                        // Delete from Google Drive
                                        const drive = await fetch(
                                          `https://www.googleapis.com/drive/v3/files/${file.id}`,
                                          {
                                            method: "DELETE",
                                            headers: {
                                              Authorization: `Bearer ${googleAccessToken}`,
                                            },
                                          }
                                        );

                                        if (!drive.ok) {
                                          throw new Error(
                                            "Failed to delete from Google Drive"
                                          );
                                        }

                                        // Remove from local state
                                        setDriveFolders((prev) =>
                                          prev.map((folder) =>
                                            folder.name === selectedFolder
                                              ? {
                                                  ...folder,
                                                  files: folder.files.filter(
                                                    (f) => f.id !== file.id
                                                  ),
                                                }
                                              : folder
                                          )
                                        );

                                        // Remove blob URL
                                        if (fileBlobUrls[file.id]) {
                                          URL.revokeObjectURL(
                                            fileBlobUrls[file.id]
                                          );
                                          setFileBlobUrls((prev) => {
                                            const newUrls = { ...prev };
                                            delete newUrls[file.id];
                                            return newUrls;
                                          });
                                        }

                                        alert(
                                          "File deleted from Google Drive successfully"
                                        );
                                        console.log(
                                          `✅ Deleted file ${file.id} from Google Drive`
                                        );
                                      } catch (error) {
                                        console.error(
                                          "Error deleting file from Google Drive:",
                                          error
                                        );
                                        alert(
                                          "Failed to delete file from Google Drive. Please try again."
                                        );
                                      }
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 text-white p-2 rounded hover:bg-red-700"
                                    title="Delete from Google Drive"
                                  >
                                    <Trash2 size={14} />
                                  </button>
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
              )}
            </div>
          )}
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
    </div>
  );
};

export default InstagramStagingTool;
