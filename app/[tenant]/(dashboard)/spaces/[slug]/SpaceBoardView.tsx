'use client';

import { useSpaceBySlug } from '@/lib/hooks/useSpaces.query';
import { Loader2 } from 'lucide-react';
import {
  KanbanTemplate,
  WallPostTemplate,
  SextingSetsTemplate,
  OtpPtrTemplate,
} from './templates';
import type { SpaceWithBoards } from '@/lib/hooks/useSpaces.query';
import type { ComponentType } from 'react';
import type { TemplateProps } from './templates';

/* ------------------------------------------------------------------ */
/*  Template registry — maps templateType → component                  */
/* ------------------------------------------------------------------ */

const TEMPLATE_COMPONENTS: Record<string, ComponentType<TemplateProps>> = {
  KANBAN: KanbanTemplate,
  WALL_POST: WallPostTemplate,
  SEXTING_SETS: SextingSetsTemplate,
  OTP_PTR: OtpPtrTemplate,
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface SpaceBoardViewProps {
  slug: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function SpaceBoardView({ slug }: SpaceBoardViewProps) {
  const { data: space, isLoading } = useSpaceBySlug(slug);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-light-pink" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          Loading space...
        </span>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-brand-mid-pink/30 bg-gray-50/70 dark:bg-gray-900/50 px-4 py-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Space not found.
        </p>
      </div>
    );
  }

  const Template = TEMPLATE_COMPONENTS[space.templateType];

  if (!Template) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-brand-mid-pink/30 bg-gray-50/70 dark:bg-gray-900/50 px-4 py-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Unknown template type: <strong>{space.templateType}</strong>
        </p>
      </div>
    );
  }

  return <Template space={space} />;
}
