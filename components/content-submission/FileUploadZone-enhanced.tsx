'use client';

import { memo, useCallback, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  X,
  File,
  Image as ImageIcon,
  Video,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

interface FileUploadZoneProps {
  submissionId: string;
  maxFiles?: number;
  maxSizeInMB?: number;
  acceptedTypes?: string[];
  onFilesUploaded?: (files: UploadedFile[]) => void;
}

export const FileUploadZone = memo(function FileUploadZone({
  submissionId,
  maxFiles = 10,
  maxSizeInMB = 100,
  acceptedTypes = ['image/*', 'video/*', 'application/pdf'],
  onFilesUploaded,
}: FileUploadZoneProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Simulate file upload (replace with actual API call)
  const uploadFile = async (file: File): Promise<void> => {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setFiles((prev) =>
          prev.map((f) =>
            f.file === file ? { ...f, progress } : f
          )
        );
        if (progress >= 100) {
          clearInterval(interval);
          setFiles((prev) =>
            prev.map((f) =>
              f.file === file
                ? { ...f, status: 'success', progress: 100 }
                : f
            )
          );
          resolve();
        }
      }, 200);
    });
  };

  const handleFiles = useCallback(
    async (newFiles: FileList | null) => {
      if (!newFiles) return;

      const fileArray = Array.from(newFiles);

      // Validate file count
      if (files.length + fileArray.length > maxFiles) {
        alert(`Maximum ${maxFiles} files allowed`);
        return;
      }

      // Validate and process files
      const validFiles: UploadedFile[] = [];
      for (const file of fileArray) {
        // Validate size
        if (file.size > maxSizeInMB * 1024 * 1024) {
          alert(`File ${file.name} exceeds ${maxSizeInMB}MB limit`);
          continue;
        }

        // Create preview for images
        let preview: string | undefined;
        if (file.type.startsWith('image/')) {
          preview = URL.createObjectURL(file);
        }

        validFiles.push({
          id: Math.random().toString(36).substring(7),
          file,
          preview,
          progress: 0,
          status: 'uploading',
        });
      }

      setFiles((prev) => [...prev, ...validFiles]);

      // Upload files
      for (const fileObj of validFiles) {
        try {
          await uploadFile(fileObj.file);
        } catch (error) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileObj.id
                ? {
                    ...f,
                    status: 'error',
                    error: 'Upload failed',
                  }
                : f
            )
          );
        }
      }

      if (onFilesUploaded) {
        onFilesUploaded(validFiles);
      }
    },
    [files.length, maxFiles, maxSizeInMB, onFilesUploaded]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;

      const droppedFiles = e.dataTransfer.files;
      handleFiles(droppedFiles);
    },
    [handleFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    },
    [handleFiles]
  );

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    if (type.startsWith('video/')) return Video;
    if (type.includes('pdf')) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <motion.div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative rounded-2xl border-2 border-dashed cursor-pointer
          transition-all duration-300 overflow-hidden
          ${
            isDragging
              ? 'border-brand-light-pink bg-brand-light-pink/10 scale-[1.02]'
              : 'border-zinc-700/50 bg-zinc-900/30 hover:border-brand-light-pink/50 hover:bg-zinc-900/50'
          }
        `}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-light-pink/5 via-transparent to-brand-blue/5 opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="relative p-12 text-center">
          <motion.div
            animate={isDragging ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-light-pink/20 mb-6"
          >
            <Upload className={`w-8 h-8 ${isDragging ? 'text-brand-light-pink' : 'text-zinc-400'} transition-colors`} />
          </motion.div>

          <h3 className="text-xl font-semibold text-white mb-2">
            {isDragging ? 'Drop files here' : 'Upload Files'}
          </h3>
          <p className="text-sm text-zinc-400 mb-4">
            Drag & drop files here, or click to browse
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
            <span>Max {maxFiles} files</span>
            <span>•</span>
            <span>Up to {maxSizeInMB}MB each</span>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          className="hidden"
        />
      </motion.div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-zinc-300">
              Uploaded Files ({files.length}/{maxFiles})
            </h4>
            <button
              onClick={() => setFiles([])}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Clear all
            </button>
          </div>

          <AnimatePresence mode="popLayout">
            {files.map((fileObj) => {
              const Icon = getFileIcon(fileObj.file.type);

              return (
                <motion.div
                  key={fileObj.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="relative bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 backdrop-blur-sm group"
                >
                  <div className="flex items-center gap-4">
                    {/* File Preview/Icon */}
                    <div className="flex-shrink-0">
                      {fileObj.preview ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-800">
                          <img
                            src={fileObj.preview}
                            alt={fileObj.file.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center">
                          <Icon className="w-6 h-6 text-zinc-500" />
                        </div>
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {fileObj.file.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatFileSize(fileObj.file.size)}
                      </p>

                      {/* Progress Bar */}
                      {fileObj.status === 'uploading' && (
                        <div className="mt-2">
                          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-brand-light-pink to-brand-blue"
                              initial={{ width: 0 }}
                              animate={{ width: `${fileObj.progress}%` }}
                              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Error Message */}
                      {fileObj.status === 'error' && fileObj.error && (
                        <p className="text-xs text-red-400 mt-1">
                          {fileObj.error}
                        </p>
                      )}
                    </div>

                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {fileObj.status === 'uploading' && (
                        <Loader2 className="w-5 h-5 text-brand-blue animate-spin" />
                      )}
                      {fileObj.status === 'success' && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        >
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </motion.div>
                      )}
                      {fileObj.status === 'error' && (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeFile(fileObj.id)}
                      className="flex-shrink-0 p-1 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
});
