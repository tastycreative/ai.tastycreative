'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  File,
  ExternalLink,
  X,
  Upload,
  Filter,
  Grid3X3,
  List,
  Search,
  Sparkles,
  FolderOpen,
  HardDrive,
  Link2,
} from 'lucide-react';

interface Asset {
  id: string;
  type: string;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface OfModel {
  id: string;
  slug: string;
}

const assetTypeConfig: Record<string, { icon: React.ComponentType<any>; color: string; bg: string; border: string }> = {
  IMAGE: { icon: ImageIcon, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  VIDEO: { icon: Video, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  AUDIO: { icon: Music, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  DOCUMENT: { icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  OTHER: { icon: File, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
};

export default function OfModelAssetsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [model, setModel] = useState<OfModel | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (slug) {
      loadModel();
    }
  }, [slug]);

  const loadModel = async () => {
    try {
      const response = await fetch(`/api/of-models/`);
      if (response.ok) {
        const result = await response.json();
        setModel(result.data);
        loadAssets(result.data.id);
      }
    } catch (error) {
      console.error('Error loading model:', error);
      setLoading(false);
    }
  };

  const loadAssets = async (modelId: string, type?: string) => {
    try {
      setLoading(true);
      const url = type && type !== 'ALL'
        ? `/api/of-models/${modelId}/assets?type=${type}`
        : `/api/of-models/${modelId}/assets`;
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        setAssets(result.data || []);
      }
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (type: string) => {
    setTypeFilter(type);
    if (model) {
      loadAssets(model.id, type);
    }
  };

  const handleDelete = async (asset: Asset) => {
    if (!model || !confirm(`Delete asset "${asset.name}"?`)) return;

    try {
      const response = await fetch(`/api/of-models/${model.id}/assets?assetId=${asset.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Asset deleted');
        loadAssets(model.id, typeFilter);
      } else {
        toast.error('Failed to delete asset');
      }
    } catch (error) {
      toast.error('Failed to delete asset');
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredAssets = assets.filter(asset =>
    searchQuery ? asset.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  // Stats
  const assetCounts = assets.reduce((acc, asset) => {
    acc[asset.type] = (acc[asset.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalSize = assets.reduce((acc, asset) => acc + (asset.fileSize || 0), 0);

  if (loading && !model) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800/50">
          <div className="h-7 w-48 bg-zinc-800/50 rounded-lg animate-pulse" />
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-video bg-zinc-800/30 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-pink-500/10">
              <ImageIcon className="w-4 h-4 text-pink-400" />
            </div>
            <span className="text-xs font-medium text-zinc-500 uppercase">Images</span>
          </div>
          <p className="text-2xl font-medium text-white">{assetCounts.IMAGE || 0}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Video className="w-4 h-4 text-violet-400" />
            </div>
            <span className="text-xs font-medium text-zinc-500 uppercase">Videos</span>
          </div>
          <p className="text-2xl font-medium text-white">{assetCounts.VIDEO || 0}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-sky-500/10">
              <FolderOpen className="w-4 h-4 text-sky-400" />
            </div>
            <span className="text-xs font-medium text-zinc-500 uppercase">Total</span>
          </div>
          <p className="text-2xl font-medium text-white">{assets.length}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <HardDrive className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-xs font-medium text-zinc-500 uppercase">Size</span>
          </div>
          <p className="text-2xl font-medium text-white">{formatFileSize(totalSize)}</p>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-pink-500/10">
              <ImageIcon className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Assets</h2>
              <p className="text-sm text-zinc-500">Manage model media files</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-none sm:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>

            {/* Type Filter */}
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500/50 cursor-pointer"
              >
                <option value="ALL">All Types</option>
                <option value="IMAGE">Images</option>
                <option value="VIDEO">Videos</option>
                <option value="AUDIO">Audio</option>
                <option value="DOCUMENT">Documents</option>
                <option value="OTHER">Other</option>
              </select>
              <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            </div>

            {/* View Toggle */}
            <div className="flex items-center bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-400'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-400'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Add Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600" />
              <Plus className="relative w-4 h-4" />
              <span className="relative text-sm hidden sm:inline">Add</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-zinc-800" />
                <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-violet-500 animate-spin" />
              </div>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-2xl bg-zinc-800/30 mb-4">
                <ImageIcon className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                {searchQuery ? 'No matching assets' : 'No assets yet'}
              </h3>
              <p className="text-zinc-500 mb-6 max-w-sm">
                {searchQuery
                  ? 'Try adjusting your search or filter'
                  : 'Upload your first asset to get started'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600" />
                  <Upload className="relative w-4 h-4" />
                  <span className="relative">Add Asset</span>
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAssets.map((asset) => {
                const config = assetTypeConfig[asset.type] || assetTypeConfig.OTHER;
                const Icon = config.icon;

                return (
                  <div
                    key={asset.id}
                    className="group relative bg-zinc-800/30 rounded-xl overflow-hidden border border-zinc-700/30 hover:border-zinc-600/50 transition-all"
                  >
                    {/* Preview */}
                    <div className="aspect-video relative bg-zinc-900/50">
                      {asset.type === 'IMAGE' && (asset.thumbnailUrl || asset.url) ? (
                        <img
                          src={asset.thumbnailUrl || asset.url}
                          alt={asset.name}
                          className="w-full h-full object-cover"
                        />
                      ) : asset.type === 'VIDEO' && asset.thumbnailUrl ? (
                        <img
                          src={asset.thumbnailUrl}
                          alt={asset.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className={`p-4 rounded-xl ${config.bg}`}>
                            <Icon className={`w-8 h-8 ${config.color}`} />
                          </div>
                        </div>
                      )}

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <a
                          href={asset.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 text-white" />
                        </a>
                        <button
                          onClick={() => handleDelete(asset)}
                          className="p-2.5 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-rose-500/30 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                      </div>

                      {/* Type Badge */}
                      <div className={`absolute top-2 right-2 px-2 py-1 rounded-md text-[10px] font-semibold uppercase ${config.bg} ${config.color} border ${config.border}`}>
                        {asset.type}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <p className="font-medium text-white truncate text-sm">{asset.name}</p>
                      <p className="text-xs text-zinc-500 mt-1">{formatFileSize(asset.fileSize)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAssets.map((asset) => {
                const config = assetTypeConfig[asset.type] || assetTypeConfig.OTHER;
                const Icon = config.icon;

                return (
                  <div
                    key={asset.id}
                    className="flex items-center gap-4 p-3 bg-zinc-800/20 rounded-xl hover:bg-zinc-800/40 transition-colors group"
                  >
                    {/* Thumbnail */}
                    <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-zinc-800/50">
                      {asset.type === 'IMAGE' && (asset.thumbnailUrl || asset.url) ? (
                        <img
                          src={asset.thumbnailUrl || asset.url}
                          alt={asset.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon className={`w-6 h-6 ${config.color}`} />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{asset.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${config.bg} ${config.color}`}>
                          {asset.type}
                        </span>
                        <span className="text-xs text-zinc-500">{formatFileSize(asset.fileSize)}</span>
                        <span className="text-xs text-zinc-600">
                          {new Date(asset.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={asset.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-700/50 transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDelete(asset)}
                        className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Asset Modal */}
      {showAddModal && model && (
        <AddAssetModal
          modelId={model.id}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadAssets(model.id, typeFilter);
          }}
        />
      )}
    </>
  );
}

// Add Asset Modal
function AddAssetModal({
  modelId,
  onClose,
  onSuccess,
}: {
  modelId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('IMAGE');
  const [url, setUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !url.trim()) {
      toast.error('Name and URL are required');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/of-models/${modelId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          url: url.trim(),
          thumbnailUrl: thumbnailUrl.trim() || null,
        }),
      });

      if (response.ok) {
        toast.success('Asset added');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to add asset');
      }
    } catch (error) {
      toast.error('Failed to add asset');
    } finally {
      setSaving(false);
    }
  };

  const typeOptions = [
    { value: 'IMAGE', label: 'Image', icon: ImageIcon, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    { value: 'VIDEO', label: 'Video', icon: Video, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { value: 'AUDIO', label: 'Audio', icon: Music, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { value: 'DOCUMENT', label: 'Document', icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { value: 'OTHER', label: 'Other', icon: File, color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-pink-500 to-transparent" />

        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-pink-500/10">
              <Upload className="w-5 h-5 text-pink-400" />
            </div>
            <h2 className="text-lg font-medium text-white">Add Asset</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Asset name"
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Type <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-5 gap-2">
              {typeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setType(option.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                      type === option.value
                        ? `${option.bg} border-current ${option.color}`
                        : 'bg-zinc-800/30 border-zinc-700/50 text-zinc-500 hover:text-zinc-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              URL <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full pl-11 pr-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Thumbnail URL
            </label>
            <div className="relative">
              <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://... (optional)"
                className="w-full pl-11 pr-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 relative px-4 py-3 rounded-xl font-medium text-white overflow-hidden disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-rose-600" />
              <span className="relative">{saving ? 'Adding...' : 'Add Asset'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
