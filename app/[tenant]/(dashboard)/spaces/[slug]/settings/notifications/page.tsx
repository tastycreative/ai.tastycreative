'use client';

import { useParams } from 'next/navigation';
import { SpaceNotificationSettings } from './SpaceNotificationSettings';

export default function SpaceNotificationsPage() {
  const params = useParams<{ slug: string }>();

  return <SpaceNotificationSettings slug={params.slug} />;
}
