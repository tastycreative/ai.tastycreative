import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");
    const download = searchParams.get("download") === "true";
    const bypass = searchParams.get("bypass") || "default";

    if (!url) {
      return NextResponse.json(
        { error: "URL parameter is required" },
        { status: 400 }
      );
    }

    // Validate allowed domains (Instagram CDN and S3 buckets)
    const isInstagram = url.includes("cdninstagram.com") || url.includes("fbcdn.net");
    const isS3 = url.includes("s3.amazonaws.com") || 
                 url.includes(".s3.") || 
                 url.includes("s3-") ||
                 url.includes("amazonaws.com");
    
    if (!isInstagram && !isS3) {
      return NextResponse.json(
        { error: "Only Instagram and S3 image URLs are allowed" },
        { status: 403 }
      );
    }

    // For S3 URLs, use simple fetch
    if (isS3) {
      try {
        const s3Response = await fetch(url);
        if (!s3Response.ok) {
          return NextResponse.json(
            { error: `Failed to fetch from S3: ${s3Response.status}` },
            { status: s3Response.status }
          );
        }
        
        const contentType = s3Response.headers.get("content-type") || "image/jpeg";
        const buffer = await s3Response.arrayBuffer();
        
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (error) {
        console.error("S3 proxy error:", error);
        return NextResponse.json(
          { error: "Failed to proxy S3 image" },
          { status: 500 }
        );
      }
    }

    console.log(`Proxying Instagram image with bypass strategy: ${bypass}`);

    // Try multiple fetch strategies with different bypass techniques
    let response;
    let lastError;

    // Strategy 1: Instagram Bot User-Agent (often bypasses restrictions)
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          "Referer": "https://www.facebook.com/",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
      });

      if (response.ok) {
        console.log(`✅ Facebook Bot strategy succeeded`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Facebook Bot strategy failed:`, error);
      lastError = error;

      // Strategy 2: Google Bot User-Agent
      try {
        response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate",
          },
        });

        if (response.ok) {
          console.log(`✅ Google Bot strategy succeeded`);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error2) {
        console.log(`❌ Google Bot strategy failed:`, error2);
        lastError = error2;

        // Strategy 3: WhatsApp User-Agent (Instagram often allows this)
        try {
          response = await fetch(url, {
            headers: {
              "User-Agent": "WhatsApp/2.19.81 A",
              "Accept": "image/jpeg, image/png, image/webp, image/gif, */*",
            },
          });

          if (response.ok) {
            console.log(`✅ WhatsApp strategy succeeded`);
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (error3) {
          console.log(`❌ WhatsApp strategy failed:`, error3);
          lastError = error3;

          // Strategy 4: Mobile Instagram App User-Agent
          try {
            response = await fetch(url, {
              headers: {
                "User-Agent": "Instagram 219.0.0.12.117 Android",
                "Accept": "*/*",
                "Accept-Encoding": "gzip, deflate",
              },
            });

            if (response.ok) {
              console.log(`✅ Instagram Mobile strategy succeeded`);
            } else {
              throw new Error(`HTTP ${response.status}`);
            }
          } catch (error4) {
            console.log(`❌ Instagram Mobile strategy failed:`, error4);
            lastError = error4;

            // Strategy 5: Try modifying the URL to bypass restrictions
            try {
              // Remove some tracking parameters that might trigger blocks
              const cleanUrl = url.split('?')[0] + '?' + 
                url.split('?')[1]?.split('&')
                  .filter(param => !param.includes('_nc_ohc') && !param.includes('_nc_gid'))
                  .join('&');

              response = await fetch(cleanUrl, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1",
                  "Accept": "image/png,image/svg+xml,image/*;q=0.8,video/*;q=0.8,*/*;q=0.5",
                  "Referer": "https://instagram.com/",
                },
              });

              if (response.ok) {
                console.log(`✅ Clean URL strategy succeeded`);
              } else {
                throw new Error(`HTTP ${response.status}`);
              }
            } catch (error5) {
              console.log(`❌ Clean URL strategy failed:`, error5);
              lastError = error5;

              // Strategy 6: Last resort - no headers at all
              try {
                response = await fetch(url);
                
                if (response.ok) {
                  console.log(`✅ No headers strategy succeeded`);
                } else {
                  throw new Error(`HTTP ${response.status}`);
                }
              } catch (error6) {
                console.log(`❌ All bypass strategies failed:`, error6);
                lastError = error6;
                response = undefined;
              }
            }
          }
        }
      }
    }

    // If all strategies failed, return error
    if (!response || !response.ok) {
      const status = response?.status || 500;
      const statusText = response?.statusText || 'Unknown error';
      
      console.log(`Failed to fetch image: ${status} ${statusText}`);
      
      if (status === 403 || status === 429) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Instagram blocked the request", 
            originalUrl: url,
            suggestion: "Try opening the image in a new tab or using a different method"
          },
          { status: 500 }
        );
      }
      
      if (status === 404) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Image not found", 
            originalUrl: url
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to fetch image: ${status}`,
          originalUrl: url
        },
        { status: 500 }
      );
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const imageData = await response.arrayBuffer();

    // If this is a request for base64 encoding (for bypass purposes)
    if (searchParams.get("format") === "base64") {
      const base64 = Buffer.from(imageData).toString('base64');
      const dataUrl = `data:${contentType};base64,${base64}`;
      
      return NextResponse.json({
        success: true,
        dataUrl: dataUrl,
        contentType: contentType,
        size: imageData.byteLength
      });
    }

    // Create response with proper headers
    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });

    // Add download header if requested
    if (download) {
      headers.set("Content-Disposition", "attachment; filename=instagram-image.jpg");
    }

    return new NextResponse(imageData, { headers });

  } catch (error) {
    console.error("Proxy image error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to proxy image" 
      },
      { status: 500 }
    );
  }
}
