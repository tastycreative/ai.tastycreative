import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isUserAdmin } from '@/lib/adminAuth';
import AdminTeamsView from '@/components/admin/AdminTeamsView';
import AccessDenied from '@/components/admin/AccessDenied';

export default async function AdminOrganizationTeamsPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  const adminAccess = await isUserAdmin();

  if (!adminAccess) {
    return <AccessDenied />;
  }

  return <AdminTeamsView />;
}
