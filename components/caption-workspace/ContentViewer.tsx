'use client';

import { memo } from 'react';
import { Play, ExternalLink, FileVideo, FileImage, ChevronLeft, ChevronRight, Link2, CheckCircle } from 'lucide-react';
import { QueueTicket, ContentItemData } from './types';

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
          {isGdrive ? (
            <iframe src={item.url} className="w-full h-full" allow="autoplay" title="Google Drive Content" />
          ) : isImage ? (
            <img src={item.url} alt={item.fileName || ticket.description} className="max-w-full max-h-full object-contain" />
          ) : (
            <video src={item.url} controls className="max-w-full max-h-full rounded-lg" preload="metadata" />
          )}

          {/* Item badge */}
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-white text-xs flex items-center gap-1.5">
            {isImage ? <FileImage size={11} /> : isGdrive ? <Link2 size={11} /> : <FileVideo size={11} />}
            {selectedItemIndex + 1} / {items.length}
          </div>

          {/* Caption status badge */}
          {item.captionText && (
            <div className="absolute top-3 right-3 px-2 py-1 bg-emerald-600/80 backdrop-blur-sm rounded-lg text-white text-xs flex items-center gap-1">
              <CheckCircle size={11} /> Captioned
            </div>
          )}

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
                  {/* Captioned indicator */}
                  {thumb.captionText && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-tl-sm flex items-center justify-center">
                      <CheckCircle size={8} className="text-white" />
                    </div>
                  )}
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
            <div className="w-full h-full flex items-center justify-center p-4">
              <div className="w-full h-full max-w-6xl max-h-[80vh] flex items-center justify-center">
                <iframe src={contentUrl || ''} className="w-full h-full rounded-lg shadow-xl" allow="autoplay" title="Google Drive Content" />
              </div>
            </div>
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
