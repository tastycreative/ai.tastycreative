import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";

// GET - Fetch all marketplace models
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const models = await prisma.marketplaceModel.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Transform status to lowercase for frontend
    const transformedModels = models.map(model => ({
      ...model,
      status: model.status.toLowerCase(),
    }));

    return NextResponse.json(transformedModels);
  } catch (error) {
    console.error("Error fetching marketplace models:", error);
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}

// POST - Create a new marketplace model
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      price,
      status,
      imageUrl,
      category,
      gallery,
      description,
      included,
      usedFor,
    } = body;

    const model = await prisma.marketplaceModel.create({
      data: {
        name,
        price: parseFloat(price),
        status: status.toUpperCase(),
        imageUrl,
        category,
        gallery: gallery || [],
        description,
        included: included || [],
        usedFor: usedFor || [],
      },
    });

    return NextResponse.json(model, { status: 201 });
  } catch (error) {
    console.error("Error creating marketplace model:", error);
    return NextResponse.json(
      { error: "Failed to create model" },
      { status: 500 }
    );
  }
}

// PUT - Update an existing marketplace model
export async function PUT(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      name,
      price,
      status,
      imageUrl,
      category,
      gallery,
      description,
      included,
      usedFor,
    } = body;

    const model = await prisma.marketplaceModel.update({
      where: { id },
      data: {
        name,
        price: parseFloat(price),
        status: status.toUpperCase(),
        imageUrl,
        category,
        gallery: gallery || [],
        description,
        included: included || [],
        usedFor: usedFor || [],
      },
    });

    return NextResponse.json(model);
  } catch (error) {
    console.error("Error updating marketplace model:", error);
    return NextResponse.json(
      { error: "Failed to update model" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a marketplace model
export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Model ID is required" },
        { status: 400 }
      );
    }

    await prisma.marketplaceModel.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting marketplace model:", error);
    return NextResponse.json(
      { error: "Failed to delete model" },
      { status: 500 }
    );
  }
}
