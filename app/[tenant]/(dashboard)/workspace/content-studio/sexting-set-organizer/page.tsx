"use client";

import ContentStudioLayout from "@/components/social-media/ContentStudioLayout";
import SextingSetOrganizer from "@/components/social-media/SextingSetOrganizer";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import { useParams } from "next/navigation";

export default function SextingSetOrganizerPage() {
  const { profileId } = useInstagramProfile();
  const params = useParams();
  const tenant = params.tenant as string;

  return (
    <ContentStudioLayout
      title="Sexting Set Organizer"
      description="Organize and sequence your sexting sets"
    >
      <SextingSetOrganizer profileId={profileId} tenant={tenant} />
    </ContentStudioLayout>
  );
}
