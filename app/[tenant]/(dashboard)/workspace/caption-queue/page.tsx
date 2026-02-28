'use client';

import { useState } from 'react';
import { CaptionQueueModal } from '@/components/caption-queue/CaptionQueueModal';
import { CaptionQueueList } from '@/components/caption-queue/CaptionQueueList';
import { Plus, Lock } from 'lucide-react';
import { useOrgRole } from '@/lib/hooks/useOrgRole.query';
import { useCaptionQueueSSE } from '@/lib/hooks/useCaptionQueueSSE';

export default function CaptionQueuePage() {
  const [showModal, setShowModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { canCreateQueue, canViewQueue, role, loading: roleLoading } = useOrgRole();

  // Real-time push: new tickets added by any manager appear instantly
  useCaptionQueueSSE();

  const handleQueueCreated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Show access-denied placeholder while role resolves
  if (!roleLoading && !canViewQueue) {
    return (
      <div className="max-h-[85vh] overflow-y-auto overflow-x-hidden bg-brand-off-white dark:bg-[#0a0a0f] border border-brand-mid-pink/20 dark:border-brand-mid-pink/30 rounded-2xl shadow-lg flex items-center justify-center min-h-[40vh]">
        <div className="text-center px-8 py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-mid-pink/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-brand-mid-pink" />
          </div>
          <h2 className="text-lg font-semibold text-sidebar-foreground mb-2">Access Restricted</h2>
          <p className="text-sm text-header-muted max-w-xs mx-auto">
            Caption Queue is only visible to Owners, Admins, Managers, and Creators within your organization.
          </p>
          {role && (
            <p className="mt-3 text-xs text-header-muted">
              Your current role: <span className="font-semibold text-sidebar-foreground">{role}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[85vh] overflow-y-auto overflow-x-hidden bg-brand-off-white dark:bg-[#0a0a0f] border border-brand-mid-pink/20 dark:border-brand-mid-pink/30 rounded-2xl shadow-lg custom-scrollbar">
      {/* Header */}
      <div className="px-6 py-4 border-b border-brand-mid-pink/20 dark:border-brand-mid-pink/20 bg-white/90 dark:bg-[#1a1625]/90 backdrop-blur-xl sticky top-0 z-40 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-linear-to-br from-brand-mid-pink to-brand-light-pink shadow-lg shadow-brand-mid-pink/30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-sidebar-foreground">Caption Queue Management</h1>
              <p className="text-xs text-header-muted">Create and manage caption writing tasks</p>
            </div>
          </div>

          {/* Only OWNER / ADMIN / MANAGER see the "Add to Queue" button */}
          {canCreateQueue && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-brand-mid-pink to-brand-light-pink hover:from-brand-dark-pink hover:to-brand-mid-pink text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-brand-mid-pink/30"
            >
              <Plus size={16} />
              Add to Queue
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <CaptionQueueList refreshTrigger={refreshTrigger} />
      </div>

      {/* Modal — only renders when canCreateQueue */}
      {canCreateQueue && (
        <CaptionQueueModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={handleQueueCreated}
        />
      )}
    </div>
  );
}
