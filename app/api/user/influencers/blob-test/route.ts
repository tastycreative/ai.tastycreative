// app/api/user/influencers/blob-test/route.ts - Simple test endpoint
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Blob test endpoint working!'
  });
}
