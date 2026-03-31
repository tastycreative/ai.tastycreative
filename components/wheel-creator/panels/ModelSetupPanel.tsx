'use client';

import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Trash2, Camera, HardDrive, FolderClosed, FolderOpen, ChevronLeft,
  Loader2, Image as ImageIcon, Upload,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useWheelCreatorStore } from '@/stores/wheel-creator-store';
import { useContentTypeOptions } from '@/lib/hooks/useContentTypeOptions.query';
import { ModelSelector } from '../ModelSelector';
import { TIER_ORDER, TIER_META, THEMES } from '@/lib/wheel-creator/constants';
import type { OfModel } from '@/lib/hooks/useOfModels.query';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';

interface VaultFolderWithCount {
  id: string;
  name: string;
  profileId: string;
  profileName?: string;
  profileUsername?: string | null;
  isOwnedProfile?: boolean;
  ownerName?: string | null;
  _count?: { items: number };
}

interface VaultItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  awsS3Key: string;
  awsS3Url: string;
  createdAt: Date | string;
  folderId: string;
  profileId: string;
}

type PhotoView = 'default' | 'vault-folders' | 'vault-items';

export function ModelSetupPanel() {
  const {
    selectedModelId, modelName, modelPhotoUrl, modelPhotoFile, prizes, themeKey,
  } = useWheelCreatorStore(
    useShallow((s) => ({
      selectedModelId: s.selectedModelId,
      modelName: s.modelName,
      modelPhotoUrl: s.modelPhotoUrl,
      modelPhotoFile: s.modelPhotoFile,
      prizes: s.prizes,
      themeKey: s.themeKey,
    }))
  );

  const setSelectedModelId = useWheelCreatorStore((s) => s.setSelectedModelId);
  const setModelName = useWheelCreatorStore((s) => s.setModelName);
  const setModelPhotoUrl = useWheelCreatorStore((s) => s.setModelPhotoUrl);
  const setModelPhotoFile = useWheelCreatorStore((s) => s.setModelPhotoFile);
  const clearAllPrizes = useWheelCreatorStore((s) => s.clearAllPrizes);
  const autoFillFromContentTypes = useWheelCreatorStore((s) => s.autoFillFromContentTypes);
  const quickSelectTier = useWheelCreatorStore((s) => s.quickSelectTier);

  const theme = THEMES[themeKey];
  const activePrizes = useMemo(() => prizes.filter((p) => p.enabled), [prizes]);
  const modelPhoto = modelPhotoFile || modelPhotoUrl;
  const fileRef = useRef<HTMLInputElement>(null);

  // Vault browser state
  const { profiles } = useInstagramProfile();
  const [photoView, setPhotoView] = useState<PhotoView>('default');
  const [vaultFolders, setVaultFolders] = useState<VaultFolderWithCount[]>([]);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<VaultFolderWithCount | null>(null);

  const fetchFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const response = await fetch('/api/vault/folders?profileId=all');
      if (!response.ok) { setVaultFolders([]); return; }
      const data = await response.json();
      setVaultFolders(Array.isArray(data) ? data : []);
    } catch {
      setVaultFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  const fetchItems = useCallback(async (folder: VaultFolderWithCount) => {
    setLoadingItems(true);
    try {
      const url = `/api/vault/items?profileId=${folder.profileId}&folderId=${folder.id}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      const allItems: VaultItem[] = Array.isArray(data) ? data : data.items || [];
      setVaultItems(allItems.filter((item) => item.fileType?.startsWith('image/')));
    } catch {
      setVaultItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const openVaultBrowser = useCallback(() => {
    setPhotoView('vault-folders');
    fetchFolders();
  }, [fetchFolders]);

  const handleOpenFolder = useCallback((folder: VaultFolderWithCount) => {
    setSelectedFolder(folder);
    setPhotoView('vault-items');
    fetchItems(folder);
  }, [fetchItems]);

  const handleBackToFolders = useCallback(() => {
    setPhotoView('vault-folders');
    setSelectedFolder(null);
    setVaultItems([]);
  }, []);

  const handleSelectVaultImage = useCallback((item: VaultItem) => {
    setModelPhotoUrl(item.awsS3Url);
    setModelPhotoFile(null);
    setPhotoView('default');
  }, [setModelPhotoUrl, setModelPhotoFile]);

  const sortedProfileGroups = useMemo(() => {
    const grouped = vaultFolders.reduce<
      Record<string, { profile: { id: string; name: string; username: string | null; isOwned: boolean; ownerName: string | null }; folders: VaultFolderWithCount[] }>
    >((acc, folder) => {
      const profileId = folder.profileId;
      if (!acc[profileId]) {
        acc[profileId] = {
          profile: {
            id: profileId,
            name: folder.profileName || profiles.find((p) => p.id === profileId)?.name || 'Unknown',
            username: folder.profileUsername || profiles.find((p) => p.id === profileId)?.instagramUsername || null,
            isOwned: folder.isOwnedProfile !== false,
            ownerName: folder.ownerName || null,
          },
          folders: [],
        };
      }
      acc[profileId].folders.push(folder);
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => {
      if (a.profile.isOwned && !b.profile.isOwned) return -1;
      if (!a.profile.isOwned && b.profile.isOwned) return 1;
      return a.profile.name.localeCompare(b.profile.name);
    });
  }, [vaultFolders, profiles]);

  const { data: contentTypes } = useContentTypeOptions({
    modelId: selectedModelId ?? undefined,
    enabled: !!selectedModelId,
  });

  useEffect(() => {
    if (contentTypes && contentTypes.length > 0 && selectedModelId) {
      const values = contentTypes
        .filter((ct: { isActive: boolean }) => ct.isActive)
        .map((ct: { value: string }) => ct.value);
      autoFillFromContentTypes(values);
    }
  }, [contentTypes, selectedModelId, autoFillFromContentTypes]);

  const handleModelSelect = useCallback((model: OfModel) => {
    setSelectedModelId(model.id);
    setModelName(model.displayName || model.name);
    setModelPhotoUrl(model.profileImageUrl || null);
    clearAllPrizes();
  }, [setSelectedModelId, setModelName, setModelPhotoUrl, clearAllPrizes]);

  const handlePhoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setModelPhotoFile(ev.target?.result as string);
    reader.readAsDataURL(f);
  }, [setModelPhotoFile]);

  return (
    <div className="w-[220px] bg-gray-900/60 border-r border-gray-800 p-3 flex flex-col gap-3.5 overflow-y-auto shrink-0">
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Model</label>
        <div className="mt-1.5">
          <ModelSelector selectedModelId={selectedModelId} onSelect={handleModelSelect} />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Display Name</label>
        <input
          className="mt-1.5 w-full bg-gray-900 border border-gray-800 rounded-md px-2.5 py-1.5 text-sm text-gray-200 outline-none focus:border-gray-600 transition-colors"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder="Enter name..."
        />
      </div>

      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Model Photo</label>

        {/* Default view — photo preview + action buttons */}
        {photoView === 'default' && (
          <>
            <div
              onClick={() => fileRef.current?.click()}
              className="mt-1.5 h-44 rounded-lg overflow-hidden bg-gray-900 border-2 border-dashed cursor-pointer flex items-center justify-center relative transition-colors hover:border-gray-500"
              style={{ borderColor: modelPhoto ? theme.accent + '60' : '#252540' }}
            >
              {modelPhoto ? (
                <img src={modelPhoto} alt="" className="w-full h-full object-cover object-top" />
              ) : (
                <div className="text-center text-gray-500">
                  <Camera className="w-6 h-6 mx-auto mb-1" />
                  <div className="text-[11px]">Click to upload</div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            <div className="flex gap-1.5 mt-1.5">
              <button
                onClick={openVaultBrowser}
                className="flex-1 py-1.5 rounded text-[11px] font-medium text-gray-400 bg-transparent border border-gray-800 hover:border-violet-500/50 hover:text-violet-400 transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <HardDrive className="w-3 h-3" />
                Vault
              </button>
              {modelPhoto && (
                <button
                  onClick={() => { setModelPhotoFile(null); setModelPhotoUrl(null); }}
                  className="flex-1 py-1.5 rounded text-[11px] text-gray-500 bg-transparent border border-gray-800 hover:border-gray-600 transition-colors cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
          </>
        )}

        {/* Vault folders view */}
        {photoView === 'vault-folders' && (
          <div className="mt-1.5 rounded-lg border border-gray-800 bg-gray-900/80 overflow-hidden" style={{ maxHeight: 280 }}>
            <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-gray-800">
              <button onClick={() => setPhotoView('default')} className="p-0.5 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <HardDrive className="w-3 h-3 text-violet-400" />
              <span className="text-[11px] font-medium text-gray-300">Select from Vault</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
              {loadingFolders ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                </div>
              ) : sortedProfileGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-20 text-center p-3">
                  <HardDrive className="h-5 w-5 text-gray-700 mb-1" />
                  <p className="text-[10px] text-gray-500">No vault folders found</p>
                </div>
              ) : (
                <div className="py-0.5">
                  {sortedProfileGroups.map(({ profile, folders: profileFolders }) => (
                    <div key={profile.id} className="mb-0.5">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 border-b border-white/5">
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                          profile.isOwned
                            ? 'bg-gradient-to-br from-violet-500/50 to-fuchsia-500/50'
                            : 'bg-gradient-to-br from-amber-500/50 to-orange-500/50'
                        }`}>
                          <span className="text-[9px] font-medium text-white">{profile.name?.charAt(0) || '?'}</span>
                        </div>
                        <span className="text-[10px] font-medium text-gray-400 truncate">{profile.name}</span>
                      </div>
                      <div className="pl-1.5">
                        {profileFolders.map((folder) => (
                          <button
                            key={folder.id}
                            onClick={() => handleOpenFolder(folder)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-gray-200 transition-all cursor-pointer group"
                          >
                            <FolderClosed className="w-3 h-3 text-gray-600 group-hover:text-violet-400 transition-colors flex-shrink-0" />
                            <span className="flex-1 text-[11px] font-medium text-left truncate">{folder.name}</span>
                            <span className="text-[9px] px-1 py-0.5 rounded-full bg-white/10 text-gray-500 min-w-[16px] text-center">
                              {folder._count?.items ?? 0}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="px-2.5 pt-2 pb-1.5 border-t border-gray-800">
                    <button
                      onClick={() => { fileRef.current?.click(); setPhotoView('default'); }}
                      className="w-full py-2 border border-dashed border-gray-700 rounded-lg flex items-center justify-center gap-1 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all cursor-pointer group"
                    >
                      <Upload className="h-3 w-3 text-gray-600 group-hover:text-violet-400 transition-colors" />
                      <span className="text-[10px] text-gray-500 group-hover:text-gray-400 transition-colors">Upload from device</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vault items view */}
        {photoView === 'vault-items' && (
          <div className="mt-1.5 rounded-lg border border-gray-800 bg-gray-900/80 overflow-hidden" style={{ maxHeight: 280 }}>
            <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-gray-800">
              <button onClick={handleBackToFolders} className="p-0.5 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <FolderOpen className="w-3 h-3 text-violet-400 flex-shrink-0" />
              <span className="text-[11px] font-medium text-gray-300 truncate">{selectedFolder?.name}</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
              {loadingItems ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                </div>
              ) : vaultItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-20 text-center p-3">
                  <ImageIcon className="h-5 w-5 text-gray-700 mb-1" />
                  <p className="text-[10px] text-gray-500">No images in this folder</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1 p-1.5">
                  {vaultItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectVaultImage(item)}
                      className="relative aspect-[3/4] rounded overflow-hidden bg-gray-800 cursor-pointer group hover:ring-2 hover:ring-violet-500 transition-all"
                    >
                      <img src={item.awsS3Url} alt={item.fileName} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Quick Select</label>
        <div className="flex flex-col gap-1 mt-1.5">
          {TIER_ORDER.filter((t) => t !== 'custom').map((tier) => (
            <button
              key={tier}
              onClick={() => quickSelectTier(tier)}
              className="px-2.5 py-1.5 rounded text-[11px] font-semibold text-left cursor-pointer bg-gray-900 transition-colors hover:bg-gray-800"
              style={{ border: `1px solid ${TIER_META[tier].color}30`, color: TIER_META[tier].color }}
            >
              {TIER_META[tier].emoji} {TIER_META[tier].label}
            </button>
          ))}
          <button
            onClick={() => clearAllPrizes()}
            className="mt-0.5 px-2.5 py-1.5 rounded text-[11px] font-semibold text-left cursor-pointer bg-gray-900 border border-red-500/20 text-red-400 hover:bg-gray-800 transition-colors"
          >
            <Trash2 className="w-3 h-3 inline mr-1" />
            Clear All
          </button>
        </div>
      </div>

      <div className="mt-auto pt-3 border-t border-gray-800">
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Active Prizes</label>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span
            className="text-3xl font-bold leading-none"
            style={{ color: theme.accent, fontFamily: "'Impact', 'Arial Black', sans-serif" }}
          >
            {activePrizes.length}
          </span>
          <span className="text-xs text-gray-500">selected</span>
        </div>
        {activePrizes.length > 0 && activePrizes.length < 2 && (
          <div className="text-[11px] text-amber-500 mt-1">Need at least 2</div>
        )}
      </div>
    </div>
  );
}
