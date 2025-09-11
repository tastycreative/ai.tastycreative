// app/api/instagram-extractor/route.ts
import { NextRequest, NextResponse } from "next/server";

// Note: Using dynamic import to avoid build issues
let ApifyClient: any;
try {
  ApifyClient = require("apify-client").ApifyClient;
} catch (error) {
  console.error("ApifyClient not found, using fallback");
}

interface InstagramPost {
  url: string;
  images: Array<{
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  }>;
  caption?: string;
  likes?: number;
  timestamp?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: "Instagram URL is required" },
        { status: 400 }
      );
    }

    // Validate Instagram URL
    const instagramUrlPattern = /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p|reel)\/[A-Za-z0-9_-]+\/?/;
    if (!instagramUrlPattern.test(url)) {
      return NextResponse.json(
        { error: "Invalid Instagram URL" },
        { status: 400 }
      );
    }

    // Check if ApifyClient is available
    if (!ApifyClient) {
      return NextResponse.json(
        { error: "Apify client not available. Please install apify-client." },
        { status: 500 }
      );
    }

    // Check for API token
    if (!process.env.APIFY_API_TOKEN) {
      return NextResponse.json(
        { error: "Apify API token not configured" },
        { status: 500 }
      );
    }

    // Initialize Apify client
    const apifyClient = new ApifyClient({
      token: process.env.APIFY_API_TOKEN,
    });

    console.log("Starting Instagram scraping for URL:", url);

    // Try multiple Apify actors for better success rate
    let result;
    try {
      result = await extractWithPrimaryActor(apifyClient, url);
    } catch (primaryError) {
      console.log("Primary actor failed, trying alternative:", primaryError);
      try {
        result = await extractWithAlternativeActor(apifyClient, url);
      } catch (alternativeError) {
        console.log("Alternative actor failed, trying third option:", alternativeError);
        result = await extractWithThirdActor(apifyClient, url);
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error("Instagram extraction error:", error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes("Rate limit") || error.message.includes("429")) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }
      
      if (error.message.includes("Private") || error.message.includes("403")) {
        return NextResponse.json(
          { error: "This Instagram post is private and cannot be accessed." },
          { status: 403 }
        );
      }
      
      if (error.message.includes("Not found") || error.message.includes("404")) {
        return NextResponse.json(
          { error: "Instagram post not found. Please check the URL." },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to extract images from Instagram post" },
      { status: 500 }
    );
  }
}

// Primary Apify actor
async function extractWithPrimaryActor(apifyClient: any, url: string): Promise<InstagramPost> {
  console.log("Using primary actor: apify/instagram-scraper");
  
  const run = await apifyClient.actor("apify/instagram-scraper").call({
    directUrls: [url],
    resultsType: "posts",
    resultsLimit: 1,
    addParentData: false,
  });

  // Wait for the run to finish
  await apifyClient.run(run.id).waitForFinish();

  // Get results
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  if (!items || items.length === 0) {
    throw new Error("No data found for this Instagram post");
  }

  const post = items[0] as any;
  console.log("Primary actor response:", JSON.stringify(post, null, 2));

  return parseInstagramData(post, url);
}

// Alternative Apify actor
async function extractWithAlternativeActor(apifyClient: any, url: string): Promise<InstagramPost> {
  console.log("Using alternative actor: jaroslavhejlek/instagram-scraper");
  
  const run = await apifyClient.actor("jaroslavhejlek/instagram-scraper").call({
    urls: [url],
    limit: 1,
    onlyPosts: true,
  });

  await apifyClient.run(run.id).waitForFinish();
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
  
  if (!items || items.length === 0) {
    throw new Error("No data found");
  }

  const post = items[0] as any;
  console.log("Alternative actor response:", JSON.stringify(post, null, 2));

  return parseInstagramDataAlternative(post, url);
}

// Third Apify actor option
async function extractWithThirdActor(apifyClient: any, url: string): Promise<InstagramPost> {
  console.log("Using third actor: dtrungtin/instagram-scraper");
  
  const run = await apifyClient.actor("dtrungtin/instagram-scraper").call({
    urls: [url],
    limit: 1,
    resultsLimit: 1,
  });

  await apifyClient.run(run.id).waitForFinish();
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
  
  if (!items || items.length === 0) {
    throw new Error("No data found");
  }

  const post = items[0] as any;
  console.log("Third actor response:", JSON.stringify(post, null, 2));

  return parseInstagramDataThird(post, url);
}

