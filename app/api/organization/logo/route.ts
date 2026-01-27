import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// POST - Upload organization logo (OWNER/ADMIN only)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        currentOrganizationId: true,
      },
    });

    if (!user?.currentOrganizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 404 }
      );
    }

    // Check if user has permission (OWNER or ADMIN)
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: user.currentOrganizationId,
        },
      },
      select: {
        role: true,
      },
    });

    if (!teamMember || (teamMember.role !== 'OWNER' && teamMember.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'You do not have permission to update organization logo' },
        { status: 403 }
      );
    }

    // Get the file from the request
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Get existing organization to delete old logo if exists
    const existingOrg = await prisma.organization.findUnique({
      where: { id: user.currentOrganizationId },
      select: { logoUrl: true },
    });

    // Upload to Cloudinary
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'organization-logos',
          resource_type: 'image',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'center' },
            { quality: 'auto:good' },
            { fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    // Delete old logo from Cloudinary if exists
    if (existingOrg?.logoUrl) {
      try {
        const publicId = existingOrg.logoUrl.split('/').pop()?.split('.')[0];
        if (publicId) {
          await cloudinary.uploader.destroy(`organization-logos/${publicId}`);
        }
      } catch (error) {
        console.error('Error deleting old logo:', error);
      }
    }

    // Update organization with new logo URL
    const updatedOrganization = await prisma.organization.update({
      where: { id: user.currentOrganizationId },
      data: {
        logoUrl: uploadResult.secure_url,
      },
      include: {
        members: {
          orderBy: [
            { role: 'asc' },
            { joinedAt: 'asc' },
          ],
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      organization: {
        ...updatedOrganization,
        memberRole: teamMember.role,
        canManage: true,
      },
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    return NextResponse.json(
      { error: 'Failed to upload logo' },
      { status: 500 }
    );
  }
}

// DELETE - Delete organization logo (OWNER/ADMIN only)
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        currentOrganizationId: true,
      },
    });

    if (!user?.currentOrganizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 404 }
      );
    }

    // Check if user has permission (OWNER or ADMIN)
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: user.currentOrganizationId,
        },
      },
      select: {
        role: true,
      },
    });

    if (!teamMember || (teamMember.role !== 'OWNER' && teamMember.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'You do not have permission to delete organization logo' },
        { status: 403 }
      );
    }

    // Get existing organization
    const existingOrg = await prisma.organization.findUnique({
      where: { id: user.currentOrganizationId },
      select: { logoUrl: true },
    });

    // Delete logo from Cloudinary if exists
    if (existingOrg?.logoUrl) {
      try {
        const publicId = existingOrg.logoUrl.split('/').pop()?.split('.')[0];
        if (publicId) {
          await cloudinary.uploader.destroy(`organization-logos/${publicId}`);
        }
      } catch (error) {
        console.error('Error deleting logo from Cloudinary:', error);
      }
    }

    // Update organization to remove logo URL
    const updatedOrganization = await prisma.organization.update({
      where: { id: user.currentOrganizationId },
      data: {
        logoUrl: null,
      },
      include: {
        members: {
          orderBy: [
            { role: 'asc' },
            { joinedAt: 'asc' },
          ],
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      organization: {
        ...updatedOrganization,
        memberRole: teamMember.role,
        canManage: true,
      },
    });
  } catch (error) {
    console.error('Error deleting logo:', error);
    return NextResponse.json(
      { error: 'Failed to delete logo' },
      { status: 500 }
    );
  }
}
