'use client';

import { SignInButton, SignOutButton, SignUpButton, useUser } from '@clerk/nextjs';

export function AuthButtons() {
  const { isSignedIn, user } = useUser();

  if (isSignedIn) {
    return (
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-300">
          Welcome, {user.firstName || user.emailAddresses[0]?.emailAddress}!
        </span>
        <SignOutButton>
          <button className="text-gray-300 hover:text-white transition-colors">
            Sign Out
          </button>
        </SignOutButton>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-4">
      <SignInButton>
        <button className="text-gray-300 hover:text-white transition-colors">
          Sign In
        </button>
      </SignInButton>
      <SignInButton>
        <button className="bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors font-medium">
          Get Started
        </button>
      </SignInButton>
    </div>
  );
}