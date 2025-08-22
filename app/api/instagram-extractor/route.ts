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
        console.log("Alternative actor failed, trying specialized private post actor:", alternativeError);
        try {
          result = await extractWithPrivatePostActor(apifyClient, url);
        } catch (privateError) {
          console.log("Private post actor failed, trying browser-based actor:", privateError);
          try {
            result = await extractWithBrowserActor(apifyClient, url);
          } catch (browserError) {
            console.log("All actors failed:", browserError);
            
            // Provide helpful error message based on the type of failures
            if (primaryError instanceof Error && primaryError.message.includes("private or restricted")) {
              throw new Error("This Instagram post is private or restricted and cannot be accessed.");
            } else if (primaryError instanceof Error && primaryError.message.includes("restricted_page")) {
              throw new Error("This Instagram post has restricted access. Limited data may be available.");
            } else {
              throw new Error("All Instagram scrapers failed to extract images from this post. The post may be private, deleted, or temporarily unavailable.");
            }
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

// Primary Apify actor with enhanced configuration
async function extractWithPrimaryActor(apifyClient: any, url: string): Promise<InstagramPost> {
  console.log("Using primary actor: apify/instagram-scraper");
  
  const run = await apifyClient.actor("apify/instagram-scraper").call({
    directUrls: [url],
    resultsType: "posts",
    resultsLimit: 1,
    addParentData: false,
    enhanceUserInformation: false,
    isUserTaggedFeedURL: false,
    isUserReelsFeedURL: false,
    onlyPostsNewerThan: undefined,
    onlyPostsOlderThan: undefined,
    extendOutputFunction: `($) => {
      const result = {};
      
      // Try to extract all images from carousel posts
      const carouselImages = [];
      $('article img').each((i, img) => {
        const src = $(img).attr('src');
        if (src && src.includes('cdninstagram.com')) {
          carouselImages.push(src);
        }
      });
      
      if (carouselImages.length > 0) {
        result.extractedImages = carouselImages;
      }
      
      // Try to get high quality image URLs
      const scripts = $('script').toArray();
      for (let script of scripts) {
        const content = $(script).html();
        if (content && content.includes('display_url')) {
          // Try to extract image URLs from script content
          const imageMatches = content.match(/"display_url":"([^"]*?)"/g);
          if (imageMatches) {
            const urls = imageMatches.map(match => 
              match.replace('"display_url":"', '').replace('"', '').replace(/\\\\u[\da-f]{4}/gi, '')
            );
            result.scriptImages = urls;
          }
        }
      }
      
      return result;
    }`
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

  const initialResult = parseInstagramData(post, url);
  
  // If we only got 1 image from a restricted post, try carousel extraction
  if (initialResult.images.length === 1 && post.error === "restricted_page") {
    console.log("🎠 Attempting carousel extraction for restricted post...");
    try {
      const carouselImages: string[] = await tryCarouselExtraction(apifyClient, url);
      if (carouselImages.length > 1) {
        // Replace the single image with all carousel images
        const enhancedImages = carouselImages.map((imageUrl: string, index: number) => ({
          url: imageUrl,
          alt: `Instagram carousel image ${index + 1}`,
          width: 1080,
          height: 1080,
        }));
        
        console.log(`✅ Carousel extraction successful! Found ${enhancedImages.length} total images`);
        
        return {
          ...initialResult,
          images: getOriginalImageUrls(enhanceImageUrls(enhancedImages)),
        };
      }
    } catch (carouselError) {
      console.log("Carousel extraction failed:", carouselError);
      // Continue with the original single image
    }
  }

  return initialResult;
}

// Alternative Apify actor
async function extractWithAlternativeActor(apifyClient: any, url: string): Promise<InstagramPost> {
  console.log("Using alternative actor: jaroslavhejlek/instagram-scraper");
  
  const run = await apifyClient.actor("jaroslavhejlek/instagram-scraper").call({
    urls: [url],
    limit: 1,
    onlyPosts: true,
    extendedPostInformation: true,
    getVideoUrl: false,
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

// Specialized actor for private/restricted posts
async function extractWithPrivatePostActor(apifyClient: any, url: string): Promise<InstagramPost> {
  console.log("Using private post specialized actor: dtrungtin/instagram-scraper");
  
  try {
    const run = await apifyClient.actor("dtrungtin/instagram-scraper").call({
      urls: [url],
      limit: 1,
      resultsLimit: 1,
      // Add parameters that might help with restricted content
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"]
      }
    });

    await apifyClient.run(run.id).waitForFinish();
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    if (!items || items.length === 0) {
      throw new Error("No data found from private post actor");
    }

    const post = items[0] as any;
    console.log("Private post actor response:", JSON.stringify(post, null, 2));
    return parseInstagramDataPrivate(post, url);
    
  } catch (error) {
    console.log("Private post actor not available, trying browser approach");
    throw error;
  }
}

// Browser-based actor for difficult posts
async function extractWithBrowserActor(apifyClient: any, url: string): Promise<InstagramPost> {
  console.log("Using browser-based actor: pocesar/instagram-scraper");
  
  try {
    const run = await apifyClient.actor("pocesar/instagram-scraper").call({
      urls: [url],
      resultsLimit: 1,
      // Use browser to handle restricted content
      useBrowser: true,
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"]
      }
    });

    await apifyClient.run(run.id).waitForFinish();
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    if (!items || items.length === 0) {
      throw new Error("No data found from browser actor");
    }

    const post = items[0] as any;
    console.log("Browser actor response:", JSON.stringify(post, null, 2));
    return parseInstagramDataBrowser(post, url);
    
  } catch (error) {
    console.log("Browser actor failed or not available");
    throw error;
  }
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

  console.log("🔍 Parsing Instagram data...");
  console.log("Post structure keys:", Object.keys(post));

  // Check if this is a restricted/private post with partial data
  if (post.error === "restricted_page") {
    console.log("⚠️ Restricted/private post detected, trying to extract available data...");
  }

  // Collect image URLs from various sources (excluding post URLs)
  const imageSources: string[] = [];

  // Check for single image field (common in restricted posts)
  if (post.image) {
    console.log("Found single image field:", post.image);
    if (isImageUrl(post.image)) {
      imageSources.push(post.image);
      console.log("✅ Added single image field as valid image");
    } else {
      console.log("❌ Rejected single image field (not an image URL)");
    }
  }

  // Check for enhanced extracted images (from extendOutputFunction)
  if (post.extractedImages && Array.isArray(post.extractedImages)) {
    console.log(`Found extractedImages array with ${post.extractedImages.length} items:`, post.extractedImages);
    post.extractedImages.forEach((imageUrl: string, index: number) => {
      console.log(`Checking extractedImages[${index}]:`, imageUrl);
      if (imageUrl && isImageUrl(imageUrl)) {
        imageSources.push(imageUrl);
        console.log(`✅ Added extractedImages[${index}] as valid image`);
      } else {
        console.log(`❌ Rejected extractedImages[${index}] (not an image URL)`);
      }
    });
  }

  // Check for script-extracted images
  if (post.scriptImages && Array.isArray(post.scriptImages)) {
    console.log(`Found scriptImages array with ${post.scriptImages.length} items:`, post.scriptImages);
    post.scriptImages.forEach((imageUrl: string, index: number) => {
      console.log(`Checking scriptImages[${index}]:`, imageUrl);
      if (imageUrl && isImageUrl(imageUrl)) {
        imageSources.push(imageUrl);
        console.log(`✅ Added scriptImages[${index}] as valid image`);
      } else {
        console.log(`❌ Rejected scriptImages[${index}] (not an image URL)`);
      }
    });
  }

  // Add main display URL if it's an image URL
  if (post.displayUrl) {
    console.log("Found displayUrl:", post.displayUrl);
    if (isImageUrl(post.displayUrl)) {
      imageSources.push(post.displayUrl);
      console.log("✅ Added displayUrl as valid image");
    } else {
      console.log("❌ Rejected displayUrl (not an image)");
    }
  }

  // Add images from images array
  if (post.images && Array.isArray(post.images)) {
    console.log(`Found images array with ${post.images.length} items:`, post.images);
    post.images.forEach((imageUrl: string, index: number) => {
      console.log(`Checking images[${index}]:`, imageUrl);
      if (imageUrl && isImageUrl(imageUrl)) {
        imageSources.push(imageUrl);
        console.log(`✅ Added images[${index}] as valid image`);
      } else {
        console.log(`❌ Rejected images[${index}] (not an image URL)`);
      }
    });
  }

  // Add images from sidecar media (carousel posts)
  if (post.sidecarMedia && Array.isArray(post.sidecarMedia)) {
    console.log(`Found sidecarMedia with ${post.sidecarMedia.length} items`);
    post.sidecarMedia.forEach((media: any, index: number) => {
      if (media.displayUrl && isImageUrl(media.displayUrl)) {
        imageSources.push(media.displayUrl);
        console.log(`✅ Added sidecarMedia[${index}].displayUrl`);
      }
      if (media.imageUrl && isImageUrl(media.imageUrl)) {
        imageSources.push(media.imageUrl);
        console.log(`✅ Added sidecarMedia[${index}].imageUrl`);
      }
    });
  }

  // Add images from child posts (alternative structure)
  if (post.childPosts && Array.isArray(post.childPosts)) {
    console.log(`Found childPosts with ${post.childPosts.length} items`);
    post.childPosts.forEach((child: any, index: number) => {
      if (child.displayUrl) {
        console.log(`Checking childPosts[${index}].displayUrl:`, child.displayUrl);
        if (isImageUrl(child.displayUrl)) {
          imageSources.push(child.displayUrl);
          console.log(`✅ Added childPosts[${index}].displayUrl`);
        } else {
          console.log(`❌ Rejected childPosts[${index}].displayUrl (not an image URL)`);
        }
      }
    });
  }

  // Check for post.url (should NOT be included)
  if (post.url) {
    console.log("Found post.url:", post.url);
    if (isImageUrl(post.url)) {
      console.log("⚠️ post.url appears to be an image (unexpected)");
    } else {
      console.log("✅ Correctly excluded post.url (it's a post URL, not image)");
    }
  }

  console.log(`Total image sources found: ${imageSources.length}`);

  // Remove duplicates and create image objects
  const uniqueUrls = new Set();
  imageSources.forEach((imageUrl: string, index: number) => {
    if (imageUrl && !uniqueUrls.has(imageUrl)) {
      uniqueUrls.add(imageUrl);
      console.log(`✅ Adding unique image ${images.length + 1}:`, imageUrl.substring(0, 80) + "...");
      
      images.push({
        url: imageUrl,
        alt: post.accessibility_caption || post.alt || "Instagram image",
        width: post.dimensions?.width || 1080,
        height: post.dimensions?.height || 1080,
      });
    } else {
      console.log(`🔄 Skipped duplicate image:`, imageUrl.substring(0, 80) + "...");
    }
  });

  if (images.length === 0) {
    // Provide more specific error message for restricted posts
    if (post.error === "restricted_page") {
      throw new Error("This Instagram post is private or restricted. No images could be extracted.");
    }
    throw new Error("No images found in the post data");
  }

  // If we only got 1 image from a restricted post, try carousel extraction
  if (images.length === 1 && post.error === "restricted_page") {
    console.log("🎠 Only 1 image found from restricted post, attempting carousel extraction...");
    // Note: We'll need to pass the apifyClient to this function, which requires restructuring
    // For now, we'll enhance this in the calling function
  }

  // Enhance image URLs for better quality
  const enhancedImages = enhanceImageUrls(images);
  // Try to get completely original images (uncropped, full-size)
  const originalImages = getOriginalImageUrls(enhancedImages);

  const resultMessage = post.error === "restricted_page" 
    ? `✅ Extracted ${originalImages.length} image(s) from restricted post`
    : `✅ Final result: Parsed ${originalImages.length} unique images from Instagram post`;
  
  console.log(resultMessage);

  return {
    url: post.url || originalUrl,
    images: originalImages,
    caption: post.caption || post.text || post.description || post.edge_media_to_caption?.edges?.[0]?.node?.text,
    likes: post.likesCount || post.likes || post.edge_media_preview_like?.count,
    timestamp: post.timestamp || post.taken_at_timestamp,
  };
}

// --- Helper function stubs for missing functions ---
// Attempts to extract carousel images from a restricted post
async function tryCarouselExtraction(apifyClient: any, url: string): Promise<string[]> {
  // TODO: Implement actual carousel extraction logic if needed
  // For now, return an empty array to avoid runtime errors
  return [];
}

// Enhance image URLs for better quality (e.g., get higher resolution)
function enhanceImageUrls(images: Array<{ url: string; alt?: string; width?: number; height?: number; }>): Array<{ url: string; alt?: string; width?: number; height?: number; }> {
  // TODO: Implement actual enhancement logic if needed
  // For now, return images as-is
  return images;
}

// Get original (uncropped/full-size) image URLs if possible
function getOriginalImageUrls(images: Array<{ url: string; alt?: string; width?: number; height?: number; }>): Array<{ url: string; alt?: string; width?: number; height?: number; }> {
  // TODO: Implement logic to get original image URLs if needed
  // For now, return images as-is
  return images;
}

// Parse data from private post specialized actor
function parseInstagramDataPrivate(post: any, originalUrl: string): InstagramPost {
  const images: Array<{
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  }> = [];

  console.log("🔒 Parsing private post data...");

  // Check for various image fields that private post actors might use
  const possibleImageFields = [
    'image', 'imageUrl', 'displayUrl', 'src', 'thumbnail',
    'picture', 'photo', 'media_url', 'url'
  ];

  possibleImageFields.forEach(field => {
    if (post[field] && isImageUrl(post[field])) {
      images.push({
        url: post[field],
        alt: post.caption || post.text || "Instagram image",
        width: 1080,
        height: 1080,
      });
      console.log(`✅ Found image in field '${field}'`);
    }
  });

  // Check for images array
  if (post.images && Array.isArray(post.images)) {
    post.images.forEach((imageUrl: string) => {
      if (isImageUrl(imageUrl)) {
        images.push({
          url: imageUrl,
          alt: post.caption || "Instagram image",
          width: 1080,
          height: 1080,
        });
      }
    });
  }

  // Check for media array
  if (post.media && Array.isArray(post.media)) {
    post.media.forEach((media: any) => {
      if (media && typeof media === 'object') {
        const mediaUrl = media.url || media.src || media.image_url;
        if (mediaUrl && isImageUrl(mediaUrl)) {
          images.push({
            url: mediaUrl,
            alt: post.caption || "Instagram image",
            width: media.width || 1080,
            height: media.height || 1080,
          });
        }
      }
    });
  }

  if (images.length === 0) {
    throw new Error("No images found in private post actor data");
  }

  console.log(`✅ Private parser found ${images.length} images`);

  return {
    url: originalUrl,
    images,
    caption: post.caption || post.text || post.description,
    likes: post.likes || post.likesCount,
    timestamp: post.timestamp,
  };
}

// Parse data from browser-based actor
function parseInstagramDataBrowser(post: any, originalUrl: string): InstagramPost {
  const images: Array<{
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  }> = [];

  console.log("🌐 Parsing browser-extracted data...");

  // Browser actors often return data in different formats
  if (post.photos && Array.isArray(post.photos)) {
    post.photos.forEach((photo: any) => {
      if (photo && isImageUrl(photo)) {
        images.push({
          url: photo,
          alt: "Instagram image",
          width: 1080,
          height: 1080,
        });
      }
    });
  }

  // Check for carousel data
  if (post.carousel && Array.isArray(post.carousel)) {
    post.carousel.forEach((item: any) => {
      if (item.image && isImageUrl(item.image)) {
        images.push({
          url: item.image,
          alt: "Instagram image",
          width: item.width || 1080,
          height: item.height || 1080,
        });
      }
    });
  }

  // Fallback to standard fields
  if (images.length === 0) {
    const fallbackFields = ['displayUrl', 'image', 'picture', 'src'];
    for (const field of fallbackFields) {
      if (post[field] && isImageUrl(post[field])) {
        images.push({
          url: post[field],
          alt: "Instagram image",
          width: 1080,
          height: 1080,
        });
        break;
      }
    }
  }

  if (images.length === 0) {
    throw new Error("No images found in browser actor data");
  }

  console.log(`✅ Browser parser found ${images.length} images`);

  return {
    url: originalUrl,
    images,
    caption: post.caption || post.text || post.description,
    likes: post.likes || post.likesCount,
    timestamp: post.timestamp,
  };
}

// Helper function to check if URL is an image URL
function isImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    console.log("❌ isImageUrl: Invalid URL type");
    return false;
  }
  
  console.log("🔍 Checking if URL is image:", url.substring(0, 100) + "...");
  
  // Check if it's an Instagram CDN image URL
  if (url.includes('cdninstagram.com') || url.includes('fbcdn.net')) {
    // Make sure it's not a post URL
    if (url.includes('/p/') && !url.includes('.jpg') && !url.includes('.png') && !url.includes('.webp')) {
      console.log("❌ isImageUrl: Instagram post URL detected (contains /p/ but no image extension)");
      return false;
    }
    console.log("✅ isImageUrl: Valid Instagram CDN URL");
    return true;
  }
  
  // Check for image file extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const hasImageExtension = imageExtensions.some(ext => url.toLowerCase().includes(ext));
  
  if (hasImageExtension) {
    console.log("✅ isImageUrl: Has image file extension");
    return true;
  }
  
  console.log("❌ isImageUrl: Not recognized as image URL");
  return false;
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
        
        if (imageUrl && isImageUrl(imageUrl)) {
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

  // Fallback to main display URL if no media found
  if (images.length === 0) {
    const mainImageUrl = post.display_url || post.imageUrl || post.displayUrl;
    if (mainImageUrl && isImageUrl(mainImageUrl)) {
      images.push({
        url: mainImageUrl,
        alt: "Instagram image",
        width: 1080,
        height: 1080,
      });
    }
  }

  if (images.length === 0) {
    throw new Error("No images found in alternative actor data");
  }

  console.log(`✅ Alternative parser found ${images.length} images`);

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

  // Extract images from various possible fields (only actual image URLs)
  const possibleImageFields = ['imageUrl', 'displayUrl', 'src', 'image'];
  
  for (const field of possibleImageFields) {
    if (post[field] && isImageUrl(post[field])) {
      images.push({
        url: post[field],
        alt: post.caption || "Instagram image",
        width: 1080,
        height: 1080,
      });
      break; // Only take the first valid image URL found
    }
  }

  // Check for images array
  if (images.length === 0 && post.images && Array.isArray(post.images)) {
    post.images.forEach((imageUrl: string) => {
      if (isImageUrl(imageUrl)) {
        images.push({
          url: imageUrl,
          alt: post.caption || "Instagram image",
          width: 1080,
          height: 1080,
        });
      }
    });
  }

  if (images.length === 0) {
    throw new Error("No images found in third actor data");
  }

  console.log(`✅ Third parser found ${images.length} images`);

  return {
    url: originalUrl,
    images,
    caption: post.caption || post.text,
    likes: post.likes || post.likesCount,
    timestamp: post.timestamp,
  };
}