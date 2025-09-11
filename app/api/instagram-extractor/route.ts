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
        console.log("Alternative actor failed, trying enhanced methods:", alternativeError);
        try {
          result = await extractWithEnhancedActor(apifyClient, url);
        } catch (enhancedError) {
          console.log("Enhanced actor failed, trying direct scraping:", enhancedError);
          try {
            result = await extractWithDirectScraping(url);
          } catch (directError) {
            console.log("Direct scraping failed, trying URL manipulation:", directError);
            result = await extractWithUrlManipulation(apifyClient, url);
          }
        }
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

  // Check if we got a restricted response but still have some data
  if (post.error === "restricted_page" && post.image) {
    console.log("Got restricted page but found image data, attempting to parse");
    return {
      url: post.url || url,
      images: [{
        url: post.image,
        alt: post.title || "Instagram image",
        width: 1080,
        height: 1080,
      }],
      caption: extractCaptionFromDescription(post.description),
      likes: extractLikesFromDescription(post.description),
      timestamp: undefined,
    };
  }

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

  // Helper function to check if a URL is actually an image
  const isImageUrl = (url: string): boolean => {
    if (!url || typeof url !== 'string') return false;
    
    // Check if it's an Instagram image URL (not a post URL)
    const isInstagramImage = url.includes('cdninstagram.com') || url.includes('fbcdn.net');
    const isNotPostUrl = !url.includes('/p/') && !url.includes('/reel/');
    const hasImageParams = url.includes('.jpg') || url.includes('.png') || url.includes('.webp');
    
    return isInstagramImage && isNotPostUrl && hasImageParams;
  };

  // Helper function to check if an image URL is cropped
  const isCroppedImage = (url: string): boolean => {
    return url.includes('c288.0.864.864a') || // Common crop pattern
           url.includes('_a_') || // Another crop indicator
           url.includes('s640x640') || // Small square crop
           url.includes('s320x320'); // Tiny crop
  };

  // Helper function to get image quality score (higher is better)
  const getImageQualityScore = (url: string): number => {
    let score = 0;
    
    // Prefer uncropped images
    if (!isCroppedImage(url)) score += 100;
    
    // Prefer larger sizes
    if (url.includes('s1080x1080')) score += 50;
    if (url.includes('p1080x1080')) score += 40;
    if (url.includes('e35')) score += 30; // High quality indicator
    if (url.includes('_e15_')) score += 20; // Another quality indicator
    
    // Avoid tiny images
    if (url.includes('s150x150')) score -= 50;
    if (url.includes('s320x320')) score -= 30;
    
    return score;
  };

  // Collect all possible image sources with more comprehensive extraction
  const imageSources = [
    // Main display URL
    post.displayUrl,
    post.imageUrl,
    post.image, // For restricted responses
    
    // Images array
    ...(post.images || []),
    
    // Sidecar media (carousel posts)
    ...(post.sidecarMedia || []).map((media: any) => ({
      url: media.displayUrl || media.imageUrl || media.url,
      width: media.dimensionsWidth || media.width,
      height: media.dimensionsHeight || media.height,
      type: media.type
    })),
    
    // Child posts (another way carousel images are stored)
    ...(post.childPosts || []).map((child: any) => ({
      url: child.displayUrl || child.imageUrl,
      width: child.dimensionsWidth || child.width,
      height: child.dimensionsHeight || child.height,
    })),
    
    // Edge media nodes (GraphQL format)
    ...(post.edge_sidecar_to_children?.edges || []).map((edge: any) => ({
      url: edge.node.display_url || edge.node.image_url,
      width: edge.node.dimensions?.width,
      height: edge.node.dimensions?.height,
    })),
    
  ].filter(Boolean);

  // Process and deduplicate images
  const imageMap = new Map();
  
  imageSources.forEach((source: any) => {
    let imageUrl = typeof source === 'string' ? source : source?.url || source?.src;
    
    if (imageUrl && isImageUrl(imageUrl)) {
      // Convert to higher quality version
      imageUrl = convertToHighQualityUrl(imageUrl);
      
      const qualityScore = getImageQualityScore(imageUrl);
      const imageKey = imageUrl.split('?')[0]; // Use base URL as key to group variants
      
      // Only keep this version if it's better quality than what we have
      if (!imageMap.has(imageKey) || imageMap.get(imageKey).qualityScore < qualityScore) {
        imageMap.set(imageKey, {
          url: imageUrl,
          alt: post.accessibility_caption || post.alt || "Instagram image",
          width: source?.width || post.dimensionsWidth || 1080,
          height: source?.height || post.dimensionsHeight || 1080,
          qualityScore: qualityScore,
          isCropped: isCroppedImage(imageUrl)
        });
      }
    }
  });

  // Sort by quality score (best first) and convert to final format
  const sortedImages = Array.from(imageMap.values())
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .map(img => ({
      url: img.url,
      alt: img.alt,
      width: img.width,
      height: img.height,
    }));

  images.push(...sortedImages);

  if (images.length === 0) {
    throw new Error("No images found in the post data");
  }

  console.log(`✅ Found ${images.length} images (${imageMap.size} unique)`);
  images.forEach((img, i) => {
    const isCropped = isCroppedImage(img.url);
    console.log(`Image ${i + 1}: ${isCropped ? '🔲 Cropped' : '🖼️  Full'} - ${img.width}x${img.height}`);
  });

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

  // Helper function to check if a URL is actually an image
  const isImageUrl = (url: string): boolean => {
    if (!url || typeof url !== 'string') return false;
    
    // Check if it's an Instagram image URL (not a post URL)
    const isInstagramImage = url.includes('cdninstagram.com') || url.includes('fbcdn.net');
    const isNotPostUrl = !url.includes('/p/') && !url.includes('/reel/');
    const hasImageParams = url.includes('.jpg') || url.includes('.png') || url.includes('.webp');
    
    return isInstagramImage && isNotPostUrl && hasImageParams;
  };

  // Handle media array
  if (post.media && Array.isArray(post.media)) {
    post.media.forEach((media: any) => {
      if (media.type === "image" || media.type === "GraphImage") {
        let imageUrl = media.url || media.display_url || media.src;
        if (imageUrl && isImageUrl(imageUrl)) {
          imageUrl = convertToHighQualityUrl(imageUrl);
          
          images.push({
            url: imageUrl,
            alt: post.edge_media_to_caption?.edges?.[0]?.node?.text || "Instagram image",
            width: media.dimensions?.width || 1080,
            height: media.dimensions?.height || 1080,
          });
        }
      }
    });
  }

  // Fallback to main image
  if (images.length === 0 && (post.display_url || post.imageUrl)) {
    let imageUrl = post.display_url || post.imageUrl;
    if (isImageUrl(imageUrl)) {
      imageUrl = convertToHighQualityUrl(imageUrl);
      images.push({
        url: imageUrl,
        alt: "Instagram image",
        width: 1080,
        height: 1080,
      });
    }
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

  // Helper function to check if a URL is actually an image
  const isImageUrl = (url: string): boolean => {
    if (!url || typeof url !== 'string') return false;
    
    // Check if it's an Instagram image URL (not a post URL)
    const isInstagramImage = url.includes('cdninstagram.com') || url.includes('fbcdn.net');
    const isNotPostUrl = !url.includes('/p/') && !url.includes('/reel/');
    const hasImageParams = url.includes('.jpg') || url.includes('.png') || url.includes('.webp');
    
    return isInstagramImage && isNotPostUrl && hasImageParams;
  };

  // Extract images from various possible fields
  const possibleImageFields = ['imageUrl', 'displayUrl', 'url', 'src', 'image'];
  
  for (const field of possibleImageFields) {
    if (post[field] && isImageUrl(post[field])) {
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
  
  // Replace low quality indicators with high quality ones
  let newUrl = url;
  newUrl = newUrl.replace(/s640x640_sh0\.08/g, 's1080x1080_sh0.08');
  newUrl = newUrl.replace(/s640x640/g, 's1080x1080');
  newUrl = newUrl.replace(/s320x320/g, 's1080x1080');
  newUrl = newUrl.replace(/s150x150/g, 's1080x1080');
  newUrl = newUrl.replace(/s480x480/g, 's1080x1080');
  
  // Try to remove crop parameters for uncropped versions
  newUrl = newUrl.replace(/c\d+\.\d+\.\d+\.\d+a/g, ''); // Remove crop params like c288.0.864.864a
  newUrl = newUrl.replace(/_a\./g, '.'); // Remove _a. crop indicator
  
  // Clean up any double dots or invalid params
  newUrl = newUrl.replace(/\.\./g, '.');
  newUrl = newUrl.replace(/\?&/g, '?');
  newUrl = newUrl.replace(/&&/g, '&');
  
  return newUrl;
}

// Enhanced Apify actor with different parameters to bypass restrictions
async function extractWithEnhancedActor(apifyClient: any, url: string): Promise<InstagramPost> {
  console.log("Using enhanced actor with different parameters");
  
  // Try the primary actor with enhanced settings
  const run = await apifyClient.actor("apify/instagram-scraper").call({
    directUrls: [url],
    resultsType: "posts",
    resultsLimit: 5, // Get more results
    addParentData: true, // Include more metadata
    enhanceUserInfo: true,
    expandOwners: true,
    searchType: "hashtag", // Try different search type
  });

  await apifyClient.run(run.id).waitForFinish();
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  if (!items || items.length === 0) {
    // Try with user search type
    const run2 = await apifyClient.actor("apify/instagram-scraper").call({
      directUrls: [url],
      resultsType: "posts",
      resultsLimit: 1,
      searchType: "user",
      addParentData: true,
    });

    await apifyClient.run(run2.id).waitForFinish();
    const { items: items2 } = await apifyClient.dataset(run2.defaultDatasetId).listItems();
    
    if (!items2 || items2.length === 0) {
      throw new Error("Enhanced actor could not extract data");
    }
    
    const post = items2[0] as any;
    console.log("Enhanced actor (user search) response:", JSON.stringify(post, null, 2));
    return parseInstagramData(post, url);
  }

  const post = items[0] as any;
  console.log("Enhanced actor response:", JSON.stringify(post, null, 2));
  return parseInstagramData(post, url);
}

// Direct scraping method that bypasses Apify restrictions
async function extractWithDirectScraping(url: string): Promise<InstagramPost> {
  console.log("Attempting direct scraping bypass");
  
  // Extract post ID from URL
  const postIdMatch = url.match(/\/p\/([A-Za-z0-9_-]+)/);
  if (!postIdMatch) {
    throw new Error("Could not extract post ID from URL");
  }
  
  const postId = postIdMatch[1];
  
  // Try Instagram's embed endpoint (often works for public posts)
  try {
    const embedUrl = `https://www.instagram.com/p/${postId}/embed/`;
    const response = await fetch(embedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; facebookexternalhit/1.1; +http://www.facebook.com/externalhit_uatext.php)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://www.facebook.com/",
      },
    });

    if (response.ok) {
      const html = await response.text();
      
      // Extract image URLs from HTML
      const images = extractImagesFromHtml(html);
      
      if (images.length > 0) {
        console.log("✅ Direct scraping succeeded");
        return {
          url: url,
          images: images,
          caption: extractCaptionFromHtml(html),
          likes: undefined,
          timestamp: undefined,
        };
      }
    }
  } catch (error) {
    console.log("Embed method failed:", error);
  }

  // Try Instagram's oembed API
  try {
    const oembedUrl = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl, {
      headers: {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Accept": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.thumbnail_url) {
        console.log("✅ oEmbed API succeeded");
        return {
          url: url,
          images: [{
            url: data.thumbnail_url,
            alt: data.title || "Instagram image",
            width: data.thumbnail_width || 1080,
            height: data.thumbnail_height || 1080,
          }],
          caption: data.title,
          likes: undefined,
          timestamp: undefined,
        };
      }
    }
  } catch (error) {
    console.log("oEmbed method failed:", error);
  }

  throw new Error("Direct scraping methods failed");
}

