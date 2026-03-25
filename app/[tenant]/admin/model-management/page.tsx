import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isAdminForTenant } from '@/lib/adminAuth';
import ModelManagementTab from '@/components/admin/ModelManagementTab';

export default async function AdminModelManagementPage({ params }: { params: Promise<{ tenant: string }> }) {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  const { tenant } = await params;
  const adminAccess = await isAdminForTenant(tenant);

  if (!adminAccess) {
    redirect('/dashboard');
  }

  return <ModelManagementTab />;
}
