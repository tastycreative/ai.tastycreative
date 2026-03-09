'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSpaceBySlug } from '@/lib/hooks/useSpaces.query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { spaceKeys } from '@/lib/hooks/useSpaces.query';
import { useSpaceMembers, useTransferOwnership } from '@/lib/hooks/useSpaceMembers.query';
import { useOrgMembersWithRoles } from '@/lib/hooks/useOrgMembers.query';
import { useUser } from '@clerk/nextjs';
import { Loader2, Save, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SpaceSettingsDetailsProps {
  slug: string;
}

export function SpaceSettingsDetails({ slug }: SpaceSettingsDetailsProps) {
  const router = useRouter();
  const params = useParams<{ tenant: string }>();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { data: space, isLoading } = useSpaceBySlug(slug);
  const { data: members = [] } = useSpaceMembers(space?.id);
  const { data: orgMembersWithRoles = [] } = useOrgMembersWithRoles();
  const transferOwnershipMutation = useTransferOwnership(space?.id ?? '');

  const [spaceName, setSpaceName] = useState('');
  const [spaceKey, setSpaceKey] = useState('');
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize form when space data loads
  useEffect(() => {
    if (space) {
      setSpaceName(space.name);
      setSpaceKey(space.key || '');
    }
  }, [space]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowOwnerDropdown(false);
      }
    };

    if (showOwnerDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOwnerDropdown]);

  const updateSpaceMutation = useMutation({
    mutationFn: async (data: { name: string; key: string }) => {
      const response = await fetch(`/api/spaces/${space!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update space');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate all space queries to refresh the data
      queryClient.invalidateQueries({ queryKey: spaceKeys.all });
      // Redirect back to the space
      router.push(`/${params.tenant}/spaces/${slug}`);
    },
    onError: (error) => {
      console.error('Error updating space:', error);
      alert('Failed to update space. Please try again.');
    },
  });

  const handleSave = () => {
    if (!space || !spaceName.trim() || !spaceKey.trim()) return;
    updateSpaceMutation.mutate({ name: spaceName.trim(), key: spaceKey.trim() });
  };

  const handleTransferOwnership = (newOwnerId: string, newOwnerName: string, newOwnerEmail: string) => {
    if (!space) return;

    const confirmMessage = `Are you sure you want to transfer ownership to ${
      newOwnerName || newOwnerEmail
    }? You will become an admin and will no longer be able to transfer ownership back.`;

    if (!window.confirm(confirmMessage)) return;

    transferOwnershipMutation.mutate(newOwnerId, {
      onSuccess: () => {
        alert('Ownership transferred successfully!');
        setShowOwnerDropdown(false);
        // Invalidate and refetch space data
        queryClient.invalidateQueries({ queryKey: spaceKeys.all });
      },
      onError: (error) => {
        alert(`Failed to transfer ownership: ${error.message}`);
      },
    });
  };

  // Get current owner from members
  const currentOwner = members.find((m) => m.role === 'OWNER');
  const isCurrentUserOwner = currentOwner?.user.clerkId === user?.id;

  // Combine space members and org owners/admins for potential new owners
  // Start with space members (excluding current owner)
  const spaceMembersAsOptions = members
    .filter((m) => m.role !== 'OWNER')
    .map((m) => ({
      userId: m.userId,
      clerkId: m.user.clerkId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      source: 'space' as const,
    }));

  // Add org owners/admins who aren't already space members
  const orgAdminsAsOptions = orgMembersWithRoles
    .filter((om) =>
      (om.role === 'OWNER' || om.role === 'ADMIN') &&
      !members.some((m) => m.userId === om.user.id)
    )
    .map((om) => ({
      userId: om.user.id, // Using user ID from org member
      clerkId: '', // We don't have clerkId in this structure
      name: om.user.name,
      email: om.user.email,
      role: om.role,
      source: 'organization' as const,
    }));

  const potentialNewOwners = [...spaceMembersAsOptions, ...orgAdminsAsOptions];

  // Debug logging
  useEffect(() => {
    if (showOwnerDropdown) {
      console.log('Dropdown opened');
      console.log('Members:', members);
      console.log('Org Members With Roles:', orgMembersWithRoles);
      console.log('Current Owner:', currentOwner);
      console.log('Is Current User Owner:', isCurrentUserOwner);
      console.log('Potential New Owners:', potentialNewOwners);
    }
  }, [showOwnerDropdown, members, orgMembersWithRoles, currentOwner, isCurrentUserOwner, potentialNewOwners]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-light-pink" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          Loading settings...
        </span>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Space not found
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Details
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Manage your space configuration and details
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col items-center space-y-6">
          {/* Space Icon */}
          <div className="space-y-2 w-full max-w-md">
            <Label htmlFor="space-icon" className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center block">
              Space Icon
            </Label>
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-light-pink/20 via-brand-blue/20 to-brand-dark-pink/20 dark:from-brand-dark-pink/10 dark:via-brand-blue/10 dark:to-brand-mid-pink/10 flex items-center justify-center text-2xl">
                📁
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled
              >
                Change Icon (Coming Soon)
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Custom icon selection will be available soon
            </p>
          </div>

          {/* Space Name */}
          <div className="space-y-2 w-full max-w-md">
            <Label htmlFor="space-name" className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center block">
              Space Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="space-name"
              value={spaceName}
              onChange={(e) => setSpaceName(e.target.value)}
              placeholder="Enter space name"
              className="w-full"
              required
            />
          </div>

          {/* Space Key */}
          <div className="space-y-2 w-full max-w-md">
            <Label htmlFor="space-key" className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center block">
              Space Key <span className="text-red-500">*</span>
            </Label>
            <Input
              id="space-key"
              value={spaceKey}
              onChange={(e) => setSpaceKey(e.target.value)}
              placeholder="Enter space key"
              className="w-full"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              A unique identifier for this space
            </p>
          </div>

          {/* Space Owner */}
          <div className="space-y-2 w-full max-w-md">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center block">
              Space Owner
            </Label>
            {isCurrentUserOwner ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowOwnerDropdown(!showOwnerDropdown)}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg w-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-transparent hover:border-brand-light-pink/30"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-light-pink to-brand-blue flex items-center justify-center text-white text-sm font-semibold">
                    {currentOwner?.user.name?.charAt(0).toUpperCase() || currentOwner?.user.email?.charAt(0).toUpperCase() || 'O'}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {currentOwner?.user.name || 'Unknown Owner'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {currentOwner?.user.email || 'No email available'}
                    </p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showOwnerDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showOwnerDropdown && (
                  <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-brand-mid-pink/30 shadow-xl max-h-60 overflow-y-auto">
                    <div className="p-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1.5">
                        Transfer ownership to:
                      </p>
                      {potentialNewOwners.length > 0 ? (
                        potentialNewOwners.map((person) => (
                          <button
                            key={`${person.source}-${person.userId}`}
                            type="button"
                            onClick={() => handleTransferOwnership(person.userId, person.name || '', person.email)}
                            disabled={transferOwnershipMutation.isPending}
                            className="flex items-center gap-3 p-2 w-full rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-mid-pink to-brand-blue flex items-center justify-center text-white text-sm font-semibold">
                              {person.name?.charAt(0).toUpperCase() || person.email?.charAt(0).toUpperCase() || 'M'}
                            </div>
                            <div className="flex-1 text-left">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {person.name || 'Unknown'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {person.email} • {person.role}
                                {person.source === 'organization' && (
                                  <span className="ml-1 text-brand-light-pink">(Org {person.role})</span>
                                )}
                              </p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-2 py-3 text-center">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            No other members available
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Add members to the space first
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1.5">
                  {isCurrentUserOwner ? 'Click to transfer ownership to another member' : 'Only the owner can transfer ownership'}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg w-full">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-light-pink to-brand-blue flex items-center justify-center text-white text-sm font-semibold">
                  {currentOwner?.user.name?.charAt(0).toUpperCase() || currentOwner?.user.email?.charAt(0).toUpperCase() || 'O'}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {currentOwner?.user.name || 'Unknown Owner'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {currentOwner?.user.email || 'No email available'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-gray-200 dark:border-brand-mid-pink/20">
          <div className="flex items-center gap-3 justify-center">
            <Button
              onClick={handleSave}
              disabled={updateSpaceMutation.isPending || !spaceName.trim() || !spaceKey.trim()}
              className="bg-brand-light-pink hover:bg-brand-mid-pink text-white"
            >
              {updateSpaceMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/${params.tenant}/spaces/${slug}`)}
              disabled={updateSpaceMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
