import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

/** Parse the state parameter — supports both legacy string and new JSON format. */
function parseState(state: string | null): { redirect: string; mode: string } {
  if (!state) return { redirect: '/workspace/generated-content', mode: 'redirect' };
  try {
    const parsed = JSON.parse(state);
    return {
      redirect: parsed.redirect || '/workspace/generated-content',
      mode: parsed.mode || 'redirect',
    };
  } catch {
    // Legacy format: state is just the redirect URL string
    return { redirect: state, mode: 'redirect' };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const rawState = searchParams.get('state');
    const { redirect: redirectPage, mode } = parseState(rawState);

    if (error) {
      if (mode === 'popup') {
        return popupResponse({ type: 'google-auth-error', error });
      }
      return NextResponse.redirect(
        new URL(`${redirectPage}?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      if (mode === 'popup') {
        return popupResponse({ type: 'google-auth-error', error: 'no_code' });
      }
      return NextResponse.redirect(
        new URL(`${redirectPage}?error=no_code`, request.url)
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // Fetch user profile from Google
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = profileRes.ok
      ? await profileRes.json()
      : { email: 'Unknown', name: 'Google User', picture: '' };

    // Calculate token expiry (default 1 hour)
    const expiresAt = Date.now() + ((tokens.expiry_date ? tokens.expiry_date - Date.now() : 3600 * 1000));

    if (mode === 'popup') {
      // Return HTML that posts message to the opener window, then closes
      const response = popupResponse({
        type: 'google-auth-success',
        profile: {
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
        },
      });

      // Set httpOnly cookies for the tokens (scoped to /api/google-drive/)
      setTokenCookies(response, tokens.access_token, tokens.refresh_token ?? null, expiresAt);
      return response;
    }

    // Legacy redirect mode — redirect back with tokens in URL params
    const redirectUrl = new URL(redirectPage, request.url);
    redirectUrl.searchParams.set('access_token', tokens.access_token);
    if (tokens.refresh_token) {
      redirectUrl.searchParams.set('refresh_token', tokens.refresh_token);
    }

    const response = NextResponse.redirect(redirectUrl);
    setTokenCookies(response, tokens.access_token, tokens.refresh_token ?? null, expiresAt);
    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    const redirectPage = '/workspace/generated-content';
    return NextResponse.redirect(
      new URL(`${redirectPage}?error=${encodeURIComponent('auth_failed')}`, request.url)
    );
  }
}

/** Set httpOnly cookies for Google Drive tokens. */
function setTokenCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: number,
) {
  const secure = process.env.NODE_ENV === 'production';
  const sameSite = 'lax' as const;

  response.cookies.set('gdrive_access_token', accessToken, {
    path: '/api/google-drive',
    httpOnly: true,
    secure,
    sameSite,
    maxAge: Math.floor((expiresAt - Date.now()) / 1000),
  });

  if (refreshToken) {
    response.cookies.set('gdrive_refresh_token', refreshToken, {
      path: '/api/google-drive',
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }
}

/** Return an HTML page that sends a postMessage to the opener and closes. */
function popupResponse(data: Record<string, unknown>): NextResponse {
  const json = JSON.stringify(data);
  const html = `<!DOCTYPE html>
<html><head><title>Google Sign-In</title></head>
<body>
<script>
  var data = ${json};
  // BroadcastChannel is the most reliable mechanism — works even if window.opener
  // is nullified after cross-origin navigation through Google's sign-in pages.
  try {
    var bc = new BroadcastChannel('google-auth');
    bc.postMessage(data);
    bc.close();
  } catch(e) {}
  // postMessage fallback for browsers without BroadcastChannel
  try {
    if (window.opener) {
      window.opener.postMessage(data, window.location.origin);
    }
  } catch(e) {}
  // Delay close so both channels have time to deliver the message
  // before the window is destroyed.
  setTimeout(function() { window.close(); }, 300);
<\/script>
<p style="font-family:sans-serif;text-align:center;margin-top:40px;color:#666">Signing in\u2026 this window will close automatically.</p>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}