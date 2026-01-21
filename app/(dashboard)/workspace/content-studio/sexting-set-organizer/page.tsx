"use client";

import ContentStudioLayout from "@/components/social-media/ContentStudioLayout";
import SextingSetOrganizer from "@/components/social-media/SextingSetOrganizer";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";

export default function SextingSetOrganizerPage() {
  const { profileId } = useInstagramProfile();

  return (
    <ContentStudioLayout
      title="Sexting Set Organizer"
      description="Organize and sequence your sexting sets"
    >
      <SextingSetOrganizer profileId={profileId} />
    </ContentStudioLayout>
  );
}
