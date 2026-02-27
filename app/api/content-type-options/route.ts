import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const modelId = searchParams.get('modelId');
    const modelName = searchParams.get('modelName');
    const pageType = searchParams.get('pageType');
    const fetchAll = searchParams.get('fetchAll');
    const includeInactive = searchParams.get('includeInactive');

    // Build where clause
    const whereClause: any = {};

    if (includeInactive !== 'true') {
      whereClause.isActive = true;
    }

    if (category) {
      whereClause.category = category;
    }

    const andConditions: any[] = [];

    // Page type filtering
    if (pageType && pageType !== 'ALL_PAGES') {
      andConditions.push({
        OR: [{ pageType }, { pageType: 'ALL_PAGES' }],
      });
    }

    // Model filtering
    let resolvedModelId = modelId;
    if (modelName && !resolvedModelId) {
      const model = await prisma.of_models.findFirst({
        where: { name: modelName },
        select: { id: true },
      });
      if (model) resolvedModelId = model.id;
    }

    if (fetchAll === 'true') {
      // No model filter - get everything
    } else if (resolvedModelId) {
      andConditions.push({
        OR: [{ modelId: resolvedModelId }, { modelId: null }],
      });
    } else {
      whereClause.modelId = null;
    }

    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    const contentTypeOptions = await prisma.contentTypeOption.findMany({
      where: whereClause,
      include: {
        model: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({
      success: true,
      contentTypeOptions,
      category,
      modelId: resolvedModelId,
      pageType,
    });
  } catch (error) {
    console.error('Error fetching content type options:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch content type options' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      value,
      label,
      category,
      pageType,
      priceType,
      priceFixed,
      priceMin,
      priceMax,
      description,
      order,
      isFree,
      modelId,
    } = body;

    if (!value || !label || !category) {
      return NextResponse.json(
        { success: false, error: 'Value, label, and category are required' },
        { status: 400 }
      );
    }

    if (modelId) {
      const modelExists = await prisma.of_models.findUnique({
        where: { id: modelId },
      });
      if (!modelExists) {
        return NextResponse.json(
          { success: false, error: 'Invalid modelId - model not found' },
          { status: 400 }
        );
      }
    }

    // Validate pricing
    if (!isFree && priceType) {
      if (priceType === 'FIXED' && !priceFixed && priceFixed !== 0) {
        return NextResponse.json(
          { success: false, error: 'Fixed price required for FIXED type' },
          { status: 400 }
        );
      }
      if (priceType === 'RANGE' && ((!priceMin && priceMin !== 0) || (!priceMax && priceMax !== 0))) {
        return NextResponse.json(
          { success: false, error: 'Min and max prices required for RANGE type' },
          { status: 400 }
        );
      }
      if (priceType === 'MINIMUM' && !priceMin && priceMin !== 0) {
        return NextResponse.json(
          { success: false, error: 'Minimum price required for MINIMUM type' },
          { status: 400 }
        );
      }
    }

    const contentTypeOption = await prisma.contentTypeOption.create({
      data: {
        value,
        label,
        category,
        pageType: pageType || 'ALL_PAGES',
        priceType: isFree ? null : priceType,
        priceFixed: isFree ? null : priceFixed,
        priceMin: isFree ? null : priceMin,
        priceMax: isFree ? null : priceMax,
        description,
        order: order || 0,
        isFree: isFree || false,
        modelId: modelId || null,
      },
    });

    await prisma.contentTypePricingHistory.create({
      data: {
        contentTypeOptionId: contentTypeOption.id,
        changeType: 'CREATED',
        newPriceType: isFree ? null : priceType,
        newPriceFixed: isFree ? null : (priceFixed ?? null),
        newPriceMin: isFree ? null : (priceMin ?? null),
        newPriceMax: isFree ? null : (priceMax ?? null),
        newLabel: label,
        newIsFree: isFree || false,
        changedById: userId,
        reason: 'Initial creation',
      },
    });

    return NextResponse.json({ success: true, contentTypeOption });
  } catch (error: any) {
    console.error('Error creating content type option:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A content type option with this value already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to create content type option' },
      { status: 500 }
    );
  }
}
