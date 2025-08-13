// app/api/test/shared-storage/route.ts - Test shared storage functionality
import { NextRequest, NextResponse } from 'next/server';
import { 
  addJob, 
  getJob, 
  updateJob, 
  debugJobsStorage,
  sharedJobs,
  type GenerationJob 
} from '@/lib/jobsStorage';

export async function GET(request: NextRequest) {
  try {
    console.log('=== SHARED STORAGE TEST ===');
    
    const storageDebug = debugJobsStorage();
    console.log('Current storage state:', storageDebug);
    
    return NextResponse.json({
      success: true,
      message: 'Shared storage test - GET',
      storageDebug,
      rawStorageSize: sharedJobs.size,
      rawStorageKeys: Array.from(sharedJobs.keys()),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Shared storage test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    console.log('=== SHARED STORAGE TEST POST ===');
    console.log('Action:', action);
    
    if (action === 'create_test_job') {
      const testJob: GenerationJob = {
        id: 'test-job-' + Date.now(),
        clerkId: 'test-clerk-id',
        userId: 'test-user',
        status: 'pending',
        createdAt: new Date(),
        progress: 0,
        params: { test: true }
      };
      
      console.log('Creating test job:', testJob.id);
      addJob(testJob);
      
      // Immediately try to retrieve it
      const retrievedJob = await getJob(testJob.id);
      console.log('Retrieved test job:', !!retrievedJob);
      
      return NextResponse.json({
        success: true,
        message: 'Test job created and retrieved',
        testJobId: testJob.id,
        createdSuccessfully: true,
        retrievedSuccessfully: !!retrievedJob,
        storageDebug: debugJobsStorage()
      });
    }
    
    if (action === 'update_test_job') {
      const jobId = 'test-job-latest';
      
      // Create a job first
      const testJob: GenerationJob = {
        id: jobId,
        clerkId: 'test-clerk-id',
        userId: 'test-user',
        status: 'pending',
        createdAt: new Date(),
        progress: 0
      };
      
      addJob(testJob);
      console.log('Created job for update test');
      
      // Update it
      const updatedJob = updateJob(jobId, {
        status: 'completed',
        progress: 100,
        resultUrls: ['http://example.com/image1.png']
      });
      
      console.log('Updated job:', !!updatedJob);
      
      return NextResponse.json({
        success: true,
        message: 'Test job updated',
        jobId,
        updateSuccessful: !!updatedJob,
        updatedJob,
        storageDebug: debugJobsStorage()
      });
    }
    
    if (action === 'test_job_workflow') {
      const jobId = 'workflow-test-' + Date.now();
      
      // Step 1: Create job (like generation endpoint does)
      const newJob: GenerationJob = {
        id: jobId,
        clerkId: 'workflow-test-clerk-id',
        userId: 'workflow-test-user',
        status: 'pending',
        createdAt: new Date(),
        progress: 0,
        params: { test: 'workflow' }
      };
      
      console.log('Step 1: Creating job');
      addJob(newJob);
      
      // Step 2: Try to retrieve it (like status endpoint does)
      console.log('Step 2: Retrieving job');
      const retrievedJob = await getJob(jobId);
      
      // Step 3: Update it (like polling does)
      console.log('Step 3: Updating job');
      const updatedJob = updateJob(jobId, {
        status: 'processing',
        progress: 50
      });
      
      // Step 4: Final retrieval
      console.log('Step 4: Final retrieval');
      const finalJob = await getJob(jobId);
      
      return NextResponse.json({
        success: true,
        message: 'Complete workflow test',
        jobId,
        step1_created: true,
        step2_retrieved: !!retrievedJob,
        step3_updated: !!updatedJob,
        step4_final_retrieved: !!finalJob,
        finalJobStatus: finalJob?.status,
        finalJobProgress: finalJob?.progress,
        storageDebug: debugJobsStorage()
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Shared storage POST test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}