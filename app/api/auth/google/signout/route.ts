import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === 'production';

  // Clear token cookies from both old and new paths
  for (const path of ['/api/', '/api/google-drive']) {
    response.cookies.set('gdrive_access_token', '', {
      path,
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 0,
    });
    response.cookies.set('gdrive_refresh_token', '', {
      path,
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 0,
    });
  }

  return response;
}
