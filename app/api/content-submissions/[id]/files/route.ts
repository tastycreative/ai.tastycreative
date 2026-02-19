import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { generatePresignedUploadUrl } from '@/lib/s3-submission-uploads';
import { getPresignedUrlInputSchema, fileUploadInputSchema } from '@/lib/validations/content-submission';
import crypto from 'crypto';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: submissionId } = await params;

    // Verify submission ownership
    const submission = await prisma.content_submissions.findFirst({
      where: { id: submissionId, clerkId: userId },
      select: { id: true, organizationId: true },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const body = await req.json();

    // If body has awsS3Key, this is a file record creation (after upload)
    if (body.awsS3Key) {
      const parsed = fileUploadInputSchema.safeParse({
        ...body,
        submissionId,
      });

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const fileData = parsed.data;
      const file = await prisma.content_submission_files.create({
        data: {
          id: crypto.randomUUID(),
          submissionId,
          awsS3Key: fileData.awsS3Key,
          awsS3Url: fileData.awsS3Url,
          awsS3Bucket: fileData.awsS3Bucket ?? null,
          fileName: fileData.fileName,
          fileSize: fileData.fileSize,
          fileType: fileData.fileType,
          fileCategory: fileData.fileCategory,
          width: fileData.width ?? null,
          height: fileData.height ?? null,
          duration: fileData.duration ?? null,
          thumbnailUrl: fileData.thumbnailUrl ?? null,
          uploadStatus: 'completed',
          uploadedBy: userId,
          order: fileData.order,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, file }, { status: 201 });
    }

    // Otherwise, generate presigned URL for upload
    const urlParsed = getPresignedUrlInputSchema.safeParse(body);
    if (!urlParsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: urlParsed.error.flatten() },
        { status: 400 }
      );
    }

    const { fileName, fileType } = urlParsed.data;

    const presignedData = await generatePresignedUploadUrl(
      fileName,
      fileType,
      submission.organizationId,
      submissionId
    );

    return NextResponse.json({ success: true, ...presignedData });
  } catch (error) {
    console.error('Error in submission files endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process file request' },
      { status: 500 }
    );
  }
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

    const { id: submissionId } = await params;

    // Verify submission ownership
    const submission = await prisma.content_submissions.findFirst({
      where: { id: submissionId, clerkId: userId },
      select: { id: true },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const files = await prisma.content_submission_files.findMany({
      where: { submissionId },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({ success: true, files });
  } catch (error) {
    console.error('Error listing submission files:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list submission files' },
      { status: 500 }
    );
  }
}
