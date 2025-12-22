import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/database';
import { ProductionDashboard } from '@/components/production';

export default async function ManagerPage() {
  const user = await currentUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  // Check if user is a manager or admin
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
    select: { role: true }
  });

  if (!dbUser || !['MANAGER', 'ADMIN'].includes(dbUser.role)) {
    redirect('/dashboard');
  }

  return <ProductionDashboard title="Manager Dashboard" />;
}