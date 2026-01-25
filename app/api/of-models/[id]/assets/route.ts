import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get all assets for an OF model (accessible by anyone authenticated)
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    // Verify model exists
    const model = await prisma.of_models.findUnique({
      where: { id },
    });

    if (!model) {
      return NextResponse.json(
        { error: "OF model not found" },
        { status: 404 }
      );
    }

    const assets = await prisma.of_model_assets.findMany({
      where: {
        creatorId: id,
        ...(type && { type: type.toUpperCase() as any }),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: assets });
  } catch (error) {
    console.error("Error fetching assets:", error);
    return NextResponse.json(
      { error: "Failed to fetch assets" },
      { status: 500 }
    );
  }
}

// POST - Create a new asset (accessible by anyone authenticated)
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const {
      type,
      name,
      url,
      thumbnailUrl,
      fileSize,
      mimeType,
      metadata,
    } = body;

    if (!type || !name || !url) {
      return NextResponse.json(
        { error: "Type, name, and url are required" },
        { status: 400 }
      );
    }

    // Verify model exists
    const model = await prisma.of_models.findUnique({
      where: { id },
    });

    if (!model) {
      return NextResponse.json(
        { error: "OF model not found" },
        { status: 404 }
      );
    }

    const asset = await prisma.of_model_assets.create({
      data: {
        creatorId: id,
        type: type.toUpperCase(),
        name,
        url,
        thumbnailUrl,
        fileSize,
        mimeType,
        metadata,
      } as any,
    });

    return NextResponse.json({ data: asset }, { status: 201 });
  } catch (error) {
    console.error("Error creating asset:", error);
    return NextResponse.json(
      { error: "Failed to create asset" },
      { status: 500 }
    );
  }
}

// PATCH - Update an asset (accessible by anyone authenticated)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { assetId, ...updateData } = body;

    if (!assetId) {
      return NextResponse.json(
        { error: "Asset ID is required" },
        { status: 400 }
      );
    }

    // Verify model exists
    const model = await prisma.of_models.findUnique({
      where: { id },
    });

    if (!model) {
      return NextResponse.json(
        { error: "OF model not found" },
        { status: 404 }
      );
    }

    // Verify asset exists
    const existingAsset = await prisma.of_model_assets.findFirst({
      where: {
        id: assetId,
        creatorId: id,
      },
    });

    if (!existingAsset) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      );
    }

    const data: any = {};
    if (updateData.name !== undefined) data.name = updateData.name;
    if (updateData.type !== undefined) data.type = updateData.type.toUpperCase();
    if (updateData.url !== undefined) data.url = updateData.url;
    if (updateData.thumbnailUrl !== undefined) data.thumbnailUrl = updateData.thumbnailUrl;
    if (updateData.fileSize !== undefined) data.fileSize = updateData.fileSize;
    if (updateData.mimeType !== undefined) data.mimeType = updateData.mimeType;
    if (updateData.metadata !== undefined) data.metadata = updateData.metadata;

    const asset = await prisma.of_model_assets.update({
      where: { id: assetId },
      data,
    });

    return NextResponse.json({ data: asset });
  } catch (error) {
    console.error("Error updating asset:", error);
    return NextResponse.json(
      { error: "Failed to update asset" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an asset (accessible by anyone authenticated)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const assetId = searchParams.get("assetId");

    if (!assetId) {
      return NextResponse.json(
        { error: "Asset ID is required" },
        { status: 400 }
      );
    }

    // Verify model exists
    const model = await prisma.of_models.findUnique({
      where: { id },
    });

    if (!model) {
      return NextResponse.json(
        { error: "OF model not found" },
        { status: 404 }
      );
    }

    // Verify asset exists
    const existingAsset = await prisma.of_model_assets.findFirst({
      where: {
        id: assetId,
        creatorId: id,
      },
    });

    if (!existingAsset) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      );
    }

    await prisma.of_model_assets.delete({
      where: { id: assetId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset:", error);
    return NextResponse.json(
      { error: "Failed to delete asset" },
      { status: 500 }
    );
  }
}
