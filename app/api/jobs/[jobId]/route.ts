// app/api/jobs/[jobId]/route.ts - FIXED with Clerk + NeonDB
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJob, updateJob, debugJobsStorage } from '@/lib/jobsStorage';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://211.21.50.84:15833';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    console.log('🔍 === JOB STATUS CHECK (CLERK + NEONDB) ===');
    
    // Get authenticated user from Clerk
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      console.log('❌ No authenticated user found');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Await the params to fix Next.js error
    const { jobId } = await params;
    console.log('🆔 Checking job status for:', jobId);
    console.log('👤 Requesting user:', clerkId);
    console.log('💾 Using NeonDB with Prisma');

    if (!jobId) {
      console.error('❌ Missing jobId parameter');
      return NextResponse.json(
        { error: 'Missing jobId parameter' },
        { status: 400 }
      );
    }

    // Get job from NeonDB
    console.log('📊 Attempting to retrieve job from NeonDB...');
    const job = await getJob(jobId);
    
    console.log('✅ Job found in NeonDB:', !!job);
    
    if (job) {
      console.log('📋 Job details from NeonDB:');
      console.log('  - Status:', job.status);
      console.log('  - Progress:', job.progress);
      console.log('  - Clerk User ID:', job.clerkId);
      console.log('  - Created:', job.createdAt);
      console.log('  - Last checked:', job.lastChecked);
      console.log('  - ComfyUI prompt ID:', job.comfyUIPromptId);
      console.log('  - Result URLs count:', job.resultUrls?.length || 0);
      
      // Show some result URLs for debugging
      if (job.resultUrls && job.resultUrls.length > 0) {
        console.log('  - Sample result URL:', job.resultUrls[0]);
      }
    } else {
      console.log('❌ Job not found in NeonDB');
      const storageDebug = await debugJobsStorage();
      console.log('📊 Database debug info:', {
        totalJobs: storageDebug.totalJobs,
        requestedJobId: jobId
      });
    }

    if (!job) {
      const storageDebug = await debugJobsStorage();
      return NextResponse.json(
        { 
          success: false,
          error: 'Job not found in database',
          debug: {
            requestedJobId: jobId,
            totalJobs: storageDebug.totalJobs,
            message: 'Job may not have been created yet, or was not saved properly',
            timestamp: storageDebug.timestamp
          }
        },
        { status: 404 }
      );
    }

    // Ensure user can only access their own jobs
    if (job.clerkId !== clerkId) {
      console.log('🚫 Access denied - User mismatch:');
      console.log('  - Job Clerk ID:', job.clerkId);
      console.log('  - Requesting Clerk ID:', clerkId);
      return NextResponse.json(
        { 
          success: false,
          error: 'Access denied - job belongs to different user' 
        },
        { status: 403 }
      );
    }

    console.log('✅ Job access granted for Clerk user:', clerkId);

    // Return job with debug info
    const response: any = {
      success: true,
      ...job
    };

    // Add debug info for development
    response.debug = {
      jobId,
      foundInDatabase: true,
      databaseType: 'NeonDB (PostgreSQL)',
      authType: 'Clerk',
      lastChecked: job.lastChecked,
      comfyUIPromptId: job.comfyUIPromptId,
      clerkId: job.clerkId,
      requestingClerkId: clerkId,
      timestamp: new Date().toISOString(),
      jobAge: job.createdAt instanceof Date 
        ? Math.round((Date.now() - job.createdAt.getTime()) / 1000) + ' seconds'
        : 'unknown'
    };

    console.log('✅ Returning job data successfully');
    console.log('📊 Response summary:', {
      jobId: response.id,
      status: response.status,
      progress: response.progress,
      hasResults: !!response.resultUrls?.length,
      resultCount: response.resultUrls?.length || 0
    });
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('💥 === JOB STATUS ERROR ===');
    console.error('Error fetching job status:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5)
      });
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error in job status endpoint',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Additional endpoint to manually refresh job status from ComfyUI
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Get authenticated user from Clerk
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { jobId } = await params;
    const { action } = await request.json();
    
    if (action === 'refresh_from_comfyui') {
      console.log('🔄 Manual refresh requested for job:', jobId);
      console.log('👤 Requesting user:', clerkId);
      
      const job = await getJob(jobId);
      if (!job) {
        return NextResponse.json(
          { success: false, error: 'Job not found' },
          { status: 404 }
        );
      }
      
      // Ensure user can only refresh their own jobs
      if (job.clerkId !== clerkId) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
      
      // Try to get updated status from ComfyUI
      try {
        // Add authentication for RunPod/ComfyUI server
        const headers: Record<string, string> = {};
        const runpodApiKey = process.env.RUNPOD_API_KEY;
        if (runpodApiKey) {
          headers['Authorization'] = `Bearer ${runpodApiKey}`;
        }
        
        const historyResponse = await fetch(`${COMFYUI_URL}/history`, {
          headers,
          signal: AbortSignal.timeout(10000)
        });
        
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          
          // Look for the job in ComfyUI history
          for (const [historyJobId, jobData] of Object.entries(historyData)) {
            const jobInfo = jobData as any;
            
            if (historyJobId === job.comfyUIPromptId || 
                jobInfo.prompt?.[1]?.client_id === jobId) {
              
              console.log('🎯 Found job in ComfyUI history');
              
              if (jobInfo.status?.status_str === 'success' && jobInfo.outputs) {
                // Process completed job
                const imageUrls: string[] = [];
                for (const nodeId in jobInfo.outputs) {
                  const nodeOutput = jobInfo.outputs[nodeId];
                  if (nodeOutput.images) {
                    for (const image of nodeOutput.images) {
                      const imageUrl = `${COMFYUI_URL}/view?filename=${image.filename}&subfolder=${image.subfolder}&type=${image.type}`;
                      imageUrls.push(imageUrl);
                    }
                  }
                }
                
                const updatedJob = await updateJob(jobId, {
                  status: "completed",
                  progress: 100,
                  resultUrls: imageUrls,
                  lastChecked: new Date().toISOString()
                });
                
                return NextResponse.json({
                  success: true,
                  message: 'Job refreshed from ComfyUI - completed!',
                  job: updatedJob
                });
              }
            }
          }
        }
        
        return NextResponse.json({
          success: true,
          message: 'Job refreshed - no updates found in ComfyUI',
          job
        });
        
      } catch (comfyUIError) {
        console.error('ComfyUI refresh error:', comfyUIError);
        return NextResponse.json({
          success: false,
          error: 'Failed to refresh from ComfyUI',
          details: comfyUIError instanceof Error ? comfyUIError.message : 'Unknown error'
        });
      }
    }
    
    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Manual refresh error:', error);
    return NextResponse.json(
      { success: false, error: 'Refresh failed' },
      { status: 500 }
    );
  }
}