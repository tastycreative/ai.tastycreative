/**
 * Compare Mode Modal - Side-by-Side Comparison View
 * 
 * Allows comparing 2-4 items side-by-side with their metadata
 * Useful for A/B testing different prompts and generation settings
 */

import React from 'react';
import { X, Download, Image as ImageIcon, Video as VideoIcon, Sparkles } from 'lucide-react';
import { createPortal } from 'react-dom';

interface VaultItemMetadata {
  source?: string;
  model?: string;
  prompt?: string;
  negativePrompt?: string;
  size?: string;
  resolution?: string;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  [key: string]: any;
}

interface VaultItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  awsS3Url: string;
  createdAt: Date;
  metadata?: VaultItemMetadata | null;
}

interface CompareModalProps {
  items: VaultItem[];
  onClose: () => void;
  formatFileSize: (bytes: number) => string;
}

export function CompareModal({ items, onClose, formatFileSize }: CompareModalProps) {
  if (items.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 animate-fadeIn p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      <div className="w-full max-w-7xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Compare Items</h2>
          <p className="text-gray-400">Comparing {items.length} items side-by-side</p>
        </div>

        <div className={`grid ${items.length === 2 ? 'grid-cols-2' : items.length === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'} gap-4`}>
          {items.map((item, index) => (
            <div key={item.id} className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden">
              {/* Item Number Badge */}
              <div className="bg-gradient-to-r from-violet-500 to-fuchsia-600 px-3 py-2 flex items-center justify-between">
                <span className="text-white font-semibold text-sm">Item {index + 1}</span>
                <a
                  href={item.awsS3Url}
                  download={item.fileName}
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4 text-white" />
                </a>
              </div>

              {/* Media Preview */}
              <div className="aspect-square bg-gray-800 relative">
                {item.fileType.startsWith('image/') ? (
                  <img
                    src={item.awsS3Url}
                    alt={item.fileName}
                    className="w-full h-full object-contain"
                  />
                ) : item.fileType.startsWith('video/') ? (
                  <>
                    <video
                      src={item.awsS3Url}
                      className="w-full h-full object-contain"
                      controls
                      playsInline
                    />
                    <div className="absolute top-2 right-2 bg-purple-500/90 px-2 py-1 rounded-lg">
                      <VideoIcon className="w-4 h-4 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-gray-600" />
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-200 truncate">{item.fileName}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">{formatFileSize(item.fileSize)}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Metadata Comparison */}
                {item.metadata && (
                  <div className="space-y-2 pt-2 border-t border-gray-700">
                    <div className="flex items-center gap-2 text-xs text-cyan-400 mb-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="font-semibold">AI Generated</span>
                    </div>

                    {item.metadata.source && (
                      <div>
                        <label className="text-xs text-gray-500">Source</label>
                        <p className="text-xs text-gray-300">{item.metadata.source}</p>
                      </div>
                    )}

                    {item.metadata.model && (
                      <div>
                        <label className="text-xs text-gray-500">Model</label>
                        <p className="text-xs text-gray-300">{item.metadata.model}</p>
                      </div>
                    )}

                    {item.metadata.prompt && (
                      <div>
                        <label className="text-xs text-gray-500">Prompt</label>
                        <p className="text-xs text-gray-300 line-clamp-3 leading-relaxed">
                          {item.metadata.prompt}
                        </p>
                      </div>
                    )}

                    {(item.metadata.size || item.metadata.resolution) && (
                      <div>
                        <label className="text-xs text-gray-500">Resolution</label>
                        <p className="text-xs text-gray-300">
                          {item.metadata.resolution || item.metadata.size}
                        </p>
                      </div>
                    )}

                    {item.metadata.steps && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">Steps</label>
                          <p className="text-xs text-gray-300">{item.metadata.steps}</p>
                        </div>
                        {item.metadata.cfgScale && (
                          <div>
                            <label className="text-xs text-gray-500">CFG</label>
                            <p className="text-xs text-gray-300">{item.metadata.cfgScale}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {item.metadata.seed && (
                      <div>
                        <label className="text-xs text-gray-500">Seed</label>
                        <p className="text-xs text-gray-300 font-mono">{item.metadata.seed}</p>
                      </div>
                    )}
                  </div>
                )}

                {!item.metadata && (
                  <p className="text-xs text-gray-600 italic pt-2 border-t border-gray-700">
                    No metadata available
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Key Differences Section */}
        {items.length > 1 && items.every(item => item.metadata) && (
          <div className="mt-6 bg-gray-900/50 border border-gray-700 rounded-2xl p-4">
            <h3 className="text-lg font-semibold text-white mb-3">Key Differences</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {/* Prompt Comparison */}
              {items.some(item => item.metadata?.prompt) && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Prompts</label>
                  <p className="text-gray-300">
                    {new Set(items.map(item => item.metadata?.prompt).filter(Boolean)).size === 1
                      ? 'All Same'
                      : 'Different'}
                  </p>
                </div>
              )}

              {/* Model Comparison */}
              {items.some(item => item.metadata?.model) && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Models</label>
                  <p className="text-gray-300">
                    {new Set(items.map(item => item.metadata?.model).filter(Boolean)).size === 1
                      ? 'All Same'
                      : 'Different'}
                  </p>
                </div>
              )}

              {/* Resolution Comparison */}
              {items.some(item => item.metadata?.resolution || item.metadata?.size) && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Resolutions</label>
                  <p className="text-gray-300">
                    {new Set(items.map(item => item.metadata?.resolution || item.metadata?.size).filter(Boolean)).size === 1
                      ? 'All Same'
                      : 'Different'}
                  </p>
                </div>
              )}

              {/* Steps Comparison */}
              {items.some(item => item.metadata?.steps) && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Steps</label>
                  <p className="text-gray-300">
                    {new Set(items.map(item => item.metadata?.steps).filter(Boolean)).size === 1
                      ? `All ${items[0].metadata?.steps}`
                      : 'Different'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
