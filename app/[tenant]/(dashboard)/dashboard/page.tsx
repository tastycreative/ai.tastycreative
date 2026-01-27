import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import DashboardContent from '@/components/dashboard/DashboardContent';
import { prisma } from '@/lib/database';

export default async function DashboardPage() {
  const user = await currentUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  const firstName = user.firstName || user.username || 'User';

  const clerkId = user.id;

  const [totalInfluencers, totalImages, totalVideos, influencerRecords] = await Promise.all([
    prisma.influencerLoRA.count({ where: { clerkId } }),
    prisma.generatedImage.count({ where: { clerkId } }),
    prisma.generatedVideo.count({ where: { clerkId } }),
    prisma.influencerLoRA.findMany({
      where: { clerkId },
      orderBy: { uploadedAt: 'desc' },
      take: 8,
      select: {
        id: true,
        name: true,
        displayName: true,
        description: true,
        thumbnailUrl: true,
        cloudinaryUrl: true,
        uploadedAt: true,
        usageCount: true,
      },
    }),
  ]);

  const totalContentGenerated = totalImages + totalVideos;

  const influencers = influencerRecords.map((influencer) => ({
    id: influencer.id,
    name: influencer.displayName?.trim() || influencer.name,
    description: influencer.description?.trim() || null,
    thumbnailUrl: influencer.thumbnailUrl || influencer.cloudinaryUrl || null,
    uploadedAt: influencer.uploadedAt.toISOString(),
    usageCount: influencer.usageCount ?? 0,
  }));

  return (
    <DashboardContent
      firstName={firstName}
      totalInfluencers={totalInfluencers}
      totalContentGenerated={totalContentGenerated}
      influencers={influencers}
    />
  );
}