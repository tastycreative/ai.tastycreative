import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/google-drive/thumbnail?fileId=XXXX&sz=220
 *
 * Server-side thumbnail proxy for Google Drive files.
 * The thumbnailLink URLs returned by the Drive API (lh3.googleusercontent.com/...)
 * are authenticated — they require an OAuth Bearer token when fetched from a server
 * (browser cookies don't apply server-side). This route fetches the thumbnail
 * using the user's stored OAuth token from the gdrive_access_token cookie.
 *
 * Auth: user OAuth token (gdrive_access_token cookie). No service-account fallback
 * — thumbnails are user-access-specific.
 */

async function tryRefreshUserToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get('fileId');
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return new NextResponse(null, { status: 400 });
  }

  // ── Resolve user token ───────────────────────────────────────────
  let userToken = request.cookies.get('gdrive_access_token')?.value;
  const refreshToken = request.cookies.get('gdrive_refresh_token')?.value;

  if (!userToken && refreshToken) {
    userToken = await tryRefreshUserToken(refreshToken) ?? undefined;
  }

  if (!userToken) {
    return new NextResponse(null, { status: 401 });
  }

  // ── Fetch thumbnailLink from Drive API ───────────────────────────
  // Request a larger thumbnail size (s220 = 220px on longest edge)
  let metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${userToken}` } },
  );

  // Token expired — try refreshing once
  if (metaRes.status === 401 && refreshToken) {
    const newToken = await tryRefreshUserToken(refreshToken);
    if (newToken) {
      userToken = newToken;
      metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${newToken}` } },
      );
    }
  }

  if (!metaRes.ok) {
    return new NextResponse(null, { status: metaRes.status });
  }

  const meta = await metaRes.json();
  let thumbnailLink: string | undefined = meta.thumbnailLink;
  if (!thumbnailLink) {
    // No thumbnail available for this file (common for some file types)
    return new NextResponse(null, { status: 404 });
  }

  // Bump the size param in the URL (Google appends =s220; we want s320 for the grid)
  thumbnailLink = thumbnailLink.replace(/=s\d+$/, '=s320');

  // ── Fetch the thumbnail image server-side ────────────────────────
  // lh3.googleusercontent.com/drive-storage/... URLs can be fetched with
  // the same Drive OAuth Bearer token from a server context.
  const imgRes = await fetch(thumbnailLink, {
    headers: { Authorization: `Bearer ${userToken}` },
  });

  if (!imgRes.ok) {
    return new NextResponse(null, { status: imgRes.status });
  }

  const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
  const body = await imgRes.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      // Cache privately in the browser for 5 mins — thumbnails don't change often
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
    },
  });
}
