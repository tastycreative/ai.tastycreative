import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { generateDirectUrl, generateBatchDirectUrls, validateS3Config } from '@/lib/s3DirectAccess';

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Generate direct S3 URLs (since signed URLs are not supported by RunPod)
 * NOTE: This requires the bucket to have public read access or proper CORS configuration
 */
export async function POST(request: NextRequest) {
  try {
    // Validate S3 configuration
    if (!validateS3Config()) {
      return NextResponse.json(
        { error: 'S3 configuration is incomplete' },
        { status: 500 }
      );
    }

    // Optional: Add authentication if needed
    // const { userId } = await auth();
    // if (!userId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const body = await request.json();
    const { s3Keys } = body;

    if (!s3Keys || !Array.isArray(s3Keys)) {
      return NextResponse.json(
        { error: 'Missing or invalid s3Keys array' },
        { status: 400 }
      );
    }

    console.log(`🔗 Generating direct S3 URLs for ${s3Keys.length} objects`);

    // Generate direct URLs in batch
    const directUrls = generateBatchDirectUrls(s3Keys);

    console.log(`✅ Generated ${Object.keys(directUrls).length} direct S3 URLs`);

    return NextResponse.json({
      success: true,
      directUrls,
      count: Object.keys(directUrls).length,
      note: 'These are direct S3 URLs. Ensure your bucket has proper CORS configuration for browser access.'
    });

  } catch (error) {
    console.error('❌ Error generating direct S3 URLs:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate direct S3 URLs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate a single direct S3 URL via GET request
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const s3Key = searchParams.get('key');

    if (!s3Key) {
      return NextResponse.json(
        { error: 'Missing s3Key parameter' },
        { status: 400 }
      );
    }

    if (!validateS3Config()) {
      return NextResponse.json(
        { error: 'S3 configuration is incomplete' },
        { status: 500 }
      );
    }

    console.log(`🔗 Generating direct S3 URL for: ${s3Key}`);

    const directUrl = generateDirectUrl(s3Key);

    return NextResponse.json({
      success: true,
      directUrl,
      s3Key,
      note: 'This is a direct S3 URL. Ensure your bucket has proper CORS configuration for browser access.'
    });

  } catch (error) {
    console.error('❌ Error generating direct S3 URL:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate direct S3 URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}