import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireOrganizationAdmin } from '@/lib/organizationAuth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
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

    // Fetch statistics filtered by organization
    const [
      totalUsers,
      activeJobs,
      totalImages,
      totalVideos,
    ] = await Promise.all([
      // Count organization members
      prisma.teamMember.count({
        where: { organizationId: organization.id },
      }),
      // Count active jobs for organization members
      prisma.generationJob.count({
        where: {
          status: {
            in: ['PENDING', 'PROCESSING']
          },
          user: {
            teamMemberships: {
              some: {
                organizationId: organization.id,
              },
            },
          },
        }
      }),
      // Count images created by organization members
      prisma.generatedImage.count({
        where: {
          user: {
            teamMemberships: {
              some: {
                organizationId: organization.id,
              },
            },
          },
        },
      }),
      // Count videos created by organization members
      prisma.generatedVideo.count({
        where: {
          user: {
            teamMemberships: {
              some: {
                organizationId: organization.id,
              },
            },
          },
        },
      }),
    ]);

    // Calculate total content
    const totalContent = totalImages + totalVideos;

    // Calculate storage used by organization
    const imageData = await prisma.generatedImage.aggregate({
      where: {
        user: {
          teamMembers: {
            some: {
              organizationId: organization.id,
            },
          },
        },
      },
      _sum: {
        fileSize: true,
      },
    });

    const videoData = await prisma.generatedVideo.aggregate({
      where: {
        user: {
          teamMembers: {
            some: {
              organizationId: organization.id,
            },
          },
        },
      },
      _sum: {
        fileSize: true,
      },
    });

    const totalBytes = (imageData._sum.fileSize || 0) + (videoData._sum.fileSize || 0);
    const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);

    const stats = {
      totalUsers,
      activeJobs,
      totalContent,
      storageUsed: `${totalGB} GB`,
    };

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Error fetching organization stats:', error);

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch organization stats' },
      { status: 500 }
    );
  }
}
