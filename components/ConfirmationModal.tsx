'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
}: ConfirmationModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    }
  }, [isOpen]);

  if (!mounted || (!isOpen && !isAnimating)) return null;

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleConfirm = () => {
    onConfirm();
    handleClose();
  };

  const variantStyles = {
    danger: {
      icon: 'text-red-500',
      button: 'bg-red-600 hover:bg-red-700 text-white',
      ring: 'ring-red-500/20',
    },
    warning: {
      icon: 'text-yellow-500',
      button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
      ring: 'ring-yellow-500/20',
    },
  };

  const styles = variantStyles[variant];

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] transition-opacity duration-200 ${
          isOpen && isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div
          className={`bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-brand-mid-pink/30 max-w-md w-full transform transition-all duration-200 ${
            isOpen && isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 p-2 rounded-full bg-gray-100 dark:bg-gray-900 ${styles.ring} ring-4`}>
                <AlertTriangle className={`h-5 w-5 ${styles.icon}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-brand-off-white">
                  {title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {message}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-brand-mid-pink/30 bg-white/80 dark:bg-gray-900/80 text-gray-500 hover:text-gray-900 dark:hover:text-brand-off-white hover:border-brand-light-pink/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-6 pb-6">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-brand-mid-pink/30 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-md ${styles.button}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
