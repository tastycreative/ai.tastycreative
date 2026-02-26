'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSpaceBySlug } from '@/lib/hooks/useSpaces.query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { spaceKeys } from '@/lib/hooks/useSpaces.query';
import { Loader2, Save } from 'lucide-react';
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
  const { data: space, isLoading } = useSpaceBySlug(slug);

  const [spaceName, setSpaceName] = useState('');
  const [spaceKey, setSpaceKey] = useState('');

  // Initialize form when space data loads
  useEffect(() => {
    if (space) {
      setSpaceName(space.name);
      setSpaceKey(space.key || '');
    }
  }, [space]);

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
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg w-full">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-light-pink to-brand-blue flex items-center justify-center text-white text-sm font-semibold">
                {space.owner?.name?.charAt(0).toUpperCase() || space.owner?.email?.charAt(0).toUpperCase() || 'O'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {space.owner?.name || 'Unknown Owner'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {space.owner?.email || 'No email available'}
                </p>
              </div>
            </div>
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
