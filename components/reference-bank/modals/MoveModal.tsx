"use client";

import { useState } from "react";
import { X, Move, Folder, FolderRoot, Check } from "lucide-react";
import type { ReferenceFolder as FolderType } from "@/lib/reference-bank/api";

interface MoveModalProps {
  folders: FolderType[];
  currentFolderId: string | null;
  selectedCount: number;
  onClose: () => void;
  onMove: (targetFolderId: string | null) => void;
}

export function MoveModal({
  folders,
  currentFolderId,
  selectedCount,
  onClose,
  onMove,
}: MoveModalProps) {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const handleMove = async () => {
    setMoving(true);
    try {
      await onMove(selectedFolder);
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-[#1a1625] rounded-2xl shadow-2xl max-w-md w-full border border-[#EC67A1]/20 dark:border-[#EC67A1]/30">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#EC67A1]/10 dark:border-[#EC67A1]/20">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Move {selectedCount} {selectedCount === 1 ? "Item" : "Items"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Select a destination folder:</p>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {/* Root option */}
            <button
              onClick={() => setSelectedFolder(null)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                selectedFolder === null
                  ? "bg-[#EC67A1]/20 text-[#EC67A1] border-l-2 border-l-[#EC67A1]"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white"
              } ${currentFolderId === null ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={currentFolderId === null}
            >
              <FolderRoot className="w-5 h-5" />
              <span className="flex-1 text-left">Root (No Folder)</span>
              {selectedFolder === null && (
                <Check className="w-4 h-4 text-dropdown-selected-text" />
              )}
            </button>

            {/* Folders */}
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolder(folder.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  selectedFolder === folder.id
                    ? "bg-[#EC67A1]/20 text-[#EC67A1] border-l-2 border-l-[#EC67A1]"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white"
                } ${folder.id === currentFolderId ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={folder.id === currentFolderId}
              >
                <Folder className="w-5 h-5" style={{ color: folder.color }} />
                <span className="flex-1 text-left truncate">{folder.name}</span>
                {selectedFolder === folder.id && (
                  <Check className="w-4 h-4 text-[#EC67A1]" />
                )}
              </button>
            ))}
          </div>

          {folders.length === 0 && (
            <div className="text-center py-8">
              <Folder className="w-10 h-10 text-zinc-400 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-zinc-600 dark:text-zinc-400">No folders created yet</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#EC67A1]/10 dark:border-[#EC67A1]/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={moving || (selectedFolder === null && currentFolderId === null)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] text-white font-medium rounded-lg transition-all shadow-lg shadow-[#EC67A1]/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Move className="w-4 h-4" />
            {moving ? "Moving..." : "Move Here"}
          </button>
        </div>
      </div>
    </div>
  );
}
