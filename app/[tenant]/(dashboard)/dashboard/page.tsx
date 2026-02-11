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
    prisma.instagramProfile.count({ where: { clerkId } }),
    prisma.generatedImage.count({ where: { clerkId } }),
    prisma.generatedVideo.count({ where: { clerkId } }),
    prisma.instagramProfile.findMany({
      where: { clerkId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        name: true,
        description: true,
        profileImageUrl: true,
        createdAt: true,
        instagramUsername: true,
        posts: {
          select: { id: true }
        }
      },
    }),
  ]);

  const totalContentGenerated = totalImages + totalVideos;

  const influencers = influencerRecords.map((influencer) => ({
    id: influencer.id,
    name: influencer.name,
    description: influencer.description || null,
    thumbnailUrl: influencer.profileImageUrl || null,
    uploadedAt: influencer.createdAt.toISOString(),
    usageCount: influencer.posts.length,
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