'use client';

import { useState } from 'react';
import { CaptionQueueForm } from '@/components/caption-queue/CaptionQueueForm';
import { CaptionQueueList } from '@/components/caption-queue/CaptionQueueList';
import { Plus } from 'lucide-react';

export default function CaptionQueuePage() {
  const [showForm, setShowForm] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleQueueCreated = () => {
    setShowForm(false);
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="max-h-[85vh] overflow-y-auto overflow-x-hidden bg-[#F8F8F8] dark:bg-[#0a0a0f] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl shadow-lg custom-scrollbar">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#EC67A1]/20 dark:border-[#EC67A1]/20 bg-white/90 dark:bg-[#1a1625]/90 backdrop-blur-xl sticky top-0 z-40 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#EC67A1] to-[#F774B9] shadow-lg shadow-[#EC67A1]/30">
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
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] hover:from-[#E1518E] hover:to-[#EC67A1] text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-[#EC67A1]/30"
          >
            <Plus size={16} />
            {showForm ? 'Cancel' : 'Add to Queue'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {showForm && (
          <div className="mb-6">
            <CaptionQueueForm onSuccess={handleQueueCreated} onCancel={() => setShowForm(false)} />
          </div>
        )}
        <CaptionQueueList refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}
