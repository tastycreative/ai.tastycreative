"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

export default function DashboardRedirectPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    async function redirectToDashboard() {
      if (!isLoaded || !user) {
        return;
      }

      try {
        // Fetch user's current organization
        const response = await fetch("/api/organization/current");

        if (response.ok) {
          const data = await response.json();

          if (data.organization?.slug) {
            // User has an organization - redirect to org dashboard with slug
            router.replace(`/${data.organization.slug}/dashboard`);
            return;
          }
        }

        // No organization - redirect to personal workspace using username or ID
        const personalTenant = user.username || user.id;
        router.replace(`/${personalTenant}/dashboard`);
      } catch (error) {
        console.error("Error fetching organization:", error);
        // On error, redirect to personal workspace
        const personalTenant = user.username || user.id;
        router.replace(`/${personalTenant}/dashboard`);
      }
    }

    redirectToDashboard();
  }, [isLoaded, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm text-gray-400">Loading your workspace...</p>
      </div>
    </div>
  );
}
