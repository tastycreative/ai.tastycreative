'use client';

import React from 'react';
import { useInView } from 'react-intersection-observer';
import { DollarSign, Eye, ShoppingCart, Calendar, BarChart3, Trash2, MoreVertical, Tag, Film, Images } from 'lucide-react';
import { CONTENT_TYPE_LABELS, PLATFORM_LABELS, type GalleryContentType, type GalleryPlatform } from '@/lib/constants/gallery';
import type { GalleryItemWithModel, GalleryBoardMetadata } from '@/types/gallery';
import { GifThumbnail } from './GifThumbnail';

interface GalleryItemProps {
  item: GalleryItemWithModel;
  onClick?: (item: GalleryItemWithModel) => void;
  onEdit?: (item: GalleryItemWithModel) => void;
  onEditType?: (item: GalleryItemWithModel) => void;
  onPerformance?: (item: GalleryItemWithModel) => void;
  onArchive?: (item: GalleryItemWithModel) => void;
  gifsPlaying?: boolean;
  /** Delay in ms before this card starts loading its thumbnail (for staggering) */
  loadDelay?: number;
}

const contentTypeColors: Record<string, string> = {
  SOLO_DILDO: 'bg-pink-500/20 text-pink-400',
  SOLO_FINGERS: 'bg-pink-500/20 text-pink-400',
  SOLO_VIBRATOR: 'bg-pink-500/20 text-pink-400',
  BG: 'bg-purple-500/20 text-purple-400',
  GG: 'bg-fuchsia-500/20 text-fuchsia-400',
  GGG: 'bg-fuchsia-500/20 text-fuchsia-400',
  BGG: 'bg-violet-500/20 text-violet-400',
  BBG: 'bg-violet-500/20 text-violet-400',
  ORGY: 'bg-red-500/20 text-red-400',
  BJ: 'bg-orange-500/20 text-orange-400',
  JOI: 'bg-amber-500/20 text-amber-400',
  ANAL_SOLO: 'bg-rose-500/20 text-rose-400',
  ANAL_BG: 'bg-rose-500/20 text-rose-400',
  ANAL_BUTT_PLUG: 'bg-rose-500/20 text-rose-400',
  SQUIRTING: 'bg-cyan-500/20 text-cyan-400',
  CREAM_PIE: 'bg-orange-500/20 text-orange-400',
  DICK_RATING: 'bg-indigo-500/20 text-indigo-400',
  LIVES: 'bg-green-500/20 text-green-400',
  CUSTOM: 'bg-blue-500/20 text-blue-400',
  OTHER: 'bg-zinc-500/20 text-zinc-400',
};

const platformColors: Record<string, string> = {
  OF: 'bg-sky-500/20 text-sky-400',
  FANSLY: 'bg-indigo-500/20 text-indigo-400',
  IG: 'bg-pink-500/20 text-pink-400',
  TWITTER: 'bg-blue-500/20 text-blue-400',
  TIKTOK: 'bg-zinc-500/20 text-zinc-300',
  FANVUE: 'bg-purple-500/20 text-purple-400',
  OTHER: 'bg-zinc-500/20 text-zinc-400',
};

const postOriginColors: Record<string, string> = {
  OTP: 'bg-cyan-500/20 text-cyan-400',
  PTR: 'bg-amber-500/20 text-amber-400',
  PPV: 'bg-emerald-500/20 text-emerald-400',
  GAME: 'bg-yellow-500/20 text-yellow-400',
  LIVE: 'bg-red-500/20 text-red-400',
  TIP_ME: 'bg-green-500/20 text-green-400',
  VIP: 'bg-violet-500/20 text-violet-400',
  OTM: 'bg-teal-500/20 text-teal-400',
  DM_FUNNEL: 'bg-orange-500/20 text-orange-400',
  RENEW_ON: 'bg-lime-500/20 text-lime-400',
  CUSTOM: 'bg-zinc-500/20 text-zinc-400',
};

const TIER_LABELS: Record<string, string> = {
  PORN_ACCURATE: 'Porn Accurate',
  PORN_SCAM: 'Porn Scam',
  GF_ACCURATE: 'GF Accurate',
  GF_SCAM: 'GF Scam',
};

