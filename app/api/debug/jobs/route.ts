// app/api/debug/jobs/route.ts - Debug jobs storage
import { NextRequest, NextResponse } from 'next/server';
import { 
  debugJobsStorage, 
  getAllJobs, 
  getJobsByUser,
  getJobIds,
  sharedJobs 
} from '@/lib/jobsStorage';

function getUserId(request: NextRequest): string {
  return request.headers.get('x-user-id') || 'default-user';
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const includeAll = request.nextUrl.searchParams.get('all') === 'true';

    console.log('🔍 === JOBS DEBUG ===');
    console.log('👤 Requesting user:', userId);
    console.log('📊 Include all jobs:', includeAll);

    // Await all async functions
    const storageDebug = await debugJobsStorage();
    const userJobs = await getJobsByUser(userId);
    const allJobIds = await getJobIds();

    console.log('📈 Storage stats:', storageDebug);
    console.log('👥 User jobs count:', userJobs.length);

    const response: any = {
      success: true,
      timestamp: new Date().toISOString(),
      requestingUser: userId,
      storageStats: storageDebug,
      userJobsCount: userJobs.length,
      userJobs: userJobs.map(job => ({
        id: job.id,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        lastChecked: job.lastChecked,
        hasResults: !!job.resultUrls?.length,
        resultCount: job.resultUrls?.length || 0,
        comfyUIPromptId: job.comfyUIPromptId
      })),
      allJobIds
    };

    if (includeAll) {
      const allJobs = await getAllJobs();
      response.allJobsCount = allJobs.length;
      response.allJobs = allJobs.map(job => ({
        id: job.id,
        userId: job.userId,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        lastChecked: job.lastChecked,
        hasResults: !!job.resultUrls?.length
      }));

      // Group by user for analysis
      const jobsByUser: Record<string, number> = {};
      allJobs.forEach(job => {
        jobsByUser[job.userId] = (jobsByUser[job.userId] || 0) + 1;
      });
      response.jobsByUser = jobsByUser;
    }

    // Raw storage access for debugging
    response.rawStorageSize = sharedJobs.size;
    response.rawStorageKeys = Array.from(sharedJobs.keys());

    return NextResponse.json(response);

  } catch (error) {
    console.error('💥 Jobs debug error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        rawStorageSize: sharedJobs.size,
        rawStorageKeys: Array.from(sharedJobs.keys())
      },
      { status: 500 }
    );
  }
}