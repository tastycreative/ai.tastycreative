'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import { Play, ExternalLink, FileVideo, FileImage, ChevronLeft, ChevronRight, Link2, CheckCircle, ShieldCheck, FolderOpen, LogIn, LogOut, RefreshCw, Lock, AlertTriangle } from 'lucide-react';
import { QueueTicket, ContentItemData } from './types';
import { useGoogleDriveAccount, type GoogleDriveProfile } from '@/lib/hooks/useGoogleDriveAccount';

/* ── Google Drive helpers ──────────────────────────────────────────── */

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

function toPreviewUrl(url: string): string {
  if (url.includes('/preview')) return url;
  const id = extractDriveFileId(url);
  if (!id) return url;
  return `https://drive.google.com/file/d/${id}/preview`;
}

function toViewUrl(url: string): string {
  if (url.includes('/preview')) return url.replace('/preview', '/view');
  return url;
}

function isDriveFolder(url: string): boolean {
  return url.includes('/folders/');
}

/**
 * Google Drive thumbnail URL — uses the browser's Google session cookies.
 * Works for any file the browser's signed-in Google account can access.
 * Size: s120 = 120px on longest edge (cheap, fast).
 */
function toDriveThumbnailUrl(url: string, size = 120): string | null {
  const id = extractDriveFileId(url);
  if (!id) return null;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=s${size}`;
}

/** Thumbnail img that falls back to a placeholder icon on error (no access / private). */
function DriveThumbnail({ url, alt, className }: { url: string; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const thumbUrl = toDriveThumbnailUrl(url);

  if (!thumbUrl || failed) {
    return (
      <div className={`bg-gray-800 flex items-center justify-center ${className ?? ''}`}>
        <Link2 size={14} className="text-brand-mid-pink" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumbUrl}
      alt={alt ?? ''}
      className={`object-cover ${className ?? ''}`}
      onError={() => setFailed(true)}
    />
  );
}

function IframeSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900 animate-pulse">
      <div className="w-12 h-12 rounded-xl bg-gray-700" />
      <div className="h-3 w-32 rounded bg-gray-700" />
      <div className="h-2 w-24 rounded bg-gray-800" />
    </div>
  );
}

/* ── Google Account Bar ────────────────────────────────────────────── */

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
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Sign in with Google to view Drive content
        </span>
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
        <button
          onClick={onSwitch}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-brand-mid-pink hover:bg-brand-mid-pink/10 transition-colors"
        >
          <RefreshCw size={10} /> Switch
        </button>
        <button
          onClick={onSignOut}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <LogOut size={10} /> Sign out
        </button>
      </div>
    </div>
  );
}
/* ── Drive Folder Browser ──────────────────────────────────────────── */

type FolderFile = { id: string; name: string; mimeType: string; size: number | null; thumbnailLink?: string | null };
type FolderLoadState = 'loading' | 'ok' | 'no_access' | 'auth_error' | 'error';

/** Grid thumbnail card — mirrors Google Drive's grid/embeddedfolderview aesthetic. */
function FolderGridCard({ file, onClick }: { file: FolderFile; onClick: () => void }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const isVideo = file.mimeType.startsWith('video/');
  const isImage = file.mimeType.startsWith('image/');
  const Icon = isVideo ? FileVideo : isImage ? FileImage : FileVideo;
  const iconColor = isVideo ? 'text-brand-blue' : isImage ? 'text-emerald-400' : 'text-gray-400';

  // Proxy thumbnails through our server-side endpoint which uses the OAuth token.
  // Direct thumbnailLink URLs (lh3.googleusercontent.com) require browser Google cookies,
  // which may belong to a different account than the OAuth-signed-in one.
  const thumb = !thumbFailed ? `/api/google-drive/thumbnail?fileId=${encodeURIComponent(file.id)}` : null;

  return (
    <button
      onClick={onClick}
      className="group flex flex-col rounded-lg overflow-hidden border border-white/[0.06] hover:border-white/[0.14] bg-[#1e1e20] hover:bg-[#26262a] transition-all duration-150 text-left"
    >
      {/* Thumbnail area — same proportions as Drive grid cells */}
      <div className="relative w-full aspect-[4/3] flex items-center justify-center bg-[#17171a] overflow-hidden">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <Icon size={32} className={`${iconColor} opacity-60`} />
        )}
        {/* Play overlay for videos */}
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
            <div className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center">
              <Play size={16} className="text-white ml-0.5" fill="white" />
            </div>
          </div>
        )}
      </div>
      {/* Filename row */}
      <div className="px-2 py-1.5 flex items-center gap-1.5 min-w-0">
        <Icon size={12} className={`${iconColor} shrink-0`} />
        <span className="text-[11px] text-gray-300 truncate group-hover:text-white leading-tight">{file.name}</span>
      </div>
    </button>
  );
}

/**
 * Lists and previews a Google Drive folder using the stored OAuth token
 * (gdrive_access_token cookie) via the server-side /api/google-drive/fetch-link
 * endpoint. Never uses the browser's Google session — avoids the "You need access"
 * error caused by a mismatch between the OAuth-signed-in account and the
 * browser's active Google account.
 */
function DriveFolderBrowser({ url, viewUrl, onSignIn }: {
  url: string;
  viewUrl: string;
  onSignIn?: () => void;
}) {
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
      <div className="w-full h-full bg-[#17171a] rounded-lg overflow-hidden">
        {/* Grid skeleton — mirrors Drive's loading appearance */}
        <div className="p-3 grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
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
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gray-900/40 rounded-lg p-8">
        <div className="w-14 h-14 rounded-full bg-yellow-900/40 flex items-center justify-center">
          <LogIn size={24} className="text-yellow-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-200">Session expired</p>
          <p className="text-xs text-gray-500 mt-1">Your sign-in session has expired. Please sign in again.</p>
        </div>
        {onSignIn && (
          <button onClick={onSignIn} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-800 hover:bg-gray-100 transition-colors shadow-sm">
            <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
        )}
      </div>
    );
  }

  if (status === 'no_access') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gray-900/40 rounded-lg p-8">
        <div className="w-14 h-14 rounded-full bg-red-900/40 flex items-center justify-center">
          <Lock size={24} className="text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-200">No access to this folder</p>
          <p className="text-xs text-gray-500 mt-1">The signed-in account doesn&apos;t have permission to view this folder</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={viewUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-mid-pink hover:bg-brand-dark-pink transition-colors">
            <ExternalLink size={12} /> Request access in Drive
          </a>
          {onSignIn && (
            <button onClick={onSignIn}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">
              <RefreshCw size={12} /> Switch account
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gray-900/40 rounded-lg p-8">
        <div className="w-14 h-14 rounded-full bg-amber-900/40 flex items-center justify-center">
          <AlertTriangle size={24} className="text-amber-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-200">Failed to load folder</p>
          <p className="text-xs text-gray-500 mt-1">Couldn&apos;t list this folder&apos;s contents.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRetryKey(k => k + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-mid-pink hover:bg-brand-dark-pink transition-colors">
            <RefreshCw size={12} /> Retry
          </button>
          <a href={viewUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">
            <ExternalLink size={12} /> Open in Drive
          </a>
        </div>
      </div>
    );
  }

  // ── File selected — full preview via stream proxy ──────────────────
  if (selected) {
    const isImage = selected.mimeType.startsWith('image/');
    // Images: add ?full=1 so the stream route skips Range injection.
    // Without it the route returns 206 Partial Content which breaks the browser's
    // image decoder for files larger than the 2 MB initial chunk.
    const streamUrl = `/api/google-drive/stream?fileId=${encodeURIComponent(selected.id)}${isImage ? '&full=1' : ''}`;
    return (
      <div className="relative w-full h-full flex flex-col bg-[#17171a] rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-[#1e1e20] border-b border-white/[0.06] shrink-0">
          <button onClick={() => setSelected(null)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-300 hover:text-white hover:bg-white/[0.06] transition-colors">
            <ChevronLeft size={12} /> Back
          </button>
          <span className="text-xs text-gray-400 truncate flex-1">{selected.name}</span>
          <a href={`https://drive.google.com/file/d/${selected.id}/view`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors shrink-0">
            <ExternalLink size={10} /> Open
          </a>
        </div>
        <div className="relative flex-1 flex items-center justify-center bg-black/60">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={streamUrl} alt={selected.name} className="max-w-full max-h-full object-contain" />
          ) : (
            <video src={streamUrl} controls className="max-w-full max-h-full" preload="auto" />
          )}
        </div>
      </div>
    );
  }

  // ── Thumbnail grid (Drive embeddedfolderview aesthetic) ────────────
  if (files.length === 0) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center gap-4 bg-[#17171a] rounded-lg p-8">
        <FolderOpen className="w-12 h-12 text-gray-600" />
        <p className="text-sm text-gray-400">This folder is empty</p>
        <a href={viewUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-white/[0.06] hover:bg-white/[0.10] transition-colors">
          <ExternalLink className="w-3 h-3" /> Open in Drive
        </a>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-[#17171a] rounded-lg overflow-hidden">
      {/* Top bar — mirrors Drive's folder view header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1e1e20] border-b border-white/[0.06] shrink-0">
        <FolderOpen size={13} className="text-[#faad14] shrink-0" />
        <span className="text-xs text-gray-300 font-medium flex-1">{files.length} item{files.length !== 1 ? 's' : ''}</span>
        <a href={viewUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
          <ExternalLink size={10} /> Open in Drive
        </a>
      </div>
      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-3 gap-2">
          {files.map((file) => (
            <FolderGridCard key={file.id} file={file} onClick={() => setSelected(file)} />
          ))}
        </div>
      </div>
    </div>
  );
}
/**
 * Renders Google Drive content.
 * When signed in: streams via server-side proxy (drive.readonly token) — proper access control.
 * When not signed in: shows a sign-in prompt (no iframe leak via browser cookies).
 * When signed in but no access: shows a clear “No access” overlay.
 */
function DrivePreview({ url, label, isSignedIn, fileType, onSignIn }: {
  url: string;
  label?: string;
  isSignedIn?: boolean;
  fileType?: string;
  onSignIn?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'checking' | 'ok' | 'no_token' | 'no_access' | 'stream_error' | 'error'>('checking');
  const [retryKey, setRetryKey] = useState(0);

  const viewUrl = toViewUrl(url);
  const fileId = extractDriveFileId(url);
  const streamUrl = isSignedIn && fileId ? `/api/google-drive/stream?fileId=${encodeURIComponent(fileId)}` : null;

  // Pre-flight ping: validates the user token against Drive before mounting the
  // media element. This prevents the service-account fallback from silently
  // serving content when the signed-in account's cookie is missing or belongs
  // to a different account than the one shown in the account bar.
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

  // ── Folders — use server-side OAuth listing (never uses browser session) ─
  // The old drive.google.com/embeddedfolderview iframe used browser cookies,
  // causing "You need access" when the browser's Google account differed from
  // the OAuth-signed-in account. DriveFolderBrowser uses /api/google-drive/fetch-link
  // which reads the gdrive_access_token cookie set during OAuth sign-in.
  if (isDriveFolder(url)) {
    if (!isSignedIn) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gray-900/40 rounded-lg p-8">
          <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center">
            <FolderOpen size={24} className="text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-200">Sign in to view this folder</p>
            <p className="text-xs text-gray-500 mt-1">Connect your Google account to browse this Drive folder</p>
          </div>
          {onSignIn && (
            <button onClick={onSignIn}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-800 hover:bg-gray-100 transition-colors shadow-sm">
              <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>
          )}
        </div>
      );
    }
    return <DriveFolderBrowser url={url} viewUrl={viewUrl} onSignIn={onSignIn} />;
  }

  // ── Not signed in — show prompt, never leak content via browser cookies ─
  if (!isSignedIn) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gray-900/40 rounded-lg p-8">
        <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center">
          <LogIn size={24} className="text-gray-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-200">Sign in to view Drive content</p>
          <p className="text-xs text-gray-500 mt-1">Connect your Google account to access this file</p>
        </div>
        {onSignIn && (
          <button
            onClick={onSignIn}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-800 hover:bg-gray-100 transition-colors shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
        )}
      </div>
    );
  }

  // ── Stream proxy (signed in — uses drive.readonly OAuth token) ────
  if (streamUrl) {
    // Waiting for ping result
    if (streamStatus === 'checking') {
      return <div className="relative w-full h-full"><IframeSkeleton /></div>;
    }
    // Token missing or expired — profile exists but cookie is gone/stale
    if (streamStatus === 'no_token') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gray-900/40 rounded-lg p-8">
          <div className="w-14 h-14 rounded-full bg-yellow-900/40 flex items-center justify-center">
            <LogIn size={24} className="text-yellow-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-200">Session expired</p>
            <p className="text-xs text-gray-500 mt-1">Your sign-in session has expired. Please sign in again.</p>
          </div>
          {onSignIn && (
            <button
              onClick={onSignIn}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-800 hover:bg-gray-100 transition-colors shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>
          )}
        </div>
      );
    }
    // Has token but no permission for this file
    if (streamStatus === 'no_access') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gray-900/40 rounded-lg p-8">
          <div className="w-14 h-14 rounded-full bg-red-900/40 flex items-center justify-center">
            <Lock size={24} className="text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-200">No access to this file</p>
            <p className="text-xs text-gray-500 mt-1">The signed-in account doesn&apos;t have permission to view this file</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={viewUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-mid-pink hover:bg-brand-dark-pink transition-colors">
              <ExternalLink size={12} /> Request access in Drive
            </a>
            {onSignIn && (
              <button onClick={onSignIn}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">
                <RefreshCw size={12} /> Switch account
              </button>
            )}
          </div>
        </div>
      );
    }
    // Stream/loading error — ping passed but media failed to load
    if (streamStatus === 'stream_error') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gray-900/40 rounded-lg p-8">
          <div className="w-14 h-14 rounded-full bg-amber-900/40 flex items-center justify-center">
            <AlertTriangle size={24} className="text-amber-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-200">Failed to load media</p>
            <p className="text-xs text-gray-500 mt-1">The file couldn&apos;t be streamed. Try refreshing or open directly in Drive.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRetryKey(k => k + 1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-mid-pink hover:bg-brand-dark-pink transition-colors"
            >
              <RefreshCw size={12} /> Retry
            </button>
            <a href={viewUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">
              <ExternalLink size={12} /> Open in Drive
            </a>
          </div>
        </div>
      );
    }
    // Token is valid and has access — mount the media element
    const isImage = fileType === 'image';
    return (
      <div className="relative w-full h-full flex flex-col">
        {!loaded && <IframeSkeleton />}
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${streamUrl}|${retryKey}`}
            src={streamUrl}
            alt={label ?? ''}
            className="flex-1 w-full h-full object-contain"
            style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }}
            onLoad={() => setLoaded(true)}
            onError={() => { setLoaded(true); setStreamStatus('stream_error'); }}
          />
        ) : (
          <video
            key={`${streamUrl}|${retryKey}`}
            src={streamUrl}
            controls
            className="flex-1 w-full h-full bg-black rounded-lg"
            style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }}
            preload="auto"
            onLoadedMetadata={() => setLoaded(true)}
            onError={() => { setLoaded(true); setStreamStatus('stream_error'); }}
          />
        )}
        <a href={viewUrl} target="_blank" rel="noopener noreferrer"
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-black/60 hover:bg-black/80 backdrop-blur-sm transition-colors">
          <ExternalLink className="w-3 h-3" /> Open in Drive
        </a>
      </div>
    );
  }

  // ── Signed in but fileId couldn’t be extracted (unusual URL format) ─
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gray-900/40 rounded-lg p-8">
      <p className="text-sm text-gray-400">Could not load Drive file preview.</p>
      <a href={viewUrl} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-black/60 hover:bg-black/80 transition-colors">
        <ExternalLink size={12} /> Open in Drive
      </a>
    </div>
  );
}

/* ── Per-item media renderer ───────────────────────────────────────── */

/** Renders a single content item (image / video / drive) with a
 *  fade-in + skeleton so nothing lingers when switching tickets. */
function MediaItem({ item, description, isSignedIn, onSignIn, accountKey }: { item: ContentItemData; description: string; isSignedIn?: boolean; onSignIn?: () => void; accountKey?: string }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setLoaded(false); }, [item.url]);

  const isGdrive = item.sourceType === 'gdrive';
  const isImage = item.fileType === 'image' || (!item.fileType && !isGdrive && !!item.url.match(/\.(jpg|jpeg|png|gif|webp)/i));

  if (isGdrive) {
    return <DrivePreview key={`${item.url}|${accountKey ?? ''}`} url={item.url} label={item.fileName ?? undefined} isSignedIn={isSignedIn} fileType={item.fileType ?? undefined} onSignIn={onSignIn} />;
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
  const driveAccount = useGoogleDriveAccount();
  const { profile, isSignedIn, isLoading, signIn, signOut, switchAccount } = driveAccount;

  // Determine if the current ticket uses Google Drive content
  const hasDriveContent = ticket && (
    ticket.contentSourceType === 'gdrive' ||
    ticket.contentItems?.some(i => i.sourceType === 'gdrive')
  );

  const handleSignIn = useCallback(() => { signIn().catch(() => {}); }, [signIn]);
  const handleSwitch = useCallback(() => { switchAccount().catch(() => {}); }, [switchAccount]);

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
          {/* Google Account Bar — only for Drive content */}
          {hasDriveContent && (
            <GoogleAccountBar
              profile={profile}
              isSignedIn={isSignedIn}
              isLoading={isLoading}
              onSignIn={handleSignIn}
              onSignOut={signOut}
              onSwitch={handleSwitch}
            />
          )}

          {/* Main viewer */}
          <div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-0">
            <MediaItem item={item} description={ticket.description} isSignedIn={isSignedIn} onSignIn={handleSignIn} accountKey={profile?.email} />

          {/* Item badge — hidden for Drive folders (DriveFolderBrowser has its own toolbar) */}
          {!(isGdrive && item.url.includes('/folders/')) && (
            <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-white text-xs flex items-center gap-1.5">
              {isImage ? <FileImage size={11} /> : isGdrive ? <Link2 size={11} /> : <FileVideo size={11} />}
              {selectedItemIndex + 1} / {items.length}
            </div>
          )}

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
              const isDriveItem = thumb.sourceType === 'gdrive';
              const isSelected = i === selectedItemIndex;
              const canShowThumb = thumbIsImage && !isDriveItem;
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
                  {canShowThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb.url} alt={`item ${i + 1}`} className="w-full h-full object-cover" />
                  ) : isDriveItem ? (
                    <DriveThumbnail url={thumb.url} alt={`item ${i + 1}`} className="w-full h-full" />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      {thumb.fileType === 'image'
                        ? <FileImage size={14} className="text-brand-mid-pink" />
                        : <FileVideo size={14} className="text-brand-mid-pink" />}
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
    <div className="h-full flex flex-col bg-brand-off-white dark:bg-gray-800 border-b border-brand-mid-pink/20 overflow-hidden">
        {/* Google Account Bar — only for Drive content */}
        {hasDriveContent && (
          <GoogleAccountBar
            profile={profile}
            isSignedIn={isSignedIn}
            isLoading={isLoading}
            onSignIn={handleSignIn}
            onSignOut={signOut}
            onSwitch={handleSwitch}
          />
        )}
        <div className="flex-1 relative flex items-center justify-center min-h-0">
          {hasContent ? (
            <>
              {isGoogleDrive ? (
                <DrivePreview key={`${contentUrl}|${profile?.email ?? ''}`} url={contentUrl || ''} isSignedIn={isSignedIn} onSignIn={handleSignIn} />
              ) : isVideo ? (
                <video src={contentUrl || ''} controls className="max-w-full max-h-full rounded-lg shadow-xl" preload="metadata">
                  Your browser does not support the video tag.
                </video>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
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
      </div>
  );
}

export default memo(ContentViewerComponent);
