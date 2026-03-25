import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isAdminForTenant } from '@/lib/adminAuth';
import MembersTab from '@/components/admin/MembersTab';

export default async function AdminOrganizationManagementPage({ params }: { params: Promise<{ tenant: string }> }) {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  const { tenant } = await params;
  const adminAccess = await isAdminForTenant(tenant);

  if (!adminAccess) {
    redirect('/dashboard');
  }

  return <MembersTab />;
}
