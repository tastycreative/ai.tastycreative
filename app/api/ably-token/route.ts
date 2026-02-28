import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as Ably from 'ably';
import { prisma } from '@/lib/database';
import { canViewQueue, type OrgRole } from '@/lib/rbac';
import { queueChannel } from '@/lib/ably-server';

/**
 * GET /api/ably-token
 *
 * Issues a short-lived, capability-scoped Ably TokenRequest.
 * The client (useCaptionQueueSSE) exchanges it with Ably's auth endpoint
 * to open a Realtime connection scoped to *only* their org's queue channel.
 *
 * Using a TokenRequest (rather than the full API key) means the secret never
 * leaves the server and the client can only subscribe — not publish.
 */
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, currentOrganizationId: true },
  });

  if (!user?.currentOrganizationId) {
    return NextResponse.json({ error: 'User not in an organization' }, { status: 403 });
  }

  const membership = await prisma.teamMember.findFirst({
    where: { userId: user.id, organizationId: user.currentOrganizationId },
    select: { role: true },
  });

  if (!canViewQueue(membership?.role as OrgRole | undefined)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const orgId = user.currentOrganizationId;
  const ablyRest = new Ably.Rest({ key: process.env.ABLY_API_KEY! });

  // Capability-scoped: subscribe-only on this org's channel
  const tokenRequest = await ablyRest.auth.createTokenRequest({
    capability: { [queueChannel(orgId)]: ['subscribe'] },
    ttl: 3_600_000, // 1 hour
  });

  return NextResponse.json({ tokenRequest });
}
