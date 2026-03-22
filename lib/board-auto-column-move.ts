import { prisma } from '@/lib/database';
import { broadcastToBoard } from '@/lib/ably-server';

/**
 * Auto-move a board item between columns based on metadata conditions.
 *
 * Rules (OTP/PTR board):
 *   - "PGT Team" → "Flyer Team"  when otpPtrCaptionStatus is AWAITING_APPROVAL or APPROVED
 *   - "Flyer Team" → "QA"  when gifUrl is set (non-empty)
 *
 * This is a non-fatal helper — errors are logged but do not propagate.
 */
export async function autoMoveColumnIfNeeded(params: {
  boardItemId: string;
  currentColumnId: string;
  currentColumnName: string;
  boardId: string;
  metadata: Record<string, unknown>;
  userId: string;
}): Promise<{ moved: boolean; newColumnId?: string; newColumnName?: string }> {
  const { boardItemId, currentColumnId, currentColumnName, boardId, metadata, userId } = params;

  const colNameLower = currentColumnName.toLowerCase();

  let targetColumnName: string | null = null;

  // PGT Team → Flyer Team (or QA if GIF URL already set from a previous cycle)
  if (colNameLower === 'pgt team') {
    const captionStatus = (metadata.otpPtrCaptionStatus as string) ?? '';
    if (captionStatus === 'AWAITING_APPROVAL' || captionStatus === 'APPROVED') {
      const gifUrl = (metadata.gifUrl as string) ?? '';
      const gifUrlFansly = (metadata.gifUrlFansly as string) ?? '';
      const platforms = Array.isArray(metadata.platforms) ? (metadata.platforms as string[]) : [];
      const hasFansly = platforms.includes('fansly');
      // If the flyer was already completed in a previous cycle, go straight to QA
      const gifAlreadyReady = gifUrl.trim() && (!hasFansly || gifUrlFansly.trim());
      targetColumnName = gifAlreadyReady ? 'QA' : 'Flyer Team';
    }
  }

  // Flyer Team → QA when all required GIF URLs are populated
  if (colNameLower === 'flyer team') {
    const gifUrl = (metadata.gifUrl as string) ?? '';
    const gifUrlFansly = (metadata.gifUrlFansly as string) ?? '';
    const platforms = Array.isArray(metadata.platforms) ? (metadata.platforms as string[]) : [];
    const hasFansly = platforms.includes('fansly');
    // OF gifUrl is always required; Fansly gifUrl required only when fansly platform is selected
    if (gifUrl.trim() && (!hasFansly || gifUrlFansly.trim())) {
      targetColumnName = 'QA';
    }
  }

  if (!targetColumnName) return { moved: false };

  try {
    const targetColumn = await prisma.boardColumn.findFirst({
      where: {
        boardId,
        name: { equals: targetColumnName, mode: 'insensitive' },
      },
      select: { id: true, name: true },
    });

    if (!targetColumn || targetColumn.id === currentColumnId) {
      return { moved: false };
    }

    await prisma.boardItem.update({
      where: { id: boardItemId },
      data: { columnId: targetColumn.id, updatedAt: new Date() },
    });

    // Record column move in history
    await prisma.boardItemHistory.create({
      data: {
        itemId: boardItemId,
        userId,
        action: 'updated',
        field: 'columnId',
        oldValue: currentColumnName,
        newValue: targetColumn.name,
      },
    });

    // Broadcast so the board UI updates in real-time
    await broadcastToBoard(boardId, boardItemId);

    return { moved: true, newColumnId: targetColumn.id, newColumnName: targetColumn.name };
  } catch (e) {
    console.error('[auto-column-move] Failed:', e);
    return { moved: false };
  }
}
