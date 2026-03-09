import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/database';
import { publishBoardEvent } from '@/lib/ably';
import { MODEL_ONBOARDING_METADATA_DEFAULTS, getDefaultChecklist } from '@/lib/spaces/template-metadata';

type Params = { params: Promise<{ spaceId: string }> };

/** Coerce any value to a string for storage in fields */
function toStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

/** Keys to exclude from dynamic fields (used as top-level control props) */
const RESERVED_KEYS = new Set([
  'title', 'fields', 'modelName', 'platform', 'socialHandles',
  'notes', 'tags', 'priority', 'description',
]);

/* ------------------------------------------------------------------ */
/*  POST /api/spaces/:spaceId/webhook/onboarding                      */
/*  Inbound webhook — creates a MODEL_ONBOARDING board item           */
/*  Authenticated via x-webhook-secret header (no Clerk auth)          */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { spaceId } = await params;
    const secret = req.headers.get('x-webhook-secret');

    if (!secret) {
      return NextResponse.json({ error: 'Missing x-webhook-secret header' }, { status: 401 });
    }

    // Fetch workspace with first board + first column
    const workspace = await prisma.workspace.findUnique({
      where: { id: spaceId },
      select: {
        id: true,
        organizationId: true,
        templateType: true,
        key: true,
        slug: true,
        config: true,
        isActive: true,
        organization: { select: { slug: true } },
        boards: {
          orderBy: { position: 'asc' },
          take: 1,
          include: {
            columns: {
              orderBy: { position: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!workspace || !workspace.isActive) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (workspace.templateType !== 'MODEL_ONBOARDING') {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const config = (workspace.config as Record<string, unknown>) ?? {};
    const webhookConfig = (config.webhook as Record<string, unknown>) ?? {};

    if (!webhookConfig.enabled) {
      return NextResponse.json({ error: 'Webhook is disabled for this space' }, { status: 403 });
    }

    const storedSecret = webhookConfig.secret as string | undefined;
    if (!storedSecret) {
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 403 });
    }

    // Timing-safe comparison
    const secretBuffer = Buffer.from(secret);
    const storedBuffer = Buffer.from(storedSecret);
    if (secretBuffer.length !== storedBuffer.length || !crypto.timingSafeEqual(secretBuffer, storedBuffer)) {
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
    }

    // Parse body — handle array wrapper, nested data/body keys from n8n
    let raw = await req.json().catch(() => null);
    if (!raw) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // n8n may send an array of items — take the first one
    if (Array.isArray(raw)) raw = raw[0];

    // n8n may nest inside "data", "body", "json", or "row" keys
    const body: Record<string, unknown> =
      (raw.json && typeof raw.json === 'object' && !Array.isArray(raw.json)) ? raw.json :
      (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) ? raw.data :
      (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body :
      (raw.row && typeof raw.row === 'object' && !Array.isArray(raw.row)) ? raw.row :
      raw;

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Log incoming payload for debugging
    console.log('[webhook] Incoming body keys:', Object.keys(body).slice(0, 15), '... total:', Object.keys(body).length);
    console.log('[webhook] body.fields type:', typeof body.fields, '| is array:', Array.isArray(body.fields), '| value:', JSON.stringify(body.fields).slice(0, 300));

    // Support both nested { title, fields: {...} } and flat { "Full Name": "...", ... }
    let dynamicFields: Record<string, string> = {};

    // Resolve fields — may be an object or a JSON string (n8n sends stringified JSON)
    let fieldsObj: Record<string, unknown> | null = null;
    if (body.fields) {
      if (typeof body.fields === 'string') {
        try { fieldsObj = JSON.parse(body.fields); } catch { fieldsObj = null; }
      } else if (typeof body.fields === 'object' && !Array.isArray(body.fields)) {
        fieldsObj = body.fields as Record<string, unknown>;
      }
    }

    // Preserve original key order from the source (Google Sheet column order)
    const fieldOrder: string[] = [];

    if (fieldsObj && typeof fieldsObj === 'object') {
      for (const [k, v] of Object.entries(fieldsObj)) {
        dynamicFields[k] = toStr(v);
        fieldOrder.push(k);
      }
    } else {
      // Flat format: all non-reserved keys become fields
      for (const [k, v] of Object.entries(body)) {
        if (!RESERVED_KEYS.has(k)) {
          dynamicFields[k] = toStr(v);
          fieldOrder.push(k);
        }
      }
    }

    // Derive title — explicit title field, or "Full Name", or "Model Name"
    const title = (typeof body.title === 'string' && body.title.trim())
      ? body.title.trim()
      : dynamicFields['Full Name']
        || dynamicFields['Model Name? (if different from legal name)']
        || null;

    if (!title) {
      return NextResponse.json({ error: 'title is required (or include "Full Name" in fields)' }, { status: 400 });
    }

    // Auto-extract modelName from common field names
    const modelName = toStr(body.modelName)
      || dynamicFields['Model Name? (if different from legal name)']
      || dynamicFields['Full Name']
      || '';

    const platform = toStr(body.platform)
      || dynamicFields['Platform']
      || '';

    // Get first board + first column
    const board = workspace.boards[0];
    if (!board || board.columns.length === 0) {
      return NextResponse.json({ error: 'Space has no board or columns configured' }, { status: 500 });
    }
    const column = board.columns[0];

    // Build metadata
    const metadata = {
      ...MODEL_ONBOARDING_METADATA_DEFAULTS,
      checklist: getDefaultChecklist(config),
      modelName,
      platform,
      socialHandles: Array.isArray(body.socialHandles) ? body.socialHandles : [],
      notes: toStr(body.notes),
      tags: Array.isArray(body.tags) ? body.tags : [],
      fields: dynamicFields,
      fieldOrder,
      source: 'webhook',
    };

    // Retry loop — each attempt re-reads max itemNo outside snapshot isolation
    let item;
    let nextItemNo = 0;
    const MAX_RETRIES = 5;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Fresh read each attempt (no transaction snapshot caching)
      const maxItem = await prisma.boardItem.findFirst({
        where: { organizationId: workspace.organizationId },
        orderBy: { itemNo: 'desc' },
        select: { itemNo: true },
      });
      nextItemNo = (maxItem?.itemNo ?? 0) + 1 + attempt; // offset by attempt to avoid same collision

      try {
        item = await prisma.boardItem.create({
          data: {
            organizationId: workspace.organizationId,
            itemNo: nextItemNo,
            columnId: column.id,
            title,
            description: typeof body.description === 'string' ? body.description.trim() : null,
            type: 'TASK',
            priority: 'MEDIUM',
            position: 0,
            metadata: metadata as any,
            createdBy: 'webhook',
          },
        });
        break; // success
      } catch (err: unknown) {
        const isP2002 = err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002';
        if (isP2002 && attempt < MAX_RETRIES - 1) continue;
        throw err;
      }
    }

    if (!item) {
      return NextResponse.json({ error: 'Failed to create task after retries' }, { status: 500 });
    }

    // Record creation in history
    await prisma.boardItemHistory.create({
      data: {
        itemId: item.id,
        userId: 'webhook',
        action: 'CREATED',
        field: 'item',
        newValue: item.title,
      },
    });

    // Publish real-time event
    try {
      publishBoardEvent(board.id, 'item.created', {
        userId: 'webhook',
        entityId: item.id,
      });
    } catch (_) {
      // Ably not configured — skip
    }

    const taskKey = workspace.key
      ? `${workspace.key}-${nextItemNo}`.toLowerCase()
      : undefined;

    const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const orgSlug = workspace.organization?.slug;
    const taskUrl = orgSlug && taskKey
      ? `${baseUrl}/${orgSlug}/spaces/${workspace.slug}?task=${taskKey}`
      : undefined;

    return NextResponse.json(
      { success: true, id: item.id, taskKey, itemNo: nextItemNo, taskUrl },
      { status: 201 },
    );
  } catch (error: unknown) {
    const errObj = error && typeof error === 'object' ? error as Record<string, unknown> : {};
    console.error('Error processing onboarding webhook:', {
      message: errObj.message ?? error,
      code: errObj.code,
      meta: errObj.meta,
    });
    const detail = errObj.code === 'P2002'
      ? 'Duplicate item number conflict — please retry'
      : 'Internal server error';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
