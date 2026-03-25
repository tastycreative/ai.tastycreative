import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isAdminForTenant } from '@/lib/adminAuth';
import OrganizationsTab from '@/components/admin/OrganizationsTab';
import AccessDenied from '@/components/admin/AccessDenied';

export default async function AdminOrganizationsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  const { tenant } = await params;
  const adminAccess = await isAdminForTenant(tenant);

  if (!adminAccess) {
    return <AccessDenied />;
  }

  return <OrganizationsTab />;
}
