'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Layers, Lock, Globe } from 'lucide-react';
import type { Space } from '@/lib/hooks/useSpaces.query';

const TEMPLATE_LABELS: Record<string, string> = {
  KANBAN: 'Kanban',
  WALL_POST: 'Wall Post',
  SEXTING_SETS: 'Sexting Sets',
  OTP_PTR: 'OTP/PTR',
};

const TEMPLATE_COLORS: Record<string, string> = {
  KANBAN: 'bg-brand-blue/10 text-brand-blue',
  WALL_POST: 'bg-brand-light-pink/10 text-brand-light-pink',
  SEXTING_SETS: 'bg-purple-500/10 text-purple-500',
  OTP_PTR: 'bg-amber-500/10 text-amber-500',
};

export function SpaceCard({ space }: { space: Space }) {
  const params = useParams<{ tenant: string }>();

  return (
    <Link
      href={`/${params.tenant}/spaces/${space.slug}`}
      className="group block w-full rounded-2xl border border-gray-200 dark:border-brand-mid-pink/20 bg-white/80 dark:bg-gray-900/70 px-4 py-3 sm:px-5 sm:py-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-brand-off-white truncate group-hover:text-brand-light-pink transition-colors">
              {space.name}
            </h3>
            <span className={`inline-flex items-center rounded-full text-[10px] sm:text-xs font-medium px-2 py-0.5 ${TEMPLATE_COLORS[space.templateType] ?? 'bg-gray-100 text-gray-500'}`}>
              {TEMPLATE_LABELS[space.templateType] ?? space.templateType}
            </span>
          </div>
          {space.description && (
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
              {space.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            {space.key && (
              <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5">
                {space.key}
              </span>
            )}
            {space.access === 'PRIVATE' ? (
              <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                <Lock className="h-2.5 w-2.5" /> Private
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                <Globe className="h-2.5 w-2.5" /> Open
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-light-pink/10 text-brand-light-pink">
            <Layers className="h-4 w-4" />
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {new Date(space.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </Link>
  );
}
