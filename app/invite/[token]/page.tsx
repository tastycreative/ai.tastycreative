"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Building2,
  Mail,
  Shield,
  AlertTriangle
} from "lucide-react";

interface InviteData {
  email: string;
  role: string;
  expiresAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
  };
}

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (userLoaded) {
      fetchInviteData();
    }
  }, [userLoaded, token]);

  const fetchInviteData = async () => {
    try {
      const response = await fetch(`/api/invites/${token}`);
      const data = await response.json();

      if (response.ok) {
        setInviteData(data.invite);
      } else {
        if (data.used) {
          setError("This invitation has already been used.");
        } else if (data.expired) {
          setError("This invitation has expired.");
        } else {
          setError(data.error || "Invalid invitation.");
        }
      }
    } catch (err) {
      setError("Failed to load invitation details.");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!user) {
      // Redirect to sign in with return URL
      router.push(`/login?redirect=/invite/${token}`);
      return;
    }

    setAccepting(true);

    try {
      const response = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setRedirecting(true);

        // Redirect to organization dashboard after 2 seconds
        setTimeout(() => {
          router.push(`/${data.organizationSlug}/dashboard`);
        }, 2000);
      } else {
        setError(data.error || "Failed to accept invitation.");
      }
    } catch (err) {
      setError("Failed to accept invitation.");
    } finally {
      setAccepting(false);
    }
  };

  if (loading || !userLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-gray-400">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !inviteData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-4">
        <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-md border border-slate-700 p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-4 bg-red-500/10 rounded-full">
              <XCircle className="w-12 h-12 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Invalid Invitation
              </h1>
              <p className="text-gray-400">{error}</p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="mt-4 px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-4">
        <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-md border border-slate-700 p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-4 bg-green-500/10 rounded-full">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Welcome Aboard!
              </h1>
              <p className="text-gray-400">
                You've successfully joined {inviteData.organization.name}
              </p>
            </div>
            {redirecting && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Redirecting to dashboard...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const userEmail = user?.emailAddresses?.[0]?.emailAddress;
  const emailMismatch = Boolean(userEmail && inviteData.email.toLowerCase() !== userEmail.toLowerCase());

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-4">
      <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-md border border-slate-700">
        {/* Header */}
        <div className="p-8 text-center border-b border-slate-700">
          <div className="flex justify-center mb-4">
            {inviteData.organization.logoUrl ? (
              <img
                src={inviteData.organization.logoUrl}
                alt={inviteData.organization.name}
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-8 h-8 text-white" />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Organization Invitation
          </h1>
          <p className="text-gray-400">
            You've been invited to join
          </p>
          <p className="text-xl font-semibold text-white mt-2">
            {inviteData.organization.name}
          </p>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-400">Invited Email</p>
                <p className="text-white font-medium">{inviteData.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-400">Role</p>
                <p className="text-white font-medium">
                  {inviteData.role === "ADMIN" ? "Administrator" : "Member"}
                </p>
              </div>
            </div>
          </div>

          {emailMismatch && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-yellow-400 font-medium">
                    Email mismatch
                  </p>
                  <p className="text-sm text-yellow-300 mt-1">
                    This invitation was sent to {inviteData.email}, but you're signed in as {userEmail}.
                    Please sign in with the correct email address.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!user && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <p className="text-sm text-blue-300">
                You need to sign in or create an account to accept this invitation.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleAccept}
              disabled={accepting || emailMismatch}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {accepting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Accepting...
                </>
              ) : !user ? (
                "Sign In to Accept"
              ) : emailMismatch ? (
                "Wrong Email Address"
              ) : (
                "Accept Invitation"
              )}
            </button>

            <button
              onClick={() => router.push("/")}
              className="w-full px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Decline
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            This invitation expires on {new Date(inviteData.expiresAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
