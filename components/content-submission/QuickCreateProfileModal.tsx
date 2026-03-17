'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { useInstagramProfiles } from '@/lib/hooks/useInstagramProfiles.query';

interface QuickCreateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (profile: { id: string; name: string }) => void;
}

export function QuickCreateProfileModal({
  isOpen,
  onClose,
  onCreated,
}: QuickCreateProfileModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { data: existingProfiles } = useInstagramProfiles();

  // Check if name already exists (case-insensitive)
  const nameExists = useMemo(() => {
    if (!name.trim() || !existingProfiles) return false;
    const trimmed = name.trim().toLowerCase();
    return existingProfiles.some((p) => p.name.toLowerCase() === trimmed);
  }, [name, existingProfiles]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setName('');
    }
  }, [isOpen]);

  if (!mounted || (!isOpen && !isAnimating)) return null;

  const handleClose = () => {
    if (saving) return;
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Please enter a profile name');
      return;
    }
    if (nameExists) {
      toast.error('A profile with this name already exists');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/instagram-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type: 'real',
          shareWithOrganization: true,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create profile');
      }

      const newProfile = await response.json();
      toast.success('Profile created!');

      // Invalidate profiles query so dropdown refreshes
      queryClient.invalidateQueries({ queryKey: ['instagram-profiles', user?.id] });

      // Dispatch event to refresh profile list in sidebar
      if (newProfile?.id) {
        window.dispatchEvent(
          new CustomEvent('profilesUpdated', {
            detail: { profileId: newProfile.id, mode: 'create' },
          })
        );
      }

      onCreated({ id: newProfile.id, name: newProfile.name });
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setSaving(false);
    }
  };

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
          className={`bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-brand-mid-pink/30 max-w-md w-full transform transition-all duration-200 ${
            isOpen && isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-light-pink/10">
                <UserPlus className="h-5 w-5 text-brand-light-pink" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  Create Profile
                </h3>
                <p className="text-xs text-zinc-500">
                  Add a new influencer profile
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={saving}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Form */}
          <div className="px-6 py-5">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Profile Name <span className="text-brand-light-pink">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter model name..."
              disabled={saving}
              className={`w-full bg-white dark:bg-zinc-900/60 border ${
                nameExists
                  ? 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-zinc-300 dark:border-zinc-700/50 focus:border-brand-light-pink focus:ring-brand-light-pink/20'
              } focus:ring-2 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 rounded-xl px-4 py-3 transition-all duration-150 disabled:opacity-50`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !saving && !nameExists) handleSubmit();
              }}
            />
            {nameExists && (
              <div className="flex items-center gap-1.5 mt-2 text-red-500 dark:text-red-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <p className="text-xs">A profile with this name already exists</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-6 pb-6 pt-2">
            <button
              onClick={handleClose}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !name.trim() || nameExists}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md bg-brand-light-pink hover:bg-brand-mid-pink text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Create Profile
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
