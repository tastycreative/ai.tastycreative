'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, Eye, Pencil, Trash2, Instagram, Twitter, Globe } from 'lucide-react';
import type { OfModel } from '@/lib/hooks/useOfModels.query';

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
  INACTIVE: {
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-400',
    dot: 'bg-zinc-400',
  },
  PENDING: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
  },
  ARCHIVED: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
  },
};

function getDisplayImageUrl(url: string | null): string | null {
  if (!url) return null;

  if (url.includes('drive.google.com')) {
    try {
      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      let driveId: string | null = null;

      if (fileMatch && fileMatch[1]) {
        driveId = fileMatch[1];
      } else {
        const urlObj = new URL(url);
        driveId = urlObj.searchParams.get('id');
      }

      if (driveId) {
        return `https://drive.google.com/thumbnail?id=${driveId}&sz=w400`;
      }
    } catch {
      // Fall through
    }
  }

  return url;
}

function getSocialUrl(value: string | null, platform: 'instagram' | 'twitter' | 'tiktok'): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const handle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;

  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'twitter':
      return `https://twitter.com/${handle}`;
    case 'tiktok':
      return `https://tiktok.com/@${handle}`;
    default:
      return trimmed;
  }
}

interface ModelCardProps {
  model: OfModel;
  index: number;
  onEdit: (model: OfModel) => void;
  onDelete: (model: OfModel) => void;
  setStoreSelectedModel: (model: any) => void;
}

export const ModelCard = React.memo(function ModelCard({
  model,
  index,
  onEdit,
  onDelete,
  setStoreSelectedModel,
}: ModelCardProps) {
  const imageUrl = getDisplayImageUrl(model.profileImageUrl);
  const config = statusConfig[model.status] || statusConfig.INACTIVE;

  return (
    <div
      className="group relative bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden hover:border-zinc-700/50 transition-all duration-500"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Hover Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden bg-zinc-800/50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={model.displayName}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`absolute inset-0 flex items-center justify-center ${imageUrl ? 'hidden' : ''}`}>
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 flex items-center justify-center border border-violet-500/20">
            <span className="text-4xl font-light text-white/80">
              {model.displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/20 to-transparent" />

        {/* Status Badge */}
        <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg} backdrop-blur-sm`}>
          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.text}`}>
            {model.status}
          </span>
        </div>

        {/* Quick Actions */}
        <div className="absolute top-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={() => onEdit(model)}
            className="p-2 rounded-lg bg-zinc-900/80 backdrop-blur-sm border border-zinc-700/50 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(model)}
            className="p-2 rounded-lg bg-zinc-900/80 backdrop-blur-sm border border-zinc-700/50 text-zinc-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Social Links */}
        <div className="absolute bottom-16 left-0 right-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {model.instagramUrl && (
            <a
              href={getSocialUrl(model.instagramUrl, 'instagram')!}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-zinc-900/80 backdrop-blur-sm border border-zinc-700/50 text-pink-400 hover:bg-pink-500/20 hover:border-pink-500/30 transition-all"
            >
              <Instagram className="w-4 h-4" />
            </a>
          )}
          {model.twitterUrl && (
            <a
              href={getSocialUrl(model.twitterUrl, 'twitter')!}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-zinc-900/80 backdrop-blur-sm border border-zinc-700/50 text-sky-400 hover:bg-sky-500/20 hover:border-sky-500/30 transition-all"
            >
              <Twitter className="w-4 h-4" />
            </a>
          )}
          {model.websiteUrl && (
            <a
              href={model.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-zinc-900/80 backdrop-blur-sm border border-zinc-700/50 text-zinc-400 hover:bg-zinc-500/20 hover:border-zinc-500/30 transition-all"
            >
              <Globe className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative p-4 space-y-3">
        <div>
          <Link
            href={`of-models/${model.slug}`}
            onClick={() => setStoreSelectedModel(model as any)}
            className="block"
          >
            <h3 className="text-lg font-medium text-white group-hover:text-violet-300 transition-colors truncate">
              {model.displayName}
            </h3>
          </Link>
          <p className="text-sm text-zinc-500 truncate">@{model.slug}</p>
        </div>

        <p className="text-sm text-zinc-400 line-clamp-2 min-h-[40px]">
          {model.bio || 'No bio provided'}
        </p>

        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>{new Date(model.createdAt).toLocaleDateString()}</span>
          </div>

          <Link
            href={`of-models/${model.slug}`}
            onClick={() => setStoreSelectedModel(model as any)}
            className="flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            View Profile
          </Link>
        </div>
      </div>
    </div>
  );
});
