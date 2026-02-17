'use client';

import { useState, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { AlertTriangle } from 'lucide-react';
import { useInstagramProfiles } from '@/lib/hooks/useInstagramProfiles.query';

interface CaptionQueueFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const MESSAGE_TYPE_OPTIONS = [
  'Mass DM',
  'Tip Me',
  'Renew',
  'Bundle Unlock',
  'Wall Post',
  'Wall Post Campaign',
  'PPV',
  'Welcome Message',
  'Expired Fan',
  'Sexting Script',
];

export function CaptionQueueForm({ onSuccess, onCancel }: CaptionQueueFormProps) {
  const { user } = useUser();
  const { data: profiles, isLoading: profilesLoading, error: profilesError } = useInstagramProfiles();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    profileId: '',
    modelName: '',
    modelAvatar: '',
    profileImageUrl: '',
    description: '',
    contentTypes: [] as string[],
    messageTypes: ['Mass DM'] as string[],
    urgency: 'medium',
    releaseDate: new Date().toISOString().split('T')[0],
    releaseTime: '12:00',
  });

  // Get selected model data
  const selectedModel = useMemo(() => {
    if (!formData.profileId || !profiles) return null;
    return profiles.find(p => p.id === formData.profileId);
  }, [formData.profileId, profiles]);

  // Get available content types for selected model
  const availableContentTypes = useMemo(() => {
    if (!selectedModel) return [];
    
    // Use Set to remove duplicates, then convert back to array
    return Array.from(new Set([
      ...selectedModel.selectedContentTypes,
      ...selectedModel.customContentTypes,
    ].filter(Boolean)));
  }, [selectedModel]);

  // Handle model selection
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const profileId = e.target.value;
    const profile = profiles?.find(p => p.id === profileId);
    
    if (profile) {
      setFormData({
        ...formData,
        profileId: profile.id,
        modelName: profile.name,
        modelAvatar: profile.name.substring(0, 2).toUpperCase(),
        profileImageUrl: profile.profileImageUrl || '',
        contentTypes: [], // Reset content types when model changes
      });
    } else {
      setFormData({
        ...formData,
        profileId: '',
        modelName: '',
        modelAvatar: '',
        profileImageUrl: '',
        contentTypes: [],
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate required fields
    if (!formData.profileId) {
      setError('Please select a model');
      return;
    }
    if (!formData.contentTypes || formData.contentTypes.length === 0) {
      setError('Please select at least one content type');
      return;
    }
    if (!formData.messageTypes || formData.messageTypes.length === 0) {
      setError('Please select at least one message type');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Combine date and time into ISO datetime string
      const releaseDatetime = `${formData.releaseDate}T${formData.releaseTime}:00.000Z`;
      
      const response = await fetch('/api/caption-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: formData.profileId,
          modelName: formData.modelName,
          modelAvatar: formData.modelAvatar,
          profileImageUrl: formData.profileImageUrl,
          description: formData.description,
          contentTypes: formData.contentTypes,
          messageTypes: formData.messageTypes,
          urgency: formData.urgency,
          releaseDate: releaseDatetime,
          clerkId: user.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create queue item');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create queue item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-[#1a1625] border border-brand-mid-pink/20 rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-sidebar-foreground mb-4">Add New Queue Item</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Model Selector with Avatar */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-sidebar-foreground mb-2">
            Model *
          </label>
          <div className="flex items-center gap-3">
            {/* Avatar Display */}
            <div className="shrink-0">
              {selectedModel?.profileImageUrl ? (
                <img
                  src={selectedModel.profileImageUrl}
                  alt={selectedModel.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-brand-mid-pink/20"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-brand-light-pink to-brand-blue flex items-center justify-center text-xs font-semibold text-white border-2 border-brand-mid-pink/20">
                  {formData.modelAvatar || '?'}
                </div>
              )}
            </div>
            {/* Dropdown Select */}
            <select
              required
              value={formData.profileId}
              onChange={handleModelChange}
              disabled={profilesLoading}
              className="flex-1 px-3 py-2 bg-brand-off-white dark:bg-[#0f0d18] border border-brand-mid-pink/20 dark:border-brand-mid-pink/30 focus:border-brand-mid-pink focus:ring-1 focus:ring-brand-mid-pink/30 text-sidebar-foreground text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {profilesLoading ? 'Loading models...' : profiles?.length ? 'Select a model' : 'No models available'}
              </option>
              {profiles?.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>
          {profilesError && (
            <p className="mt-2 text-xs text-red-500">Error loading models: {profilesError.message}</p>
          )}
          {!profilesLoading && profiles?.length === 0 && (
            <p className="mt-2 text-xs text-header-muted">No models found. Please create a model in My Influencers first.</p>
          )}
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-sidebar-foreground mb-2">
            Description *
          </label>
          <textarea
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 bg-brand-off-white dark:bg-[#0f0d18] border border-brand-mid-pink/20 dark:border-brand-mid-pink/30 focus:border-brand-mid-pink focus:ring-1 focus:ring-brand-mid-pink/30 text-sidebar-foreground text-sm rounded-xl resize-none"
            rows={3}
            placeholder="Brief description of the content"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-sidebar-foreground mb-2">
            Content Types * <span className="text-xs text-header-muted">(Select all that apply)</span>
          </label>
          <div className="w-full px-3 py-2 bg-brand-off-white dark:bg-[#0f0d18] border border-brand-mid-pink/20 dark:border-brand-mid-pink/30 rounded-xl min-h-[42px]">
            {!selectedModel ? (
              <p className="text-sm text-header-muted py-1">Select a model first</p>
            ) : availableContentTypes.length === 0 ? (
              <p className="text-sm text-header-muted py-1">No content types configured</p>
            ) : (
              <div className="space-y-2">
                {availableContentTypes.map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={formData.contentTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, contentTypes: [...formData.contentTypes, type] });
                        } else {
                          setFormData({ ...formData, contentTypes: formData.contentTypes.filter(t => t !== type) });
                        }
                      }}
                      className="w-4 h-4 rounded border-brand-mid-pink/30 text-brand-mid-pink focus:ring-brand-mid-pink/30"
                    />
                    <span className="text-sm text-sidebar-foreground group-hover:text-brand-mid-pink transition-colors">{type}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {formData.contentTypes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {formData.contentTypes.map((type) => (
                <span key={type} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-mid-pink/10 text-brand-mid-pink rounded text-xs">
                  {type}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, contentTypes: formData.contentTypes.filter(t => t !== type) })}
                    className="hover:text-brand-dark-pink"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {selectedModel && availableContentTypes.length === 0 && (
            <p className="mt-2 text-xs text-orange-600 dark:text-orange-400">
              This model doesn't have content types set up yet. Go to{' '}
              <a 
                href={`/${window.location.pathname.split('/')[1]}/workspace/my-influencers/${selectedModel.id}`}
                className="underline hover:text-orange-700 dark:hover:text-orange-300"
                target="_blank"
                rel="noopener noreferrer"
              >
                {selectedModel.name}'s profile
              </a>
              {' '}to configure content types in the Overview tab.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-sidebar-foreground mb-2">
            Message Types * <span className="text-xs text-header-muted">(Select all that apply)</span>
          </label>
          <div className="w-full px-3 py-2 bg-brand-off-white dark:bg-[#0f0d18] border border-brand-mid-pink/20 dark:border-brand-mid-pink/30 rounded-xl min-h-[42px]">
            <div className="space-y-2">
              {MESSAGE_TYPE_OPTIONS.map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.messageTypes.includes(type)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, messageTypes: [...formData.messageTypes, type] });
                      } else {
                        setFormData({ ...formData, messageTypes: formData.messageTypes.filter(t => t !== type) });
                      }
                    }}
                    className="w-4 h-4 rounded border-brand-mid-pink/30 text-brand-mid-pink focus:ring-brand-mid-pink/30"
                  />
                  <span className="text-sm text-sidebar-foreground group-hover:text-brand-mid-pink transition-colors">{type}</span>
                </label>
              ))}
            </div>
          </div>
          {formData.messageTypes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {formData.messageTypes.map((type) => (
                <span key={type} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-light-pink/10 text-brand-light-pink rounded text-xs">
                  {type}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, messageTypes: formData.messageTypes.filter(t => t !== type) })}
                    className="hover:text-brand-dark-pink"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-sidebar-foreground mb-2">
            Urgency *
          </label>
          <select
            required
            value={formData.urgency}
            onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
            className="w-full px-3 py-2 bg-brand-off-white dark:bg-[#0f0d18] border border-brand-mid-pink/20 dark:border-brand-mid-pink/30 focus:border-brand-mid-pink focus:ring-1 focus:ring-brand-mid-pink/30 text-sidebar-foreground text-sm rounded-xl"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-sidebar-foreground mb-2">
            Release Date & Time *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              required
              value={formData.releaseDate}
              onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })}
              className="w-full px-3 py-2 bg-brand-off-white dark:bg-[#0f0d18] border border-brand-mid-pink/20 dark:border-brand-mid-pink/30 focus:border-brand-mid-pink focus:ring-1 focus:ring-brand-mid-pink/30 text-sidebar-foreground text-sm rounded-xl"
            />
            <input
              type="time"
              required
              value={formData.releaseTime}
              onChange={(e) => setFormData({ ...formData, releaseTime: e.target.value })}
              className="w-full px-3 py-2 bg-brand-off-white dark:bg-[#0f0d18] border border-brand-mid-pink/20 dark:border-brand-mid-pink/30 focus:border-brand-mid-pink focus:ring-1 focus:ring-brand-mid-pink/30 text-sidebar-foreground text-sm rounded-xl"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-5 py-3 bg-white dark:bg-[#0f0d18] hover:bg-brand-off-white dark:hover:bg-[#1a1625] border border-brand-mid-pink/20 rounded-xl text-sidebar-foreground text-sm font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !formData.profileId || formData.contentTypes.length === 0 || formData.messageTypes.length === 0}
          className="flex-1 px-5 py-3 bg-linear-to-r from-brand-mid-pink to-brand-light-pink hover:from-brand-dark-pink hover:to-brand-mid-pink text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-brand-mid-pink/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Adding...' : 'Add to Queue'}
        </button>
      </div>
    </form>
  );
}
