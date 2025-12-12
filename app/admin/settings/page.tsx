import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isUserAdmin } from '@/lib/adminAuth';
import SettingsTab from '@/components/admin/SettingsTab';

export default async function AdminSettingsPage() {
  const user = await currentUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  const adminAccess = await isUserAdmin();
  
  if (!adminAccess) {
    redirect('/dashboard');
  }

  return <SettingsTab />;
}
