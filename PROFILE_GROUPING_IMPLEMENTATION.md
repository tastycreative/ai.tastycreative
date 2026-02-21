# Profile Grouping System - Implementation Guide

## 🎯 Overview

This guide provides a complete implementation for organizing Instagram profiles into custom groups with favorites/pinning support.

---

## 📊 Database Schema

### 1. Prisma Schema Updates

Add these models to your `schema.prisma`:

```prisma
// Profile Groups - Organizations can create custom groups
model ProfileGroup {
  id             String                  @id @default(cuid())
  organizationId String
  name           String                  // e.g., "Daily Models", "VIP", "High Priority"
  color          String?                 // Optional color for visual distinction (hex)
  icon           String?                 // Optional emoji or icon name
  order          Int                     @default(0) // For custom sorting
  isCollapsed    Boolean                 @default(false) // Remember collapsed state per user
  createdAt      DateTime                @default(now())
  updatedAt      DateTime                @updatedAt
  
  organization   Organization            @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  members        ProfileGroupMember[]
  
  @@unique([organizationId, name]) // Prevent duplicate group names within org
  @@index([organizationId])
  @@index([organizationId, order])
  @@map("profile_groups")
}

// Many-to-Many relationship: Profiles can belong to multiple groups
model ProfileGroupMember {
  id             String           @id @default(cuid())
  profileGroupId String
  profileId      String
  order          Int              @default(0) // Custom order within the group
  addedAt        DateTime         @default(now())
  
  group          ProfileGroup     @relation(fields: [profileGroupId], references: [id], onDelete: Cascade)
  profile        InstagramProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  
  @@unique([profileGroupId, profileId]) // A profile can only be in a group once
  @@index([profileGroupId])
  @@index([profileId])
  @@map("profile_group_members")
}

// User-specific pinned/favorite profiles (per user, not org-wide)
model ProfilePin {
  id        String           @id @default(cuid())
  userId    String           // Clerk user ID
  profileId String
  order     Int              @default(0) // For custom sorting
  pinnedAt  DateTime         @default(now())
  
  user      User             @relation(fields: [userId], references: [clerkId], onDelete: Cascade)
  profile   InstagramProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  
  @@unique([userId, profileId]) // A user can only pin a profile once
  @@index([userId])
  @@index([profileId])
  @@map("profile_pins")
}
```

### 2. Update Existing Models

Add these relations to existing models:

```prisma
model InstagramProfile {
  // ... existing fields ...
  
  // Add these relations
  groupMemberships ProfileGroupMember[]
  pinnedBy         ProfilePin[]
}

model Organization {
  // ... existing fields ...
  
  // Add this relation
  profileGroups    ProfileGroup[]
}

model User {
  // ... existing fields ...
  
  // Add this relation
  pinnedProfiles   ProfilePin[]
}
```

---

## 🔧 Backend API Endpoints

Create the following API routes:

### 1. `/api/profile-groups`

```typescript
// GET /api/profile-groups - List all groups for organization
// POST /api/profile-groups - Create new group
// PATCH /api/profile-groups/[id] - Update group (rename, reorder, etc.)
// DELETE /api/profile-groups/[id] - Delete group
```

### 2. `/api/profile-groups/[id]/members`

```typescript
// POST - Add profiles to group
// DELETE /api/profile-groups/[id]/members/[profileId] - Remove profile from group
// PATCH - Reorder profiles within group
```

### 3. `/api/profiles/pins`

```typescript
// GET /api/profiles/pins - Get user's pinned profiles
// POST /api/profiles/pins - Pin a profile
// DELETE /api/profiles/pins/[profileId] - Unpin a profile
// PATCH /api/profiles/pins/reorder - Reorder pinned profiles
```

---

## 🎨 Frontend Implementation

### 1. TanStack Query Hooks

Create `lib/hooks/useProfileGroups.query.ts`:

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { useOrganization } from '@/hooks/useOrganization';

export interface ProfileGroup {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  order: number;
  isCollapsed: boolean;
  memberCount: number;
  members: {
    id: string;
    profileId: string;
    order: number;
    profile: {
      id: string;
      name: string;
      profileImageUrl?: string;
      instagramUsername?: string;
    };
  }[];
}

// Fetch all groups with members
async function fetchProfileGroups(organizationId: string): Promise<ProfileGroup[]> {
  const response = await fetch(`/api/profile-groups?organizationId=${organizationId}`);
  if (!response.ok) throw new Error('Failed to fetch groups');
  return response.json();
}

