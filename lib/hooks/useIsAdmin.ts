'use client';

import { useUser } from '@clerk/nextjs';
import { useState, useEffect } from 'react';

export function useIsAdmin() {
  const { user } = useUser();
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
        
        // Check database TeamMember role (primary check)
        let hasTeamAdminRole = false;
        try {
          const response = await fetch('/api/admin/user-role', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            // OWNER, ADMIN, or MANAGER roles should have admin access
            hasTeamAdminRole = data.role === 'OWNER' || data.role === 'ADMIN' || data.role === 'MANAGER';
          }
        } catch (error) {
          console.log('Could not fetch database role, using fallback methods');
        }
        
        setIsAdmin(hasTeamAdminRole || isAdminEmail || hasAdminRole);
        setLoading(false);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  return { isAdmin, loading };
}