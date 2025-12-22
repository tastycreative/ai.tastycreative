import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isUserAdmin } from '@/lib/adminAuth';
import SecurityTab from '@/components/admin/SecurityTab';

export default async function AdminSecurityPage() {
  const user = await currentUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  const adminAccess = await isUserAdmin();
  
  if (!adminAccess) {
    redirect('/dashboard');
  }

  return <SecurityTab />;
}
