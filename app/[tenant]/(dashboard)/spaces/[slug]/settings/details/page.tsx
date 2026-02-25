'use client';

import { useParams } from 'next/navigation';
import { SpaceSettingsDetails } from './SpaceSettingsDetails';

export default function SpaceSettingsDetailsPage() {
  const params = useParams<{ slug: string }>();

  return <SpaceSettingsDetails slug={params.slug} />;
}
