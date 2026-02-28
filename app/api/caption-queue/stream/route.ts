import { NextResponse } from 'next/server';

/**
 * @deprecated
 * The SSE stream endpoint has been replaced by Ably Realtime pub/sub.
 * Clients should connect via the Ably SDK using a token from /api/ably-token.
 * This route is kept so existing clients get a clear error rather than a 404.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'This SSE endpoint has been replaced by Ably Realtime. Use /api/ably-token.' },
    { status: 410 },
  );
}
