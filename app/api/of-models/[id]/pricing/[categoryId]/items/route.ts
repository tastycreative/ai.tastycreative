import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

interface RouteParams {
  params: Promise<{ id: string; categoryId: string }>;
}

// Helper to create pricing history record
async function createPricingHistory(
  pricingItemId: string,
  changeType: "CREATED" | "UPDATED" | "DELETED" | "ACTIVATED" | "DEACTIVATED" | "PRICE_CHANGE",
  oldValues: any,
  newValues: any,
  userId?: string | null,
  userName?: string | null,
  reason?: string
) {
  await prisma.pricing_history.create({
    data: {
      pricingItemId,
      changeType,
      oldName: oldValues?.name || null,
      oldPriceType: oldValues?.priceType || null,
      oldPrice: oldValues?.price || null,
      oldPriceMin: oldValues?.priceMin || null,
      oldPriceMax: oldValues?.priceMax || null,
      oldIsFree: oldValues?.isFree ?? null,
      oldIsActive: oldValues?.isActive ?? null,
      newName: newValues?.name || null,
      newPriceType: newValues?.priceType || null,
      newPrice: newValues?.price || null,
      newPriceMin: newValues?.priceMin || null,
      newPriceMax: newValues?.priceMax || null,
      newIsFree: newValues?.isFree ?? null,
      newIsActive: newValues?.isActive ?? null,
      changedById: userId || null,
      changedByName: userName || null,
      reason: reason || null,
    },
  });
}

// GET - Get all items in a pricing category (accessible by anyone authenticated)
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, categoryId } = await params;
    const { searchParams } = new URL(req.url);
    const includeHistory = searchParams.get("includeHistory") === "true";

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

    // Verify category exists (allow global categories or model-specific)
    const category = await prisma.of_model_pricing_categories.findFirst({
      where: {
        id: categoryId,
        OR: [
          { creatorId: id },
          { isGlobal: true },
        ],
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Pricing category not found" },
        { status: 404 }
      );
    }

    const items = await prisma.of_model_pricing_items.findMany({
      where: { categoryId },
      include: includeHistory ? {
        pricing_history: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      } : undefined,
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ data: items });
  } catch (error) {
    console.error("Error fetching pricing items:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing items" },
      { status: 500 }
    );
  }
}

