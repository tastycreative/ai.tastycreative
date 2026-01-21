import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isUserAdmin } from '@/lib/adminAuth';
import OrganizationsTab from '@/components/admin/OrganizationsTab';

export default async function AdminOrganizationsPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  const adminAccess = await isUserAdmin();

  if (!adminAccess) {
    redirect('/dashboard');
  }

  return <OrganizationsTab />;
}
