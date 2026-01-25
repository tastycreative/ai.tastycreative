'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Download,
  Loader2,
  FileText,
  Settings2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Star,
  Library,
} from 'lucide-react';
import PlatformSelector, { usePlatformSelection } from './PlatformSelector';
import ExportPreview from './ExportPreview';
import { PlatformId } from '@/lib/export/platform-specs';

interface ExportImage {
  url?: string;
  s3Key?: string;
  filename: string;
  caption?: string;
}

interface Caption {
  id: string;
  caption: string;
  captionCategory: string;
  captionTypes: string;
  isFavorite: boolean;
}

interface PlatformExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: ExportImage[];
  defaultModelName?: string;
  defaultCaption?: string;
  profileId?: string;
  onExportComplete?: (result: { filename: string; fileCount: number }) => void;
}

type ExportStatus = 'idle' | 'exporting' | 'success' | 'error';

// Variable keys for caption templates
const VARIABLE_KEYS = [
  'model_name',
  'price',
  'subscription_price',
  'bundle_price',
  'tip_amount',
  'username',
  'link',
] as const;

type VariableKey = typeof VARIABLE_KEYS[number];
type Variables = Record<VariableKey, string>;

export default function PlatformExportModal({
  isOpen,
  onClose,
  images,
  defaultModelName = '',
  defaultCaption = '',
  profileId,
  onExportComplete,
}: PlatformExportModalProps) {
  const [mounted, setMounted] = useState(false);
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<string>('');

  // Form state
  const [exportName, setExportName] = useState(defaultModelName || 'export');
  const [modelName, setModelName] = useState(defaultModelName);
  const [captionTemplate, setCaptionTemplate] = useState(defaultCaption);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imageQuality, setImageQuality] = useState(85);
  const [imageFormat, setImageFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg');

  // Caption Bank state
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [loadingCaptions, setLoadingCaptions] = useState(false);
  const [selectedCaptionId, setSelectedCaptionId] = useState<string>('');
  const [showCaptionDropdown, setShowCaptionDropdown] = useState(false);

  // Variables state
  const [variables, setVariables] = useState<Record<string, string>>({
    model_name: defaultModelName,
  });

  // Platform selection
  const {
    selectedPlatforms,
    togglePlatform,
    selectAll,
    clearAll,
  } = usePlatformSelection(['onlyfans', 'instagram-posts']);

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setExportStatus('idle');
      setExportError(null);
      setExportProgress('');
      setSelectedCaptionId('');
      if (defaultModelName) {
        setExportName(defaultModelName);
        setModelName(defaultModelName);
        setVariables((prev) => ({ ...prev, model_name: defaultModelName }));
      }
      if (defaultCaption) {
        setCaptionTemplate(defaultCaption);
      }
    }
  }, [isOpen, defaultModelName, defaultCaption]);

  // Fetch captions from Caption Bank
  useEffect(() => {
    if (isOpen && profileId) {
      const fetchCaptions = async () => {
        setLoadingCaptions(true);
        try {
          const response = await fetch(`/api/captions?profileId=${profileId}&sortBy=usageCount&sortOrder=desc`);
          if (response.ok) {
            const data = await response.json();
            setCaptions(data);
          }
        } catch (error) {
          console.error('Failed to fetch captions:', error);
        } finally {
          setLoadingCaptions(false);
        }
      };
      fetchCaptions();
    }
  }, [isOpen, profileId]);

  // Handle caption selection from dropdown
  const handleCaptionSelect = useCallback((captionId: string) => {
    setSelectedCaptionId(captionId);
    setShowCaptionDropdown(false);
    if (captionId) {
      const selected = captions.find(c => c.id === captionId);
      if (selected) {
        setCaptionTemplate(selected.caption);
      }
    }
  }, [captions]);

  // Update variable
  const handleVariableChange = useCallback((key: string, value: string) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Insert variable into caption
  const insertVariable = useCallback((key: string) => {
    setCaptionTemplate((prev) => `${prev}{{${key}}}`);
  }, []);

  // Handle export
  const handleExport = async () => {
    if (images.length === 0 || selectedPlatforms.length === 0) {
      setExportError('Please select images and at least one platform');
      return;
    }

    setExportStatus('exporting');
    setExportError(null);
    setExportProgress('Preparing export...');

    try {
      setExportProgress('Processing images...');

      // Build variables object (only include non-empty values)
      const exportVariables: Record<string, string | number | undefined> = {};
      Object.entries(variables).forEach(([key, value]) => {
        if (value && value.trim()) {
          exportVariables[key] = value.trim();
        }
      });

      const response = await fetch('/api/export/platform-ready', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: images.map((img) => ({
            url: img.url,
            s3Key: img.s3Key,
            filename: img.filename,
            caption: img.caption,
          })),
          platforms: selectedPlatforms,
          captionTemplate: captionTemplate || undefined,
          variables: exportVariables,
          exportName,
          modelName: modelName || undefined,
          includeManifest: true,
          imageQuality,
          imageFormat,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      setExportProgress('Generating ZIP file...');

      // Get filename from response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `${exportName}-export.zip`;

      // Get file count from headers
      const fileCount = parseInt(response.headers.get('X-Export-File-Count') || '0', 10);

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setExportStatus('success');
      setExportProgress(`Downloaded ${filename}`);

      // Notify parent
      if (onExportComplete) {
        onExportComplete({ filename, fileCount });
      }

      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('error');
      setExportError(error instanceof Error ? error.message : 'Export failed');
      setExportProgress('');
    }
  };

  if (!isOpen || !mounted) return null;

  const canExport = images.length > 0 && selectedPlatforms.length > 0 && exportStatus !== 'exporting';

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full mx-4 border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Platform-Ready Export
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Export {images.length} image{images.length !== 1 ? 's' : ''} with platform-optimized sizing
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={exportStatus === 'exporting'}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Export Name & Model */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Export Name
              </label>
              <input
                type="text"
                value={exportName}
                onChange={(e) => setExportName(e.target.value)}
                placeholder="my-export"
                disabled={exportStatus === 'exporting'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Model Name (Optional)
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => {
                  setModelName(e.target.value);
                  handleVariableChange('model_name', e.target.value);
                }}
                placeholder="Enter model name"
                disabled={exportStatus === 'exporting'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
              />
            </div>
          </div>

          {/* Platform Selection */}
          <PlatformSelector
            selectedPlatforms={selectedPlatforms}
            onTogglePlatform={togglePlatform}
            onSelectAll={selectAll}
            onClearAll={clearAll}
            disabled={exportStatus === 'exporting'}
          />

          {/* Caption Template */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Caption Template
              </label>
              <div className="flex flex-wrap gap-1">
                {VARIABLE_KEYS.slice(0, 4).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => insertVariable(key)}
                    disabled={exportStatus === 'exporting'}
                    className="text-[10px] px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50"
                  >
                    {`{{${key}}}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Caption Bank Dropdown */}
            {profileId && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCaptionDropdown(!showCaptionDropdown)}
                  disabled={exportStatus === 'exporting' || loadingCaptions}
                  className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <Library className="w-4 h-4 text-purple-500" />
                    {loadingCaptions ? (
                      <span className="text-gray-400">Loading captions...</span>
                    ) : selectedCaptionId ? (
                      <span className="truncate max-w-[300px]">
                        {captions.find(c => c.id === selectedCaptionId)?.caption.slice(0, 50)}...
                      </span>
                    ) : (
                      <span className="text-gray-400">Select from Caption Bank ({captions.length})</span>
                    )}
                  </span>
                  {loadingCaptions ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  ) : (
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showCaptionDropdown ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {showCaptionDropdown && captions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCaptionId('');
                        setCaptionTemplate('');
                        setShowCaptionDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700"
                    >
                      Clear selection
                    </button>
                    {captions.map((caption) => (
                      <button
                        key={caption.id}
                        type="button"
                        onClick={() => handleCaptionSelect(caption.id)}
                        className={`w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          selectedCaptionId === caption.id ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {caption.isFavorite && (
                            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-purple-600 dark:text-purple-400 mb-0.5">
                              {caption.captionCategory}
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                              {caption.caption}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <textarea
              value={captionTemplate}
              onChange={(e) => {
                setCaptionTemplate(e.target.value);
                setSelectedCaptionId('');
              }}
              placeholder="Enter caption template with variables like {{model_name}}, {{price}}..."
              rows={3}
              disabled={exportStatus === 'exporting'}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 resize-none font-mono text-sm"
            />
          </div>

          {/* Variable Values */}
          {captionTemplate && captionTemplate.includes('{{') && (
            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Variable Values
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {VARIABLE_KEYS.filter((key) =>
                  captionTemplate.includes(`{{${key}}}`)
                ).map((key) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {key.replace(/_/g, ' ')}
                    </label>
                    <input
                      type="text"
                      value={variables[key] || ''}
                      onChange={(e) => handleVariableChange(key, e.target.value)}
                      placeholder={`Enter ${key.replace(/_/g, ' ')}`}
                      disabled={exportStatus === 'exporting'}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Advanced Options */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                Advanced Options
              </span>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {showAdvanced && (
              <div className="p-4 space-y-4 bg-white dark:bg-gray-800">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Image Quality ({imageQuality}%)
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={imageQuality}
                      onChange={(e) => setImageQuality(parseInt(e.target.value))}
                      disabled={exportStatus === 'exporting'}
                      className="w-full accent-purple-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Output Format
                    </label>
                    <select
                      value={imageFormat}
                      onChange={(e) => setImageFormat(e.target.value as 'jpeg' | 'png' | 'webp')}
                      disabled={exportStatus === 'exporting'}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                    >
                      <option value="jpeg">JPEG (smaller size)</option>
                      <option value="png">PNG (lossless)</option>
                      <option value="webp">WebP (modern)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export Preview */}
          <ExportPreview
            images={images}
            selectedPlatforms={selectedPlatforms}
            exportName={exportName}
            modelName={modelName}
            captionTemplate={captionTemplate}
            variables={variables}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 shrink-0">
          {/* Status Messages */}
          {exportStatus === 'error' && exportError && (
            <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {exportError}
            </div>
          )}

          {exportStatus === 'success' && (
            <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
              <CheckCircle className="w-4 h-4 shrink-0" />
              {exportProgress}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={exportStatus === 'exporting'}
              className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={!canExport}
              className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {exportStatus === 'exporting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {exportProgress || 'Exporting...'}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export ZIP
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
