import { headers } from "next/headers";
import { auth as betterAuth } from "./auth";
import { prisma } from "./prisma";

/**
 * Drop-in replacements for Clerk's server APIs, backed by BetterAuth.
 *
 * Returned `userId` is the User row's `clerkId` field — this preserves all
 * existing FK relations across the schema (InfluencerLoRA.clerkId, etc.) that
 * reference users via clerkId rather than User.id.
 *
 * For new BetterAuth users, clerkId is set to User.id by a databaseHook in lib/auth.ts.
 * For migrated users, clerkId retains its original Clerk value.
 */

type ClerkUser = {
  id: string;
  externalId: string | null;
  emailAddresses: Array<{ emailAddress: string | null; id: string }>;
  primaryEmailAddress: { emailAddress: string | null } | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  imageUrl: string;
  username: string | null;
  publicMetadata: Record<string, unknown>;
  privateMetadata: Record<string, unknown>;
  unsafeMetadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  lastSignInAt: number | null;
};

function toClerkUser(user: {
  id: string;
  clerkId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  username: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | null;
}): ClerkUser {
  const id = user.clerkId ?? user.id;
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
  return {
    id,
    externalId: null,
    emailAddresses: user.email
      ? [{ emailAddress: user.email, id: `email-${id}` }]
      : [],
    primaryEmailAddress: user.email ? { emailAddress: user.email } : null,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName,
    imageUrl: user.imageUrl ?? "",
    username: user.username,
    publicMetadata: {},
    privateMetadata: {},
    unsafeMetadata: {},
    createdAt: user.createdAt.getTime(),
    updatedAt: user.updatedAt.getTime(),
    lastSignInAt: user.lastLoginAt ? user.lastLoginAt.getTime() : null,
  };
}

const USER_SELECT = {
  id: true,
  clerkId: true,
  email: true,
  firstName: true,
  lastName: true,
  imageUrl: true,
  username: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
} as const;

async function getServerSession() {
  return betterAuth.api.getSession({ headers: await headers() });
}

export async function auth() {
  const session = await getServerSession();
  const userId =
    (session?.user as unknown as { clerkId?: string })?.clerkId ??
    session?.user?.id ??
    null;
  return {
    userId,
    sessionId: session?.session?.id ?? null,
    sessionClaims: session ? { sub: userId } : null,
    orgId: null as string | null,
    orgRole: null as string | null,
    orgSlug: null as string | null,
    has: () => false,
    redirectToSignIn: () => {
      throw new Error(
        "redirectToSignIn() called on server — use middleware redirect instead"
      );
    },
    protect: async () => {
      if (!userId) {
        const { redirect } = await import("next/navigation");
        redirect("/login");
      }
      return { userId };
    },
  };
}

export async function currentUser(): Promise<ClerkUser | null> {
  const session = await getServerSession();
  if (!session?.user) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: USER_SELECT,
  });
  if (!dbUser) return null;
  return toClerkUser(dbUser);
}

type ClerkClient = {
  users: {
    getUser: (userId: string) => Promise<ClerkUser>;
    getUserList: (opts?: {
      userId?: string[];
      emailAddress?: string[];
      limit?: number;
      offset?: number;
      orderBy?: string;
    }) => Promise<{ data: ClerkUser[]; totalCount: number }>;
    updateUser: (
      userId: string,
      data: Partial<{
        firstName: string;
        lastName: string;
        publicMetadata: Record<string, unknown>;
      }>
    ) => Promise<ClerkUser>;
    deleteUser: (userId: string) => Promise<void>;
  };
};

export async function clerkClient(): Promise<ClerkClient> {
  return {
    users: {
      getUser: async (userId: string) => {
        const dbUser = await prisma.user.findFirst({
          where: { OR: [{ clerkId: userId }, { id: userId }] },
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            username: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        if (!dbUser) {
          throw new Error(`User not found: ${userId}`);
        }
        return toClerkUser(dbUser);
      },
      getUserList: async (opts = {}) => {
        const where: Record<string, unknown> = {};
        if (opts.userId?.length) {
          where.OR = [
            { clerkId: { in: opts.userId } },
            { id: { in: opts.userId } },
          ];
        }
        if (opts.emailAddress?.length) {
          where.email = { in: opts.emailAddress };
        }
        const [users, totalCount] = await Promise.all([
          prisma.user.findMany({
            where,
            take: opts.limit ?? 100,
            skip: opts.offset ?? 0,
            select: {
              id: true,
              clerkId: true,
              email: true,
              firstName: true,
              lastName: true,
              imageUrl: true,
              username: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: "desc" },
          }),
          prisma.user.count({ where }),
        ]);
        return { data: users.map(toClerkUser), totalCount };
      },
      updateUser: async (userId, data) => {
        const updated = await prisma.user.update({
          where: { clerkId: userId },
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
          },
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            username: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return toClerkUser(updated);
      },
      deleteUser: async (userId) => {
        await prisma.user.delete({ where: { clerkId: userId } });
      },
    },
  };
}

export type { ClerkUser as User };
