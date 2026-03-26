import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAdminAccess } from '@/lib/adminAuth';
import { prisma } from '@/lib/database';
import { currentUser } from '@clerk/nextjs/server';

/**
 * GET /api/admin/models/model-presets
 * List all model presets for the current admin
 */
export async function GET() {
  try {
    await requireOrgAdminAccess();

    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const presets = await prisma.modelPreset.findMany({
      where: { createdBy: user.id },
      include: {
        members: {
          select: { profileId: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formatted = presets.map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      profileIds: p.members.map((m) => m.profileId),
    }));

    return NextResponse.json({
      success: true,
      data: { presets: formatted },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching model presets:', message);

    if (message.includes('Unauthorized') || message.includes('Forbidden')) {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch model presets' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/models/model-presets
 * Create a new model preset
 */
export async function POST(request: NextRequest) {
  try {
    await requireOrgAdminAccess();

    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const obj = body as Record<string, unknown>;
    if (
      !body ||
      typeof body !== 'object' ||
      typeof obj.name !== 'string' ||
      obj.name === '' ||
      !Array.isArray(obj.profileIds) ||
      obj.profileIds.length === 0 ||
      obj.profileIds.length > 200 ||
      !obj.profileIds.every((id: unknown) => typeof id === 'string' && id.length > 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input. Expected name (non-empty string) and profileIds (non-empty array of strings, max 200).',
        },
        { status: 400 }
      );
    }

    const { name, profileIds } = body as { name: string; profileIds: string[] };
    const trimmedName = name.trim().slice(0, 100);

    // Check for duplicate name
    const existing = await prisma.modelPreset.findFirst({
      where: { createdBy: user.id, name: trimmedName },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `A preset named "${trimmedName}" already exists` },
        { status: 409 }
      );
    }

    const preset = await prisma.$transaction(async (tx) => {
      const created = await tx.modelPreset.create({
        data: {
          name: trimmedName,
          createdBy: user.id,
        },
      });

      await tx.modelPresetMember.createMany({
        data: profileIds.map((profileId) => ({
          presetId: created.id,
          profileId,
        })),
        skipDuplicates: true,
      });

      return created;
    });

    console.log(
      `[model-presets] Admin ${user.id} created preset "${trimmedName}" with ${profileIds.length} models`
    );

    return NextResponse.json({
      success: true,
      data: {
        id: preset.id,
        name: preset.name,
        profileIds,
      },
      message: `Preset "${trimmedName}" created with ${profileIds.length} model(s)`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating model preset:', message);

    if (message.includes('Unauthorized') || message.includes('Forbidden')) {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create model preset' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/models/model-presets
 * Delete a model preset by id
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireOrgAdminAccess();

    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== 'object' ||
      typeof (body as Record<string, unknown>).presetId !== 'string'
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid input. Expected presetId as string.' },
        { status: 400 }
      );
    }

    const { presetId } = body as { presetId: string };

    const preset = await prisma.modelPreset.findFirst({
      where: { id: presetId, createdBy: user.id },
    });

    if (!preset) {
      return NextResponse.json(
        { success: false, error: 'Preset not found' },
        { status: 404 }
      );
    }

    await prisma.modelPreset.delete({ where: { id: presetId } });

    console.log(`[model-presets] Admin ${user.id} deleted preset "${preset.name}"`);

    return NextResponse.json({
      success: true,
      message: `Preset "${preset.name}" deleted`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting model preset:', message);

    if (message.includes('Unauthorized') || message.includes('Forbidden')) {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete model preset' },
      { status: 500 }
    );
  }
}
