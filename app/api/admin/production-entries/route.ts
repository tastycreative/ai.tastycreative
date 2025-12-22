import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

// GET - Fetch all production entries for the user
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify that the requesting user is an admin
    const requestingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }
    });

    if (!requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Fetch all production entries (admins can see all)
    const entries = await prisma.productionEntry.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching production entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch production entries' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST - Create a new production entry
export async function POST(request: Request) {
  try {
    console.log('POST /api/admin/production-entries called');
    const { userId } = await auth();
    console.log('User ID from auth:', userId);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify that the requesting user is an admin
    const requestingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }
    });

    console.log('Requesting user:', requestingUser);

    if (!requestingUser || requestingUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    console.log('Request body:', body);
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

    // Determine initial status based on targets
    const status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' = 'PENDING';
    if (!notes) {
      // Generate automatic notes if none provided
      const autoNotes = `Production scheduled: ${imagesTarget} images, ${videosTarget} videos for ${influencer}`;
      body.notes = autoNotes;
    }

    console.log('Creating production entry with data:', {
      clerkId: userId,
      deadline: new Date(deadline),
      assignee,
      influencer,
      instagramSource,
      loraModel,
      status,
      imagesTarget: parseInt(imagesTarget),
      videosTarget: parseInt(videosTarget),
    });

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
        notes: notes || body.notes,
      }
    });

    console.log('Created production entry:', entry);

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Error creating production entry:', error);
    return NextResponse.json(
      { error: 'Failed to create production entry' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}