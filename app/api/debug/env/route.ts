import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    serverTime: new Date().toISOString(),
    fallback: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  });
}
