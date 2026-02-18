import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { createSubmissionWithComponentsSchema, listSubmissionsInputSchema } from '@/lib/validations/content-submission';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    if (!user?.currentOrganizationId) {
      return NextResponse.json(
        { error: 'No organization found for user' },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Strip incomplete nested objects before validation
    if (body.releaseSchedule && !body.releaseSchedule.releaseDate) {
      delete body.releaseSchedule;
    }

    // Validate with Zod
    const parsed = createSubmissionWithComponentsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const submissionId = crypto.randomUUID();

    // Build nested create data
    const submission = await prisma.content_submissions.create({
      data: {
        id: submissionId,
        organizationId: user.currentOrganizationId,
        clerkId: userId,
        submissionType: data.submissionType,
        contentStyle: data.contentStyle,
        status: data.metadata?.submitStatus === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT',
        platform: data.platform.join(','),
        modelId: data.modelId ?? null,
        modelName: data.modelName ?? null,
        priority: data.priority,
        caption: data.caption ?? null,
        driveLink: data.driveLink || null,
        contentType: data.contentType ?? null,
        contentTypeOptionId: data.contentTypeOptionId ?? null,
        contentCount: data.contentCount ?? null,
        contentLength: data.contentLength ?? null,
        contentTags: data.contentTags,
        externalCreatorTags: data.externalCreatorTags ?? null,
        internalModelTags: data.internalModelTags,
        pricingCategory: data.pricingCategory,
        notes: data.notes ?? null,
        metadata: {
          selectedComponents: data.selectedComponents,
          ...(data.metadata ?? {}),
        },
        updatedAt: new Date(),
        // Nested pricing
        ...(data.pricing ? {
          content_submission_pricing: {
            create: {
              id: crypto.randomUUID(),
              minimumPrice: data.pricing.minimumPrice ?? null,
              suggestedPrice: data.pricing.suggestedPrice ?? null,
              finalPrice: data.pricing.finalPrice ?? null,
              currency: data.pricing.currency,
              pricingType: data.pricing.pricingType ?? null,
              priceRangeMin: data.pricing.priceRangeMin ?? null,
              priceRangeMax: data.pricing.priceRangeMax ?? null,
              pricingNotes: data.pricing.pricingNotes ?? null,
              updatedAt: new Date(),
            },
          },
        } : {}),
        // Nested release schedule
        ...(data.releaseSchedule ? {
          content_submission_release_schedules: {
            create: {
              id: crypto.randomUUID(),
              releaseDate: new Date(data.releaseSchedule.releaseDate),
              releaseTime: data.releaseSchedule.releaseTime ?? null,
              timezone: data.releaseSchedule.timezone,
              scheduledBy: data.releaseSchedule.scheduledBy ?? userId,
              updatedAt: new Date(),
            },
          },
        } : {}),
      },
      include: {
        content_submission_pricing: true,
        content_submission_release_schedules: true,
      },
    });

    return NextResponse.json({ success: true, submission }, { status: 201 });
  } catch (error) {
    console.error('Error creating content submission:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create content submission' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const params = listSubmissionsInputSchema.safeParse({
      organizationId: searchParams.get('organizationId') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      submissionType: searchParams.get('submissionType') ?? undefined,
      contentStyle: searchParams.get('contentStyle') ?? undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      cursor: searchParams.get('cursor') ?? undefined,
    });

    if (!params.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: params.error.flatten() },
        { status: 400 }
      );
    }

    const { organizationId, status, submissionType, contentStyle, limit, cursor } = params.data;

    const where: any = { clerkId: userId };
    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;
    if (submissionType) where.submissionType = submissionType;
    if (contentStyle) where.contentStyle = contentStyle;
    if (cursor) where.id = { lt: cursor };

    const submissions = await prisma.content_submissions.findMany({
      where,
      include: {
        content_submission_pricing: true,
        content_submission_release_schedules: true,
        content_submission_files: { orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const nextCursor = submissions.length === limit
      ? submissions[submissions.length - 1].id
      : null;

    return NextResponse.json({
      success: true,
      submissions,
      nextCursor,
    });
  } catch (error) {
    console.error('Error listing content submissions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list content submissions' },
      { status: 500 }
    );
  }
}
