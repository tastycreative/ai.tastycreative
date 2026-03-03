'use client';

import { memo, useState, useEffect } from 'react';
import { Play, ExternalLink, FileVideo, FileImage, ChevronLeft, ChevronRight, Link2, CheckCircle, ShieldCheck, FolderOpen } from 'lucide-react';
import { QueueTicket, ContentItemData } from './types';

/* ── Google Drive helpers ──────────────────────────────────────────── */

/** Extract a file/folder ID from common Google Drive URL formats. */
function extractDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** Build a preview URL suitable for <iframe> embedding. */
function toPreviewUrl(url: string): string {
  // Already a /preview URL — use as-is
  if (url.includes('/preview')) return url;
  const id = extractDriveFileId(url);
  if (!id) return url;
  return `https://drive.google.com/file/d/${id}/preview`;
}

/** Build the normal shareable URL (for "Open in Drive" button). */
function toViewUrl(url: string): string {
  if (url.includes('/preview')) return url.replace('/preview', '/view');
  return url;
}

/** true when the link points at a Drive *folder* (cannot be previewed). */
function isDriveFolder(url: string): boolean {
  return url.includes('/folders/');
}

/* ── Drive preview component ───────────────────────────────────────── */

/** Build an embeddable URL for a Google Drive folder (grid view). */
function toFolderEmbedUrl(url: string): string | null {
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (!m?.[1]) return null;
  return `https://drive.google.com/embeddedfolderview?id=${m[1]}#grid`;
}

/** Skeleton shimmer shown while an iframe is loading. */
function IframeSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900 animate-pulse">
      <div className="w-12 h-12 rounded-xl bg-gray-700" />
      <div className="h-3 w-32 rounded bg-gray-700" />
      <div className="h-2 w-24 rounded bg-gray-800" />
    </div>
  );
}

/** Renders a Google Drive file/folder as an embedded iframe preview with a
 *  small "Open in Drive" fallback link. Forces a full remount + skeleton
 *  whenever the URL changes so stale content never lingers. */
function DrivePreview({ url, label }: { url: string; label?: string }) {
  const [loaded, setLoaded] = useState(false);

  // Reset loaded state whenever the URL changes so the skeleton reappears
  useEffect(() => { setLoaded(false); }, [url]);

  const viewUrl = toViewUrl(url);

  // Folders — use the embedded folder grid view
  if (isDriveFolder(url)) {
    const folderEmbedUrl = toFolderEmbedUrl(url);

    return (
      <div className="relative w-full h-full flex flex-col">
        {!loaded && <IframeSkeleton />}
        {folderEmbedUrl ? (
          <iframe
            key={folderEmbedUrl}
            src={folderEmbedUrl}
            className="flex-1 w-full border-0 bg-white rounded-lg"
            style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }}
            sandbox="allow-scripts allow-same-origin allow-popups"
            onLoad={() => setLoaded(true)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <FolderOpen className="w-12 h-12 text-blue-400" />
            <p className="text-sm text-gray-400">{label ?? 'Google Drive Folder'}</p>
          </div>
        )}
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-black/60 hover:bg-black/80 backdrop-blur-sm transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Open in Drive
        </a>
      </div>
    );
  }

  // File — embed preview iframe
  const previewUrl = toPreviewUrl(url);
  return (
    <div className="relative w-full h-full flex flex-col">
      {!loaded && <IframeSkeleton />}
      <iframe
        key={previewUrl}
        src={previewUrl}
        className="flex-1 w-full border-0"
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }}
        allow="autoplay; encrypted-media"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-popups"
        onLoad={() => setLoaded(true)}
      />
      <a
        href={viewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-black/60 hover:bg-black/80 backdrop-blur-sm transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Open in Drive
      </a>
    </div>
  );
}

/* ── Per-item media renderer ───────────────────────────────────────── */

/** Renders a single content item (image / video / drive) with a
 *  fade-in + skeleton so nothing lingers when switching tickets. */
