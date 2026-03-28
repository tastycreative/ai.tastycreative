'use client';

import { memo, useState, useCallback, useEffect, useRef } from 'react';
import {
  FileText,
  Film,
  ClipboardList,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Eye,
  LogIn,
  LogOut,
  RefreshCw,
  Lock,
  FolderOpen,
  FileVideo,
  FileImage,
  ChevronLeft,
  Play,
  History,
  MessageSquare,
  Send,
  Undo2,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQAReview, useQAComment, type QAQueueItem, type QAReviewAction, type QAQueueHistoryEntry, type QAQueueComment, qaQueueKeys } from '@/lib/hooks/useQAQueue.query';
import { useQAItemAction, useRepushRejected } from '@/lib/hooks/useCaptionQueue.query';
import { useQueryClient } from '@tanstack/react-query';
import { useGoogleDriveAccount, type GoogleDriveProfile } from '@/lib/hooks/useGoogleDriveAccount';

/* ── helpers ────────────────────────────────────────────────────── */

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

function toViewUrl(url: string): string {
  if (url.includes('/preview')) return url.replace('/preview', '/view');
  return url;
}

function isDriveFolder(url: string): boolean {
  return url.includes('/folders/');
}

/* ── Google Drive sub-components (mirrors caption workspace) ────── */

function IframeSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900 animate-pulse">
      <div className="w-12 h-12 rounded-xl bg-gray-700" />
      <div className="h-3 w-32 rounded bg-gray-700" />
      <div className="h-2 w-24 rounded bg-gray-800" />
    </div>
  );
}

function GoogleAccountBar({
  profile, isSignedIn, isLoading, onSignIn, onSignOut, onSwitch,
}: {
  profile: GoogleDriveProfile | null;
  isSignedIn: boolean;
  isLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onSwitch: () => void;
}) {
  if (isLoading) return null;

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 dark:bg-gray-900/80 border-b border-brand-mid-pink/10 shrink-0">
        <span className="text-xs text-gray-500 dark:text-gray-400">Sign in with Google to view Drive content</span>
        <button
          onClick={onSignIn}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
        >
          <LogIn size={12} />
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 dark:bg-gray-900/80 border-b border-brand-mid-pink/10 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {profile?.picture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.picture} alt="" className="w-5 h-5 rounded-full shrink-0" referrerPolicy="no-referrer" />
        )}
        <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{profile?.email}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onSwitch} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-brand-mid-pink hover:bg-brand-mid-pink/10 transition-colors">
          <RefreshCw size={10} /> Switch
        </button>
        <button onClick={onSignOut} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <LogOut size={10} /> Sign out
        </button>
      </div>
    </div>
  );
}

type FolderFile = { id: string; name: string; mimeType: string; size: number | null; thumbnailLink?: string | null };
type FolderLoadState = 'loading' | 'ok' | 'no_access' | 'auth_error' | 'error';

function FolderGridCard({ file, onClick }: { file: FolderFile; onClick: () => void }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const isVideo = file.mimeType.startsWith('video/');
  const isImage = file.mimeType.startsWith('image/');
  const Icon = isVideo ? FileVideo : isImage ? FileImage : FileVideo;
  const iconColor = isVideo ? 'text-brand-blue' : isImage ? 'text-emerald-400' : 'text-gray-400';
  const thumb = !thumbFailed ? `/api/google-drive/thumbnail?fileId=${encodeURIComponent(file.id)}` : null;

  return (
    <button
      onClick={onClick}
      className="group flex flex-col rounded-lg overflow-hidden border border-white/[0.06] hover:border-white/[0.14] bg-[#1e1e20] hover:bg-[#26262a] transition-all duration-150 text-left"
    >
      <div className="relative w-full aspect-[4/3] flex items-center justify-center bg-[#17171a] overflow-hidden">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="w-full h-full object-cover" onError={() => setThumbFailed(true)} />
        ) : (
          <Icon size={32} className={`${iconColor} opacity-60`} />
        )}
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
            <div className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center">
              <Play size={16} className="text-white ml-0.5" fill="white" />
            </div>
          </div>
        )}
      </div>
      <div className="px-2 py-1.5 flex items-center gap-1.5 min-w-0">
        <Icon size={12} className={`${iconColor} shrink-0`} />
        <span className="text-[11px] text-gray-300 truncate group-hover:text-white leading-tight">{file.name}</span>
      </div>
    </button>
  );
}

