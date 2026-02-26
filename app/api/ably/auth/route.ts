import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAblyTokenRequest } from '@/lib/ably';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tokenRequest = await createAblyTokenRequest(userId);
  return NextResponse.json(tokenRequest);
}
