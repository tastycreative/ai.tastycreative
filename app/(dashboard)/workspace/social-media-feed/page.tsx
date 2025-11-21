"use client";

import { useState, useEffect } from "react";
import { useApiClient } from "@/lib/apiClient";
import { useAuth } from "@clerk/nextjs";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Heart,
  MessageCircle,
  Share2,
  ImageIcon,
  Loader2,
  Send,
  MoreVertical,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  imageUrl?: string;
}

interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string;
  sender: User;
  receiver: User;
}

interface Post {
  id: string;
  userId: string;
  content?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  user: User;
  likes: Array<{ userId: string; user: User }>;
  comments: Array<{
    id: string;
    userId: string;
    content: string;
    createdAt: string;
    user: User;
  }>;
  _count: {
    likes: number;
    comments: number;
  };
}

export default function SocialMediaFeedPage() {
  const [activeTab, setActiveTab] = useState<"feed" | "friends" | "requests">("feed");
  const [posts, setPosts] = useState<Post[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState("");
  const [showComments, setShowComments] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [userDbId, setUserDbId] = useState<string>(""); // Store database ID

  const apiClient = useApiClient();
  const { userId } = useAuth();

  useEffect(() => {
    if (apiClient) {
      fetchData();
    }
  }, [apiClient, activeTab]);

  // Get user's first name and database ID for avatar and likes
  useEffect(() => {
    const getUserName = async () => {
      if (!apiClient || !userId) return;
      try {
        const response = await apiClient.get("/api/user/profile");
        if (response.ok) {
          const data = await response.json();
          setFirstName(data.firstName || "");
          setUserDbId(data.id || ""); // Store database ID
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };
    getUserName();
  }, [apiClient, userId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "feed") {
        await fetchPosts();
      } else if (activeTab === "friends") {
        await fetchFriends();
      } else if (activeTab === "requests") {
        await fetchFriendRequests();
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    if (!apiClient) return;
    try {
      const response = await apiClient.get("/api/social/posts");
      if (response.ok) {
        const data = await response.json();
        setPosts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      setPosts([]);
    }
  };

  const fetchFriends = async () => {
    if (!apiClient) return;
    try {
      const response = await apiClient.get("/api/social/friends");
      if (response.ok) {
        const data = await response.json();
        setFriends(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching friends:", error);
      setFriends([]);
    }
  };

  const fetchFriendRequests = async () => {
    if (!apiClient) return;
    try {
      const [receivedRes, sentRes] = await Promise.all([
        apiClient.get("/api/social/friend-requests/received"),
        apiClient.get("/api/social/friend-requests/sent"),
      ]);

      if (receivedRes.ok) {
        const received = await receivedRes.json();
        setFriendRequests(Array.isArray(received) ? received : []);
      }

      if (sentRes.ok) {
        const sent = await sentRes.json();
        setPendingRequests(Array.isArray(sent) ? sent : []);
      }
    } catch (error) {
      console.error("Error fetching friend requests:", error);
      setFriendRequests([]);
      setPendingRequests([]);
    }
  };

  const searchUsers = async (query: string) => {
    if (!apiClient || !query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await apiClient.get(`/api/social/users/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      }
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setSearching(false);
    }
  };

  const sendFriendRequest = async (receiverId: string) => {
    if (!apiClient) return;
    try {
      const response = await apiClient.post("/api/social/friend-requests", {
        receiverId,
      });

      if (response.ok) {
        toast.success("Friend request sent!");
        await fetchFriendRequests();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to send friend request");
      }
    } catch (error) {
      console.error("Error sending friend request:", error);
      toast.error("Failed to send friend request");
    }
  };

  const respondToFriendRequest = async (requestId: string, accept: boolean) => {
    if (!apiClient) return;
    try {
      const response = await apiClient.patch(`/api/social/friend-requests/${requestId}`, {
        accept,
      });

      if (response.ok) {
        toast.success(accept ? "Friend request accepted!" : "Friend request declined");
        await fetchFriendRequests();
        if (accept) {
          await fetchFriends();
        }
      }
    } catch (error) {
      console.error("Error responding to friend request:", error);
      toast.error("Failed to respond to friend request");
    }
  };

  const createPost = async () => {
    if (!apiClient || !newPostContent.trim()) return;

    try {
      const response = await apiClient.post("/api/social/posts", {
        content: newPostContent,
      });

      if (response.ok) {
        toast.success("Post created!");
        setNewPostContent("");
        await fetchPosts();
      }
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error("Failed to create post");
    }
  };

  const likePost = async (postId: string) => {
    if (!apiClient) return;
    try {
      const response = await apiClient.post(`/api/social/posts/${postId}/like`, {});
      if (response.ok) {
        await fetchPosts();
      }
    } catch (error) {
      console.error("Error liking post:", error);
    }
  };

  const addComment = async (postId: string) => {
    if (!apiClient || !commentInputs[postId]?.trim()) return;

    try {
      const response = await apiClient.post(`/api/social/posts/${postId}/comments`, {
        content: commentInputs[postId],
      });

      if (response.ok) {
        setCommentInputs({ ...commentInputs, [postId]: "" });
        await fetchPosts();
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!apiClient) return;
    try {
      const response = await apiClient.delete(`/api/social/friends/${friendId}`);
      if (response.ok) {
        toast.success("Friend removed");
        await fetchFriends();
      }
    } catch (error) {
      console.error("Error removing friend:", error);
      toast.error("Failed to remove friend");
    }
  };

  if (!apiClient) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-600 dark:text-gray-400">Loading social features...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg border border-blue-200 dark:border-purple-800 p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Social Media</h1>
              <p className="text-blue-100">Connect, share, and discover</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveTab("feed")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
            activeTab === "feed"
              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          <ImageIcon className="w-5 h-5" />
          <span>Feed</span>
        </button>

        <button
          onClick={() => setActiveTab("friends")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
            activeTab === "friends"
              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          <Users className="w-5 h-5" />
          <span>Friends</span>
          {friends.length > 0 && (
            <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold">
              {friends.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("requests")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
            activeTab === "requests"
              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          <UserPlus className="w-5 h-5" />
          <span>Requests</span>
          {friendRequests.length > 0 && (
            <span className="px-2 py-0.5 bg-red-500 rounded-full text-xs font-bold text-white">
              {friendRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* Feed Tab */}
          {activeTab === "feed" && (
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Create Post Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-start gap-3">
                  {/* User Avatar */}
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-semibold">
                      {firstName?.[0] || "U"}
                    </span>
                  </div>
                  
                  {/* Input Area */}
                  <div className="flex-1">
                    <button
                      onClick={() => document.getElementById("create-post-textarea")?.focus()}
                      className="w-full text-left px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-gray-500 dark:text-gray-400 transition-colors cursor-text"
                    >
                      What's on your mind?
                    </button>
                  </div>
                </div>
                
                {/* Expanded Create Post */}
                <div className="mt-3">
                  <textarea
                    id="create-post-textarea"
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="Share something with your friends..."
                    className="w-full px-4 py-3 border-0 focus:ring-0 bg-transparent text-gray-900 dark:text-white resize-none text-lg placeholder-gray-400 dark:placeholder-gray-500"
                    rows={3}
                  />
                  
                  {newPostContent.trim() && (
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <ImageIcon className="w-5 h-5" />
                        <span>Add photo</span>
                      </div>
                      <button
                        onClick={createPost}
                        disabled={!newPostContent.trim()}
                        className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                      >
                        Post
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Posts Feed */}
              {posts.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                  <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ImageIcon className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    No posts yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                    Start following friends to see their posts or create your first post!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => {
                    const isLiked = post.likes?.some((like) => like.userId === userDbId) ?? false;
                    const displayName = post.user?.firstName && post.user?.lastName
                      ? `${post.user.firstName} ${post.user.lastName}`
                      : post.user?.firstName || post.user?.username || post.user?.email || "Unknown User";
                    
                    return (
                      <div
                        key={post.id}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                      >
                        {/* Post Header */}
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm font-semibold">
                                  {post.user?.firstName?.[0] || post.user?.email?.[0]?.toUpperCase() || "U"}
                                </span>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white">
                                  {displayName}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(post.createdAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>
                            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                              <MoreVertical className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                            </button>
                          </div>

                          {/* Post Content */}
                          {post.content && (
                            <p className="text-gray-900 dark:text-white text-base leading-relaxed mb-3">
                              {post.content}
                            </p>
                          )}
                        </div>

                        {/* Post Image */}
                        {post.imageUrl && (
                          <div className="w-full">
                            <img
                              src={post.imageUrl}
                              alt="Post"
                              className="w-full max-h-[500px] object-cover"
                            />
                          </div>
                        )}

                        {/* Post Stats */}
                        <div className="px-4 py-2 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-1">
                            {post._count.likes > 0 && (
                              <div className="flex items-center gap-1">
                                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                  <Heart className="w-3 h-3 text-white fill-current" />
                                </div>
                                <span>{post._count.likes}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            {post._count.comments > 0 && (
                              <span>{post._count.comments} comment{post._count.comments !== 1 ? "s" : ""}</span>
                            )}
                          </div>
                        </div>

                        {/* Post Actions */}
                        <div className="px-4 py-2 flex items-center justify-around border-b border-gray-200 dark:border-gray-700">
                          <button
                            onClick={() => likePost(post.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-semibold transition-all ${
                              isLiked
                                ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            }`}
                          >
                            <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
                            <span className="text-sm">Like</span>
                          </button>

                          <button
                            onClick={() =>
                              setShowComments(showComments === post.id ? null : post.id)
                            }
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                          >
                            <MessageCircle className="w-5 h-5" />
                            <span className="text-sm">Comment</span>
                          </button>

                          <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
                            <Share2 className="w-5 h-5" />
                            <span className="text-sm">Share</span>
                          </button>
                        </div>

                        {/* Comments Section */}
                        {showComments === post.id && (
                          <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
                            {/* Existing Comments */}
                            {post.comments && post.comments.length > 0 && (
                              <div className="space-y-3 mb-4">
                                {post.comments.map((comment) => {
                                  const commentDisplayName = comment.user?.firstName && comment.user?.lastName
                                    ? `${comment.user.firstName} ${comment.user.lastName}`
                                    : comment.user?.firstName || comment.user?.username || comment.user?.email || "Unknown User";
                                  
                                  return (
                                    <div key={comment.id} className="flex gap-2">
                                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="text-white text-xs font-semibold">
                                          {comment.user?.firstName?.[0] ||
                                            comment.user?.email?.[0]?.toUpperCase() || "U"}
                                        </span>
                                      </div>
                                      <div className="flex-1">
                                        <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-2">
                                          <p className="font-semibold text-sm text-gray-900 dark:text-white">
                                            {commentDisplayName}
                                          </p>
                                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
                                            {comment.content}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-3 px-4 mt-1">
                                          <button className="text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400">
                                            Like
                                          </button>
                                          <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {new Date(comment.createdAt).toLocaleDateString("en-US", {
                                              month: "short",
                                              day: "numeric",
                                              hour: "numeric",
                                              minute: "2-digit",
                                            })}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Add Comment */}
                            <div className="flex gap-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-xs font-semibold">
                                  {firstName?.[0] || "U"}
                                </span>
                              </div>
                              <div className="flex-1 flex gap-2">
                                <input
                                  type="text"
                                  value={commentInputs[post.id] || ""}
                                  onChange={(e) =>
                                    setCommentInputs({
                                      ...commentInputs,
                                      [post.id]: e.target.value,
                                    })
                                  }
                                  onKeyPress={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      addComment(post.id);
                                    }
                                  }}
                                  placeholder="Write a comment..."
                                  className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-white text-sm"
                                />
                                <button
                                  onClick={() => addComment(post.id)}
                                  disabled={!commentInputs[post.id]?.trim()}
                                  className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Send className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Friends Tab */}
          {activeTab === "friends" && (
            <div className="space-y-6">
              {/* Search Users */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Find Friends
                </h3>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchUsers(e.target.value);
                  }}
                  placeholder="Search by name or email..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {searchResults.map((user) => {
                      const isFriend = friends.some((f) => f.clerkId === user.clerkId);
                      const requestSent = pendingRequests.some(
                        (r) => r.receiverId === user.clerkId && r.status === "PENDING"
                      );

                      return (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                              <span className="text-white font-semibold">
                                {user.firstName?.[0] || user.email[0].toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {user.firstName || user.username || user.email}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {user.email}
                              </p>
                            </div>
                          </div>

                          {user.clerkId !== userId && (
                            <>
                              {isFriend ? (
                                <span className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
                                  <UserCheck className="w-4 h-4" />
                                  Friends
                                </span>
                              ) : requestSent ? (
                                <span className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-sm font-medium">
                                  <Clock className="w-4 h-4" />
                                  Pending
                                </span>
                              ) : (
                                <button
                                  onClick={() => sendFriendRequest(user.clerkId)}
                                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all"
                                >
                                  <UserPlus className="w-4 h-4" />
                                  Add Friend
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Friends List */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  My Friends ({friends.length})
                </h3>

                {friends.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      No friends yet. Start connecting!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friends.map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold">
                              {friend.firstName?.[0] || friend.email[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {friend.firstName || friend.username || friend.email}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {friend.email}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => removeFriend(friend.clerkId)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 font-semibold rounded-lg transition-all"
                        >
                          <UserX className="w-4 h-4" />
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Requests Tab */}
          {activeTab === "requests" && (
            <div className="space-y-6">
              {/* Received Requests */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Received Requests ({friendRequests.length})
                </h3>

                {friendRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <UserPlus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      No pending friend requests
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friendRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold">
                              {request.sender.firstName?.[0] ||
                                request.sender.email[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {request.sender.firstName ||
                                request.sender.username ||
                                request.sender.email}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => respondToFriendRequest(request.id, true)}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Accept
                          </button>
                          <button
                            onClick={() => respondToFriendRequest(request.id, false)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 font-semibold rounded-lg transition-all"
                          >
                            <XCircle className="w-4 h-4" />
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sent Requests */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Sent Requests ({pendingRequests.length})
                </h3>

                {pendingRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      No pending sent requests
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold">
                              {request.receiver.firstName?.[0] ||
                                request.receiver.email[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {request.receiver.firstName ||
                                request.receiver.username ||
                                request.receiver.email}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Sent {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <span className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-sm font-medium">
                          <Clock className="w-4 h-4" />
                          Pending
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
