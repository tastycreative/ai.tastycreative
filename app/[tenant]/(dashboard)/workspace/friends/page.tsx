"use client";

import { useState, useEffect, Suspense } from "react";
import { useApiClient } from "@/lib/apiClient";
import { useAuth } from "@clerk/nextjs";
import { useParams, useSearchParams } from "next/navigation";
import {
  UserPlus,
  Users,
  Mail,
  Search,
  MoreVertical,
  UserCheck,
  UserX,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Share2,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

// Types
interface Friend {
  id: string;
  profileId: string;
  friendProfileId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  updatedAt: string;
  friendProfile: {
    id: string;
    name: string;
    instagramUsername: string | null;
    profileImageUrl: string | null;
    user: {
      clerkId: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
    };
  };
}

interface FriendRequest {
  id: string;
  fromProfileId: string;
  toProfileId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  fromProfile: {
    id: string;
    name: string;
    instagramUsername: string | null;
    profileImageUrl: string | null;
    user: {
      clerkId: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
    };
  };
}

interface SentRequest {
  id: string;
  fromProfileId: string;
  toProfileId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  toProfile: {
    id: string;
    name: string;
    instagramUsername: string | null;
    profileImageUrl: string | null;
    user: {
      clerkId: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
    };
  };
}

interface UserSearchResult {
  id: string;
  clerkId: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl?: string | null;
}

interface ProfileSearchResult {
  id: string;
  name: string;
  instagramUsername: string | null;
  profileImageUrl: string | null;
  clerkId: string;
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
}

const tabs = [
  { id: "friends", label: "My Friends", icon: Users, countKey: "friends" },
  { id: "requests", label: "Friend Requests", icon: Mail, countKey: "requests" },
  { id: "add", label: "Add Friend", icon: UserPlus },
];

interface InstagramProfile {
  id: string;
  name: string;
  instagramUsername: string | null;
  profileImageUrl: string | null;
  isDefault: boolean;
}

function FriendsPageContent() {
  const params = useParams();
  const tenant = params.tenant as string;
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || "friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [profileSearchResults, setProfileSearchResults] = useState<ProfileSearchResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const apiClient = useApiClient();
  const { userId } = useAuth();
  
  // Profile selection state
  const [creatorProfiles, setCreatorProfiles] = useState<InstagramProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  // Load creator profiles
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        setLoadingProfiles(true);
        const response = await fetch("/api/instagram/profiles");
        if (response.ok) {
          const data = await response.json();
          const profiles = Array.isArray(data) ? data : data.profiles || [];
          setCreatorProfiles(profiles);
          
          // Set selected profile from localStorage or first profile
          const savedProfileId = localStorage.getItem('selectedFriendsProfileId');
          if (savedProfileId && profiles.some((p: InstagramProfile) => p.id === savedProfileId)) {
            setSelectedProfileId(savedProfileId);
          } else if (profiles.length > 0) {
            setSelectedProfileId(profiles[0].id);
          }
        }
      } catch (error) {
        console.error("Error fetching profiles:", error);
      } finally {
        setLoadingProfiles(false);
      }
    };

    if (userId) {
      fetchProfiles();
    }
  }, [userId]);

  // Save selected profile to localStorage
  useEffect(() => {
    if (selectedProfileId) {
      localStorage.setItem('selectedFriendsProfileId', selectedProfileId);
    }
  }, [selectedProfileId]);

  // Update active tab when URL parameter changes
  useEffect(() => {
    if (tabParam && ['friends', 'requests', 'add'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Load friends and requests when profile is selected
  useEffect(() => {
    if (userId && selectedProfileId) {
      loadFriends();
      loadFriendRequests();
      loadSentRequests();
    }
  }, [userId, selectedProfileId]);

  const loadFriends = async () => {
    if (!selectedProfileId) return;
    
    try {
      setLoading(true);
      console.log("Loading friends for profile:", selectedProfileId);
      const response = await fetch(`/api/friends?profileId=${selectedProfileId}`);
      if (response.ok) {
        const data = await response.json();
        console.log("Friends loaded:", data);
        setFriends(data);
      } else {
        const error = await response.json();
        console.error("Failed to load friends:", error);
        toast.error("Failed to load friends");
      }
    } catch (error) {
      console.error("Error loading friends:", error);
      toast.error("Failed to load friends");
    } finally {
      setLoading(false);
    }
  };

  const loadFriendRequests = async () => {
    if (!selectedProfileId) return;
    
    try {
      const response = await fetch(`/api/friends/requests?profileId=${selectedProfileId}`);
      if (response.ok) {
        const data = await response.json();
        setFriendRequests(data);
      }
    } catch (error) {
      console.error("Error loading friend requests:", error);
    }
  };

  const loadSentRequests = async () => {
    if (!selectedProfileId) return;
    
    try {
      const response = await fetch(`/api/friends/requests?type=sent&profileId=${selectedProfileId}`);
      if (response.ok) {
        const data = await response.json();
        setSentRequests(data);
      }
    } catch (error) {
      console.error("Error loading sent requests:", error);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!emailInput.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    try {
      setSendingRequest(true);
      // TODO: Implement API endpoint for sending friend request
      // await apiClient.post('/api/friends/request', { email: emailInput });
      toast.success("Friend request sent!");
      setEmailInput("");
      setSearchResults([]); // Clear search results after sending request
    } catch (error: any) {
      console.error("Error sending friend request:", error);
      toast.error(
        error.response?.data?.message || "Failed to send friend request"
      );
    } finally {
      setSendingRequest(false);
    }
  };

  const handleSendFriendRequestToUser = async (user: UserSearchResult) => {
    try {
      setSendingRequest(true);
      const response = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkId: user.clerkId }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(
          `Friend request sent to ${user.firstName || user.email}!`
        );
        // Remove user from search results after sending request
        setSearchResults(
          searchResults.filter((u) => u.clerkId !== user.clerkId)
        );
      } else {
        toast.error(data.error || "Failed to send friend request");
      }
    } catch (error: any) {
      console.error("Error sending friend request:", error);
      toast.error("Failed to send friend request");
    } finally {
      setSendingRequest(false);
    }
  };

  const handleSendFriendRequestToProfile = async (profile: ProfileSearchResult) => {
    try {
      if (!selectedProfileId) {
        toast.error("Please select a profile first");
        return;
      }

      setSendingRequest(true);
      const response = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          profileId: profile.id,
          senderProfileId: selectedProfileId 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(
          `Friend request sent to @${profile.instagramUsername || profile.name}!`
        );
        // Remove profile from search results after sending request
        setProfileSearchResults(
          profileSearchResults.filter((p) => p.id !== profile.id)
        );
      } else {
        toast.error(data.error || "Failed to send friend request");
      }
    } catch (error: any) {
      console.error("Error sending friend request:", error);
      toast.error("Failed to send friend request");
    } finally {
      setSendingRequest(false);
    }
  };

  const handleSearchUsers = async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setProfileSearchResults([]);
      return;
    }

    try {
      setSearchingUsers(true);
      const url = selectedProfileId 
        ? `/api/instagram/profiles/search?q=${encodeURIComponent(query.trim())}&excludeProfileId=${selectedProfileId}`
        : `/api/instagram/profiles/search?q=${encodeURIComponent(query.trim())}`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setProfileSearchResults(data);
      } else {
        setProfileSearchResults([]);
      }
    } catch (error: any) {
      console.error("Error searching profiles:", error);
      toast.error("Failed to search profiles");
      setProfileSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/friends/request/${requestId}/accept`, {
        method: "POST",
      });

      if (response.ok) {
        toast.success("Friend request accepted!");
        loadFriends();
        loadFriendRequests();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to accept friend request");
      }
    } catch (error) {
      console.error("Error accepting friend request:", error);
      toast.error("Failed to accept friend request");
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/friends/request/${requestId}/reject`, {
        method: "POST",
      });

      if (response.ok) {
        toast.success("Friend request rejected");
        loadFriendRequests();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to reject friend request");
      }
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      toast.error("Failed to reject friend request");
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/friends/request/${requestId}/cancel`, {
        method: "POST",
      });

      if (response.ok) {
        toast.success("Friend request cancelled");
        loadSentRequests();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to cancel friend request");
      }
    } catch (error) {
      console.error("Error cancelling friend request:", error);
      toast.error("Failed to cancel friend request");
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm("Are you sure you want to remove this friend?")) {
      return;
    }

    try {
      const response = await fetch(`/api/friends/${friendId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Friend removed");
        loadFriends();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to remove friend");
      }
    } catch (error) {
      console.error("Error removing friend:", error);
      toast.error("Failed to remove friend");
    }
  };

  const filteredFriends = friends.filter((friend) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      friend.friendProfile.name.toLowerCase().includes(query) ||
      friend.friendProfile.instagramUsername?.toLowerCase().includes(query) ||
      friend.friendProfile.user.email?.toLowerCase().includes(query) ||
      friend.friendProfile.user.firstName?.toLowerCase().includes(query) ||
      friend.friendProfile.user.lastName?.toLowerCase().includes(query)
    );
  });

  const renderTabContent = () => {
    switch (activeTab) {
      case "friends":
        return (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
              <input
                type="text"
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            {/* Friends List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {searchQuery ? "No friends found" : "No friends yet"}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {searchQuery
                    ? "Try a different search term"
                    : "Start by adding friends to share content and collaborate"}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setActiveTab("add")}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-md active:scale-95"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add Friend
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-800/50 dark:to-gray-900/30 border border-gray-200/50 dark:border-gray-700/30 rounded-xl p-4 sm:p-5 shadow-md hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {friend.friendProfile.profileImageUrl ? (
                          <img
                            src={friend.friendProfile.profileImageUrl}
                            alt={friend.friendProfile.name}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <span className="text-white text-sm sm:text-base font-semibold">
                              {friend.friendProfile.name?.[0]?.toUpperCase() || "?"}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {friend.friendProfile.name}
                          </h4>
                          <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 truncate">
                            @{friend.friendProfile.instagramUsername || "No username"}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-500 truncate">
                            {friend.friendProfile.user.firstName && friend.friendProfile.user.lastName
                              ? `${friend.friendProfile.user.firstName} ${friend.friendProfile.user.lastName}`
                              : friend.friendProfile.user.email}
                          </p>
                        </div>
                      </div>
                      <div className="relative group">
                        <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
                          <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </button>
                        <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          <button
                            onClick={() => handleRemoveFriend(friend.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            Remove Friend
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "requests":
        return (
          <div className="space-y-6">
            {/* Received Requests Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                  Received Requests
                </h3>
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                  {friendRequests.length}
                </span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : friendRequests.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/30">
                  <Mail className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    No received requests
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {friendRequests.map((request) => (
                    <div
                      key={request.id}
                      className="bg-gradient-to-br from-white to-blue-50/50 dark:from-gray-800/50 dark:to-blue-900/20 border border-blue-200/50 dark:border-blue-700/30 rounded-xl p-4 sm:p-5 shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {request.fromProfile.profileImageUrl ? (
                            <img
                              src={request.fromProfile.profileImageUrl}
                              alt={request.fromProfile.name}
                              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-sm sm:text-base font-semibold">
                                {request.fromProfile.name?.[0]?.toUpperCase() || "?"}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {request.fromProfile.name}
                            </h4>
                            <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 truncate">
                              @{request.fromProfile.instagramUsername || "No username"}
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-500 truncate">
                              {request.fromProfile.user.firstName && request.fromProfile.user.lastName
                                ? `${request.fromProfile.user.firstName} ${request.fromProfile.user.lastName}`
                                : request.fromProfile.user.email}
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <button
                            onClick={() => handleAcceptRequest(request.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-green-500 hover:bg-green-600 text-white text-[10px] sm:text-xs font-medium rounded-lg transition-colors shadow-sm active:scale-95"
                          >
                            <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span className="hidden sm:inline">Accept</span>
                          </button>
                          <button
                            onClick={() => handleRejectRequest(request.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-red-500 hover:bg-red-600 text-white text-[10px] sm:text-xs font-medium rounded-lg transition-colors shadow-sm active:scale-95"
                          >
                            <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span className="hidden sm:inline">Reject</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sent Requests Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                  Sent Requests
                </h3>
                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                  {sentRequests.length}
                </span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                </div>
              ) : sentRequests.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/30">
                  <Clock className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    No pending sent requests
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="bg-gradient-to-br from-white to-purple-50/50 dark:from-gray-800/50 dark:to-purple-900/20 border border-purple-200/50 dark:border-purple-700/30 rounded-xl p-4 sm:p-5 shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {request.toProfile.profileImageUrl ? (
                            <img
                              src={request.toProfile.profileImageUrl}
                              alt={request.toProfile.name}
                              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-sm sm:text-base font-semibold">
                                {request.toProfile.name?.[0]?.toUpperCase() || "?"}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {request.toProfile.name}
                            </h4>
                            <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 truncate">
                              @{request.toProfile.instagramUsername || "No username"}
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-500 truncate">
                              {request.toProfile.user.firstName && request.toProfile.user.lastName
                                ? `${request.toProfile.user.firstName} ${request.toProfile.user.lastName}`
                                : request.toProfile.user.email}
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              Sent{" "}
                              {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <button
                            onClick={() => handleCancelRequest(request.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-gray-500 hover:bg-gray-600 text-white text-[10px] sm:text-xs font-medium rounded-lg transition-colors shadow-sm active:scale-95"
                          >
                            <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span className="hidden sm:inline">Cancel</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case "add":
        return (
          <div className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-white to-purple-50/50 dark:from-gray-800/50 dark:to-purple-900/20 border border-purple-200/50 dark:border-purple-700/30 rounded-xl p-6 sm:p-8 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                    Add Friend
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Search by Instagram profile
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="search"
                    className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Search Instagram Profiles
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5 z-10" />
                    <input
                      type="text"
                      id="search"
                      value={emailInput}
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        handleSearchUsers(e.target.value);
                      }}
                      placeholder="Search by Instagram username or profile name..."
                      className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                    {searchingUsers && (
                      <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400 z-10" />
                    )}

                    {/* Search Results Dropdown */}
                    {emailInput.trim().length >= 2 && (
                      <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-[400px] overflow-y-scroll">
                        {searchingUsers ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                          </div>
                        ) : profileSearchResults.length === 0 ? (
                          <div className="text-center py-8">
                            <Users className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                              No Instagram profiles found
                            </p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {profileSearchResults.map((profile) => (
                              <div
                                key={profile.id}
                                className="p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {profile.profileImageUrl ? (
                                      <img
                                        src={profile.profileImageUrl}
                                        alt={profile.name}
                                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                                        <Users className="w-5 h-5 text-white" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                                        {profile.name}
                                      </h4>
                                      {profile.instagramUsername && (
                                        <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 truncate">
                                          @{profile.instagramUsername}
                                        </p>
                                      )}
                                      <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 truncate">
                                        {profile.user.firstName && profile.user.lastName
                                          ? `${profile.user.firstName} ${profile.user.lastName}`
                                          : profile.user.email}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() =>
                                      handleSendFriendRequestToProfile(profile)
                                    }
                                    disabled={sendingRequest}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-[10px] sm:text-xs font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex-shrink-0"
                                  >
                                    {sendingRequest ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <>
                                        <UserPlus className="w-3 h-3" />
                                        <span className="hidden sm:inline">
                                          Add
                                        </span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-[10px] sm:text-xs text-blue-900 dark:text-blue-200">
                    <p className="font-semibold mb-1">Friend Features</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Share your LoRA models</li>
                      <li>Collaborate on content generation</li>
                      <li>View each other's galleries (with permission)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Profile Selection Sidebar */}
      <div className="w-80 flex-shrink-0 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-lg">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Profiles</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">Select a profile to manage friends</p>
        </div>

        {loadingProfiles ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        ) : creatorProfiles.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">No profiles found</p>
            <a
              href={`/${tenant}/workspace/creators`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all"
            >
              Create Profile
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {creatorProfiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => setSelectedProfileId(profile.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                  selectedProfileId === profile.id
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md"
                    : "bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900/70"
                }`}
              >
                {profile.profileImageUrl ? (
                  <img
                    src={profile.profileImageUrl}
                    alt={profile.name}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    selectedProfileId === profile.id
                      ? "bg-white/20"
                      : "bg-gradient-to-br from-blue-500 to-purple-600"
                  }`}>
                    <Users className={`w-5 h-5 ${
                      selectedProfileId === profile.id ? "text-white" : "text-white"
                    }`} />
                  </div>
                )}
                <div className="flex-1 text-left min-w-0">
                  <p className="font-medium text-sm truncate">{profile.name}</p>
                  {profile.instagramUsername && (
                    <p className={`text-xs truncate ${
                      selectedProfileId === profile.id
                        ? "text-white/80"
                        : "text-gray-600 dark:text-gray-400"
                    }`}>
                      @{profile.instagramUsername}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-3 sm:space-y-4">
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="space-y-2 sm:space-y-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            Friends
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
            Connect with friends and collaborate on creative projects
          </p>
        </div>
      </div>

      {/* Tab Navigation and Content */}
      <div className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900/30 dark:to-gray-800/20 border border-gray-200/50 dark:border-gray-700/30 rounded-xl shadow-lg backdrop-blur-sm overflow-hidden">
        <div className="border-b border-gray-200/50 dark:border-gray-700/30">
          <nav
            className="flex gap-4 sm:gap-6 md:gap-8 px-4 sm:px-6 overflow-x-auto scrollbar-hide"
            aria-label="Tabs"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              let count = 0;
              if (tab.countKey === "friends") {
                count = friends.length;
              } else if (tab.countKey === "requests") {
                count = friendRequests.length;
              }
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    isActive
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                  } whitespace-nowrap border-b-2 py-3 sm:py-4 px-1 font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5 sm:gap-2 active:scale-95`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">{tab.label}</span>
                  <span className="xs:hidden">
                    {tab.label.split(" ").pop()}
                  </span>
                  {tab.countKey && count > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full ${
                      isActive 
                        ? "bg-blue-500 text-white" 
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 sm:p-6">{renderTabContent()}</div>
      </div>
    </div>
      </div>
    </div>
  );
}

// Loading fallback component
function FriendsPageFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/30 dark:from-gray-950 dark:via-purple-950/20 dark:to-blue-950/20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading friends...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main export with Suspense boundary
export default function FriendsPage() {
  return (
    <Suspense fallback={<FriendsPageFallback />}>
      <FriendsPageContent />
    </Suspense>
  );
}
