'use client';

import { Suspense } from 'react';
import { SchedulerGrid } from '@/components/scheduler/SchedulerGrid';

export default function SchedulerPage() {
  return (
    <div className="p-1 md:p-2 h-full">
      <Suspense>
        <SchedulerGrid />
      </Suspense>
    </div>
  );
}
