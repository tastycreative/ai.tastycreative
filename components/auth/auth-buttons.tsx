'use client';

import { SignInButton, SignOutButton, SignUpButton, useUser } from '@clerk/nextjs';

export function AuthButtons() {
  const { isSignedIn, user } = useUser();

  if (isSignedIn) {
    return (
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Welcome, {user.firstName || user.emailAddresses[0]?.emailAddress}!
        </span>
        <SignOutButton>
          <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
            Sign Out
          </button>
        </SignOutButton>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <SignInButton>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          Sign In
        </button>
      </SignInButton>
      <SignUpButton>
        <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
          Sign Up
        </button>
      </SignUpButton>
    </div>
  );
}