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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-[#1a1625] rounded-2xl shadow-2xl max-w-lg w-full border border-[#EC67A1]/20 dark:border-[#EC67A1]/30">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#EC67A1]/10 dark:border-[#EC67A1]/20">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Upload References</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              dragOver
                ? "border-[#EC67A1] bg-[#EC67A1]/10"
                : "border-zinc-200 dark:border-zinc-700 hover:border-[#EC67A1]/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
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
                dragOver ? "text-[#EC67A1]" : "text-zinc-400 dark:text-zinc-500"
              }`}
            />
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
              {dragOver ? "Drop files here" : "Drag & drop files"}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">or click to browse</p>

            {/* File type icons */}
            <div className="flex items-center justify-center gap-4 text-zinc-500 dark:text-zinc-400">
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
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-500 whitespace-pre-line">{error}</p>
            </div>
          )}

          {/* Info */}
          <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-[#EC67A1]/10">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-zinc-900 dark:text-white">Supported formats:</span> JPEG, PNG, GIF, WebP, MP4, WebM, MOV
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              <span className="font-medium text-zinc-900 dark:text-white">Max file size:</span> 100MB per file
            </p>
            {currentFolderId && (
              <p className="text-xs text-[#EC67A1] mt-1">
                Files will be uploaded to the current folder
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#EC67A1]/10 dark:border-[#EC67A1]/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] text-white font-medium rounded-lg transition-all shadow-lg shadow-[#EC67A1]/30"
          >
            Select Files
          </button>
        </div>
      </div>
    </div>
  );
}
