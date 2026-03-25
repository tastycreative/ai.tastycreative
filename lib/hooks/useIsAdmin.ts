'use client';

import { useUser } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

export function useIsAdmin() {
  const { user } = useUser();
  const params = useParams();
  const tenant = params?.tenant as string | undefined;
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Check if user email is admin email (fallback)
        const adminEmails = ['admin@tastycreative.com', 'rapdeleon0404@gmail.com'];
        const isAdminEmail = adminEmails.includes(user.emailAddresses[0]?.emailAddress || '');

        // Check if user has admin role in Clerk metadata (fallback)
        const hasAdminRole = user.publicMetadata?.role === 'admin';

        // Primary check: use check-role endpoint which checks both system admin and org admin
        let isAdminFromApi = false;
        try {
          const url = tenant
            ? `/api/auth/check-role?tenant=${encodeURIComponent(tenant)}`
            : '/api/auth/check-role';
          const response = await fetch(url);

          if (response.ok) {
            const data = await response.json();
            isAdminFromApi = data.isAdmin || false;
          }
        } catch (error) {
          console.log('Could not fetch role from check-role, trying fallback');
        }

        // Fallback: check team membership role directly
        if (!isAdminFromApi) {
          try {
            const response = await fetch('/api/admin/user-role');
            if (response.ok) {
              const data = await response.json();
              isAdminFromApi = data.role === 'OWNER' || data.role === 'ADMIN' || data.role === 'MANAGER';
            }
          } catch (error) {
            console.log('Could not fetch database role, using email/metadata fallback');
          }
        }

        setIsAdmin(isAdminFromApi || isAdminEmail || hasAdminRole);
        setLoading(false);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user, tenant]);

  return { isAdmin, loading };
}