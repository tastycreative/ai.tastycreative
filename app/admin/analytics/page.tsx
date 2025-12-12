import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isUserAdmin } from '@/lib/adminAuth';
import AnalyticsTab from '@/components/admin/AnalyticsTab';

export default async function AdminAnalyticsPage() {
  const user = await currentUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  const adminAccess = await isUserAdmin();
  
  if (!adminAccess) {
    redirect('/dashboard');
  }

  return <AnalyticsTab />;
}
