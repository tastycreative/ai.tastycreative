import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const redirectTo = searchParams.get('redirect') || '/workspace/generated-content';
    
    console.log('🔍 OAuth Environment Variables:');
    console.log('CLIENT_ID:', process.env.GOOGLE_OAUTH_CLIENT_ID);
    console.log('REDIRECT_URI:', process.env.GOOGLE_OAUTH_REDIRECT_URI);
    console.log('🔄 Will redirect back to:', redirectTo);
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URI
    );

    const scopes = [
      'https://www.googleapis.com/auth/drive.file'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: redirectTo, // Pass the redirect page as state
    });

    console.log('🔗 Generated Auth URL:', authUrl);
    console.log('📍 Extracted redirect_uri from URL:', new URL(authUrl).searchParams.get('redirect_uri'));
    console.log('📍 State parameter:', new URL(authUrl).searchParams.get('state'));

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}