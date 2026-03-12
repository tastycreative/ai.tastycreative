import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === 'production';

  // Clear both token cookies
  response.cookies.set('gdrive_access_token', '', {
    path: '/api/google-drive',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 0,
  });
  response.cookies.set('gdrive_refresh_token', '', {
    path: '/api/google-drive',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 0,
  });

  return response;
}
