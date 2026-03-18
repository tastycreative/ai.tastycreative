'use client';

import { useEffect, useState, useCallback, Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const SubmissionForm = lazy(() =>
  import('./SubmissionForm').then((mod) => ({ default: mod.SubmissionForm }))
);

interface SubmissionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateType: 'OTP_PTR' | 'WALL_POST' | 'SEXTING_SETS';
  spaceSlugs: string[];
}

export function SubmissionFormModal({
  isOpen,
  onClose,
  templateType,
  spaceSlugs,
}: SubmissionFormModalProps) {
  const [mounted, setMounted] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleSuccess = useCallback(
    (id: string) => {
      // Refresh board data so the new task appears
      queryClient.invalidateQueries({ queryKey: ['board-items'] });
      onClose();
    },
    [queryClient, onClose],
  );

  // Steps: for OTP_PTR → [space(0), contentStyle(1), details(2), review(3)] → start at 1
  // For WALL_POST/SEXTING_SETS → [space(0), details(1), review(2)] → start at 1
  const initialStep = 1;

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-60 flex items-start justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal container */}
      <div className="relative z-10 w-full max-w-5xl max-h-[95vh] mt-[2.5vh] overflow-y-auto custom-scrollbar rounded-2xl border border-zinc-700/50 bg-[#0a0a0b] shadow-2xl shadow-black/60 animate-scale-in">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="sticky top-4 right-4 float-right z-20 mr-4 mt-4 p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <Suspense
          fallback={
            <div className="flex items-center justify-center py-32">
              <div className="h-8 w-8 border-2 border-brand-light-pink border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <SubmissionForm
            defaultTemplateType={templateType}
            defaultSpaceSlugs={spaceSlugs}
            initialStep={initialStep}
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
        </Suspense>
      </div>
    </div>,
    document.body,
  );
}
