"use client";

import { useState } from "react";
import { useFlyerAssets, useDeleteFlyerAsset, type FlyerAsset } from "@/lib/hooks/useFlyerAssets.query";
import { Loader2, Trash2, X, Image as ImageIcon } from "lucide-react";

interface FlyerPickerProps {
  profileId: string | null;
  onSelect: (url: string) => void;
  onDelete?: (deletedUrl: string) => void;
  onClose: () => void;
}

export function FlyerPicker({ profileId, onSelect, onDelete, onClose }: FlyerPickerProps) {
  const { data: assets, isLoading } = useFlyerAssets(profileId);
  const deleteMutation = useDeleteFlyerAsset();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, asset: FlyerAsset) => {
    e.stopPropagation();
    if (!profileId) return;
    setDeletingId(asset.id);
    try {
      await deleteMutation.mutateAsync({ assetId: asset.id, profileId });
      onDelete?.(asset.url);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl w-[480px] max-h-[500px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-brand-blue" />
            <span className="text-sm font-semibold text-zinc-100">Select Flyer</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {!profileId ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ImageIcon className="w-8 h-8 text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-500">No model selected</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-brand-blue animate-spin" />
            </div>
          ) : !assets || assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ImageIcon className="w-8 h-8 text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-500">No flyers created yet</p>
              <p className="text-[10px] text-zinc-600 mt-1">
                Create flyers in the GIF Maker Workspace
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => onSelect(asset.url)}
                  className="relative group cursor-pointer rounded-xl overflow-hidden border border-zinc-800/50 hover:border-brand-blue/40 transition-all aspect-square bg-zinc-800/40"
                >
                  <img
                    src={asset.url}
                    alt={asset.fileName}
                    className="w-full h-full object-cover"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <span className="text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      Select
                    </span>
                  </div>
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(e, asset)}
                    disabled={deletingId === asset.id}
                    className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-zinc-400 hover:text-red-400 hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    {deletingId === asset.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </button>
                  {/* File type badge */}
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-semibold text-zinc-300 uppercase">
                    {asset.fileType}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
