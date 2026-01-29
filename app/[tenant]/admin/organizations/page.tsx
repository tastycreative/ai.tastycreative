import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isUserSuperAdmin } from '@/lib/adminAuth';
import OrganizationsTab from '@/components/admin/OrganizationsTab';
import AccessDenied from '@/components/admin/AccessDenied';

export default async function AdminOrganizationsPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  const superAdminAccess = await isUserSuperAdmin();

  if (!superAdminAccess) {
    return <AccessDenied />;
  }

  return <OrganizationsTab />;
}
