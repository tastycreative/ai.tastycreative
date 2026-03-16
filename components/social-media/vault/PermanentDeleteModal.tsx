'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface PermanentDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemCount: number;
  itemNames?: string[];
  isDeleting?: boolean;
}

export function PermanentDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  itemCount,
  itemNames = [],
  isDeleting = false,
}: PermanentDeleteModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const expectedConfirmText = 'DELETE';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setConfirmText('');
    }
  }, [isOpen]);

  if (!mounted || (!isOpen && !isAnimating)) return null;

  const handleClose = () => {
    if (isDeleting) return;
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
      setConfirmText('');
    }, 200);
  };

  const handleConfirm = () => {
    if (confirmText !== expectedConfirmText || isDeleting) return;
    onConfirm();
  };

  const isConfirmEnabled = confirmText === expectedConfirmText;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998] transition-opacity duration-200 ${
          isOpen && isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div
          className={`bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border-2 border-red-500/50 dark:border-red-500/60 max-w-lg w-full transform transition-all duration-200 ${
            isOpen && isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-red-500/20 dark:border-red-500/30">
            <div className="flex items-start gap-3 flex-1">
              <div className="mt-0.5 p-2.5 rounded-full bg-red-500/10 dark:bg-red-500/20 ring-4 ring-red-500/20">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-red-600 dark:text-red-400">
                  Permanent Deletion
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  This action cannot be undone
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isDeleting}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-brand-mid-pink/30 bg-white/80 dark:bg-gray-900/80 text-gray-500 hover:text-gray-900 dark:hover:text-brand-off-white hover:border-brand-light-pink/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-4">
            {/* Warning Box */}
            <div className="bg-red-500/10 dark:bg-red-500/20 border-2 border-red-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-semibold text-red-600 dark:text-red-400">
                    You are about to permanently delete {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </h4>
                  <ul className="text-sm text-red-600/90 dark:text-red-400/80 space-y-1">
                    <li>• These files will be <strong>permanently erased</strong></li>
                    <li>• No backup or recovery will be possible</li>
                    <li>• This action is <strong>immediate and irreversible</strong></li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Item Preview */}
            {itemNames.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-xl p-4 max-h-32 overflow-y-auto">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Items to be deleted:
                </p>
                <ul className="space-y-1">
                  {itemNames.slice(0, 10).map((name, index) => (
                    <li
                      key={index}
                      className="text-sm text-gray-700 dark:text-gray-300 truncate"
                    >
                      • {name}
                    </li>
                  ))}
                  {itemNames.length > 10 && (
                    <li className="text-sm text-gray-500 dark:text-gray-400 italic">
                      ...and {itemNames.length - 10} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Confirmation Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Type <span className="font-mono font-bold text-red-600 dark:text-red-400">{expectedConfirmText}</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                disabled={isDeleting}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-brand-mid-pink/30 rounded-xl text-gray-900 dark:text-brand-off-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                autoFocus
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-6 pb-6 pt-2">
            <button
              onClick={handleClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-brand-mid-pink/30 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isConfirmEnabled || isDeleting}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600 flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Permanently
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
