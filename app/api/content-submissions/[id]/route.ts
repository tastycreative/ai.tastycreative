import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { updateSubmissionInputSchema } from '@/lib/validations/content-submission';
import crypto from 'crypto';

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

    const submission = await prisma.content_submissions.findFirst({
      where: { id, clerkId: userId },
      include: {
        content_submission_pricing: true,
        content_submission_release_schedules: true,
        content_submission_files: { orderBy: { order: 'asc' } },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, submission });
  } catch (error) {
    console.error('Error fetching content submission:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch content submission' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.content_submissions.findFirst({
      where: { id, clerkId: userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateSubmissionInputSchema.safeParse({ ...body, id });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id: _id, ...data } = parsed.data;

    // Build update data for main submission
    const updateData: any = {};
    if (data.submissionType !== undefined) updateData.submissionType = data.submissionType;
    if (data.contentStyle !== undefined) updateData.contentStyle = data.contentStyle;
    if (data.platform !== undefined) updateData.platform = data.platform.join(',');
    if (data.modelId !== undefined) updateData.modelId = data.modelId ?? null;
    if (data.modelName !== undefined) updateData.modelName = data.modelName ?? null;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.caption !== undefined) updateData.caption = data.caption ?? null;
    if (data.driveLink !== undefined) updateData.driveLink = data.driveLink || null;
    if (data.contentType !== undefined) updateData.contentType = data.contentType ?? null;
    if (data.contentTypeOptionId !== undefined) updateData.contentTypeOptionId = data.contentTypeOptionId ?? null;
    if (data.contentCount !== undefined) updateData.contentCount = data.contentCount ?? null;
    if (data.contentLength !== undefined) updateData.contentLength = data.contentLength ?? null;
    if (data.contentTags !== undefined) updateData.contentTags = data.contentTags;
    if (data.externalCreatorTags !== undefined) updateData.externalCreatorTags = data.externalCreatorTags ?? null;
    if (data.internalModelTags !== undefined) updateData.internalModelTags = data.internalModelTags;
    if (data.pricingCategory !== undefined) updateData.pricingCategory = data.pricingCategory;
    if (data.notes !== undefined) updateData.notes = data.notes ?? null;
    if (data.selectedComponents !== undefined) {
      updateData.metadata = { selectedComponents: data.selectedComponents, ...(data.metadata ?? {}) };
    } else if (data.metadata !== undefined) {
      updateData.metadata = data.metadata;
    }

    // Handle status from body (not in the partial schema)
    if (body.status) updateData.status = body.status;

    // Always update the timestamp
    updateData.updatedAt = new Date();

    const submission = await prisma.content_submissions.update({
      where: { id },
      data: updateData,
      include: {
        content_submission_pricing: true,
        content_submission_release_schedules: true,
      },
    });

    // Handle pricing upsert if provided
    if (body.pricing) {
      await prisma.content_submission_pricing.upsert({
        where: { submissionId: id },
        create: {
          id: crypto.randomUUID(),
          submissionId: id,
          minimumPrice: body.pricing.minimumPrice ?? null,
          suggestedPrice: body.pricing.suggestedPrice ?? null,
          finalPrice: body.pricing.finalPrice ?? null,
          currency: body.pricing.currency ?? 'usd',
          pricingType: body.pricing.pricingType ?? null,
          priceRangeMin: body.pricing.priceRangeMin ?? null,
          priceRangeMax: body.pricing.priceRangeMax ?? null,
          pricingNotes: body.pricing.pricingNotes ?? null,
          updatedAt: new Date(),
        },
        update: {
          minimumPrice: body.pricing.minimumPrice ?? null,
          suggestedPrice: body.pricing.suggestedPrice ?? null,
          finalPrice: body.pricing.finalPrice ?? null,
          currency: body.pricing.currency ?? 'usd',
          pricingType: body.pricing.pricingType ?? null,
          priceRangeMin: body.pricing.priceRangeMin ?? null,
          priceRangeMax: body.pricing.priceRangeMax ?? null,
          pricingNotes: body.pricing.pricingNotes ?? null,
          updatedAt: new Date(),
        },
      });
    }

    // Handle release schedule upsert if provided
    if (body.releaseSchedule) {
      await prisma.content_submission_release_schedules.upsert({
        where: { submissionId: id },
        create: {
          id: crypto.randomUUID(),
          submissionId: id,
          releaseDate: new Date(body.releaseSchedule.releaseDate),
          releaseTime: body.releaseSchedule.releaseTime ?? null,
          timezone: body.releaseSchedule.timezone ?? 'UTC',
          scheduledBy: body.releaseSchedule.scheduledBy ?? userId,
          updatedAt: new Date(),
        },
        update: {
          releaseDate: new Date(body.releaseSchedule.releaseDate),
          releaseTime: body.releaseSchedule.releaseTime ?? null,
          timezone: body.releaseSchedule.timezone ?? 'UTC',
          scheduledBy: body.releaseSchedule.scheduledBy ?? userId,
          updatedAt: new Date(),
        },
      });
    }

    // Re-fetch with includes after upserts
    const updated = await prisma.content_submissions.findUnique({
      where: { id },
      include: {
        content_submission_pricing: true,
        content_submission_release_schedules: true,
        content_submission_files: { orderBy: { order: 'asc' } },
      },
    });

    return NextResponse.json({ success: true, submission: updated });
  } catch (error) {
    console.error('Error updating content submission:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update content submission' },
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

    // Verify ownership
    const existing = await prisma.content_submissions.findFirst({
      where: { id, clerkId: userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Cascade delete handles related records (pricing, schedule, files)
    await prisma.content_submissions.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting content submission:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete content submission' },
      { status: 500 }
    );
  }
}
