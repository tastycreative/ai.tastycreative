"use client";

import { memo } from "react";
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  Upload,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { UploadQueueItem } from "@/lib/reference-bank/api";

interface UploadQueueProps {
  items: UploadQueueItem[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export const UploadQueue = memo(function UploadQueue({
  items,
  isExpanded,
  onToggleExpand,
  onRetry,
  onRemove,
  onClear,
}: UploadQueueProps) {
  if (items.length === 0) return null;

  const uploading = items.filter((i) => i.status === "uploading").length;
  const pending = items.filter((i) => i.status === "pending").length;
  const completed = items.filter((i) => i.status === "success").length;
  const failed = items.filter((i) => i.status === "error").length;
  const duplicates = items.filter((i) => i.status === "duplicate").length;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-96 max-w-[calc(100vw-2rem)]">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 bg-gray-800/50 cursor-pointer hover:bg-gray-800/70 transition-colors"
          onClick={onToggleExpand}
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-violet-500/20 rounded-lg">
              <Upload className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">Upload Queue</h3>
              <p className="text-xs text-gray-400">
                {uploading > 0 && `${uploading} uploading`}
                {pending > 0 && `${uploading > 0 ? ", " : ""}${pending} pending`}
                {completed > 0 && ` • ${completed} done`}
                {failed > 0 && ` • ${failed} failed`}
                {duplicates > 0 && ` • ${duplicates} duplicates`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(completed > 0 || failed > 0 || duplicates > 0) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                title="Clear completed"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>

        {/* Queue list */}
        {isExpanded && (
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-800">
            {items.map((item) => (
              <div
                key={item.id}
                className="px-4 py-3 flex items-center gap-3 hover:bg-gray-800/30 transition-colors"
              >
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {item.status === "uploading" && (
                    <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                  )}
                  {item.status === "pending" && (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
                  )}
                  {item.status === "success" && (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  )}
                  {item.status === "error" && (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  )}
                  {item.status === "duplicate" && (
                    <Copy className="w-5 h-5 text-yellow-400" />
                  )}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{item.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">
                      {formatFileSize(item.file.size)}
                    </span>
                    {item.status === "uploading" && (
                      <span className="text-xs text-violet-400">{item.progress}%</span>
                    )}
                    {item.status === "error" && item.error && (
                      <span className="text-xs text-red-400 truncate">{item.error}</span>
                    )}
                    {item.status === "duplicate" && item.error && (
                      <span className="text-xs text-yellow-400 truncate">{item.error}</span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {item.status === "uploading" && (
                    <div className="mt-1.5 w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-1">
                  {item.status === "error" && item.retryCount < 3 && (
                    <button
                      onClick={() => onRetry(item.id)}
                      className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                      title="Retry"
                    >
                      <RefreshCw className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                  {(item.status === "error" || item.status === "duplicate" || item.status === "success") && (
                    <button
                      onClick={() => onRemove(item.id)}
                      className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                      title="Remove"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
