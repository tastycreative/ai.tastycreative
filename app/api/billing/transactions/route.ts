import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    if (!user || !user.currentOrganizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    // Get filter parameters from query string
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const where: any = {
      organizationId: user.currentOrganizationId,
    };

    // Type filter
    if (type && type !== 'all') {
      if (type === 'subscription') {
        where.type = 'SUBSCRIPTION_PAYMENT';
      } else if (type === 'credits') {
        where.type = 'CREDIT_PURCHASE';
      }
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Fetch transactions
    const transactions = await prisma.billingTransaction.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Increased limit
    });

    // Client-side search filter (for searching across multiple fields)
    let filteredTransactions = transactions;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTransactions = transactions.filter(t =>
        t.description.toLowerCase().includes(searchLower) ||
        t.planName?.toLowerCase().includes(searchLower) ||
        t.user?.firstName?.toLowerCase().includes(searchLower) ||
        t.user?.lastName?.toLowerCase().includes(searchLower) ||
        t.user?.email?.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({ transactions: filteredTransactions });
  } catch (error: unknown) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
