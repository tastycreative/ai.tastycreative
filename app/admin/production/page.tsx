import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isUserAdmin } from '@/lib/adminAuth';
import ProductionTrackerTab from '@/components/admin/ProductionTrackerTab';

export default async function AdminProductionPage() {
  const user = await currentUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  const adminAccess = await isUserAdmin();
  
  if (!adminAccess) {
    redirect('/dashboard');
  }

  // You'll need to fetch stats here or pass them as props
  const stats = {
    totalUsers: 0,
    activeJobs: 0,
    totalContent: 0,
    storageUsed: '0 GB'
  };

  return <ProductionTrackerTab stats={stats} />;
}
