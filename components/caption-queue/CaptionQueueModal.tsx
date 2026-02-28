'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ClipboardList } from 'lucide-react';
import { CaptionQueueForm } from './CaptionQueueForm';

interface CaptionQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CaptionQueueModal({ isOpen, onClose, onSuccess }: CaptionQueueModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Drive enter / exit animation
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
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
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? 'bg-black/65 backdrop-blur-md' : 'bg-transparent backdrop-blur-none'
      }`}
      onClick={onClose}
    >
      {/* Ambient glow behind the panel */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-175 h-87.5 bg-brand-mid-pink/8 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 translate-y-1/2 w-125 h-62.5 bg-brand-blue/6 blur-[100px] rounded-full" />
      </div>

      {/* Panel */}
      <div
        className={`relative max-w-4xl w-full max-h-[90vh] overflow-hidden rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.5)] border transition-all duration-300
          bg-white dark:bg-[#0d0b16]
          border-zinc-200/80 dark:border-white/8
          ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.97] translate-y-3'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-brand-mid-pink/70 to-transparent" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-white/6">
          {/* Subtle header tint */}
          <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-brand-mid-pink/4 to-transparent" />

          <div className="relative flex items-center gap-3.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-mid-pink/10 dark:bg-brand-mid-pink/15 border border-brand-mid-pink/20 dark:border-brand-mid-pink/25 shadow-sm shadow-brand-mid-pink/10">
              <ClipboardList className="w-4.5 h-4.5 text-brand-mid-pink" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white tracking-tight">
                Add to Caption Queue
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-white/35 mt-0.5">
                Create a new caption writing task for your content
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="relative flex items-center justify-center w-7 h-7 rounded-lg
              bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10
              border border-zinc-200 dark:border-white/8 hover:border-zinc-300 dark:hover:border-white/15
              text-zinc-400 hover:text-zinc-600 dark:text-white/40 dark:hover:text-white/70
              transition-all duration-200"
            aria-label="Close modal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable form */}
        <div className="overflow-y-auto max-h-[calc(90vh-73px)] custom-scrollbar bg-zinc-50 dark:bg-[#0a0812]">
          <div className="px-6 py-5">
            <CaptionQueueForm onSuccess={handleSuccess} onCancel={onClose} />
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
