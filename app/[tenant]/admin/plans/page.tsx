import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isUserAdmin } from '@/lib/adminAuth';
import PlansTab from '@/components/admin/PlansTab';

export default async function AdminPlansPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  const adminAccess = await isUserAdmin();

  if (!adminAccess) {
    redirect('/dashboard');
  }

  return <PlansTab />;
}
