'use client';

import { memo } from 'react';
import { Play, ExternalLink, FileVideo, FileImage } from 'lucide-react';
import { QueueTicket } from './types';

interface ContentViewerProps {
  ticket: QueueTicket;
}

function ContentViewerComponent({ ticket }: ContentViewerProps) {
  // Determine if we have content to display
  const hasContent = ticket.contentUrl || ticket.videoUrl;
  const isGoogleDrive = ticket.contentSourceType === 'gdrive';
  const contentUrl = ticket.contentUrl || ticket.videoUrl;

  // Determine content type from URL
  const isVideo = contentUrl && (
    contentUrl.includes('.mp4') ||
    contentUrl.includes('.mov') ||
    contentUrl.includes('.webm') ||
    ticket.contentSourceType === 'upload' ||
    isGoogleDrive
  );

  return (
    <div className="h-full relative flex items-center justify-center bg-brand-off-white dark:bg-gray-800 border-b border-brand-mid-pink/20">
      {hasContent ? (
        <>
          {/* Display uploaded or Google Drive content */}
          {isGoogleDrive ? (
            // Google Drive embedded preview - constrained to prevent stretching
            <div className="w-full h-full flex items-center justify-center p-4">
              <div className="w-full h-full max-w-6xl max-h-[80vh] flex items-center justify-center">
                <iframe
                  src={contentUrl || ''}
                  className="w-full h-full rounded-lg shadow-xl"
                  allow="autoplay"
                  title="Google Drive Content"
                />
              </div>
            </div>
          ) : isVideo ? (
            // Video content
            <video
              src={contentUrl || ''}
              controls
              className="max-w-full max-h-full rounded-lg shadow-xl"
              preload="metadata"
            >
              Your browser does not support the video tag.
            </video>
          ) : (
            // Image content
            <img
              src={contentUrl || ''}
              alt={ticket.description}
              className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
            />
          )}

          {/* Drive link button (if available and not already GDrive) */}
          {ticket.driveLink && !isGoogleDrive && (
            <a
              href={ticket.driveLink}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-4 right-4 px-3 py-2 bg-white dark:bg-gray-900 hover:bg-brand-off-white dark:hover:bg-gray-800 border border-brand-mid-pink/20 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            >
              <ExternalLink size={12} />
              Open in Drive
            </a>
          )}

          {/* Content info badge */}
          <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-white text-xs flex items-center gap-2">
            {isVideo ? <FileVideo size={12} /> : <FileImage size={12} />}
            {ticket.contentSourceType === 'upload' ? 'Uploaded File' : 'Google Drive'}
          </div>
        </>
      ) : (
        // Placeholder when no content is available
        <div className="w-4/5 h-4/5 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex flex-col items-center justify-center gap-4 shadow-xl border border-brand-mid-pink/20">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
            <Play size={28} className="text-white" />
          </div>
          <div className="text-center px-4">
            <div className="text-sm font-medium text-white mb-1">
              {ticket.description}
            </div>
            <div className="text-xs text-gray-400">
              No content preview available
            </div>
          </div>

          {/* Drive link button */}
          {ticket.driveLink && (
            <a
              href={ticket.driveLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white text-xs flex items-center gap-2 cursor-pointer transition-colors"
            >
              <ExternalLink size={12} />
              Open in Drive
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(ContentViewerComponent);
