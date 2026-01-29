import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireOrganizationAdmin } from '@/lib/organizationAuth';

// GET - Fetch all marketplace models for the organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant } = await params;

    // Check organization admin access
    await requireOrganizationAdmin(tenant);

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { slug: tenant },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Fetch marketplace models for this organization (or unassigned models)
    const models = await prisma.marketplaceModel.findMany({
      where: {
        OR: [
          { organizationId: organization.id },
          { organizationId: null }, // Include legacy models without organization
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform status to lowercase for frontend
    const transformedModels = models.map(model => ({
      ...model,
      status: model.status.toLowerCase(),
    }));

    return NextResponse.json(transformedModels);
  } catch (error: any) {
    console.error('Error fetching marketplace models:', error);

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}

// POST - Create a new marketplace model
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant } = await params;

    // Check organization admin access
    await requireOrganizationAdmin(tenant);

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { slug: tenant },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      price,
      status,
      imageUrl,
      category,
      gallery,
      description,
      included,
      usedFor,
    } = body;

    const model = await prisma.marketplaceModel.create({
      data: {
        name,
        price: parseFloat(price),
        status: status.toUpperCase(),
        imageUrl,
        category,
        gallery: gallery || [],
        description,
        included: included || [],
        usedFor: usedFor || [],
        organizationId: organization.id,
      },
    });

    return NextResponse.json(model, { status: 201 });
  } catch (error: any) {
    console.error('Error creating marketplace model:', error);

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to create model' },
      { status: 500 }
    );
  }
}

// PUT - Update an existing marketplace model
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant } = await params;

    // Check organization admin access
    await requireOrganizationAdmin(tenant);

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { slug: tenant },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await req.json();
    const {
      id,
      name,
      price,
      status,
      imageUrl,
      category,
      gallery,
      description,
      included,
      usedFor,
    } = body;

    // Verify the model belongs to this organization
    const existingModel = await prisma.marketplaceModel.findFirst({
      where: {
        id,
        organizationId: organization.id,
      },
    });

    if (!existingModel) {
      return NextResponse.json(
        { error: 'Model not found or access denied' },
        { status: 404 }
      );
    }

    const model = await prisma.marketplaceModel.update({
      where: { id },
      data: {
        name,
        price: parseFloat(price),
        status: status.toUpperCase(),
        imageUrl,
        category,
        gallery: gallery || [],
        description,
        included: included || [],
        usedFor: usedFor || [],
      },
    });

    return NextResponse.json(model);
  } catch (error: any) {
    console.error('Error updating marketplace model:', error);

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to update model' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a marketplace model
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant } = await params;

    // Check organization admin access
    await requireOrganizationAdmin(tenant);

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { slug: tenant },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Model ID is required' },
        { status: 400 }
      );
    }

    // Verify the model belongs to this organization
    const existingModel = await prisma.marketplaceModel.findFirst({
      where: {
        id,
        organizationId: organization.id,
      },
    });

    if (!existingModel) {
      return NextResponse.json(
        { error: 'Model not found or access denied' },
        { status: 404 }
      );
    }

    await prisma.marketplaceModel.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting marketplace model:', error);

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to delete model' },
      { status: 500 }
    );
  }
}
