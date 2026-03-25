import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isAdminForTenant } from '@/lib/adminAuth';
import PlansTab from '@/components/admin/PlansTab';
import AccessDenied from '@/components/admin/AccessDenied';

export default async function AdminPlansPage({ params }: { params: Promise<{ tenant: string }> }) {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  const { tenant } = await params;
  const adminAccess = await isAdminForTenant(tenant);

  if (!adminAccess) {
    return <AccessDenied />;
  }

  return <PlansTab />;
}
