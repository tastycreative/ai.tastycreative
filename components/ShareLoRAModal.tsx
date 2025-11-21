'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, UserPlus, Trash2, Users, Eye, Zap, Mail, Calendar, Shield, Info } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

interface ShareLoRAModalProps {
  isOpen: boolean;
  onClose: () => void;
  loraId: string;
  loraName: string;
  onShareComplete?: () => void;
}

interface ShareInfo {
  id: string;
  sharedWithClerkId: string;
  createdAt: string;
  sharedBy?: string;
  note?: string;
  sharedWithUser?: {
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    displayName: string;
  };
}

export default function ShareLoRAModal({
  isOpen,
  onClose,
  loraId,
  loraName,
  onShareComplete,
}: ShareLoRAModalProps) {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  const [note, setNote] = useState('');
  const [currentShares, setCurrentShares] = useState<ShareInfo[]>([]);
  const [toast, setToast] = useState<{ title: string; description: string; variant?: 'error' | 'success' } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Array<{
    clerkId: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    displayName: string;
  }>>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    clerkId: string;
    email: string | null;
    displayName: string;
  } | null>(null);

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Load current shares when modal opens
  useEffect(() => {
    if (isOpen) {
      loadCurrentShares();
      loadAvailableUsers();
    }
  }, [isOpen, loraId]);

  // Show toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadAvailableUsers = async () => {
    setIsLoadingUsers(true);
    try {
      // Load friends instead of all users
      const response = await fetch('/api/social/friends');
      if (response.ok) {
        const friends = await response.json();
        const formattedUsers = friends.map((friend: any) => {
          const displayName = friend.firstName && friend.lastName 
            ? `${friend.firstName} ${friend.lastName}`
            : friend.firstName || friend.lastName || friend.email || 'Unknown User';
          return {
            clerkId: friend.clerkId,
            email: friend.email,
            firstName: friend.firstName,
            lastName: friend.lastName,
            displayName,
          };
        });
        setAvailableUsers(formattedUsers);
      }
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadCurrentShares = async () => {
    setIsLoadingShares(true);
    try {
      const response = await fetch(
        `/api/user/influencers/share?loraId=${encodeURIComponent(loraId)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setCurrentShares(data.shares || []);
      } else {
        console.error('Failed to load shares');
      }
    } catch (error) {
      console.error('Error loading shares:', error);
    } finally {
      setIsLoadingShares(false);
    }
  };

  const handleShare = async () => {
    if (!selectedUser) {
      setToast({
        title: 'User required',
        description: 'Please select a user to share with',
        variant: 'error',
      });
      return;
    }

    setIsLoading(true);
    try {
      const targetClerkId = selectedUser.clerkId;

      console.log('Sharing LoRA:', loraId, 'with user:', targetClerkId);

      // Share the LoRA
      const shareResponse = await fetch('/api/user/influencers/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          loraId,
          sharedWithClerkIds: [targetClerkId],
          note: note.trim() || undefined,
        }),
      });

      console.log('Share response:', shareResponse.status);

      if (!shareResponse.ok) {
        const errorData = await shareResponse.json();
        console.error('Share failed:', errorData);
        throw new Error(errorData.error || 'Failed to share LoRA');
      }

      const shareData = await shareResponse.json();
      console.log('Share successful:', shareData);

      setToast({
        title: 'LoRA shared',
        description: `"${loraName}" has been shared with ${selectedUser.displayName}`,
        variant: 'success',
      });

      // Reset form and reload shares
      setSelectedUser(null);
      setUserSearchQuery('');
      setNote('');
      loadCurrentShares();
      
      // Notify parent component
      if (onShareComplete) {
        onShareComplete();
      }
    } catch (error) {
      console.error('Error sharing LoRA:', error);
      setToast({
        title: 'Failed to share LoRA',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveShare = async (sharedWithClerkId: string, displayName: string) => {
    try {
      const response = await fetch('/api/user/influencers/share', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          loraId,
          sharedWithClerkId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove share');
      }

      setToast({
        title: 'Share removed',
        description: `"${loraName}" is no longer shared with ${displayName}`,
        variant: 'success',
      });

      loadCurrentShares();
    } catch (error) {
      console.error('Error removing share:', error);
      setToast({
        title: 'Failed to remove share',
        description: 'Please try again',
        variant: 'error',
      });
    }
  };

  if (!isOpen) return null;

  // Don't render on server
  if (!mounted) return null;

  const filteredUsers = availableUsers.filter((u) =>
    u.displayName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Share LoRA Model</h2>
                <p className="text-purple-100 text-sm mt-1">
                  Give others access to <span className="font-semibold">{loraName}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast notification */}
        {toast && (
          <div className={`mx-6 mt-4 p-4 rounded-lg border ${
            toast.variant === 'error' 
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
              : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          }`}>
            <div className="flex items-start gap-2">
              <Info className={`w-5 h-5 mt-0.5 ${
                toast.variant === 'error' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
              }`} />
              <div className="flex-1">
                <p className={`font-medium ${
                  toast.variant === 'error' ? 'text-red-900 dark:text-red-100' : 'text-green-900 dark:text-green-100'
                }`}>
                  {toast.title}
                </p>
                <p className={`text-sm mt-1 ${
                  toast.variant === 'error' ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'
                }`}>
                  {toast.description}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Share form */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Share with Friends
              </h3>
            </div>

            {/* User search */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Friend <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={selectedUser ? selectedUser.displayName : userSearchQuery}
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value);
                    setShowUserDropdown(true);
                    if (selectedUser) setSelectedUser(null);
                  }}
                  onFocus={() => setShowUserDropdown(true)}
                  placeholder="Search your friends..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                {isLoadingUsers && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                )}
                
                {/* User dropdown */}
                {showUserDropdown && !selectedUser && userSearchQuery && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((u) => (
                        <button
                          key={u.clerkId}
                          type="button"
                          onClick={() => {
                            setSelectedUser(u);
                            setUserSearchQuery('');
                            setShowUserDropdown(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                        >
                          <div className="flex items-start gap-3">
                            <Mail className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="font-medium text-gray-900 dark:text-white truncate">
                                {u.displayName}
                              </p>
                              {u.email && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {u.email}
                                </p>
                              )}
                              <p className="text-xs font-mono text-purple-600 dark:text-purple-400 truncate">
                                ID: {u.clerkId}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        <p>No friends found</p>
                        <p className="text-xs mt-1">Add friends in the Social Media tab</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {availableUsers.length === 0 && !isLoadingUsers && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  You don't have any friends yet. Visit the Social Media tab to add friends!
                </p>
              )}
            </div>

            {/* Optional note */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Note (Optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a message for the recipient..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Share button */}
            <button
              onClick={handleShare}
              disabled={isLoading || !selectedUser}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Share LoRA
                </>
              )}
            </button>
          </div>

          {/* Current shares */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <h4 className="font-medium text-gray-900 dark:text-white">
                  Shared With
                </h4>
                <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                  {currentShares.length}
                </span>
              </div>
              {isLoadingShares && (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              )}
            </div>

            {currentShares.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/30">
                <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Not shared with anyone yet
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Share this LoRA to collaborate with others
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                {currentShares.map((share) => (
                  <div
                    key={share.id}
                    className="group relative flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-800 dark:to-gray-900/50 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md transition-all duration-200"
                  >
                    {/* User Avatar or Icon */}
                    <div className="shrink-0">
                      {share.sharedWithUser?.imageUrl ? (
                        <img
                          src={share.sharedWithUser.imageUrl}
                          alt={share.sharedWithUser.displayName}
                          className="w-10 h-10 rounded-full border-2 border-gray-200 dark:border-gray-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm">
                          {share.sharedWithUser?.displayName.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {share.sharedWithUser?.displayName || 'Unknown User'}
                      </p>
                      {share.sharedWithUser?.email && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {share.sharedWithUser.email}
                        </p>
                      )}
                      
                      {/* Shared date */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(share.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {share.note && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 italic">
                          "{share.note}"
                        </p>
                      )}
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => handleRemoveShare(share.sharedWithClerkId, share.sharedWithUser?.displayName || 'user')}
                      className="shrink-0 p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200 opacity-0 group-hover:opacity-100"
                      title="Remove access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
