'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, PlusCircle } from 'lucide-react';
import { CaptionQueueForm } from './CaptionQueueForm';

interface CaptionQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CaptionQueueModal({ isOpen, onClose, onSuccess }: CaptionQueueModalProps) {
  const [mounted, setMounted] = useState(false);

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleSuccess = () => {
    onSuccess();
    onClose();
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1a1625] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-brand-mid-pink/20 dark:border-brand-mid-pink/30"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-linear-to-r from-brand-mid-pink to-brand-light-pink p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <PlusCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Add to Caption Queue</h2>
                <p className="text-brand-off-white text-sm mt-1">
                  Create a new caption writing task for your content
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable Form */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)] custom-scrollbar bg-brand-off-white dark:bg-[#0f0d18]">
          <div className="p-6">
            <CaptionQueueForm onSuccess={handleSuccess} onCancel={onClose} />
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
