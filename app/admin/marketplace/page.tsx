import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isUserAdmin } from '@/lib/adminAuth';
import AIMarketplaceTab from '@/components/admin/AIMarketplaceTab';

export default async function AdminMarketplacePage() {
  const user = await currentUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  const adminAccess = await isUserAdmin();
  
  if (!adminAccess) {
    redirect('/dashboard');
  }

  return <AIMarketplaceTab />;
}