const isValidUrl = (url: string | null | undefined) =>
  !!url && (url.startsWith('http') || url.startsWith('/api/')) && url !== '/placeholder-gallery.png';

/* ── Google Drive URL helpers ──────────────────────────────── */
function extractDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)\//,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

function isDriveUrl(url: string): boolean {
  return url.includes('drive.google.com') || url.includes('lh3.googleusercontent.com/d/');
}

function toDisplayUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  if (isDriveUrl(url)) {
    const id = extractDriveFileId(url);
    if (id) return `/api/google-drive/stream?fileId=${encodeURIComponent(id)}`;
  }
  return url;
}

export function GalleryItem({ item, onClick, onEdit, onEditType, onPerformance, onArchive, gifsPlaying = false, loadDelay = 0 }: GalleryItemProps) {
  // triggerOnce observer: once card scrolls into viewport region, start loading its thumbnail
  const { ref: loadRef, inView: rawInView } = useInView({ triggerOnce: true, rootMargin: '200px 0px' });
  // Continuous observer: track whether card is currently visible (for GIF playback gating)
  const { ref: visRef, inView: visibleNow } = useInView({ threshold: 0.1 });
  const [showMenu, setShowMenu] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  // Merge both refs onto the card element
  const cardRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      loadRef(node);
      visRef(node);
    },
    [loadRef, visRef],
  );

  const inView = rawInView;

  const revenue = Number(item.revenue) || 0;
  const salesCount = item.salesCount || 0;
  const viewCount = item.viewCount || 0;
  const price = item.pricingAmount ? Number(item.pricingAmount) : null;

  const contentTypeLabel = CONTENT_TYPE_LABELS[item.contentType as GalleryContentType] || item.contentType;
  const platformLabel = PLATFORM_LABELS[item.platform as GalleryPlatform] || item.platform;
  const contentTypeColor = contentTypeColors[item.contentType] || contentTypeColors.OTHER;
  const platformColor = platformColors[item.platform] || platformColors.OTHER;
  const boardMeta = (item.boardMetadata ?? null) as GalleryBoardMetadata | null;
  const gifUrl = boardMeta?.gifUrl || boardMeta?.gifUrlFansly || null;
  const resolvedThumb = boardMeta?.resolvedThumbnailUrl || null;
  const resolvedThumbIsGif = boardMeta?.resolvedThumbnailIsGif === 'true';
  const mediaItemCount = boardMeta?.mediaItems?.length ?? 0;

  // Category placeholder SVGs are valid thumbnail sources (not http but local paths)
  const isPlaceholderSvg = resolvedThumb?.startsWith('/gallery-placeholder-') ?? false;

  return (
    <div
      ref={cardRef}
      className={`group relative bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden hover:border-zinc-700/50 transition-all duration-300 ${onClick ? 'cursor-pointer' : ''}`}
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 400px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick?.(item)}
    >
      {/* Hover Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Preview Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-800/50">
        {isValidUrl(gifUrl) && !imgError ? (
          <GifThumbnail
            src={gifUrl!}
            alt={item.title || 'Gallery item'}
            playing={gifsPlaying || hovered}
            inView={inView}
            visibleNow={visibleNow}
            className="transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : isValidUrl(item.previewUrl) && !imgError && !resolvedThumbIsGif ? (
          inView ? (
            <img
              src={toDisplayUrl(item.previewUrl) ?? item.previewUrl!}
              alt={item.title || 'Gallery item'}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full bg-zinc-800/50 animate-pulse" />
          )
        ) : isValidUrl(resolvedThumb) && !imgError ? (
          resolvedThumbIsGif ? (
            <GifThumbnail
              src={resolvedThumb!}
              alt={item.title || 'Gallery item'}
              playing={gifsPlaying || hovered}
              inView={inView}
              visibleNow={visibleNow}
              className="transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : inView ? (
            <img
              src={resolvedThumb!}
              alt={item.title || 'Gallery item'}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full bg-zinc-800/50 animate-pulse" />
          )
        ) : isPlaceholderSvg ? (
          <img
            src={resolvedThumb!}
            alt={item.postOrigin || item.title || 'Gallery item'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-zinc-800/80 to-zinc-900/80">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-light-pink/20 to-brand-blue/20 flex items-center justify-center border border-white/[0.06]">
              <BarChart3 className="w-7 h-7 text-brand-light-pink/60" />
            </div>
            <span className="text-[11px] text-zinc-500 font-medium">{item.title || 'No Preview'}</span>
          </div>
        )}

        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />

        {/* Content count badge (Wall Post multi-media) */}
        {mediaItemCount >= 2 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-white/10">
            <Images className="w-3 h-3 text-brand-light-pink" />
            <span className="text-[10px] font-semibold text-white leading-none">{mediaItemCount}</span>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
          <div className="flex flex-wrap gap-1.5">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${contentTypeColor}`}>
              {contentTypeLabel}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${platformColor}`}>
              {platformLabel}
            </span>
            {item.postOrigin && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${postOriginColors[item.postOrigin] || postOriginColors.CUSTOM}`}>
                {item.postOrigin.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {/* Menu */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg bg-zinc-900/80 backdrop-blur-sm border border-zinc-700/50 text-zinc-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-36 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-20 py-1">
                  {onPerformance && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onPerformance(item);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Edit Stats
                    </button>
                  )}
                  {onEditType && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onEditType(item);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                    >
                      <Tag className="w-4 h-4" />
                      Edit Type
                    </button>
                  )}
                  {onEdit && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onEdit(item);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                  )}
                  {onArchive && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onArchive(item);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Price Badge */}
        {price !== null && price > 0 && (
          <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/30">
            <span className="text-sm font-semibold text-emerald-400">${price.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative p-4 space-y-3">
        {/* Model Info — from Instagram profile */}
        {(() => {
          const displayName = item.profile?.name ?? null;
          const avatarUrl = item.profile?.profileImageUrl ?? null;
          if (!displayName) return null;
          return (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 flex items-center justify-center shrink-0 overflow-hidden">
                {isValidUrl(avatarUrl) ? (
                  <img
                    src={avatarUrl!}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = `<span class="text-xs font-medium text-white/80">${displayName.charAt(0)}</span>`;
                    }}
                  />
                ) : (
                  <span className="text-xs font-medium text-white/80">
                    {displayName.charAt(0)}
                  </span>
                )}
              </div>
              <span className="text-sm text-zinc-400 truncate">{displayName}</span>
            </div>
          );
        })()}

        {/* Content Info */}
        {(item.pricingTier || boardMeta?.contentLength || boardMeta?.contentCount) && (
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            {item.pricingTier && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">
                {TIER_LABELS[item.pricingTier] || item.pricingTier}
              </span>
            )}
            {boardMeta?.contentCount && (
              <span className="flex items-center gap-1 text-zinc-400">
                <Images className="w-3 h-3" />
                {boardMeta.contentCount}
              </span>
            )}
            {boardMeta?.contentLength && (
              <span className="flex items-center gap-1 text-zinc-400">
                <Film className="w-3 h-3" />
                {boardMeta.contentLength}
              </span>
            )}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center p-2 rounded-lg bg-zinc-800/50">
            <div className="flex items-center gap-1 text-emerald-400">
              <DollarSign className="w-3.5 h-3.5" />
              <span className="text-sm font-semibold">{revenue > 0 ? `$${revenue.toFixed(0)}` : '-'}</span>
            </div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Revenue</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-zinc-800/50">
            <div className="flex items-center gap-1 text-blue-400">
              <ShoppingCart className="w-3.5 h-3.5" />
              <span className="text-sm font-semibold">{salesCount > 0 ? salesCount : '-'}</span>
            </div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Sales</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-zinc-800/50">
            <div className="flex items-center gap-1 text-purple-400">
              <Eye className="w-3.5 h-3.5" />
              <span className="text-sm font-semibold">{viewCount > 0 ? viewCount : '-'}</span>
            </div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Views</span>
          </div>
        </div>

        {/* Posted Date */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>Posted {new Date(item.postedAt).toLocaleDateString()}</span>
        </div>
      </div>


    </div>
  );
}
