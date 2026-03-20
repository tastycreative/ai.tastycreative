import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

function extractS3Key(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Strip the leading slash from the pathname to get the S3 key
    return parsed.pathname.replace(/^\//, "");
  } catch {
    return null;
  }
}

// GET - Fetch voice sales with stats
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve org from DB (Clerk's orgId is often null)
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });
    const organizationId = dbUser?.currentOrganizationId ?? null;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const saleType = searchParams.get("saleType");

    const where: Record<string, unknown> = { userId };
    if (organizationId) where.organizationId = organizationId;
    if (saleType && saleType !== "all") where.saleType = saleType;

    const [sales, stats] = await Promise.all([
      prisma.ai_voice_sales.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          generation: {
            select: {
              id: true,
              voiceName: true,
              voiceAccountId: true,
              characterCount: true,
            },
          },
        },
      }),
      // Aggregate stats
      prisma.ai_voice_sales.aggregate({
        where: { userId, ...(organizationId ? { organizationId } : {}) },
        _sum: { amount: true, netEarned: true },
        _count: true,
        _avg: { amount: true },
      }),
    ]);

    // Get this month's stats
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthStats = await prisma.ai_voice_sales.aggregate({
      where: {
        userId,
        ...(organizationId ? { organizationId } : {}),
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true, netEarned: true },
      _count: true,
    });

    // Get top chatter this month (user-scoped for personal stats)
    const topChatters = await prisma.ai_voice_sales.groupBy({
      by: ["chatter"],
      where: {
        userId,
        ...(organizationId ? { organizationId } : {}),
        createdAt: { gte: startOfMonth },
      },
      _sum: { netEarned: true },
      _count: true,
      orderBy: { _sum: { netEarned: "desc" } },
      take: 5,
    });

    // Global leaderboard: all chatters in this org this month (no userId filter)
    const globalTopChatters = await prisma.ai_voice_sales.groupBy({
      by: ["chatter"],
      where: {
        ...(organizationId ? { organizationId } : { userId }),
        createdAt: { gte: startOfMonth },
      },
      _sum: { netEarned: true, amount: true },
      _count: true,
      orderBy: { _sum: { netEarned: "desc" } },
      take: 10,
    });

    return NextResponse.json({
      sales,
      stats: {
        totalRevenue: stats._sum.amount || 0,
        totalNet: stats._sum.netEarned || 0,
        totalCount: stats._count,
        avgPerSale: stats._avg.amount || 0,
        monthRevenue: monthStats._sum.amount || 0,
        monthNet: monthStats._sum.netEarned || 0,
        monthCount: monthStats._count,
        topChatters: topChatters.map((c) => ({
          chatter: c.chatter,
          totalNet: c._sum.netEarned || 0,
          salesCount: c._count,
        })),
        globalTopChatters: globalTopChatters.map((c) => ({
          chatter: c.chatter,
          totalNet: c._sum.netEarned || 0,
          totalRevenue: c._sum.amount || 0,
          salesCount: c._count,
        })),
        isOrgScoped: !!organizationId,
      },
    });
  } catch (error) {
    console.error("Failed to fetch voice sales:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales" },
      { status: 500 }
    );
  }
}

// POST - Create a new voice sale
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve user's display name + org from DB
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { name: true, firstName: true, lastName: true, username: true, email: true, currentOrganizationId: true },
    });
    const chatter =
      dbUser?.username ||
      dbUser?.name ||
      (dbUser?.firstName && dbUser?.lastName ? `${dbUser.firstName} ${dbUser.lastName}` : null) ||
      dbUser?.firstName ||
      dbUser?.email ||
      userId;
    const organizationId = dbUser?.currentOrganizationId ?? null;

    const body = await request.json();
    const {
      fanUsername,
      saleType,
      amount,
      platformCut,
      voiceClipId,
      notes,
      screenshotUrl,
    } = body;

    if (!fanUsername || !saleType || amount == null) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || amount < 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    const cut = typeof platformCut === "number" ? platformCut : 20;
    const netEarned = amount * (1 - cut / 100);

    // If voiceClipId provided, verify it belongs to this user
    if (voiceClipId) {
      const generation = await prisma.ai_voice_generations.findFirst({
        where: { id: voiceClipId, userId },
      });
      if (!generation) {
        return NextResponse.json(
          { error: "Voice clip not found" },
          { status: 404 }
        );
      }
    }

    const sale = await prisma.ai_voice_sales.create({
      data: {
        userId,
        organizationId,
        chatter,
        fanUsername,
        saleType,
        amount,
        platformCut: cut,
        netEarned,
        voiceClipId: voiceClipId || null,
        notes: notes || null,
        screenshotUrl: screenshotUrl || null,
      },
      include: {
        generation: {
          select: {
            id: true,
            voiceName: true,
            voiceAccountId: true,
            characterCount: true,
          },
        },
      },
    });

    return NextResponse.json({ sale });
  } catch (error) {
    console.error("Failed to create voice sale:", error);
    return NextResponse.json(
      { error: "Failed to create sale" },
      { status: 500 }
    );
  }
}

// PATCH - Update a voice sale
export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, saleType, amount, platformCut, notes } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing sale ID" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.ai_voice_sales.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    const cut = typeof platformCut === "number" ? platformCut : existing.platformCut;
    const amt = typeof amount === "number" ? amount : existing.amount;
    const netEarned = amt * (1 - cut / 100);

    const updated = await prisma.ai_voice_sales.update({
      where: { id },
      data: {
        ...(saleType ? { saleType } : {}),
        ...(typeof amount === "number" ? { amount: amt, netEarned } : {}),
        ...(typeof platformCut === "number" ? { platformCut: cut } : {}),
        notes: notes !== undefined ? (notes || null) : existing.notes,
      },
      include: {
        generation: {
          select: {
            id: true,
            voiceName: true,
            voiceAccountId: true,
            characterCount: true,
          },
        },
      },
    });

    return NextResponse.json({ sale: updated });
  } catch (error) {
    console.error("Failed to update voice sale:", error);
    return NextResponse.json(
      { error: "Failed to update sale" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a voice sale
export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing sale ID" },
        { status: 400 }
      );
    }

    // Verify ownership
    const sale = await prisma.ai_voice_sales.findFirst({
      where: { id, userId },
    });

    if (!sale) {
      return NextResponse.json(
        { error: "Sale not found" },
        { status: 404 }
      );
    }

    await prisma.ai_voice_sales.delete({ where: { id } });

    // Delete screenshot from S3 if one exists
    if (sale.screenshotUrl) {
      const key = extractS3Key(sale.screenshotUrl);
      if (key) {
        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: process.env.AWS_S3_BUCKET || "tastycreative",
              Key: key,
            })
          );
        } catch (s3Err) {
          // Log but don't fail the request — the DB row is already gone
          console.error("Failed to delete screenshot from S3:", s3Err);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete voice sale:", error);
    return NextResponse.json(
      { error: "Failed to delete sale" },
      { status: 500 }
    );
  }
}
