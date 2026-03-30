/**
 * GET /api/active-generations/stream
 * 
 * DEPRECATED — real-time updates now go through Ably.
 * This stub exists only so old cached clients (pre-deploy) don't loop forever.
 * It closes immediately, which triggers the EventSource onerror handler and
 * the old client's exponential backoff (1s → 5s cap), minimising wasted calls
 * until Next.js chunk-mismatch forces a full page reload with the new Ably code.
 *
 * Safe to delete once all users have refreshed (give it a day or two).
 */
export async function GET() {
  return new Response(null, { status: 204 });
}