function DriveFolderBrowser({ url, viewUrl, onSignIn }: { url: string; viewUrl: string; onSignIn?: () => void }) {
  const [status, setStatus] = useState<FolderLoadState>('loading');
  const [files, setFiles] = useState<FolderFile[]>([]);
  const [selected, setSelected] = useState<FolderFile | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setFiles([]);
    setSelected(null);
    fetch('/api/google-drive/fetch-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (cancelled) return;
        if (res.status === 401) { setStatus('auth_error'); return; }
        if (res.status === 403) { setStatus('no_access'); return; }
        if (!res.ok || !json.success) { setStatus('error'); return; }
        setFiles(json.files ?? []);
        setStatus('ok');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [url, retryKey]);

  if (status === 'loading') {
    return (
      <div className="w-full rounded-lg overflow-hidden">
        <div className="p-3 grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col rounded-lg overflow-hidden border border-white/[0.05] bg-[#1e1e20] animate-pulse">
              <div className="w-full aspect-[4/3] bg-[#2a2a2e]" />
              <div className="px-2 py-2 flex gap-1.5 items-center">
                <div className="w-3 h-3 rounded bg-gray-700 shrink-0" />
                <div className="h-2 rounded bg-gray-700 flex-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (status === 'auth_error') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 bg-gray-900/40 rounded-lg">
        <LogIn size={22} className="text-yellow-400" />
        <p className="text-sm font-medium text-gray-200">Session expired</p>
        <p className="text-xs text-gray-500">Please sign in again.</p>
        {onSignIn && (
          <button onClick={onSignIn} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-800 hover:bg-gray-100 transition-colors shadow-sm">
            Sign in with Google
          </button>
        )}
      </div>
    );
  }

  if (status === 'no_access') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 bg-gray-900/40 rounded-lg">
        <Lock size={22} className="text-red-400" />
        <p className="text-sm font-medium text-gray-200">No access to this folder</p>
        <div className="flex gap-2">
          <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-mid-pink hover:bg-brand-dark-pink transition-colors">
            <ExternalLink size={12} /> Request access in Drive
          </a>
          {onSignIn && (
            <button onClick={onSignIn} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">
              <RefreshCw size={12} /> Switch account
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 bg-gray-900/40 rounded-lg">
        <AlertTriangle size={22} className="text-amber-400" />
        <p className="text-sm font-medium text-gray-200">Failed to load folder</p>
        <div className="flex gap-2">
          <button onClick={() => setRetryKey(k => k + 1)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-mid-pink hover:bg-brand-dark-pink transition-colors">
            <RefreshCw size={12} /> Retry
          </button>
          <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">
            <ExternalLink size={12} /> Open in Drive
          </a>
        </div>
      </div>
    );
  }

  if (selected) {
    const isImage = selected.mimeType.startsWith('image/');
    const streamUrl = `/api/google-drive/stream?fileId=${encodeURIComponent(selected.id)}${isImage ? '&full=1' : ''}`;
    return (
      <div className="flex flex-col rounded-lg overflow-hidden border border-white/[0.06] bg-[#17171a]">
        <div className="flex items-center gap-2 px-3 py-2 bg-[#1e1e20] border-b border-white/[0.06] shrink-0">
          <button onClick={() => setSelected(null)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-300 hover:text-white hover:bg-white/[0.06] transition-colors">
            <ChevronLeft size={12} /> Back
          </button>
          <span className="text-xs text-gray-400 truncate flex-1">{selected.name}</span>
          <a href={`https://drive.google.com/file/d/${selected.id}/view`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors shrink-0">
            <ExternalLink size={10} /> Open
          </a>
        </div>
        <div className="relative flex items-center justify-center bg-black/60 min-h-[200px]">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={streamUrl} alt={selected.name} className="max-w-full max-h-[480px] object-contain" />
          ) : (
            <video src={streamUrl} controls className="max-w-full max-h-[480px]" preload="auto" />
          )}
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 bg-[#17171a] rounded-lg">
        <FolderOpen className="w-10 h-10 text-gray-600" />
        <p className="text-sm text-gray-400">This folder is empty</p>
        <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-white/[0.06] hover:bg-white/[0.10] transition-colors">
          <ExternalLink className="w-3 h-3" /> Open in Drive
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-lg overflow-hidden border border-white/[0.06] bg-[#17171a]">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1e1e20] border-b border-white/[0.06] shrink-0">
        <FolderOpen size={13} className="text-[#faad14] shrink-0" />
        <span className="text-xs text-gray-300 font-medium flex-1">{files.length} item{files.length !== 1 ? 's' : ''}</span>
        <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
          <ExternalLink size={10} /> Open in Drive
        </a>
      </div>
      <div className="p-3 grid grid-cols-3 gap-2">
        {files.map((file) => (
          <FolderGridCard key={file.id} file={file} onClick={() => setSelected(file)} />
        ))}
      </div>
    </div>
  );
}

function DrivePreview({ url, isSignedIn, onSignIn }: { url: string; isSignedIn: boolean; onSignIn: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'checking' | 'ok' | 'no_token' | 'no_access' | 'stream_error' | 'error'>('checking');
  const [retryKey, setRetryKey] = useState(0);
  const viewUrl = toViewUrl(url);
  const fileId = extractDriveFileId(url);
  const streamUrl = isSignedIn && fileId ? `/api/google-drive/stream?fileId=${encodeURIComponent(fileId)}` : null;

  useEffect(() => {
    if (!streamUrl) return;
    let cancelled = false;
    setStreamStatus('checking');
    setLoaded(false);
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
  }, [streamUrl, retryKey]);

  if (isDriveFolder(url)) {
    if (!isSignedIn) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-8 bg-gray-900/40 rounded-lg">
          <FolderOpen size={24} className="text-gray-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-200">Sign in to view this folder</p>
            <p className="text-xs text-gray-500 mt-1">Connect your Google account to browse this Drive folder</p>
          </div>
          <button onClick={onSignIn} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-800 hover:bg-gray-100 transition-colors shadow-sm">
            Sign in with Google
          </button>
        </div>
      );
    }
    return <DriveFolderBrowser url={url} viewUrl={viewUrl} onSignIn={onSignIn} />;
  }

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8 bg-gray-900/40 rounded-lg">
        <LogIn size={24} className="text-gray-400" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-200">Sign in to view Drive content</p>
          <p className="text-xs text-gray-500 mt-1">Connect your Google account to access this file</p>
        </div>
        <button onClick={onSignIn} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-800 hover:bg-gray-100 transition-colors shadow-sm">
          Sign in with Google
        </button>
      </div>
    );
  }

  if (streamUrl) {
    if (streamStatus === 'checking') return <div className="relative h-32"><IframeSkeleton /></div>;
    if (streamStatus === 'no_token') {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-8 bg-gray-900/40 rounded-lg">
          <LogIn size={22} className="text-yellow-400" />
          <p className="text-sm font-medium text-gray-200">Session expired</p>
          <button onClick={onSignIn} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-800 hover:bg-gray-100 transition-colors shadow-sm">
            Sign in again
          </button>
        </div>
      );
    }
    if (streamStatus === 'no_access') {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-8 bg-gray-900/40 rounded-lg">
          <Lock size={22} className="text-red-400" />
          <p className="text-sm font-medium text-gray-200">No access to this file</p>
          <div className="flex gap-2">
            <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-mid-pink hover:bg-brand-dark-pink transition-colors">
              <ExternalLink size={12} /> Request access in Drive
            </a>
            <button onClick={onSignIn} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">
              <RefreshCw size={12} /> Switch account
            </button>
          </div>
        </div>
      );
    }
    if (streamStatus === 'stream_error' || streamStatus === 'error') {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-8 bg-gray-900/40 rounded-lg">
          <AlertTriangle size={22} className="text-amber-400" />
          <p className="text-sm font-medium text-gray-200">Failed to load media</p>
          <div className="flex gap-2">
            <button onClick={() => setRetryKey(k => k + 1)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-mid-pink hover:bg-brand-dark-pink transition-colors">
              <RefreshCw size={12} /> Retry
            </button>
            <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">
              <ExternalLink size={12} /> Open in Drive
            </a>
          </div>
        </div>
      );
    }
    // Token valid — detect image vs video by extension
    const isImage = !!url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const imgStreamUrl = isImage ? `${streamUrl}&full=1` : streamUrl;
    return (
      <div className="relative rounded-lg overflow-hidden bg-[#17171a]">
        {!loaded && <IframeSkeleton />}
        <div className="flex items-center justify-center bg-black/60 min-h-[200px]">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${imgStreamUrl}|${retryKey}`}
              src={imgStreamUrl}
              alt=""
              className="max-w-full max-h-[480px] object-contain"
              style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }}
              onLoad={() => setLoaded(true)}
              onError={() => { setLoaded(true); setStreamStatus('stream_error'); }}
            />
          ) : (
            <video
              key={`${streamUrl}|${retryKey}`}
              src={streamUrl}
              controls
              className="max-w-full max-h-[480px]"
              style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }}
              preload="auto"
              onLoadedMetadata={() => setLoaded(true)}
              onError={() => { setLoaded(true); setStreamStatus('stream_error'); }}
            />
          )}
        </div>
        <a href={viewUrl} target="_blank" rel="noopener noreferrer"
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-black/60 hover:bg-black/80 backdrop-blur-sm transition-colors">
          <ExternalLink className="w-3 h-3" /> Open in Drive
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6 bg-gray-900/40 rounded-lg">
      <p className="text-sm text-gray-400">Could not load Drive file preview.</p>
      <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-black/60 hover:bg-black/80 transition-colors">
        <ExternalLink size={12} /> Open in Drive
      </a>
    </div>
  );
}

/* ── Relative time helper ──────────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── QA History / Audit Log Section ───────────────────────────── */

function QAHistoryLog({ history, getMemberName }: { history: QAQueueHistoryEntry[]; getMemberName: (id?: string | null) => string | null }) {
  if (!history || history.length === 0) {
    return <p className="text-xs text-gray-500 dark:text-gray-600 italic py-2">No history recorded yet.</p>;
  }

  const actionIcons: Record<string, string> = {
    column_move: '→',
    approve: '✓',
    reject: '✗',
    create: '+',
    update: '✎',
  };

  const actionColors: Record<string, string> = {
    approve: 'text-emerald-500 bg-emerald-500/10',
    reject: 'text-red-500 bg-red-500/10',
    column_move: 'text-blue-500 bg-blue-500/10',
    create: 'text-gray-500 bg-gray-500/10',
    update: 'text-amber-500 bg-amber-500/10',
  };

  return (
    <div className="space-y-1 pt-2 max-h-[280px] overflow-y-auto custom-scrollbar">
      {history.map((entry) => {
        const actor = getMemberName(entry.userId) ?? 'Unknown';
        const actionType = entry.action.toLowerCase().includes('approve') ? 'approve'
          : entry.action.toLowerCase().includes('reject') ? 'reject'
          : entry.action.toLowerCase().includes('move') || entry.field === 'columnId' ? 'column_move'
          : entry.action.toLowerCase().includes('create') ? 'create'
          : 'update';
        const color = actionColors[actionType] ?? 'text-gray-500 bg-gray-500/10';
        const icon = actionIcons[actionType] ?? '•';

        return (
          <div key={entry.id} className="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${color}`}>
              {icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed">
                <span className="font-semibold">{actor}</span>{' '}
                <span className="text-gray-500 dark:text-gray-400">
                  {entry.field === 'columnId' ? `moved to ${entry.newValue ?? 'column'}` : `${entry.action} ${entry.field}`}
                </span>
                {entry.newValue && entry.field !== 'columnId' && (
                  <span className="text-gray-400 dark:text-gray-500"> → {entry.newValue.length > 60 ? entry.newValue.slice(0, 60) + '…' : entry.newValue}</span>
                )}
              </p>
              <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">{timeAgo(entry.createdAt)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Comments Thread Section ──────────────────────────────────── */

function CommentsThread({ comments, itemId, getMemberName }: { comments: QAQueueComment[]; itemId: string; getMemberName: (id?: string | null) => string | null }) {
  const commentMutation = useQAComment();
  const [newComment, setNewComment] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments.length]);

  const handleSubmit = useCallback(() => {
    const text = newComment.trim();
    if (!text) return;
    commentMutation.mutate(
      { itemId, content: text },
      { onSuccess: () => setNewComment('') },
    );
  }, [newComment, itemId, commentMutation]);

  return (
    <div className="pt-2 space-y-2">
      {/* Messages */}
      <div ref={scrollRef} className="max-h-[240px] overflow-y-auto custom-scrollbar space-y-2">
        {comments.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-600 italic py-2">No comments yet. Start the conversation.</p>
        )}
        {comments.map((c) => {
          const author = getMemberName(c.createdBy) ?? 'Unknown';
          return (
            <div key={c.id} className="flex gap-2 py-1">
              <div className="w-6 h-6 rounded-full bg-brand-mid-pink/15 text-brand-mid-pink flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                {author.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{author}</span>
                  <span className="text-[9px] text-gray-400">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compose */}
      <div className="flex items-center gap-2 pt-1">
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          placeholder="Add a comment..."
          className="flex-1 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/30"
        />
        <button
          onClick={handleSubmit}
          disabled={!newComment.trim() || commentMutation.isPending}
          className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-30 transition-colors"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

/* ── GIF Skeleton Loader ──────────────────────────────────────── */

function GifSkeleton() {
  return (
    <div className="w-full aspect-[3/4] rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse flex items-center justify-center">
      <Film className="w-8 h-8 text-gray-300 dark:text-gray-600" />
    </div>
  );
}

const CAPTION_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  APPROVED: { label: 'Approved', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  AWAITING_APPROVAL: { label: 'Awaiting Approval', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  IN_CAPTION: { label: 'In Caption', color: 'text-brand-blue bg-brand-blue/10 border-brand-blue/20' },
  NEEDS_REVISION: { label: 'Needs Revision', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  PENDING_CAPTION: { label: 'Pending Caption', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
};

/* ── SLA / Age badge ──────────────────────────────────────────── */

function SLABadge({ createdAt }: { createdAt: string }) {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageH = ageMs / (1000 * 60 * 60);

  let label: string;
  let color: string;

  if (ageH < 4) {
    label = `${Math.max(1, Math.round(ageH))}h`;
    color = 'text-emerald-500 bg-emerald-500/10';
  } else if (ageH < 12) {
    label = `${Math.round(ageH)}h`;
    color = 'text-amber-500 bg-amber-500/10';
  } else if (ageH < 24) {
    label = `${Math.round(ageH)}h`;
    color = 'text-orange-500 bg-orange-500/10';
  } else {
    const days = Math.floor(ageH / 24);
    label = `${days}d ${Math.round(ageH % 24)}h`;
    color = 'text-red-500 bg-red-500/10';
  }

  return (
    <div className={`mt-2 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${color}`}>
      <Clock className="w-3 h-3" />
      <span>Age: {label}</span>
    </div>
  );
}

/* ── Section wrapper ──────────────────────────────────────────── */

function Section({
  icon: Icon,
  title,
  defaultOpen = true,
  badge,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200/60 dark:border-white/[0.06] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 flex-1">{title}</span>
        {badge}
        {open ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-gray-100 dark:border-white/[0.04]">{children}</div>}
    </div>
  );
}

/* ── Content Preview Section ──────────────────────────────────── */

function ContentPreview({ item, isSignedIn, onSignIn, onSignOut, onSwitch, profile, isLoadingAccount }: {
  item: QAQueueItem;
  isSignedIn: boolean;
  isLoadingAccount: boolean;
  profile: GoogleDriveProfile | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onSwitch: () => void;
}) {
  const meta = item.metadata;
  const isSextingSets = item.workflowType === 'SEXTING_SETS';
  const sextingImages = (meta.images as Array<{ id: string; url: string; name: string; type: string; sequence: number }>) ?? [];
  const [selectedImg, setSelectedImg] = useState<{ url: string; name: string; type: string } | null>(null);

  // Sexting sets: show image carousel from metadata.images[]
  if (isSextingSets) {
    if (sextingImages.length === 0 && (!item.media || item.media.length === 0)) {
      return (
        <div className="flex items-center justify-center h-24 text-gray-500 dark:text-gray-600 text-xs">
          No images attached
        </div>
      );
    }

    const allImages = sextingImages.length > 0
      ? sextingImages.sort((a, b) => a.sequence - b.sequence)
      : item.media;

    // Full-size single image view
    if (selectedImg) {
      const isVideo = selectedImg.type.startsWith('video/');
      return (
        <div className="pt-3 space-y-2">
          <button
            onClick={() => setSelectedImg(null)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to all images
          </button>
          <div className="flex items-center justify-center rounded-xl overflow-hidden border border-gray-200 dark:border-white/[0.06] bg-black/5 dark:bg-black/20">
            {isVideo ? (
              <video
                src={selectedImg.url}
                controls
                className="max-h-[480px] max-w-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedImg.url}
                alt={selectedImg.name}
                className="max-h-[480px] max-w-full object-contain"
              />
            )}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-gray-600 dark:text-gray-400 truncate">{selectedImg.name}</p>
            <a
              href={selectedImg.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-brand-blue hover:underline shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
              Open in new tab
            </a>
          </div>
        </div>
      );
    }

    return (
      <div className="pt-3">
        <div className="grid grid-cols-3 gap-2">
          {allImages.map((img, idx) => {
            const imgUrl = 'url' in img ? img.url : '';
            const imgName = ('name' in img ? img.name : null) ?? `Image ${idx + 1}`;
            const imgType = ('type' in img ? img.type : '') ?? '';
            const isVideo = imgType.startsWith('video/');
            return (
              <button
                key={'id' in img ? img.id : idx}
                onClick={() => setSelectedImg({ url: imgUrl, name: imgName, type: imgType })}
                className="group relative aspect-square rounded-lg overflow-hidden bg-black/20 border border-gray-200 dark:border-white/[0.06] hover:border-fuchsia-500/30 transition-all text-left"
              >
                {isVideo ? (
                  <video src={imgUrl} className="w-full h-full object-cover" muted preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgUrl} alt={imgName} className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                  <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="absolute bottom-1 left-1 text-[9px] text-white bg-black/60 px-1.5 py-0.5 rounded font-mono">
                  {idx + 1}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">{allImages.length} image{allImages.length !== 1 ? 's' : ''} in set</p>
      </div>
    );
  }

  // OTP/PTR: Drive content + media attachments (original behavior)
  const driveLink = (meta.driveLink as string) ?? (meta.contentLink as string) ?? '';
  const hasMedia = item.media && item.media.length > 0;
  const hasDriveContent = !!driveLink;

  if (!driveLink && !hasMedia) {
    return (
      <div className="flex items-center justify-center h-24 text-gray-500 dark:text-gray-600 text-xs">
        No content attached
      </div>
    );
  }

  return (
    <div className="pt-3 space-y-0">
      {/* Google Account Bar — pinned above the scrollable content */}
      {hasDriveContent && (
        <GoogleAccountBar
          profile={profile}
          isSignedIn={isSignedIn}
          isLoading={isLoadingAccount}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          onSwitch={onSwitch}
        />
      )}

      <div className="space-y-3 pt-3">
        {/* Drive content */}
        {driveLink && (
          <DrivePreview url={driveLink} isSignedIn={isSignedIn} onSignIn={onSignIn} />
        )}

        {/* Attachments */}
        {hasMedia && (
          <div className="grid grid-cols-3 gap-2">
          {item.media.map((m) => {
            const isVideo = m.type?.startsWith('video/');
            return (
              <a
                key={m.id}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-square rounded-lg overflow-hidden bg-black/20 border border-gray-200 dark:border-white/[0.06] hover:border-emerald-500/30 transition-all"
              >
                {isVideo ? (
                  <video src={m.url} className="w-full h-full object-cover" muted preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                  <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </a>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}

/* ── Caption Review Section ───────────────────────────────────── */

const CAPTION_ITEM_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  submitted: { label: 'Submitted', color: 'text-brand-blue bg-brand-blue/10 border-brand-blue/20' },
  approved: { label: 'Approved', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  rejected: { label: 'Rejected', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  not_required: { label: 'Not Required', color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' },
};

function CaptionReview({ item }: { item: QAQueueItem }) {
  const meta = item.metadata;
  const isSextingSets = item.workflowType === 'SEXTING_SETS';
  const captionTicketId = (meta.captionTicketId as string) ?? '';
  const qaItemAction = useQAItemAction();
  const repushRejected = useRepushRejected();
  const queryClient = useQueryClient();
  const [rejectingItemId, setRejectingItemId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  // Optimistic: per-item pending tracking & local status overrides
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set());
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, { status: string; reason?: string }>>({});

  // Sexting sets: show per-item captions from metadata.captionItems[]
  if (isSextingSets) {
    const captionItems = (meta.captionItems as Array<{
      contentItemId: string | null;
      url: string;
      fileName: string | null;
      captionText: string | null;
      captionStatus: string;
      qaRejectionReason: string | null;
      isPosted: boolean;
    }>) ?? [];

    if (captionItems.length === 0) {
      return (
        <div className="pt-3">
          <p className="text-xs text-gray-500 dark:text-gray-600 italic py-2">No caption items found.</p>
        </div>
      );
    }

    // Apply optimistic status overrides to caption items for display
    const displayItems = captionItems.map(ci => {
      const override = ci.contentItemId ? optimisticStatuses[ci.contentItemId] : null;
      if (!override) return ci;
      return {
        ...ci,
        captionStatus: override.status,
        qaRejectionReason: override.status === 'rejected' ? (override.reason ?? ci.qaRejectionReason) : (override.status === 'approved' ? null : ci.qaRejectionReason),
      };
    });

    const hasRejectedItems = displayItems.some(ci => ci.captionStatus === 'rejected');
    const allDecided = displayItems.every(ci => ci.captionStatus === 'approved' || ci.captionStatus === 'rejected' || ci.captionStatus === 'not_required' || ci.captionStatus === 'pending');
    const submittedCount = displayItems.filter(ci => ci.captionStatus === 'submitted').length;

    const handlePerItemAction = (contentItemId: string, action: 'approve' | 'reject' | 'revert', reason?: string) => {
      if (!captionTicketId) {
        toast.error('Caption ticket not linked — cannot perform action');
        return;
      }

      // Optimistic UI: immediately update the status locally
      const optimisticStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'submitted';
      setOptimisticStatuses(prev => ({ ...prev, [contentItemId]: { status: optimisticStatus, reason: reason?.trim() } }));
      setPendingItems(prev => { const next = new Set(prev); next.add(contentItemId); return next; });
      if (action === 'reject') {
        setRejectingItemId(null);
        setRejectReason('');
      }

      qaItemAction.mutate(
        {
          ticketId: captionTicketId,
          items: [{ contentItemId, action, reason: reason || undefined }],
        },
        {
          onSuccess: async () => {
            // Keep optimistic override visible while refetching to prevent stale "submitted" flash
            setPendingItems(prev => { const next = new Set(prev); next.delete(contentItemId); return next; });
            toast.success(action === 'approve' ? 'Caption approved' : action === 'reject' ? 'Caption rejected' : 'Action reverted');
            // Wait for fresh data before clearing the optimistic override
            await queryClient.invalidateQueries({ queryKey: qaQueueKeys.all });
            setOptimisticStatuses(prev => { const next = { ...prev }; delete next[contentItemId]; return next; });
          },
          onError: (err) => {
            // Roll back optimistic update
            setPendingItems(prev => { const next = new Set(prev); next.delete(contentItemId); return next; });
            setOptimisticStatuses(prev => { const next = { ...prev }; delete next[contentItemId]; return next; });
            toast.error(err?.message ?? 'Failed to process action');
          },
        },
      );
    };

    const handleRepush = () => {
      if (!captionTicketId) {
        toast.error('Caption ticket not linked — cannot repush');
        return;
      }
      repushRejected.mutate(captionTicketId, {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: qaQueueKeys.all });
          toast.success(`${data.repushedCount} rejected item${data.repushedCount !== 1 ? 's' : ''} sent back to caption workspace`);
        },
        onError: (err) => {
          toast.error(err?.message ?? 'Failed to repush rejected items');
        },
      });
    };

    return (
      <div className="space-y-3 pt-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {displayItems.length} caption item{displayItems.length !== 1 ? 's' : ''}
            {submittedCount > 0 && (
              <span className="ml-1.5 text-brand-blue">· {submittedCount} awaiting review</span>
            )}
          </p>
        </div>
        {displayItems.map((ci, idx) => {
          const statusCfg = CAPTION_ITEM_STATUS_LABELS[ci.captionStatus] ?? { label: ci.captionStatus || 'Unknown', color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' };
          const isSubmitted = ci.captionStatus === 'submitted';
          const isRejected = ci.captionStatus === 'rejected';
          const isApproved = ci.captionStatus === 'approved';
          const canAct = !!ci.contentItemId && !!captionTicketId;
          const isRejectingThis = rejectingItemId === ci.contentItemId;
          const isItemPending = ci.contentItemId ? pendingItems.has(ci.contentItemId) : false;

          return (
            <div key={ci.contentItemId ?? idx} className={`rounded-xl border overflow-hidden transition-all duration-200 ${isItemPending ? 'border-brand-blue/30 dark:border-brand-blue/20 opacity-80' : 'border-gray-200/60 dark:border-white/[0.06]'}`}>
              {/* Header: thumbnail + status */}
              <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-white/[0.02]">
                {ci.url && (
                  <div className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ci.url} alt={ci.fileName ?? ''} className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-white/[0.06]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 truncate">
                    {ci.fileName ?? `Image ${idx + 1}`}
                  </p>
                  <div className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${statusCfg.color}`}>
                    <span className="w-1 h-1 rounded-full bg-current" />
                    {statusCfg.label}
                  </div>
                </div>
                <span className="text-[9px] text-gray-400 font-mono shrink-0">#{idx + 1}</span>
              </div>
              {/* Caption text */}
              {ci.captionText ? (
                <div className="px-3 py-2 border-t border-gray-100 dark:border-white/[0.04]">
                  <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-32 overflow-y-auto custom-scrollbar">
                    {ci.captionText}
                  </p>
                  <p className="text-[9px] text-gray-400 mt-1">{ci.captionText.length} chars</p>
                </div>
              ) : (
                <div className="px-3 py-2 border-t border-gray-100 dark:border-white/[0.04]">
                  <p className="text-[11px] text-gray-500 dark:text-gray-600 italic">No caption yet</p>
                </div>
              )}
              {/* Rejection reason */}
              {ci.qaRejectionReason && isRejected && (
                <div className="mx-3 mb-2 flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/15 text-[11px]">
                  <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-600 dark:text-red-300/80">{ci.qaRejectionReason}</p>
                </div>
              )}
              {/* Per-item action buttons */}
              {canAct && isSubmitted && !isRejectingThis && !isItemPending && (
                <div className="flex gap-2 px-3 py-2 border-t border-gray-100 dark:border-white/[0.04]">
                  <button
                    onClick={() => handlePerItemAction(ci.contentItemId!, 'approve')}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/25 hover:bg-emerald-50 dark:hover:bg-emerald-500/5 transition-colors"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Approve
                  </button>
                  <button
                    onClick={() => setRejectingItemId(ci.contentItemId)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold text-red-500 border border-red-300 dark:border-red-500/25 hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors"
                  >
                    <XCircle className="w-3 h-3" />
                    Reject
                  </button>
                </div>
              )}
              {/* Inline reject reason form */}
              {canAct && isRejectingThis && (
                <div className="px-3 py-2 border-t border-gray-100 dark:border-white/[0.04] space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    placeholder="Reason for rejection (optional)..."
                    autoFocus
                    className="w-full rounded-lg border border-red-300 dark:border-red-500/20 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/30 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={isItemPending}
                      onClick={() => handlePerItemAction(ci.contentItemId!, 'reject', rejectReason.trim())}
                      className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-40"
                    >
                      Confirm Reject
                    </button>
                    <button
                      onClick={() => { setRejectingItemId(null); setRejectReason(''); }}
                      className="px-3 py-1.5 rounded-lg text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {/* Revert button for already-decided items */}
              {canAct && (isApproved || isRejected) && !isItemPending && (
                <div className="px-3 py-1.5 border-t border-gray-100 dark:border-white/[0.04]">
                  <button
                    onClick={() => handlePerItemAction(ci.contentItemId!, 'revert')}
                    className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    <Undo2 className="w-3 h-3" />
                    Revert to submitted
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Repush rejected items button */}
        {hasRejectedItems && (
          <button
            disabled={repushRejected.isPending}
            onClick={handleRepush}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-500/25 hover:bg-amber-50 dark:hover:bg-amber-500/5 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${repushRejected.isPending ? 'animate-spin' : ''}`} />
            {repushRejected.isPending ? 'Sending back...' : 'Repush Rejected to Caption Workspace'}
          </button>
        )}
      </div>
    );
  }

  // OTP/PTR: single caption view (original behavior)
  const captionText = (meta.captionText as string) ?? '';
  const captionStatus = (meta.otpPtrCaptionStatus as string) ?? '';
  const qaRejectionReason = (meta.qaRejectionReason as string) ?? '';
  const statusCfg = CAPTION_STATUS_LABELS[captionStatus] ?? { label: captionStatus || 'Unknown', color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' };

  return (
    <div className="space-y-3 pt-3">
      {/* Status badge */}
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${statusCfg.color}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {statusCfg.label}
      </div>

      {/* Caption text */}
      {captionText ? (
        <div className="relative">
          <div className="p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-xl text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar">
            {captionText}
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
            <FileText className="w-3 h-3" />
            {captionText.length} chars
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-600 italic py-2">No caption written yet.</p>
      )}

      {/* Previous rejection reason if visible */}
      {qaRejectionReason && captionStatus === 'NEEDS_REVISION' && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/15 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-semibold uppercase text-red-500 dark:text-red-400 mb-0.5">Previous Rejection Reason</p>
            <p className="text-red-600 dark:text-red-300/80 whitespace-pre-wrap">{qaRejectionReason}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Flyer/GIF Review Section ─────────────────────────────────── */

function FlyerReview({ item }: { item: QAQueueItem }) {
  const meta = item.metadata;
  const gifUrl = (meta.gifUrl as string) ?? '';
  const gifUrlFansly = (meta.gifUrlFansly as string) ?? '';
  const gameType = (meta.gameType as string) ?? '';
  const gameNotes = (meta.gameNotes as string) ?? '';
  const platforms = (meta.platforms as string[]) ?? [];
  const hasFansly = platforms.includes('fansly');
  const hasAnyGif = !!gifUrl.trim() || !!gifUrlFansly.trim();
  const [ofLoaded, setOfLoaded] = useState(false);
  const [fanslyLoaded, setFanslyLoaded] = useState(false);

  // Reset load state when item changes
  useEffect(() => { setOfLoaded(false); setFanslyLoaded(false); }, [item.id]);

  return (
    <div className="space-y-3 pt-3">
      {/* Game info */}
      {(gameType || gameNotes) && (
        <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
          {gameType && (
            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-md text-[10px] font-medium">
              {gameType}
            </span>
          )}
          {gameNotes && <span className="truncate">{gameNotes}</span>}
        </div>
      )}

      {!hasAnyGif && (
        <div className="flex items-center justify-center h-20 text-xs text-gray-500 dark:text-gray-600 italic">
          No flyer/GIF attached
        </div>
      )}

      {/* GIF previews — large for QA review */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {gifUrl.trim() && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-brand-blue">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
              OnlyFans
            </div>
            <a href={gifUrl} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-gray-200 dark:border-white/[0.08] hover:border-emerald-500/30 transition-colors group">
              {!ofLoaded && <GifSkeleton />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gifUrl}
                alt="OF Flyer"
                className={`w-full aspect-[3/4] object-cover bg-black/10 group-hover:scale-[1.02] transition-transform duration-300 ${ofLoaded ? '' : 'hidden'}`}
                onLoad={() => setOfLoaded(true)}
                onError={(e) => {
                  setOfLoaded(true);
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </a>
          </div>
        )}

        {hasFansly && gifUrlFansly.trim() && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-brand-light-pink">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-light-pink" />
              Fansly
            </div>
            <a href={gifUrlFansly} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-gray-200 dark:border-white/[0.08] hover:border-emerald-500/30 transition-colors group">
              {!fanslyLoaded && <GifSkeleton />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gifUrlFansly}
                alt="Fansly Flyer"
                className={`w-full aspect-[3/4] object-cover bg-black/10 group-hover:scale-[1.02] transition-transform duration-300 ${fanslyLoaded ? '' : 'hidden'}`}
                onLoad={() => setFanslyLoaded(true)}
                onError={(e) => {
                  setFanslyLoaded(true);
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </a>
          </div>
        )}
      </div>

      {/* Flyer assets from DB */}
      {item.flyerAssets.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Flyer Assets ({item.flyerAssets.length})
          </p>
          <div className="grid grid-cols-3 gap-2">
            {item.flyerAssets.map((asset) => (
              <a
                key={asset.id}
                href={asset.url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-white/[0.06] hover:border-emerald-500/30 transition-colors group"
              >
                {asset.fileType.startsWith('video/') ? (
                  <video src={asset.url} className="w-full h-full object-cover" muted preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.url} alt={asset.fileName} className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                  <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── QA Decision Bar ──────────────────────────────────────────── */

function QADecisionBar({
  item,
  onReviewComplete,
}: {
  item: QAQueueItem;
  onReviewComplete: () => void;
}) {
  const reviewMutation = useQAReview();
  const isSextingSets = item.workflowType === 'SEXTING_SETS';
  const [rejectTarget, setRejectTarget] = useState<'caption' | 'flyer' | 'both' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [qaNotes, setQaNotes] = useState(() => (item.metadata.qaNotes as string) ?? '');
  const [campaignOrUnlock, setCampaignOrUnlock] = useState(() => (item.metadata.campaignOrUnlock as string) ?? '');
  const [totalSale, setTotalSale] = useState(() => {
    const v = item.metadata.totalSale;
    return v ? String(v) : '';
  });

  // Reset state when item changes
  useEffect(() => {
    setRejectTarget(null);
    setRejectReason('');
    setQaNotes((item.metadata.qaNotes as string) ?? '');
    setCampaignOrUnlock((item.metadata.campaignOrUnlock as string) ?? '');
    const v = item.metadata.totalSale;
    setTotalSale(v ? String(v) : '');
  }, [item.id, item.metadata.qaNotes, item.metadata.campaignOrUnlock, item.metadata.totalSale]);

  const undoRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  const handleAction = useCallback(
    (action: QAReviewAction, reason?: string) => {
      const ref = { cancelled: false };
      undoRef.current = ref;

      const actionLabel = action === 'approve' ? 'Approved' : action === 'reject_caption' ? 'Rejected caption' : action === 'reject_flyer' ? 'Rejected flyer' : 'Rejected both';

      toast(actionLabel, {
        description: 'This action will be applied shortly.',
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: () => { ref.cancelled = true; },
        },
        onAutoClose: () => {
          if (ref.cancelled) return;
          reviewMutation.mutateAsync({
            itemId: item.id,
            action,
            reason: reason || undefined,
            qaNotes: qaNotes.trim() || undefined,
            campaignOrUnlock: campaignOrUnlock || undefined,
            totalSale: totalSale ? Number(totalSale) : undefined,
          }).then(() => {
            setRejectTarget(null);
            setRejectReason('');
            onReviewComplete();
          }).catch((err) => {
            toast.error(err?.message ?? 'Failed to process review');
          });
        },
      });
    },
    [item.id, qaNotes, campaignOrUnlock, totalSale, reviewMutation, onReviewComplete],
  );

  const meta = item.metadata;
  const hasCaption = isSextingSets
    ? ((meta.captionItems as unknown[]) ?? []).length > 0
    : !!((meta.captionText as string) ?? '').trim();
  const hasGif = !isSextingSets && !!((meta.gifUrl as string) ?? '').trim();

  return (
    <div className="space-y-4 pt-3">
      {/* QA Fields — Campaign/Total Sale only for OTP/PTR */}
      {!isSextingSets && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
              Campaign / Unlock
            </label>
            <select
              value={campaignOrUnlock}
              onChange={(e) => setCampaignOrUnlock(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900 px-2.5 py-2 text-xs text-gray-900 dark:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/30"
            >
              <option value="" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200">Select...</option>
              <option value="Campaign" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200">Campaign</option>
              <option value="Unlock" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200">Unlock</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
              Total Sale ($)
            </label>
            <input
              type="number"
              value={totalSale}
              onChange={(e) => setTotalSale(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900 px-2.5 py-2 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/30"
            />
          </div>
        </div>
      )}

      <div>
        <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
          QA Notes
        </label>
        <textarea
          value={qaNotes}
          onChange={(e) => setQaNotes(e.target.value)}
          rows={2}
          placeholder="General QA feedback/notes..."
          className="w-full rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900 px-3 py-2 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/30 resize-none"
        />
      </div>

      {/* Reject form */}
      {rejectTarget && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/15 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">
              Rejecting {rejectTarget === 'caption' ? 'Caption' : rejectTarget === 'flyer' ? 'Flyer' : 'Caption & Flyer'}
            </span>
          </div>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            placeholder="Reason for rejection (optional)..."
            className="w-full rounded-lg border border-red-300 dark:border-red-500/20 bg-white dark:bg-gray-900 px-3 py-2 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/30 resize-none"
          />
          <div className="flex gap-2">
            <button
              disabled={reviewMutation.isPending}
              onClick={() =>
                handleAction(
                  rejectTarget === 'caption'
                    ? 'reject_caption'
                    : rejectTarget === 'flyer'
                    ? 'reject_flyer'
                    : 'reject_both',
                  rejectReason.trim(),
                )
              }
              className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-40"
            >
              {reviewMutation.isPending ? 'Rejecting...' : 'Confirm Reject'}
            </button>
            <button
              onClick={() => {
                setRejectTarget(null);
                setRejectReason('');
              }}
              className="px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!rejectTarget && (
        <div className="space-y-2">
          {/* For sexting sets: show summary + approve-all after per-item review */}
          {isSextingSets ? (
            <>
              {(() => {
                const captionItems = (meta.captionItems as Array<{ captionStatus: string }>) ?? [];
                const approvedCount = captionItems.filter(ci => ci.captionStatus === 'approved').length;
                const rejectedCount = captionItems.filter(ci => ci.captionStatus === 'rejected').length;
                const submittedCount = captionItems.filter(ci => ci.captionStatus === 'submitted').length;
                const allReviewed = submittedCount === 0 && captionItems.length > 0;
                return (
                  <>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
                      {approvedCount > 0 && <span className="text-emerald-500 font-medium">{approvedCount} approved</span>}
                      {rejectedCount > 0 && <span className="text-red-400 font-medium">{rejectedCount} rejected</span>}
                      {submittedCount > 0 && <span className="text-brand-blue font-medium">{submittedCount} pending review</span>}
                    </div>
                    <button
                      disabled={reviewMutation.isPending || !allReviewed}
                      onClick={() => handleAction('approve')}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {reviewMutation.isPending ? 'Processing...' : !allReviewed ? 'Review all captions above first' : 'Finalize — Move to Review'}
                    </button>
                  </>
                );
              })()}
            </>
          ) : (
            <>
              {/* OTP/PTR: Approve */}
              <button
                disabled={reviewMutation.isPending}
                onClick={() => handleAction('approve')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-40"
              >
                <CheckCircle2 className="w-4 h-4" />
                {reviewMutation.isPending ? 'Processing...' : 'Approve — Move to For Approval'}
              </button>

              {/* OTP/PTR: Reject options */}
              <div className="flex gap-2">
                {hasCaption && (
                  <button
                    onClick={() => setRejectTarget('caption')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-red-500 border border-red-300 dark:border-red-500/25 hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject Caption
                  </button>
                )}
                {hasGif && (
                  <button
                    onClick={() => setRejectTarget('flyer')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-red-500 border border-red-300 dark:border-red-500/25 hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject Flyer
                  </button>
                )}
                {hasCaption && hasGif && (
                  <button
                    onClick={() => setRejectTarget('both')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-red-500 border border-red-300 dark:border-red-500/25 hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject Both
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Ticket Header ────────────────────────────────────────────── */

function TicketHeader({
  item,
  getMemberName,
}: {
  item: QAQueueItem;
  getMemberName: (id?: string | null) => string | null;
}) {
  const meta = item.metadata;
  const isSextingSets = item.workflowType === 'SEXTING_SETS';
  const model = (meta.model as string) ?? '';
  const postOrigin = (meta.postOrigin as string) ?? '';
  const category = (meta.category as string) ?? '';
  const price = meta.price as number | undefined;
  const platforms = (meta.platforms as string[]) ?? [];
  const assigneeName = getMemberName(item.assigneeId);

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        {/* Model avatar */}
        {item.modelProfile?.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.modelProfile.profileImageUrl}
            alt={model}
            className="w-10 h-10 rounded-xl object-cover border border-gray-200 dark:border-white/[0.08]"
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center text-sm font-bold">
            {model.charAt(0).toUpperCase() || '?'}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{item.title}</h2>
            <span className="text-[10px] text-gray-500 font-mono shrink-0">#{item.itemNo}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
            <span className="font-medium">{model}</span>
            {isSextingSets && category && (
              <>
                <span>·</span>
                <span className="px-1.5 py-0.5 rounded bg-fuchsia-100 dark:bg-fuchsia-500/10 font-semibold text-fuchsia-600 dark:text-fuchsia-400">
                  {category}
                </span>
              </>
            )}
            {!isSextingSets && postOrigin && (
              <>
                <span>·</span>
                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/[0.05] font-semibold">
                  {postOrigin}
                </span>
              </>
            )}
            {!isSextingSets && price != null && price > 0 && (
              <>
                <span>·</span>
                <span className="font-medium text-emerald-500">${price}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right side: Platforms + Assignee */}
      <div className="flex items-center gap-2 shrink-0">
        {platforms.map((p) => (
          <span
            key={p}
            className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400"
          >
            {p}
          </span>
        ))}
        {assigneeName && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500">{assigneeName}</span>
        )}
      </div>
    </div>
  );
}

/* ── Main ReviewPanel ─────────────────────────────────────────── */

interface ReviewPanelProps {
  item: QAQueueItem | undefined;
  getMemberName: (id?: string | null) => string | null;
  onReviewComplete: () => void;
  tenant: string;
}

function ReviewPanelComponent({ item, getMemberName, onReviewComplete, tenant }: ReviewPanelProps) {
  const { profile, isSignedIn, isLoading: isLoadingAccount, signIn, signOut, switchAccount } = useGoogleDriveAccount();

  if (!item) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500 dark:text-gray-600">
        Select a ticket from the queue to review
      </div>
    );
  }

  const isSextingSets = item.workflowType === 'SEXTING_SETS';
  const sextingSetStatus = (item.metadata.sextingSetStatus as string) ?? '';

  // Caption review badge — use sextingSetStatus for sexting sets, otpPtrCaptionStatus for OTP/PTR
  const captionBadge = isSextingSets ? (
    sextingSetStatus ? (
      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-fuchsia-500 bg-fuchsia-500/10">
        {sextingSetStatus.replace(/_/g, ' ')}
      </span>
    ) : null
  ) : (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
      (item.metadata.otpPtrCaptionStatus as string) === 'APPROVED'
        ? 'text-emerald-500 bg-emerald-500/10'
        : 'text-gray-400'
    }`}>
      {CAPTION_STATUS_LABELS[(item.metadata.otpPtrCaptionStatus as string)]?.label ?? ''}
    </span>
  );

  // Content badge — count images for sexting sets, files for OTP/PTR
  const contentBadge = isSextingSets ? (
    (() => {
      const imgCount = ((item.metadata.images as unknown[]) ?? []).length || item.media.length;
      return imgCount > 0 ? (
        <span className="text-[10px] text-gray-400 font-medium">{imgCount} image{imgCount !== 1 ? 's' : ''}</span>
      ) : undefined;
    })()
  ) : (
    item.media.length > 0 ? (
      <span className="text-[10px] text-gray-400 font-medium">{item.media.length} file{item.media.length !== 1 ? 's' : ''}</span>
    ) : undefined
  );

  return (
    <div className="flex flex-col h-full overflow-auto bg-gray-50 dark:bg-gray-950/50 custom-scrollbar">
      {/* Ticket header */}
      <div className="px-5 py-4 border-b border-gray-200/50 dark:border-white/[0.06] bg-white dark:bg-gray-900/80 sticky top-0 z-10 backdrop-blur-xl">
        <TicketHeader item={item} getMemberName={getMemberName} />
        {/* SLA / Age indicator */}
        <SLABadge createdAt={item.createdAt} />
      </div>

      {/* Scrollable review sections */}
      <div className="flex-1 p-4 lg:p-5 space-y-3">
        {/* Content Preview */}
        <Section icon={ImageIcon} title="Content" badge={contentBadge}>
          <ContentPreview
            item={item}
            isSignedIn={isSignedIn}
            isLoadingAccount={isLoadingAccount}
            profile={profile}
            onSignIn={signIn}
            onSignOut={signOut}
            onSwitch={switchAccount}
          />
        </Section>

        {/* Caption Review */}
        <Section icon={FileText} title="Caption Review" badge={captionBadge}>
          <CaptionReview item={item} />
        </Section>

        {/* Flyer/GIF Review — only for OTP/PTR */}
        {!isSextingSets && (
          <Section icon={Film} title="Flyer / GIF Review" badge={
            ((item.metadata.gifUrl as string) ?? '').trim() ? (
              <span className="text-[10px] text-emerald-400 font-medium">Attached</span>
            ) : (
              <span className="text-[10px] text-amber-400 font-medium">Missing</span>
            )
          }>
            <FlyerReview item={item} />
          </Section>
        )}

        {/* Comments Thread */}
        <Section icon={MessageSquare} title="Comments" defaultOpen={false} badge={
          item.comments.length > 0 ? (
            <span className="text-[10px] text-brand-blue font-medium">{item.comments.length}</span>
          ) : undefined
        }>
          <CommentsThread comments={item.comments} itemId={item.id} getMemberName={getMemberName} />
        </Section>

        {/* QA History / Audit Log */}
        <Section icon={History} title="QA History" defaultOpen={false} badge={
          item.history.length > 0 ? (
            <span className="text-[10px] text-gray-400 font-medium">{item.history.length}</span>
          ) : undefined
        }>
          <QAHistoryLog history={item.history} getMemberName={getMemberName} />
        </Section>

        {/* QA Decision */}
        <Section icon={ClipboardList} title="QA Decision" defaultOpen={true}>
          <QADecisionBar item={item} onReviewComplete={onReviewComplete} />
        </Section>
      </div>
    </div>
  );
}

const ReviewPanel = memo(ReviewPanelComponent);
export default ReviewPanel;
