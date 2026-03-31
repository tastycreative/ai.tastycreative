import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const redirectTo = searchParams.get('redirect') || '/workspace/generated-content';
    const mode = searchParams.get('mode') || 'redirect'; // 'popup' or 'redirect'
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URI
    );

    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/spreadsheets',
    ];

    // Encode redirect + mode into state so the callback can handle both flows
    const state = JSON.stringify({ redirect: redirectTo, mode });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state,
    });

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}