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

    console.log("🚀 Starting Instagram scraping for URL:", url);

    // STRATEGY: Try free methods first, then paid fallbacks
    let result;
    
    // 1. Try Instagram GraphQL API (FREE, best quality)
    try {
      console.log("📡 Trying Instagram GraphQL API (free)...");
      result = await extractWithInstagramGraphQL(url);
      console.log("✅ GraphQL succeeded!");
      return NextResponse.json(result);
    } catch (graphqlError) {
      console.log("❌ GraphQL failed:", graphqlError);
    }

    // 2. Try Instagram Embed endpoint (FREE)
    try {
      console.log("📡 Trying Instagram Embed endpoint (free)...");
      result = await extractWithInstagramEmbed(url);
      console.log("✅ Embed succeeded!");
      return NextResponse.json(result);
    } catch (embedError) {
      console.log("❌ Embed failed:", embedError);
    }

    // 3. Try Instagram oEmbed API (FREE)
    try {
      console.log("📡 Trying Instagram oEmbed API (free)...");
      result = await extractWithInstagramOEmbed(url);
      console.log("✅ oEmbed succeeded!");
      return NextResponse.json(result);
    } catch (oembedError) {
      console.log("❌ oEmbed failed:", oembedError);
    }

    // 4. Try RapidAPI Instagram Scraper (PAID fallback)
    if (process.env.RAPIDAPI_KEY) {
      try {
        console.log("💳 Trying RapidAPI Instagram Scraper (paid fallback)...");
        result = await extractWithRapidAPI(url);
        console.log("✅ RapidAPI succeeded!");
        return NextResponse.json(result);
      } catch (rapidApiError) {
        console.log("❌ RapidAPI failed:", rapidApiError);
      }
    } else {
      console.log("⚠️  RapidAPI key not configured, skipping paid fallback");
    }

    // If all methods failed
    throw new Error("All extraction methods failed. The post may be private, deleted, or requires authentication.");

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

// ============================================
// FREE METHODS (Try these first)
// ============================================

