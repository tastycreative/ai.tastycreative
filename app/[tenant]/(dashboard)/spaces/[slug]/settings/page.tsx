'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SpaceSettingsRedirect() {
  const params = useParams<{ tenant: string; slug: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${params.tenant}/spaces/${params.slug}/settings/details`);
  }, [params.tenant, params.slug, router]);

  return null;
}
