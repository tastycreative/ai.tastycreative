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

const assetTypeIcons: Record<string, React.ReactNode> = {
  IMAGE: <ImageIcon className="w-5 h-5" />,
  VIDEO: <Video className="w-5 h-5" />,
  AUDIO: <Music className="w-5 h-5" />,
  DOCUMENT: <FileText className="w-5 h-5" />,
  OTHER: <File className="w-5 h-5" />,
};

const assetTypeColors: Record<string, string> = {
  IMAGE: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  VIDEO: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  AUDIO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  DOCUMENT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  OTHER: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export default function OfModelAssetsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [model, setModel] = useState<OfModel | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (slug) {
      loadModel();
    }
  }, [slug]);

  const loadModel = async () => {
    try {
      const response = await fetch(`/api/of-models/${slug}`);
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

  if (loading && !model) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Assets
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage model assets and media files
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={typeFilter}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              >
                <option value="ALL">All Types</option>
                <option value="IMAGE">Images</option>
                <option value="VIDEO">Videos</option>
                <option value="AUDIO">Audio</option>
                <option value="DOCUMENT">Documents</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Asset
            </button>
          </div>
        </div>

        {/* Assets Grid */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No assets yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {typeFilter !== 'ALL'
                  ? `No ${typeFilter.toLowerCase()} assets found`
                  : 'Upload your first asset to get started'}
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Upload className="w-5 h-5" />
                Add Asset
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                >
                  {/* Preview */}
                  <div className="aspect-video relative bg-gray-100 dark:bg-gray-900">
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
                        <div className={`p-4 rounded-full ${assetTypeColors[asset.type] || assetTypeColors.OTHER}`}>
                          {assetTypeIcons[asset.type] || assetTypeIcons.OTHER}
                        </div>
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <a
                        href={asset.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Open"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                      </a>
                      <button
                        onClick={() => handleDelete(asset)}
                        className="p-2 bg-white dark:bg-gray-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {asset.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${assetTypeColors[asset.type] || assetTypeColors.OTHER}`}>
                            {asset.type}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(asset.fileSize)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Add Asset
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Asset name"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            >
              <option value="IMAGE">Image</option>
              <option value="VIDEO">Video</option>
              <option value="AUDIO">Audio</option>
              <option value="DOCUMENT">Document</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              URL *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Thumbnail URL
            </label>
            <input
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://... (optional)"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
