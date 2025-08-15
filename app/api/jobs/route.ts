// app/api/jobs/route.ts - Create this new file
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserJobs, getUserJobStats } from '@/lib/jobsStorage';

export async function GET(request: NextRequest) {
  try {
    console.log('📋 === JOBS API GET ===');
    
    // Get authenticated user from Clerk
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    console.log('👤 User:', clerkId);
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;
    const statsOnly = searchParams.get('stats') === 'true';
    
    console.log('📋 Parameters:', { status, limit, offset, statsOnly });
    
    // Return stats only if requested
    if (statsOnly) {
      const stats = await getUserJobStats(clerkId);
      return NextResponse.json({
        success: true,
        stats
      });
    }
    
    // Get user's jobs from database
    const jobs = await getUserJobs(clerkId, {
      status,
      limit,
      offset
    });
    
    console.log('✅ Found', jobs.length, 'jobs for user');
    
    return NextResponse.json({
      success: true,
      jobs,
      count: jobs.length,
      filters: {
        status,
        limit,
        offset,
        clerkId
      }
    });
    
  } catch (error) {
    console.error('💥 Error in jobs API:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}