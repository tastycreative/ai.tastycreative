'use client';

import { useParams } from 'next/navigation';
import { SpaceAccessSettings } from './SpaceAccessSettings';

export default function SpaceAccessPage() {
  const params = useParams<{ slug: string }>();
  return <SpaceAccessSettings slug={params.slug} />;
}
