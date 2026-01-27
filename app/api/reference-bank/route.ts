import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

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

    // Filter by file type
    if (fileType && fileType !== "all") {
      whereClause.fileType = fileType;
    }

    // Search filter
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { hasSome: [search] } },
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
      where: { clerkId: userId, fileType: "image" },
    });

    const videoCount = await prisma.reference_items.count({
      where: { clerkId: userId, fileType: "video" },
    });

    return NextResponse.json({ 
      items, 
      folders,
      stats: {
        total: totalCount,
        favorites: favoritesCount,
        unfiled: unfiledCount,
        images: imageCount,
        videos: videoCount,
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
    } = body;

    if (!name || !fileType || !mimeType || !awsS3Key) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // If folderId is provided, verify it belongs to the user
    if (folderId) {
      const folder = await prisma.reference_folders.findFirst({
        where: {
          id: folderId,
          clerkId: userId,
        },
      });

      if (!folder) {
        return NextResponse.json(
          { error: "Folder not found" },
          { status: 404 }
        );
      }
    }

    // Construct the S3 URL
    const bucket = process.env.AWS_S3_BUCKET || "tastycreative";
    const region = process.env.AWS_REGION || "us-east-1";
    const awsS3Url = `https://${bucket}.s3.${region}.amazonaws.com/${awsS3Key}`;

    const item = await prisma.reference_items.create({
      data: {
        clerkId: userId,
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
