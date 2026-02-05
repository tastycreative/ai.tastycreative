"use client";

import { useState } from "react";
import { X, Save, Tag, Plus } from "lucide-react";
import type { ReferenceItem } from "@/lib/reference-bank/api";

interface EditModalProps {
  item: ReferenceItem;
  onClose: () => void;
  onSave: (data: Partial<ReferenceItem>) => void;
}

export function EditModal({ item, onClose, onSave }: EditModalProps) {
  const [name, setName] = useState(item.name);
  const [tags, setTags] = useState<string[]>(item.tags || []);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAddTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ name, tags });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Edit Reference</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Preview */}
          <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden">
            {item.fileType.startsWith("video/") ? (
              <video
                src={item.awsS3Url}
                className="w-full h-full object-contain"
                muted
                autoPlay
                loop
              />
            ) : (
              <img
                src={item.thumbnailUrl || item.awsS3Url}
                alt={item.name}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Name field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="Reference name"
            />
          </div>

          {/* Tags field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-violet-500/20 text-violet-300 text-sm rounded-lg"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="Add a tag..."
              />
              <button
                onClick={handleAddTag}
                disabled={!newTag.trim()}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Metadata (read-only) */}
          <div className="p-3 bg-gray-800/50 rounded-lg text-xs text-gray-400 space-y-1">
            <p>
              <span className="text-gray-500">Type:</span> {item.fileType.startsWith("video/") ? "Video" : "Image"}
            </p>
            <p>
              <span className="text-gray-500">Size:</span>{" "}
              {item.fileSize ? `${(item.fileSize / 1024 / 1024).toFixed(2)} MB` : "Unknown"}
            </p>
            {item.width && item.height && (
              <p>
                <span className="text-gray-500">Dimensions:</span> {item.width} × {item.height}
              </p>
            )}
            <p>
              <span className="text-gray-500">Created:</span>{" "}
              {new Date(item.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
