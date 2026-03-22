'use client';

import { useState, useMemo } from 'react';
import { X, Film, FileVideo, FileImage, AlertCircle, X as XIcon, ShieldAlert } from 'lucide-react';
import { QueuePanel } from './QueuePanel';
import type { GifQueueTicket } from '@/lib/hooks/useGifQueue.query';
import { useInstagramProfile } from '@/lib/hooks/useInstagramProfile.query';
import { urgencyConfig, safeUrgency } from './queue-constants';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queue: GifQueueTicket[];
  selectedTicketId: string | null;
  onSelectTicket: (ticketId: string) => void;
  onStartEditing: (ticket: GifQueueTicket) => void;
}

export function QueueDrawer({
  isOpen,
  onClose,
  queue,
  selectedTicketId,
  onSelectTicket,
  onStartEditing,
}: QueueDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const selectedTicket = useMemo(
    () => queue.find((t) => t.id === selectedTicketId) ?? null,
    [queue, selectedTicketId]
  );

  // Filter queue for the QueuePanel (single filter, not double)
  const filteredQueue = useMemo(() => {
    if (!searchQuery) return queue;
    const q = searchQuery.toLowerCase();
    return queue.filter(
      (t) =>
        t.modelName.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
    );
  }, [queue, searchQuery]);

  const { data: modelContext, isLoading: loadingContext, error: contextError } = useInstagramProfile(selectedTicket?.profileId);

  return (
    <>
      {/* Backdrop */}
      <div
        role="presentation"
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-250 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-0 z-50 flex flex-col transition-transform duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Container with rounded corners and brand borders */}
        <div className="m-4 flex flex-col flex-1 min-h-0 border border-brand-mid-pink/20 rounded-2xl shadow-lg overflow-hidden bg-white dark:bg-gray-900/90 backdrop-blur-xl">
          {/* Header — matches Caption Workspace header exactly */}
          <div className="flex items-center justify-between h-[60px] px-4 lg:px-6 border-b border-brand-mid-pink/20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shrink-0 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-linear-to-br from-brand-mid-pink to-brand-light-pink shadow-lg shadow-brand-mid-pink/30 flex items-center justify-center">
                <FileVideo className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">GIF Maker Workspace</h2>
                <p className="text-[10px] lg:text-xs text-gray-500 dark:text-gray-400">Create GIFs for tasks</p>
              </div>
              <span className="px-2 py-1 bg-brand-mid-pink/15 text-brand-mid-pink dark:text-brand-light-pink rounded text-[10px] lg:text-xs font-semibold">
                {queue.length} in queue
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* 3-column layout — matches Caption Workspace grid */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left: Queue List (280px) */}
            <div className="w-[280px] border-r border-brand-mid-pink/20 shrink-0 overflow-hidden flex flex-col">
              <QueuePanel
                queue={filteredQueue}
                selectedTicketId={selectedTicketId}
                onSelectTicket={onSelectTicket}
                onStartEditing={onStartEditing}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            </div>

            {/* Center: Content Preview + Start Editing (flex-1, vertical 50/50 split like Caption Workspace) */}
            <div className="flex-1 flex flex-col min-w-0">
              {selectedTicket ? (
                <>
                  {/* Workflow instruction bar */}
                  <div className="px-4 py-2 bg-brand-blue/10 border-b border-brand-mid-pink/10 shrink-0">
                    <p className="text-xs text-brand-blue font-medium">
                      Create a GIF for this task, then export to flyer library.
                    </p>
                  </div>

                  {/* Top half: Content media preview */}
                  <div className="flex-1 basis-1/2 flex items-center justify-center overflow-hidden bg-brand-off-white dark:bg-gray-800 relative min-h-0">
                    <ContentPreview ticket={selectedTicket} />
                  </div>

                  {/* Resizer divider — matches Caption Workspace style */}
                  <div className="h-1.5 shrink-0 bg-brand-mid-pink/10 hover:bg-brand-mid-pink/20 transition-colors flex items-center justify-center">
                    <div className="w-12 h-1 rounded-full bg-brand-mid-pink/40" />
                  </div>

                  {/* Bottom half: Caption + Start Editing */}
                  <div className="flex-1 basis-1/2 flex flex-col min-h-0 bg-white dark:bg-gray-900/80">
                    {/* Caption display */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                      {selectedTicket.captionText ? (
                        <div>
                          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">Caption</span>
                          <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
                            {selectedTicket.captionText}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 gap-2">
                          <FileImage size={24} />
                          <p className="text-xs">No caption for this task</p>
                        </div>
                      )}
                    </div>

                    {/* Create GIF CTA — pinned at bottom of lower half */}
                    <div className="shrink-0 p-4 border-t border-brand-mid-pink/10 flex gap-3">
                      <button
                        onClick={() => onStartEditing(selectedTicket)}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-brand-light-pink to-brand-mid-pink text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-brand-mid-pink/20"
                      >
                        <Film size={16} />
                        Create GIF
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 gap-3 bg-brand-off-white dark:bg-gray-800">
                  <Film size={32} />
                  <p className="text-sm">Select a task to create GIF</p>
                </div>
              )}
            </div>

            {/* Right: Model Context (320px) — matches Caption Workspace ContextPanel */}
            <div className="w-[320px] border-l border-brand-mid-pink/20 shrink-0 overflow-hidden flex flex-col bg-white dark:bg-gray-900/80">
              {/* Tabs */}
              <div className="flex border-b border-brand-mid-pink/20 shrink-0">
                <div className="flex-1 py-3 text-xs font-semibold text-center border-b-2 border-brand-mid-pink bg-brand-off-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  Model Context
                </div>
              </div>

              {/* Context content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {selectedTicket ? (
                  loadingContext ? (
                    <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-xs">
                      Loading model context...
                    </div>
                  ) : contextError ? (
                    <div className="p-4 text-center text-red-500 text-xs">
                      <AlertCircle size={20} className="mx-auto mb-2" />
                      Failed to load model context
                    </div>
                  ) : modelContext ? (
                    <ModelContextPanel profile={modelContext} />
                  ) : null
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-xs">
                    Select a task to see model context
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Content Preview ───────────────────────────────────────

function ContentPreview({ ticket }: { ticket: GifQueueTicket }) {
  const items = ticket.contentItems;

  if (items.length === 0 && !ticket.contentUrl) {
    return (
      <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
        <FileImage size={40} />
        <span className="text-xs">No content attached</span>
      </div>
    );
  }

  const previewUrl = items[0]?.url ?? ticket.contentUrl;
  if (!previewUrl) return null;

  const isGDrive =
    previewUrl.includes('drive.google.com') || previewUrl.includes('googleusercontent.com');

  if (isGDrive) {
    const previewSrc = previewUrl.includes('/preview')
      ? previewUrl
      : previewUrl.replace(/\/view.*$/, '/preview');
    return (
      <div className="w-full max-w-xl aspect-video rounded-xl overflow-hidden border border-brand-mid-pink/10">
        <iframe
          src={previewSrc}
          className="w-full h-full"
          allow="autoplay"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    );
  }

  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(previewUrl);
  if (isVideo) {
    return (
      <video
        src={previewUrl}
        controls
        className="max-w-xl max-h-[50vh] rounded-xl border border-brand-mid-pink/10"
      />
    );
  }

  return (
    <img
      src={previewUrl}
      alt="Content preview"
      className="max-w-xl max-h-[50vh] rounded-xl object-contain border border-brand-mid-pink/10"
    />
  );
}

// ─── Model Context Panel (matches Caption Workspace ContextPanel) ─────

function ModelContextPanel({
  profile,
}: {
  profile: NonNullable<ReturnType<typeof useInstagramProfile>['data']>;
}) {
  const bible = profile.modelBible;
  const restrictions = bible?.restrictions;

  return (
    <div className="p-4 overflow-auto custom-scrollbar">
      {/* Profile header */}
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-brand-mid-pink/20">
        {profile.profileImageUrl ? (
          <img
            src={profile.profileImageUrl}
            alt={profile.name}
            className="w-12 h-12 rounded-xl object-cover shadow-lg shadow-brand-mid-pink/30"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-brand-light-pink to-brand-blue flex items-center justify-center">
            <span className="text-base font-semibold text-white">{profile.name.charAt(0)}</span>
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{profile.name}</h3>
          {profile.pageStrategy && (
            <span className="mt-1 inline-block px-2 py-1 bg-brand-mid-pink/15 text-brand-mid-pink dark:text-brand-light-pink rounded text-[10px] font-semibold">
              {profile.pageStrategy}
            </span>
          )}
        </div>
      </div>

      {/* Personality */}
      {bible?.personalityDescription && (
        <div className="mb-5">
          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">Personality</span>
          <div className="p-3 bg-brand-off-white dark:bg-gray-800 rounded-xl text-sm leading-relaxed border border-brand-mid-pink/10 text-gray-700 dark:text-gray-300">
            {bible.personalityDescription}
          </div>
        </div>
      )}

      {/* Background */}
      {bible?.backstory && (
        <div className="mb-5">
          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">Background</span>
          <div className="p-3 bg-brand-off-white dark:bg-gray-800 rounded-xl text-sm leading-relaxed border border-brand-mid-pink/10 text-gray-700 dark:text-gray-300">
            {bible.backstory}
          </div>
        </div>
      )}

      {/* Lingo & Keywords */}
      {bible?.lingoKeywords && bible.lingoKeywords.length > 0 && (
        <div className="mb-5">
          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">Lingo &amp; Keywords</span>
          <div className="flex flex-wrap gap-2">
            {bible.lingoKeywords.map((word) => (
              <span
                key={word}
                className="px-2.5 py-1.5 bg-brand-off-white dark:bg-gray-800 hover:bg-brand-mid-pink/10 border border-brand-mid-pink/20 hover:border-brand-mid-pink/50 rounded-lg text-xs text-gray-700 dark:text-gray-300 transition-all cursor-pointer"
              >
                &ldquo;{word}&rdquo;
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Preferred Emojis */}
      {bible?.preferredEmojis && bible.preferredEmojis.length > 0 && (
        <div className="mb-5">
          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">Emojis</span>
          <div className="flex flex-wrap gap-2">
            {bible.preferredEmojis.map((e) => (
              <span
                key={e}
                className="px-2.5 py-1.5 bg-brand-off-white dark:bg-gray-800 hover:bg-brand-mid-pink/10 border border-brand-mid-pink/20 hover:border-brand-mid-pink/50 rounded-lg text-lg transition-all cursor-pointer"
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Operator Notes */}
      {bible?.captionOperatorNotes && (
        <div className="mb-5">
          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">Operator Notes</span>
          <div className="p-3 bg-brand-blue/5 dark:bg-brand-blue/10 border border-brand-blue/20 rounded-xl text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {bible.captionOperatorNotes}
          </div>
        </div>
      )}

      {/* Restrictions */}
      {restrictions && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert size={11} className="text-red-500 dark:text-red-400" />
            <span className="text-[11px] font-semibold text-red-500 dark:text-red-400 uppercase tracking-wide">Restrictions</span>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl">
            {restrictions.contentLimitations && (
              <p className="text-xs text-red-600 dark:text-red-300 py-1 flex items-center gap-2">
                <XIcon size={10} className="shrink-0" /> {restrictions.contentLimitations}
              </p>
            )}
            {restrictions.wallRestrictions && (
              <p className="text-xs text-red-600 dark:text-red-300 py-1 flex items-center gap-2">
                <XIcon size={10} className="shrink-0" /> {restrictions.wallRestrictions}
              </p>
            )}
            {restrictions.mmExclusions && (
              <p className="text-xs text-red-600 dark:text-red-300 py-1 flex items-center gap-2">
                <XIcon size={10} className="shrink-0" /> {restrictions.mmExclusions}
              </p>
            )}
            {restrictions.customsToAvoid && (
              <p className="text-xs text-red-600 dark:text-red-300 py-1 flex items-center gap-2">
                <XIcon size={10} className="shrink-0" /> {restrictions.customsToAvoid}
              </p>
            )}
            {restrictions.wordingToAvoid && restrictions.wordingToAvoid.length > 0 && (
              <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-900/50">
                <div className="flex flex-wrap gap-1">
                  {restrictions.wordingToAvoid.map((w) => (
                    <span key={w} className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-[10px]">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Page Strategy */}
      {profile.pageStrategy && (
        <div className="mb-5">
          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">Page Strategy</span>
          <div className="p-3 bg-brand-off-white dark:bg-gray-800 rounded-xl text-sm leading-relaxed border border-brand-mid-pink/10 text-gray-700 dark:text-gray-300">
            {profile.pageStrategy}
          </div>
        </div>
      )}
    </div>
  );
}
