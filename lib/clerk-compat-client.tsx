"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useMemo } from "react";
import { authClient } from "./auth-client";

/**
 * Drop-in replacements for Clerk's React client hooks/components, backed by BetterAuth.
 *
 * `userId` returned by these hooks is the User row's `clerkId` field — the same
 * identifier used everywhere in the existing codebase.
 */

type ClientUser = {
  id: string;
  externalId: string | null;
  emailAddresses: Array<{ emailAddress: string; id: string }>;
  primaryEmailAddress: { emailAddress: string } | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  imageUrl: string;
  username: string | null;
  publicMetadata: Record<string, unknown>;
};

function toClientUser(user: {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  clerkId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): ClientUser {
  const id = user.clerkId ?? user.id;
  const firstName =
    user.firstName ?? user.name?.split(" ").slice(0, -1).join(" ") ?? null;
  const lastName =
    user.lastName ?? user.name?.split(" ").slice(-1).join(" ") ?? null;
  const fullName =
    user.name ?? [firstName, lastName].filter(Boolean).join(" ") ?? null;
  return {
    id,
    externalId: null,
    emailAddresses: user.email
      ? [{ emailAddress: user.email, id: `email-${id}` }]
      : [],
    primaryEmailAddress: user.email ? { emailAddress: user.email } : null,
    firstName,
    lastName,
    fullName: fullName || null,
    imageUrl: user.image ?? "",
    username: null,
    publicMetadata: {},
  };
}

export function useUser(): {
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  user: ClientUser | null;
} {
  const { data, isPending } = authClient.useSession();
  const sessionUser = data?.user as
    | (Parameters<typeof toClientUser>[0] & { clerkId?: string })
    | undefined;
  // Stabilize on identity-defining primitives so consumers depending on `user`
  // don't see a new reference every render and re-fire effects in a loop.
  const userKey = sessionUser
    ? `${sessionUser.clerkId ?? sessionUser.id}|${sessionUser.email ?? ""}|${sessionUser.name ?? ""}|${sessionUser.image ?? ""}`
    : null;
  const user = useMemo(
    () => (sessionUser ? toClientUser(sessionUser) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userKey],
  );
  return {
    isLoaded: !isPending,
    isSignedIn: isPending ? undefined : !!user,
    user,
  };
}

export function useAuth(): {
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  userId: string | null;
  sessionId: string | null;
  orgId: string | null;
  orgRole: string | null;
  orgSlug: string | null;
  signOut: (opts?: { redirectUrl?: string }) => Promise<void>;
  has: () => boolean;
  getToken: () => Promise<string | null>;
} {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  const user = data?.user as
    | (Parameters<typeof toClientUser>[0] & { clerkId?: string })
    | undefined;
  const userId = user ? user.clerkId ?? user.id : null;
  return {
    isLoaded: !isPending,
    isSignedIn: isPending ? undefined : !!user,
    userId,
    sessionId: data?.session?.id ?? null,
    orgId: null,
    orgRole: null,
    orgSlug: null,
    signOut: async (opts) => {
      await authClient.signOut();
      router.push(opts?.redirectUrl ?? "/login");
    },
    has: () => false,
    // BetterAuth uses cookie sessions, not bearer tokens. Returning null is
    // safe — same-origin requests automatically include the session cookie.
    getToken: async () => null,
  };
}

export function useClerk(): {
  signOut: (opts?: { redirectUrl?: string }) => Promise<void>;
  openSignIn: () => void;
  openSignUp: () => void;
  user: ClientUser | null;
} {
  const { data } = authClient.useSession();
  const router = useRouter();
  const sessionUser = data?.user as
    | (Parameters<typeof toClientUser>[0] & { clerkId?: string })
    | undefined;
  const userKey = sessionUser
    ? `${sessionUser.clerkId ?? sessionUser.id}|${sessionUser.email ?? ""}|${sessionUser.name ?? ""}|${sessionUser.image ?? ""}`
    : null;
  const user = useMemo(
    () => (sessionUser ? toClientUser(sessionUser) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userKey],
  );
  return {
    signOut: async (opts) => {
      await authClient.signOut();
      router.push(opts?.redirectUrl ?? "/login");
    },
    openSignIn: () => router.push("/login"),
    openSignUp: () => router.push("/register"),
    user,
  };
}

type ClientOrganization = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  publicMetadata: Record<string, unknown>;
} | null;

export function useOrganization(): {
  isLoaded: boolean;
  organization: ClientOrganization;
  membership: null;
} {
  return { isLoaded: true, organization: null, membership: null };
}

type ChildrenProps = { children?: ReactNode };

export function SignedIn({ children }: ChildrenProps) {
  const { isSignedIn } = useUser();
  return isSignedIn ? <>{children}</> : null;
}

export function SignedOut({ children }: ChildrenProps) {
  const { isLoaded, isSignedIn } = useUser();
  return isLoaded && !isSignedIn ? <>{children}</> : null;
}

type ButtonProps = ChildrenProps & {
  mode?: "modal" | "redirect";
  forceRedirectUrl?: string;
  fallbackRedirectUrl?: string;
  signInForceRedirectUrl?: string;
  signUpForceRedirectUrl?: string;
};

export function SignInButton({ children, forceRedirectUrl }: ButtonProps) {
  const href = forceRedirectUrl
    ? `/login?redirect=${encodeURIComponent(forceRedirectUrl)}`
    : "/login";
  if (children) return <Link href={href}>{children}</Link>;
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-md bg-brand-light-pink px-4 py-2 text-sm font-medium text-white hover:bg-brand-mid-pink"
    >
      Sign in
    </Link>
  );
}

export function SignUpButton({ children, forceRedirectUrl }: ButtonProps) {
  const href = forceRedirectUrl
    ? `/register?redirect=${encodeURIComponent(forceRedirectUrl)}`
    : "/register";
  if (children) return <Link href={href}>{children}</Link>;
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
    >
      Sign up
    </Link>
  );
}

export function SignOutButton({
  children,
  redirectUrl,
}: ChildrenProps & { redirectUrl?: string }) {
  const { signOut } = useClerk();
  const target = redirectUrl ?? "/";
  if (children) {
    return (
      <span
        onClick={() => signOut({ redirectUrl: target })}
        style={{ cursor: "pointer" }}
      >
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => signOut({ redirectUrl: target })}
      className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-brand-mid-pink/30 dark:hover:bg-brand-dark-pink/10"
    >
      Sign out
    </button>
  );
}

export function UserButton() {
  const { user } = useUser();
  const { signOut } = useClerk();
  if (!user) return null;
  return (
    <button
      type="button"
      onClick={() => signOut({ redirectUrl: "/login" })}
      className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 text-xs font-medium text-gray-700 dark:border-brand-mid-pink/30 dark:bg-brand-dark-pink/10 dark:text-brand-off-white"
      title={user.primaryEmailAddress?.emailAddress ?? "Account"}
    >
      {user.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.imageUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        (user.firstName?.[0] ?? user.primaryEmailAddress?.emailAddress?.[0] ?? "U").toUpperCase()
      )}
    </button>
  );
}

export function ClerkProvider({ children }: ChildrenProps) {
  return <>{children}</>;
}
