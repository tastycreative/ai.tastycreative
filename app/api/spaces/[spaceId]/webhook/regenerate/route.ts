import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import crypto from 'crypto';
import { prisma } from '@/lib/database';

type Params = { params: Promise<{ spaceId: string }> };

/* ------------------------------------------------------------------ */
/*  POST /api/spaces/:spaceId/webhook/regenerate                       */
/*  Generates a new webhook secret for the space                       */
/* ------------------------------------------------------------------ */

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { spaceId } = await params;

    // Resolve internal user
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: spaceId },
      select: { organizationId: true, templateType: true, config: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    // Only MODEL_ONBOARDING spaces support webhooks
    if (workspace.templateType !== 'MODEL_ONBOARDING') {
      return NextResponse.json(
        { error: 'Webhooks are only available for Model Onboarding spaces' },
        { status: 400 },
      );
    }

    // Check OWNER or ADMIN role at space or org level
    const spaceMembership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: spaceId,
        userId: user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    const orgMembership = await prisma.teamMember.findFirst({
      where: {
        organizationId: workspace.organizationId,
        userId: user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!spaceMembership && !orgMembership) {
      return NextResponse.json(
        { error: 'You do not have permission to manage webhooks for this space' },
        { status: 403 },
      );
    }

    // Generate new secret
    const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;

    // Merge into existing config
    const currentConfig = (workspace.config as Record<string, unknown>) ?? {};
    const mergedConfig = {
      ...currentConfig,
      webhook: {
        ...((currentConfig.webhook as Record<string, unknown>) ?? {}),
        secret,
      },
    };

    await prisma.workspace.update({
      where: { id: spaceId },
      data: { config: mergedConfig },
    });

    return NextResponse.json({ secret });
  } catch (error) {
    console.error('Error regenerating webhook secret:', error);
    return NextResponse.json({ error: 'Failed to regenerate webhook secret' }, { status: 500 });
  }
}
