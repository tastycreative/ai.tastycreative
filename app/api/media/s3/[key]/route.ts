import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// S3 client for RunPod Network Volume
function getS3Client() {
  return new S3Client({
    region: 'us-ks-2',
    endpoint: 'https://s3api-us-ks-2.runpod.io',
    credentials: {
      accessKeyId: process.env.RUNPOD_S3_ACCESS_KEY || '',
      secretAccessKey: process.env.RUNPOD_S3_SECRET_KEY || ''
    },
    forcePathStyle: true
  });
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const s3Key = decodeURIComponent(key);
    
    console.log(`🔍 Optimized S3 proxy request for key: ${s3Key}`);
    
    // Verify this is a valid S3 key format (should start with outputs/)
    if (!s3Key.startsWith('outputs/')) {
      console.error(`❌ Invalid S3 key format: ${s3Key}`);
      return NextResponse.json({ error: 'Invalid key format' }, { status: 400 });
    }
    
    const s3Client = getS3Client();
    const bucketName = process.env.RUNPOD_S3_BUCKET_NAME || '83cljmpqfd';
    
    // Check for Range header for partial content support (important for videos)
    const rangeHeader = request.headers.get('range');
    
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      ...(rangeHeader && { Range: rangeHeader })
    });

    try {
      console.log(`📥 Fetching from S3: ${bucketName}/${s3Key}${rangeHeader ? ` with range: ${rangeHeader}` : ''}`);
      
      const response = await s3Client.send(command);
      
      if (!response.Body) {
        console.error(`❌ No data found for key: ${s3Key}`);
        return NextResponse.json({ error: 'Data not found' }, { status: 404 });
      }

      // Determine content type
      const contentType = s3Key.toLowerCase().endsWith('.mp4') ? 'video/mp4' : 
                         s3Key.toLowerCase().endsWith('.webm') ? 'video/webm' :
                         s3Key.toLowerCase().endsWith('.mov') ? 'video/quicktime' :
                         s3Key.toLowerCase().endsWith('.png') ? 'image/png' : 
                         s3Key.toLowerCase().endsWith('.jpg') || s3Key.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' :
                         s3Key.toLowerCase().endsWith('.webp') ? 'image/webp' :
                         s3Key.toLowerCase().endsWith('.gif') ? 'image/gif' : 'application/octet-stream';

      // Build response headers
      const responseHeaders: Record<string, string> = {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // 1 year cache
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      };

      // Add Content-Length if available
      if (response.ContentLength) {
        responseHeaders['Content-Length'] = response.ContentLength.toString();
      }

      // Handle range requests (important for video streaming)
      if (rangeHeader && response.ContentRange) {
        responseHeaders['Content-Range'] = response.ContentRange;
        responseHeaders['Accept-Ranges'] = 'bytes';
      } else if (contentType.startsWith('video/')) {
        responseHeaders['Accept-Ranges'] = 'bytes';
      }

      // Convert stream to buffer for smaller files (< 10MB) or use streaming for larger files
      const contentLength = response.ContentLength || 0;
      const isLargeFile = contentLength > 10 * 1024 * 1024; // 10MB threshold

      if (isLargeFile && !rangeHeader) {
        // For large files without range requests, redirect to try direct access
        // or stream the response to reduce memory usage
        console.log(`📦 Large file detected (${contentLength} bytes), using streaming response`);
        
        // Stream the response directly
        const stream = response.Body as any;
        
        return new NextResponse(stream, {
          status: rangeHeader ? 206 : 200,
          headers: responseHeaders,
        });
      } else {
        // For smaller files or range requests, buffer the response
        const stream = response.Body as any;
        const chunks: Uint8Array[] = [];
        
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        
        const buffer = Buffer.concat(chunks);
        
        console.log(`✅ Successfully fetched: ${s3Key}, size: ${buffer.length} bytes`);
        
        return new NextResponse(buffer, {
          status: rangeHeader ? 206 : 200,
          headers: responseHeaders,
        });
      }
      
    } catch (s3Error: any) {
      console.error('❌ Error fetching from S3:', s3Error);
      
      // More specific error handling
      if (s3Error?.name === 'NoSuchKey' || s3Error?.$response?.statusCode === 404) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
      
      return NextResponse.json({ error: 'Failed to access file' }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ Error in optimized S3 proxy:', error);
    return NextResponse.json({ 
      error: 'Failed to serve file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Support HEAD requests for metadata
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const s3Key = decodeURIComponent(key);
    
    if (!s3Key.startsWith('outputs/')) {
      return new NextResponse(null, { status: 400 });
    }
    
    const s3Client = getS3Client();
    const bucketName = process.env.RUNPOD_S3_BUCKET_NAME || '83cljmpqfd';
    
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key
    });

    const response = await s3Client.send(command);
    
    const contentType = s3Key.toLowerCase().endsWith('.mp4') ? 'video/mp4' : 
                       s3Key.toLowerCase().endsWith('.png') ? 'image/png' : 
                       'application/octet-stream';

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': response.ContentLength?.toString() || '0',
        'Cache-Control': 'public, max-age=31536000',
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    return new NextResponse(null, { status: 404 });
  }
}