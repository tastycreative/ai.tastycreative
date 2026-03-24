'use client';

import NextImage from 'next/image';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  X,
  Search,
  FolderOpen,
  Folder,
  ChevronRight,
  Check,
  Image as ImageIcon,
  Film,
  File,
  Loader2,
  ArrowLeft,
  Eye,
  ZoomIn,
} from 'lucide-react';
import { useVaultFolders } from '@/lib/hooks/useVaultFolders.query';
import { useVaultItems, type VaultItem } from '@/lib/hooks/useVaultItems.query';
import type { VaultAssetRef } from '@/lib/spaces/template-metadata';

/* ── Types ──────────────────────────────────────────────── */

interface VaultAssetPickerProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  profileName: string;
  selectedAssets: VaultAssetRef[];
  onAssetsSelected: (assets: VaultAssetRef[]) => void;
}

interface VaultFolder {
  id: string;
  name: string;
  parentId: string | null;
  isDefault: boolean;
  subfolders?: VaultFolder[];
  _count?: { items: number };
}

/* ── Helpers ─────────────────────────────────────────────── */

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return ImageIcon;
  if (fileType.startsWith('video/')) return Film;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Component ──────────────────────────────────────────── */

export function VaultAssetPicker({
  isOpen,
  onClose,
  profileId,
  profileName,
  selectedAssets,
  onAssetsSelected,
}: VaultAssetPickerProps) {
  const { data: folders = [], isLoading: foldersLoading } = useVaultFolders(profileId);
  const { data: items = [], isLoading: itemsLoading } = useVaultItems(profileId);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [localSelected, setLocalSelected] = useState<Map<string, VaultAssetRef>>(
    () => new Map(selectedAssets.map((a) => [a.id, a])),
  );
  const [previewItem, setPreviewItem] = useState<VaultItem | null>(null);

  // Virtualizer setup
  const COLS = 4;
  const CELL_HEIGHT = 272; // px — thumbnail (~207px square) + file info (~46px) + 12px row gap between rows (gap-3 equiv)
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  const handleOpen = useCallback(() => {
    setLocalSelected(new Map(selectedAssets.map((a) => [a.id, a])));
    setCurrentFolderId(null);
    setFolderPath([]);
    setSearch('');
  }, [selectedAssets]);

  // Navigate into a folder
  const navigateToFolder = useCallback((folderId: string, folderName: string) => {
    setCurrentFolderId(folderId);
    setFolderPath((prev) => [...prev, { id: folderId, name: folderName }]);
    setSearch('');
  }, []);

  // Navigate back
  const navigateBack = useCallback(() => {
    setFolderPath((prev) => {
      const newPath = prev.slice(0, -1);
      setCurrentFolderId(newPath.length > 0 ? newPath[newPath.length - 1].id : null);
      return newPath;
    });
  }, []);

  // Navigate to root
  const navigateToRoot = useCallback(() => {
    setCurrentFolderId(null);
    setFolderPath([]);
  }, []);

  // Filter folders and items by current folder
  const currentFolders = useMemo(() => {
    const filtered = (folders as VaultFolder[]).filter((f) =>
      currentFolderId ? f.parentId === currentFolderId : !f.parentId,
    );
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [folders, currentFolderId]);

  const currentItems = useMemo(() => {
    let filtered = items.filter((item) =>
      currentFolderId ? item.folderId === currentFolderId : true,
    );
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((item) => item.fileName.toLowerCase().includes(q));
    }
    return filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [items, currentFolderId, search]);

  // Chunk items into rows of COLS for the row virtualizer
  const itemRows = useMemo(() => {
    const rows: VaultItem[][] = [];
    for (let i = 0; i < currentItems.length; i += COLS) {
      rows.push(currentItems.slice(i, i + COLS));
    }
    return rows;
  }, [currentItems]);

  const rowVirtualizer = useVirtualizer({
    count: itemRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CELL_HEIGHT,
    overscan: 3,
  });

  // Reset scroll position when folder / search changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [currentFolderId, search]);

  // Close lightbox with Escape
  useEffect(() => {
    if (!previewItem) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewItem(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [previewItem]);

  const toggleAsset = useCallback(
    (item: VaultItem) => {
      setLocalSelected((prev) => {
        const next = new Map(prev);
        if (next.has(item.id)) {
          next.delete(item.id);
        } else {
          const folderName =
            (folders as VaultFolder[]).find((f) => f.id === item.folderId)?.name ?? '';
          next.set(item.id, {
            id: item.id,
            fileName: item.fileName,
            fileType: item.fileType,
            awsS3Url: item.awsS3Url,
            folderId: item.folderId,
            folderName,
          });
        }
        return next;
      });
    },
    [folders],
  );

  const handleConfirm = useCallback(() => {
    onAssetsSelected(Array.from(localSelected.values()));
    onClose();
  }, [localSelected, onAssetsSelected, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-70 flex items-center justify-center" onAnimationEnd={handleOpen}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border border-zinc-700/50 bg-[#0a0a0b] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20">
              <FolderOpen className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Select Vault Assets</h2>
              <p className="text-xs text-zinc-500">
                Browsing vault for <span className="text-brand-light-pink">{profileName}</span>
                {localSelected.size > 0 && (
                  <span className="ml-2 text-emerald-400">
                    · {localSelected.size} selected
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Breadcrumb + search */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800/30">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-sm flex-1 min-w-0 overflow-hidden">
            <button
              onClick={navigateToRoot}
              className={`shrink-0 px-2 py-1 rounded-md transition-colors ${
                !currentFolderId
                  ? 'text-brand-blue font-medium'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              Root
            </button>
            {folderPath.map((fp, idx) => (
              <span key={fp.id} className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
                <button
                  onClick={() => {
                    const newPath = folderPath.slice(0, idx + 1);
                    setFolderPath(newPath);
                    setCurrentFolderId(fp.id);
                  }}
                  className={`truncate max-w-[120px] px-2 py-1 rounded-md transition-colors ${
                    idx === folderPath.length - 1
                      ? 'text-brand-blue font-medium'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`}
                >
                  {fp.name}
                </button>
              </span>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter files..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/30 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-brand-blue/50"
            />
          </div>
        </div>

        {/* Content — scrollable container ref'd by virtualizer */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4" style={{ willChange: 'scroll-position' }}>
          {foldersLoading || itemsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-brand-light-pink" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Back button when in subfolder */}
              {currentFolderId && (
                <button
                  onClick={navigateBack}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}

              {/* Folders */}
              {currentFolders.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 px-1">
                    Folders
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {currentFolders.map((folder) => {
                      const hasSubfolders =
                        folder.subfolders != null
                          ? folder.subfolders.length > 0
                          : (folders as VaultFolder[]).some((f) => f.parentId === folder.id);
                      return (
                        <button
                          key={folder.id}
                          onClick={() => navigateToFolder(folder.id, folder.name)}
                          className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800/50 bg-zinc-900/30 hover:bg-zinc-800/50 hover:border-zinc-700/50 transition-all text-left"
                        >
                          {hasSubfolders ? (
                            <FolderOpen className="w-5 h-5 text-amber-400 shrink-0" />
                          ) : (
                            <Folder className="w-5 h-5 text-amber-400/70 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-zinc-300 truncate">{folder.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {folder._count?.items !== undefined && (
                                <span className="text-xs text-zinc-600">{folder._count.items} file{folder._count.items !== 1 ? 's' : ''}</span>
                              )}
                              {hasSubfolders && (
                                <>
                                  {folder._count?.items !== undefined && (
                                    <span className="text-zinc-700">·</span>
                                  )}
                                  <span className="text-xs text-amber-600/70">
                                    {folder.subfolders?.length ?? (folders as VaultFolder[]).filter((f) => f.parentId === folder.id).length} subfolder{(folder.subfolders?.length ?? (folders as VaultFolder[]).filter((f) => f.parentId === folder.id).length) !== 1 ? 's' : ''}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          {hasSubfolders && (
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Files — virtualized grid */}
              {currentItems.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 px-1">
                    Files {search && `(${currentItems.length})`}
                  </div>
                  {/* Outer container: fixed height so virtualizer can position rows absolutely */}
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      position: 'relative',
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                      <div
                        key={virtualRow.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        className="grid grid-cols-4 gap-3"
                      >
                        {itemRows[virtualRow.index].map((item) => {
                          const isSelected = localSelected.has(item.id);
                          const Icon = getFileIcon(item.fileType);
                          const isImage = item.fileType.startsWith('image/');
                          const isVideo = item.fileType.startsWith('video/');

                          return (
                            <div
                              key={item.id}
                              className={`relative group rounded-xl border overflow-hidden transition-all ${
                                isSelected
                                  ? 'border-brand-blue ring-2 ring-brand-blue/30'
                                  : 'border-zinc-800/50 hover:border-zinc-700/50'
                              }`}
                            >
                              {/* Thumbnail — click to preview */}
                              <button
                                type="button"
                                onClick={() => (isImage || isVideo) ? setPreviewItem(item) : toggleAsset(item)}
                                className="block w-full"
                                aria-label={`Preview ${item.fileName}`}
                              >
                                <div className="relative aspect-square bg-zinc-900/50 overflow-hidden">
                                  {isImage ? (
                                    <NextImage
                                      src={item.awsS3Url}
                                      alt={item.fileName}
                                      fill
                                      sizes="220px"
                                      className="object-cover"
                                    />
                                  ) : isVideo ? (
                                    <div className="relative w-full h-full bg-zinc-900 flex items-center justify-center">
                                      <Film className="w-8 h-8 text-zinc-600" />
                                    </div>
                                  ) : (
                                    <Icon className="w-8 h-8 text-zinc-600" />
                                  )}

                                  {/* Zoom hint on hover for previewable items */}
                                  {(isImage || isVideo) && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <ZoomIn className="w-6 h-6 text-white drop-shadow" />
                                    </div>
                                  )}
                                </div>
                              </button>

                              {/* Select toggle — top-right checkbox */}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleAsset(item); }}
                                aria-label={isSelected ? 'Deselect' : 'Select'}
                                className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all border ${
                                  isSelected
                                    ? 'bg-brand-blue border-brand-blue shadow-lg shadow-brand-blue/30'
                                    : 'bg-black/50 border-zinc-500/60 opacity-0 group-hover:opacity-100 hover:border-brand-blue/60'
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                              </button>

                              {/* File info */}
                              <div className="px-2.5 py-2">
                                <div className="text-xs text-zinc-400 truncate">{item.fileName}</div>
                                <div className="text-[10px] text-zinc-600 mt-0.5">{formatFileSize(item.fileSize)}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentFolders.length === 0 && currentItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <FolderOpen className="w-12 h-12 text-zinc-700 mb-3" />
                  <p className="text-sm text-zinc-500">
                    {search ? 'No files match your search' : 'This folder is empty'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800/50">
          <span className="text-sm text-zinc-500">
            {localSelected.size} asset{localSelected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-zinc-700/50 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-blue to-brand-blue/80 text-sm font-medium text-white hover:from-brand-blue/90 hover:to-brand-blue/70 transition-all shadow-lg shadow-brand-blue/20"
            >
              Confirm Selection ({localSelected.size})
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox preview */}
      {previewItem && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 backdrop-blur-md"
          onClick={() => setPreviewItem(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewItem(null)}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {previewItem.fileType.startsWith('image/') ? (
              <img
                src={previewItem.awsS3Url}
                alt={previewItem.fileName}
                className="max-w-full max-h-[80vh] rounded-xl object-contain shadow-2xl"
              />
            ) : (
              <video
                src={previewItem.awsS3Url}
                controls
                className="max-w-full max-h-[80vh] rounded-xl shadow-2xl bg-black"
              />
            )}
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-300 font-medium">{previewItem.fileName}</span>
              <span className="text-xs text-zinc-500">{formatFileSize(previewItem.fileSize)}</span>
              <button
                type="button"
                onClick={() => { toggleAsset(previewItem); setPreviewItem(null); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  localSelected.has(previewItem.id)
                    ? 'bg-brand-blue/20 text-brand-blue border border-brand-blue/30 hover:bg-brand-blue/10'
                    : 'bg-brand-blue text-white hover:bg-brand-blue/80'
                }`}
              >
                {localSelected.has(previewItem.id) ? 'Deselect' : 'Select'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
