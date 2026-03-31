'use client';

import { X } from 'lucide-react';
import { useWheelCreatorStore, selectTheme } from '@/stores/wheel-creator-store';
import { TIER_ORDER, TIER_META } from '@/lib/wheel-creator/constants';

export function PrizeBankPanel() {
  const prizes = useWheelCreatorStore((s) => s.prizes);
  const editingPrizeId = useWheelCreatorStore((s) => s.editingPrizeId);
  const editingPrizeValue = useWheelCreatorStore((s) => s.editingPrizeValue);
  const customInput = useWheelCreatorStore((s) => s.customInput);

  const togglePrize = useWheelCreatorStore((s) => s.togglePrize);
  const startEditPrize = useWheelCreatorStore((s) => s.startEditPrize);
  const saveEditPrize = useWheelCreatorStore((s) => s.saveEditPrize);
  const cancelEditPrize = useWheelCreatorStore((s) => s.cancelEditPrize);
  const setEditingPrizeValue = useWheelCreatorStore((s) => s.setEditingPrizeValue);
  const setCustomInput = useWheelCreatorStore((s) => s.setCustomInput);
  const addCustomPrize = useWheelCreatorStore((s) => s.addCustomPrize);
  const removeCustomPrize = useWheelCreatorStore((s) => s.removeCustomPrize);

  const theme = useWheelCreatorStore(selectTheme);

  return (
    <div className="flex-1 p-3.5 overflow-y-auto border-r border-gray-800">
      <div className="flex justify-between items-center mb-3.5">
        <div className="text-base font-bold tracking-wider" style={{ fontFamily: "'Impact', 'Arial Black', sans-serif" }}>
          Prize Bank
        </div>
        <div className="text-[11px] text-gray-500">Click to toggle · Double-click to rename</div>
      </div>

      {TIER_ORDER.map((tier) => {
        const tierPrizes = prizes.filter((p) => p.tier === tier);
        if (!tierPrizes.length) return null;
        const tm = TIER_META[tier];

        return (
          <div key={tier} className="mb-4">
            <div
              className="text-[10px] font-bold uppercase tracking-wider mb-2 pb-1.5"
              style={{ color: tm.color, borderBottom: `1px solid ${tm.color}18` }}
            >
              {tm.emoji} {tm.label}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tierPrizes.map((p) => (
                <div key={p.id}>
                  {editingPrizeId === p.id ? (
                    <input
                      autoFocus
                      value={editingPrizeValue}
                      onChange={(e) => setEditingPrizeValue(e.target.value)}
                      onBlur={() => saveEditPrize()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditPrize();
                        if (e.key === 'Escape') cancelEditPrize();
                      }}
                      className="w-36 text-[11px] px-2 py-1 rounded-md bg-gray-900 text-gray-200 outline-none"
                      style={{ border: `1.5px solid ${theme.accent}` }}
                    />
                  ) : (
                    <button
                      onClick={() => togglePrize(p.id)}
                      onDoubleClick={() => startEditPrize(p.id, p.label)}
                      title="Click to toggle · Double-click to rename"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold cursor-pointer select-none transition-all"
                      style={{
                        background: p.enabled ? `${tm.color}18` : '#141420',
                        border: `1.5px solid ${p.enabled ? tm.color : '#252540'}`,
                        color: p.enabled ? tm.color : '#4a4a5e',
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0 transition-all"
                        style={{
                          background: p.enabled ? tm.color : '#2a2a40',
                          boxShadow: p.enabled ? `0 0 6px ${tm.color}` : 'none',
                        }}
                      />
                      {p.label}
                      {p.tier === 'custom' && (
                        <span
                          onClick={(e) => { e.stopPropagation(); removeCustomPrize(p.id); }}
                          className="text-red-400 cursor-pointer text-sm leading-none ml-0.5 hover:text-red-300"
                        >
                          <X className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="mt-4 pt-3.5 border-t border-gray-800">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Add Custom Prize</div>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-gray-900 border border-gray-800 rounded-md px-2.5 py-1.5 text-sm text-gray-200 outline-none focus:border-gray-600 transition-colors"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addCustomPrize(customInput); }}
            placeholder="e.g. FREE MONTH SUB"
          />
          <button
            onClick={() => addCustomPrize(customInput)}
            className="px-3.5 py-1.5 rounded-md font-bold text-sm shrink-0 cursor-pointer transition-colors"
            style={{ background: theme.accent, color: '#000' }}
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}
