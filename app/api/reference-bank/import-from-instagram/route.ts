import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/database";
import { convertS3ToCdnUrl } from "@/lib/cdnUtils";
import * as crypto from "crypto";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Validate Instagram URL
function isValidInstagramUrl(url: string): boolean {
  const pattern =
    /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p|reel|reels)\/[A-Za-z0-9_-]+\/?/;
  return pattern.test(url);
}

// Extract shortcode from Instagram URL
function extractShortcode(url: string): string | null {
  const match = url.match(/\/(p|reel|reels)\/([A-Za-z0-9_-]+)/);
  return match ? match[2] : null;
}

interface ExtractedMedia {
  images: Array<{ url: string; width?: number; height?: number }>;
  videoUrl?: string;
  caption?: string;
  isVideo: boolean;
}

// Extract the video URL from an IG media object (reels, video posts)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractVideoUrl(media: any): string | undefined {
  return (
    media.video_url ||
    media.video_versions?.[0]?.url ||
    media.clips_metadata?.original_sound_info?.progressive_download_url ||
    undefined
  );
}

// Parse media from an Instagram media object (works with GraphQL, RapidAPI, etc.)
function parseMediaResult(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  media: any
): ExtractedMedia | null {
  const images: Array<{ url: string; width?: number; height?: number }> = [];

  // Detect if this is a video/reel
  const isVideo =
    media.media_type === 2 ||
    media.product_type === "clips" ||
    media.product_type === "feed" ||
    media.__typename === "GraphVideo" ||
    media.is_video === true ||
    !!media.video_url ||
    !!media.video_versions;

  // Get the video URL if this is a reel/video
  const videoUrl = isVideo ? extractVideoUrl(media) : undefined;

  // Handle carousel / sidecar
  const carousel =
    media.carousel_media ||
    media.edge_sidecar_to_children?.edges ||
    media.carousel_media_v2 ||
    media.media;

  if (carousel && Array.isArray(carousel) && carousel.length > 0) {
    for (const item of carousel) {
      const node = item.node || item;
      const imgUrl =
        node.display_url ||
        node.image_versions2?.candidates?.[0]?.url ||
        node.display_resources?.slice(-1)?.[0]?.src ||
        node.url;
      if (imgUrl) {
        images.push({
          url: imgUrl,
          width: node.dimensions?.width || node.original_width,
          height: node.dimensions?.height || node.original_height,
        });
      }
    }
  } else {
    // Single media — display_url is the thumbnail/cover
    const imgUrl =
      media.display_url ||
      media.image_versions2?.candidates?.[0]?.url ||
      media.thumbnail_url;
    if (imgUrl) {
      images.push({
        url: imgUrl,
        width: media.dimensions?.width || media.original_width,
        height: media.dimensions?.height || media.original_height,
      });
    }
  }

  if (images.length === 0 && !videoUrl) return null;

  const caption =
    media.edge_media_to_caption?.edges?.[0]?.node?.text ||
    media.caption?.text ||
    media.title;

  return { images, videoUrl, caption, isVideo: isVideo && !!videoUrl };
}

