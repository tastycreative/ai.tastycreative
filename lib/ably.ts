import Ably from 'ably';

let _ablyRest: Ably.Rest | null = null;

function getAblyRest(): Ably.Rest {
  if (!_ablyRest) {
    if (!process.env.ABLY_API_KEY) {
      throw new Error('ABLY_API_KEY environment variable is not set');
    }
    _ablyRest = new Ably.Rest(process.env.ABLY_API_KEY);
  }
  return _ablyRest;
}

/**
 * Publish a board event (fire-and-forget).
 * Clients subscribe to channel `board:${boardId}` and invalidate their cache.
 */
export function publishBoardEvent(
  boardId: string,
  eventName: string,
  data: { userId: string; entityId: string; tabId?: string },
) {
  const channel = getAblyRest().channels.get(`board:${boardId}`);
  channel.publish(eventName, data).catch((err) => {
    console.error('[ably] publish failed:', err);
  });
}

/**
 * Generate a token request for client-side auth.
 * The Ably SDK auto-calls the auth endpoint to get & refresh tokens.
 */
export async function createAblyTokenRequest(clientId: string) {
  return getAblyRest().auth.createTokenRequest({ clientId });
}
