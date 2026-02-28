import * as Ably from 'ably';

/** Channel name pattern — must match what the client subscribes to. */
export const queueChannel = (orgId: string) => `caption-queue:org:${orgId}`;

/**
 * Per-user generation channel.
 * The /process worker publishes progress + completion events here.
 * The frontend subscribes to receive real-time updates without polling.
 */
export const generationChannel = (clerkId: string) => `generation:user:${clerkId}`;

/** Lazy singleton Ably REST client (publish-only, no persistent socket). */
let _ablyRest: Ably.Rest | null = null;
function getAblyRest(): Ably.Rest {
  if (!_ablyRest) {
    _ablyRest = new Ably.Rest({ key: process.env.ABLY_API_KEY! });
  }
  return _ablyRest;
}

/**
 * Publish a caption-queue event to every Ably subscriber watching the given org.
 * Safe to call from serverless route handlers — Ably.Rest uses HTTP under the hood,
 * so there is no persistent connection to maintain between invocations.
 */
export async function broadcastToOrg(
  orgId: string,
  event: { type: string; [key: string]: unknown },
): Promise<void> {
  try {
    const channel = getAblyRest().channels.get(queueChannel(orgId));
    await channel.publish(event.type, event);
  } catch (err) {
    // Non-fatal — real-time update missed, but the next query refetch will catch up
    console.error('[Ably] Failed to publish queue event:', err);
  }
}

/**
 * Publish a generation event directly to a specific user's channel.
 * Used by the /process worker to push progress and completion events.
 *
 * @param clerkId  The Clerk user ID (channel is `generation:user:{clerkId}`).
 * @param event    Arbitrary event payload — should include at least `jobId` and `status`.
 */
export async function publishToUser(
  clerkId: string,
  event: { jobId: string; status: string; [key: string]: unknown },
): Promise<void> {
  try {
    const channel = getAblyRest().channels.get(generationChannel(clerkId));
    await channel.publish('generation:update', event);
  } catch (err) {
    // Non-fatal — the client can fall back to polling the /status endpoint
    console.error('[Ably] Failed to publish user generation event:', err);
  }
}
