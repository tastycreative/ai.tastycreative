'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, Link2, X, FileVideo, FileImage, Loader2, CheckCircle, AlertCircle, Plus, Images } from 'lucide-react';

export interface ContentData {
  url: string;
  sourceType: 'upload' | 'gdrive';
  fileName?: string;
  fileType?: 'image' | 'video';
}

interface ContentUploaderProps {
  /** Called whenever the list of items changes */
  onContentChange: (items: ContentData[]) => void;
  value?: ContentData[];
}

const MAX_ITEMS = 20;

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

function getFileType(mimeType: string): 'image' | 'video' | null {
  if (ALLOWED_FILE_TYPES.image.includes(mimeType)) return 'image';
  if (ALLOWED_FILE_TYPES.video.includes(mimeType)) return 'video';
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// Item thumbnail card
// ───────────────────────────────────────────────────────────────────────────
function ItemCard({ item, index, onRemove }: { item: ContentData; index: number; onRemove: () => void }) {
  return (
    <div className="relative group rounded-xl overflow-hidden border border-brand-mid-pink/20 bg-white dark:bg-[#0f0d18] shadow-sm">
      <div className="aspect-square bg-gray-900 flex items-center justify-center overflow-hidden">
        {item.sourceType === 'gdrive' ? (
          <div className="flex flex-col items-center gap-1 text-gray-400 p-2">
            <Link2 size={24} className="text-brand-mid-pink" />
            <span className="text-[10px] text-center leading-tight">Drive Link</span>
          </div>
        ) : item.fileType === 'image' ? (
          <img src={item.url} alt={item.fileName || `item ${index + 1}`} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <FileVideo size={24} className="text-brand-mid-pink" />
            <span className="text-[10px]">Video</span>
          </div>
        )}
      </div>
      <div className="px-2 py-1.5 border-t border-brand-mid-pink/10">
        <p className="text-[10px] font-semibold text-brand-mid-pink">#{index + 1}</p>
        <p className="text-[10px] text-zinc-500 dark:text-white/40 truncate leading-tight">
          {item.fileName || (item.sourceType === 'gdrive' ? 'Drive link' : 'Uploaded')}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow"
        aria-label={`Remove item ${index + 1}`}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Main component
// ───────────────────────────────────────────────────────────────────────────
export function ContentUploader({ onContentChange, value = [] }: ContentUploaderProps) {
  const [items, setItems] = useState<ContentData[]>(value);
  const [mode, setMode] = useState<'upload' | 'link'>('upload');
  const [uploading, setUploading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [gdriveLinkInput, setGdriveLinkInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateItems = useCallback(
    (next: ContentData[]) => {
      setItems(next);
      onContentChange(next);
    },
    [onContentChange],
  );

  const uploadFile = useCallback(async (file: File): Promise<ContentData | null> => {
    if (file.size > MAX_FILE_SIZE) {
      setError(`"${file.name}" exceeds 500 MB limit`);
      return null;
    }
    const fileType = getFileType(file.type);
    if (!fileType) {
      setError(`"${file.name}" is an unsupported file type`);
      return null;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', fileType);
    const response = await fetch('/api/caption-queue/upload', { method: 'POST', body: formData });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'Upload failed');
    }
    const data = await response.json();
    return { url: data.url, sourceType: 'upload', fileName: file.name, fileType };
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const arr = Array.from(files);
    const available = MAX_ITEMS - items.length;
    if (available <= 0) { setError(`Maximum ${MAX_ITEMS} items per ticket`); return; }
    const toProcess = arr.slice(0, available);
    if (arr.length > available) setError(`Only ${available} more item(s) can be added (max ${MAX_ITEMS})`);

    setUploading(true);
    setUploadingCount(toProcess.length);

    const results: ContentData[] = [];
    for (const file of toProcess) {
      try {
        const result = await uploadFile(file);
        if (result) results.push(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
      setUploadingCount((c) => Math.max(0, c - 1));
    }

    setUploading(false);
    setUploadingCount(0);
    if (results.length > 0) updateItems([...items, ...results]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [items, uploadFile, updateItems]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(e.target.files);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };

  const removeItem = (index: number) => updateItems(items.filter((_, i) => i !== index));

  const handleGdriveLinkSubmit = () => {
    setError(null);
    if (!gdriveLinkInput.trim()) { setError('Please enter a Google Drive link'); return; }
    if (!isValidGoogleDriveUrl(gdriveLinkInput)) {
      setError('Invalid Google Drive URL. Use a shareable link like: https://drive.google.com/file/d/FILE_ID/view');
      return;
    }
    if (items.length >= MAX_ITEMS) { setError(`Maximum ${MAX_ITEMS} items per ticket`); return; }
    updateItems([...items, { url: convertToPreviewUrl(gdriveLinkInput), sourceType: 'gdrive' }]);
    setGdriveLinkInput('');
  };

  const canAddMore = items.length < MAX_ITEMS;

  return (
    <div className="space-y-4">
      {/* Existing items grid */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-500 dark:text-white/40 flex items-center gap-1.5">
              <Images size={13} className="text-brand-mid-pink" />
              {items.length} item{items.length !== 1 ? 's' : ''} added
              {items.length > 1 && (
                <span className="text-[11px] text-zinc-400 dark:text-white/25 ml-1">— each gets its own caption</span>
              )}
            </p>
            {canAddMore && (
              <span className="text-[11px] text-zinc-400 dark:text-white/25">{MAX_ITEMS - items.length} remaining</span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {items.map((item, i) => (
              <ItemCard key={`${item.url}-${i}`} item={item} index={i} onRemove={() => removeItem(i)} />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Upload zone / link input */}
      {canAddMore && (
        <>
          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            {(['upload', 'link'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === m
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                {m === 'upload' ? <Upload size={16} /> : <Link2 size={16} />}
                {m === 'upload' ? 'Upload Files' : 'Google Drive Link'}
              </button>
            ))}
          </div>

          {mode === 'upload' ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="relative border-2 border-dashed border-brand-mid-pink/30 dark:border-brand-mid-pink/40 rounded-xl p-8 text-center hover:border-brand-mid-pink/50 transition-colors bg-brand-off-white dark:bg-gray-800/50"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={[...ALLOWED_FILE_TYPES.image, ...ALLOWED_FILE_TYPES.video].join(',')}
                onChange={handleFileInputChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={uploading}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={40} className="text-brand-mid-pink animate-spin" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Uploading {uploadingCount > 1 ? `${uploadingCount} files` : 'file'}…
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-brand-mid-pink/10 rounded-full">
                    {items.length > 0 ? <Plus size={32} className="text-brand-mid-pink" /> : <Upload size={32} className="text-brand-mid-pink" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {items.length > 0 ? 'Add more files' : 'Drag & drop files here or click to browse'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Supports images (JPEG, PNG, GIF, WebP) and videos (MP4, MOV, WebM) · select multiple at once
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Max 500 MB per file · up to {MAX_ITEMS} items · each gets its own caption
                    </p>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <FileImage size={14} /> Images
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <FileVideo size={14} /> Videos
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
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-2 font-medium">How to get a shareable Google Drive link:</p>
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

      {/* Success note */}
      {items.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl">
          <CheckCircle size={14} className="text-emerald-500 shrink-0" />
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            {items.length === 1
              ? '1 item ready — caption writer will write one caption for it'
              : `${items.length} items ready — caption writer will write a separate caption for each`}
          </p>
        </div>
      )}
    </div>
  );
}


