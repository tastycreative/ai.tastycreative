'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  X,
  Pencil,
  Image as ImageIcon,
  CalendarDays,
  User,
  AtSign,
  FileText,
  Clock,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  PanelRightOpen,
  PanelRightClose,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  Lock,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import type { BoardTask } from '../../board/BoardTaskCard';
import { EditableField } from '../../board/EditableField';
import { SelectField } from '../../board/SelectField';
import {
  ActivityFeed,
  type TaskComment,
  type TaskHistoryEntry,
} from '../../board/ActivityFeed';
import { useSpaceBySlug } from '@/lib/hooks/useSpaces.query';
import { useSpaceMembers } from '@/lib/hooks/useSpaceMembers.query';
import { SearchableDropdown } from '@/components/ui/SearchableDropdown';
import {
  useBoardItemComments,
  useAddComment,
  useBoardItemHistory,
  useBoardItemMedia,
  useContentItemComments,
  useAddContentItemComment,
  useContentItemHistory,
  useAllContentItemComments,
} from '@/lib/hooks/useBoardItems.query';
import { usePushToCaptionWorkspace, useQAAction, useQAItemAction, useRepushRejected, useMarkItemPosted } from '@/lib/hooks/useCaptionQueue.query';
import { useOrgRole } from '@/lib/hooks/useOrgRole.query';
import { useGoogleDriveAccount } from '@/lib/hooks/useGoogleDriveAccount';
import {
  WALL_POST_STATUS,
  WALL_POST_STATUS_CONFIG,
  type WallPostStatus,
  deriveTicketStatus,
  captionStatusToWallPostStatus,
} from '@/lib/wall-post-status';

/* ── Google Drive URL helpers ─────────────────────────────── */

/** Extract a file ID from common Google Drive URL patterns. */
function extractDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** Check if a URL is a Google Drive URL. */
function isDriveUrl(url: string): boolean {
  return url.includes('drive.google.com') || url.includes('lh3.googleusercontent.com/d/');
}

/** Convert a Drive URL to our streaming proxy URL. */
function toDriveStreamUrl(url: string): string | null {
  const id = extractDriveFileId(url);
  if (!id) return null;
  return `/api/google-drive/stream?fileId=${encodeURIComponent(id)}`;
}

/**
 * Auth-aware Drive media viewer.
 * Shows a sign-in prompt when not signed in, runs a pre-flight ping when signed in,
 * and renders the actual media (video or image) only when access is confirmed.
 */
function DriveMediaViewer({
  url, isVideo, className, isSignedIn, onSignIn,
}: {
  url: string;
  isVideo: boolean;
  className?: string;
  isSignedIn?: boolean;
  onSignIn?: () => void;
}) {
  const [streamStatus, setStreamStatus] = useState<'checking' | 'ok' | 'no_token' | 'no_access' | 'error'>('checking');

  const fileId = extractDriveFileId(url);
  const streamUrl = isSignedIn && fileId ? `/api/google-drive/stream?fileId=${encodeURIComponent(fileId)}` : null;

  useEffect(() => {
    if (!streamUrl) return;
    let cancelled = false;
    setStreamStatus('checking');
    fetch(`${streamUrl}&ping=true`)
      .then(res => {
        if (cancelled) return;
        if (res.status === 401) setStreamStatus('no_token');
        else if (res.status === 403) setStreamStatus('no_access');
        else if (res.ok) setStreamStatus('ok');
        else setStreamStatus('error');
      })
      .catch(() => { if (!cancelled) setStreamStatus('error'); });
    return () => { cancelled = true; };
  }, [streamUrl]);

  const signInPrompt = (
    <div className={`flex flex-col items-center justify-center gap-2 bg-black/40 ${className ?? ''}`}>
      <LogIn size={18} className="text-gray-500" />
      <p className="text-[10px] text-gray-500 text-center px-2">Sign in with Google to view</p>
      {onSignIn && (
        <button
          type="button"
          onClick={onSignIn}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white text-gray-800 hover:bg-gray-100 transition-colors"
        >
          <LogIn size={10} /> Sign in
        </button>
      )}
    </div>
  );

  if (!isSignedIn) return signInPrompt;

  if (streamStatus === 'checking') {
    return (
      <div className={`flex items-center justify-center bg-black/40 ${className ?? ''}`}>
        <Loader2 size={18} className="text-gray-500 animate-spin" />
      </div>
    );
  }

  if (streamStatus === 'no_token') {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-black/40 ${className ?? ''}`}>
        <LogIn size={18} className="text-yellow-500" />
        <p className="text-[10px] text-gray-400 text-center px-2">Session expired</p>
        {onSignIn && (
          <button
            type="button"
            onClick={onSignIn}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white text-gray-800 hover:bg-gray-100 transition-colors"
          >
            Sign in again
          </button>
        )}
      </div>
    );
  }

  if (streamStatus === 'no_access') {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-black/40 ${className ?? ''}`}>
        <Lock size={18} className="text-red-400" />
        <p className="text-[10px] text-red-300 text-center px-2">No access with this account</p>
      </div>
    );
  }

  if (streamStatus === 'error') {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-black/40 ${className ?? ''}`}>
        <AlertTriangle size={18} className="text-gray-500" />
        <p className="text-[10px] text-gray-500 text-center px-2">Failed to load</p>
      </div>
    );
  }

  if (isVideo) {
    return <video src={streamUrl!} className={className} controls preload="metadata" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={streamUrl!} alt="" loading="lazy" decoding="async" className={className} />
  );
}

/** Compact Google Account Bar for the Drive content section of the modal. */
function WallPostGoogleBar({
  profile, isSignedIn, onSignIn, onSignOut, onSwitch,
}: {
  profile: { email: string; name: string; picture: string } | null;
  isSignedIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onSwitch: () => void;
}) {
  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg"
        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-[11px] text-gray-500">Sign in with Google to view Drive content</span>
        <button
          type="button"
          onClick={onSignIn}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-white text-gray-800 hover:bg-gray-50 transition-colors"
        >
          <LogIn size={11} /> Sign in
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between px-3 py-1.5 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2 min-w-0">
        {profile?.picture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.picture} alt="" className="w-4 h-4 rounded-full shrink-0" referrerPolicy="no-referrer" />
        )}
        <span className="text-[11px] text-gray-400 truncate">{profile?.email}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onSwitch}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-brand-mid-pink hover:bg-brand-mid-pink/10 transition-colors"
        >
          <RefreshCw size={9} /> Switch
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-gray-500 hover:bg-white/10 transition-colors"
        >
          <LogOut size={9} /> Sign out
        </button>
      </div>
    </div>
  );
}

/** Small Drive thumbnail for the filmstrip. Uses browser Google session cookies — no token needed. */
function DriveThumbnailSmall({ url, alt }: { url: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  const id = extractDriveFileId(url);
  if (!id || failed) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <span className="text-[7px] text-gray-400 font-bold">IMG</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=s80`}
      alt={alt ?? ''}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

/* ── Types ───────────────────────────────────────────────── */

interface Props {
  task: BoardTask;
  columnTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: BoardTask) => void;
}

type ModalTab = 'description' | 'photos';

interface WallPostPhoto {
  id: string;
  url: string;
  status: 'pending_review' | 'ready_to_post' | 'posted' | 'rejected';
  name?: string;
  type?: string;
}

/* ── Constants ───────────────────────────────────────────── */

const PLATFORM_OPTIONS = ['onlyfans', 'fansly', 'instagram', 'twitter', 'reddit'];

const PRIORITY_PILL: Record<string, string> = {
  Urgent: 'text-rose-400',
  High: 'text-amber-400',
  Normal: 'text-sky-400',
  Low: 'text-emerald-400',
};

const PRIORITY_DOT: Record<string, string> = {
  Urgent: 'bg-rose-400',
  High: 'bg-amber-400',
  Normal: 'bg-sky-400',
  Low: 'bg-emerald-400',
};

/* ── Media + Caption types ───────────────────────────────── */

interface CaptionItem {
  url: string;
  fileName: string | null;
  captionText: string | null;
  captionStatus?: string | null;
  qaRejectionReason?: string | null;
  /** Content item ID from CaptionQueueContentItem — used for per-item QA */
  contentItemId?: string | null;
  /** Whether this item has already been posted to the platform */
  isPosted?: boolean;
}

interface MediaWithCaption {
  id: string;
  url: string;
  type: string;
  name?: string | null;
  captionText: string | null;
  captionStatus: string | null;
  qaRejectionReason: string | null;
  /** Content item ID from CaptionQueueContentItem — needed for per-item QA actions */
  contentItemId: string | null;
  /** Whether this item has already been posted to the platform */
  isPosted: boolean;
  index: number;
}

/* ── Caption status label helper ─────────────────────────── */

