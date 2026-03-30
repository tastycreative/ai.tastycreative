import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { convertS3ToCdnUrl } from "@/lib/cdnUtils";

// GET - List all reference items for a user (universal, no profile dependency)
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folderId");
    const favoritesOnly = searchParams.get("favorites") === "true";
    const fileType = searchParams.get("fileType");
    const search = searchParams.get("search");

    // Build where clause
    const whereClause: any = {
      clerkId: userId,
    };

    // Filter by folder (null means root/unfiled items)
    if (folderId === "root") {
      whereClause.folderId = null;
    } else if (folderId) {
      whereClause.folderId = folderId;
    }

    // Filter by favorites
    if (favoritesOnly) {
      whereClause.isFavorite = true;
    }

    // Filter by file type (handle both "video" and "video/mp4" patterns)
    if (fileType && fileType !== "all") {
      whereClause.AND = [
        ...(Array.isArray(whereClause.AND) ? whereClause.AND : []),
        {
          OR: [
            { fileType: fileType },
            { fileType: { startsWith: `${fileType}/` } },
          ],
        },
      ];
    }

    // Search filter
    if (search) {
      whereClause.AND = [
        ...(Array.isArray(whereClause.AND) ? whereClause.AND : []),
        {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { tags: { hasSome: [search] } },
          ],
        },
      ];
    }

    const items = await prisma.reference_items.findMany({
      where: whereClause,
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get folders for sidebar
    const folders = await prisma.reference_folders.findMany({
      where: {
        clerkId: userId,
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    // Get counts
    const totalCount = await prisma.reference_items.count({
      where: { clerkId: userId },
    });

    const favoritesCount = await prisma.reference_items.count({
      where: { clerkId: userId, isFavorite: true },
    });

    const unfiledCount = await prisma.reference_items.count({
      where: { clerkId: userId, folderId: null },
    });

    const imageCount = await prisma.reference_items.count({
      where: { clerkId: userId, OR: [{ fileType: "image" }, { fileType: { startsWith: "image/" } }] },
    });

    const videoCount = await prisma.reference_items.count({
      where: { clerkId: userId, OR: [{ fileType: "video" }, { fileType: { startsWith: "video/" } }] },
    });

    // Calculate total storage used
    const storageAggregation = await prisma.reference_items.aggregate({
      where: { clerkId: userId },
      _sum: {
        fileSize: true,
      },
    });

    const totalSize = storageAggregation._sum.fileSize || 0;
    
    // Storage quota: 5 GB (5 * 1024 * 1024 * 1024 bytes)
    const quotaLimit = 5 * 1024 * 1024 * 1024;

    return NextResponse.json({ 
      items, 
      folders,
      stats: {
        total: totalCount,
        favorites: favoritesCount,
        unfiled: unfiledCount,
        images: imageCount,
        videos: videoCount,
        totalSize,
        quotaLimit,
      }
    });
  } catch (error) {
    console.error("Error fetching reference items:", error);
    return NextResponse.json(
      { error: "Failed to fetch reference items" },
      { status: 500 }
    );
  }
}

// POST - Create a new reference item
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      description,
      tags,
      fileType,
      mimeType,
      fileSize,
      awsS3Key,
      width,
      height,
      duration,
      folderId,
      isFavorite,
      fileHash,
    } = body;

    if (!name || !fileType || !mimeType || !awsS3Key) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // If folderId is provided, verify access
    let itemOwnerId = userId;
    if (folderId) {
      // First check if it's the user's own folder
      const ownFolder = await prisma.reference_folders.findFirst({
        where: { id: folderId, clerkId: userId },
      });

      if (!ownFolder) {
        // Check if the user has EDIT permission via a share
        const memberships = await prisma.teamMember.findMany({
          where: { user: { clerkId: userId } },
          include: { orgTeamMemberships: { select: { teamId: true } } },
        });
        const orgIds = memberships.map((m) => m.organizationId);
        const teamIds = memberships.flatMap((m) => m.orgTeamMemberships.map((t) => t.teamId));

        const share = await prisma.reference_folder_shares.findFirst({
          where: {
            folderId,
            permission: "EDIT",
            OR: [
              { organizationId: { in: orgIds }, orgTeamId: null },
              ...(teamIds.length > 0 ? [{ orgTeamId: { in: teamIds } }] : []),
            ],
          },
          include: { folder: { select: { clerkId: true } } },
        });

        if (!share) {
          return NextResponse.json(
            { error: "Folder not found or no EDIT permission" },
            { status: 404 }
          );
        }
        // Use the folder owner's clerkId so the item belongs to the folder owner
        itemOwnerId = share.folder.clerkId;
      }
    }

    // Construct the S3 URL and convert to CDN URL
    const bucket = process.env.AWS_S3_BUCKET || "tastycreative";
    const region = process.env.AWS_REGION || "us-east-1";
    const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${awsS3Key}`;
    const awsS3Url = convertS3ToCdnUrl(s3Url);

    const item = await prisma.reference_items.create({
      data: {
        clerkId: itemOwnerId,
        name,
        description: description || null,
        tags: tags || [],
        fileType,
        mimeType,
        fileSize: fileSize || 0,
        awsS3Key,
        awsS3Url,
        width: width || null,
        height: height || null,
        duration: duration || null,
        folderId: folderId || null,
        isFavorite: isFavorite || false,
        fileHash: fileHash || null,
      },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Error creating reference item:", error);
    return NextResponse.json(
      { error: "Failed to create reference item" },
      { status: 500 }
    );
  }
}