// Method 1: Instagram GraphQL API (FREE, best quality for public posts)
async function extractWithInstagramGraphQL(url: string): Promise<InstagramPost> {
  // Extract shortcode from URL
  const shortcodeMatch = url.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
  if (!shortcodeMatch) {
    throw new Error("Could not extract shortcode from URL");
  }
  
  const shortcode = shortcodeMatch[2];
  
  // Try multiple API endpoint formats
  const endpoints = [
    `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`,
    `https://www.instagram.com/graphql/query/?query_hash=477b65a610463740ccdb83135b2014db&variables={"shortcode":"${shortcode}"}`,
    `https://i.instagram.com/api/v1/media/${shortcode}/info/`,
  ];
  
  const userAgents = [
    'Instagram 123.0.0.21.114 (iPhone; CPU iPhone OS 11_4 like Mac OS X; en_US; en-US; scale=2.00; 750x1334) AppleWebKit/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  ];
  
  for (const endpoint of endpoints) {
    for (const userAgent of userAgents) {
      try {
        console.log(`🔍 Trying endpoint: ${endpoint.substring(0, 60)}...`);
        
        const response = await fetch(endpoint, {
          headers: {
            'User-Agent': userAgent,
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Origin': 'https://www.instagram.com',
            'Referer': 'https://www.instagram.com/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
          },
        });
        
        if (!response.ok) continue;
        
        const text = await response.text();
        
        // Skip if we got login page
        if (text.includes('loginForm') || text.includes('"require_login":true')) {
          console.log("⚠️ Got login page, trying next endpoint...");
          continue;
        }
        
        const data = JSON.parse(text);
        
        // Find the media object in various possible response structures
        const mediaItem = data?.items?.[0] ||
                         data?.graphql?.shortcode_media ||
                         data?.data?.shortcode_media ||
                         data?.shortcode_media ||
                         data?.media;
        
        if (!mediaItem) continue;
        
        return parseGraphQLMedia(mediaItem, url);
        
      } catch (error) {
        console.log(`Failed with endpoint/UA combo:`, error);
        continue;
      }
    }
  }
  
  throw new Error("Instagram GraphQL API failed");
}

// Method 2: Instagram Embed endpoint (FREE)
async function extractWithInstagramEmbed(url: string): Promise<InstagramPost> {
  const shortcodeMatch = url.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
  if (!shortcodeMatch) {
    throw new Error("Could not extract shortcode from URL");
  }
  
  const shortcode = shortcodeMatch[2];
  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
  
  console.log(`🔍 Fetching embed page: ${embedUrl}`);
  
  const response = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Embed endpoint returned ${response.status}`);
  }
  
  const html = await response.text();
  
  // Extract JSON data from the embed page
  const scriptMatch = html.match(/window\.__additionalDataLoaded\([^,]+,({[\s\S]+?})\);/);
  if (scriptMatch) {
    try {
      const jsonData = JSON.parse(scriptMatch[1]);
      const mediaItem = jsonData?.graphql?.shortcode_media || jsonData?.shortcode_media;
      
      if (mediaItem) {
        return parseGraphQLMedia(mediaItem, url);
      }
    } catch (e) {
      console.log("Failed to parse embed JSON:", e);
    }
  }
  
  // Fallback: Extract images from HTML
  const images = extractImagesFromEmbedHtml(html);
  
  if (images.length === 0) {
    throw new Error("No images found in embed page");
  }
  
  return {
    url: url,
    images: images,
    caption: extractCaptionFromHtml(html),
    likes: undefined,
    timestamp: undefined,
  };
}

// Method 3: Instagram oEmbed API (FREE, limited data but reliable)
async function extractWithInstagramOEmbed(url: string): Promise<InstagramPost> {
  const oembedUrl = `https://www.instagram.com/p/oembed/?url=${encodeURIComponent(url)}&maxwidth=1080`;
  
  console.log(`🔍 Trying oEmbed API: ${oembedUrl}`);
  
  const response = await fetch(oembedUrl, {
    headers: {
      'User-Agent': 'facebookexternalhit/1.1',
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`oEmbed returned ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.thumbnail_url) {
    throw new Error("No thumbnail in oEmbed response");
  }
  
  // The thumbnail URL from oEmbed is usually good quality
  return {
    url: url,
    images: [{
      url: data.thumbnail_url,
      alt: data.title || "Instagram image",
      width: data.thumbnail_width || 1080,
      height: data.thumbnail_height || 1440,
    }],
    caption: data.title,
    likes: undefined,
    timestamp: undefined,
  };
}

// ============================================
// PAID FALLBACK METHODS
// ============================================

// Method 4: RapidAPI Instagram Scraper (PAID fallback)
async function extractWithRapidAPI(url: string): Promise<InstagramPost> {
  if (!process.env.RAPIDAPI_KEY) {
    throw new Error("RapidAPI key not configured");
  }
  
  const shortcodeMatch = url.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
  if (!shortcodeMatch) {
    throw new Error("Could not extract shortcode from URL");
  }
  
  const shortcode = shortcodeMatch[2];
  
  // Try multiple RapidAPI Instagram scrapers
  const apis = [
    // Instagram Scraper Stable API - v2 endpoint (best for shortcode)
    {
      name: 'instagram-scraper-stable-v2',
      url: `https://instagram-scraper-stable-api.p.rapidapi.com/get_media_data_v2.php?media_code=${shortcode}`,
      host: 'instagram-scraper-stable-api.p.rapidapi.com',
      method: 'GET',
    },
    // Instagram Scraper Stable API - v1 endpoint (takes full URL)
    {
      name: 'instagram-scraper-stable-v1',
      url: `https://instagram-scraper-stable-api.p.rapidapi.com/get_media_data.php?reel_post_code_or_url=${encodeURIComponent(url)}&type=post`,
      host: 'instagram-scraper-stable-api.p.rapidapi.com',
      method: 'GET',
    },
    // Try other popular Instagram APIs
    {
      name: 'instagram-scraper-api2',
      url: `https://instagram-scraper-api2.p.rapidapi.com/v1/post_info?code_or_id_or_url=${shortcode}`,
      host: 'instagram-scraper-api2.p.rapidapi.com',
      method: 'GET',
    },
    {
      name: 'instagram-bulk-scraper',
      url: `https://instagram-bulk-scraper-latest.p.rapidapi.com/media_info_v2/${shortcode}`,
      host: 'instagram-bulk-scraper-latest.p.rapidapi.com',
      method: 'GET',
    },
    {
      name: 'instagram-scraper-2022',
      url: `https://instagram-scraper-2022.p.rapidapi.com/ig/post_info/?shortcode=${shortcode}`,
      host: 'instagram-scraper-2022.p.rapidapi.com',
      method: 'GET',
    },
  ];
  
  for (const api of apis) {
    try {
      console.log(`🔍 Trying RapidAPI: ${api.name}`);
      
      const fetchOptions: RequestInit = {
        method: api.method,
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': api.host,
        },
      };
      
      const response = await fetch(api.url, fetchOptions);
      
      if (!response.ok) {
        console.log(`❌ ${api.name} returned ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (!data || data.status === 'error' || data.error) {
        console.log(`❌ ${api.name} returned error:`, data);
        continue;
      }
      
      console.log(`✅ ${api.name} succeeded!`);
      return parseRapidAPIStableMedia(data, url);
      
    } catch (error) {
      console.log(`❌ ${api.name} failed:`, error);
      continue;
    }
  }
  
  throw new Error("All RapidAPI endpoints failed");
}

// ============================================
// PARSERS FOR DIFFERENT DATA FORMATS
// ============================================

// Parse Instagram's GraphQL media format
function parseGraphQLMedia(mediaItem: any, originalUrl: string): InstagramPost {
  const images: Array<{url: string; alt?: string; width?: number; height?: number}> = [];
  
  // Get the main display URL (this is the original full-size image)
  if (mediaItem.display_url || mediaItem.image_versions2?.candidates?.[0]?.url) {
    images.push({
      url: mediaItem.display_url || mediaItem.image_versions2.candidates[0].url,
      alt: mediaItem.accessibility_caption || mediaItem.caption?.text || "Instagram image",
      width: mediaItem.dimensions?.width || mediaItem.original_width || 1080,
      height: mediaItem.dimensions?.height || mediaItem.original_height || 1440,
    });
  }
  
  // Handle carousel posts
  const carouselItems = mediaItem.carousel_media || 
                       mediaItem.edge_sidecar_to_children?.edges ||
                       mediaItem.carousel_media_v2;
  
  if (carouselItems && carouselItems.length > 0) {
    // Clear single image if we have carousel
    images.length = 0;
    
    carouselItems.forEach((item: any) => {
      const media = item.node || item;
      
      if (media.media_type === 1 || media.__typename === 'GraphImage' || !media.media_type) {
        const imageUrl = media.display_url || 
                        media.image_versions2?.candidates?.[0]?.url ||
                        media.display_resources?.[media.display_resources.length - 1]?.src;
        
        if (imageUrl) {
          images.push({
            url: imageUrl,
            alt: media.accessibility_caption || "Instagram image",
            width: media.dimensions?.width || media.original_width || 1080,
            height: media.dimensions?.height || media.original_height || 1440,
          });
        }
      }
    });
  }
  
  if (images.length === 0) {
    throw new Error("No images found in GraphQL media");
  }
  
  console.log(`✅ Extracted ${images.length} full-size image(s) from GraphQL`);
  
  return {
    url: mediaItem.shortcode ? `https://www.instagram.com/p/${mediaItem.shortcode}/` : originalUrl,
    images: images,
    caption: mediaItem.edge_media_to_caption?.edges?.[0]?.node?.text || 
            mediaItem.caption?.text ||
            mediaItem.title,
    likes: mediaItem.edge_media_preview_like?.count || 
           mediaItem.like_count ||
           mediaItem.likes?.count,
    timestamp: mediaItem.taken_at_timestamp || mediaItem.taken_at,
  };
}

// Parse RapidAPI response format
function parseRapidAPIMedia(data: any, originalUrl: string): InstagramPost {
  const images: Array<{url: string; alt?: string; width?: number; height?: number}> = [];
  
  // RapidAPI returns display_url which is full size
  if (data.display_url) {
    images.push({
      url: data.display_url,
      alt: data.caption || "Instagram image",
      width: data.dimensions?.width || 1080,
      height: data.dimensions?.height || 1440,
    });
  }
  
  // Handle carousel
  if (data.carousel_media && data.carousel_media.length > 0) {
    images.length = 0;
    
    data.carousel_media.forEach((item: any) => {
      if (item.display_url) {
        images.push({
          url: item.display_url,
          alt: "Instagram image",
          width: item.dimensions?.width || 1080,
          height: item.dimensions?.height || 1440,
        });
      }
    });
  }
  
  if (images.length === 0) {
    throw new Error("No images in RapidAPI data");
  }
  
  console.log(`✅ Extracted ${images.length} image(s) from RapidAPI`);
  
  return {
    url: originalUrl,
    images: images,
    caption: data.caption,
    likes: data.like_count,
    timestamp: data.taken_at,
  };
}

// Parse RapidAPI Stable API response format
function parseRapidAPIStableMedia(data: any, originalUrl: string): InstagramPost {
  const images: Array<{url: string; alt?: string; width?: number; height?: number}> = [];
  
  // Extract from various possible response structures
  const post = data.data || data;
  
  // Get display_url (original quality)
  const mainImage = post.display_url || 
                   post.image_versions2?.candidates?.[0]?.url ||
                   post.thumbnail_url;
  
  if (mainImage) {
    images.push({
      url: mainImage,
      alt: post.caption?.text || post.title || "Instagram image",
      width: post.dimensions?.width || post.original_width || 1080,
      height: post.dimensions?.height || post.original_height || 1440,
    });
  }
  
  // Handle carousel media
  const carouselMedia = post.carousel_media || 
                       post.edge_sidecar_to_children?.edges ||
                       post.media;
  
  if (carouselMedia && carouselMedia.length > 0) {
    images.length = 0; // Clear single image
    
    carouselMedia.forEach((item: any) => {
      const media = item.node || item;
      const imageUrl = media.display_url || 
                      media.image_versions2?.candidates?.[0]?.url ||
                      media.url;
      
      if (imageUrl && (media.media_type === 1 || !media.media_type)) {
        images.push({
          url: imageUrl,
          alt: media.caption?.text || "Instagram image",
          width: media.dimensions?.width || media.original_width || 1080,
          height: media.dimensions?.height || media.original_height || 1440,
        });
      }
    });
  }
  
  if (images.length === 0) {
    throw new Error("No images in RapidAPI Stable data");
  }
  
  console.log(`✅ Extracted ${images.length} image(s) from RapidAPI Stable API`);
  
  return {
    url: originalUrl,
    images: images,
    caption: post.caption?.text || post.title,
    likes: post.like_count || post.edge_media_preview_like?.count,
    timestamp: post.taken_at || post.taken_at_timestamp,
  };
}

// Extract images from embed HTML as fallback
function extractImagesFromEmbedHtml(html: string): Array<{url: string; alt?: string; width?: number; height?: number}> {
  const images: Array<{url: string; alt?: string; width?: number; height?: number}> = [];
  
  // Look for high-resolution display URLs in the HTML
  const displayUrlMatches = html.matchAll(/"display_url":"([^"]+)"/g);
  
  for (const match of displayUrlMatches) {
    let imageUrl = match[1];
    // Unescape the URL
    imageUrl = imageUrl.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    
    if (imageUrl && imageUrl.includes('cdninstagram')) {
      images.push({
        url: imageUrl,
        alt: "Instagram image",
        width: 1080,
        height: 1440,
      });
    }
  }
  
  // Deduplicate
  const uniqueUrls = new Set();
  return images.filter(img => {
    const key = img.url.split('?')[0];
    if (uniqueUrls.has(key)) return false;
    uniqueUrls.add(key);
    return true;
  });
}

// ============================================
// APIFY FALLBACK (Keep as last resort)
// ============================================

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
  if (post.error === "restricted_page") {
    console.log("Got restricted page but found image data, attempting to parse");
    
    // Try to extract all images including carousel images from the restricted response
    const restrictedImages = await extractImagesFromRestrictedPost(url, post);
    
    return {
      url: post.url || url,
      images: restrictedImages,
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
    if (url.includes('s1080x1440')) score += 50;
    if (url.includes('p1080x1440')) score += 40;
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
          height: source?.height || post.dimensionsHeight || 1440,
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
            height: media.dimensions?.height || 1440,
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
        height: 1440,
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
      const imageUrl = convertToHighQualityUrl(post[field]);
      images.push({
        url: imageUrl,
        alt: post.caption || "Instagram image",
        width: 1080,
        height: 1440,
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
  
  // Parse URL to work with query parameters
  let newUrl = url;
  
  try {
    const urlObj = new URL(url);
    
    // Remove the stp parameter entirely - it contains all cropping/sizing instructions
    urlObj.searchParams.delete('stp');
    
    // Remove other transformation parameters
    urlObj.searchParams.delete('_nc_cat');
    urlObj.searchParams.delete('ccb');
    urlObj.searchParams.delete('_nc_sid');
    urlObj.searchParams.delete('efg');
    urlObj.searchParams.delete('_nc_ohc');
    urlObj.searchParams.delete('_nc_oc');
    urlObj.searchParams.delete('_nc_zt');
    urlObj.searchParams.delete('_nc_gid');
    
    newUrl = urlObj.toString();
  } catch (e) {
    // If URL parsing fails, use regex fallback
    newUrl = url;
  }
  
  // Additional regex cleanup for inline parameters in the path
  newUrl = newUrl.replace(/c\d+\.\d+\.\d+\.\d+a_/g, ''); // Remove crop params like c288.0.864.864a_
  newUrl = newUrl.replace(/_c\d+\.\d+\.\d+\.\d+a/g, ''); // Remove crop params like _c288.0.864.864a
  newUrl = newUrl.replace(/_a_/g, '_'); // Remove _a_ crop indicator
  newUrl = newUrl.replace(/s\d+x\d+_/g, ''); // Remove size restrictions like s640x640_
  newUrl = newUrl.replace(/_s\d+x\d+/g, ''); // Remove size restrictions like _s640x640
  
  // Replace low quality indicators with high quality ones
  newUrl = newUrl.replace(/s640x640_sh0\.08/g, 's1080x1440_sh0.08');
  newUrl = newUrl.replace(/s640x640/g, 's1080x1440');
  newUrl = newUrl.replace(/s320x320/g, 's1080x1440');
  newUrl = newUrl.replace(/s150x150/g, 's1080x1440');
  newUrl = newUrl.replace(/s480x480/g, 's1080x1440');
  
  // Clean up any double underscores, dots or invalid params
  newUrl = newUrl.replace(/__+/g, '_');
  newUrl = newUrl.replace(/\.\./g, '.');
  newUrl = newUrl.replace(/\?&/g, '?');
  newUrl = newUrl.replace(/&&/g, '&');
  newUrl = newUrl.replace(/_\./g, '.');
  newUrl = newUrl.replace(/\._/g, '.');
  
  return newUrl;
}

// Extract images from restricted posts with enhanced methods
async function extractImagesFromRestrictedPost(url: string, post: any): Promise<Array<{url: string; alt?: string; width?: number; height?: number}>> {
  const images: Array<{url: string; alt?: string; width?: number; height?: number}> = [];
  
  // Helper to convert cropped URLs to full-size
  const convertCroppedToFullSize = (imageUrl: string): string[] => {
    const variations: string[] = [];
    
    // Variation 1: Remove entire query string (original uncropped image)
    try {
      const urlObj = new URL(imageUrl);
      const pathOnly = `${urlObj.origin}${urlObj.pathname}`;
      variations.push(pathOnly);
      
      // Variation 2: Keep only essential params, remove stp entirely
      const essentialUrl = new URL(imageUrl);
      const keepParams = ['_nc_ht', 'oh', 'oe']; // Only keep these
      const paramsToKeep = new URLSearchParams();
      keepParams.forEach(param => {
        const value = essentialUrl.searchParams.get(param);
        if (value) paramsToKeep.set(param, value);
      });
      variations.push(`${urlObj.origin}${urlObj.pathname}?${paramsToKeep.toString()}`);
      
      // Variation 3: Original with stp removed
      const noStp = new URL(imageUrl);
      noStp.searchParams.delete('stp');
      variations.push(noStp.toString());
      
    } catch (e) {
      // If URL parsing fails, continue with regex methods
    }
    
    // Variation 4: Aggressive regex removal of all cropping/sizing in path
    let uncropped = imageUrl;
    
    // Remove stp query parameter and its value
    uncropped = uncropped.replace(/[?&]stp=[^&]*/g, '');
    
    // Remove crop parameters from the filename itself
    uncropped = uncropped.replace(/c\d+\.\d+\.\d+\.\d+a_/g, '');
    uncropped = uncropped.replace(/_c\d+\.\d+\.\d+\.\d+a/g, '');
    
    // Remove ALL size restrictions from filename
    uncropped = uncropped.replace(/[_-]s\d+x\d+[_-]/g, '_');
    uncropped = uncropped.replace(/[_-]p\d+x\d+[_-]/g, '_');
    uncropped = uncropped.replace(/_sh\d+\.\d+/g, '');
    
    // Remove _a suffix that indicates cropping
    uncropped = uncropped.replace(/_a\./g, '.');
    uncropped = uncropped.replace(/_a_/g, '_');
    
    // Remove dst-jpg processing indicators that include cropping
    uncropped = uncropped.replace(/dst-jpg_[^_]*_/g, 'dst-jpg_e35_');
    
    // Clean up multiple underscores and dots
    uncropped = uncropped.replace(/__+/g, '_');
    uncropped = uncropped.replace(/\.\./g, '.');
    uncropped = uncropped.replace(/_\./g, '.');
    uncropped = uncropped.replace(/\._/g, '.');
    
    variations.push(uncropped);
    
    // Variation 5: Remove everything between filename and extension
    let minimal = imageUrl.split('?')[0]; // Remove query params
    const parts = minimal.split('/');
    const filename = parts[parts.length - 1];
    
    // Extract just the ID and extension (remove all transformations)
    const match = filename.match(/^(\d+)_.*\.([a-z]+)$/);
    if (match) {
      const [, id, ext] = match;
      parts[parts.length - 1] = `${id}.${ext}`;
      variations.push(parts.join('/'));
    }
    
    // Original URL (as fallback)
    variations.push(imageUrl);
    
    // Remove duplicates and filter out invalid URLs
    return [...new Set(variations)].filter(url => url && url.startsWith('http'));
  };
  
  // Try to extract images from the post object
  const possibleImageSources = [
    post.image,
    post.imageUrl,
    post.displayUrl,
    post.thumbnail,
  ].filter(Boolean);
  
  // If we have an image URL, try to get full size and check for carousel
  if (possibleImageSources.length > 0) {
    for (const sourceUrl of possibleImageSources) {
      const urlVariations = convertCroppedToFullSize(sourceUrl);
      
      // Test each variation to find the best quality one
      for (const variation of urlVariations) {
        try {
          const response = await fetch(variation, { method: 'HEAD' });
          if (response.ok) {
            images.push({
              url: variation,
              alt: post.title || "Instagram image",
              width: 1080,
              height: 1440,
            });
            console.log(`✅ Found valid image URL: ${variation.includes('c288') ? '🔲 Cropped' : '🖼️  Full size'}`);
            break; // Use first valid variation
          }
        } catch (error) {
          console.log(`❌ Failed to fetch: ${variation.substring(0, 100)}...`);
        }
      }
    }
  }
  
  // Try to get carousel images by manipulating the URL
  if (url.includes('?img_index=')) {
    console.log('🎠 Detected carousel post, attempting to extract all images');
    
    // Extract the base URL without img_index
    const baseUrl = url.split('?img_index=')[0];
    
    // Try indices 1-10 (most carousels have 2-10 images)
    for (let i = 1; i <= 10; i++) {
      const carouselUrl = `${baseUrl}?img_index=${i}`;
      
      try {
        // Fetch the post with different index
        console.log(`Attempting to fetch carousel image ${i}`);
        
        // Try using the embed endpoint to get the image
        const embedUrl = `${carouselUrl.replace('/p/', '/p/')}/embed/`;
        const response = await fetch(embedUrl, {
          headers: {
            'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
            'Accept': 'text/html',
          },
        });
        
        if (response.ok) {
          const html = await response.text();
          
          // Extract image URL from the embed HTML
          const imageMatch = html.match(/https:\/\/[^"']*\.cdninstagram\.com[^"']*\.jpg[^"']*/);
          if (imageMatch) {
            const carouselImageUrl = imageMatch[0];
            const fullSizeVariations = convertCroppedToFullSize(carouselImageUrl);
            
            // Try to find a working full-size version
            for (const variation of fullSizeVariations) {
              try {
                const imgResponse = await fetch(variation, { method: 'HEAD' });
                if (imgResponse.ok) {
                  // Check if this image is already in our list
                  const isDuplicate = images.some(img => 
                    img.url.split('?')[0] === variation.split('?')[0]
                  );
                  
                  if (!isDuplicate) {
                    images.push({
                      url: variation,
                      alt: `Instagram image ${i}`,
                      width: 1080,
                      height: 1440,
                    });
                    console.log(`✅ Found carousel image ${i}: ${variation.includes('c288') ? '🔲 Cropped' : '🖼️  Full size'}`);
                  }
                  break;
                }
              } catch (imgError) {
                continue;
              }
            }
          }
        }
      } catch (error) {
        console.log(`Could not fetch carousel image ${i}`);
        // If we fail to fetch, we've likely reached the end of the carousel
        if (i > 2) break; // Stop if we've tried at least 2 images and failed
      }
    }
  }
  
  // If we still don't have any images, try the direct scraping method
  if (images.length === 0) {
    console.log('No images found with restricted post extraction, falling back to direct scraping');
    try {
      const directResult = await extractWithDirectScraping(url);
      return directResult.images;
    } catch (error) {
      console.log('Direct scraping also failed:', error);
    }
  }
  
  // Try to get better quality by fetching the post's GraphQL data
  if (images.length > 0) {
    console.log('Attempting to upgrade image quality via GraphQL/embed...');
    try {
      const betterImages = await tryGetOriginalImagesFromPost(url, images);
      if (betterImages.length > 0 && betterImages[0].url !== images[0].url) {
        console.log('✅ Successfully upgraded to original quality images');
        return betterImages;
      } else {
        console.log('⚠️  No better quality images found, using URL manipulation to remove crop parameters');
        // Manually try to uncrop the URLs we have
        return images.map(img => ({
          ...img,
          url: aggressivelyUncropUrl(img.url)
        }));
      }
    } catch (error) {
      console.log('Could not upgrade image quality:', error);
      // Try to uncrop URLs manually
      return images.map(img => ({
        ...img,
        url: aggressivelyUncropUrl(img.url)
      }));
    }
  }
  
  // Last resort: use the original cropped image if nothing else worked
  if (images.length === 0 && possibleImageSources.length > 0) {
    console.log('⚠️  Using cropped image as last resort');
    images.push({
      url: possibleImageSources[0],
      alt: post.title || "Instagram image",
      width: 1080,
      height: 1440,
    });
  }
  
  console.log(`📊 Total images extracted from restricted post: ${images.length}`);
  return images;
}

// Try to get original full-size images by fetching the post directly
async function tryGetOriginalImagesFromPost(url: string, fallbackImages: Array<{url: string; alt?: string; width?: number; height?: number}>): Promise<Array<{url: string; alt?: string; width?: number; height?: number}>> {
  const images: Array<{url: string; alt?: string; width?: number; height?: number}> = [];
  
  try {
    // Try Instagram's ?__a=1&__d=dis API endpoint
    const apiUrl = url.includes('?') ? `${url}&__a=1&__d=dis` : `${url}?__a=1&__d=dis`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        'Accept': 'application/json,text/html',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      },
    });
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        
        // Extract display_url from GraphQL response
        const mediaItem = data?.items?.[0] || 
                         data?.graphql?.shortcode_media ||
                         data?.data?.shortcode_media;
        
        if (mediaItem) {
          // Get main image
          if (mediaItem.display_url) {
            images.push({
              url: mediaItem.display_url,
              alt: mediaItem.accessibility_caption || "Instagram image",
              width: mediaItem.dimensions?.width || 1080,
              height: mediaItem.dimensions?.height || 1440,
            });
          }
          
          // Get carousel images if available
          const carouselMedia = mediaItem.carousel_media || 
                               mediaItem.edge_sidecar_to_children?.edges;
          
          if (carouselMedia) {
            carouselMedia.forEach((item: any) => {
              const media = item.node || item;
              if (media.display_url) {
                images.push({
                  url: media.display_url,
                  alt: media.accessibility_caption || "Instagram image",
                  width: media.dimensions?.width || 1080,
                  height: media.dimensions?.height || 1440,
                });
              }
            });
          }
        }
      }
    }
  } catch (error) {
    console.log('GraphQL fetch failed:', error);
  }
  
  // If we got better images, return them, otherwise return fallback
  return images.length > 0 ? images : fallbackImages;
}

// Aggressively remove all cropping/transformation from Instagram CDN URLs
function aggressivelyUncropUrl(url: string): string {
  if (!url || !url.includes('cdninstagram.com')) return url;
  
  console.log(`🔧 Attempting to uncrop: ${url.substring(0, 100)}...`);
  
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];
    
    // Extract just the media ID and extension, removing all transformations
    // Format: 547785432_18097300732734568_6744760680453348796_n.jpg
    const mediaIdMatch = filename.match(/^(\d+_\d+_\d+_n\.[a-z]+)$/);
    
    if (mediaIdMatch) {
      // Build clean URL with just the media ID
      pathParts[pathParts.length - 1] = mediaIdMatch[1];
      urlObj.pathname = pathParts.join('/');
      
      // Keep only essential params
      const essentialParams = new URLSearchParams();
      ['_nc_ht', 'oh', 'oe'].forEach(key => {
        const value = urlObj.searchParams.get(key);
        if (value) essentialParams.set(key, value);
      });
      
      urlObj.search = essentialParams.toString();
      const cleanUrl = urlObj.toString();
      console.log(`✅ Uncropped URL: ${cleanUrl.substring(0, 100)}...`);
      return cleanUrl;
    }
    
    // Fallback: just remove the stp parameter which contains transformations
    urlObj.searchParams.delete('stp');
    const cleanedUrl = urlObj.toString();
    console.log(`✅ Removed transformations: ${cleanedUrl.substring(0, 100)}...`);
    return cleanedUrl;
    
  } catch (e) {
    console.log(`❌ Failed to parse URL:`, e);
    // Regex fallback
    let cleaned = url.replace(/[?&]stp=[^&]*/g, '');
    return cleaned;
  }
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
            height: data.thumbnail_height || 1440,
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
          height: 1440,
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

// Handler functions are available internally for the POST route handler