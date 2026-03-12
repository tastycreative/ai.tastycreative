import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge Runtime — critical for streaming large files on Vercel.
 * Node.js serverless functions buffer responses and run out of memory
 * on large files. Edge functions pipe ReadableStreams natively with
 * near-zero memory overhead.
 */
export const runtime = 'edge';

/* ── Lightweight Google Service Account auth (no googleapis dep) ──── */

/** Cached access token — persists across requests on the same isolate. */
let tokenCache: { token: string; expiresAt: number } | null = null;

/** Base64url-encode a Uint8Array. */
function base64url(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** Base64url-encode a JSON object. */
function jsonToBase64url(obj: Record<string, unknown>): string {
  return base64url(new TextEncoder().encode(JSON.stringify(obj)));
}

/**
 * Create a signed JWT using Web Crypto (RS256), then exchange it for
 * a Google OAuth2 access token. Results are cached for ~55 minutes.
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (5-min buffer)
  if (tokenCache && tokenCache.expiresAt > Date.now() + 300_000) {
    return tokenCache.token;
  }

  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;
  if (!clientEmail || !rawKey) {
    throw new Error('Google Cloud service account credentials not configured');
  }

  const privateKeyPem = rawKey.replace(/\\n/g, '\n');

  // ── Build JWT ────────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  const headerB64 = jsonToBase64url({ alg: 'RS256', typ: 'JWT' });
  const claimB64 = jsonToBase64url({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const unsigned = `${headerB64}.${claimB64}`;

  // ── Import private key via Web Crypto ────────────────────────────
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/[\r\n\s]/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  // ── Sign ─────────────────────────────────────────────────────────
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64url(new Uint8Array(signatureBuffer))}`;

  // ── Exchange JWT for access token ────────────────────────────────
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(jwt)}`,
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Token exchange failed (${tokenRes.status}): ${errText}`);
  }

  const tokenData = await tokenRes.json();
  tokenCache = {
    token: tokenData.access_token,
    expiresAt: Date.now() + (tokenData.expires_in ?? 3600) * 1000,
  };

  return tokenCache.token;
}

/* ── Route handler ─────────────────────────────────────────────────── */

/**
 * Try refreshing a user OAuth token using the refresh_token cookie.
 * Returns the new access token, or null on failure.
 */
async function tryRefreshUserToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret || !refreshToken) return null;

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

/**
 * GET /api/google-drive/stream?fileId=XXXX
 *
 * Streaming proxy for Google Drive files on Edge Runtime.
 * Pipes data directly from Google → browser with zero buffering.
 * Supports HTTP Range requests for seeking in large videos.
 *
 * Auth priority:
 * 1. User OAuth token (from httpOnly cookie `gdrive_access_token`)
 * 2. Service account token (server-side JWT)
 */
export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get('fileId');
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return NextResponse.json({ error: 'Valid fileId is required' }, { status: 400 });
  }

  // ── Ping mode: check auth without streaming ─────────────────────────
  // Used by the client to validate the user token against Drive before mounting
  // a media element. Never falls back to the service account — the whole point
  // is to confirm what *this user's* token can access.
  const ping = request.nextUrl.searchParams.get('ping') === 'true';
  if (ping) {
    const userToken = request.cookies.get('gdrive_access_token')?.value;
    if (!userToken) {
      return NextResponse.json({ code: 'no_token' }, { status: 401 });
    }
    // Lightweight metadata fetch — only retrieves the file id field (~50 bytes)
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${userToken}` } },
    );
    if (metaRes.status === 401) return NextResponse.json({ code: 'token_expired' }, { status: 401 });
    if (metaRes.status === 403 || metaRes.status === 404) return NextResponse.json({ code: 'no_access' }, { status: 403 });
    if (!metaRes.ok) return NextResponse.json({ code: 'error' }, { status: metaRes.status });
    return NextResponse.json({ code: 'ok' });
  }

  try {
    // Determine which token to use — user OAuth cookie first, then service account
    const userAccessToken = request.cookies.get('gdrive_access_token')?.value;
    const refreshToken = request.cookies.get('gdrive_refresh_token')?.value;
    const isUserAuth = !!userAccessToken;
    let token = userAccessToken || await getAccessToken();

    // Build headers — forward Range if the browser sent one
    const fetchHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    // Stream file directly from Google Drive API.
    let driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      { headers: fetchHeaders },
    );

    // If user token expired (401), try refreshing
    if (driveRes.status === 401 && isUserAuth && refreshToken) {
      const newToken = await tryRefreshUserToken(refreshToken);
      if (newToken) {
        token = newToken;
        fetchHeaders['Authorization'] = `Bearer ${newToken}`;
        driveRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
          { headers: fetchHeaders },
        );
      }
    }

    if (!driveRes.ok && driveRes.status !== 206) {
      if (driveRes.status === 404) {
        return NextResponse.json(
          { error: 'File not found — it may still be uploading to Google Drive' },
          { status: 404 },
        );
      }
      if (driveRes.status === 403) {
        return NextResponse.json(
          { error: 'Cannot access this file — check sharing permissions', needsAccess: isUserAuth },
          { status: 403 },
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch file from Google Drive' },
        { status: driveRes.status },
      );
    }

    // Forward relevant headers from Google's response
    const responseHeaders = new Headers({
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600, immutable',
    });

    const contentType = driveRes.headers.get('content-type');
    const contentLength = driveRes.headers.get('content-length');
    const contentRange = driveRes.headers.get('content-range');

    if (contentType) responseHeaders.set('Content-Type', contentType);
    if (contentLength) responseHeaders.set('Content-Length', contentLength);
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    // If we refreshed the user token, set the new cookie
    if (isUserAuth && token !== userAccessToken) {
      responseHeaders.set(
        'Set-Cookie',
        `gdrive_access_token=${token}; Path=/api/google-drive; HttpOnly; SameSite=Lax; Max-Age=3500${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
      );
    }

    // Pipe the Google response body straight through — zero buffering.
    return new Response(driveRes.body, {
      status: driveRes.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    console.error('Error streaming Google Drive file:', error);
    return NextResponse.json(
      { error: 'Failed to stream file from Google Drive' },
      { status: 500 },
    );
  }
}
