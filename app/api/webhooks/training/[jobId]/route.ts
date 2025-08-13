import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const params = await context.params;
  return NextResponse.json({
    message: 'Training webhook endpoint is active',
    jobId: params.jobId,
    timestamp: new Date().toISOString()
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const params = await context.params;
    const jobId = params.jobId;
    const body = await request.json();
    
    console.log(`🔔 Basic webhook received for job ${jobId}:`, body);

    return NextResponse.json({
      success: true,
      message: 'Training webhook basic test works!',
      jobId: jobId,
      receivedBody: body,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Training webhook error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
