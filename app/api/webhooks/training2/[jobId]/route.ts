import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const params = await context.params;
  return NextResponse.json({
    message: 'Training webhook endpoint is active (GET)',
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
    
    console.log(`🔔 RunPod webhook received for job ${jobId}:`, JSON.stringify(body, null, 2));

    // Handle different payload structures
    let runPodJobId: string;
    let runPodStatus: string;
    let output: any;
    let error: string | undefined;

    // Check if this is a direct RunPod webhook or our custom format
    if (body.id && ['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(body.status)) {
      // This is a RunPod webhook format
      runPodJobId = body.id;
      runPodStatus = body.status;
      output = body.output;
      error = body.error;
      console.log('📡 Processing RunPod webhook format');
    } else if (body.job_id && body.status) {
      // This is our custom webhook format
      runPodJobId = body.runpod_job_id || body.job_id;
      runPodStatus = body.status;
      output = body.output;
      error = body.error;
      console.log('📡 Processing custom webhook format');
    } else {
      console.error('❌ Unknown webhook payload format');
      return NextResponse.json(
        { error: 'Invalid webhook payload format' },
        { status: 400 }
      );
    }

    console.log(`✅ Webhook processed successfully for job ${jobId}`);
    console.log(`📊 Status: ${runPodStatus}, RunPod ID: ${runPodJobId}`);
    
    if (output) {
      console.log('📦 Output received:', Object.keys(output).join(', '));
    }

    // For now, just return success - database operations will be added gradually
    return NextResponse.json({
      success: true,
      message: 'Webhook received and logged successfully',
      jobId: jobId,
      runPodJobId: runPodJobId,
      status: runPodStatus,
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
