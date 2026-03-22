'use client';

import React, { useState } from 'react';
import { Check, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { useFlyerAssets } from '@/lib/hooks/useFlyerAssets.query';

function isImageUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return /\.(gif|png|jpg|jpeg|webp)(\?|$)/.test(lower) || lower.includes('/uploads/');
}

interface FlyerPickerProps {
  profileId: string | null;
  selectedFlyerAssetId: string | null;
  selectedFlyerUrl: string;
  onSelectFlyer: (assetId: string, url: string) => void;
  onClearFlyer: () => void;
  onOverrideUrl: (url: string) => void;
  typeColor: string;
}

export function FlyerPicker({
  profileId,
  selectedFlyerAssetId,
  selectedFlyerUrl,
  onSelectFlyer,
  onClearFlyer,
  onOverrideUrl,
  typeColor,
}: FlyerPickerProps) {
  const [customUrl, setCustomUrl] = useState(
    selectedFlyerAssetId ? '' : (selectedFlyerUrl && !isImageUrl(selectedFlyerUrl) ? selectedFlyerUrl : ''),
  );
  const { data: assets, isLoading } = useFlyerAssets(profileId);

  if (!profileId) {
    return (
      <div className="py-6 text-center text-[10px] text-gray-500 dark:text-gray-600 font-sans">
        Select a model profile to view GIFs
      </div>
    );
  }

  const hasAssets = assets && assets.length > 0;

  return (
    <div className="flex flex-col gap-2">
      {/* Current GIF preview (auto-filled from caption or manually selected) */}
      {selectedFlyerUrl && isImageUrl(selectedFlyerUrl) && (
        <div
          className="rounded-md p-2.5"
          style={{ background: typeColor + '10', border: `1px solid ${typeColor}25` }}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-[8px] font-bold font-sans uppercase tracking-wider"
              style={{ color: typeColor }}
            >
              {selectedFlyerAssetId ? 'Selected GIF' : 'Auto-filled from board'}
            </span>
            <button
              onClick={onClearFlyer}
              className="p-0.5 rounded hover:bg-white/10 transition-colors"
              title="Remove GIF"
            >
              <X className="h-3 w-3 text-gray-500" />
            </button>
          </div>
          <div className="flex justify-center">
            <img
              src={selectedFlyerUrl}
              alt="Preview GIF"
              className="max-h-[160px] rounded-md border border-gray-700/30 object-contain"
            />
          </div>
          <div className="text-[8px] text-brand-blue font-mono truncate mt-2 text-center">
            {selectedFlyerUrl.replace('https://', '').replace('www.', '')}
          </div>
        </div>
      )}

      {/* URL-only preview (non-image URL) */}
      {selectedFlyerUrl && !isImageUrl(selectedFlyerUrl) && (
        <div
          className="rounded-md p-2.5 flex items-center gap-3"
          style={{ background: typeColor + '10', border: `1px solid ${typeColor}25` }}
        >
          <ImageIcon className="h-5 w-5 shrink-0 text-gray-600" />
          <div className="flex-1 min-w-0">
            <span
              className="text-[8px] font-bold font-sans uppercase tracking-wider"
              style={{ color: typeColor }}
            >
              Custom URL
            </span>
            <div className="text-[9px] text-brand-blue font-mono truncate mt-0.5">
              {selectedFlyerUrl.replace('https://', '')}
            </div>
          </div>
          <button onClick={onClearFlyer} className="p-0.5 rounded hover:bg-white/10">
            <X className="h-3 w-3 text-gray-500" />
          </button>
        </div>
      )}

      {/* Flyer assets grid (from GIF Maker Workspace) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 text-brand-blue animate-spin" />
        </div>
      ) : hasAssets ? (
        <>
          <div className="text-[8px] text-gray-400 dark:text-gray-700 font-sans">
            Flyer assets from GIF Maker
          </div>
          <div className="max-h-[160px] overflow-y-auto pr-0.5 scrollbar-thin">
            <div className="grid grid-cols-3 gap-1.5">
              {assets!.map((asset) => {
                const isSel = selectedFlyerAssetId === asset.id;
                return (
                  <div
                    key={asset.id}
                    onClick={() => {
                      if (isSel) {
                        onClearFlyer();
                      } else {
                        onSelectFlyer(asset.id, asset.url);
                        setCustomUrl('');
                      }
                    }}
                    className="relative group cursor-pointer rounded-lg overflow-hidden border transition-all aspect-square"
                    style={{
                      borderColor: isSel ? typeColor : '#1a1a2e',
                      boxShadow: isSel ? `0 0 0 1px ${typeColor}` : undefined,
                    }}
                  >
                    <img
                      src={asset.url}
                      alt={asset.fileName}
                      className="w-full h-full object-cover bg-gray-100 dark:bg-[#0c0c1a]"
                      loading="lazy"
                    />
                    {isSel && (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: typeColor + '30' }}
                      >
                        <Check className="h-5 w-5 text-white drop-shadow-md" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[7px] text-white font-mono truncate block">
                        {asset.fileName}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : !selectedFlyerUrl ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <ImageIcon className="w-6 h-6 text-gray-600 dark:text-gray-700 mb-1.5" />
          <p className="text-[10px] text-gray-500 dark:text-gray-600 font-sans">
            No GIF selected
          </p>
          <p className="text-[8px] text-gray-400 dark:text-gray-700 font-sans mt-0.5">
            Select a caption to auto-fill the GIF, or paste a URL below
          </p>
        </div>
      ) : null}

      {/* Custom URL input */}
      <div>
        <span className="text-[8px] text-gray-400 dark:text-gray-700 font-sans uppercase tracking-wider block mb-1">
          Or paste a custom URL
        </span>
        <input
          value={customUrl}
          onChange={(e) => {
            setCustomUrl(e.target.value);
          }}
          onBlur={() => {
            if (customUrl.trim()) onOverrideUrl(customUrl.trim());
          }}
          placeholder="https://..."
          className="w-full text-[10px] px-2.5 py-1.5 rounded border outline-none font-mono bg-gray-50 border-gray-200 text-gray-800 focus:border-brand-blue dark:bg-[#07070f] dark:border-[#1a1a35] dark:text-gray-300 dark:focus:border-brand-blue/50"
        />
      </div>
    </div>
  );
}
