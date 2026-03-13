"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams();
  const { user, isLoaded } = useUser();
  const [isVerifying, setIsVerifying] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const tenant = params.tenant as string;

  useEffect(() => {
    async function verifyAccess() {
      if (!isLoaded || !user) {
        return;
      }

      try {
        // Check if this is the user's personal workspace
        const isPersonalWorkspace = tenant === user.username || tenant === user.id || tenant === "personal";

        if (isPersonalWorkspace) {
          // Grant access to personal workspace
          setHasAccess(true);
          setIsVerifying(false);
          return;
        }

        // Otherwise, verify organization access
        const response = await fetch(`/api/organizations/verify-slug?slug=${tenant}`);

        if (!response.ok) {
          // User doesn't have access to this org
          router.push('/dashboard');
          return;
        }

        const data = await response.json();

        if (data.hasAccess) {
          setHasAccess(true);
        } else {
          // Redirect to their current organization or dashboard
          if (data.redirectSlug) {
            router.push(`/${data.redirectSlug}/dashboard`);
          } else {
            router.push('/dashboard');
          }
        }
      } catch (error) {
        console.error('Error verifying access:', error);
        router.push('/dashboard');
      } finally {
        setIsVerifying(false);
      }
    }

    verifyAccess();
  }, [isLoaded, user, tenant, router]);

  // Show loading state while verifying
  if (!isLoaded || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-gray-400">Verifying organization access...</p>
        </div>
      </div>
    );
  }

  // Only render children if user has access
  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}
