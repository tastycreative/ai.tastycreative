'use client';

import { useParams } from 'next/navigation';
import { SpaceChecklistSettings } from './SpaceChecklistSettings';

export default function SpaceChecklistPage() {
  const params = useParams<{ slug: string }>();

  return <SpaceChecklistSettings slug={params.slug} />;
}
