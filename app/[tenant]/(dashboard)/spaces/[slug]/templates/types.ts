import type { SpaceWithBoards } from '@/lib/hooks/useSpaces.query';

/**
 * Shared props every template component receives.
 * Templates can extend this if they need extra props.
 */
export interface TemplateProps {
  space: SpaceWithBoards;
}