export function useProfileGroups() {
  const { user } = useUser();
  const { currentOrganization } = useOrganization();
  
  return useQuery({
    queryKey: ['profile-groups', currentOrganization?.id],
    queryFn: () => fetchProfileGroups(currentOrganization!.id),
    enabled: !!user && !!currentOrganization,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Create group
export function useCreateProfileGroup() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  
  return useMutation({
    mutationFn: async (data: { name: string; color?: string; icon?: string }) => {
      const response = await fetch('/api/profile-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, organizationId: currentOrganization?.id }),
      });
      if (!response.ok) throw new Error('Failed to create group');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-groups'] });
    },
  });
}

// Add profiles to group
export function useAddProfilesToGroup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ groupId, profileIds }: { groupId: string; profileIds: string[] }) => {
      const response = await fetch(`/api/profile-groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileIds }),
      });
      if (!response.ok) throw new Error('Failed to add profiles');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-groups'] });
    },
  });
}

// Remove profile from group
export function useRemoveProfileFromGroup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ groupId, profileId }: { groupId: string; profileId: string }) => {
      const response = await fetch(`/api/profile-groups/${groupId}/members/${profileId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove profile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-groups'] });
    },
  });
}

// Delete group
export function useDeleteProfileGroup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (groupId: string) => {
      const response = await fetch(`/api/profile-groups/${groupId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete group');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-groups'] });
    },
  });
}
```

Create `lib/hooks/useProfilePins.query.ts`:

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export interface ProfilePin {
  id: string;
  userId: string;
  profileId: string;
  order: number;
  profile: {
    id: string;
    name: string;
    profileImageUrl?: string;
    instagramUsername?: string;
  };
}

// Fetch pinned profiles
async function fetchProfilePins(userId: string): Promise<ProfilePin[]> {
  const response = await fetch(`/api/profiles/pins?userId=${userId}`);
  if (!response.ok) throw new Error('Failed to fetch pins');
  return response.json();
}

export function useProfilePins() {
  const { user } = useUser();
  
  return useQuery({
    queryKey: ['profile-pins', user?.id],
    queryFn: () => fetchProfilePins(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
}

// Toggle pin (pin or unpin)
export function useToggleProfilePin() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  
  return useMutation({
    mutationFn: async ({ profileId, isPinned }: { profileId: string; isPinned: boolean }) => {
      if (isPinned) {
        // Unpin
        const response = await fetch(`/api/profiles/pins/${profileId}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to unpin');
        return response.json();
      } else {
        // Pin
        const response = await fetch('/api/profiles/pins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId }),
        });
        if (!response.ok) throw new Error('Failed to pin');
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-pins', user?.id] });
    },
  });
}
```

### 2. Updated GlobalProfileSelector Component

Replace `components/GlobalProfileSelector.tsx` with a grouped version:

```typescript
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useInstagramProfile, Profile, ALL_PROFILES_OPTION } from '@/hooks/useInstagramProfile';
import { useProfileGroups } from '@/lib/hooks/useProfileGroups.query';
import { useProfilePins } from '@/lib/hooks/useProfilePins.query';
import { 
  ChevronDown, User, Check, Plus, Instagram, Loader2, 
  Sparkles, Star, Users, ChevronUp, Building2, FolderOpen, 
  Share2, Pin, ChevronRight, Settings2, Folder 
} from 'lucide-react';
import Link from 'next/link';

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
  
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Helper to check if a profile is pinned
  const isPinned = (profileId: string) => {
    return pinnedProfiles.some(pin => pin.profileId === profileId);
  };

  // Helper to check if a profile is owned by the current user
  const isOwnProfile = (profile: Profile) => {
    return profile.clerkId === clerkUser?.id || profile.user?.clerkId === clerkUser?.id;
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
    
    window.dispatchEvent(new CustomEvent('profileChanged', { detail: { profileId: profile.id } }));
  };

  // Render a single profile item
  const renderProfileItem = (profile: Profile, isPinnedItem = false) => {
    const isSelected = profile.id === profileId;
    const pinned = isPinned(profile.id);
    
    return (
      <button
        key={profile.id}
        onClick={() => handleProfileSelect(profile)}
        className={`
          w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 mb-1
          ${isSelected
            ? 'bg-sidebar-accent border-2 border-[#EC67A1]/30'
            : 'hover:bg-sidebar-accent border-2 border-transparent hover:border-[#EC67A1]/20'
          }
        `}
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
        
        {/* Selected Check */}
        {isSelected && (
          <div className="w-5 h-5 rounded-full bg-[#EC67A1] flex items-center justify-center flex-shrink-0">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}
      </button>
    );
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
      {/* Main Trigger Button */}
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
          {!isAllProfiles && selectedProfile && isPinned(selectedProfile.id) && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-400 rounded-full border-2 border-sidebar flex items-center justify-center">
              <Pin className="w-2 h-2 text-white fill-white" />
            </div>
          )}
        </div>
        
        {/* Profile Info */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">
              {selectedProfile?.name || 'Select Profile'}
            </p>
          </div>
          <p className="text-[11px] text-sidebar-foreground/50 truncate">
            {isAllProfiles 
              ? `${profiles.length} profile${profiles.length !== 1 ? 's' : ''}`
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
                      return profile ? renderProfileItem(profile) : null;
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
    </div>
  );
}
```

---

## 🎯 Implementation Steps

### Phase 1: Database Setup
1. Add new models to `schema.prisma`
2. Run `npx prisma migrate dev --name add_profile_grouping`
3. Run `npx prisma generate`

### Phase 2: Backend API
1. Create `/api/profile-groups/route.ts` (GET, POST)
2. Create `/api/profile-groups/[id]/route.ts` (PATCH, DELETE)
3. Create `/api/profile-groups/[id]/members/route.ts` (POST, DELETE)
4. Create `/api/profiles/pins/route.ts` (GET, POST)
5. Create `/api/profiles/pins/[profileId]/route.ts` (DELETE)

### Phase 3: Frontend Hooks
1. Create `lib/hooks/useProfileGroups.query.ts`
2. Create `lib/hooks/useProfilePins.query.ts`

### Phase 4: UI Components
1. Update `components/GlobalProfileSelector.tsx` with grouping
2. Create `components/ManageGroupsModal.tsx` for group management
3. Add context menu/actions for quick pin/unpin

### Phase 5: Management UI
1. Create `/workspace/my-influencers/manage-groups` page
2. Add drag-and-drop reordering (optional)
3. Add group color picker

---

## 🚀 Performance Optimizations

1. **React.memo** for profile items to prevent unnecessary re-renders
2. **Virtual scrolling** for 100+ profiles (use `@tanstack/react-virtual`)
3. **Optimistic updates** in mutations for instant UI feedback
4. **Debounced search** for filtering profiles
5. **Indexed queries** in Prisma (already included in schema)

---

## 📊 Database Indexes

The schema includes these indexes for optimal performance:

```prisma
@@index([organizationId])
@@index([organizationId, order])
@@index([profileGroupId])
@@index([profileId])
@@index([userId])
```

---

## 🎨 UX Best Practices

1. **Always show pinned profiles first** - Quick access to favorites
2. **Collapsible groups** - Reduce visual clutter
3. **Group count badges** - Quick overview of group size
4. **Color coding** - Visual distinction between groups
5. **"Ungrouped" section** - Catch-all for unorganized profiles
6. **Search/filter** - For power users with many profiles
7. **Drag-and-drop** (Phase 2) - Intuitive reordering

---

## 🔄 Migration Strategy

For existing users with many profiles:

1. All existing profiles start in "Ungrouped"
2. Provide a "Quick Setup" wizard to create initial groups
3. Suggest common groups: "Daily", "VIP", "Archive"
4. Allow bulk assignment to groups

---

## 🧪 Testing Checklist

- [ ] Create group
- [ ] Rename group
- [ ] Delete group (with and without members)
- [ ] Add profile to group
- [ ] Remove profile from group
- [ ] Add profile to multiple groups
- [ ] Pin/unpin profile
- [ ] Collapse/expand groups (persists across sessions)
- [ ] Search profiles across groups
- [ ] Performance with 100+ profiles
- [ ] Mobile responsive design

---

## 📱 Mobile Considerations

- Touch-friendly targets (min 44x44px)
- Swipe actions for quick pin/unpin
- Bottom sheet for group selection
- Simplified group management UI

---

## 🎯 Future Enhancements

1. **Smart Groups** - Auto-group by criteria (e.g., "Active this week")
2. **Group Templates** - Pre-defined group structures
3. **Bulk Actions** - Select multiple profiles to move
4. **Group Sharing** - Share group structure with team
5. **Analytics** - Track most-used profiles/groups
6. **Search** - Global search across all profiles

