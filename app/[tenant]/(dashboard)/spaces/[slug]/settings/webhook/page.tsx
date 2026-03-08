'use client';

import { useParams } from 'next/navigation';
import { SpaceWebhookSettings } from './SpaceWebhookSettings';

export default function SpaceWebhookPage() {
  const params = useParams<{ slug: string }>();

  return <SpaceWebhookSettings slug={params.slug} />;
}
