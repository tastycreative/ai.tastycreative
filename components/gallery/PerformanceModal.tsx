'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, BarChart3, DollarSign, ShoppingCart, Eye, Percent } from 'lucide-react';
import { toast } from 'sonner';
import type { GalleryItemWithModel } from '@/types/gallery';

interface PerformanceModalProps {
  item: GalleryItemWithModel;
  onClose: () => void;
  onSuccess: () => void;
}

export function PerformanceModal({ item, onClose, onSuccess }: PerformanceModalProps) {
  const [revenue, setRevenue] = useState(String(Number(item.revenue) || ''));
  const [salesCount, setSalesCount] = useState(String(item.salesCount || ''));
  const [viewCount, setViewCount] = useState(String(item.viewCount || ''));
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);

      const response = await fetch(`/api/gallery/${item.id}/performance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revenue: revenue ? parseFloat(revenue) : 0,
          salesCount: salesCount ? parseInt(salesCount, 10) : 0,
          viewCount: viewCount ? parseInt(viewCount, 10) : 0,
        }),
      });

      if (response.ok) {
        toast.success('Performance metrics updated');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update metrics');
      }
    } catch (error) {
      console.error('Error updating performance:', error);
      toast.error('Failed to update metrics');
    } finally {
      setSaving(false);
    }
  };

  // Calculate conversion rate
  const views = parseInt(viewCount, 10) || 0;
  const sales = parseInt(salesCount, 10) || 0;
  const conversionRate = views > 0 ? ((sales / views) * 100).toFixed(2) : '0.00';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl animate-fadeIn overflow-hidden">
        {/* Header Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />

        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-medium text-white">Update Performance</h2>
                <p className="text-sm text-zinc-500 mt-0.5">Track revenue and engagement</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-xl">
            {item.previewUrl ? (
              <img
                src={item.previewUrl}
                alt="Preview"
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-zinc-700 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-zinc-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {item.title || item.contentType}
              </p>
              {item.model && (
                <p className="text-xs text-zinc-500 truncate">{item.model.displayName}</p>
              )}
              <p className="text-xs text-zinc-600">
                Posted {new Date(item.postedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Revenue */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Revenue (USD)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Sales Count */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-2">
              <ShoppingCart className="w-4 h-4 text-blue-400" />
              Sales Count
            </label>
            <input
              type="number"
              min="0"
              value={salesCount}
              onChange={(e) => setSalesCount(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          {/* View Count */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-2">
              <Eye className="w-4 h-4 text-purple-400" />
              View Count
            </label>
            <input
              type="number"
              min="0"
              value={viewCount}
              onChange={(e) => setViewCount(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>

          {/* Calculated Conversion Rate */}
          <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-zinc-400">Conversion Rate</span>
              </div>
              <span className="text-lg font-semibold text-amber-400">{conversionRate}%</span>
            </div>
            <p className="text-xs text-zinc-600 mt-1">Calculated from views and sales</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 relative px-4 py-3 rounded-xl font-medium text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600" />
              <span className="relative">{saving ? 'Saving...' : 'Save Metrics'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
