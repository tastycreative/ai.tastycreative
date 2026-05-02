"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await (
      authClient as unknown as {
        forgetPassword: (data: {
          email: string;
          redirectTo: string;
        }) => Promise<{ error: { message?: string } | null }>;
      }
    ).forgetPassword({
      email,
      redirectTo: "/reset-password",
    });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Failed to send reset email");
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-brand-off-white">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 shadow-lg rounded-lg p-6 space-y-4">
          {sent ? (
            <div className="text-center space-y-3">
              <p className="text-gray-700 dark:text-brand-off-white">
                If an account exists for <strong>{email}</strong>, a reset link
                has been sent.
              </p>
              <Link
                href="/login"
                className="inline-block text-brand-dark-pink hover:text-brand-mid-pink dark:text-brand-light-pink"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-brand-off-white"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-light-pink focus:outline-none focus:ring-1 focus:ring-brand-light-pink dark:border-brand-mid-pink/30 dark:bg-transparent dark:text-brand-off-white"
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-brand-light-pink px-4 py-2 text-sm font-medium text-white hover:bg-brand-mid-pink disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>

              <div className="text-center text-sm">
                <Link
                  href="/login"
                  className="text-brand-dark-pink hover:text-brand-mid-pink dark:text-brand-light-pink"
                >
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
