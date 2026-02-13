'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDeleteOfModel, type OfModel } from '@/lib/hooks/useOfModels.query';

interface DeleteModelModalProps {
  model: OfModel;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeleteModelModal = React.memo(function DeleteModelModal({
  model,
  onClose,
  onSuccess,
}: DeleteModelModalProps) {
  const [mounted, setMounted] = useState(false);

  const deleteMutation = useDeleteOfModel();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(model.id);
      toast.success('Model deleted successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete model');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl animate-fadeIn overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-rose-500 to-transparent" />

        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Delete Model</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-xl mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 flex items-center justify-center">
              <span className="text-xl font-light text-white">
                {model.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-white">{model.displayName}</p>
              <p className="text-sm text-zinc-500">@{model.slug}</p>
            </div>
          </div>

          <p className="text-zinc-400 mb-6">
            Are you sure you want to delete this model? This action cannot be undone and will permanently remove all associated details, assets, and pricing data.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={deleteMutation.isPending}
              className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="flex-1 relative px-4 py-3 rounded-xl font-medium text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-rose-600 to-red-600" />
              <span className="relative">{deleteMutation.isPending ? 'Deleting...' : 'Delete Model'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
});
