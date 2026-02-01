'use client';

import React, { useState } from 'react';
import { X, Tag, Check, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { GALLERY_CONTENT_TYPES, CONTENT_TYPE_LABELS, type GalleryContentType } from '@/lib/constants/gallery';
import type { GalleryItemWithModel } from '@/types/gallery';

interface ContentTypeEditorProps {
  item: GalleryItemWithModel;
  onClose: () => void;
  onSuccess: () => void;
}

export function ContentTypeEditor({ item, onClose, onSuccess }: ContentTypeEditorProps) {
  const [selectedType, setSelectedType] = useState<string>(item.contentType || 'OTHER');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (selectedType === item.contentType) {
      onClose();
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/gallery/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: selectedType }),
      });

      if (response.ok) {
        toast.success('Content type updated');
        onSuccess();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update');
      }
    } catch (error) {
      console.error('Error updating content type:', error);
      toast.error('Failed to update content type');
    } finally {
      setSaving(false);
    }
  };

  // Group content types by category
  const soloTypes = ['SOLO_DILDO', 'SOLO_FINGERS', 'SOLO_VIBRATOR', 'JOI', 'SQUIRTING', 'DICK_RATING'];
  const coupleTypes = ['BG', 'BJ', 'GG', 'CREAM_PIE'];
  const groupTypes = ['GGG', 'BGG', 'BBG', 'ORGY'];
  const analTypes = ['ANAL_BUTT_PLUG', 'ANAL_SOLO', 'ANAL_BG'];
  const otherTypes = ['LIVES', 'CUSTOM', 'OTHER'];

  const renderTypeGroup = (title: string, types: string[]) => (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {types.map((type) => {
          const isSelected = selectedType === type;
          const label = CONTENT_TYPE_LABELS[type as GalleryContentType] || type;

          return (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isSelected
                  ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                  : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              {isSelected && <Check className="w-3.5 h-3.5 inline mr-1.5" />}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Tag className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Edit Content Type</h2>
              <p className="text-sm text-zinc-500">
                Current: <span className="text-zinc-300">{CONTENT_TYPE_LABELS[item.contentType as GalleryContentType] || item.contentType}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Preview */}
        <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-start gap-4">
            <div className="w-24 h-24 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
              {item.previewUrl ? (
                <img
                  src={item.previewUrl}
                  alt={item.title || 'Preview'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  <Tag className="w-8 h-8" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">
                {item.title || 'Untitled Content'}
              </p>
              <p className="text-sm text-zinc-500 mt-1">
                {item.model?.displayName || item.model?.name || 'Unknown Model'}
              </p>
              {item.captionUsed && (
                <p className="text-xs text-zinc-600 mt-2 line-clamp-2">
                  {item.captionUsed}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Type Selection */}
        <div className="p-6 max-h-[400px] overflow-y-auto space-y-6">
          {renderTypeGroup('Solo', soloTypes)}
          {renderTypeGroup('Couples', coupleTypes)}
          {renderTypeGroup('Group', groupTypes)}
          {renderTypeGroup('Anal', analTypes)}
          {renderTypeGroup('Other', otherTypes)}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <AlertCircle className="w-4 h-4" />
            <span>Changes will update this item only</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || selectedType === item.contentType}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
