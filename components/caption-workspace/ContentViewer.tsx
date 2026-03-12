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

function toFolderEmbedUrl(url: string): string | null {
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (!m?.[1]) return null;
  return `https://drive.google.com/embeddedfolderview?id=${m[1]}#grid`;
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

  // ── Folders — always use embed iframe (can't stream folder listings) ─
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
            allow="autoplay; encrypted-media"
            allowFullScreen
            onLoad={() => setLoaded(true)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <FolderOpen className="w-12 h-12 text-blue-400" />
            <p className="text-sm text-gray-400">{label ?? 'Google Drive Folder'}</p>
          </div>
        )}
        <a href={viewUrl} target="_blank" rel="noopener noreferrer"
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-black/60 hover:bg-black/80 backdrop-blur-sm transition-colors">
          <ExternalLink className="w-3 h-3" /> Open in Drive
        </a>
      </div>
    );
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
            preload="metadata"
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
