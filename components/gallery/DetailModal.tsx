'use client';

import React, { useState } from 'react';
import {
  X, ExternalLink, Calendar, DollarSign, Eye, ShoppingCart,
  Tag, User, Copy, Check, ChevronLeft, ChevronRight, Edit2,
  Archive, BarChart3, Link2
} from 'lucide-react';
import { toast } from 'sonner';
import { CONTENT_TYPE_LABELS, PLATFORM_LABELS, type GalleryContentType, type GalleryPlatform } from '@/lib/constants/gallery';
import type { GalleryItemWithModel } from '@/types/gallery';

interface DetailModalProps {
  item: GalleryItemWithModel;
  onClose: () => void;
  onEditContentType?: () => void;
  onEditPerformance?: () => void;
  onArchive?: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function DetailModal({
  item,
  onClose,
  onEditContentType,
  onEditPerformance,
  onArchive,
  onNavigate,
  hasPrev = false,
  hasNext = false,
}: DetailModalProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '-';
    return `$${Number(amount).toFixed(2)}`;
  };

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev && onNavigate) onNavigate('prev');
      if (e.key === 'ArrowRight' && hasNext && onNavigate) onNavigate('next');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigate, hasPrev, hasNext]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Navigation Arrows */}
      {onNavigate && hasPrev && (
        <button
          onClick={() => onNavigate('prev')}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-zinc-900/80 border border-zinc-700 text-white hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {onNavigate && hasNext && (
        <button
          onClick={() => onNavigate('next')}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-zinc-900/80 border border-zinc-700 text-white hover:bg-zinc-800 transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Modal */}
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col lg:flex-row">
        {/* Image Section */}
        <div className="lg:w-1/2 bg-black flex items-center justify-center relative min-h-[300px] lg:min-h-0">
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {item.previewUrl ? (
            <img
              src={item.previewUrl}
              alt={item.title || 'Preview'}
              className={`max-w-full max-h-[90vh] object-contain transition-opacity ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              <Tag className="w-16 h-16" />
            </div>
          )}

          {/* Image Actions Overlay */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <a
              href={item.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={() => copyToClipboard(item.previewUrl, 'URL')}
              className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
              title="Copy URL"
            >
              {copied === 'URL' ? <Check className="w-4 h-4 text-emerald-400" /> : <Link2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Details Section */}
        <div className="lg:w-1/2 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-800">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-medium text-white truncate">
                {item.title || 'Untitled Content'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-violet-500/20 text-violet-400">
                  {CONTENT_TYPE_LABELS[item.contentType as GalleryContentType] || item.contentType}
                </span>
                <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/20 text-blue-400">
                  {PLATFORM_LABELS[item.platform as GalleryPlatform] || item.platform}
                </span>
                {item.isArchived && (
                  <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-700 text-zinc-400">
                    Archived
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Model Info */}
            {item.model && (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-800/50">
                {item.model.profileImageUrl ? (
                  <img
                    src={item.model.profileImageUrl}
                    alt={item.model.displayName || item.model.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-zinc-700"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border-2 border-zinc-700 flex items-center justify-center">
                    <User className="w-5 h-5 text-violet-400" />
                  </div>
                )}
                <div>
                  <p className="text-white font-medium">{item.model.displayName || item.model.name}</p>
                  <p className="text-sm text-zinc-500">Model</p>
                </div>
              </div>
            )}

            {/* Performance Stats */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Performance</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-zinc-800/50">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase">Revenue</span>
                  </div>
                  <p className="text-2xl font-semibold text-white">
                    {formatCurrency(Number(item.revenue))}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-800/50">
                  <div className="flex items-center gap-2 text-blue-400 mb-1">
                    <ShoppingCart className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase">Sales</span>
                  </div>
                  <p className="text-2xl font-semibold text-white">
                    {item.salesCount || 0}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-800/50">
                  <div className="flex items-center gap-2 text-violet-400 mb-1">
                    <Eye className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase">Views</span>
                  </div>
                  <p className="text-2xl font-semibold text-white">
                    {item.viewCount?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-800/50">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <BarChart3 className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase">Conv. Rate</span>
                  </div>
                  <p className="text-2xl font-semibold text-white">
                    {item.conversionRate ? `${(Number(item.conversionRate) * 100).toFixed(1)}%` : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Details</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
                  <span className="text-zinc-500 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Posted
                  </span>
                  <span className="text-zinc-300">{formatDate(item.postedAt)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
                  <span className="text-zinc-500 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Price
                  </span>
                  <span className="text-zinc-300">{formatCurrency(Number(item.pricingAmount))}</span>
                </div>
                {item.origin && (
                  <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
                    <span className="text-zinc-500">Origin</span>
                    <span className="text-zinc-300 capitalize">{item.origin}</span>
                  </div>
                )}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex items-start justify-between py-2 border-b border-zinc-800/50">
                    <span className="text-zinc-500 flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Tags
                    </span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {item.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md text-xs bg-zinc-800 text-zinc-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Caption */}
            {item.captionUsed && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Caption</h3>
                  <button
                    onClick={() => copyToClipboard(item.captionUsed!, 'Caption')}
                    className="text-xs text-zinc-500 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    {copied === 'Caption' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    Copy
                  </button>
                </div>
                <p className="text-sm text-zinc-400 p-4 rounded-xl bg-zinc-800/50 whitespace-pre-wrap">
                  {item.captionUsed}
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center gap-2 p-6 border-t border-zinc-800 bg-zinc-900/80">
            {onEditContentType && (
              <button
                onClick={onEditContentType}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
              >
                <Tag className="w-4 h-4" />
                Edit Type
              </button>
            )}
            {onEditPerformance && (
              <button
                onClick={onEditPerformance}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Edit Stats
              </button>
            )}
            {onArchive && (
              <button
                onClick={onArchive}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
              >
                <Archive className="w-4 h-4" />
                {item.isArchived ? 'Unarchive' : 'Archive'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
