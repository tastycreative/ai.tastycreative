// app/api/debug/system-status/route.ts - Comprehensive system debug endpoint
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJob } from '@/lib/jobsStorage';
import { getUserImages, getJobImages } from '@/lib/imageStorage';
import { buildComfyUIUrl } from '@/lib/imageStorage';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://209.53.88.242:14753';

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    console.log('🔍 === SYSTEM DEBUG STATUS ===');
    console.log('👤 User ID:', clerkId);
    console.log('🆔 Job ID:', jobId);
    console.log('🌍 NODE_ENV:', process.env.NODE_ENV);
    console.log('🌐 NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
    console.log('🖥️ COMFYUI_URL:', COMFYUI_URL);

    const status: any = {
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        COMFYUI_URL: COMFYUI_URL,
        isProduction: process.env.NODE_ENV === 'production',
        hasHTTPS: process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://'),
      },
      user: {
        clerkId,
        authenticated: true
      },
      timestamps: {
        currentTime: new Date().toISOString(),
      }
    };

    // Check ComfyUI connectivity
    try {
      console.log('🔗 Testing ComfyUI connectivity...');
      const comfyUITest = await fetch(`${COMFYUI_URL}/queue`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });
      
      status.comfyui = {
        url: COMFYUI_URL,
        accessible: comfyUITest.ok,
        status: comfyUITest.status,
        statusText: comfyUITest.statusText
      };
      
      if (comfyUITest.ok) {
        const queueData = await comfyUITest.json();
        status.comfyui.queueRunning = queueData.queue_running?.length || 0;
        status.comfyui.queuePending = queueData.queue_pending?.length || 0;
      }
    } catch (comfyUIError) {
      status.comfyui = {
        url: COMFYUI_URL,
        accessible: false,
        error: comfyUIError instanceof Error ? comfyUIError.message : 'Unknown error'
      };
    }

    // Check user's images
    try {
      console.log('📸 Fetching user images...');
      const userImages = await getUserImages(clerkId, { limit: 10 });
      status.userImages = {
        count: userImages.length,
        hasImages: userImages.length > 0,
        recent: userImages.slice(0, 3).map(img => ({
          id: img.id,
          filename: img.filename,
          hasDataUrl: !!img.dataUrl,
          hasUrl: !!img.url,
          createdAt: img.createdAt,
          jobId: img.jobId
        }))
      };
    } catch (imageError) {
      status.userImages = {
        error: imageError instanceof Error ? imageError.message : 'Unknown error'
      };
    }

    // Check specific job if provided
    if (jobId) {
      try {
        console.log(`🔍 Checking job: ${jobId}`);
        const job = await getJob(jobId);
        if (job) {
          status.job = {
            id: job.id,
            status: job.status,
            progress: job.progress,
            clerkId: job.clerkId,
            createdAt: job.createdAt,
            lastChecked: job.lastChecked,
            comfyUIPromptId: job.comfyUIPromptId,
            hasResultUrls: !!job.resultUrls && job.resultUrls.length > 0,
            resultUrlsCount: job.resultUrls?.length || 0,
            isOwnedByUser: job.clerkId === clerkId
          };

          // Check job-specific images
          try {
            const jobImages = await getJobImages(jobId);
            status.job.images = {
              count: jobImages.length,
              hasImages: jobImages.length > 0,
              images: jobImages.map(img => ({
                id: img.id,
                filename: img.filename,
                hasDataUrl: !!img.dataUrl,
                hasUrl: !!img.url,
                dataUrl: img.dataUrl,
                url: img.url,
                urlConstruction: {
                  shouldUseProxy: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://'),
                  expectedProxyUrl: buildComfyUIUrl({
                    filename: img.filename,
                    subfolder: img.subfolder,
                    type: img.type
                  })
                }
              }))
            };
          } catch (jobImageError) {
            status.job.images = {
              error: jobImageError instanceof Error ? jobImageError.message : 'Unknown error'
            };
          }

        } else {
          status.job = {
            error: 'Job not found',
            id: jobId
          };
        }
      } catch (jobError) {
        status.job = {
          error: jobError instanceof Error ? jobError.message : 'Unknown error',
          id: jobId
        };
      }
    }

    // Test proxy endpoint if in production
    if (process.env.NODE_ENV === 'production' && status.userImages?.recent?.length > 0) {
      const testImage = status.userImages.recent[0];
      if (testImage) {
        try {
          const proxyTestUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://ai.tastycreative.xyz'}/api/proxy/comfyui/view?filename=${testImage.filename}&subfolder=&type=output`;
          console.log('🧪 Testing proxy URL:', proxyTestUrl);
          
          const proxyTest = await fetch(proxyTestUrl, {
            method: 'HEAD', // Just check if accessible
            signal: AbortSignal.timeout(10000)
          });
          
          status.proxy = {
            testUrl: proxyTestUrl,
            accessible: proxyTest.ok,
            status: proxyTest.status,
            statusText: proxyTest.statusText
          };
        } catch (proxyError) {
          status.proxy = {
            error: proxyError instanceof Error ? proxyError.message : 'Unknown error'
          };
        }
      }
    }

    console.log('📊 System status completed');
    return NextResponse.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 System status check failed:', error);
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
