"use client";

import { useState } from "react";
import { X, Trash2, AlertTriangle } from "lucide-react";
import type { ReferenceItem } from "@/lib/reference-bank/api";

interface DeleteModalProps {
  item: ReferenceItem;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteModal({ item, onClose, onConfirm }: DeleteModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
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
          <h2 className="text-lg font-semibold text-white">Delete Reference</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Warning */}
          <div className="flex items-start gap-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
            <div>
              <h3 className="font-medium text-red-300">This action cannot be undone</h3>
              <p className="text-sm text-red-300/70 mt-1">
                The file will be permanently deleted from your storage.
              </p>
            </div>
          </div>

          {/* Item preview */}
          <div className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-xl">
            <div className="w-16 h-16 bg-gray-800 rounded-lg overflow-hidden shrink-0">
              {item.fileType.startsWith("video/") ? (
                <video
                  src={item.awsS3Url}
                  className="w-full h-full object-cover"
                  muted
                />
              ) : (
                <img
                  src={item.thumbnailUrl || item.awsS3Url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-white truncate">{item.name}</p>
              <p className="text-sm text-gray-400">
                {item.fileType.startsWith("video/") ? "Video" : "Image"} •{" "}
                {item.fileSize ? `${(item.fileSize / 1024 / 1024).toFixed(2)} MB` : "Unknown size"}
              </p>
            </div>
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
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
