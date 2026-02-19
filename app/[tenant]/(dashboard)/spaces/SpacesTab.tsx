'use client';

import { useState } from 'react';
import { useOrganization } from '@/lib/hooks/useOrganization.query';
import { useSpaces } from '@/lib/hooks/useSpaces.query';
import { SpacesList } from './SpacesList';
import { KanbanBoard } from './KanbanBoard';

export function SpacesTab() {
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  const { currentOrganization } = useOrganization();
  const { data, isLoading } = useSpaces(!!currentOrganization);

  const spaces = data?.spaces ?? [];
  const selectedSpace =
    spaces.find((s) => s.id === selectedSpaceId) ?? spaces[0] ?? null;

  return (
    <div className="space-y-6">
      <SpacesList
        spaces={spaces}
        isLoading={isLoading}
        onSelectSpace={(space) => setSelectedSpaceId(space.id)}
      />

      <KanbanBoard spaceName={selectedSpace?.name} />
    </div>
  );
}
