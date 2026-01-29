import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { requireOrganizationAdmin } from '@/lib/organizationAuth';

// Force Node.js runtime
export const runtime = 'nodejs';

// GET - Fetch all production entries for the organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenant } = await params;

    // Check organization admin access
    await requireOrganizationAdmin(tenant);

    // Get organization by slug
    const organization = await prisma.organization.findUnique({
      where: { slug: tenant },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Fetch production entries for organization members only
    const entries = await prisma.productionEntry.findMany({
      where: {
        user: {
          teamMemberships: {
            some: {
              organizationId: organization.id,
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(entries);
  } catch (error: any) {
    console.error('Error fetching production entries:', error);

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch production entries' },
      { status: 500 }
    );
  }
}

// POST - Create a new production entry
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenant } = await params;

    // Check organization admin access
    await requireOrganizationAdmin(tenant);

    // Get organization by slug
    const organization = await prisma.organization.findUnique({
      where: { slug: tenant },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await req.json();
    const {
      deadline,
      assignee,
      influencer,
      instagramSource,
      loraModel,
      imagesTarget,
      videosTarget,
      notes
    } = body;

    // Determine initial status
    const status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' = 'PENDING';

    // Generate automatic notes if none provided
    const finalNotes = notes || `Production scheduled: ${imagesTarget} images, ${videosTarget} videos for ${influencer}`;

    const entry = await prisma.productionEntry.create({
      data: {
        clerkId: userId,
        deadline: new Date(deadline),
        assignee,
        influencer,
        instagramSource,
        loraModel,
        status,
        imagesTarget: parseInt(imagesTarget),
        imagesGenerated: 0,
        videosTarget: parseInt(videosTarget),
        videosGenerated: 0,
        notes: finalNotes,
      }
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error: any) {
    console.error('Error creating production entry:', error);

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to create production entry' },
      { status: 500 }
    );
  }
}
