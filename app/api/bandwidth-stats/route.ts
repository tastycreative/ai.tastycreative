import { NextRequest, NextResponse } from 'next/server';
import { bandwidthMonitor } from '@/lib/bandwidthMonitor';

export async function GET(request: NextRequest) {
  try {
    const stats = bandwidthMonitor.getHourlyStats();
    
    const report = {
      timestamp: new Date().toISOString(),
      period: 'Last 1 hour',
      stats: {
        totalRequests: stats.totalRequests,
        totalBandwidth: formatBytes(stats.totalBandwidth),
        totalBandwidthRaw: stats.totalBandwidth,
        avgRequestSize: formatBytes(stats.avgRequestSize),
        avgResponseSize: formatBytes(stats.avgResponseSize),
        topEndpoints: stats.topEndpoints.map(endpoint => ({
          ...endpoint,
          bandwidthFormatted: formatBytes(endpoint.bandwidth)
        }))
      },
      optimizations: {
        imageUpload: 'Removed base64 data from responses (~85% reduction)',
        videoAnalysis: 'Image compression for OpenAI (~40-60% reduction)',
        imageToVideo: 'Removed base64 payload from RunPod calls (~90% reduction)',
        compression: 'Added gzip compression to all API responses',
        imageOptimization: 'Optimize uploaded images (quality 85%, max 2048px)'
      }
    };

    return NextResponse.json(report);

  } catch (error) {
    console.error('❌ Bandwidth stats error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve bandwidth statistics' },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}