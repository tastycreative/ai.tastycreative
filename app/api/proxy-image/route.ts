// app/api/proxy-image/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');
    const download = searchParams.get('download') === 'true'; // Check if it's for download or display

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    // Validate that it's an Instagram URL
    if (!imageUrl.includes('cdninstagram.com') && !imageUrl.includes('fbcdn.net')) {
      return NextResponse.json(
        { error: "Only Instagram images are allowed" },
        { status: 400 }
      );
    }

    console.log(`${download ? '📥 Download' : '🖼️  Display'} request for:`, imageUrl.substring(0, 80) + "...");

    // Try multiple strategies to fetch the image
    let imageBuffer: ArrayBuffer | null = null;
    let contentType = 'image/jpeg';

    // Strategy 1: Direct fetch with Instagram-like headers
    try {
      const response = await fetchWithInstagramHeaders(imageUrl);
      if (response.ok) {
        imageBuffer = await response.arrayBuffer();
        contentType = response.headers.get('content-type') || 'image/jpeg';
        console.log("✅ Strategy 1 successful: Direct fetch");
      }
    } catch (error) {
      console.log("❌ Strategy 1 failed:", error);
    }

    // Strategy 2: Fetch with mobile user agent
    if (!imageBuffer) {
      try {
        const response = await fetchWithMobileHeaders(imageUrl);
        if (response.ok) {
          imageBuffer = await response.arrayBuffer();
          contentType = response.headers.get('content-type') || 'image/jpeg';
          console.log("✅ Strategy 2 successful: Mobile fetch");
        }
      } catch (error) {
        console.log("❌ Strategy 2 failed:", error);
      }
    }

    // Strategy 3: Fetch with bot-like headers (sometimes works)
    if (!imageBuffer) {
      try {
        const response = await fetchWithBotHeaders(imageUrl);
        if (response.ok) {
          imageBuffer = await response.arrayBuffer();
          contentType = response.headers.get('content-type') || 'image/jpeg';
          console.log("✅ Strategy 3 successful: Bot fetch");
        }
      } catch (error) {
        console.log("❌ Strategy 3 failed:", error);
      }
    }

    // Strategy 4: Try with minimal headers
    if (!imageBuffer) {
      try {
        const response = await fetch(imageUrl, {
          headers: {
            'Accept': 'image/*',
          },
        });
        if (response.ok) {
          imageBuffer = await response.arrayBuffer();
          contentType = response.headers.get('content-type') || 'image/jpeg';
          console.log("✅ Strategy 4 successful: Minimal headers");
        }
      } catch (error) {
        console.log("❌ Strategy 4 failed:", error);
      }
    }

    if (!imageBuffer) {
      console.log("❌ All strategies failed");
      throw new Error("All fetch strategies failed");
    }

    console.log(`✅ Successfully fetched image: ${imageBuffer.byteLength} bytes, type: ${contentType}`);

    // Return different headers based on whether it's for download or display
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': imageBuffer.byteLength.toString(),
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Add download headers only if explicitly requested
    if (download) {
      headers['Content-Disposition'] = 'attachment; filename="instagram-image.jpg"';
    }

    return new NextResponse(imageBuffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error("❌ Image proxy failed completely:", error);
    
    // Return error response that frontend can handle
    return NextResponse.json({
      success: false,
      error: "Failed to load image from Instagram",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

// Strategy 1: Instagram-like browser headers
async function fetchWithInstagramHeaders(url: string) {
  return fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.instagram.com/',
      'Origin': 'https://www.instagram.com',
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
  });
}

// Strategy 2: Mobile browser headers
async function fetchWithMobileHeaders(url: string) {
  return fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Accept': 'image/png,image/svg+xml,image/*;q=0.8,video/*;q=0.8,*/*;q=0.5',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.instagram.com/',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
  });
}

// Strategy 3: Bot-like headers (sometimes Instagram allows these)
async function fetchWithBotHeaders(url: string) {
  return fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Accept': 'image/*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}