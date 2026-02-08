'use client';

import { useState, useCallback } from 'react';
import { Upload, X, File as FileIcon, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { useFileUpload, useSubmissionFiles, useDeleteFile } from '@/lib/hooks/useContentSubmission.query';

interface FileUploadZoneProps {
  submissionId: string;
  maxFiles?: number;
  acceptedTypes?: string[];
  maxFileSizeMB?: number;
}

export function FileUploadZone({
  submissionId,
  maxFiles = 10,
  acceptedTypes = ['image/*', 'video/*'],
  maxFileSizeMB = 100,
}: FileUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const { uploadFile, isUploading } = useFileUpload();
  const { data: files = [], refetch } = useSubmissionFiles(submissionId);
  const deleteFile = useDeleteFile();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    await handleFiles(droppedFiles);
  }, [submissionId]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      await handleFiles(selectedFiles);
    }
  }, [submissionId]);

  const handleFiles = async (selectedFiles: File[]) => {
    // Validate file count
    if (files.length + selectedFiles.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate file sizes
    const maxBytes = maxFileSizeMB * 1024 * 1024;
    const invalidFiles = selectedFiles.filter(f => f.size > maxBytes);
    if (invalidFiles.length > 0) {
      alert(`Files must be under ${maxFileSizeMB}MB`);
      return;
    }

    // Upload files
    for (const file of selectedFiles) {
      const fileId = `${file.name}-${Date.now()}`;

      try {
        await uploadFile(file, submissionId, {
          onProgress: (progress) => {
            setUploadProgress(prev => ({
              ...prev,
              [fileId]: progress,
            }));
          },
        });

        // Remove progress after completion
        setUploadProgress(prev => {
          const next = { ...prev };
          delete next[fileId];
          return next;
        });

        refetch();
      } catch (error) {
        console.error('Upload failed:', file.name, error);
        alert(`Failed to upload ${file.name}`);
      }
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Delete this file?')) return;

    try {
      await deleteFile.mutateAsync({ id: fileId });
      refetch();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete file');
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
    if (fileType.startsWith('video/')) return <VideoIcon className="w-4 h-4" />;
    return <FileIcon className="w-4 h-4" />;
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 transition-colors
          ${dragActive
            ? 'border-brand-light-pink bg-brand-light-pink/10'
            : 'border-gray-300 dark:border-gray-700 hover:border-brand-light-pink'
          }
          ${files.length >= maxFiles ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          disabled={files.length >= maxFiles}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-brand-light-pink/20 flex items-center justify-center">
            <Upload className="w-8 h-8 text-brand-light-pink" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {acceptedTypes.join(', ')} • Max {maxFileSizeMB}MB • {files.length}/{maxFiles} files
            </p>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2">
          {Object.entries(uploadProgress).map(([fileId, progress]) => (
            <div key={fileId} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Uploading...
                </span>
                <span className="text-sm text-gray-500">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-brand-light-pink h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="relative group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:shadow-md transition-shadow"
            >
              {/* Delete Button */}
              <button
                onClick={() => handleDelete(file.id)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>

              {/* File Preview */}
              <div className="aspect-square bg-gray-100 dark:bg-gray-900 rounded-md mb-2 flex items-center justify-center overflow-hidden">
                {file.fileCategory === 'image' ? (
                  <img
                    src={file.awsS3Url}
                    alt={file.fileName}
                    className="w-full h-full object-cover"
                  />
                ) : file.fileCategory === 'video' ? (
                  file.thumbnailUrl ? (
                    <img
                      src={file.thumbnailUrl}
                      alt={file.fileName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <VideoIcon className="w-12 h-12 text-gray-400" />
                  )
                ) : (
                  <FileIcon className="w-12 h-12 text-gray-400" />
                )}
              </div>

              {/* File Info */}
              <div className="flex items-start space-x-2">
                {getFileIcon(file.fileType)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {file.fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