// Parse data from primary actor
function parseInstagramData(post: any, originalUrl: string): InstagramPost {
  const images: Array<{
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  }> = [];

  // Try different possible image fields
  const imageSources = [
    post.displayUrl,
    post.imageUrl,
    post.url,
    post.thumbnailSrc,
    ...(post.images || []),
    ...(post.sidecarMedia || []).map((media: any) => media.displayUrl || media.imageUrl),
  ].filter(Boolean);

  // Add unique images
  const uniqueUrls = new Set();
  imageSources.forEach((source: any) => {
    let imageUrl = typeof source === 'string' ? source : source?.url || source?.src;
    
    if (imageUrl && !uniqueUrls.has(imageUrl)) {
      uniqueUrls.add(imageUrl);
      
      // Convert Instagram image URLs to higher quality versions
      imageUrl = convertToHighQualityUrl(imageUrl);
      
      images.push({
        url: imageUrl,
        alt: post.accessibility_caption || post.alt || "Instagram image",
        width: source?.width || post.dimensions?.width || 1080,
        height: source?.height || post.dimensions?.height || 1080,
      });
    }
  });

  if (images.length === 0) {
    throw new Error("No images found in the post data");
  }

  return {
    url: post.url || originalUrl,
    images,
    caption: post.caption || post.text || post.edge_media_to_caption?.edges?.[0]?.node?.text,
    likes: post.likesCount || post.likes || post.edge_media_preview_like?.count,
    timestamp: post.timestamp || post.taken_at_timestamp,
  };
}

// Parse data from alternative actor
function parseInstagramDataAlternative(post: any, originalUrl: string): InstagramPost {
  const images: Array<{
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  }> = [];

  // Handle media array
  if (post.media && Array.isArray(post.media)) {
    post.media.forEach((media: any) => {
      if (media.type === "image" || media.type === "GraphImage") {
        let imageUrl = media.url || media.display_url || media.src;
        imageUrl = convertToHighQualityUrl(imageUrl);
        
        images.push({
          url: imageUrl,
          alt: post.edge_media_to_caption?.edges?.[0]?.node?.text || "Instagram image",
          width: media.dimensions?.width || 1080,
          height: media.dimensions?.height || 1080,
        });
      }
    });
  }

  // Fallback to main image
  if (images.length === 0 && (post.display_url || post.imageUrl)) {
    let imageUrl = convertToHighQualityUrl(post.display_url || post.imageUrl);
    images.push({
      url: imageUrl,
      alt: "Instagram image",
      width: 1080,
      height: 1080,
    });
  }

  if (images.length === 0) {
    throw new Error("No images found in alternative actor data");
  }

  return {
    url: post.permalink || originalUrl,
    images,
    caption: post.edge_media_to_caption?.edges?.[0]?.node?.text || post.caption,
    likes: post.edge_media_preview_like?.count || post.likes,
    timestamp: post.taken_at_timestamp,
  };
}

// Parse data from third actor
function parseInstagramDataThird(post: any, originalUrl: string): InstagramPost {
  const images: Array<{
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  }> = [];

  // Extract images from various possible fields
  const possibleImageFields = ['imageUrl', 'displayUrl', 'url', 'src', 'image'];
  
  for (const field of possibleImageFields) {
    if (post[field]) {
      let imageUrl = convertToHighQualityUrl(post[field]);
      images.push({
        url: imageUrl,
        alt: post.caption || "Instagram image",
        width: 1080,
        height: 1080,
      });
      break;
    }
  }

  if (images.length === 0) {
    throw new Error("No images found in third actor data");
  }

  return {
    url: originalUrl,
    images,
    caption: post.caption || post.text,
    likes: post.likes || post.likesCount,
    timestamp: post.timestamp,
  };
}

// Convert Instagram image URLs to higher quality versions
function convertToHighQualityUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  
  // Don't modify Instagram URLs - they're already optimized
  // Instagram URLs contain authentication tokens that break if modified
  return url;
}

// Export handler functions for potential reuse
export { extractWithPrimaryActor, extractWithAlternativeActor, extractWithThirdActor };