function MediaItem({ item, description }: { item: ContentItemData; description: string }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setLoaded(false); }, [item.url]);

  const isGdrive = item.sourceType === 'gdrive';
  const isImage = item.fileType === 'image' || (!item.fileType && !isGdrive && !!item.url.match(/\.(jpg|jpeg|png|gif|webp)/i));

  if (isGdrive) {
    return <DrivePreview url={item.url} label={item.fileName ?? undefined} />;
  }

  if (isImage) {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {!loaded && <IframeSkeleton />}
        <img
          key={item.url}
          src={item.url}
          alt={item.fileName || description}
          className="max-w-full max-h-full object-contain"
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }}
          onLoad={() => setLoaded(true)}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {!loaded && <IframeSkeleton />}
      <video
        key={item.url}
        src={item.url}
        controls
        className="max-w-full max-h-full rounded-lg"
        preload="metadata"
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }}
        onLoadedMetadata={() => setLoaded(true)}
      />
    </div>
  );
}

interface ContentViewerProps {
  ticket?: QueueTicket;
  selectedItemIndex?: number;
  onSelectItem?: (index: number) => void;
}

function ContentViewerComponent({ ticket, selectedItemIndex = 0, onSelectItem }: ContentViewerProps) {
  if (!ticket) {
    return (
      <div className="h-full relative flex items-center justify-center bg-brand-off-white dark:bg-gray-800 border-b border-brand-mid-pink/20" />
    );
  }

  // ── Multi-item mode ────────────────────────────────────────────────────
  const items: ContentItemData[] = ticket.contentItems ?? [];
  const hasItems = items.length > 0;

  if (hasItems) {
    const item = items[selectedItemIndex] ?? items[0];
    const isGdrive = item.sourceType === 'gdrive';
    const isImage = item.fileType === 'image' || (!item.fileType && !isGdrive && (item.url.match(/\.(jpg|jpeg|png|gif|webp)/i)));

    return (
      <div className="h-full flex flex-col bg-brand-off-white dark:bg-gray-800 border-b border-brand-mid-pink/20 overflow-hidden">
        {/* Main viewer */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-0">
          <MediaItem item={item} description={ticket.description} />

          {/* Item badge */}
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-white text-xs flex items-center gap-1.5">
            {isImage ? <FileImage size={11} /> : isGdrive ? <Link2 size={11} /> : <FileVideo size={11} />}
            {selectedItemIndex + 1} / {items.length}
          </div>

          {/* Caption status badge */}
          {item.captionStatus === 'approved' ? (
            <div className="absolute top-3 right-3 px-2 py-1 bg-emerald-600/90 backdrop-blur-sm rounded-lg text-white text-xs font-semibold flex items-center gap-1">
              <ShieldCheck size={11} /> Approved — Locked
            </div>
          ) : item.captionText ? (
            <div className="absolute top-3 right-3 px-2 py-1 bg-emerald-600/80 backdrop-blur-sm rounded-lg text-white text-xs flex items-center gap-1">
              <CheckCircle size={11} /> Captioned
            </div>
          ) : null}

          {/* Navigation arrows */}
          {items.length > 1 && (
            <>
              <button
                onClick={() => onSelectItem?.(Math.max(0, selectedItemIndex - 1))}
                disabled={selectedItemIndex === 0}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/70 disabled:opacity-25 text-white rounded-full transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => onSelectItem?.(Math.min(items.length - 1, selectedItemIndex + 1))}
                disabled={selectedItemIndex === items.length - 1}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/70 disabled:opacity-25 text-white rounded-full transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>

        {/* Film strip thumbnails */}
        {items.length > 1 && (
          <div className="flex gap-1.5 p-1.5 bg-gray-100 dark:bg-gray-900 border-t border-brand-mid-pink/10 overflow-x-auto custom-scrollbar shrink-0">
            {items.map((thumb, i) => {
              const thumbIsImage = thumb.fileType === 'image' || (!thumb.fileType && thumb.sourceType !== 'gdrive' && thumb.url.match(/\.(jpg|jpeg|png|gif|webp)/i));
              const isSelected = i === selectedItemIndex;
              return (
                <button
                  key={thumb.id}
                  onClick={() => onSelectItem?.(i)}
                  className={`relative shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                    isSelected
                      ? 'border-brand-mid-pink shadow-sm shadow-brand-mid-pink/30'
                      : thumb.captionStatus === 'approved'
                        ? 'border-emerald-500/50 opacity-60'
                        : 'border-transparent hover:border-brand-mid-pink/40'
                  }`}
                >
                  {thumbIsImage ? (
                    <img src={thumb.url} alt={`item ${i + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      {thumb.sourceType === 'gdrive' ? <Link2 size={14} className="text-brand-mid-pink" /> : <FileVideo size={14} className="text-brand-mid-pink" />}
                    </div>
                  )}
                  {/* Approved overlay */}
                  {thumb.captionStatus === 'approved' ? (
                    <div className="absolute inset-0 bg-emerald-900/40 flex items-center justify-center">
                      <ShieldCheck size={14} className="text-emerald-300" />
                    </div>
                  ) : thumb.captionText ? (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-tl-sm flex items-center justify-center">
                      <CheckCircle size={8} className="text-white" />
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Legacy single-content mode ─────────────────────────────────────────
  const hasContent = ticket.contentUrl || ticket.videoUrl;
  const isGoogleDrive = ticket.contentSourceType === 'gdrive';
  const contentUrl = ticket.contentUrl || ticket.videoUrl;
  const isVideo = contentUrl && (
    contentUrl.includes('.mp4') || contentUrl.includes('.mov') || contentUrl.includes('.webm') ||
    ticket.contentSourceType === 'upload' || isGoogleDrive
  );

  return (
    <div className="h-full relative flex items-center justify-center bg-brand-off-white dark:bg-gray-800 border-b border-brand-mid-pink/20">
      {hasContent ? (
        <>
          {isGoogleDrive ? (
            <DrivePreview url={contentUrl || ''} />
          ) : isVideo ? (
            <video src={contentUrl || ''} controls className="max-w-full max-h-full rounded-lg shadow-xl" preload="metadata">
              Your browser does not support the video tag.
            </video>
          ) : (
            <img src={contentUrl || ''} alt={ticket.description} className="max-w-full max-h-full object-contain rounded-lg shadow-xl" />
          )}
          {ticket.driveLink && !isGoogleDrive && (
            <a href={ticket.driveLink} target="_blank" rel="noopener noreferrer" className="absolute top-4 right-4 px-3 py-2 bg-white dark:bg-gray-900 hover:bg-brand-off-white dark:hover:bg-gray-800 border border-brand-mid-pink/20 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm">
              <ExternalLink size={12} /> Open in Drive
            </a>
          )}
          <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-white text-xs flex items-center gap-2">
            {isVideo ? <FileVideo size={12} /> : <FileImage size={12} />}
            {ticket.contentSourceType === 'upload' ? 'Uploaded File' : 'Google Drive'}
          </div>
        </>
      ) : (
        <div className="w-4/5 h-4/5 bg-linear-to-br from-gray-800 to-gray-900 rounded-xl flex flex-col items-center justify-center gap-4 shadow-xl border border-brand-mid-pink/20">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
            <Play size={28} className="text-white" />
          </div>
          <div className="text-center px-4">
            <div className="text-sm font-medium text-white mb-1">{ticket.description}</div>
            <div className="text-xs text-gray-400">No content preview available</div>
          </div>
          {ticket.driveLink && (
            <a href={ticket.driveLink} target="_blank" rel="noopener noreferrer" className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white text-xs flex items-center gap-2 cursor-pointer transition-colors">
              <ExternalLink size={12} /> Open in Drive
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(ContentViewerComponent);
