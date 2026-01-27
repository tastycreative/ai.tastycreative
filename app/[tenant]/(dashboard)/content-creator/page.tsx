import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/database';
import { ProductionDashboard } from '@/components/production';

export default async function ContentCreatorPage() {
  const user = await currentUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  // Check if user is a content creator only
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
    select: { role: true }
  });

  if (!dbUser || dbUser.role !== 'CONTENT_CREATOR') {
    redirect('/dashboard');
  }

  return <ProductionDashboard title="Content Creator Dashboard" />;
}