function captionStatusBadge(
  captionStatus: string | null,
  wallPostStatus: WallPostStatus | null,
  hasCaption: boolean,
  /** Per-item captionStatus (takes priority when present) */
  itemCaptionStatus?: string | null,
  /** Whether this specific item has been posted to the platform */
  isPosted?: boolean,
): { label: string; className: string } | null {
  // Posted overrides everything — item is already live
  if (isPosted) {
    return {
      label: 'Posted',
      className: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    };
  }
  // Per-item status takes priority
  if (itemCaptionStatus) {
    switch (itemCaptionStatus) {
      case 'approved':
        return {
          label: 'Approved',
          className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        };
      case 'rejected':
        return {
          label: 'Rejected',
          className: 'bg-red-500/10 text-red-400 border-red-500/20',
        };
      case 'submitted':
        return {
          label: 'Pending QA',
          className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        };
      case 'in_progress':
        return {
          label: 'In Progress',
          className: 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
        };
      case 'not_required':
        return {
          label: 'No Caption',
          className: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
        };
      case 'pending':
        return {
          label: 'Pending',
          className: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
        };
    }
  }
  if (!hasCaption) {
    return {
      label: 'Awaiting Caption',
      className: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    };
  }
  if (wallPostStatus === WALL_POST_STATUS.COMPLETED) {
    return {
      label: 'QA Approved',
      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    };
  }
  if (
    wallPostStatus === WALL_POST_STATUS.REVISION_REQUIRED ||
    captionStatus === 'revision_required'
  ) {
    return {
      label: 'Revision Required',
      className: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
  }
  if (
    wallPostStatus === WALL_POST_STATUS.FOR_QA ||
    captionStatus === 'pending_qa'
  ) {
    return {
      label: 'Pending QA',
      className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    };
  }
  if (captionStatus === 'in_progress' || hasCaption) {
    return {
      label: 'Captioned',
      className: 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
    };
  }
  return null;
}

/* ── MediaCard ───────────────────────────────────────────── */

function MediaCard({
  media,
  wallPostStatus,
  captionStatus,
  compact = false,
  canQA = false,
  onApprove,
  onReject,
  onRevert,
  onMarkPosted,
  isActioning = false,
}: {
  media: MediaWithCaption;
  wallPostStatus: WallPostStatus | null;
  captionStatus: string | null;
  compact?: boolean;
  canQA?: boolean;
  onApprove?: () => void;
  onReject?: (reason: string) => void;
  onRevert?: () => void;
  onMarkPosted?: (posted: boolean) => void;
  isActioning?: boolean;
}) {
  const [showItemReject, setShowItemReject] = useState(false);
  const [itemRejectReason, setItemRejectReason] = useState('');
  const isVideo = media.type?.startsWith('video/');
  const hasCaption = !!media.captionText;
  const badge = captionStatusBadge(captionStatus, wallPostStatus, hasCaption, media.captionStatus, media.isPosted);
  const itemStatus = media.captionStatus;
  const isSubmitted = itemStatus === 'submitted';
  const isApproved = itemStatus === 'approved';
  const isRejected = itemStatus === 'rejected';
  const isPosted = media.isPosted;
  const showPerItemActions = canQA && isSubmitted && !isApproved;

  return (
    <div
      className={`group/card flex flex-col rounded-xl overflow-hidden transition-all duration-200 hover:ring-1 hover:ring-brand-light-pink/20 ${
        isPosted ? 'ring-1 ring-violet-500/40' : isApproved ? 'ring-1 ring-emerald-500/30' : ''
      } ${isRejected ? 'ring-1 ring-red-500/30' : ''}`}
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* ── Media Preview ── */}
      <div
        className={`relative overflow-hidden bg-black/40 ${
          compact ? 'aspect-4/3' : 'aspect-3/2'
        }`}
      >
        {isVideo ? (
          isDriveUrl(media.url) ? (
            <DriveMediaViewer url={media.url} isVideo={true} className="w-full h-full object-cover" />
          ) : (
            <video
              src={media.url}
              className="w-full h-full object-cover"
              preload="metadata"
            />
          )
        ) : isDriveUrl(media.url) ? (
          <DriveMediaViewer url={media.url} isVideo={false} className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-[1.02]" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.url}
            alt={media.name ?? `Media ${media.index + 1}`}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-[1.02]"
          />
        )}

        {/* Index badge */}
        <div className="absolute top-2 left-2 pointer-events-none">
          <span
            className="inline-flex items-center justify-center h-5 min-w-5 rounded-md px-1.5 text-[10px] font-bold text-white/90 backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.55)' }}
          >
            {media.index + 1}
          </span>
        </div>

        {/* Caption presence dot */}
        <div className="absolute top-2 right-2 pointer-events-none">
          <span
            className={`block h-2 w-2 rounded-full border border-black/30 ${
              hasCaption ? 'bg-emerald-400' : 'bg-gray-500'
            }`}
          />
        </div>
      </div>

      {/* ── Caption Text ── */}
      <div className="flex-1 px-3 py-2.5">
        {hasCaption ? (
          <p className="text-[13px] text-gray-200 leading-relaxed whitespace-pre-wrap line-clamp-4">
            {media.captionText}
          </p>
        ) : (
          <p className="text-xs text-gray-600 italic">No caption yet</p>
        )}
      </div>

      {/* ── Status Row ── */}
      <div
        className="flex items-center gap-1.5 flex-wrap px-3 pb-3 pt-1"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        {badge && (
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold border ${badge.className}`}
          >
            {badge.label}
          </span>
        )}
        {media.name && (
          <span className="ml-auto text-[10px] text-gray-600 truncate max-w-30">
            {media.name}
          </span>
        )}
      </div>

      {/* ── Per-item QA rejection reason ── */}
      {isRejected && media.qaRejectionReason && (
        <div className="px-3 pb-3">
          <div
            className="flex items-start gap-1.5 rounded-lg px-2.5 py-2"
            style={{
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.12)',
            }}
          >
            <RotateCcw className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-red-300 leading-relaxed line-clamp-3">
              {media.qaRejectionReason}
            </p>
          </div>
        </div>
      )}

      {/* ── Mark as Posted button — available on approved (or already posted) items ── */}
      {isApproved && onMarkPosted && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => onMarkPosted(!isPosted)}
            disabled={isActioning}
            className={`w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-all active:scale-[0.97] disabled:opacity-50 ${
              isPosted
                ? 'text-violet-300 hover:bg-violet-500/20'
                : 'text-violet-400 hover:bg-violet-500/15'
            }`}
            style={{
              background: isPosted ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.08)',
              border: isPosted ? '1px solid rgba(139,92,246,0.35)' : '1px solid rgba(139,92,246,0.18)',
            }}
          >
            {isActioning ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isPosted ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <ArrowRight className="h-3 w-3" />
            )}
            {isPosted ? 'Posted ✓  (undo)' : 'Mark as Posted'}
          </button>
        </div>
      )}

      {/* ── Revert button for approved/rejected items ── */}
      {canQA && (isApproved || isRejected) && onRevert && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={onRevert}
            disabled={isActioning}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-amber-400 transition-all hover:bg-amber-500/15 active:scale-[0.97] disabled:opacity-50"
            style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.18)',
            }}
          >
            {isActioning ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            Undo {isApproved ? 'Approval' : 'Rejection'}
          </button>
        </div>
      )}

      {/* ── Per-item QA Actions ── */}
      {showPerItemActions && (
        <div className="px-3 pb-3">
          {!showItemReject ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onApprove}
                disabled={isActioning}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                }}
              >
                {isActioning ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                Approve
              </button>
              <button
                type="button"
                onClick={() => setShowItemReject(true)}
                disabled={isActioning}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-red-400 transition-all hover:bg-red-500/20 active:scale-[0.97] disabled:opacity-50"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.15)',
                }}
              >
                <XCircle className="h-3 w-3" />
                Reject
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={itemRejectReason}
                onChange={(e) => setItemRejectReason(e.target.value)}
                placeholder="Rejection reason..."
                rows={2}
                className="w-full rounded-lg border border-red-500/25 bg-white/[0.03] px-2.5 py-2 text-[11px] text-brand-off-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/30 resize-none"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (onReject) {
                      onReject(itemRejectReason.trim());
                      setItemRejectReason('');
                      setShowItemReject(false);
                    }
                  }}
                  disabled={isActioning}
                  className="px-3 py-1 rounded-lg text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isActioning ? 'Sending...' : 'Send'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowItemReject(false); setItemRejectReason(''); }}
                  className="px-3 py-1 rounded-lg text-[10px] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── GlowCard — card with gradient left border ───────────── */

function GlowCard({
  icon: Icon,
  title,
  children,
  defaultOpen = true,
  badge,
  iconColorClass,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  iconColorClass?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const iconClasses =
    iconColorClass ?? 'bg-brand-light-pink/10 text-brand-light-pink';

  return (
    <div className="relative mb-4 rounded-xl overflow-hidden group/glow">
      <div
        className="absolute inset-y-0 left-0 w-[3px] transition-opacity"
        style={{
          background:
            'linear-gradient(180deg, #F774B9 0%, #a855f7 50%, #5DC3F8 100%)',
          opacity: open ? 0.7 : 0.3,
        }}
      />
      <div
        className="ml-[3px] rounded-r-xl transition-colors"
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderLeft: 'none',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center w-full px-5 py-3.5 gap-3 text-left"
        >
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${iconClasses}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-[13px] font-semibold text-brand-off-white tracking-wide flex-1">
            {title}
          </span>
          {badge}
          <ChevronUp
            className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
              open ? '' : 'rotate-180'
            }`}
          />
        </button>
        <div
          className="grid transition-all duration-200"
          style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="px-5 pb-4 pt-0">
              <div
                className="pt-3.5"
                style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
              >
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sidebar helpers ─────────────────────────────────────── */

function SidebarField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 mb-1.5">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SidebarSectionHeader({ label }: { label: string }) {
  return (
    <div className="pt-4 pb-1.5 first:pt-0">
      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-gray-600">
        {label}
      </span>
      <div className="mt-1.5 border-t border-white/[0.06]" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
/*  Main Modal                                                */
/* ══════════════════════════════════════════════════════════ */

export function WallPostTaskDetailModal({
  task,
  columnTitle,
  isOpen,
  onClose,
  onUpdate,
}: Props) {
  const params = useParams<{ tenant: string; slug: string }>();
  const { data: space } = useSpaceBySlug(params.slug);
  const { user } = useUser();
  const spaceId = space?.id;
  const boardId = space?.boards?.[0]?.id;
  const { data: spaceMembers = [] } = useSpaceMembers(spaceId);
  const { profile: gDriveProfile, isSignedIn: isGDriveSignedIn, signIn: gDriveSignIn, signOut: gDriveSignOut, switchAccount: gDriveSwitchAccount } = useGoogleDriveAccount();

  const getMemberName = (id?: string) => {
    if (!id) return undefined;
    const m = spaceMembers.find((mb) => mb.user.clerkId === id || mb.userId === id);
    if (!m) return undefined;
    return m.user.name || `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim() || m.user.email;
  };

  const [activeTab, setActiveTab] = useState<ModalTab>('description');
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [photoFilterTab, setPhotoFilterTab] = useState<'all' | 'pending' | 'submitted' | 'approved' | 'rejected' | 'posted'>('all');
  const [showItemRejectInput, setShowItemRejectInput] = useState(false);
  const [itemRejectReason, setItemRejectReason] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const titleRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  /* ── Metadata ────────────────────────────────────────── */

  const meta = task.metadata ?? {};
  const caption = (meta.caption as string) ?? '';
  const platform = (meta.platform as string) ?? '';
  const hashtags = Array.isArray(meta.hashtags)
    ? (meta.hashtags as string[])
    : [];
  const scheduledDate = (meta.scheduledDate as string) ?? '';
  const model = (meta.model as string) ?? '';
  const mediaCount = (meta.mediaCount as number) ?? 0;
  const wallPostStatus = (meta.wallPostStatus as WallPostStatus) ?? null;
  const captionTicketId = (meta.captionTicketId as string) ?? null;
  const captionText = (meta.captionText as string) ?? null;
  const captionStatus = (meta.captionStatus as string) ?? null;
  const qaRejectionReason = (meta.qaRejectionReason as string) ?? null;

  const [captionDraft, setCaptionDraft] = useState(caption);

  /* ── API hooks ───────────────────────────────────────── */

  const { data: commentsData, isLoading: commentsLoading } =
    useBoardItemComments(spaceId, boardId, task.id, isOpen);
  const addCommentMutation = useAddComment(
    spaceId ?? '',
    boardId ?? '',
    task.id,
  );
  const { data: historyData } = useBoardItemHistory(
    spaceId,
    boardId,
    task.id,
  );
  const { data: mediaData = [], isLoading: mediaLoading } = useBoardItemMedia(
    spaceId,
    boardId,
    task.id,
    isOpen,
  );

  /* ── RBAC + Caption Workspace hooks ────────────────── */

  const { canCreateQueue: canPush, canManageQueue: canQA } = useOrgRole();
  const pushToCaptionMutation = usePushToCaptionWorkspace();
  const qaActionMutation = useQAAction();
  const qaItemActionMutation = useQAItemAction();
  const repushRejectedMutation = useRepushRejected();
  const markItemPostedMutation = useMarkItemPosted();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  /* ── Map raw media → WallPostPhoto ─────────────────── */

  const photos: WallPostPhoto[] = useMemo(
    () =>
      mediaData.map((m) => ({
        id: m.id,
        url: m.url,
        name: m.name ?? undefined,
        type: m.type,
        status: 'pending_review' as const,
      })),
    [mediaData],
  );

  /* ── Drive media check ─────────────────────────────── */
  // (defined below, after mediaWithCaptions)

  /* ── Joined media + captions ─────────────────────────── */

  const captionItems: CaptionItem[] = useMemo(() => {
    const raw = meta.captionItems;
    if (!Array.isArray(raw)) return [];
    return raw as CaptionItem[];
  }, [meta.captionItems]);

  const mediaWithCaptions: MediaWithCaption[] = useMemo(
    () =>
      mediaData.map((m, idx) => {
        const match =
          captionItems.find((ci) => ci.url === m.url) ??
          captionItems.find(
            (ci) =>
              ci.fileName != null &&
              m.name != null &&
              ci.fileName === m.name,
          ) ??
          captionItems[idx] ??
          null;
        return {
          id: m.id,
          url: m.url,
          type: m.type,
          name: m.name,
          captionText: match?.captionText ?? null,
          captionStatus: match?.captionStatus ?? null,
          qaRejectionReason: match?.qaRejectionReason ?? null,
          contentItemId: match?.contentItemId ?? null,
          isPosted: match?.isPosted ?? false,
          index: idx,
        };
      }),
    [mediaData, captionItems],
  );

  const photoFilterCounts = useMemo(() => {
    const counts = { all: mediaWithCaptions.length, pending: 0, submitted: 0, approved: 0, rejected: 0, posted: 0 };
    mediaWithCaptions.forEach((m) => {
      if (m.isPosted) counts.posted++;
      if (m.captionStatus === 'approved') counts.approved++;
      if (m.captionStatus === 'submitted') counts.submitted++;
      if (m.captionStatus === 'rejected') counts.rejected++;
      if (!m.captionStatus || ['pending', 'in_progress', 'not_required'].includes(m.captionStatus)) counts.pending++;
    });
    return counts;
  }, [mediaWithCaptions]);

  /* ── Drive media check ─────────────────────────────── */
  const hasDriveMedia = useMemo(() => mediaWithCaptions.some(m => isDriveUrl(m.url)), [mediaWithCaptions]);

  /* ── Per-photo activity feed hooks ────────────────────── */

  const selectedItem = mediaWithCaptions[selectedItemIndex] ?? mediaWithCaptions[0];
  const selectedContentItemId = selectedItem?.contentItemId;

  // Get all content item IDs for fetching all comments
  const allContentItemIds = useMemo(
    () => mediaWithCaptions.map(m => m.contentItemId).filter((id): id is string => !!id),
    [mediaWithCaptions]
  );

  // Fetch comments for the selected photo (Photos tab)
  const { data: contentItemCommentsData, isLoading: contentItemCommentsLoading } =
    useContentItemComments(selectedContentItemId, isOpen && activeTab === 'photos');

  // Fetch all photo comments (Description tab)
  const { data: allContentItemCommentsData } = useAllContentItemComments(
    allContentItemIds,
    isOpen && activeTab === 'description'
  );

  const addContentItemCommentMutation = useAddContentItemComment(selectedContentItemId || 'placeholder');

  const { data: contentItemHistoryData } = useContentItemHistory(
    selectedContentItemId,
    isOpen && activeTab === 'photos'
  );

  const filteredPhotoItems = useMemo(() => {
    if (photoFilterTab === 'all') return mediaWithCaptions;
    return mediaWithCaptions.filter((m) => {
      if (photoFilterTab === 'posted') return m.isPosted;
      if (photoFilterTab === 'approved') return m.captionStatus === 'approved';
      if (photoFilterTab === 'submitted') return m.captionStatus === 'submitted';
      if (photoFilterTab === 'rejected') return m.captionStatus === 'rejected';
      return !m.captionStatus || ['pending', 'in_progress', 'not_required'].includes(m.captionStatus ?? '');
    });
  }, [mediaWithCaptions, photoFilterTab]);

  const comments: TaskComment[] = useMemo(() => {
    if (!commentsData?.comments) return [];
    const currentUserId = user?.id;
    return commentsData.comments.map((c) => ({
      id: c.id,
      author:
        c.createdBy === currentUserId
          ? (user?.firstName ?? user?.username ?? 'You')
          : c.author,
      content: c.content,
      createdAt: c.createdAt,
    }));
  }, [commentsData, user]);

  const history: TaskHistoryEntry[] = useMemo(() => {
    if (!historyData?.history) return [];
    const currentUserId = user?.id;
    return historyData.history.map((h) => ({
      id: h.id,
      action: h.action,
      field: h.field,
      oldValue: h.oldValue,
      newValue: h.newValue,
      changedBy:
        h.userId === currentUserId
          ? (user?.firstName ?? user?.username ?? 'You')
          : h.userName,
      changedAt: h.createdAt,
    }));
  }, [historyData, user]);

  const handleAddComment = (content: string) => {
    addCommentMutation.mutate(content);
  };

  // Combined comments for Description tab (board-level + all photo comments)
  const allComments: TaskComment[] = useMemo(() => {
    const currentUserId = user?.id;
    const boardComments = comments || [];

    // Process all photo comments with photo info
    const photoComments: TaskComment[] = (allContentItemCommentsData || []).map((c: any) => {
      // Find which photo this comment belongs to
      const photoIndex = mediaWithCaptions.findIndex(m => m.contentItemId === c.contentItemId);
      const photo = mediaWithCaptions[photoIndex];

      return {
        id: c.id,
        author:
          c.createdBy === currentUserId
            ? (user?.firstName ?? user?.username ?? 'You')
            : c.author,
        content: c.content,
        createdAt: c.createdAt,
        // Add photo context
        photoContext: photo ? {
          index: photoIndex + 1,
          name: photo.name || `Photo ${photoIndex + 1}`,
          url: photo.url,
        } : undefined,
      };
    });

    // Combine and sort by date (newest first)
    return [...boardComments, ...photoComments].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [comments, allContentItemCommentsData, user, mediaWithCaptions]);

  const contentItemComments: TaskComment[] = useMemo(() => {
    if (!contentItemCommentsData?.comments) return [];
    const currentUserId = user?.id;
    return contentItemCommentsData.comments.map((c: any) => ({
      id: c.id,
      author:
        c.createdBy === currentUserId
          ? (user?.firstName ?? user?.username ?? 'You')
          : c.author,
      content: c.content,
      createdAt: c.createdAt,
    }));
  }, [contentItemCommentsData, user]);

  const contentItemHistory: TaskHistoryEntry[] = useMemo(() => {
    if (!contentItemHistoryData?.history) return [];
    const currentUserId = user?.id;
    return contentItemHistoryData.history.map((h: any) => ({
      id: h.id,
      action: h.action,
      field: h.field,
      oldValue: h.oldValue,
      newValue: h.newValue,
      changedBy:
        h.userId === currentUserId
          ? (user?.firstName ?? user?.username ?? 'You')
          : h.userName,
      changedAt: h.createdAt,
    }));
  }, [contentItemHistoryData, user]);

  const handleAddContentItemComment = (content: string) => {
    if (!selectedContentItemId) {
      console.warn('Cannot add comment: no contentItemId for this photo');
      return;
    }
    addContentItemCommentMutation.mutate(content);
  };

  const handlePhotoClick = (photoIndex: number) => {
    setActiveTab('photos');
    setSelectedItemIndex(photoIndex);
    setSidebarOpen(false);
  };

  /* ── Push to Caption Workspace ──────────────────────── */

  const handlePushToCaption = () => {
    pushToCaptionMutation.mutate(
      { boardItemId: task.id },
      {
        onSuccess: (data) => {
          toast.success('Pushed to Caption Workspace');
          // Update local task with new status
          onUpdate({
            ...task,
            metadata: {
              ...meta,
              wallPostStatus: data.wallPostStatus,
              captionTicketId: data.item?.id,
              captionStatus: 'pending',
            },
          });
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to push to Caption Workspace');
        },
      },
    );
  };

  /* ── QA Approve / Reject ────────────────────────────── */

  const handleQAApprove = () => {
    if (!captionTicketId) return;
    qaActionMutation.mutate(
      { ticketId: captionTicketId, action: 'approve' },
      {
        onSuccess: (data: any) => {
          toast.success('Caption approved!');
          // Build updated captionItems from the response so per-item badges update
          const updatedCaptionItems = data.item?.contentItems?.map((ci: any) => ({
            contentItemId: ci.id,
            url: ci.url,
            fileName: ci.fileName ?? null,
            captionText: ci.captionText ?? null,
            captionStatus: ci.captionStatus ?? 'approved',
            qaRejectionReason: ci.qaRejectionReason ?? null,
          })) ?? meta.captionItems;
          onUpdate({
            ...task,
            metadata: {
              ...meta,
              wallPostStatus: data.wallPostStatus,
              captionStatus: 'completed',
              captionItems: updatedCaptionItems,
            },
          });
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to approve');
        },
      },
    );
  };

  const handleQAReject = () => {
    if (!captionTicketId) return;
    qaActionMutation.mutate(
      { ticketId: captionTicketId, action: 'reject', reason: rejectReason.trim() },
      {
        onSuccess: (data: any) => {
          toast.info('Items rejected — use "Re-push" to send back to caption workspace');
          setRejectReason('');
          setShowRejectInput(false);
          // Build updated captionItems from the response so per-item badges update
          const updatedCaptionItems = data.item?.contentItems?.map((ci: any) => ({
            contentItemId: ci.id,
            url: ci.url,
            fileName: ci.fileName ?? null,
            captionText: ci.captionText ?? null,
            captionStatus: ci.captionStatus ?? 'rejected',
            qaRejectionReason: ci.qaRejectionReason ?? null,
          })) ?? meta.captionItems;
          onUpdate({
            ...task,
            metadata: {
              ...meta,
              wallPostStatus: data.wallPostStatus,
              captionStatus: data.wallPostStatus === 'PARTIALLY_APPROVED' ? 'partially_approved' : 'pending',
              qaRejectionReason: data.reason,
              captionItems: updatedCaptionItems,
            },
          });
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to reject');
        },
      },
    );
  };

  /* ── Per-item QA Approve / Reject ───────────────────── */

  /** Apply an optimistic captionStatus change and derive new ticket/wall-post status */
  const applyOptimisticItemStatus = (
    mediaItem: MediaWithCaption,
    newStatus: string,
    extraFields?: Partial<CaptionItem>,
  ) => {
    const updatedCaptionItems = captionItems.map((ci) => {
      const isMatch =
        (mediaItem.contentItemId && ci.contentItemId === mediaItem.contentItemId) ||
        ci.url === mediaItem.url;
      return isMatch ? { ...ci, captionStatus: newStatus, ...extraFields } : ci;
    });
    const allStatuses = updatedCaptionItems.map((ci) => ci.captionStatus || 'pending');
    const newTicketStatus = deriveTicketStatus(allStatuses);
    const newWallPostStatus = captionStatusToWallPostStatus(newTicketStatus) || meta.wallPostStatus;
    onUpdate({
      ...task,
      metadata: {
        ...meta,
        captionItems: updatedCaptionItems,
        captionStatus: newTicketStatus,
        wallPostStatus: newWallPostStatus,
      },
    });
    return { prevCaptionItems: captionItems, prevMeta: { ...meta } };
  };

  /** Rollback to previous metadata on API failure */
  const rollbackOptimistic = (prev: { prevCaptionItems: CaptionItem[]; prevMeta: Record<string, unknown> }) => {
    onUpdate({
      ...task,
      metadata: {
        ...prev.prevMeta,
        captionItems: prev.prevCaptionItems,
      },
    });
  };

  const handleItemApprove = (mediaItem: MediaWithCaption) => {
    if (!captionTicketId || !mediaItem.contentItemId) return;
    // Optimistic: instantly show as approved
    const prev = applyOptimisticItemStatus(mediaItem, 'approved', {
      qaRejectionReason: null,
    });
    toast.success(`Item ${mediaItem.index + 1} approved`);
    qaItemActionMutation.mutate(
      {
        ticketId: captionTicketId,
        items: [{ contentItemId: mediaItem.contentItemId, action: 'approve' as const }],
      },
      {
        onSuccess: (data) => {
          // Reconcile with server truth
          if (data.captionItems) {
            onUpdate({
              ...task,
              metadata: {
                ...meta,
                wallPostStatus: data.wallPostStatus,
                captionStatus: data.ticketStatus,
                captionItems: data.captionItems,
              },
            });
          }
        },
        onError: (error) => {
          rollbackOptimistic(prev);
          toast.error(error.message || 'Failed to approve item');
        },
      },
    );
  };

  const handleItemReject = (mediaItem: MediaWithCaption, reason: string) => {
    if (!captionTicketId || !mediaItem.contentItemId) return;
    // Optimistic: instantly show as rejected
    const prev = applyOptimisticItemStatus(mediaItem, 'rejected', {
      qaRejectionReason: reason,
    });
    toast.info(`Item ${mediaItem.index + 1} rejected`);
    qaItemActionMutation.mutate(
      {
        ticketId: captionTicketId,
        items: [{ contentItemId: mediaItem.contentItemId, action: 'reject' as const, reason }],
      },
      {
        onSuccess: (data) => {
          if (data.captionItems) {
            onUpdate({
              ...task,
              metadata: {
                ...meta,
                wallPostStatus: data.wallPostStatus,
                captionStatus: data.ticketStatus,
                captionItems: data.captionItems,
              },
            });
          }
        },
        onError: (error) => {
          rollbackOptimistic(prev);
          toast.error(error.message || 'Failed to reject item');
        },
      },
    );
  };

  /* ── Per-item Revert (undo approve / reject → submitted) ── */

  const handleItemRevert = (mediaItem: MediaWithCaption) => {
    if (!captionTicketId || !mediaItem.contentItemId) return;
    // Optimistic: instantly show as submitted (pending QA)
    const prev = applyOptimisticItemStatus(mediaItem, 'submitted', {
      qaRejectionReason: null,
    });
    toast.success(`Item ${mediaItem.index + 1} reverted to Pending QA`);
    qaItemActionMutation.mutate(
      {
        ticketId: captionTicketId,
        items: [{ contentItemId: mediaItem.contentItemId, action: 'revert' as const }],
      },
      {
        onSuccess: (data) => {
          if (data.captionItems) {
            onUpdate({
              ...task,
              metadata: {
                ...meta,
                wallPostStatus: data.wallPostStatus,
                captionStatus: data.ticketStatus,
                captionItems: data.captionItems,
              },
            });
          }
        },
        onError: (error) => {
          rollbackOptimistic(prev);
          toast.error(error.message || 'Failed to revert item');
        },
      },
    );
  };

  /* ── Mark item as Posted ─────────────────────────── */

  const handleMarkPosted = (mediaItem: MediaWithCaption, posted: boolean) => {
    // Optimistic local update so the UI responds immediately
    const updatedCaptionItems = captionItems.map((ci) => {
      const isMatch =
        (mediaItem.contentItemId && ci.contentItemId === mediaItem.contentItemId) ||
        ci.url === mediaItem.url;
      return isMatch ? { ...ci, isPosted: posted } : ci;
    });
    onUpdate({ ...task, metadata: { ...meta, captionItems: updatedCaptionItems } });

    if (!mediaItem.contentItemId) {
      // No DB record to update — local-only (edge case before ticket was created)
      toast.success(posted ? `Item ${mediaItem.index + 1} marked as Posted` : `Item ${mediaItem.index + 1} unmarked`);
      return;
    }

    markItemPostedMutation.mutate(
      { itemId: mediaItem.contentItemId, isPosted: posted },
      {
        onSuccess: () => {
          toast.success(
            posted
              ? `Item ${mediaItem.index + 1} marked as Posted`
              : `Item ${mediaItem.index + 1} unmarked`,
          );
        },
        onError: (error) => {
          // Revert the optimistic update on failure
          onUpdate({ ...task, metadata: { ...meta, captionItems } });
          toast.error(error.message || 'Failed to update posted status');
        },
      },
    );
  };

  /* ── Re-push rejected items to caption workspace ──── */

  const handleRepushRejected = () => {
    if (!captionTicketId) return;
    repushRejectedMutation.mutate(captionTicketId, {
      onSuccess: (data) => {
        toast.success(`${data.repushedCount} rejected item(s) re-pushed to caption workspace`);
        onUpdate({
          ...task,
          metadata: {
            ...meta,
            wallPostStatus: data.wallPostStatus,
            captionStatus: data.ticketStatus,
            captionItems: data.captionItems,
          },
        });
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to re-push rejected items');
      },
    });
  };

  /* ── Effects ─────────────────────────────────────────── */

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setTitleDraft(task.title);
    setCaptionDraft(caption);
  }, [task, caption]);
  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);
  useEffect(() => {
    if (editingCaption) captionRef.current?.focus();
  }, [editingCaption]);
  if (!mounted || !isOpen) return null;

  /* ── Helpers ─────────────────────────────────────────── */

  const updateMeta = (partial: Record<string, unknown>) =>
    onUpdate({ ...task, metadata: { ...meta, ...partial } });

  const saveTitle = () => {
    setEditingTitle(false);
    if (titleDraft.trim() && titleDraft !== task.title)
      onUpdate({ ...task, title: titleDraft.trim() });
    else setTitleDraft(task.title);
  };

  const saveCaption = () => {
    setEditingCaption(false);
    if (captionDraft !== caption) updateMeta({ caption: captionDraft });
  };

  const switchTab = (tab: ModalTab) => {
    setActiveTab(tab);
    setSidebarOpen(tab === 'description');
    if (tab === 'photos') { setSelectedItemIndex(0); setShowItemRejectInput(false); setItemRejectReason(''); }
  };

  const TABS: { id: ModalTab; label: string; icon: LucideIcon }[] = [
    { id: 'description', label: 'Description', icon: FileText },
    { id: 'photos', label: 'Photos', icon: ImageIcon },
  ];

  /* ── Render ──────────────────────────────────────────── */

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-start justify-center overflow-y-auto py-6 px-3"
      onClick={onClose}
      style={{
        background:
          'radial-gradient(ellipse at 30% 20%, rgba(93,195,248,0.05) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(247,116,185,0.05) 0%, transparent 50%), rgba(0,0,0,0.7)',
      }}
    >
      <div
        className="relative w-full max-w-[1120px] rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          background:
            'linear-gradient(160deg, rgba(18,14,30,0.98) 0%, rgba(14,11,24,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Top glow line */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent 10%, rgba(247,116,185,0.25) 35%, rgba(168,85,247,0.2) 50%, rgba(93,195,248,0.25) 65%, transparent 90%)',
          }}
        />

        {/* ═══ Header ════════════════════════════════════ */}
        <div className="relative px-6 sm:px-8 pt-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Badge row */}
              <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">
                  Wall Post
                </span>
                <span
                  className="inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide text-brand-blue"
                  style={{
                    background: 'rgba(93,195,248,0.08)',
                    border: '1px solid rgba(93,195,248,0.12)',
                  }}
                >
                  {task.taskKey}
                </span>
                <span
                  className="inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-medium text-gray-400"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {columnTitle}
                </span>
                {platform && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold capitalize text-brand-light-pink"
                    style={{
                      background: 'rgba(247,116,185,0.08)',
                      border: '1px solid rgba(247,116,185,0.12)',
                    }}
                  >
                    <AtSign className="h-3 w-3" />
                    {platform}
                  </span>
                )}
                {/* Wall Post Status Badge */}
                {wallPostStatus && WALL_POST_STATUS_CONFIG[wallPostStatus] && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold border ${WALL_POST_STATUS_CONFIG[wallPostStatus].bgColor} ${WALL_POST_STATUS_CONFIG[wallPostStatus].color}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${WALL_POST_STATUS_CONFIG[wallPostStatus].dotColor}`} />
                    {WALL_POST_STATUS_CONFIG[wallPostStatus].label}
                  </span>
                )}
              </div>

              {/* Editable Title */}
              <div className="group/title">
                {editingTitle ? (
                  <input
                    ref={titleRef}
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveTitle();
                      if (e.key === 'Escape') {
                        setTitleDraft(task.title);
                        setEditingTitle(false);
                      }
                    }}
                    className="w-full text-xl sm:text-[22px] font-bold text-brand-off-white bg-transparent border-b-2 border-brand-light-pink/40 focus-visible:outline-none focus-visible:border-brand-light-pink/70 pb-1 transition-colors"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingTitle(true)}
                    className="flex items-center gap-2.5 w-full text-left"
                  >
                    <h2 className="text-xl sm:text-[22px] font-bold text-brand-off-white leading-tight">
                      {task.title}
                    </h2>
                    <Pencil className="h-3.5 w-3.5 text-gray-600 opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />
                  </button>
                )}
              </div>

              {/* Quick-info bar */}
              {(model || scheduledDate) && (
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 flex-wrap">
                  {model && (
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-3 w-3 text-gray-500" />
                      {model}
                    </span>
                  )}
                  {model && scheduledDate && (
                    <span className="text-gray-700">|</span>
                  )}
                  {scheduledDate && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3 text-gray-500" />
                      {new Date(scheduledDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0 pt-1">
              {/* Push to Caption Workspace — shown when PENDING_CAPTION and user can create queue */}
              {canPush && (!wallPostStatus || wallPostStatus === WALL_POST_STATUS.PENDING_CAPTION) && photos.length > 0 && (
                <button
                  type="button"
                  onClick={handlePushToCaption}
                  disabled={pushToCaptionMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #5DC3F8 0%, #4BA8D8 100%)',
                    boxShadow: '0 2px 12px rgba(93,195,248,0.25)',
                  }}
                >
                  {pushToCaptionMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ArrowRight className="h-3 w-3" />
                  )}
                  Push to Caption
                </button>
              )}

              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97]"
                style={{
                  background: 'linear-gradient(135deg, #E1518E 0%, #EC67A1 100%)',
                  boxShadow: '0 2px 12px rgba(225,81,142,0.25)',
                }}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:text-white transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ═══ Tab Bar ═══════════════════════════════════ */}
        <div
          className="px-6 sm:px-8"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => switchTab(t.id)}
                className={[
                  'relative flex items-center gap-1.5 px-4 py-3 text-[13px] font-medium transition-colors',
                  activeTab === t.id
                    ? 'text-brand-off-white'
                    : 'text-gray-500 hover:text-gray-300',
                ].join(' ')}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.id === 'photos' && photos.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-brand-light-pink/15 text-brand-light-pink text-[9px] font-bold px-1">
                    {photos.length}
                  </span>
                )}
                {activeTab === t.id && (
                  <span
                    className="absolute inset-x-2 bottom-0 h-[2px] rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #E1518E, #F774B9)',
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ Body: Tabs + Sidebar ═════════════════════ */}
        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto]">
          {/* ── Left: Tab Content ──────────────────────── */}
          <div
            className="relative px-6 sm:px-8 py-6 min-h-[50vh] max-h-[62vh] overflow-y-auto custom-scrollbar"
            style={{ borderRight: '1px solid rgba(255,255,255,0.04)', willChange: 'scroll-position', contain: 'paint' }}
          >
            {/* Sidebar toggle */}
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="absolute top-3 right-3 z-10 h-7 w-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-colors"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {sidebarOpen ? (
                <PanelRightClose className="h-3.5 w-3.5" />
              ) : (
                <PanelRightOpen className="h-3.5 w-3.5" />
              )}
            </button>

            {/* ── Description Tab ────────────────────────── */}
            {activeTab === 'description' && (
              <>
                {/* QA Reject reason input — shown when reject button clicked */}
                {showRejectInput && (
                  <div className="mb-4 rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-red-400 block mb-2">
                      Rejection Reason
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Explain why the caption needs revision..."
                      rows={3}
                      className="w-full rounded-lg border border-red-500/25 bg-white/[0.03] px-3.5 py-2.5 text-sm text-brand-off-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 resize-none transition-shadow"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={handleQAReject}
                        disabled={qaActionMutation.isPending}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {qaActionMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowRejectInput(false); setRejectReason(''); }}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* QA Rejection banner — shown when status is REVISION_REQUIRED */}
                {wallPostStatus === WALL_POST_STATUS.REVISION_REQUIRED && qaRejectionReason && (
                  <div className="mb-4 rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <RotateCcw className="h-3.5 w-3.5 text-red-400" />
                      <span className="text-[11px] font-semibold text-red-400">Revision Required</span>
                    </div>
                    <p className="text-sm text-gray-300">{qaRejectionReason}</p>
                  </div>
                )}

                {/* Description / Caption */}
                <GlowCard
                  icon={FileText}
                  title="Description"
                  iconColorClass="bg-brand-light-pink/10 text-brand-light-pink"
                >
                  <div className="group/cap">
                    {editingCaption ? (
                      <div>
                        <textarea
                          ref={captionRef}
                          value={captionDraft}
                          onChange={(e) => setCaptionDraft(e.target.value)}
                          rows={6}
                          placeholder="Write your post caption..."
                          className="w-full rounded-lg border border-brand-light-pink/25 bg-white/[0.03] px-3.5 py-2.5 text-sm text-brand-off-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink/30 resize-none transition-shadow"
                        />
                        <div className="flex items-center gap-2 mt-2.5">
                          <button
                            type="button"
                            onClick={saveCaption}
                            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:brightness-110"
                            style={{
                              background:
                                'linear-gradient(135deg, #E1518E, #EC67A1)',
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCaptionDraft(caption);
                              setEditingCaption(false);
                            }}
                            className="px-4 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingCaption(true)}
                        className="flex items-start gap-2 w-full text-left"
                      >
                        <p className="text-sm text-gray-300 whitespace-pre-wrap flex-1 leading-relaxed">
                          {caption || (
                            <span className="text-gray-600 italic">
                              Click to write a caption...
                            </span>
                          )}
                        </p>
                        <Pencil className="h-3.5 w-3.5 text-gray-600 opacity-0 group-hover/cap:opacity-100 transition-opacity shrink-0 mt-0.5" />
                      </button>
                    )}
                  </div>

                  {/* Hashtags inline */}
                  {hashtags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      {hashtags.map((h) => (
                        <span
                          key={h}
                          className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium border bg-brand-blue/10 text-brand-blue border-brand-blue/15"
                        >
                          #{h}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Notes / internal description */}
                  {task.description && (
                    <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 block mb-1.5">
                        Internal Notes
                      </span>
                      <EditableField
                        value={task.description ?? ''}
                        placeholder="Internal notes..."
                        onSave={(v) =>
                          onUpdate({ ...task, description: v || undefined })
                        }
                      />
                    </div>
                  )}
                </GlowCard>

                {/* Activity Feed - Shows all comments (board + all photos) */}
                <div className="mt-2">
                  <ActivityFeed
                    comments={allComments}
                    history={history}
                    onAddComment={handleAddComment}
                    currentUserName={
                      user?.firstName ?? user?.username ?? 'User'
                    }
                    currentUserClerkId={user?.id}
                    members={spaceMembers}
                    isLoading={commentsLoading}
                    onPhotoClick={handlePhotoClick}
                  />
                </div>
              </>
            )}

            {/* ── Photos Tab ─────────────────────────────── */}
            {activeTab === 'photos' && (
              mediaLoading ? (
                /* Loading skeleton */
                <div className="flex gap-0 h-[520px] animate-pulse rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex-1" style={{ background: 'rgba(255,255,255,0.015)' }} />
                  <div className="w-[268px] shrink-0 p-2.5 space-y-1" style={{ borderLeft: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}>
                    <div className="flex gap-1.5 mb-3">
                      {[40, 54, 36, 48].map((w, i) => (
                        <div key={i} className="h-5 rounded-md bg-white/[0.04]" style={{ width: w }} />
                      ))}
                    </div>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
                        <div className="h-9 w-9 rounded-lg shrink-0 bg-white/[0.04]" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-2 rounded bg-white/[0.04] w-3/5" />
                          <div className="h-1.5 rounded bg-white/[0.03] w-2/5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : mediaWithCaptions.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div
                    className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: 'rgba(247,116,185,0.08)', border: '1px solid rgba(247,116,185,0.15)' }}
                  >
                    <ImageIcon className="h-7 w-7 text-brand-light-pink/60" />
                  </div>
                  <p className="text-sm font-medium text-gray-400 mb-1">No media uploaded yet</p>
                  <p className="text-xs text-gray-600">
                    Upload files via the Content Submission form and they will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Google Drive account bar — shown when any media is hosted on Drive */}
                  {hasDriveMedia && (
                    <WallPostGoogleBar
                      profile={gDriveProfile}
                      isSignedIn={isGDriveSignedIn}
                      onSignIn={gDriveSignIn}
                      onSignOut={gDriveSignOut}
                      onSwitch={gDriveSwitchAccount}
                    />
                  )}
                  {/* Bulk QA actions bar */}
                  {canQA && (wallPostStatus === WALL_POST_STATUS.FOR_QA || wallPostStatus === WALL_POST_STATUS.PARTIALLY_APPROVED) && (
                    <div className="rounded-xl px-4 py-3 flex flex-col gap-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-semibold text-gray-400">
                          {wallPostStatus === WALL_POST_STATUS.PARTIALLY_APPROVED ? 'Partially approved — some items need revision' : 'Awaiting QA review'}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button type="button" onClick={handleQAApprove} disabled={qaActionMutation.isPending}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                            {qaActionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                            Approve All
                          </button>
                          <button type="button" onClick={() => setShowRejectInput((v) => !v)} disabled={qaActionMutation.isPending}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-red-400 transition-all hover:bg-red-500/20 active:scale-[0.97] disabled:opacity-50"
                            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                            <RotateCcw className="h-3 w-3" />
                            Reject All
                          </button>
                        </div>
                      </div>
                      {showRejectInput && (
                        <div className="space-y-2">
                          <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Explain why the captions need revision..." rows={2}
                            className="w-full rounded-lg border border-red-500/25 bg-white/[0.03] px-3 py-2 text-[11px] text-brand-off-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/30 resize-none" />
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={handleQAReject} disabled={qaActionMutation.isPending}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
                              {qaActionMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                            </button>
                            <button type="button" onClick={() => { setShowRejectInput(false); setRejectReason(''); }}
                              className="px-3 py-1.5 rounded-lg text-[11px] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Re-push rejected items banner */}
                  {canQA && wallPostStatus === WALL_POST_STATUS.PARTIALLY_APPROVED && (() => {
                    const rejCount = mediaWithCaptions.filter((m) => m.captionStatus === 'rejected').length;
                    if (rejCount === 0) return null;
                    return (
                      <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                        style={{ background: 'rgba(93,195,248,0.06)', border: '1px solid rgba(93,195,248,0.18)' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <RotateCcw className="h-3.5 w-3.5 text-brand-blue shrink-0" />
                          <span className="text-[11px] font-semibold text-brand-blue truncate">
                            {rejCount} rejected item{rejCount > 1 ? 's' : ''} ready to re-push
                          </span>
                        </div>
                        <button type="button" onClick={handleRepushRejected} disabled={repushRejectedMutation.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[11px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                          style={{ background: 'linear-gradient(135deg, #5DC3F8 0%, #4BA8D8 100%)', boxShadow: '0 2px 12px rgba(93,195,248,0.25)' }}>
                          {repushRejectedMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                          Re-push to Caption Workspace
                        </button>
                      </div>
                    );
                  })()}

                  {/* Completed banner */}
                  {wallPostStatus === WALL_POST_STATUS.COMPLETED && (
                    <div className="flex items-center gap-2 rounded-xl px-4 py-3"
                      style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                      <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span className="text-[12px] font-semibold text-emerald-400">All captions QA Approved</span>
                    </div>
                  )}

                  {/* ── Split viewer: large preview + compact list ── */}
                  {(() => {
                    const selectedItem = mediaWithCaptions[selectedItemIndex] ?? mediaWithCaptions[0];
                    if (!selectedItem) return null;
                    const svIsVideo = selectedItem.type?.startsWith('video/');
                    const svHasCaption = !!selectedItem.captionText;
                    const svItemStatus = selectedItem.captionStatus;
                    const svIsApproved = svItemStatus === 'approved';
                    const svIsRejected = svItemStatus === 'rejected';
                    const svIsSubmitted = svItemStatus === 'submitted';
                    const svIsPosted = selectedItem.isPosted;
                    const svShowQA = canQA && svIsSubmitted && !svIsApproved;
                    const svBadge = captionStatusBadge(captionStatus, wallPostStatus, svHasCaption, svItemStatus, svIsPosted);
                    return (
                      <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)', minHeight: 460 }}>
                        {/* Left panel — large preview + detail */}
                        <div className="flex flex-col flex-1 min-w-0" style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                          {/* Media preview */}
                          <div className="relative bg-black/50 flex items-center justify-center overflow-hidden" style={{ minHeight: 200, maxHeight: 340 }}>
                            {svIsVideo ? (
                              isDriveUrl(selectedItem.url) ? (
                                <DriveMediaViewer
                                  key={`${selectedItem.url}|${gDriveProfile?.email}`}
                                  url={selectedItem.url}
                                  isVideo={true}
                                  isSignedIn={isGDriveSignedIn}
                                  onSignIn={gDriveSignIn}
                                  className="max-w-full max-h-[340px] w-auto h-auto object-contain"
                                />
                              ) : (
                                <video src={selectedItem.url} className="max-w-full max-h-[340px] w-auto h-auto object-contain" controls preload="metadata" />
                              )
                            ) : isDriveUrl(selectedItem.url) ? (
                              <DriveMediaViewer
                                key={`${selectedItem.url}|${gDriveProfile?.email}`}
                                url={selectedItem.url}
                                isVideo={false}
                                isSignedIn={isGDriveSignedIn}
                                onSignIn={gDriveSignIn}
                                className="max-w-full max-h-[340px] w-auto h-auto object-contain"
                              />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={selectedItem.url} alt={selectedItem.name ?? `Photo ${selectedItem.index + 1}`}
                                loading="lazy" decoding="async" className="max-w-full max-h-[340px] w-auto h-auto object-contain" />
                            )}
                            {selectedItemIndex > 0 && (
                              <button type="button" onClick={() => setSelectedItemIndex((i) => i - 1)}
                                className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-full backdrop-blur-sm transition-all hover:scale-110 active:scale-95"
                                style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)' }}>
                                <ChevronLeft className="h-4 w-4 text-white/80" />
                              </button>
                            )}
                            {selectedItemIndex < mediaWithCaptions.length - 1 && (
                              <button type="button" onClick={() => setSelectedItemIndex((i) => i + 1)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-full backdrop-blur-sm transition-all hover:scale-110 active:scale-95"
                                style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)' }}>
                                <ChevronRight className="h-4 w-4 text-white/80" />
                              </button>
                            )}
                            <div className="absolute top-3 left-3 pointer-events-none">
                              <span className="inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-bold text-white/90 backdrop-blur-sm"
                                style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                {selectedItem.index + 1} / {mediaWithCaptions.length}
                              </span>
                            </div>
                            <a href={selectedItem.url} target="_blank" rel="noopener noreferrer"
                              className="absolute top-3 right-3 flex items-center justify-center h-7 w-7 rounded-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/[0.12]"
                              style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                              onClick={(e) => e.stopPropagation()}>
                              <ExternalLink className="h-3.5 w-3.5 text-white/60" />
                            </a>
                          </div>
                          {/* Detail panel */}
                          <div className="px-4 py-3 space-y-2.5 overflow-y-auto custom-scrollbar" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)', maxHeight: 320 }}>
                            <div className="flex items-center gap-2 flex-wrap">
                              {svBadge && (
                                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold border ${svBadge.className}`}>
                                  {svBadge.label}
                                </span>
                              )}
                              {selectedItem.name && (
                                <span className="text-[10px] text-gray-500 truncate max-w-[260px]">{selectedItem.name}</span>
                              )}
                            </div>
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-600 block mb-1">Caption</span>
                              {svHasCaption ? (
                                <p className="text-[12px] text-gray-200 leading-relaxed whitespace-pre-wrap">{selectedItem.captionText}</p>
                              ) : (
                                <p className="text-[11px] text-gray-600 italic">No caption yet</p>
                              )}
                            </div>
                            {svIsRejected && selectedItem.qaRejectionReason && (
                              <div className="flex items-start gap-1.5 rounded-lg px-2.5 py-2"
                                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                                <RotateCcw className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-red-300 leading-relaxed">{selectedItem.qaRejectionReason}</p>
                              </div>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                              {svShowQA && !showItemRejectInput && (
                                <button type="button" onClick={() => handleItemApprove(selectedItem)}
                                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97]"
                                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                                  <CheckCircle2 className="h-3 w-3" />
                                  Approve
                                </button>
                              )}
                              {svShowQA && !showItemRejectInput && (
                                <button type="button" onClick={() => setShowItemRejectInput(true)}
                                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold text-red-400 transition-all hover:bg-red-500/20 active:scale-[0.97]"
                                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                  <XCircle className="h-3 w-3" />
                                  Reject
                                </button>
                              )}
                              {svIsApproved && (
                                <button type="button" onClick={() => handleMarkPosted(selectedItem, !svIsPosted)}
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-all active:scale-[0.97] ${svIsPosted ? 'text-violet-300 hover:bg-violet-500/20' : 'text-violet-400 hover:bg-violet-500/15'}`}
                                  style={{ background: svIsPosted ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.08)', border: svIsPosted ? '1px solid rgba(139,92,246,0.35)' : '1px solid rgba(139,92,246,0.18)' }}>
                                  {svIsPosted ? <CheckCircle2 className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                                  {svIsPosted ? 'Posted ✓ (undo)' : 'Mark as Posted'}
                                </button>
                              )}
                              {canQA && (svIsApproved || svIsRejected) && !svIsPosted && (
                                <button type="button" onClick={() => handleItemRevert(selectedItem)}
                                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold text-amber-400 transition-all hover:bg-amber-500/15 active:scale-[0.97]"
                                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }}>
                                  <RotateCcw className="h-3 w-3" />
                                  Undo {svIsApproved ? 'Approval' : 'Rejection'}
                                </button>
                              )}
                            </div>
                            {showItemRejectInput && (
                              <div className="space-y-2">
                                <textarea value={itemRejectReason} onChange={(e) => setItemRejectReason(e.target.value)}
                                  placeholder="Rejection reason..." rows={2}
                                  className="w-full rounded-lg border border-red-500/25 bg-white/[0.03] px-2.5 py-2 text-[11px] text-brand-off-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/30 resize-none" />
                                <div className="flex items-center gap-1.5">
                                  <button type="button"
                                    onClick={() => { handleItemReject(selectedItem, itemRejectReason.trim()); setItemRejectReason(''); setShowItemRejectInput(false); }}
                                    className="px-3 py-1 rounded-lg text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">
                                    Send
                                  </button>
                                  <button type="button" onClick={() => { setShowItemRejectInput(false); setItemRejectReason(''); }}
                                    className="px-3 py-1 rounded-lg text-[10px] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-colors">
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right panel — filter tabs + compact scrollable list */}
                        <div className="w-[268px] flex flex-col shrink-0">
                          <div className="px-2.5 pt-2.5 pb-2 flex gap-1 flex-wrap"
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)' }}>
                            {[
                              { key: 'all' as const, label: 'All', count: photoFilterCounts.all },
                              { key: 'pending' as const, label: 'Pending', count: photoFilterCounts.pending },
                              { key: 'submitted' as const, label: 'QA', count: photoFilterCounts.submitted },
                              { key: 'approved' as const, label: 'Ready', count: photoFilterCounts.approved },
                              { key: 'posted' as const, label: 'Posted', count: photoFilterCounts.posted },
                              { key: 'rejected' as const, label: 'Rejected', count: photoFilterCounts.rejected },
                            ].filter((t) => t.key === 'all' || t.count > 0).map((t) => (
                              <button key={t.key} type="button" onClick={() => setPhotoFilterTab(t.key)}
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all ${photoFilterTab === t.key ? 'text-brand-off-white' : 'text-gray-500 hover:text-gray-300'}`}
                                style={photoFilterTab === t.key
                                  ? { background: 'rgba(247,116,185,0.15)', border: '1px solid rgba(247,116,185,0.28)' }
                                  : { background: 'transparent', border: '1px solid transparent' }}>
                                {t.label}
                                <span className={`rounded px-1 text-[9px] font-bold ${photoFilterTab === t.key ? 'text-brand-light-pink' : 'text-gray-600'}`}>
                                  {t.count}
                                </span>
                              </button>
                            ))}
                          </div>
                          <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: 420 }}>
                            {filteredPhotoItems.length === 0 ? (
                              <div className="flex items-center justify-center py-8">
                                <p className="text-[11px] text-gray-600 italic">No items</p>
                              </div>
                            ) : filteredPhotoItems.map((m) => {
                              const isSelected = selectedItemIndex === m.index;
                              const mIsVideo = m.type?.startsWith('video/');
                              const dotColor = m.isPosted ? 'bg-violet-400'
                                : m.captionStatus === 'approved' ? 'bg-emerald-400'
                                : m.captionStatus === 'submitted' ? 'bg-amber-400'
                                : m.captionStatus === 'rejected' ? 'bg-red-400' : 'bg-gray-600';
                              const mBadge = captionStatusBadge(captionStatus, wallPostStatus, !!m.captionText, m.captionStatus, m.isPosted);
                              return (
                                <button key={m.id} type="button" onClick={() => { setSelectedItemIndex(m.index); setShowItemRejectInput(false); setItemRejectReason(''); }}
                                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors ${isSelected ? '' : 'hover:bg-white/[0.03]'}`}
                                  style={isSelected
                                    ? { background: 'rgba(247,116,185,0.07)', borderLeft: '2px solid rgba(247,116,185,0.5)' }
                                    : { borderLeft: '2px solid transparent' }}>
                                  <div className="relative h-9 w-9 rounded-lg overflow-hidden shrink-0"
                                    style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    {mIsVideo ? (
                                      <div className="h-full w-full flex items-center justify-center">
                                        <span className="text-[7px] text-gray-400 font-bold tracking-wider">VID</span>
                                      </div>
                                    ) : isDriveUrl(m.url) ? (
                                      <DriveThumbnailSmall url={m.url} alt={`${m.index + 1}`} />
                                    ) : (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={m.url} alt={`${m.index + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                    )}
                                    <span className={`absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full border border-black/30 ${dotColor}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="block text-[11px] font-medium text-gray-300 truncate leading-tight">
                                      {m.name ? m.name : `Photo ${m.index + 1}`}
                                    </span>
                                    {mBadge && (
                                      <span className={`inline-flex items-center rounded px-1.5 py-px text-[9px] font-semibold border mt-0.5 ${mBadge.className}`}>
                                        {mBadge.label}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Activity Feed - Per Photo or Board Level */}
                  <div className="mt-2">
                    {selectedContentItemId ? (
                      <ActivityFeed
                        comments={contentItemComments}
                        history={contentItemHistory}
                        onAddComment={handleAddContentItemComment}
                        currentUserName={user?.firstName ?? user?.username ?? 'User'}
                        currentUserClerkId={user?.id}
                        members={spaceMembers}
                        isLoading={contentItemCommentsLoading}
                      />
                    ) : (
                      <div className="rounded-lg px-4 py-3 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-[11px] text-gray-500 italic">
                          Per-photo comments will be available after pushing to caption workspace
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>

          {/* ═══ Right Sidebar (collapsible) ═══════════════ */}
          <div
            className="max-h-[62vh] overflow-hidden transition-[width] duration-200 ease-in-out"
            style={{ width: sidebarOpen ? 260 : 0 }}
          >
            <div
              className="px-5 py-5 h-full overflow-y-auto custom-scrollbar space-y-0"
              style={{ width: 260, willChange: 'scroll-position', contain: 'paint' }}
            >
            {/* ── Status & Platform ── */}
            <SidebarSectionHeader label="Status & Platform" />

            <SidebarField label="Status">
              <span
                className="inline-flex items-center rounded-md text-brand-off-white px-2.5 py-1 text-xs font-medium"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {columnTitle}
              </span>
            </SidebarField>

            {wallPostStatus && WALL_POST_STATUS_CONFIG[wallPostStatus] && (
              <SidebarField label="Caption Status">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold border ${WALL_POST_STATUS_CONFIG[wallPostStatus].bgColor} ${WALL_POST_STATUS_CONFIG[wallPostStatus].color}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${WALL_POST_STATUS_CONFIG[wallPostStatus].dotColor}`} />
                    {WALL_POST_STATUS_CONFIG[wallPostStatus].label}
                  </span>
                  {captionTicketId && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        window.location.href = `/${params.tenant}/workspace/caption-workspace?ticket=${captionTicketId}`;
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-blue hover:text-brand-blue/80 px-2 py-1 rounded-md border border-brand-blue/25 hover:bg-brand-blue/10 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </button>
                  )}
                </div>
              </SidebarField>
            )}

            <SidebarField label="Platform">
              <SelectField
                value={platform}
                options={PLATFORM_OPTIONS}
                onSave={(v) => updateMeta({ platform: v })}
                renderOption={(v) => (
                  <span className="flex items-center gap-2 text-sm text-brand-off-white capitalize">
                    <AtSign className="h-3 w-3 text-gray-500" />
                    {v}
                  </span>
                )}
              />
            </SidebarField>

            {/* ── Schedule ── */}
            <SidebarSectionHeader label="Schedule" />

            <SidebarField label="Scheduled Date">
              <EditableField
                value={scheduledDate}
                type="date"
                placeholder="Not scheduled"
                onSave={(v) => updateMeta({ scheduledDate: v })}
              />
            </SidebarField>

            {/* ── Details ── */}
            <SidebarSectionHeader label="Details" />

            <SidebarField label="Priority">
              <SelectField
                value={task.priority ?? 'Normal'}
                options={['Low', 'Normal', 'High', 'Urgent']}
                onSave={(v) => onUpdate({ ...task, priority: v as BoardTask['priority'] })}
                renderOption={(v) => (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${PRIORITY_PILL[v] ?? 'text-gray-300'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[v] ?? ''}`} />
                    {v}
                  </span>
                )}
              />
            </SidebarField>

            <SidebarField label="Model">
              <EditableField
                value={model}
                placeholder="Model name"
                onSave={(v) => updateMeta({ model: v })}
              />
            </SidebarField>

            <SidebarField label="Assignee">
              <SearchableDropdown
                value={getMemberName(task.assignee) ?? ''}
                placeholder="Unassigned"
                searchPlaceholder="Search members..."
                options={spaceMembers.map((m) => getMemberName(m.user.clerkId) ?? m.user.email)}
                onChange={(v) => {
                  if (!v) { onUpdate({ ...task, assignee: undefined }); }
                  else {
                    const member = spaceMembers.find((m) => (getMemberName(m.user.clerkId) ?? m.user.email) === v);
                    if (member) onUpdate({ ...task, assignee: member.user.clerkId });
                  }
                }}
                clearable
              />
            </SidebarField>

            <SidebarField label="Media Count">
              <EditableField
                value={String(mediaCount)}
                placeholder="0"
                onSave={(v) =>
                  updateMeta({ mediaCount: Number(v) || 0 })
                }
              />
            </SidebarField>

            <SidebarField label="Hashtags">
              {hashtags.length > 0 ? (
                <div className="flex items-center gap-1 flex-wrap">
                  {hashtags.map((h) => (
                    <span
                      key={h}
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium border bg-brand-blue/10 text-brand-blue border-brand-blue/15"
                    >
                      #{h}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-gray-600 italic">
                  No hashtags
                </span>
              )}
            </SidebarField>

            {/* ── Notes ── */}
            <SidebarSectionHeader label="Notes" />

            <SidebarField label="Internal Notes">
              <EditableField
                value={task.description ?? ''}
                placeholder="Internal notes..."
                onSave={(v) =>
                  onUpdate({ ...task, description: v || undefined })
                }
              />
            </SidebarField>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
