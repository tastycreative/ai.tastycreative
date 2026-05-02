import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/clerk-compat";

export async function POST(request: NextRequest) {
  console.log('🚀 Starting network volume upload API call...');
  
  try {
    // Test if the endpoint is reachable
    console.log('✅ API endpoint reached successfully');

    // Authenticate user
    console.log('🔐 Authenticating user...');
    const { userId } = await auth();
    if (!userId) {
      console.log('❌ Authentication failed - no userId');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log(`✅ User authenticated: ${userId}`);

    // Parse form data
    console.log('📋 Parsing form data...');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const displayName = formData.get('displayName') as string;

    console.log(`📁 File received: ${file?.name || 'none'}`);
    console.log(`🏷️ Display name: ${displayName || 'none'}`);

    if (!file) {
      console.log('❌ No file provided in form data');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!displayName) {
      console.log('❌ No display name provided in form data');
      return NextResponse.json({ error: 'No display name provided' }, { status: 400 });
    }

    // Basic validation before attempting S3 import
    const validExtensions = ['.safetensors', '.pt', '.ckpt'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      console.log(`❌ Invalid file type: ${file.name} (${fileExtension})`);
      return NextResponse.json({ 
        error: `Invalid file type "${fileExtension}". Only .safetensors, .pt, and .ckpt files are allowed.` 
      }, { status: 400 });
    }

    // Validate file size (500MB limit)
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      console.log(`❌ File too large: ${file.name} (${Math.round(file.size / 1024 / 1024)}MB)`);
      return NextResponse.json({ 
        error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size is 500MB.` 
      }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFileName = `${userId}_${timestamp}_${file.name}`;

    console.log(`🎯 Starting network volume upload for: ${uniqueFileName}`);
    console.log(`📁 File size: ${Math.round(file.size / 1024 / 1024)}MB`);
    console.log(`👤 User: ${userId}`);

    // Check environment variables first
    console.log('🔑 Checking S3 credentials...');
    const S3_ACCESS_KEY = process.env.RUNPOD_S3_ACCESS_KEY;
    const S3_SECRET_KEY = process.env.RUNPOD_S3_SECRET_KEY;

    console.log(`S3 Access Key: ${S3_ACCESS_KEY ? '✅ Present' : '❌ Missing'}`);
    console.log(`S3 Secret Key: ${S3_SECRET_KEY ? '✅ Present' : '❌ Missing'}`);

    if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
      console.error('❌ S3 credentials not configured');
      return NextResponse.json({ 
        error: 'Network volume storage credentials not configured. Please contact support.' 
      }, { status: 500 });
    }

    // Now try to import S3 modules
    console.log('📦 Importing S3 modules...');
    let S3Client, PutObjectCommand;
    try {
      const awsS3 = await import('@aws-sdk/client-s3');
      S3Client = awsS3.S3Client;
      PutObjectCommand = awsS3.PutObjectCommand;
      console.log('✅ S3 modules imported successfully');
    } catch (importError) {
      console.error('❌ Failed to import S3 modules:', importError);
      return NextResponse.json({ 
        error: 'Failed to load S3 modules. Please try again.' 
      }, { status: 500 });
    }

    console.log('☁️ Initializing S3 client for RunPod network volume...');

    // Create S3 client for RunPod network volume
    const s3Client = new S3Client({
      region: 'us-ks-2',
      endpoint: 'https://s3api-us-ks-2.runpod.io',
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
      forcePathStyle: true,
    });

    // Create the S3 key path for user-specific LoRA storage
    // This will be accessible to your serverless pod at /runpod-volume/loras/{userId}/
    const s3Key = `loras/${userId}/${uniqueFileName}`;

    console.log(`📤 Uploading to S3 key: ${s3Key}`);
    console.log(`🪣 Bucket: 83cljmpqfd`);

    try {
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`🔄 Starting S3 upload (${buffer.length} bytes)...`);

      // Upload to network volume via S3
      const uploadCommand = new PutObjectCommand({
        Bucket: '83cljmpqfd',
        Key: s3Key,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
        Metadata: {
          'original-filename': file.name,
          'display-name': displayName,
          'user-id': userId,
          'upload-timestamp': Date.now().toString(),
        },
      });

      await s3Client.send(uploadCommand);
      
      console.log(`✅ Network volume upload successful: s3://83cljmpqfd/${s3Key}`);
    } catch (s3Error) {
      console.error('❌ S3 upload failed:', s3Error);
      
      if (s3Error instanceof Error) {
        return NextResponse.json({ 
          error: `Network volume upload failed: ${s3Error.message}. Please try again or contact support.` 
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: 'Network volume upload failed due to an unknown error. Please try again.' 
      }, { status: 500 });
    }

    // The ComfyUI path that will be used in workflows
    const comfyUIPath = `/runpod-volume/loras/${userId}/${uniqueFileName}`;

    console.log('✅ Preparing success response...');
    const successResponse = {
      success: true,
      fileName: uniqueFileName,
      s3Key: s3Key,
      networkVolumePath: `/runpod-volume/${s3Key}`,
      serverlessPath: comfyUIPath,
      comfyUIPath: comfyUIPath,
      bucketName: '83cljmpqfd',
      message: 'LoRA uploaded directly to RunPod network volume - ready for instant use!',
      uploadLocation: 'network_volume_s3',
    };

    console.log('✅ Returning success response:', successResponse);
    return NextResponse.json(successResponse);

  } catch (error) {
    console.error('❌ Upload error:', error);
    
    // Make sure we always return a valid JSON response
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    console.error('❌ Error message:', errorMessage);
    
    const errorResponse = { 
      error: errorMessage,
      success: false,
      details: error instanceof Error ? error.stack : 'Unknown error'
    };

    console.log('❌ Returning error response:', errorResponse);
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
