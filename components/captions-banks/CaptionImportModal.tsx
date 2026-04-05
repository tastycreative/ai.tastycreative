'use client';

import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
import { IMPORTED_SHEETS } from './utils';
import { useImportCaptions } from '@/lib/hooks/useCaptions.query';
import type { ImportResult } from '@/lib/hooks/useCaptions.query';

interface CaptionImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function CaptionImportModal({ open, onClose, onImportComplete, showToast }: CaptionImportModalProps) {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const importMutation = useImportCaptions();

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportProgress(0);
    try {
      const result = await importMutation.mutateAsync({
        file: importFile,
        onProgress: setImportProgress,
      });
      setImportResult(result);
      if (result.imported > 0) {
        showToast(`Imported ${result.imported} captions`, 'success');
        onImportComplete();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.xlsx')) {
      setImportFile(file);
      setImportResult(null);
    } else {
      showToast('Please drop a .xlsx file', 'error');
    }
  }, [showToast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResult(null);
    }
  }, []);

  const handleClose = () => {
    if (!importing) {
      setImportFile(null);
      setImportResult(null);
      setImportProgress(0);
      onClose();
    }
  };

  if (!open) return null;
  if (typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-brand-off-white">Import Spreadsheet</h2>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/[0.04] rounded-lg" disabled={importing}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-100px)]">
          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              isDragging
                ? 'border-emerald-500 bg-emerald-500/5'
                : 'border-gray-200 dark:border-white/[0.1] hover:border-emerald-500/50'
            }`}
          >
            {importFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-brand-off-white">{importFile.name}</p>
                  <p className="text-xs font-mono text-gray-500">{(importFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  onClick={() => { setImportFile(null); setImportResult(null); }}
                  className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-white/[0.04] rounded"
                  disabled={importing}
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Drag & drop your <span className="font-mono text-emerald-500">.xlsx</span> file here
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">or</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg cursor-pointer text-sm font-medium transition-colors">
                  <Upload className="w-4 h-4" /> Browse Files
                  <input type="file" accept=".xlsx" onChange={handleFileSelect} className="hidden" />
                </label>
              </>
            )}
          </div>

          {/* Sheets */}
          <div>
            <p className="text-[10px] font-mono tracking-[0.1em] text-gray-500 uppercase mb-2">Importable Sheets</p>
            <div className="flex flex-wrap gap-1.5">
              {IMPORTED_SHEETS.map(sheet => (
                <span key={sheet} className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
                  {sheet}
                </span>
              ))}
            </div>
          </div>

          {/* Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-gray-500">
                <span>{importProgress < 50 ? 'Uploading...' : importProgress < 90 ? 'Processing...' : 'Saving...'}</span>
                <span>{importProgress}%</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Result */}
          {importResult && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {importResult.imported > 0 ? (
                  <Check className="w-5 h-5 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                )}
                <span className="text-sm font-medium text-gray-900 dark:text-brand-off-white">
                  {importResult.imported > 0 ? 'Import Complete' : 'No New Captions'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-3 text-center border border-gray-100 dark:border-white/[0.06]">
                  <p className="text-lg font-bold text-emerald-500">{importResult.imported}</p>
                  <p className="text-[10px] font-mono tracking-[0.1em] text-gray-500 uppercase">Imported</p>
                </div>
                <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-3 text-center border border-gray-100 dark:border-white/[0.06]">
                  <p className="text-lg font-bold text-amber-500">{importResult.duplicatesSkipped}</p>
                  <p className="text-[10px] font-mono tracking-[0.1em] text-gray-500 uppercase">Skipped</p>
                </div>
                <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-3 text-center border border-gray-100 dark:border-white/[0.06]">
                  <p className="text-lg font-bold text-gray-900 dark:text-brand-off-white">{importResult.totalProcessed}</p>
                  <p className="text-[10px] font-mono tracking-[0.1em] text-gray-500 uppercase">Total</p>
                </div>
              </div>
              {importResult.sheetStats && Object.keys(importResult.sheetStats).length > 0 && (
                <div>
                  <p className="text-[10px] font-mono tracking-[0.1em] text-gray-500 uppercase mb-2">Per Sheet</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {Object.entries(importResult.sheetStats).map(([sheet, count]) => (
                      <div key={sheet} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-white/[0.03] rounded-lg border border-gray-100 dark:border-white/[0.06]">
                        <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{sheet}</span>
                        <span className="text-xs font-mono font-semibold text-emerald-500 ml-2">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import button */}
          {!importResult && (
            <button
              onClick={handleImport}
              disabled={!importFile || importing}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-white/[0.06] disabled:text-gray-400 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {importing ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Import Captions
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
