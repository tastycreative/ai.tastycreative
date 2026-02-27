import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

function getChangeType(
  existingOption: {
    priceType: string | null;
    priceFixed: number | null;
    priceMin: number | null;
    priceMax: number | null;
    isFree: boolean;
    label: string;
  },
  newData: {
    label: string;
    priceType: string | null;
    priceFixed: number | null;
    priceMin: number | null;
    priceMax: number | null;
    isFree: boolean;
  }
): string {
  const priceChanged =
    existingOption.priceType !== newData.priceType ||
    existingOption.priceFixed !== newData.priceFixed ||
    existingOption.priceMin !== newData.priceMin ||
    existingOption.priceMax !== newData.priceMax ||
    existingOption.isFree !== newData.isFree;

  const labelChanged = existingOption.label !== newData.label;

  if (priceChanged && labelChanged) return 'PRICE_AND_LABEL_UPDATE';
  if (priceChanged) return 'PRICE_UPDATE';
  if (labelChanged) return 'LABEL_UPDATE';
  return 'UPDATE';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const contentTypeOption = await prisma.contentTypeOption.findUnique({
      where: { id },
      include: {
        model: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
        pricingHistory: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!contentTypeOption) {
      return NextResponse.json(
        { success: false, error: 'Content type option not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, contentTypeOption });
  } catch (error) {
    console.error('Error fetching content type option:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch content type option' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const {
      value,
      label,
      pageType,
      priceType,
      priceFixed,
      priceMin,
      priceMax,
      description,
      reason,
      isFree,
      modelId,
    } = body;

    if (!label) {
      return NextResponse.json(
        { success: false, error: 'Label is required' },
        { status: 400 }
      );
    }

    if (!value) {
      return NextResponse.json(
        { success: false, error: 'Value (content type code) is required' },
        { status: 400 }
      );
    }

    // Validate pricing
    if (!isFree && priceType) {
      if (priceType === 'FIXED' && !priceFixed && priceFixed !== 0) {
        return NextResponse.json(
          { success: false, error: 'Fixed price is required for FIXED price type' },
          { status: 400 }
        );
      }
      if (priceType === 'RANGE' && ((!priceMin && priceMin !== 0) || (!priceMax && priceMax !== 0))) {
        return NextResponse.json(
          { success: false, error: 'Min and max prices are required for RANGE price type' },
          { status: 400 }
        );
      }
      if (priceType === 'MINIMUM' && !priceMin && priceMin !== 0) {
        return NextResponse.json(
          { success: false, error: 'Minimum price is required for MINIMUM price type' },
          { status: 400 }
        );
      }
    }

    const existingOption = await prisma.contentTypeOption.findUnique({
      where: { id },
    });

    if (!existingOption) {
      return NextResponse.json(
        { success: false, error: 'Content type option not found' },
        { status: 404 }
      );
    }

    // Duplicate check on value + category + modelId + pageType
    const effectivePageType = pageType || existingOption.pageType || 'ALL_PAGES';
    const effectiveModelId = modelId !== undefined ? (modelId || null) : existingOption.modelId;

    if (
      value !== existingOption.value ||
      effectivePageType !== existingOption.pageType ||
      effectiveModelId !== existingOption.modelId
    ) {
      const duplicate = await prisma.contentTypeOption.findFirst({
        where: {
          id: { not: id },
          value,
          category: existingOption.category,
          modelId: effectiveModelId,
          pageType: effectivePageType,
        },
      });

      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            error: `A content type with code "${value}" already exists for this tier, model, and page type combination.`,
          },
          { status: 409 }
        );
      }
    }

    const effectivePriceType = isFree ? null : priceType;
    const effectivePriceFixed = isFree ? null : (priceFixed ?? null);
    const effectivePriceMin = isFree ? null : (priceMin ?? null);
    const effectivePriceMax = isFree ? null : (priceMax ?? null);

    const changeType = getChangeType(existingOption, {
      label,
      priceType: effectivePriceType,
      priceFixed: effectivePriceFixed,
      priceMin: effectivePriceMin,
      priceMax: effectivePriceMax,
      isFree: isFree || false,
    });

    const [updatedOption, historyRecord] = await prisma.$transaction([
      prisma.contentTypeOption.update({
        where: { id },
        data: {
          value,
          label,
          pageType: effectivePageType,
          priceType: effectivePriceType,
          priceFixed: effectivePriceFixed,
          priceMin: effectivePriceMin,
          priceMax: effectivePriceMax,
          description,
          isFree: isFree || false,
          modelId: effectiveModelId,
        },
        include: {
          model: {
            select: { id: true, name: true, displayName: true },
          },
        },
      }),
      prisma.contentTypePricingHistory.create({
        data: {
          contentTypeOptionId: id,
          changeType,
          oldPriceType: existingOption.priceType,
          oldPriceFixed: existingOption.priceFixed,
          oldPriceMin: existingOption.priceMin,
          oldPriceMax: existingOption.priceMax,
          oldLabel: existingOption.label,
          oldIsFree: existingOption.isFree,
          newPriceType: effectivePriceType,
          newPriceFixed: effectivePriceFixed,
          newPriceMin: effectivePriceMin,
          newPriceMax: effectivePriceMax,
          newLabel: label,
          newIsFree: isFree || false,
          changedById: userId,
          reason: reason || null,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      contentTypeOption: updatedOption,
      historyRecord,
    });
  } catch (error) {
    console.error('Error updating content type option:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update content type option' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existingOption = await prisma.contentTypeOption.findUnique({
      where: { id },
    });

    if (!existingOption) {
      return NextResponse.json(
        { success: false, error: 'Content type option not found' },
        { status: 404 }
      );
    }

    const [updatedOption] = await prisma.$transaction([
      prisma.contentTypeOption.update({
        where: { id },
        data: { isActive: false },
      }),
      prisma.contentTypePricingHistory.create({
        data: {
          contentTypeOptionId: id,
          changeType: 'DEACTIVATED',
          oldPriceType: existingOption.priceType,
          oldPriceFixed: existingOption.priceFixed,
          oldPriceMin: existingOption.priceMin,
          oldPriceMax: existingOption.priceMax,
          oldLabel: existingOption.label,
          oldIsFree: existingOption.isFree,
          newPriceType: existingOption.priceType,
          newPriceFixed: existingOption.priceFixed,
          newPriceMin: existingOption.priceMin,
          newPriceMax: existingOption.priceMax,
          newLabel: existingOption.label,
          newIsFree: existingOption.isFree,
          changedById: userId,
          reason: 'Content type deactivated',
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      contentTypeOption: updatedOption,
    });
  } catch (error) {
    console.error('Error deleting content type option:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete content type option' },
      { status: 500 }
    );
  }
}
