'use client';

import { ModelSetupPanel } from './panels/ModelSetupPanel';
import { PrizeBankPanel } from './panels/PrizeBankPanel';
import { FlyerPreviewPanel } from './panels/FlyerPreviewPanel';
import { WheelCreatorHeader } from './WheelCreatorHeader';

export function WheelCreator() {
  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-200 overflow-hidden">
      <WheelCreatorHeader />
      <div className="flex flex-1 overflow-hidden">
        <ModelSetupPanel />
        <PrizeBankPanel />
        <FlyerPreviewPanel />
      </div>
    </div>
  );
}
