import { create } from 'zustand';
import type { Prize, PrizeTier, ThemeKey } from '@/lib/wheel-creator/types';
import { DEFAULT_PRIZES, THEMES } from '@/lib/wheel-creator/constants';

interface WheelCreatorState {
  // Model
  selectedModelId: string | null;
  modelName: string;
  modelPhotoUrl: string | null;
  modelPhotoFile: string | null;

  // Prizes
  prizes: Prize[];
  customInput: string;

  // Theme
  themeKey: ThemeKey;

  // UI
  editingPrizeId: string | null;
  editingPrizeValue: string;

  // Actions — Model
  setSelectedModelId: (id: string | null) => void;
  setModelName: (name: string) => void;
  setModelPhotoUrl: (url: string | null) => void;
  setModelPhotoFile: (dataUrl: string | null) => void;

  // Actions — Prizes
  togglePrize: (id: string) => void;
  setPrizeLabel: (id: string, label: string) => void;
  addCustomPrize: (label: string) => void;
  removeCustomPrize: (id: string) => void;
  quickSelectTier: (tier: PrizeTier) => void;
  clearAllPrizes: () => void;
  autoFillFromContentTypes: (contentTypeValues: string[]) => void;
  setCustomInput: (input: string) => void;

  // Actions — Theme
  setThemeKey: (key: ThemeKey) => void;

  // Actions — Editing
  startEditPrize: (id: string, currentLabel: string) => void;
  saveEditPrize: () => void;
  cancelEditPrize: () => void;
  setEditingPrizeValue: (value: string) => void;
}

export const useWheelCreatorStore = create<WheelCreatorState>((set, get) => ({
  selectedModelId: null,
  modelName: '',
  modelPhotoUrl: null,
  modelPhotoFile: null,
  prizes: DEFAULT_PRIZES.map((p) => ({ ...p, enabled: false })),
  customInput: '',
  themeKey: 'st-patricks',
  editingPrizeId: null,
  editingPrizeValue: '',

  setSelectedModelId: (id) => set({ selectedModelId: id }),
  setModelName: (name) => set({ modelName: name }),
  setModelPhotoUrl: (url) => set({ modelPhotoUrl: url }),
  setModelPhotoFile: (dataUrl) => set({ modelPhotoFile: dataUrl }),

  togglePrize: (id) =>
    set((s) => ({
      prizes: s.prizes.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
    })),

  setPrizeLabel: (id, label) =>
    set((s) => ({
      prizes: s.prizes.map((p) => (p.id === id ? { ...p, label: label.toUpperCase().trim() } : p)),
    })),

  addCustomPrize: (label) => {
    if (!label.trim()) return;
    set((s) => ({
      prizes: [
        ...s.prizes,
        {
          id: `custom-${Date.now()}`,
          label: label.toUpperCase().trim(),
          tier: 'custom' as PrizeTier,
          enabled: true,
        },
      ],
      customInput: '',
    }));
  },

  removeCustomPrize: (id) =>
    set((s) => ({ prizes: s.prizes.filter((p) => p.id !== id) })),

  quickSelectTier: (tier) =>
    set((s) => ({
      prizes: s.prizes.map((p) => (p.tier === tier ? { ...p, enabled: true } : p)),
    })),

  clearAllPrizes: () =>
    set((s) => ({
      prizes: s.prizes.map((p) => ({ ...p, enabled: false })),
    })),

  autoFillFromContentTypes: (contentTypeValues) =>
    set((s) => ({
      prizes: s.prizes.map((p) => {
        if (!p.contentTypeValue) return p;
        const match = contentTypeValues.some(
          (ct) => ct.toLowerCase() === p.contentTypeValue!.toLowerCase()
        );
        return match ? { ...p, enabled: true } : p;
      }),
    })),

  setCustomInput: (input) => set({ customInput: input }),

  setThemeKey: (key) => set({ themeKey: key }),

  startEditPrize: (id, currentLabel) =>
    set({ editingPrizeId: id, editingPrizeValue: currentLabel }),

  saveEditPrize: () => {
    const { editingPrizeId, editingPrizeValue } = get();
    if (editingPrizeId && editingPrizeValue.trim()) {
      get().setPrizeLabel(editingPrizeId, editingPrizeValue);
    }
    set({ editingPrizeId: null, editingPrizeValue: '' });
  },

  cancelEditPrize: () => set({ editingPrizeId: null, editingPrizeValue: '' }),
  setEditingPrizeValue: (value) => set({ editingPrizeValue: value }),
}));

export const selectActivePrizes = (s: WheelCreatorState) =>
  s.prizes.filter((p) => p.enabled);

export const selectTheme = (s: WheelCreatorState) =>
  THEMES[s.themeKey];

export const selectModelPhoto = (s: WheelCreatorState) =>
  s.modelPhotoFile || s.modelPhotoUrl;
