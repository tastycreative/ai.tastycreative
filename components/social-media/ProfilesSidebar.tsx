'use client';

import React, { useEffect, useState } from 'react';
import { Instagram, Check } from 'lucide-react';
import { Profile } from './types';
import { toast } from 'sonner';

export default function ProfilesSidebar() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  // Load selected profile from localStorage on mount
  useEffect(() => {
    const savedProfileId = localStorage.getItem('selectedProfileId');
    if (savedProfileId) {
      setSelectedProfileId(savedProfileId);
      window.dispatchEvent(new CustomEvent('profileChanged', { detail: { profileId: savedProfileId } }));
    }
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/instagram/profiles');
      if (response.ok) {
        const data = await response.json();
        const profilesList = data.profiles || data;
        setProfiles(Array.isArray(profilesList) ? profilesList : []);
        
        // Check if there's a saved profile in localStorage
        const savedProfileId = localStorage.getItem('selectedProfileId');
        if (savedProfileId && profilesList.some((p: Profile) => p.id === savedProfileId)) {
          setSelectedProfileId(savedProfileId);
          window.dispatchEvent(new CustomEvent('profileChanged', { detail: { profileId: savedProfileId } }));
        } else {
          // Set default profile as selected or first profile
          const defaultProfile = profilesList.find((p: Profile) => p.isDefault) || profilesList[0];
          if (defaultProfile) {
            setSelectedProfileId(defaultProfile.id);
            localStorage.setItem('selectedProfileId', defaultProfile.id);
            window.dispatchEvent(new CustomEvent('profileChanged', { detail: { profileId: defaultProfile.id } }));
          }
        }
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast.error('Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileClick = (profileId: string) => {
    setSelectedProfileId(profileId);
    localStorage.setItem('selectedProfileId', profileId);
    // You can emit an event or use a context to notify other components about profile change
    window.dispatchEvent(new CustomEvent('profileChanged', { detail: { profileId } }));
  };

  if (loading) {
    return (
      <>
        {/* Mobile Loading */}
        <div className="lg:hidden">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-20 space-y-2 animate-pulse">
                <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Desktop Loading */}
        <div className="hidden lg:block sticky top-4 bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile Horizontal Scroll - Only visible on mobile */}
      <div className="lg:hidden">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {profiles.length === 0 ? (
            <div className="w-full text-center py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">No profiles available</p>
            </div>
          ) : (
            profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleProfileClick(profile.id)}
                className="flex-shrink-0 flex flex-col items-center gap-2 group"
              >
                {/* Story ring wrapper */}
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
                        <Instagram className="w-7 h-7 text-white" />
                      </div>
                    )}
                  </div>
                  {/* Selection indicator */}
                  {selectedProfileId === profile.id && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center shadow-lg">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
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
            ))
          )}
        </div>
      </div>

      {/* Desktop Sidebar - Hidden on mobile */}
      <div className="hidden lg:block sticky top-4 bg-gradient-to-br from-white via-purple-50/30 to-pink-50/30 dark:from-gray-900 dark:via-purple-950/20 dark:to-pink-950/20 rounded-2xl shadow-xl border border-purple-200/50 dark:border-purple-800/50 overflow-hidden backdrop-blur-xl">
      {/* Header */}
      <div className="p-6 border-b border-purple-200/50 dark:border-purple-800/50 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-950/30 dark:to-pink-950/30">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 dark:from-purple-400 dark:via-pink-400 dark:to-blue-400 bg-clip-text text-transparent">
            Profiles
          </h2>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold shadow-lg">
              {profiles.length}
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
          Select a profile to view its feed
        </p>
      </div>

      {/* Profiles List */}
      <div className="p-4 space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">{profiles.length === 0 ? (
          <div className="text-center py-12">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur-xl opacity-50 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 p-6 rounded-full">
                <Instagram className="w-12 h-12 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              No profiles available
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Create your first profile to get started
            </p>
          </div>
        ) : (
          <>
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleProfileClick(profile.id)}
                className={`relative w-full p-4 rounded-xl border-2 transition-all duration-300 text-left group overflow-hidden ${
                  selectedProfileId === profile.id
                    ? 'border-transparent bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 shadow-2xl shadow-purple-500/50 scale-[1.02]'
                    : 'border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-xl hover:scale-[1.02] bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm'
                }`}
              >
                {/* Animated background for selected */}
                {selectedProfileId === profile.id && (
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-pink-600/20 to-blue-600/20 animate-pulse"></div>
                )}
                
                <div className="relative flex items-start gap-3">
                  {/* Profile Image with Story Ring */}
                  <div className="relative flex-shrink-0">
                    {/* Gradient ring */}
                    <div className={`absolute inset-0 rounded-full transition-all duration-300 ${
                      selectedProfileId === profile.id
                        ? 'bg-gradient-to-br from-white via-yellow-200 to-white p-[3px] scale-110 shadow-lg shadow-white/50'
                        : 'bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 p-[2.5px] opacity-0 group-hover:opacity-100 scale-100 group-hover:scale-110'
                    }`}>
                      <div className="w-full h-full rounded-full bg-white dark:bg-gray-900"></div>
                    </div>
                    
                    {profile.profileImageUrl ? (
                      <img
                        src={profile.profileImageUrl}
                        alt={profile.name}
                        className="relative w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-gray-900"
                      />
                    ) : (
                      <div className={`relative w-12 h-12 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-900 ${
                        selectedProfileId === profile.id
                          ? 'bg-gradient-to-br from-white to-gray-100'
                          : 'bg-gradient-to-br from-purple-500 to-blue-500'
                      }`}>
                        <Instagram className={`w-6 h-6 ${
                          selectedProfileId === profile.id ? 'text-purple-600' : 'text-white'
                        }`} />
                      </div>
                    )}
                    
                    {/* Online indicator */}
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                      selectedProfileId === profile.id
                        ? 'bg-green-500 border-white shadow-lg shadow-green-500/50'
                        : 'bg-gray-400 border-white dark:border-gray-900'
                    }`}></div>
                  </div>

                  {/* Profile Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-bold truncate text-base ${
                        selectedProfileId === profile.id
                          ? 'text-white'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {profile.name}
                      </h3>
                      {profile.isDefault && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          selectedProfileId === profile.id
                            ? 'bg-white/20 border border-white/30 text-white'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                        }`}>
                          DEFAULT
                        </span>
                      )}
                    </div>
                    
                    {profile.instagramUsername && (
                      <p className={`text-sm truncate mb-2 ${
                        selectedProfileId === profile.id
                          ? 'text-white/90 font-medium'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        @{profile.instagramUsername}
                      </p>
                    )}
                    
                    {/* Metrics */}
                    <div className="flex items-center gap-3 text-xs font-semibold">
                      <div className={`flex items-center gap-1 ${
                        selectedProfileId === profile.id ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          selectedProfileId === profile.id ? 'bg-white/90' : 'bg-purple-500'
                        }`}></div>
                        <span>{profile._count?.feedPosts || 0} posts</span>
                      </div>
                      <div className={`flex items-center gap-1 ${
                        selectedProfileId === profile.id ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          selectedProfileId === profile.id ? 'bg-white/90' : 'bg-pink-500'
                        }`}></div>
                        <span>{profile._count?.friends || 0} friends</span>
                      </div>
                    </div>
                    
                    {profile.description && (
                      <p className={`text-xs mt-2 line-clamp-2 ${
                        selectedProfileId === profile.id
                          ? 'text-white/80'
                          : 'text-gray-500 dark:text-gray-500'
                      }`}>
                        {profile.description}
                      </p>
                    )}
                  </div>

                  {/* Selection Indicator */}
                  {selectedProfileId === profile.id && (
                    <div className="flex-shrink-0 animate-in zoom-in duration-300">
                      <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-lg">
                        <Check className="w-5 h-5 text-purple-600" />
                      </div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </>
        )}
      </div>
      </div>
    </>
  );
}