// URL manipulation method to try different URL formats
async function extractWithUrlManipulation(apifyClient: any, originalUrl: string): Promise<InstagramPost> {
  console.log("Trying URL manipulation methods");
  
  // Try different URL formats that might bypass restrictions
  const urlVariations = [
    originalUrl.replace('instagram.com', 'instagram.com'),
    originalUrl.replace(/\?.*$/, ''), // Remove query parameters
    originalUrl + '?hl=en', // Add language parameter
    originalUrl + '?__a=1&__d=dis', // Instagram API parameter
    originalUrl.replace('/p/', '/tv/'), // Try TV format
    originalUrl.replace('/p/', '/reel/'), // Try reel format
  ];

  for (const urlVariation of urlVariations) {
    try {
      console.log(`Trying URL variation: ${urlVariation}`);
      
      const run = await apifyClient.actor("apify/instagram-scraper").call({
        directUrls: [urlVariation],
        resultsType: "posts",
        resultsLimit: 1,
        addParentData: false,
        searchType: "hashtag",
      });

      await apifyClient.run(run.id).waitForFinish();
      const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

      if (items && items.length > 0) {
        const post = items[0] as any;
        console.log(`✅ URL variation succeeded: ${urlVariation}`);
        console.log("URL manipulation response:", JSON.stringify(post, null, 2));
        return parseInstagramData(post, originalUrl);
      }
    } catch (error) {
      console.log(`URL variation failed: ${urlVariation}`, error);
      continue;
    }
  }

  throw new Error("All URL manipulation methods failed");
}

