"use client";

import { useState, useRef, useCallback } from "react";
import { X, Upload, Image, Video, AlertCircle } from "lucide-react";

interface UploadModalProps {
  onClose: () => void;
  onFilesSelected: (files: FileList | File[]) => void;
  currentFolderId: string | null;
}

const ACCEPTED_TYPES = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export function UploadModal({ onClose, onFilesSelected, currentFolderId }: UploadModalProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback((files: FileList | File[]): File[] => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of fileArray) {
      const allAccepted = [...ACCEPTED_TYPES.image, ...ACCEPTED_TYPES.video];
      
      if (!allAccepted.includes(file.type)) {
        errors.push(`${file.name}: Unsupported file type`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large (max 100MB)`);
        continue;
      }

      validFiles.push(file);
    }

    if (errors.length > 0) {
      setError(errors.join("\n"));
    }

    return validFiles;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      setError(null);

      const validFiles = validateFiles(e.dataTransfer.files);
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
        onClose();
      }
    },
    [validateFiles, onFilesSelected, onClose]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      if (e.target.files && e.target.files.length > 0) {
        const validFiles = validateFiles(e.target.files);
        if (validFiles.length > 0) {
          onFilesSelected(validFiles);
          onClose();
        }
      }
    },
    [validateFiles, onFilesSelected, onClose]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Upload References</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              dragOver
                ? "border-violet-500 bg-violet-500/10"
                : "border-gray-700 hover:border-gray-600 hover:bg-gray-800/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload
              className={`w-12 h-12 mx-auto mb-4 ${
                dragOver ? "text-violet-400" : "text-gray-500"
              }`}
            />
            <h3 className="text-lg font-medium text-white mb-2">
              {dragOver ? "Drop files here" : "Drag & drop files"}
            </h3>
            <p className="text-sm text-gray-400 mb-4">or click to browse</p>

            {/* File type icons */}
            <div className="flex items-center justify-center gap-4 text-gray-500">
              <div className="flex items-center gap-1.5">
                <Image className="w-4 h-4" />
                <span className="text-xs">Images</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Video className="w-4 h-4" />
                <span className="text-xs">Videos</span>
              </div>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={[...ACCEPTED_TYPES.image, ...ACCEPTED_TYPES.video].join(",")}
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300 whitespace-pre-line">{error}</p>
            </div>
          )}

          {/* Info */}
          <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
            <p className="text-xs text-gray-400">
              <span className="font-medium text-gray-300">Supported formats:</span> JPEG, PNG, GIF, WebP, MP4, WebM, MOV
            </p>
            <p className="text-xs text-gray-400 mt-1">
              <span className="font-medium text-gray-300">Max file size:</span> 100MB per file
            </p>
            {currentFolderId && (
              <p className="text-xs text-violet-400 mt-1">
                Files will be uploaded to the current folder
              </p>
            )}
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
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors"
          >
            Select Files
          </button>
        </div>
      </div>
    </div>
  );
}
