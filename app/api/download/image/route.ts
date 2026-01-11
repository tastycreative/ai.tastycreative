import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

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

    // Fetch the image
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();

    // Determine content type from response or default to image/jpeg
    const contentType = response.headers.get('content-type') || 'image/jpeg';

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