// POST - Create a new pricing item (accessible by anyone authenticated)
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.emailAddresses?.[0]?.emailAddress || null;

    const { id, categoryId } = await params;
    const body = await req.json();
    const {
      name,
      price,
      priceType = "FIXED",
      priceMin,
      priceMax,
      isFree = false,
      description,
      order = 0,
      isActive = true,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Validate price based on isFree and priceType
    if (!isFree) {
      if (priceType === "FIXED" && (price === undefined || price === null)) {
        return NextResponse.json(
          { error: "Price is required for non-free FIXED items" },
          { status: 400 }
        );
      }
      if (priceType === "RANGE" && (priceMin === undefined || priceMax === undefined)) {
        return NextResponse.json(
          { error: "Price min and max are required for RANGE items" },
          { status: 400 }
        );
      }
      if (priceType === "MINIMUM" && priceMin === undefined) {
        return NextResponse.json(
          { error: "Price min is required for MINIMUM items" },
          { status: 400 }
        );
      }
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

    // Verify category exists
    const category = await prisma.of_model_pricing_categories.findFirst({
      where: {
        id: categoryId,
        OR: [
          { creatorId: id },
          { isGlobal: true },
        ],
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Pricing category not found" },
        { status: 404 }
      );
    }

    // Calculate the main price value
    const mainPrice = isFree ? 0 : (priceType === "FIXED" ? parseFloat(price) : (priceMin ? parseFloat(priceMin) : 0));

    const item = await prisma.of_model_pricing_items.create({
      data: {
        categoryId,
        name,
        price: mainPrice,
        priceType: isFree ? "FIXED" : priceType,
        priceMin: isFree ? null : (priceMin ? parseFloat(priceMin) : null),
        priceMax: isFree ? null : (priceMax ? parseFloat(priceMax) : null),
        isFree,
        description,
        order,
        isActive,
        updatedAt: new Date(),
      },
    });

    // Create history record
    await createPricingHistory(
      item.id,
      "CREATED",
      null,
      {
        name: item.name,
        priceType: item.priceType,
        price: item.price,
        priceMin: item.priceMin,
        priceMax: item.priceMax,
        isFree: item.isFree,
        isActive: item.isActive,
      },
      userId,
      userName,
      "Initial creation"
    );

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error("Error creating pricing item:", error);
    return NextResponse.json(
      { error: "Failed to create pricing item" },
      { status: 500 }
    );
  }
}

// PATCH - Update a pricing item (accessible by anyone authenticated)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.emailAddresses?.[0]?.emailAddress || null;

    const { id, categoryId } = await params;
    const body = await req.json();

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

    // Verify category exists
    const category = await prisma.of_model_pricing_categories.findFirst({
      where: {
        id: categoryId,
        OR: [
          { creatorId: id },
          { isGlobal: true },
        ],
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Pricing category not found" },
        { status: 404 }
      );
    }

    // Handle single item update
    if (body.itemId) {
      const { itemId, reason, ...updateData } = body;

      const existingItem = await prisma.of_model_pricing_items.findFirst({
        where: {
          id: itemId,
          categoryId,
        },
      });

      if (!existingItem) {
        return NextResponse.json(
          { error: "Pricing item not found" },
          { status: 404 }
        );
      }

      const data: any = { updatedAt: new Date() };
      if (updateData.name !== undefined) data.name = updateData.name;
      if (updateData.price !== undefined) data.price = parseFloat(updateData.price);
      if (updateData.priceType !== undefined) data.priceType = updateData.priceType;
      if (updateData.priceMin !== undefined) data.priceMin = updateData.priceMin !== null ? parseFloat(updateData.priceMin) : null;
      if (updateData.priceMax !== undefined) data.priceMax = updateData.priceMax !== null ? parseFloat(updateData.priceMax) : null;
      if (updateData.isFree !== undefined) data.isFree = updateData.isFree;
      if (updateData.description !== undefined) data.description = updateData.description;
      if (updateData.order !== undefined) data.order = updateData.order;
      if (updateData.isActive !== undefined) data.isActive = updateData.isActive;

      // If marking as free, clear price fields
      if (data.isFree === true) {
        data.price = 0;
        data.priceMin = null;
        data.priceMax = null;
        data.priceType = "FIXED";
      }

      const item = await prisma.of_model_pricing_items.update({
        where: { id: itemId },
        data,
      });

      // Determine change type
      let changeType: "UPDATED" | "ACTIVATED" | "DEACTIVATED" | "PRICE_CHANGE" = "UPDATED";
      if (updateData.isActive === true && existingItem.isActive === false) {
        changeType = "ACTIVATED";
      } else if (updateData.isActive === false && existingItem.isActive === true) {
        changeType = "DEACTIVATED";
      } else if (
        updateData.price !== undefined ||
        updateData.priceType !== undefined ||
        updateData.priceMin !== undefined ||
        updateData.priceMax !== undefined ||
        updateData.isFree !== undefined
      ) {
        changeType = "PRICE_CHANGE";
      }

      // Create history record
      await createPricingHistory(
        item.id,
        changeType,
        {
          name: existingItem.name,
          priceType: existingItem.priceType,
          price: existingItem.price,
          priceMin: existingItem.priceMin,
          priceMax: existingItem.priceMax,
          isFree: existingItem.isFree,
          isActive: existingItem.isActive,
        },
        {
          name: item.name,
          priceType: item.priceType,
          price: item.price,
          priceMin: item.priceMin,
          priceMax: item.priceMax,
          isFree: item.isFree,
          isActive: item.isActive,
        },
        userId,
        userName,
        reason
      );

      return NextResponse.json({ data: item });
    }

    // Handle bulk order update
    if (body.items && Array.isArray(body.items)) {
      const updates = body.items.map((item: { id: string; order: number }) =>
        prisma.of_model_pricing_items.update({
          where: { id: item.id },
          data: { order: item.order, updatedAt: new Date() },
        })
      );

      await Promise.all(updates);

      const items = await prisma.of_model_pricing_items.findMany({
        where: { categoryId },
        orderBy: { order: "asc" },
      });

      return NextResponse.json({ data: items });
    }

    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating pricing item:", error);
    return NextResponse.json(
      { error: "Failed to update pricing item" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a pricing item (accessible by anyone authenticated)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.emailAddresses?.[0]?.emailAddress || null;

    const { id, categoryId } = await params;
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");
    const reason = searchParams.get("reason");

    if (!itemId) {
      return NextResponse.json(
        { error: "Item ID is required" },
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

    // Verify item exists and belongs to category
    const existingItem = await prisma.of_model_pricing_items.findFirst({
      where: {
        id: itemId,
        categoryId,
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Pricing item not found" },
        { status: 404 }
      );
    }

    // Create history record before deletion
    await createPricingHistory(
      existingItem.id,
      "DELETED",
      {
        name: existingItem.name,
        priceType: existingItem.priceType,
        price: existingItem.price,
        priceMin: existingItem.priceMin,
        priceMax: existingItem.priceMax,
        isFree: existingItem.isFree,
        isActive: existingItem.isActive,
      },
      null,
      userId,
      userName,
      reason || "Item deleted"
    );

    await prisma.of_model_pricing_items.delete({
      where: { id: itemId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting pricing item:", error);
    return NextResponse.json(
      { error: "Failed to delete pricing item" },
      { status: 500 }
    );
  }
}
