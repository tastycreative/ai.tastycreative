'use client';

import React from 'react';
import { Image as ImageIcon, FileText, FolderOpen, Download, Info } from 'lucide-react';
import { PlatformId, PLATFORM_SPECS, PLATFORM_FOLDER_NAMES } from '@/lib/export/platform-specs';

interface ExportImage {
  url?: string;
  filename: string;
  caption?: string;
}

interface ExportPreviewProps {
  images: ExportImage[];
  selectedPlatforms: PlatformId[];
  exportName: string;
  modelName?: string;
  captionTemplate?: string;
  variables?: Record<string, string | number | undefined>;
}

export default function ExportPreview({
  images,
  selectedPlatforms,
  exportName,
  modelName,
  captionTemplate,
  variables = {},
}: ExportPreviewProps) {
  // Calculate export statistics
  const totalImages = images.length;
  const totalPlatforms = selectedPlatforms.length;
  const totalFiles = totalImages * totalPlatforms; // Images per platform
  const captionsCount = totalPlatforms; // One captions.txt per platform folder

  // Preview variable replacement
  const previewCaption = React.useMemo(() => {
    if (!captionTemplate) return null;

    let preview = captionTemplate;
    Object.entries(variables).forEach(([key, value]) => {
      if (value !== undefined) {
        preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
      }
    });

    // Highlight unreplaced variables
    preview = preview.replace(/\{\{(\w+)\}\}/g, '<span class="text-amber-500">{{$1}}</span>');

    return preview;
  }, [captionTemplate, variables]);

  if (totalImages === 0 || totalPlatforms === 0) {
    return (
      <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/30">
        <Download className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {totalImages === 0 ? 'No images selected' : 'No platforms selected'}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {totalImages === 0 ? 'Select images to export' : 'Select at least one platform'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Export Summary */}
      <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          Export Preview
        </h4>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {totalImages}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Images</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {totalPlatforms}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Platforms</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {totalFiles + captionsCount + 2}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Files</div>
          </div>
        </div>

        {/* Folder Structure Preview */}
        <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 font-mono text-xs">
          <div className="text-gray-600 dark:text-gray-300">
            <span className="text-purple-600 dark:text-purple-400">📁</span>{' '}
            {exportName || 'export'}-{new Date().toISOString().split('T')[0]}.zip
          </div>
          <div className="ml-4 mt-1 space-y-1">
            {selectedPlatforms.slice(0, 4).map((platformId) => {
              const folderName = PLATFORM_FOLDER_NAMES[platformId];
              const spec = PLATFORM_SPECS[platformId];
              const dim = spec?.dimensions.find((d) => d.recommended) || spec?.dimensions[0];

              return (
                <div key={platformId} className="text-gray-500 dark:text-gray-400">
                  <span className="text-blue-600 dark:text-blue-400">📂</span> {folderName}/
                  <div className="ml-4 space-y-0.5 text-gray-400 dark:text-gray-500">
                    <div>
                      <ImageIcon className="inline w-3 h-3 mr-1" />
                      image-001.jpg
                      {dim && (
                        <span className="text-[10px] ml-1 text-gray-300 dark:text-gray-600">
                          ({dim.width}x{dim.height})
                        </span>
                      )}
                    </div>
                    {totalImages > 1 && (
                      <div className="text-gray-300 dark:text-gray-600">
                        ... {totalImages - 1} more
                      </div>
                    )}
                    <div>
                      <FileText className="inline w-3 h-3 mr-1" />
                      captions.txt
                    </div>
                  </div>
                </div>
              );
            })}
            {selectedPlatforms.length > 4 && (
              <div className="text-gray-300 dark:text-gray-600">
                ... {selectedPlatforms.length - 4} more platforms
              </div>
            )}
            <div className="text-gray-500 dark:text-gray-400 pt-1">
              <FileText className="inline w-3 h-3 mr-1" />
              manifest.json
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              <FileText className="inline w-3 h-3 mr-1" />
              README.txt
            </div>
          </div>
        </div>
      </div>

      {/* Caption Preview */}
      {(captionTemplate || previewCaption) && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            Caption Preview
          </h4>
          <div
            className="text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: previewCaption || 'No caption template provided' }}
          />
          {Object.values(variables).some((v) => v === undefined) && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Some variables are not set and will be removed
            </p>
          )}
        </div>
      )}

      {/* Selected Images Thumbnails */}
      {images.length > 0 && images[0].url && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Selected Images ({images.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {images.slice(0, 8).map((image, index) => (
              <div
                key={index}
                className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
              >
                {image.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image.url}
                    alt={image.filename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-gray-400" />
                  </div>
                )}
              </div>
            ))}
            {images.length > 8 && (
              <div className="w-14 h-14 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  +{images.length - 8}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Model name */}
      {modelName && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Model: <span className="font-medium">{modelName}</span>
        </p>
      )}
    </div>
  );
}
