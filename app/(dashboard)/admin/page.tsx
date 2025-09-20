import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isUserAdmin } from '@/lib/adminAuth';
import AdminContent from '@/components/admin/AdminContent';

export default async function AdminPage() {
  const user = await currentUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  // Check if user is admin
  const adminAccess = await isUserAdmin();
  
  if (!adminAccess) {
    redirect('/dashboard');
  }

  return <AdminContent />;
}