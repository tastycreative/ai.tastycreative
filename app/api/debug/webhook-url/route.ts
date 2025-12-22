import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Test webhook URL construction similar to generation endpoints
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                  process.env.NEXT_PUBLIC_BASE_URL || 
                  process.env.BASE_URL ||
                  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  
  const testJobId = 'test_job_123';
  const webhookUrl = baseUrl ? `${baseUrl}/api/webhooks/generation/${testJobId}` : null;
  
  return NextResponse.json({
    debug: 'Webhook URL construction test',
    environment: {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
      BASE_URL: process.env.BASE_URL,
      VERCEL_URL: process.env.VERCEL_URL,
    },
    computed: {
      baseUrl,
      webhookUrl,
    }
  });
}
