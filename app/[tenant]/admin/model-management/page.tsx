import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isUserAdmin } from '@/lib/adminAuth';
import ModelManagementTab from '@/components/admin/ModelManagementTab';

export default async function AdminModelManagementPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  const adminAccess = await isUserAdmin();

  if (!adminAccess) {
    redirect('/dashboard');
  }

  return <ModelManagementTab />;
}
