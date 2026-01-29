import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { requireOrganizationAdmin } from '@/lib/organizationAuth';

// Force Node.js runtime
export const runtime = 'nodejs';

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

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { slug: tenant },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Fetch all organization members
    // In tenant context, all members can potentially be assigned production tasks
    const members = await prisma.teamMember.findMany({
      where: {
        organizationId: organization.id,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        user: {
          firstName: 'asc',
        },
      },
    });

    // Map to match the expected format
    const contentCreators = members.map(member => ({
      id: member.user.id,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      email: member.user.email,
      role: member.user.role,
    }));

    return NextResponse.json(contentCreators);
  } catch (error: any) {
    console.error('Error fetching content creators:', error);

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch content creators' },
      { status: 500 }
    );
  }
}
