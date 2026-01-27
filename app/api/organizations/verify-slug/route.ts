import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET - Verify user has access to organization by slug
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    // Get user's database record
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        currentOrganizationId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find the organization by slug
    const organization = await prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    });

    if (!organization) {
      // Check if this might be a personal workspace slug
      // Return 404 so the frontend can handle it appropriately
      return NextResponse.json({
        error: 'Organization not found',
        isPersonalWorkspace: slug === user?.id || slug === 'personal'
      }, { status: 404 });
    }

    // Check if user is a member of this organization
    const membership = await prisma.teamMember.findFirst({
      where: {
        userId: user.id,
        organizationId: organization.id,
      },
      select: {
        role: true,
      },
    });

    if (!membership) {
      // User is not a member - redirect to their current org or dashboard
      if (user.currentOrganizationId) {
        const currentOrg = await prisma.organization.findUnique({
          where: { id: user.currentOrganizationId },
          select: { slug: true },
        });

        return NextResponse.json({
          hasAccess: false,
          redirectSlug: currentOrg?.slug || null,
        });
      }

      return NextResponse.json({ hasAccess: false });
    }

    // User has access
    return NextResponse.json({
      hasAccess: true,
      organization: {
        id: organization.id,
        slug: organization.slug,
        name: organization.name,
      },
      role: membership.role,
    });
  } catch (error) {
    console.error('Error verifying organization slug:', error);
    return NextResponse.json(
      { error: 'Failed to verify organization access' },
      { status: 500 }
    );
  }
}
