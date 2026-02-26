'use client';

import { useState } from 'react';
import { CaptionQueueModal } from '@/components/caption-queue/CaptionQueueModal';
import { CaptionQueueList } from '@/components/caption-queue/CaptionQueueList';
import { Plus } from 'lucide-react';

export default function CaptionQueuePage() {
  const [showModal, setShowModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleQueueCreated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

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
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-brand-mid-pink to-brand-light-pink hover:from-brand-dark-pink hover:to-brand-mid-pink text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-brand-mid-pink/30"
          >
            <Plus size={16} />
            Add to Queue
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <CaptionQueueList refreshTrigger={refreshTrigger} />
      </div>

      {/* Modal */}
      <CaptionQueueModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleQueueCreated}
      />
    </div>
  );
}
