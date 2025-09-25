import { NextRequest, NextResponse } from 'next/server';

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID;

export async function GET(request: NextRequest) {
  try {
    // Extract jobId from URL params
    const { searchParams } = new URL(request.url);
    const runpodJobId = searchParams.get('runpodJobId');

    if (!runpodJobId) {
      return NextResponse.json({
        error: 'Missing runpodJobId parameter. Usage: /api/debug/runpod-job?runpodJobId=YOUR_JOB_ID',
        example: '/api/debug/runpod-job?runpodJobId=6daa7eed-46b5-4a01-afd2-fdefbf3ff06f-e2'
      }, { status: 400 });
    }

    console.log('🔍 Debugging RunPod job:', runpodJobId);

    // Check RunPod job status
    const runpodStatusUrl = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${runpodJobId}`;
    
    const statusResponse = await fetch(runpodStatusUrl, {
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      },
    });

    if (!statusResponse.ok) {
      return NextResponse.json({
        error: 'Failed to get RunPod status',
        status: statusResponse.status,
        statusText: statusResponse.statusText
      }, { status: 500 });
    }

    const statusData = await statusResponse.json();
    
    // Return the full RunPod response for debugging
    return NextResponse.json({
      success: true,
      runpodJobId,
      status: statusData.status,
      fullResponse: statusData,
      imageCount: statusData.output?.images?.length || 0,
      hasImages: !!(statusData.output && statusData.output.images),
      imageFilenames: statusData.output?.images?.map((img: any) => img.filename) || []
    });

  } catch (error) {
    console.error('❌ RunPod debug error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
