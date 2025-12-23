'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon, Video, Upload, Loader2, CheckCircle, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Post } from './types';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (post: Post) => void;
  profileId: string | null;
  scheduledData?: any;
}

export default function CreatePostModal({ isOpen, onClose, onPostCreated, profileId, scheduledData }: CreatePostModalProps) {
  const [postCaption, setPostCaption] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<File[]>([]);
  const [videoPreviews, setVideoPreviews] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Vault state
  const [uploadMode, setUploadMode] = useState<'upload' | 'vault'>('upload');
  const [vaultItems, setVaultItems] = useState<any[]>([]);
  const [selectedVaultItems, setSelectedVaultItems] = useState<any[]>([]);
  const [loadingVault, setLoadingVault] = useState(false);
  const [captionMode, setCaptionMode] = useState<'custom' | 'bank'>('custom');
  const [availableCaptions, setAvailableCaptions] = useState<any[]>([]);
  const [loadingCaptions, setLoadingCaptions] = useState(false);
  const [captionSearchQuery, setCaptionSearchQuery] = useState('');
  const [captionCategoryFilter, setCaptionCategoryFilter] = useState('All');
  const [captionTypeFilter, setCaptionTypeFilter] = useState('All');
  const [captionBankFilter, setCaptionBankFilter] = useState('All');

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Fetch vault items when modal opens and profile is selected
  useEffect(() => {
    if (isOpen && profileId && profileId !== 'all' && uploadMode === 'vault') {
      fetchVaultItems();
    }
  }, [isOpen, profileId, uploadMode]);

  // Pre-fill form when scheduledData is provided
  useEffect(() => {
    if (isOpen && scheduledData) {
      setPostCaption(scheduledData.caption || '');
      
      // Set media type and load files as previews
      if (scheduledData.files && scheduledData.files.length > 0) {
        const firstFile = scheduledData.files[0];
        const isVideo = firstFile.mimeType?.startsWith('video/');
        setMediaType(isVideo ? 'video' : 'image');
        
        // Don't use vault mode - instead load the files as preview URLs
        // This way we show only the scheduled post's files, not the entire vault
        const fileUrls = scheduledData.files.map((file: any) => file.awsS3Url);
        
        if (isVideo) {
          setVideoPreviews(fileUrls);
        } else {
          setImagePreviews(fileUrls);
        }
        
        // Store the file data so we can use it when posting
        setSelectedVaultItems(scheduledData.files.map((file: any) => ({
          id: file.awsS3Key,
          awsS3Key: file.awsS3Key,
          awsS3Url: file.awsS3Url,
          fileName: file.fileName,
          fileType: file.mimeType,
          thumbnailUrl: file.awsS3Url,
        })));
      }
    }
  }, [isOpen, scheduledData]);

  // Fetch captions bank when modal opens and caption mode is bank
  useEffect(() => {
    if (isOpen && profileId && profileId !== 'all' && captionMode === 'bank') {
      fetchCaptionsBank();
    }
  }, [isOpen, profileId, captionMode]);

  if (!isOpen || !mounted) return null;

  const fetchCaptionsBank = async () => {
    if (!profileId || profileId === 'all') return;
    
    setLoadingCaptions(true);
    try {
      const response = await fetch(`/api/captions?profileId=${profileId}`);
      if (response.ok) {
        const captions = await response.json();
        setAvailableCaptions(captions);
      } else {
        console.error('Failed to load captions');
        setAvailableCaptions([]);
      }
    } catch (error) {
      console.error('Error fetching captions:', error);
      setAvailableCaptions([]);
    } finally {
      setLoadingCaptions(false);
    }
  };

  const fetchVaultItems = async () => {
    if (!profileId || profileId === 'all') return;
    
    setLoadingVault(true);
    try {
      const response = await fetch(`/api/vault/items?profileId=${profileId}`);
      if (response.ok) {
        const items = await response.json();
        setVaultItems(items);
      } else {
        toast.error('Failed to load vault items');
      }
    } catch (error) {
      console.error('Error fetching vault items:', error);
      toast.error('Error loading vault items');
    } finally {
      setLoadingVault(false);
    }
  };

  const handleSelectVaultItem = (item: any) => {
    setSelectedVaultItems(prev => {
      const isSelected = prev.some(i => i.id === item.id);
      if (isSelected) {
        return prev.filter(i => i.id !== item.id);
      } else {
        // For videos, only allow one selection
        if (mediaType === 'video') {
          return [item];
        }
        // For images, allow multiple (max 10)
        if (prev.length >= 10) {
          toast.error('Maximum 10 items allowed');
          return prev;
        }
        return [...prev, item];
      }
    });
  };

  const handleRemoveVaultItem = (itemId: string) => {
    setSelectedVaultItems(prev => prev.filter(i => i.id !== itemId));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length + selectedImages.length > 10) {
      toast.error('You can upload a maximum of 10 images');
      return;
    }

    const oversizedFiles = files.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error('Each image must be less than 10MB');
      return;
    }

    setSelectedImages(prev => [...prev, ...files]);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length + selectedVideos.length > 1) {
      toast.error('You can upload a maximum of 1 video');
      return;
    }

    const oversizedFiles = files.filter(file => file.size > 100 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error('Video must be less than 100MB');
      return;
    }

    setSelectedVideos(prev => [...prev, ...files]);

    files.forEach(file => {
      const url = URL.createObjectURL(file);
      setVideoPreviews(prev => [...prev, url]);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeVideo = (index: number) => {
    URL.revokeObjectURL(videoPreviews[index]);
    setSelectedVideos(prev => prev.filter((_, i) => i !== index));
    setVideoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreatePost = async () => {
    // Check if we have media from vault or upload
    if (selectedVaultItems.length === 0 && selectedImages.length === 0 && selectedVideos.length === 0) {
      toast.error('Please select at least one image or video');
      return;
    }
    if (!postCaption.trim()) {
      toast.error('Please add a caption');
      return;
    }
    if (!profileId) {
      toast.error('Please select a profile first');
      return;
    }

    try {
      setUploading(true);

      const mediaUrls: string[] = [];
      let currentMediaType: 'image' | 'video' = 'image';
      
      // If using vault items, use their URLs directly
      if (selectedVaultItems.length > 0) {
        selectedVaultItems.forEach(item => {
          mediaUrls.push(item.awsS3Url);
          if (item.fileType.startsWith('video/')) {
            currentMediaType = 'video';
          }
        });
      } else if (selectedVideos.length > 0) {
        currentMediaType = 'video';
        for (const video of selectedVideos) {
          const formData = new FormData();
          formData.append('file', video);

          const uploadResponse = await fetch('/api/upload/video', {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload video');
          }

          const { url } = await uploadResponse.json();
          mediaUrls.push(url);
        }
      } else {
        for (const image of selectedImages) {
          const formData = new FormData();
          formData.append('image', image);

          const uploadResponse = await fetch('/api/upload/image', {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload image');
          }

          const uploadData = await uploadResponse.json();
          mediaUrls.push(uploadData.dataUrl || uploadData.url);
        }
      }

      const postResponse = await fetch('/api/feed/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrls: mediaUrls,
          mediaType: currentMediaType,
          caption: postCaption,
          profileId,
        }),
      });

      const responseText = await postResponse.text();

      if (!postResponse.ok) {
        let errorMessage = 'Failed to create post';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      let newPost;
      try {
        newPost = JSON.parse(responseText);
      } catch (e) {
        throw new Error('Invalid response from server');
      }

      if (!newPost || !newPost.user) {
        throw new Error('Invalid post data received');
      }

      onPostCreated(newPost);
      toast.success('Post created successfully!');
      
      // If this was a scheduled post, mark it as posted
      if (scheduledData?.id) {
        try {
          await fetch(`/api/instagram/feed-post-slots/${scheduledData.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              isPosted: true,
              postedAt: new Date().toISOString(),
            }),
          });
          // Notify other components that a scheduled post was posted
          window.dispatchEvent(new CustomEvent('feedPostCreated'));
        } catch (error) {
          console.error('Error marking scheduled post as posted:', error);
        }
      }
      
      handleClose();
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast.error(error.message || 'Failed to create post');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setPostCaption('');
    setSelectedImages([]);
    setImagePreviews([]);
    videoPreviews.forEach(url => URL.revokeObjectURL(url));
    setSelectedVideos([]);
    setVideoPreviews([]);
    setMediaType('image');
    setUploadMode('upload');
    setSelectedVaultItems([]);
    setVaultItems([]);
    setCaptionMode('custom');
    setAvailableCaptions([]);
    setCaptionSearchQuery('');
    setCaptionCategoryFilter('All');
    setCaptionTypeFilter('All');
    setCaptionBankFilter('All');
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {scheduledData ? 'Post Scheduled Content' : 'Create Post'}
            </h2>
            {scheduledData && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Ready to publish scheduled content
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Media Type Selection */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setMediaType('image');
                setSelectedVideos([]);
                setVideoPreviews([]);
              }}
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                mediaType === 'image'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                  : 'border-gray-200 dark:border-gray-800 hover:border-purple-300'
              }`}
            >
              <ImageIcon className={`w-6 h-6 mx-auto mb-2 ${
                mediaType === 'image' ? 'text-purple-600' : 'text-gray-600 dark:text-gray-400'
              }`} />
              <span className={`text-sm font-medium ${
                mediaType === 'image' ? 'text-purple-600' : 'text-gray-600 dark:text-gray-400'
              }`}>
                Images
              </span>
            </button>
            <button
              onClick={() => {
                setMediaType('video');
                setSelectedImages([]);
                setImagePreviews([]);
              }}
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                mediaType === 'video'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                  : 'border-gray-200 dark:border-gray-800 hover:border-purple-300'
              }`}
            >
              <Video className={`w-6 h-6 mx-auto mb-2 ${
                mediaType === 'video' ? 'text-purple-600' : 'text-gray-600 dark:text-gray-400'
              }`} />
              <span className={`text-sm font-medium ${
                mediaType === 'video' ? 'text-purple-600' : 'text-gray-600 dark:text-gray-400'
              }`}>
                Video
              </span>
            </button>
          </div>

          {/* Caption Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Caption
            </label>
            
            {/* Caption Mode Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setCaptionMode('custom')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                  captionMode === 'custom'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                Write Your Own
              </button>
              <button
                type="button"
                onClick={() => setCaptionMode('bank')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                  captionMode === 'bank'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                Select from Bank
              </button>
            </div>

            {captionMode === 'custom' ? (
              <textarea
                value={postCaption}
                onChange={(e) => setPostCaption(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full p-4 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 resize-none"
                rows={4}
              />
            ) : (
              <div className="space-y-3">
                {/* Search and Filters */}
                <input
                  type="text"
                  placeholder="Search captions..."
                  value={captionSearchQuery}
                  onChange={(e) => setCaptionSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 text-sm"
                />
                
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={captionCategoryFilter}
                    onChange={(e) => setCaptionCategoryFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="All">All Categories</option>
                    <option value="Dick rating">Dick rating</option>
                    <option value="Solo DILDO">Solo DILDO</option>
                    <option value="Solo FINGERS">Solo FINGERS</option>
                    <option value="Solo VIBRATOR">Solo VIBRATOR</option>
                    <option value="JOI">JOI</option>
                    <option value="Squirting">Squirting</option>
                    <option value="Cream Pie">Cream Pie</option>
                    <option value="BG">BG</option>
                    <option value="BJ">BJ</option>
                    <option value="GG">GG</option>
                    <option value="GGG">GGG</option>
                    <option value="BGG">BGG</option>
                    <option value="BBG">BBG</option>
                    <option value="ORGY">ORGY</option>
                    <option value="ANAL butt plug">ANAL butt plug</option>
                    <option value="Anal SOLO">Anal SOLO</option>
                    <option value="Anal BG">Anal BG</option>
                    <option value="Lives">Lives</option>
                  </select>

                  <select
                    value={captionTypeFilter}
                    onChange={(e) => setCaptionTypeFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="All">All Types</option>
                    <option value="Bundle Unlocks">Bundle Unlocks</option>
                    <option value="Tip Me">Tip Me</option>
                    <option value="BIO">BIO</option>
                    <option value="VIP GIFT">VIP GIFT</option>
                    <option value="Short Unlocks">Short Unlocks</option>
                    <option value="Solo Unlocks">Solo Unlocks</option>
                    <option value="Follow up Normal">Follow up Normal</option>
                    <option value="Mass Message Bumps">Mass Message Bumps</option>
                    <option value="Wall Bumps">Wall Bumps</option>
                    <option value="DM Funnels">DM Funnels</option>
                    <option value="GIF Bumps">GIF Bumps</option>
                    <option value="Renew On">Renew On</option>
                    <option value="VIP Post">VIP Post</option>
                    <option value="Link Drop">Link Drop</option>
                    <option value="Live Streams">Live Streams</option>
                    <option value="Live Mass Message">Live Mass Message</option>
                    <option value="Holiday Unlocks">Holiday Unlocks</option>
                    <option value="Live Preview">Live Preview</option>
                    <option value="Games">Games</option>
                    <option value="New Sub Promo">New Sub Promo</option>
                    <option value="Winner Unlocks">Winner Unlocks</option>
                    <option value="Descriptive">Descriptive</option>
                    <option value="OTP Style">OTP Style</option>
                    <option value="List Unlocks">List Unlocks</option>
                    <option value="Model Specific">Model Specific</option>
                    <option value="SOP">SOP</option>
                    <option value="Holiday Non-PPV">Holiday Non-PPV</option>
                    <option value="Timebound">Timebound</option>
                    <option value="Follow Up Incentives">Follow Up Incentives</option>
                    <option value="Collab">Collab</option>
                    <option value="Tip Me Post">Tip Me Post</option>
                    <option value="Tip Me CTA">Tip Me CTA</option>
                    <option value="MM Renew">MM Renew</option>
                    <option value="Renew Post">Renew Post</option>
                    <option value="Porn Post">Porn Post</option>
                    <option value="1 Person Tip Campaign">1 Person Tip Campaign</option>
                    <option value="VIP Membership">VIP Membership</option>
                    <option value="DM Funnel (GF)">DM Funnel (GF)</option>
                    <option value="Expired Sub Promo">Expired Sub Promo</option>
                  </select>

                  <select
                    value={captionBankFilter}
                    onChange={(e) => setCaptionBankFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="All">All Banks</option>
                    <option value="Main Porn Caption Bank">Main Porn Caption Bank</option>
                    <option value="Post Generation Caption Bank">Post Generation Caption Bank</option>
                    <option value="High Sales Caption">High Sales Caption</option>
                    <option value="Better Bump Bank">Better Bump Bank</option>
                    <option value="Custom">Custom</option>
                    <option value="Borrowed Captions">Borrowed Captions</option>
                    <option value="CST - Post Generation Harvest Caption Bank">CST - Post Generation Harvest Caption Bank</option>
                  </select>
                </div>

                {/* Caption List */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-3 max-h-[300px] overflow-y-auto">
                  {loadingCaptions ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                    </div>
                  ) : availableCaptions.filter(caption => {
                    const matchesSearch = caption.caption.toLowerCase().includes(captionSearchQuery.toLowerCase());
                    const matchesCategory = captionCategoryFilter === 'All' || caption.captionCategory === captionCategoryFilter;
                    const matchesType = captionTypeFilter === 'All' || caption.captionTypes === captionTypeFilter;
                    const matchesBank = captionBankFilter === 'All' || caption.captionBanks === captionBankFilter;
                    return matchesSearch && matchesCategory && matchesType && matchesBank;
                  }).length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      <p>No captions found</p>
                      <p className="text-xs mt-1">Try adjusting your filters</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableCaptions
                        .filter(caption => {
                          const matchesSearch = caption.caption.toLowerCase().includes(captionSearchQuery.toLowerCase());
                          const matchesCategory = captionCategoryFilter === 'All' || caption.captionCategory === captionCategoryFilter;
                          const matchesType = captionTypeFilter === 'All' || caption.captionTypes === captionTypeFilter;
                          const matchesBank = captionBankFilter === 'All' || caption.captionBanks === captionBankFilter;
                          return matchesSearch && matchesCategory && matchesType && matchesBank;
                        })
                        .map((caption) => (
                          <button
                            key={caption.id}
                            type="button"
                            onClick={() => {
                              setPostCaption(caption.caption);
                              setCaptionMode('custom');
                            }}
                            className="w-full text-left p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-600 transition-all group"
                          >
                            <p className="text-sm text-gray-900 dark:text-white mb-2 line-clamp-2">
                              {caption.caption}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                                {caption.captionCategory}
                              </span>
                              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                {caption.captionTypes}
                              </span>
                              <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                {caption.captionBanks}
                              </span>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Content Source Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Content Source
            </label>
            
            {/* Mode Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setUploadMode('upload')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                  uploadMode === 'upload'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                📤 Upload New
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadMode('vault');
                  if (profileId && profileId !== 'all' && vaultItems.length === 0) {
                    fetchVaultItems();
                  }
                }}
                disabled={!profileId || profileId === 'all'}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                  uploadMode === 'vault'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                🗄️ From Vault
              </button>
            </div>

            {uploadMode === 'upload' ? (
              <>
                {/* Upload Mode */}
                {mediaType === 'image' ? (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                      id="image-upload"
                    />
                    <label
                      htmlFor="image-upload"
                      className="flex items-center justify-center gap-3 p-8 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:border-purple-400 dark:hover:border-purple-600 cursor-pointer transition-colors"
                    >
                      <Upload className="w-6 h-6 text-gray-400" />
                      <span className="text-gray-600 dark:text-gray-400">Click to upload images (Max 10, up to 10MB each)</span>
                    </label>

                    {/* Image Previews */}
                    {imagePreviews.length > 0 && (
                      <div className="grid grid-cols-3 gap-4 mt-4">
                        {imagePreviews.map((preview, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoSelect}
                      className="hidden"
                      id="video-upload"
                    />
                    <label
                      htmlFor="video-upload"
                      className="flex items-center justify-center gap-3 p-8 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:border-purple-400 dark:hover:border-purple-600 cursor-pointer transition-colors"
                    >
                      <Upload className="w-6 h-6 text-gray-400" />
                      <span className="text-gray-600 dark:text-gray-400">Click to upload video (Max 1, up to 100MB)</span>
                    </label>

                    {/* Video Previews */}
                    {videoPreviews.length > 0 && (
                      <div className="mt-4">
                        {videoPreviews.map((preview, index) => (
                          <div key={index} className="relative group">
                            <video
                              src={preview}
                              controls
                              className="w-full rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => removeVideo(index)}
                              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Vault Mode */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-4 max-h-[400px] overflow-y-auto">
                  {loadingVault ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    </div>
                  ) : vaultItems.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p>No vault items found for this profile</p>
                      <p className="text-sm mt-2">Upload media to your vault first</p>
                    </div>
                  ) : (
                    <>
                      {selectedVaultItems.length > 0 && (
                        <div className="mb-4 p-3 bg-purple-100 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700 rounded-lg">
                          <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                            {selectedVaultItems.length} item{selectedVaultItems.length !== 1 ? 's' : ''} selected
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-3">
                        {vaultItems
                          .filter(item => {
                            // Filter by media type
                            if (mediaType === 'video') {
                              return item.fileType.startsWith('video/');
                            } else {
                              return item.fileType.startsWith('image/');
                            }
                          })
                          .map((item) => {
                            const isSelected = selectedVaultItems.some(i => i.id === item.id);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectVaultItem(item)}
                                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all group ${
                                  isSelected
                                    ? 'border-purple-500 ring-2 ring-purple-500/50'
                                    : 'border-transparent hover:border-purple-400'
                                }`}
                              >
                                {item.fileType.startsWith('video/') ? (
                                  <>
                                    <video
                                      src={item.awsS3Url}
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                      <Video className="w-8 h-8 text-white" />
                                    </div>
                                  </>
                                ) : (
                                  <img
                                    src={item.awsS3Url}
                                    alt={item.fileName}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                                {isSelected && (
                                  <div className="absolute top-1 right-1 p-1 bg-purple-600 rounded-full">
                                    <CheckCircle className="w-4 h-4 text-white" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                  <p className="absolute bottom-1 left-1 right-1 text-xs text-white truncate">
                                    {item.fileName}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-6 flex gap-3">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreatePost}
            disabled={uploading || (selectedImages.length === 0 && selectedVideos.length === 0 && selectedVaultItems.length === 0) || !postCaption.trim()}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Creating...' : 'Create Post'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
