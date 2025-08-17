// app/api/webhooks/training2/[jobId]/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Types for RunPod webhook payloads
interface RunPodWebhookPayload {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT';
  output?: {
    model_urls?: string[];
    sample_images?: string[];
    logs?: string;
    [key: string]: any;
  };
  error?: string;
  started_at?: string;
  completed_at?: string;
  execution_time?: number;
}

interface CustomWebhookPayload {
  job_id: string;
  runpod_job_id?: string;
  status: string;
  output?: any;
  error?: string;
  progress?: number;
  message?: string;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const params = await context.params;
  console.log(`🔍 GET request to training webhook for job: ${params.jobId}`);
  
  return NextResponse.json({
    message: 'Training webhook endpoint is active',
    jobId: params.jobId,
    method: 'GET',
    timestamp: new Date().toISOString(),
    status: 'healthy'
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const startTime = Date.now();
  
  try {
    const params = await context.params;
    const jobId = params.jobId;
    console.log(`\n=== 🔔 TRAINING WEBHOOK RECEIVED ===`);
    console.log(`📋 Job ID: ${jobId}`);
    console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
    
    // Parse request body
    let body: RunPodWebhookPayload | CustomWebhookPayload;
    try {
      body = await request.json();
      console.log(`📦 Payload:`, JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error('❌ Failed to parse webhook payload:', parseError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid JSON payload',
          jobId 
        },
        { status: 400 }
      );
    }

    // Determine payload type and extract data
    let runPodJobId: string;
    let status: string;
    let output: any;
    let error: string | undefined;
    let executionTime: number | undefined;
    let completedAt: string | undefined;

    // Check if this is a RunPod webhook format
    if ('id' in body && ['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(body.status)) {
      console.log('📡 Processing RunPod webhook format');
      runPodJobId = body.id;
      status = body.status;
      output = body.output;
      error = body.error;
      executionTime = body.execution_time;
      completedAt = body.completed_at;
    } 
    // Check if this is a custom webhook format
    else if ('job_id' in body && body.status) {
      console.log('📡 Processing custom webhook format');
      runPodJobId = body.runpod_job_id || body.job_id;
      status = body.status;
      output = body.output;
      error = body.error;
    } 
    else {
      console.error('❌ Unknown webhook payload format');
      console.error('❌ Expected either RunPod format (with "id" and status) or custom format (with "job_id")');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid webhook payload format',
          jobId,
          received: body 
        },
        { status: 400 }
      );
    }

    console.log(`📊 Processed Data:`);
    console.log(`   - Status: ${status}`);
    console.log(`   - RunPod Job ID: ${runPodJobId}`);
    console.log(`   - Has Output: ${output ? 'Yes' : 'No'}`);
    console.log(`   - Has Error: ${error ? 'Yes' : 'No'}`);

    // Handle different statuses
    switch (status) {
      case 'COMPLETED':
        console.log('✅ Training completed successfully!');
        if (output) {
          console.log('📦 Output summary:');
          if (output.model_urls) {
            console.log(`   - Model URLs: ${output.model_urls.length} files`);
            output.model_urls.forEach((url: string, index: number) => {
              console.log(`     ${index + 1}. ${url}`);
            });
          }
          if (output.sample_images) {
            console.log(`   - Sample Images: ${output.sample_images.length} files`);
          }
          if (executionTime) {
            console.log(`   - Execution Time: ${Math.round(executionTime / 1000)}s`);
          }
        }
        
        // TODO: Update database with completed status and model URLs
        // await updateTrainingJob(jobId, {
        //   status: 'COMPLETED',
        //   modelUrls: output?.model_urls || [],
        //   sampleImages: output?.sample_images || [],
        //   completedAt: new Date(),
        //   executionTime
        // });
        
        break;

      case 'FAILED':
        console.log('❌ Training failed!');
        if (error) {
          console.log(`💥 Error: ${error}`);
        }
        
        // TODO: Update database with failed status
        // await updateTrainingJob(jobId, {
        //   status: 'FAILED',
        //   error: error || 'Unknown error',
        //   failedAt: new Date()
        // });
        
        break;

      case 'IN_PROGRESS':
        console.log('🔄 Training in progress...');
        
        // TODO: Update progress in database
        // await updateTrainingJob(jobId, {
        //   status: 'IN_PROGRESS',
        //   lastProgressUpdate: new Date()
        // });
        
        break;

      case 'IN_QUEUE':
        console.log('⏳ Training job queued...');
        
        // TODO: Update database with queued status
        // await updateTrainingJob(jobId, {
        //   status: 'IN_QUEUE',
        //   queuedAt: new Date()
        // });
        
        break;

      case 'CANCELLED':
      case 'TIMED_OUT':
        console.log(`⚠️ Training ${status.toLowerCase().replace('_', ' ')}!`);
        
        // TODO: Update database with cancelled/timeout status
        // await updateTrainingJob(jobId, {
        //   status: status,
        //   cancelledAt: new Date()
        // });
        
        break;

      default:
        console.log(`📋 Training status update: ${status}`);
        
        // TODO: Update database with general status
        // await updateTrainingJob(jobId, {
        //   status: status,
        //   lastStatusUpdate: new Date()
        // });
    }

    const processingTime = Date.now() - startTime;
    console.log(`⚡ Webhook processed in ${processingTime}ms`);
    console.log(`=== ✅ WEBHOOK PROCESSING COMPLETE ===\n`);

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Webhook received and processed successfully',
      data: {
        jobId,
        runPodJobId,
        status,
        hasOutput: !!output,
        hasError: !!error,
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('💥 Webhook processing error:', error);
    console.error(`❌ Failed after ${processingTime}ms`);
    
    // Get jobId for error response
    let jobId: string;
    try {
      const params = await context.params;
      jobId = params.jobId;
    } catch {
      jobId = 'unknown';
    }
    
    // Return error response but still with 200 status to prevent retries
    return NextResponse.json({
      success: false,
      error: 'Internal server error during webhook processing',
      details: error instanceof Error ? error.message : 'Unknown error',
      jobId,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    });
  }
}

// Handle other HTTP methods with clear error messages
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const params = await context.params;
  return NextResponse.json(
    { 
      error: 'Method not allowed',
      message: 'This webhook endpoint only accepts GET and POST requests',
      jobId: params.jobId 
    },
    { status: 405 }
  );
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const params = await context.params;
  return NextResponse.json(
    { 
      error: 'Method not allowed',
      message: 'This webhook endpoint only accepts GET and POST requests',
      jobId: params.jobId 
    },
    { status: 405 }
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const params = await context.params;
  return NextResponse.json(
    { 
      error: 'Method not allowed',
      message: 'This webhook endpoint only accepts GET and POST requests',
      jobId: params.jobId 
    },
    { status: 405 }
  );
}