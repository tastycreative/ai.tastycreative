import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state'); // Get the state parameter to know where to redirect

    if (error) {
      const redirectPage = state || '/workspace/generated-content';
      return NextResponse.redirect(
        new URL(`${redirectPage}?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      const redirectPage = state || '/workspace/generated-content';
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

    // Redirect back to the original page (or generated-content as fallback)
    const redirectPage = state || '/workspace/generated-content';
    const redirectUrl = new URL(redirectPage, request.url);
    redirectUrl.searchParams.set('access_token', tokens.access_token);
    if (tokens.refresh_token) {
      redirectUrl.searchParams.set('refresh_token', tokens.refresh_token);
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    const redirectPage = '/workspace/generated-content'; // Default fallback
    return NextResponse.redirect(
      new URL(`${redirectPage}?error=${encodeURIComponent('auth_failed')}`, request.url)
    );
  }
}