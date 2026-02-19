import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: submissionId, fileId } = await params;

    // Verify submission ownership
    const submission = await prisma.content_submissions.findFirst({
      where: { id: submissionId, clerkId: userId },
      select: { id: true },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Verify file belongs to submission
    const file = await prisma.content_submission_files.findFirst({
      where: { id: fileId, submissionId },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    await prisma.content_submission_files.delete({ where: { id: fileId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting submission file:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