// Helper function to extract images from HTML
function extractImagesFromHtml(html: string): Array<{url: string; alt?: string; width?: number; height?: number}> {
  const images: Array<{url: string; alt?: string; width?: number; height?: number}> = [];
  
  // Look for Instagram CDN image URLs in the HTML
  const imgRegex = /https:\/\/[^"]*\.(?:cdninstagram|fbcdn)\.net[^"]*\.jpg[^"]*/g;
  const matches = html.match(imgRegex);
  
  if (matches) {
    // Filter and deduplicate images
    const uniqueUrls = new Set();
    matches.forEach(url => {
      if (!uniqueUrls.has(url) && url.includes('cdninstagram')) {
        uniqueUrls.add(url);
        images.push({
          url: url,
          alt: "Instagram image",
          width: 1080,
          height: 1080,
        });
      }
    });
  }
  
  return images;
}

// Helper function to extract caption from HTML
function extractCaptionFromHtml(html: string): string | undefined {
  // Look for content in meta tags or JSON-LD
  const captionMatch = html.match(/<meta property="og:description" content="([^"]*)"/) ||
                      html.match(/<meta name="description" content="([^"]*)"/) ||
                      html.match(/"caption":"([^"]*)"/) ||
                      html.match(/"text":"([^"]*)"/) ;
  
  return captionMatch ? captionMatch[1] : undefined;
}

