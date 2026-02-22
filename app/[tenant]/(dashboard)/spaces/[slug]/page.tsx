'use client';

import { useParams } from 'next/navigation';
import { SpaceBoardView } from './SpaceBoardView';

export default function SpaceSlugPage() {
  const params = useParams<{ slug: string }>();

  return <SpaceBoardView slug={params.slug} />;
}
