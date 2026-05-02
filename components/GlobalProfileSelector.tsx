'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import { useUser } from "@/lib/clerk-compat-client";
import { useInstagramProfile, Profile, ALL_PROFILES_OPTION } from '@/hooks/useInstagramProfile';
import { useProfileGroups, useAddProfilesToGroup, useRemoveProfileFromGroup } from '@/lib/hooks/useProfileGroups.query';
import { useProfilePins, useToggleProfilePin, useReorderProfilePins } from '@/lib/hooks/useProfilePins.query';
import { 
  ChevronDown, User, Check, Plus, Instagram, Loader2, 
  Sparkles, Star, Users, ChevronUp, Building2, FolderOpen, 
  Share2, Pin, ChevronRight, Settings2, Folder, ExternalLink,
  FolderPlus, PinOff, MoreVertical
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export function GlobalProfileSelector() {
  const params = useParams();
  const tenant = params.tenant as string;
  const { user: clerkUser } = useUser();
  const {
    profileId,
    setProfileId,
    profiles,
    selectedProfile,
    loadingProfiles,
    isAllProfiles,
  } = useInstagramProfile();
  
  // Fetch groups and pins
  const { data: groups = [], isLoading: loadingGroups } = useProfileGroups();
  const { data: pinnedProfiles = [], isLoading: loadingPins } = useProfilePins();
  
  // Mutations
  const togglePin = useToggleProfilePin();
  const reorderPins = useReorderProfilePins();
  const addProfilesToGroup = useAddProfilesToGroup();
  const removeProfileFromGroup = useRemoveProfileFromGroup();
  
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    profile: Profile;
    groupId?: string;
  } | null>(null);

  // Helper to check if a profile is pinned
  const isPinned = (profileId: string) => {
    return pinnedProfiles.some(pin => pin.profileId === profileId);
  };

  // Helper to check if a profile is owned by the current user
  const isOwnProfile = (profile: Profile) => {
    return profile.clerkId === clerkUser?.id || profile.user?.clerkId === clerkUser?.id;
  };

  // Helper to get owner display name for shared profiles
  const getOwnerDisplayName = (profile: Profile) => {
    if (!profile.user) return null;
    if (profile.user.firstName && profile.user.lastName) {
      return `${profile.user.firstName} ${profile.user.lastName}`;
    }
    if (profile.user.firstName) return profile.user.firstName;
    if (profile.user.name) return profile.user.name;
    if (profile.user.email) return profile.user.email.split('@')[0];
    return null;
  };

  // Get profiles that are not in any group (ungrouped)
  const ungroupedProfiles = useMemo(() => {
    const groupedProfileIds = new Set(
      groups.flatMap(group => group.members.map(m => m.profileId))
    );
    return profiles.filter(profile => !groupedProfileIds.has(profile.id));
  }, [profiles, groups]);

  // Toggle group collapse
  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };
  
  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, profile: Profile, groupId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      profile,
      groupId,
    });
  };
  
  const closeContextMenu = () => {
    setContextMenu(null);
  };
  
  const handlePinToggle = async (profile: Profile) => {
    closeContextMenu();
    await togglePin.mutateAsync(profile.id);
    const pinned = isPinned(profile.id);
    toast.success(pinned ? `Unpinned ${profile.name}` : `Pinned ${profile.name}`);
  };
  
  const handleAddToGroup = async (profile: Profile, groupId: string) => {
    closeContextMenu();
    try {
      await addProfilesToGroup.mutateAsync({
        groupId,
        profileIds: [profile.id],
      });
      
      const group = groups.find(g => g.id === groupId);
      toast.success(`Added ${profile.name} to ${group?.name || 'group'}`);
    } catch (error) {
      toast.error('Profile already in this group');
    }
  };
  
  const handleRemoveFromGroup = async (profile: Profile, groupId: string) => {
    closeContextMenu();
    await removeProfileFromGroup.mutateAsync({
      groupId,
      profileId: profile.id,
    });
    
    const group = groups.find(g => g.id === groupId);
    toast.success(`Removed ${profile.name} from ${group?.name || 'group'}`);
  };

  // Sort profiles: owned first, then shared (each group sorted by name)
  const sortedProfiles = useMemo(() => {
    return [...profiles].sort((a, b) => {
      const aIsOwn = isOwnProfile(a);
      const bIsOwn = isOwnProfile(b);
      
      // Own profiles come first
      if (aIsOwn && !bIsOwn) return -1;
      if (!aIsOwn && bIsOwn) return 1;
      
      // Within same category, default profiles come first
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      
      // Then sort by name
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });
  }, [profiles, clerkUser?.id]);

  // Render a single profile item
  const renderProfileItem = (profile: Profile, isPinnedItem = false, groupId?: string) => {
    const isSelected = profile.id === profileId;
    const pinned = isPinned(profile.id);
    
    return (
      <button
        key={profile.id}
        onClick={() => handleProfileSelect(profile)}
        onContextMenu={(e) => handleContextMenu(e, profile, groupId)}
        className={`
          w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 mb-1
          ${isSelected
            ? 'bg-sidebar-accent border-2 border-[#EC67A1]/30'
            : 'hover:bg-sidebar-accent border-2 border-transparent hover:border-[#EC67A1]/20'
          }
        `}
        title="Right-click for quick actions"
      >
        {/* Profile Image */}
        <div className="relative flex-shrink-0">
          <div className={`
            w-10 h-10 rounded-xl overflow-hidden
            ${isSelected ? 'ring-2 ring-[#EC67A1]/40' : 'ring-1 ring-sidebar-border'}
          `}>
            {profile.profileImageUrl ? (
              <img
                src={profile.profileImageUrl}
                alt={profile.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${
                isSelected
                  ? 'bg-gradient-to-br from-[#EC67A1] to-[#F774B9]'
                  : 'bg-gradient-to-br from-[#EC67A1]/50 to-[#F774B9]/50'
              }`}>
                <Instagram className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
          {/* Pin indicator */}
          {pinned && !isPinnedItem && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-sidebar flex items-center justify-center">
              <Pin className="w-2 h-2 text-white fill-white" />
            </div>
          )}
        </div>
        
        {/* Profile Info */}
        <div className="flex-1 text-left min-w-0">
          <p className={`font-medium text-sm truncate ${
            isSelected ? 'text-sidebar-foreground' : 'text-sidebar-foreground'
          }`}>
            {profile.name}
          </p>
          {profile.instagramUsername && (
            <p className="text-[10px] text-sidebar-foreground/50 truncate">
              @{profile.instagramUsername}
            </p>
          )}
        </div>
        
        {/* Selected Check / More Icon */}
        {isSelected ? (
          <div className="w-5 h-5 rounded-full bg-[#EC67A1] flex items-center justify-center flex-shrink-0">
            <Check className="w-3 h-3 text-white" />
          </div>
        ) : (
          <MoreVertical className="w-4 h-4 text-sidebar-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </button>
    );
  };

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
      const contextMenuElement = document.querySelector('[data-context-menu]');
      
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(target) &&
        (!dropdownElement || !dropdownElement.contains(target)) &&
        (!contextMenuElement || !contextMenuElement.contains(target))
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
        closeContextMenu();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);
  
  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => {
      closeContextMenu();
    };

    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const handleProfileSelect = (profile: Profile | typeof ALL_PROFILES_OPTION) => {
    setProfileId(profile.id);
    setIsOpen(false);
    
    // Also dispatch a custom event for components that listen to profile changes
    window.dispatchEvent(new CustomEvent('profileChanged', { detail: { profileId: profile.id } }));
  };

  if (loadingProfiles) {
    return (
      <div className="w-full p-3 rounded-2xl bg-sidebar-accent border border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-sidebar-accent flex items-center justify-center animate-pulse">
            <Loader2 className="w-5 h-5 text-[#EC67A1] animate-spin" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-sidebar-accent rounded animate-pulse" />
            <div className="h-2 w-16 bg-sidebar-accent/50 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <Link
        href={`/${tenant}/workspace/my-influencers`}
        className="group w-full flex items-center gap-3 p-3 rounded-2xl bg-sidebar-accent hover:bg-sidebar-accent/80 border-2 border-[#EC67A1]/20 hover:border-[#EC67A1]/40 transition-all duration-300"
      >
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#EC67A1] to-[#F774B9] flex items-center justify-center shadow-lg shadow-[#EC67A1]/30 group-hover:scale-105 transition-transform">
          <Plus className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-sidebar-foreground">Create Profile</p>
          <p className="text-[11px] text-sidebar-foreground/50">Add your first creator</p>
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
            ? 'bg-sidebar-accent border-2 border-[#EC67A1]/30 ring-1 ring-[#EC67A1]/20' 
            : 'bg-sidebar-accent hover:bg-sidebar-accent/80 border-2 border-transparent hover:border-[#EC67A1]/20'
          }
        `}
      >
        {/* Profile Avatar */}
        <div className="relative flex-shrink-0">
          <div className={`
            w-11 h-11 rounded-xl overflow-hidden transition-all
            ${isOpen ? 'ring-2 ring-[#EC67A1]/40' : 'ring-1 ring-sidebar-border group-hover:ring-[#EC67A1]/30'}
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
              <div className="w-full h-full bg-gradient-to-br from-[#EC67A1] to-[#F774B9] flex items-center justify-center">
                <Instagram className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
          {/* Indicator - show pin for pinned, share icon for shared profiles, green dot for own */}
          {!isAllProfiles && selectedProfile && isPinned(selectedProfile.id) ? (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-400 rounded-full border-2 border-sidebar flex items-center justify-center">
              <Pin className="w-2 h-2 text-white fill-white" />
            </div>
          ) : !isAllProfiles && selectedProfile && !isOwnProfile(selectedProfile) ? (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#5DC3F8] rounded-full border-2 border-sidebar flex items-center justify-center">
              <Share2 className="w-2 h-2 text-white" />
            </div>
          ) : !isAllProfiles ? (
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-sidebar" />
          ) : null}
        </div>
        
        {/* Profile Info */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">
              {selectedProfile?.name || 'Select Profile'}
            </p>
            {selectedProfile && !isAllProfiles && !isOwnProfile(selectedProfile) ? (
              <Share2 className="w-3 h-3 text-[#5DC3F8] flex-shrink-0" />
            ) : selectedProfile?.organization ? (
              <Building2 className="w-3 h-3 text-[#5DC3F8] flex-shrink-0" />
            ) : !isAllProfiles ? (
              <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
            ) : null}
          </div>
          <p className="text-[11px] text-sidebar-foreground/50 truncate">
            {isAllProfiles 
              ? `${profiles.length} profile${profiles.length !== 1 ? 's' : ''}`
              : selectedProfile && !isOwnProfile(selectedProfile)
                ? `Shared by ${getOwnerDisplayName(selectedProfile) || 'someone'}`
                : selectedProfile?.instagramUsername
                  ? `@${selectedProfile.instagramUsername}`
                  : 'Active Creator'}
          </p>
        </div>
        
        {/* Chevron */}
        <div className={`
          w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0
          ${isOpen ? 'bg-[#EC67A1]/20' : 'bg-sidebar-accent group-hover:bg-sidebar-accent/80'}
          transition-all
        `}>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-[#EC67A1]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#EC67A1]/70 group-hover:text-[#EC67A1]" />
          )}
        </div>
      </button>

      {/* Dropdown Menu - React Portal */}
      {mounted && isOpen && createPortal(
        <div 
          data-profile-dropdown
          className="fixed bg-sidebar backdrop-blur-xl rounded-2xl shadow-2xl border border-sidebar-border z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            top: `${dropdownPosition.top + 60}px`,
            left: `${dropdownPosition.left}px`,
            width: `${Math.max(dropdownPosition.width, 280)}px`,
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-sidebar-border bg-sidebar-accent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#EC67A1]" />
                <span className="text-xs font-semibold text-sidebar-foreground">Switch Workspace</span>
              </div>
              <Link
                href={`/${tenant}/workspace/my-influencers/manage-groups`}
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-sidebar-accent/80 transition-colors"
                title="Manage Groups"
              >
                <Settings2 className="w-3.5 h-3.5 text-sidebar-foreground/50 hover:text-[#EC67A1]" />
              </Link>
            </div>
          </div>
          
          {/* Profile List */}
          <div className="max-h-[500px] overflow-y-auto py-2 px-2 custom-scrollbar">
            {/* All Profiles Option */}
            <button
              onClick={() => handleProfileSelect(ALL_PROFILES_OPTION)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 mb-2
                ${isAllProfiles
                  ? 'bg-sidebar-accent border-2 border-emerald-500/30'
                  : 'hover:bg-sidebar-accent border-2 border-transparent hover:border-emerald-500/20'
                }
              `}
            >
              {/* All Profiles Icon */}
              <div className="relative flex-shrink-0">
                <div className={`
                  w-10 h-10 rounded-xl overflow-hidden
                  ${isAllProfiles ? 'ring-2 ring-emerald-400/40' : 'ring-1 ring-sidebar-border'}
                `}>
                  <div className={`w-full h-full flex items-center justify-center ${
                    isAllProfiles
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                      : 'bg-gradient-to-br from-emerald-500/50 to-teal-500/50'
                  }`}>
                    <FolderOpen className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>
              
              {/* All Profiles Info */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-medium text-sm truncate ${
                    isAllProfiles ? 'text-sidebar-foreground' : 'text-sidebar-foreground'
                  }`}>
                    All Profiles
                  </p>
                  <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full font-semibold border border-emerald-500/30">
                    {profiles.length}
                  </span>
                </div>
                <p className="text-[10px] text-sidebar-foreground/50 truncate">
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

            <div className="mx-2 my-2 border-t border-sidebar-border" />

            {/* Pinned/Favorites Section */}
            {pinnedProfiles.length > 0 && (
              <>
                <div className="px-3 py-1.5 flex items-center gap-2">
                  <Pin className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-wider">Pinned</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-amber-400/20 text-amber-600 dark:text-amber-400 rounded-full font-semibold">
                    {pinnedProfiles.length}
                  </span>
                </div>
                {pinnedProfiles.map(pin => {
                  const profile = profiles.find(p => p.id === pin.profileId);
                  return profile ? renderProfileItem(profile, true) : null;
                })}
                <div className="mx-2 my-2 border-t border-sidebar-border" />
              </>
            )}

            {/* Custom Groups */}
            {groups.map(group => (
              <div key={group.id} className="mb-2">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-sidebar-accent rounded-lg transition-colors"
                >
                  <ChevronRight className={`w-3 h-3 text-sidebar-foreground/50 transition-transform ${
                    !collapsedGroups.has(group.id) ? 'rotate-90' : ''
                  }`} />
                  <Folder className="w-3 h-3" style={{ color: group.color || '#EC67A1' }} />
                  <span className="text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-wider flex-1 text-left">
                    {group.name}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-[#EC67A1]/20 text-[#EC67A1] rounded-full font-semibold">
                    {group.members.length}
                  </span>
                </button>
                
                {/* Group Members */}
                {!collapsedGroups.has(group.id) && (
                  <div className="ml-3 mt-1">
                    {group.members.map(member => {
                      const profile = profiles.find(p => p.id === member.profileId);
                      return profile ? renderProfileItem(profile, false, group.id) : null;
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Ungrouped Profiles */}
            {ungroupedProfiles.length > 0 && (
              <>
                {(groups.length > 0 || pinnedProfiles.length > 0) && (
                  <div className="mx-2 my-2 border-t border-sidebar-border" />
                )}
                <div className="px-3 py-1.5 flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-[#EC67A1]" />
                  <span className="text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-wider">Ungrouped</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-[#EC67A1]/20 text-[#EC67A1] rounded-full font-semibold">
                    {ungroupedProfiles.length}
                  </span>
                </div>
                {ungroupedProfiles.map(profile => renderProfileItem(profile))}
              </>
            )}
          </div>
          
          {/* Footer */}
          <div className="border-t border-sidebar-border p-2">
            <Link
              href={`/${tenant}/workspace/my-influencers`}
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-xs font-semibold text-[#EC67A1] hover:text-sidebar-foreground hover:bg-[#EC67A1]/15 rounded-xl transition-all duration-200"
            >
              <User className="w-3.5 h-3.5" />
              Manage Profiles
            </Link>
          </div>
        </div>,
        document.body
      )}
      
      {/* Context Menu */}
      {mounted && contextMenu && createPortal(
        <div
          data-context-menu
          className="fixed bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-800 py-1 min-w-[180px] z-[200] animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Go to Profile */}
          <Link
            href={`/${tenant}/workspace/my-influencers/${contextMenu.profile.id}`}
            onClick={() => {
              setIsOpen(false);
              closeContextMenu();
            }}
            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Go to Profile</span>
          </Link>
          
          <div className="my-1 border-t border-gray-200 dark:border-gray-800" />
          
          {/* Pin/Unpin */}
          <button
            onClick={() => handlePinToggle(contextMenu.profile)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {isPinned(contextMenu.profile.id) ? (
              <>
                <PinOff className="w-4 h-4" />
                <span>Unpin from Top</span>
              </>
            ) : (
              <>
                <Pin className="w-4 h-4" />
                <span>Pin to Top</span>
              </>
            )}
          </button>
          
          {/* Remove from Group (if in a group) */}
          {contextMenu.groupId && (
            <button
              onClick={() => handleRemoveFromGroup(contextMenu.profile, contextMenu.groupId!)}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Folder className="w-4 h-4" />
              <span>Remove from Group</span>
            </button>
          )}
          
          {/* Add to Group submenu */}
          {groups.length > 0 && (
            <>
              <div className="my-1 border-t border-gray-200 dark:border-gray-800" />
              <div className="px-4 py-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">
                  <FolderPlus className="w-3 h-3" />
                  Add to Group
                </div>
              </div>
              {groups.map(group => {
                const alreadyInGroup = group.members.some(m => m.profileId === contextMenu.profile.id);
                return (
                  <button
                    key={group.id}
                    onClick={() => !alreadyInGroup && handleAddToGroup(contextMenu.profile, group.id)}
                    disabled={alreadyInGroup}
                    className={`w-full flex items-center gap-3 px-6 py-2 text-sm transition-colors ${
                      alreadyInGroup
                        ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: group.color || '#EC67A1' }}
                    />
                    <span className="flex-1 text-left truncate">{group.name}</span>
                    {alreadyInGroup && (
                      <Check className="w-3 h-3 text-gray-400" />
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
