'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Download, Copy, ExternalLink, Check } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useWheelCreatorStore } from '@/stores/wheel-creator-store';
import { THEMES } from '@/lib/wheel-creator/constants';
import { renderFlyer, loadImage, exportFlyerAsPNG } from '@/lib/wheel-creator/flyer-renderer';

export function FlyerPreviewPanel() {
  const { prizes, themeKey, modelName, modelPhotoUrl, modelPhotoFile } = useWheelCreatorStore(
    useShallow((s) => ({
      prizes: s.prizes,
      themeKey: s.themeKey,
      modelName: s.modelName,
      modelPhotoUrl: s.modelPhotoUrl,
      modelPhotoFile: s.modelPhotoFile,
    }))
  );

  const theme = THEMES[themeKey];
  const activePrizes = useMemo(() => prizes.filter((p) => p.enabled), [prizes]);
  const modelPhotoSrc = modelPhotoFile || modelPhotoUrl;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const modelImgRef = useRef<HTMLImageElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load image + render preview in single async effect to avoid race conditions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    async function render() {
      if (modelPhotoSrc) {
        try {
          const img = await loadImage(modelPhotoSrc);
          if (cancelled) return;
          modelImgRef.current = img;
        } catch {
          if (cancelled) return;
          modelImgRef.current = null;
        }
      } else {
        modelImgRef.current = null;
      }

      renderFlyer({
        canvas: canvas!,
        prizes: activePrizes,
        theme,
        modelPhoto: modelImgRef.current,
        modelName,
      });
    }

    render();
    return () => { cancelled = true; };
  }, [activePrizes, theme, modelPhotoSrc, modelName]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const exportCanvas = exportCanvasRef.current;
      if (!exportCanvas) return;

      renderFlyer({
        canvas: exportCanvas,
        prizes: activePrizes,
        theme,
        modelPhoto: modelImgRef.current,
        modelName,
      });

      const blob = await exportFlyerAsPNG(exportCanvas);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${modelName || 'wheel'}-${themeKey}-flyer.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [activePrizes, theme, modelName, themeKey]);

  const handleCopyPrizes = useCallback(() => {
    navigator.clipboard.writeText(activePrizes.map((p) => p.label).join('\n')).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activePrizes]);

  return (
    <div className="w-[320px] bg-gray-900/60 p-3.5 flex flex-col items-center gap-3 overflow-y-auto shrink-0">
      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider self-start">
        Flyer Preview
      </label>

      <div
        className="rounded-lg overflow-hidden transition-shadow"
        style={{
          boxShadow: activePrizes.length > 0 ? `0 0 30px ${theme.accent}15` : 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="block w-full max-w-[290px]"
          style={{ imageRendering: 'auto' }}
        />
      </div>

      <canvas ref={exportCanvasRef} width={1080} height={1080} className="hidden" />

      <button
        onClick={handleExport}
        disabled={exporting || activePrizes.length < 2}
        className="w-full py-2.5 rounded-lg text-sm font-bold tracking-wider cursor-pointer transition-all disabled:cursor-not-allowed"
        style={{
          background: exporting || activePrizes.length < 2
            ? '#141420'
            : `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`,
          color: exporting || activePrizes.length < 2 ? '#3a3a50' : '#000',
          border: `1px solid ${exporting || activePrizes.length < 2 ? '#252540' : theme.accent}`,
          boxShadow: exporting || activePrizes.length < 2 ? 'none' : `0 0 20px ${theme.accent}40`,
          fontFamily: "'Impact', 'Arial Black', sans-serif",
        }}
      >
        {exporting ? (
          'EXPORTING...'
        ) : activePrizes.length < 2 ? (
          'SELECT 2+ PRIZES'
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />
            DOWNLOAD FLYER
          </span>
        )}
      </button>

      {activePrizes.length > 0 && (
        <div className="w-full">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Export Prizes</label>
          <div className="flex flex-col gap-1.5 mt-2">
            <button
              onClick={handleCopyPrizes}
              className="w-full py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all bg-gray-900 hover:bg-gray-800"
              style={{
                border: `1px solid ${copied ? '#4caf5060' : '#252540'}`,
                color: copied ? '#4caf50' : '#666',
              }}
            >
              {copied ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Copied to clipboard!
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <Copy className="w-3.5 h-3.5" /> Copy Prize List
                </span>
              )}
            </button>
            <button
              onClick={() => window.open('https://spinthewheel.app', '_blank')}
              className="w-full py-1.5 rounded-md text-xs font-semibold cursor-pointer bg-gray-900 border border-gray-800 text-gray-500 hover:bg-gray-800 transition-colors"
            >
              <span className="flex items-center justify-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" /> Open spinthewheel.app
              </span>
            </button>
          </div>
          <div className="text-[10px] text-gray-600 mt-2 text-center leading-relaxed">
            Copy prize list → paste into spinthewheel.app to publish
          </div>
        </div>
      )}

      {activePrizes.length === 0 && (
        <div className="text-[11px] text-gray-500 text-center leading-relaxed px-2">
          Toggle prizes in the Prize Bank to start building your wheel
        </div>
      )}
    </div>
  );
}