// Helper function to extract caption from description text
function extractCaptionFromDescription(description: string): string | undefined {
  if (!description) return undefined;
  
  // Description format is usually: "X likes, Y comments - username on Date: Caption"
  const captionMatch = description.match(/: (.+)$/);
  if (captionMatch) {
    return captionMatch[1].replace(/\\""/g, '"'); // Unescape quotes
  }
  
  // Fallback: try to extract everything after the last hyphen
  const parts = description.split(' - ');
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    const dateMatch = lastPart.match(/^.+ on .+?: (.+)$/);
    if (dateMatch) {
      return dateMatch[1];
    }
  }
  
  return undefined;
}

// Helper function to extract likes from description text
function extractLikesFromDescription(description: string): number | undefined {
  if (!description) return undefined;
  
  // Look for "X likes" pattern
  const likesMatch = description.match(/(\d+(?:,\d+)*[KMB]?)\s+likes?/i);
  if (likesMatch) {
    const likesStr = likesMatch[1].replace(/,/g, '');
    
    // Handle K, M, B suffixes
    if (likesStr.includes('K')) {
      return parseFloat(likesStr) * 1000;
    } else if (likesStr.includes('M')) {
      return parseFloat(likesStr) * 1000000;
    } else if (likesStr.includes('B')) {
      return parseFloat(likesStr) * 1000000000;
    } else {
      return parseInt(likesStr);
    }
  }
  
  return undefined;
}

// Export handler functions for potential reuse
export { extractWithPrimaryActor, extractWithAlternativeActor, extractWithThirdActor, extractWithEnhancedActor, extractWithDirectScraping, extractWithUrlManipulation };