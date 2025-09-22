import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';

// S3 client for RunPod Network Volume
function getS3Client() {
  return new S3Client({
    region: 'us-ks-2',
    endpoint: 'https://s3api-us-ks-2.runpod.io', // Updated to match handler endpoint
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24 hours
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
    
    // Parse query parameters for image optimization
    const url = new URL(request.url);
    const size = url.searchParams.get('size') || 'full'; // thumbnail, medium, full
    const format = url.searchParams.get('format') || 'auto'; // auto, webp, jpeg, png
    const quality = parseInt(url.searchParams.get('quality') || '85'); // 1-100
    
    console.log(`🔍 S3 proxy request for key: ${s3Key}, size: ${size}, format: ${format}, quality: ${quality}`);
    
    // For network volume images, we can allow access without strict authentication
    // since the S3 keys are already scoped to user directories (outputs/userId/...)
    
    // Verify this is a valid S3 key format (should start with outputs/)
    if (!s3Key.startsWith('outputs/')) {
      console.error(`❌ Invalid S3 key format: ${s3Key}`);
      return NextResponse.json({ error: 'Invalid key format' }, { status: 400 });
    }
    
    // Generate signed URL for S3 access and fetch the image
    const s3Client = getS3Client();
    const bucketName = process.env.RUNPOD_S3_BUCKET_NAME || '83cljmpqfd';
    
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key
    });

    try {
      console.log(`📥 Fetching image from S3: ${bucketName}/${s3Key}`);
      
      // Fetch the image data from S3
      const response = await s3Client.send(command);
      
      if (!response.Body) {
        console.error(`❌ No image data found for key: ${s3Key}`);
        return NextResponse.json({ error: 'Image data not found' }, { status: 404 });
      }

      // Convert stream to buffer
      const stream = response.Body as any;
      const chunks: Uint8Array[] = [];
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      const originalBuffer = Buffer.concat(chunks);
      console.log(`✅ Original image size: ${originalBuffer.length} bytes`);
      
      // Process image with Sharp for optimization
      let processedBuffer: Buffer;
      let outputFormat: string;
      let mimeType: string;
      
      try {
        const sharpInstance = sharp(originalBuffer);
        const metadata = await sharpInstance.metadata();
        
        console.log(`📊 Image metadata: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);
        
        // Determine output format
        if (format === 'auto') {
          // Use WebP for better compression, fallback to JPEG for compatibility
          const acceptsWebP = request.headers.get('accept')?.includes('image/webp');
          outputFormat = acceptsWebP ? 'webp' : 'jpeg';
        } else {
          outputFormat = format;
        }
        
        // Determine dimensions based on size parameter
        let width: number | undefined;
        let height: number | undefined;
        
        switch (size) {
          case 'thumbnail':
            width = 400;
            height = 400;
            break;
          case 'medium':
            width = 800;
            height = 800;
            break;
          case 'full':
          default:
            // Keep original dimensions
            break;
        }
        
        // Apply transformations
        let pipeline = sharpInstance;
        
        if (width || height) {
          pipeline = pipeline.resize(width, height, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }
        
        // Apply format conversion and compression
        switch (outputFormat) {
          case 'webp':
            pipeline = pipeline.webp({ 
              quality: Math.max(60, quality), // Minimum 60 for WebP
              effort: 4 // Balanced compression effort
            });
            mimeType = 'image/webp';
            break;
          case 'jpeg':
            pipeline = pipeline.jpeg({ 
              quality: quality,
              progressive: true,
              mozjpeg: true // Better compression
            });
            mimeType = 'image/jpeg';
            break;
          case 'png':
            pipeline = pipeline.png({ 
              quality: quality,
              compressionLevel: 8,
              progressive: true
            });
            mimeType = 'image/png';
            break;
          default:
            // Fallback to JPEG
            pipeline = pipeline.jpeg({ quality: quality });
            mimeType = 'image/jpeg';
            break;
        }
        
        processedBuffer = await pipeline.toBuffer();
        
        const compressionRatio = ((originalBuffer.length - processedBuffer.length) / originalBuffer.length * 100).toFixed(1);
        console.log(`🗜️ Image processed: ${originalBuffer.length} → ${processedBuffer.length} bytes (${compressionRatio}% reduction)`);
        
      } catch (sharpError) {
        console.error('❌ Error processing image with Sharp:', sharpError);
        // Fallback to original image
        processedBuffer = originalBuffer;
        mimeType = s3Key.toLowerCase().endsWith('.png') ? 'image/png' : 
                  s3Key.toLowerCase().endsWith('.jpg') || s3Key.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' :
                  s3Key.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/png';
      }
      
      // Return the processed image with optimized headers
      return new NextResponse(processedBuffer as any, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': size === 'full' ? 'public, max-age=31536000' : 'public, max-age=604800', // 1 year for full, 1 week for thumbnails
          'Content-Length': processedBuffer.length.toString(),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'X-Content-Type-Options': 'nosniff',
          'Content-Disposition': 'inline',
          'X-Original-Size': originalBuffer.length.toString(),
          'X-Processed-Size': processedBuffer.length.toString(),
          'X-Compression-Ratio': `${((originalBuffer.length - processedBuffer.length) / originalBuffer.length * 100).toFixed(1)}%`,
          'Vary': 'Accept', // Vary based on Accept header for format selection
        },
      });
      
    } catch (s3Error) {
      console.error('❌ Error fetching from S3:', s3Error);
      
      // Fallback: try generating a signed URL redirect
      try {
        console.log(`🔄 Attempting signed URL fallback for: ${s3Key}`);
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        console.log(`✅ Generated signed URL, redirecting...`);
        return NextResponse.redirect(signedUrl);
      } catch (signedUrlError) {
        console.error('❌ Error generating signed URL:', signedUrlError);
        return NextResponse.json({ error: 'Failed to access image' }, { status: 500 });
      }
    }
    
  } catch (error) {
    console.error('❌ Error serving S3 image:', error);
    return NextResponse.json({ 
      error: 'Failed to serve image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}