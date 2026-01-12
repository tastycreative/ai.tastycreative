import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get image URL from query params
    const searchParams = request.nextUrl.searchParams;
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
    }

    // Validate URL is from allowed sources (S3 bucket)
    const allowedDomains = [
      '.s3.amazonaws.com',
      '.s3.',
      process.env.AWS_S3_BUCKET,
    ];

    const isAllowed = allowedDomains.some(domain => 
      imageUrl.includes(domain || '')
    );

    if (!isAllowed) {
      return NextResponse.json({ error: "Invalid image source" }, { status: 403 });
    }

    // Extract S3 key from URL
    const urlObj = new URL(imageUrl);
    // Decode the pathname to handle URL-encoded characters
    let key = decodeURIComponent(urlObj.pathname);
    // Remove leading slash if present
    key = key.startsWith('/') ? key.slice(1) : key;
    const bucket = process.env.AWS_S3_BUCKET || 'tastycreative';

    console.log('Downloading from S3:', { bucket, key, imageUrl });

    // Fetch from S3 using AWS SDK
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('No image data received from S3');
    }

    // Convert stream to buffer
    const imageBytes = await response.Body.transformToByteArray();
    const imageBuffer = Buffer.from(imageBytes);

    // Determine content type from S3 response or default to image/jpeg
    const contentType = response.ContentType || 'image/jpeg';

    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="image.${contentType.split('/')[1]}"`,
        'Cache-Control': 'public, max-age=31536000',
      },
    });

  } catch (error: any) {
    console.error("Image download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to download image" },
      { status: 500 }
    );
  }
}
