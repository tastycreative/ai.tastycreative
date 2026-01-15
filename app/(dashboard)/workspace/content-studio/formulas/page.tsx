'use client';

import ContentStudioLayout from '@/components/social-media/ContentStudioLayout';
import ReelsFormulaView from '@/components/social-media/ReelsFormulaView';

export default function FormulasPage() {
  return (
    <ContentStudioLayout
      title="Reels Formulas"
      description="Browse and use proven Reels formulas"
    >
      <ReelsFormulaView />
    </ContentStudioLayout>
  );
}
