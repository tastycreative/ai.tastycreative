import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/database';
import { ProductionDashboard } from '@/components/production';

export default async function ContentCreatorPage() {
  const user = await currentUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  // Check if user has CREATOR role in any team
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
    select: { 
      id: true,
      teamMemberships: {
        where: {
          role: 'CREATOR'
        }
      }
    }
  });

  if (!dbUser || dbUser.teamMemberships.length === 0) {
    redirect('/dashboard');
  }

  return <ProductionDashboard title="Content Creator Dashboard" />;
}
