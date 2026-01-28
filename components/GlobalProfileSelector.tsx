'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import { useInstagramProfile, Profile, ALL_PROFILES_OPTION } from '@/hooks/useInstagramProfile';
import { ChevronDown, User, Check, Plus, Instagram, Loader2, Sparkles, Star, Users, ChevronUp, Building2, FolderOpen } from 'lucide-react';
import Link from 'next/link';

export function GlobalProfileSelector() {
  const params = useParams();
  const tenant = params.tenant as string;
  const {
    profileId,
    setProfileId,
    profiles,
    selectedProfile,
    loadingProfiles,
    isAllProfiles,
  } = useInstagramProfile();

  // Sort profiles by name
  const sortedProfiles = useMemo(() => {
    return [...profiles].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
  }, [profiles]);

  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Mount state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.top,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const dropdownElement = document.querySelector('[data-profile-dropdown]');
      
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(target) &&
        (!dropdownElement || !dropdownElement.contains(target))
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleProfileSelect = (profile: Profile | typeof ALL_PROFILES_OPTION) => {
    setProfileId(profile.id);
    setIsOpen(false);
    
    // Also dispatch a custom event for components that listen to profile changes
    window.dispatchEvent(new CustomEvent('profileChanged', { detail: { profileId: profile.id } }));
  };

  if (loadingProfiles) {
    return (
      <div className="w-full p-3 rounded-2xl bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-fuchsia-500/5 border border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center animate-pulse">
            <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
            <div className="h-2 w-16 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <Link
        href={`/${tenant}/workspace/creators`}
        className="group w-full flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 hover:from-violet-500/20 hover:via-purple-500/20 hover:to-fuchsia-500/20 border border-violet-500/20 hover:border-violet-500/40 transition-all duration-300"
      >
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-105 transition-transform">
          <Plus className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Create Profile</p>
          <p className="text-[11px] text-violet-300/60">Add your first creator</p>
        </div>
      </Link>
    );
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Main Trigger Button - Full Width Card Style */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          group w-full flex items-center gap-3 p-3
          rounded-2xl transition-all duration-300
          ${isOpen 
            ? 'bg-gradient-to-r from-violet-500/15 via-purple-500/15 to-fuchsia-500/15 border-violet-500/30 ring-1 ring-violet-500/20' 
            : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06] hover:border-white/[0.1]'
          }
          border focus:outline-none
        `}
      >
        {/* Profile Avatar */}
        <div className="relative flex-shrink-0">
          <div className={`
            w-11 h-11 rounded-xl overflow-hidden transition-all
            ${isOpen ? 'ring-2 ring-violet-400/40' : 'ring-1 ring-white/10 group-hover:ring-white/20'}
          `}>
            {isAllProfiles ? (
              <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-white" />
              </div>
            ) : selectedProfile?.profileImageUrl ? (
              <img
                src={selectedProfile.profileImageUrl}
                alt={selectedProfile.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Instagram className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
          {/* Online indicator - hide for All Profiles */}
          {!isAllProfiles && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#0d0d12]" />
          )}
        </div>
        
        {/* Profile Info */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-white truncate">
              {selectedProfile?.name || 'Select Profile'}
            </p>
            {selectedProfile?.organization ? (
              <Building2 className="w-3 h-3 text-blue-400 flex-shrink-0" />
            ) : !isAllProfiles ? (
              <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
            ) : null}
          </div>
          <p className="text-[11px] text-white/40 truncate">
            {isAllProfiles 
              ? `${profiles.length} profile${profiles.length !== 1 ? 's' : ''}`
              : selectedProfile?.instagramUsername
                ? `@${selectedProfile.instagramUsername}`
                : selectedProfile?.organization
                  ? `Shared · ${selectedProfile.organization.name}`
                  : 'Active Creator'}
          </p>
        </div>
        
        {/* Chevron */}
        <div className={`
          w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
          ${isOpen ? 'bg-violet-500/20' : 'bg-white/5 group-hover:bg-white/10'}
          transition-all
        `}>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-violet-300" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/50 group-hover:text-white/70" />
          )}
        </div>
      </button>

      {/* Dropdown Menu - React Portal */}
      {mounted && isOpen && createPortal(
        <div 
          data-profile-dropdown
          className="fixed bg-[#13131a] backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/50 border border-white/10 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            top: `${dropdownPosition.top + 60}px`,
            left: `${dropdownPosition.left}px`,
            width: `${Math.max(dropdownPosition.width, 280)}px`,
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-semibold text-white/70">Switch Workspace</span>
            </div>
          </div>
          
          {/* Profile List */}
          <div className="max-h-64 overflow-y-auto py-2 px-2">
            {/* All Profiles Option */}
            <button
              onClick={() => handleProfileSelect(ALL_PROFILES_OPTION)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 mb-2
                ${isAllProfiles
                  ? 'bg-emerald-500/15 border border-emerald-500/25'
                  : 'hover:bg-white/5 border border-transparent'
                }
              `}
            >
              {/* All Profiles Icon */}
              <div className="relative flex-shrink-0">
                <div className={`
                  w-10 h-10 rounded-xl overflow-hidden
                  ${isAllProfiles ? 'ring-2 ring-emerald-400/40' : 'ring-1 ring-white/10'}
                `}>
                  <div className={`w-full h-full flex items-center justify-center ${
                    isAllProfiles
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                      : 'bg-gradient-to-br from-gray-600 to-gray-700'
                  }`}>
                    <FolderOpen className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>
              
              {/* All Profiles Info */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-medium text-sm truncate ${
                    isAllProfiles ? 'text-white' : 'text-white/80'
                  }`}>
                    All Profiles
                  </p>
                  <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full font-semibold border border-emerald-500/30">
                    {profiles.length}
                  </span>
                </div>
                <p className="text-[10px] text-white/40 truncate">
                  View all profile folders
                </p>
              </div>
              
              {/* Selected Check */}
              {isAllProfiles && (
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>

            {/* Divider */}
            <div className="mx-2 my-2 border-t border-white/[0.06]" />

            {/* Individual Profiles */}
            {sortedProfiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleProfileSelect(profile)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 mb-1 last:mb-0
                  ${profile.id === profileId
                    ? 'bg-violet-500/15 border border-violet-500/25'
                    : 'hover:bg-white/5 border border-transparent'
                  }
                `}
              >
                {/* Profile Image */}
                <div className="relative flex-shrink-0">
                  <div className={`
                    w-10 h-10 rounded-xl overflow-hidden
                    ${profile.id === profileId ? 'ring-2 ring-violet-400/40' : 'ring-1 ring-white/10'}
                  `}>
                    {profile.profileImageUrl ? (
                      <img
                        src={profile.profileImageUrl}
                        alt={profile.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${
                        profile.id === profileId
                          ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500'
                          : 'bg-gradient-to-br from-gray-600 to-gray-700'
                      }`}>
                        <Instagram className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Profile Info */}
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={`font-medium text-sm truncate ${
                      profile.id === profileId ? 'text-white' : 'text-white/80'
                    }`}>
                      {profile.name}
                    </p>
                    {profile.isDefault && (
                      <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-semibold border border-amber-500/30">
                        <Star className="w-2 h-2" />
                        DEFAULT
                      </span>
                    )}
                    {profile.organization && (
                      <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded-full font-semibold border border-blue-500/30">
                        <Building2 className="w-2 h-2" />
                        SHARED
                      </span>
                    )}
                  </div>
                  {profile.instagramUsername ? (
                    <p className="text-[10px] text-white/40 truncate">
                      @{profile.instagramUsername}
                    </p>
                  ) : profile.organization ? (
                    <p className="text-[10px] text-blue-400/60 truncate">
                      {profile.organization.name}
                    </p>
                  ) : null}
                </div>
                
                {/* Selected Check */}
                {profile.id === profileId && (
                  <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
          
          {/* Footer */}
          <div className="border-t border-white/[0.06] p-2">
            <Link
              href={`/${tenant}/workspace/creators`}
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-xs font-semibold text-violet-300 hover:text-white hover:bg-violet-500/15 rounded-xl transition-all duration-200"
            >
              <User className="w-3.5 h-3.5" />
              Manage Profiles
            </Link>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
