'use client';

import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings, Users, Loader2, Sparkles } from 'lucide-react';
import { useSpaceBySlug } from '@/lib/hooks/useSpaces.query';

const NAV_ITEMS = [
  { id: 'details', label: 'Details', icon: Settings, segment: 'details' },
  { id: 'access', label: 'Access', icon: Users, segment: 'access' },
];

export default function SpaceSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ tenant: string; slug: string }>();
  const pathname = usePathname();
  const { data: space, isLoading } = useSpaceBySlug(params.slug);

  const basePath = `/${params.tenant}/spaces/${params.slug}/settings`;
  const spacePath = `/${params.tenant}/spaces/${params.slug}`;

  // Determine active segment from pathname
  const activeSegment = NAV_ITEMS.find((item) =>
    pathname.includes(`/settings/${item.segment}`),
  )?.id ?? 'details';

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-gray-200 dark:border-brand-mid-pink/15 bg-white/50 dark:bg-gray-950/60 flex flex-col">
        {/* Creative Ink Header */}
        <div className="px-6 py-6 border-b border-gray-200 dark:border-brand-mid-pink/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-brand-light-pink via-brand-mid-pink to-brand-blue flex items-center justify-center shadow-lg shadow-brand-light-pink/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 dark:text-brand-off-white">
                Creative Ink
              </h1>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium tracking-wide uppercase">
                AI Content Studio
              </p>
            </div>
          </div>
        </div>

        {/* Space name */}
        <div className="px-6 pt-6 pb-4">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              <span className="text-xs text-gray-400">Loading...</span>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                Space settings
              </p>
              <h2 className="text-base font-bold text-gray-900 dark:text-brand-off-white truncate">
                {space?.name ?? 'Unknown'}
              </h2>
            </>
          )}
        </div>

        {/* Back to space */}
        <div className="px-6 pb-4">
          <Link
            href={spacePath}
            className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to space
          </Link>
        </div>

        {/* Divider */}
        <div className="border-b border-gray-200 dark:border-brand-mid-pink/10" />

        {/* Nav items */}
        <nav className="flex-1 px-6 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSegment === item.id;
            return (
              <Link
                key={item.id}
                href={`${basePath}/${item.segment}`}
                className={[
                  'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                  isActive
                    ? 'bg-brand-light-pink/10 text-brand-light-pink shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50',
                ].join(' ')}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Content - Centered with max width */}
      <main className="flex-1 overflow-y-auto bg-gray-50/30 dark:bg-gray-900/20">
        <div className="max-w-4xl mx-auto px-6 py-8 lg:px-8 lg:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
