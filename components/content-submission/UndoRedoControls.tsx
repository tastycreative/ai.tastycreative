'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Undo2, Redo2, RotateCcw } from 'lucide-react';

interface UndoRedoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  historySize: number;
  onUndo: () => void;
  onRedo: () => void;
  onReset?: () => void;
}

export const UndoRedoControls = memo(function UndoRedoControls({
  canUndo,
  canRedo,
  historySize,
  onUndo,
  onRedo,
  onReset,
}: UndoRedoControlsProps) {
  return (
    <div className="inline-flex items-center gap-2 bg-zinc-900/50 border border-zinc-700/50 rounded-xl p-1 backdrop-blur-sm">
      {/* Undo Button */}
      <motion.button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        whileHover={canUndo ? { scale: 1.05 } : {}}
        whileTap={canUndo ? { scale: 0.95 } : {}}
        className={`
          inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-all
          ${
            canUndo
              ? 'text-white hover:bg-zinc-800 cursor-pointer'
              : 'text-zinc-600 cursor-not-allowed'
          }
        `}
        title={`Undo (${historySize} changes)`}
      >
        <Undo2 className="w-4 h-4" />
        <span className="text-sm font-medium hidden sm:inline">Undo</span>
        {canUndo && (
          <span className="text-xs text-zinc-500">
            Ctrl+Z
          </span>
        )}
      </motion.button>

      {/* Divider */}
      <div className="w-px h-6 bg-zinc-700/50" />

      {/* Redo Button */}
      <motion.button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        whileHover={canRedo ? { scale: 1.05 } : {}}
        whileTap={canRedo ? { scale: 0.95 } : {}}
        className={`
          inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-all
          ${
            canRedo
              ? 'text-white hover:bg-zinc-800 cursor-pointer'
              : 'text-zinc-600 cursor-not-allowed'
          }
        `}
        title="Redo"
      >
        <Redo2 className="w-4 h-4" />
        <span className="text-sm font-medium hidden sm:inline">Redo</span>
        {canRedo && (
          <span className="text-xs text-zinc-500">
            Ctrl+Y
          </span>
        )}
      </motion.button>

      {/* Reset Button (optional) */}
      {onReset && (
        <>
          <div className="w-px h-6 bg-zinc-700/50" />
          <motion.button
            type="button"
            onClick={onReset}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
            title="Reset to initial state"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Reset</span>
          </motion.button>
        </>
      )}
    </div>
  );
});
