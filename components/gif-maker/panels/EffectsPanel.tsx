"use client";

import { useVideoEditorStore } from "@/stores/video-editor-store";
import { Sparkles, Droplet, Sun, Contrast, Palette, Circle } from "lucide-react";

export function EffectsPanel() {
  const selectedClipId = useVideoEditorStore((s) => s.selectedClipId);
  const clips = useVideoEditorStore((s) => s.clips);
  const updateClip = useVideoEditorStore((s) => s.updateClip);

  const selectedClip = clips.find((c) => c.id === selectedClipId);

  if (!selectedClipId || !selectedClip) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="p-4 rounded-full bg-zinc-800/30 mb-4">
          <Sparkles className="w-8 h-8 text-zinc-600" />
        </div>
        <p className="text-sm text-zinc-500 mb-2">No clip selected</p>
        <p className="text-xs text-zinc-600">
          Select a clip to apply effects
        </p>
      </div>
    );
  }

  const effects = (selectedClip as any).effects || {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    grayscale: 0,
    sepia: 0,
    hue: 0,
    vignette: 0,
  };

  const handleEffectChange = (key: string, value: number) => {
    updateClip(selectedClipId, {
      effects: {
        ...effects,
        [key]: value,
      },
    });
  };

  const resetEffects = () => {
    updateClip(selectedClipId, {
      effects: {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        blur: 0,
        grayscale: 0,
        sepia: 0,
        hue: 0,
        vignette: 0,
      },
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-light-pink" />
            Effects
          </h3>
          <button
            onClick={resetEffects}
            className="text-xs text-zinc-400 hover:text-brand-light-pink transition-colors"
          >
            Reset All
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          Apply visual effects to selected clip
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Brightness */}
        <EffectControl
          icon={<Sun className="w-4 h-4" />}
          label="Brightness"
          value={effects.brightness}
          min={0}
          max={200}
          defaultValue={100}
          onChange={(v) => handleEffectChange("brightness", v)}
          unit="%"
        />

        {/* Contrast */}
        <EffectControl
          icon={<Contrast className="w-4 h-4" />}
          label="Contrast"
          value={effects.contrast}
          min={0}
          max={200}
          defaultValue={100}
          onChange={(v) => handleEffectChange("contrast", v)}
          unit="%"
        />

        {/* Saturation */}
        <EffectControl
          icon={<Droplet className="w-4 h-4" />}
          label="Saturation"
          value={effects.saturation}
          min={0}
          max={200}
          defaultValue={100}
          onChange={(v) => handleEffectChange("saturation", v)}
          unit="%"
        />

        {/* Hue Rotate */}
        <EffectControl
          icon={<Palette className="w-4 h-4" />}
          label="Hue"
          value={effects.hue}
          min={0}
          max={360}
          defaultValue={0}
          onChange={(v) => handleEffectChange("hue", v)}
          unit="°"
        />

        {/* Blur */}
        <EffectControl
          icon={<Circle className="w-4 h-4" />}
          label="Blur"
          value={effects.blur}
          min={0}
          max={20}
          defaultValue={0}
          onChange={(v) => handleEffectChange("blur", v)}
          unit="px"
        />

        {/* Grayscale */}
        <EffectControl
          icon={<Circle className="w-4 h-4" />}
          label="Grayscale"
          value={effects.grayscale}
          min={0}
          max={100}
          defaultValue={0}
          onChange={(v) => handleEffectChange("grayscale", v)}
          unit="%"
        />

        {/* Sepia */}
        <EffectControl
          icon={<Circle className="w-4 h-4" />}
          label="Sepia"
          value={effects.sepia}
          min={0}
          max={100}
          defaultValue={0}
          onChange={(v) => handleEffectChange("sepia", v)}
          unit="%"
        />

        {/* Vignette */}
        <EffectControl
          icon={<Circle className="w-4 h-4" />}
          label="Vignette"
          value={effects.vignette}
          min={0}
          max={100}
          defaultValue={0}
          onChange={(v) => handleEffectChange("vignette", v)}
          unit="%"
        />
      </div>

      {/* Presets */}
      <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/30">
        <p className="text-xs font-medium text-zinc-400 mb-3">Quick Presets</p>
        <div className="grid grid-cols-2 gap-2">
          <PresetButton
            label="Vintage"
            onClick={() => {
              updateClip(selectedClipId, {
                effects: {
                  ...effects,
                  brightness: 110,
                  contrast: 120,
                  saturation: 80,
                  sepia: 40,
                  vignette: 30,
                },
              });
            }}
          />
          <PresetButton
            label="Black & White"
            onClick={() => {
              updateClip(selectedClipId, {
                effects: {
                  ...effects,
                  grayscale: 100,
                  contrast: 120,
                },
              });
            }}
          />
          <PresetButton
            label="Vibrant"
            onClick={() => {
              updateClip(selectedClipId, {
                effects: {
                  ...effects,
                  brightness: 105,
                  contrast: 110,
                  saturation: 140,
                },
              });
            }}
          />
          <PresetButton
            label="Cinematic"
            onClick={() => {
              updateClip(selectedClipId, {
                effects: {
                  ...effects,
                  brightness: 95,
                  contrast: 115,
                  saturation: 90,
                  vignette: 40,
                },
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}

interface EffectControlProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  onChange: (value: number) => void;
  unit?: string;
}

function EffectControl({
  icon,
  label,
  value,
  min,
  max,
  defaultValue,
  onChange,
  unit = "",
}: EffectControlProps) {
  const isModified = value !== defaultValue;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-300">
          <span className="text-zinc-500">{icon}</span>
          {label}
        </label>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-mono min-w-[50px] text-right ${
              isModified ? "text-brand-light-pink" : "text-zinc-400"
            }`}
          >
            {value}
            {unit}
          </span>
          {isModified && (
            <button
              onClick={() => onChange(defaultValue)}
              className="text-[10px] text-zinc-500 hover:text-brand-light-pink transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="pro-slider w-full"
      />
    </div>
  );
}

function PresetButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 text-xs font-medium text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-brand-light-pink/30 rounded-lg transition-all duration-150"
    >
      {label}
    </button>
  );
}
