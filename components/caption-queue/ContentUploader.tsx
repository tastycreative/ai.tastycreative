'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, Link2, X, FileVideo, FileImage, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export interface ContentData {
  url: string;
  sourceType: 'upload' | 'gdrive';
  fileName?: string;
  fileType?: 'image' | 'video';
}

interface ContentUploaderProps {
  onContentChange: (content: ContentData | null) => void;
  value?: ContentData | null;
}

const ALLOWED_FILE_TYPES = {
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'],
};

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

/**
 * Validates if a string is a valid Google Drive URL
 */
function isValidGoogleDriveUrl(url: string): boolean {
  const patterns = [
    /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /^https:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
  ];
  return patterns.some(pattern => pattern.test(url));
}

/**
 * Extracts Google Drive file ID from URL
 */
function extractGoogleDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Converts Google Drive URL to direct preview/embed URL
 */
function convertToPreviewUrl(url: string): string {
  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) return url;
  
  // Return embed URL for better preview
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * Determines if file is image or video
 */
function getFileType(mimeType: string): 'image' | 'video' | null {
  if (ALLOWED_FILE_TYPES.image.includes(mimeType)) return 'image';
  if (ALLOWED_FILE_TYPES.video.includes(mimeType)) return 'video';
  return null;
}

export function ContentUploader({ onContentChange, value }: ContentUploaderProps) {
  const [mode, setMode] = useState<'upload' | 'link'>('upload');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gdriveLinkInput, setGdriveLinkInput] = useState('');
  const [previewData, setPreviewData] = useState<ContentData | null>(value || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size exceeds 500MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }

    // Validate file type
    const fileType = getFileType(file.type);
    if (!fileType) {
      setError('Invalid file type. Please upload an image (JPEG, PNG, GIF, WebP) or video (MP4, MOV, WebM)');
      return;
    }

    setUploading(true);

    try {
      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', fileType);

      // Upload to API
      const response = await fetch('/api/caption-queue/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      
      const contentData: ContentData = {
        url: data.url,
        sourceType: 'upload',
        fileName: file.name,
        fileType,
      };

      setPreviewData(contentData);
      onContentChange(contentData);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file');
      setPreviewData(null);
      onContentChange(null);
    } finally {
      setUploading(false);
    }
  }, [onContentChange]);

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag & drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Handle Google Drive link submission
  const handleGdriveLinkSubmit = () => {
    setError(null);
    
    if (!gdriveLinkInput.trim()) {
      setError('Please enter a Google Drive link');
      return;
    }

    if (!isValidGoogleDriveUrl(gdriveLinkInput)) {
      setError('Invalid Google Drive URL. Please use a shareable link like: https://drive.google.com/file/d/FILE_ID/view');
      return;
    }

    const previewUrl = convertToPreviewUrl(gdriveLinkInput);
    
    const contentData: ContentData = {
      url: previewUrl,
      sourceType: 'gdrive',
    };

    setPreviewData(contentData);
    onContentChange(contentData);
  };

  // Clear content
  const handleClear = () => {
    setPreviewData(null);
    setGdriveLinkInput('');
    setError(null);
    onContentChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Render preview based on content type
  const renderPreview = () => {
    if (!previewData) return null;

    return (
      <div className="relative border-2 border-brand-mid-pink/30 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800">
        <button
          onClick={handleClear}
          className="absolute top-2 right-2 z-10 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-lg"
          aria-label="Remove content"
        >
          <X size={16} />
        </button>

        {previewData.sourceType === 'gdrive' ? (
          <div className="aspect-video">
            <iframe
              src={previewData.url}
              className="w-full h-full"
              allow="autoplay"
              title="Google Drive Preview"
            />
          </div>
        ) : (
          <div className="aspect-video bg-gray-900 flex items-center justify-center">
            {previewData.fileType === 'image' ? (
              <img 
                src={previewData.url} 
                alt="Uploaded content" 
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <video 
                src={previewData.url} 
                controls 
                className="max-w-full max-h-full"
              />
            )}
          </div>
        )}

        <div className="p-3 bg-white dark:bg-gray-900 border-t border-brand-mid-pink/20">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {previewData.sourceType === 'upload' ? 'File uploaded successfully' : 'Google Drive link added'}
            </span>
          </div>
          {previewData.fileName && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
              {previewData.fileName}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'upload'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          <Upload size={16} />
          Upload File
        </button>
        <button
          type="button"
          onClick={() => setMode('link')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'link'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          <Link2 size={16} />
          Google Drive Link
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Preview or Input Area */}
      {previewData ? (
        renderPreview()
      ) : (
        <>
          {mode === 'upload' ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="relative border-2 border-dashed border-brand-mid-pink/30 dark:border-brand-mid-pink/40 rounded-xl p-8 text-center hover:border-brand-mid-pink/50 transition-colors bg-brand-off-white dark:bg-gray-800/50"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={[...ALLOWED_FILE_TYPES.image, ...ALLOWED_FILE_TYPES.video].join(',')}
                onChange={handleFileInputChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={uploading}
              />

              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={40} className="text-brand-mid-pink animate-spin" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Uploading...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-brand-mid-pink/10 rounded-full">
                    <Upload size={32} className="text-brand-mid-pink" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      Drag & drop your file here or click to browse
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Supports images (JPEG, PNG, GIF, WebP) and videos (MP4, MOV, WebM)
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Max file size: 500MB
                    </p>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <FileImage size={14} />
                      <span>Images</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <FileVideo size={14} />
                      <span>Videos</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="url"
                  value={gdriveLinkInput}
                  onChange={(e) => setGdriveLinkInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGdriveLinkSubmit()}
                  placeholder="https://drive.google.com/file/d/FILE_ID/view"
                  className="w-full px-4 py-3 pr-12 border border-brand-mid-pink/20 dark:border-brand-mid-pink/30 rounded-xl focus:border-brand-mid-pink focus:ring-2 focus:ring-brand-mid-pink/20 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400"
                />
                <Link2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              
              <button
                type="button"
                onClick={handleGdriveLinkSubmit}
                className="w-full px-4 py-3 bg-linear-to-r from-brand-mid-pink to-brand-light-pink hover:from-brand-dark-pink hover:to-brand-mid-pink text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-brand-mid-pink/30"
              >
                Add Google Drive Link
              </button>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl">
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-2 font-medium">
                  How to get a shareable Google Drive link:
                </p>
                <ol className="text-xs text-blue-600 dark:text-blue-400 space-y-1 ml-4 list-decimal">
                  <li>Open your file in Google Drive</li>
                  <li>Click "Share" button</li>
                  <li>Change access to "Anyone with the link"</li>
                  <li>Copy and paste the link here</li>
                </ol>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
