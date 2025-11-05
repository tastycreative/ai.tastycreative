'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, UserPlus, Trash2, Users, Eye, Edit3, Mail, Calendar, Shield, Info } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

interface ShareFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderPrefix: string;
  folderName: string;
  onShareComplete?: () => void;
}

interface ShareInfo {
  id: string;
  sharedWithClerkId: string;
  permission: 'VIEW' | 'EDIT';
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

export default function ShareFolderModal({
  isOpen,
  onClose,
  folderPrefix,
  folderName,
  onShareComplete,
}: ShareFolderModalProps) {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [permission, setPermission] = useState<'VIEW' | 'EDIT'>('VIEW');
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
  }, [isOpen, folderPrefix]);

  // Show toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-dropdown-container')) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserDropdown]);

  const loadAvailableUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch('/api/users/list');
      if (response.ok) {
        const data = await response.json();
        const formattedUsers = data.users.map((u: any) => {
          const displayName = u.firstName && u.lastName 
            ? `${u.firstName} ${u.lastName}`
            : u.firstName || u.lastName || u.email || 'Unknown User';
          return {
            clerkId: u.clerkId,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            displayName,
          };
        });
        // Filter out current user
        setAvailableUsers(formattedUsers.filter((u: any) => u.clerkId !== user?.id));
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadCurrentShares = async () => {
    setIsLoadingShares(true);
    try {
      const response = await fetch(
        `/api/s3/folders/share?folderPrefix=${encodeURIComponent(folderPrefix)}`
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

      console.log('Sharing folder:', folderPrefix, 'with user:', targetClerkId);

      // Share the folder
      const shareResponse = await fetch('/api/s3/folders/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folderPrefix,
          sharedWithClerkIds: [targetClerkId],
          permission,
          note: note.trim() || undefined,
        }),
      });

      console.log('Share response:', shareResponse.status);

      if (!shareResponse.ok) {
        const errorData = await shareResponse.json();
        console.error('Share failed:', errorData);
        throw new Error(errorData.error || 'Failed to share folder');
      }

      const shareData = await shareResponse.json();
      console.log('Share successful:', shareData);

      setToast({
        title: 'Folder shared',
        description: `"${folderName}" has been shared with ${selectedUser.displayName}`,
        variant: 'success',
      });

      // Reset form and reload shares
      setSelectedUser(null);
      setUserSearchQuery('');
      setNote('');
      setPermission('VIEW');
      loadCurrentShares();
      
      // Notify parent component
      if (onShareComplete) {
        onShareComplete();
      }
    } catch (error) {
      console.error('Error sharing folder:', error);
      setToast({
        title: 'Failed to share folder',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveShare = async (sharedWithClerkId: string, displayName: string) => {
    try {
      const response = await fetch('/api/s3/folders/share', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folderPrefix,
          sharedWithClerkId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove share');
      }

      setToast({
        title: 'Share removed',
        description: `"${folderName}" is no longer shared with ${displayName}`,
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

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Share Folder: {folderName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Share this folder with other users. They will be able to view all contents in this folder.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Share with new user */}
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-white">Share with new user</h4>
            
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select User
              </label>
              <div className="relative user-dropdown-container">
                <input
                  type="text"
                  placeholder={selectedUser ? selectedUser.displayName : "Search users..."}
                  value={userSearchQuery}
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value);
                    setShowUserDropdown(true);
                  }}
                  onFocus={() => setShowUserDropdown(true)}
                  disabled={isLoading || isLoadingUsers}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {isLoadingUsers && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                )}
                
                {/* User dropdown */}
                {showUserDropdown && !isLoadingUsers && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {availableUsers
                      .filter(u => {
                        const query = userSearchQuery.toLowerCase();
                        return (
                          u.displayName.toLowerCase().includes(query) ||
                          (u.email && u.email.toLowerCase().includes(query))
                        );
                      })
                      .map((u) => (
                        <button
                          key={u.clerkId}
                          type="button"
                          onClick={() => {
                            setSelectedUser(u);
                            setUserSearchQuery('');
                            setShowUserDropdown(false);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900 dark:text-white">
                            {u.displayName}
                          </div>
                          {u.email && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {u.email}
                            </div>
                          )}
                        </button>
                      ))}
                    {availableUsers.filter(u => {
                      const query = userSearchQuery.toLowerCase();
                      return (
                        u.displayName.toLowerCase().includes(query) ||
                        (u.email && u.email.toLowerCase().includes(query))
                      );
                    }).length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                        No users found
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Selected user display */}
              {selectedUser && (
                <div className="mt-2 flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <div>
                    <div className="font-medium text-purple-900 dark:text-purple-100">
                      {selectedUser.displayName}
                    </div>
                    {selectedUser.email && (
                      <div className="text-sm text-purple-700 dark:text-purple-300">
                        {selectedUser.email}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-1 hover:bg-purple-200 dark:hover:bg-purple-800 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Permission Level
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPermission('VIEW')}
                  disabled={isLoading}
                  className={`relative flex items-start gap-3 p-4 border-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    permission === 'VIEW'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="shrink-0">
                    <Eye className={`w-5 h-5 ${permission === 'VIEW' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                  </div>
                  <div className="text-left">
                    <div className={`font-medium text-sm ${permission === 'VIEW' ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'}`}>
                      Viewer
                    </div>
                    <div className={`text-xs mt-0.5 ${permission === 'VIEW' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                      Can view and download files only
                    </div>
                  </div>
                  {permission === 'VIEW' && (
                    <div className="absolute top-2 right-2">
                      <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPermission('EDIT')}
                  disabled={isLoading}
                  className={`relative flex items-start gap-3 p-4 border-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    permission === 'EDIT'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="shrink-0">
                    <Edit3 className={`w-5 h-5 ${permission === 'EDIT' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`} />
                  </div>
                  <div className="text-left">
                    <div className={`font-medium text-sm ${permission === 'EDIT' ? 'text-purple-900 dark:text-purple-100' : 'text-gray-900 dark:text-white'}`}>
                      Editor
                    </div>
                    <div className={`text-xs mt-0.5 ${permission === 'EDIT' ? 'text-purple-700 dark:text-purple-300' : 'text-gray-500 dark:text-gray-400'}`}>
                      Can view, download, and upload files
                    </div>
                  </div>
                  {permission === 'EDIT' && (
                    <div className="absolute top-2 right-2">
                      <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    </div>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Note (Optional)
              </label>
              <textarea
                placeholder="Add a note about this share..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isLoading}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              />
            </div>

            <button
              onClick={handleShare}
              disabled={isLoading || !selectedUser}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Share Folder
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
                  Share this folder to collaborate with others
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
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm border-2 border-purple-200 dark:border-purple-800">
                          {(share.sharedWithUser?.displayName || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {share.sharedWithUser?.displayName || 'Unknown User'}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md ${
                            share.permission === 'VIEW'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          }`}
                        >
                          {share.permission === 'VIEW' ? (
                            <>
                              <Eye className="w-3 h-3" />
                              View
                            </>
                          ) : (
                            <>
                              <Edit3 className="w-3 h-3" />
                              Edit
                            </>
                          )}
                        </span>
                      </div>
                      
                      {share.sharedWithUser?.email && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{share.sharedWithUser.email}</span>
                        </div>
                      )}
                      
                      {share.note && (
                        <div className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400 mt-2 p-2 bg-gray-100/70 dark:bg-gray-800/70 rounded-md">
                          <Info className="w-3 h-3 shrink-0 mt-0.5" />
                          <span className="italic">"{share.note}"</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mt-2">
                        <Calendar className="w-3 h-3" />
                        <span>
                          Shared {new Date(share.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() =>
                        handleRemoveShare(
                          share.sharedWithClerkId,
                          share.sharedWithUser?.displayName || 'user'
                        )
                      }
                      className="shrink-0 p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Remove access"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-2">Permission Levels</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
                  <Eye className="w-3 h-3 shrink-0 mt-0.5" />
                  <span><strong>Viewer:</strong> Can view and download files only. Cannot upload or generate new content to this folder.</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
                  <Edit3 className="w-3 h-3 shrink-0 mt-0.5" />
                  <span><strong>Editor:</strong> Can view, download, and generate new content directly into this folder.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] animate-in slide-in-from-top-2">
          <div
            className={`px-4 py-3 rounded-lg shadow-lg border max-w-md ${
              toast.variant === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    toast.variant === 'error'
                      ? 'text-red-900 dark:text-red-200'
                      : 'text-green-900 dark:text-green-200'
                  }`}
                >
                  {toast.title}
                </p>
                <p
                  className={`text-sm mt-1 ${
                    toast.variant === 'error'
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-green-700 dark:text-green-300'
                  }`}
                >
                  {toast.description}
                </p>
              </div>
              <button
                onClick={() => setToast(null)}
                className={`shrink-0 ${
                  toast.variant === 'error'
                    ? 'text-red-400 hover:text-red-600'
                    : 'text-green-400 hover:text-green-600'
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}
