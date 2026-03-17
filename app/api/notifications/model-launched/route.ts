import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sendModelLaunchNotification } from '@/lib/model-launch-notification';

/**
 * POST /api/notifications/model-launched
 * Fire-and-forget notification to all org members when a model is launched.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { modelName, profileId, organizationId } = await request.json();

    if (!modelName || !profileId || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields: modelName, profileId, organizationId' },
        { status: 400 },
      );
    }

    // Send notification in background — don't block the response
    sendModelLaunchNotification({
      modelName,
      profileId,
      launchedByClerkId: userId,
      organizationId,
    }).catch((e) => console.error('[model-launched] notification failed:', e));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[model-launched] route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
