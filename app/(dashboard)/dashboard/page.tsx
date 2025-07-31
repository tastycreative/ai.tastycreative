import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import DashboardContent from '@/components/dashboard/DashboardContent';

export default async function DashboardPage() {
  const user = await currentUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  const firstName = user.firstName || user.username || 'User';

  return <DashboardContent firstName={firstName} />;
}