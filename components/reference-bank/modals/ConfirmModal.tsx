"use client";

import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "danger" | "default";
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({
  title,
  description,
  confirmLabel = "Confirm",
  variant = "danger",
  isLoading = false,
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#1a1625] rounded-2xl shadow-2xl max-w-sm w-full border border-[#EC67A1]/20 dark:border-[#EC67A1]/30">
        <div className="flex items-center justify-between p-4 border-b border-[#EC67A1]/10 dark:border-[#EC67A1]/20">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          </button>
        </div>

        <div className="p-4">
          <div className={`flex items-start gap-3 p-3 rounded-xl border ${
            variant === "danger"
              ? "bg-red-500/10 border-red-500/20"
              : "bg-amber-500/10 border-amber-500/20"
          }`}>
            <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${
              variant === "danger" ? "text-red-500" : "text-amber-500"
            }`} />
            <p className={`text-sm ${
              variant === "danger"
                ? "text-red-700 dark:text-red-400"
                : "text-amber-700 dark:text-amber-400"
            }`}>
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#EC67A1]/10 dark:border-[#EC67A1]/20">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              variant === "danger"
                ? "bg-red-600 hover:bg-red-500"
                : "bg-amber-600 hover:bg-amber-500"
            }`}
          >
            {isLoading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