// Fetch media from a single Instagram post/reel — RapidAPI first, free fallbacks after
async function extractInstagramMedia(
  url: string
): Promise<ExtractedMedia | null> {
  const shortcode = extractShortcode(url);
  if (!shortcode) return null;

  // ── Strategy 1 (primary): RapidAPI ──
  if (process.env.RAPIDAPI_KEY) {
    const apis = [
      {
        name: "instagram-scraper-stable-v2",
        url: `https://instagram-scraper-stable-api.p.rapidapi.com/get_media_data_v2.php?media_code=${shortcode}`,
        host: "instagram-scraper-stable-api.p.rapidapi.com",
      },
      {
        name: "instagram-scraper-stable-v1",
        url: `https://instagram-scraper-stable-api.p.rapidapi.com/get_media_data.php?reel_post_code_or_url=${encodeURIComponent(url)}&type=post`,
        host: "instagram-scraper-stable-api.p.rapidapi.com",
      },
      {
        name: "instagram-scraper-api2",
        url: `https://instagram-scraper-api2.p.rapidapi.com/v1/post_info?code_or_id_or_url=${shortcode}`,
        host: "instagram-scraper-api2.p.rapidapi.com",
      },
      {
        name: "instagram-bulk-scraper",
        url: `https://instagram-bulk-scraper-latest.p.rapidapi.com/media_info_v2/${shortcode}`,
        host: "instagram-bulk-scraper-latest.p.rapidapi.com",
      },
      {
        name: "instagram-scraper-2022",
        url: `https://instagram-scraper-2022.p.rapidapi.com/ig/post_info/?shortcode=${shortcode}`,
        host: "instagram-scraper-2022.p.rapidapi.com",
      },
    ];

    for (const api of apis) {
      try {
        console.log(`[IG Import] Trying RapidAPI: ${api.name}`);
        const res = await fetch(api.url, {
          headers: {
            "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
            "X-RapidAPI-Host": api.host,
          },
        });
        if (!res.ok) {
          console.log(`[IG Import] ${api.name} returned ${res.status}`);
          continue;
        }
        const data = await res.json();
        if (!data || data.status === "error" || data.error) {
          console.log(`[IG Import] ${api.name} returned error`);
          continue;
        }

        const post = data.data || data;
        const result = parseMediaResult(post);
        if (result) {
          console.log(`[IG Import] ✅ ${api.name} succeeded — ${result.images.length} image(s), video: ${!!result.videoUrl}`);
          return result;
        }
      } catch {
        continue;
      }
    }
    console.log("[IG Import] All RapidAPI endpoints exhausted, trying free fallbacks");
  }

  // ── Strategy 2 (fallback): Embed page scraping ──
  try {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    const res = await fetch(embedUrl, {
      headers: {
        "User-Agent":
          "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (res.ok) {
      const html = await res.text();

      // Try embedded JSON data first
      const scriptMatch = html.match(
        /window\.__additionalDataLoaded\([^,]+,({[\s\S]+?})\);/
      );
      if (scriptMatch) {
        try {
          const jsonData = JSON.parse(scriptMatch[1]);
          const media =
            jsonData?.graphql?.shortcode_media || jsonData?.shortcode_media;
          if (media) {
            const result = parseMediaResult(media);
            if (result) return result;
          }
        } catch {
          // fall through to regex
        }
      }

      // Regex: only "display_url" keys, filter to CDN URLs, exclude profile pics
      const displayUrlMatches = Array.from(
        html.matchAll(/"display_url"\s*:\s*"([^"]+)"/g)
      );
      if (displayUrlMatches.length > 0) {
        const images = displayUrlMatches
          .map((m) => ({
            url: m[1]
              .replace(/\\u0026/g, "&")
              .replace(/\\\//g, "/")
              .replace(/&amp;/g, "&"),
          }))
          .filter(
            (img) =>
              img.url.includes("cdninstagram") || img.url.includes("fbcdn")
          )
          .filter(
            (img) =>
              !img.url.includes("/s150x150/") &&
              !img.url.includes("/s320x320/") &&
              !img.url.includes("_s.jpg") &&
              !img.url.includes("/profile_pic")
          )
          .filter((img, i, arr) => {
            const key = img.url.split("?")[0];
            return arr.findIndex((a) => a.url.split("?")[0] === key) === i;
          })
          .slice(0, 10);

        if (images.length > 0) return { images, isVideo: false };
      }
    }
  } catch {
    // fall through
  }

  // ── Strategy 3 (fallback): oEmbed ──
  try {
    const oembedUrl = `https://www.instagram.com/p/oembed/?url=${encodeURIComponent(url)}&maxwidth=1080`;
    const res = await fetch(oembedUrl, {
      headers: {
        "User-Agent": "facebookexternalhit/1.1",
        "Accept": "application/json",
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.thumbnail_url) {
        return {
          images: [
            {
              url: data.thumbnail_url,
              width: data.thumbnail_width || 1080,
              height: data.thumbnail_height || 1440,
            },
          ],
          caption: data.title,
          isVideo: false,
        };
      }
    }
  } catch {
    // fall through
  }

  return null;
}

// Fetch media buffer (image or video) with bypass strategies
async function fetchMediaBuffer(mediaUrl: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const strategies: Record<string, string>[] = [
    {
      "User-Agent":
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Accept": "*/*",
    },
    {
      "User-Agent":
        "Instagram 219.0.0.12.117 Android (26/8.0.0; 480dpi; 1080x1920; samsung; SM-G960F; starlte; samsungexynos9810; en_US; 346138365)",
      "Accept": "*/*",
      "X-IG-App-ID": "936619743392459",
    },
    {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Referer": "https://www.instagram.com/",
    },
  ];

  for (const headers of strategies) {
    try {
      const res = await fetch(mediaUrl, {
        headers,
        redirect: "follow",
      });
      if (res.ok) {
        const ct = res.headers.get("content-type") || "application/octet-stream";
        if (ct.startsWith("image/") || ct.startsWith("video/") || ct === "application/octet-stream") {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 0) return { buffer: buf, contentType: ct };
        }
      }
    } catch {
      // try next
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { urls, folderId, tags: extraTags } = body as {
      urls: string[];
      folderId?: string | null;
      tags?: string[];
    };

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: "At least one Instagram URL is required" },
        { status: 400 }
      );
    }

    if (urls.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 URLs per import" },
        { status: 400 }
      );
    }

    // Validate folder ownership if provided
    if (folderId) {
      const folder = await prisma.reference_folders.findFirst({
        where: { id: folderId, clerkId: userId },
      });
      if (!folder) {
        return NextResponse.json(
          { error: "Folder not found or unauthorized" },
          { status: 404 }
        );
      }
    }

    const bucket = process.env.AWS_S3_BUCKET!;
    const region = process.env.AWS_REGION!;
    const results: Array<{ url: string; status: "success" | "failed"; itemId?: string; error?: string }> = [];

    for (const rawUrl of urls) {
      const url = rawUrl.trim();
      if (!url) continue;

      if (!isValidInstagramUrl(url)) {
        results.push({ url, status: "failed", error: "Invalid Instagram URL" });
        continue;
      }

      try {
        // Extract media from IG post
        const media = await extractInstagramMedia(url);
        if (!media || (media.images.length === 0 && !media.videoUrl)) {
          results.push({
            url,
            status: "failed",
            error: "Could not extract media from post",
          });
          continue;
        }

        const shortcode = extractShortcode(url) || "unknown";
        const timestamp = Date.now();
        const randomStr = crypto.randomBytes(6).toString("hex");

        // Determine whether to import as video or image
        const importAsVideo = media.isVideo && !!media.videoUrl;
        const downloadUrl = importAsVideo ? media.videoUrl! : media.images[0]?.url;

        if (!downloadUrl) {
          results.push({ url, status: "failed", error: "No media URL found" });
          continue;
        }

        const downloaded = await fetchMediaBuffer(downloadUrl);
        if (!downloaded) {
          results.push({
            url,
            status: "failed",
            error: `Failed to download ${importAsVideo ? "video" : "image"}`,
          });
          continue;
        }

        // Resolve file metadata based on actual content
        const isVideoContent =
          importAsVideo ||
          downloaded.contentType.startsWith("video/");
        const ext = isVideoContent ? "mp4" : "jpg";
        const mimeType = isVideoContent
          ? "video/mp4"
          : "image/jpeg";
        const fileType = isVideoContent ? "video" : "image";

        const fileName = `ig-${shortcode}-${randomStr}.${ext}`;
        const s3Key = `reference-bank/${userId}/${folderId || "unfiled"}/${timestamp}_${fileName}`;

        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: s3Key,
            Body: downloaded.buffer,
            ContentType: mimeType,
            CacheControl: "max-age=31536000",
          })
        );

        const s3UrlRaw = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
        const s3Url = convertS3ToCdnUrl(s3UrlRaw);

        // For videos, also upload the thumbnail image separately
        let thumbnailUrl = s3Url;
        if (isVideoContent && media.images[0]?.url) {
          try {
            const thumbDownload = await fetchMediaBuffer(media.images[0].url);
            if (thumbDownload) {
              const thumbKey = `reference-bank/${userId}/${folderId || "unfiled"}/${timestamp}_ig-${shortcode}-thumb.jpg`;
              await s3Client.send(
                new PutObjectCommand({
                  Bucket: bucket,
                  Key: thumbKey,
                  Body: thumbDownload.buffer,
                  ContentType: "image/jpeg",
                  CacheControl: "max-age=31536000",
                })
              );
              const thumbRaw = `https://${bucket}.s3.${region}.amazonaws.com/${thumbKey}`;
              thumbnailUrl = convertS3ToCdnUrl(thumbRaw);
            }
          } catch {
            // thumbnail upload failed, video URL will be used as fallback
          }
        }

        const baseTags = ["instagram"];
        if (isVideoContent || url.includes("/reel/") || url.includes("/reels/")) {
          baseTags.push("reel");
        }
        if (extraTags && Array.isArray(extraTags)) {
          baseTags.push(...extraTags);
        }

        const primaryImage = media.images[0];

        const item = await prisma.reference_items.create({
          data: {
            clerkId: userId,
            name: `IG ${shortcode}`,
            description: media.caption
              ? media.caption.substring(0, 500)
              : `Imported from Instagram: ${url}`,
            fileType,
            mimeType,
            fileSize: downloaded.buffer.length,
            width: primaryImage?.width || null,
            height: primaryImage?.height || null,
            awsS3Key: s3Key,
            awsS3Url: s3Url,
            thumbnailUrl,
            tags: baseTags,
            folderId: folderId || null,
            isFavorite: false,
            usageCount: 0,
          },
        });

        results.push({ url, status: "success", itemId: item.id });
      } catch (err) {
        results.push({
          url,
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;
    const failCount = results.filter((r) => r.status === "failed").length;

    return NextResponse.json({
      success: true,
      imported: successCount,
      failed: failCount,
      total: results.length,
      results,
    });
  } catch (error) {
    console.error("Error in bulk Instagram import:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Bulk import failed",
      },
      { status: 500 }
    );
  }
}
