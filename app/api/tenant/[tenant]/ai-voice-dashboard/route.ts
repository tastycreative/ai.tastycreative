import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { requireOrganizationAdmin } from "@/lib/organizationAuth";

export const runtime = "nodejs";

// GET - Fetch admin dashboard data for AI Voice
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant } = await params;
    await requireOrganizationAdmin(tenant);

    const organization = await prisma.organization.findUnique({
      where: { slug: tenant },
    });
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get all org member clerkIds
    const members = await prisma.teamMember.findMany({
      where: { organizationId: organization.id },
      include: { user: { select: { clerkId: true, name: true, username: true, firstName: true, lastName: true, email: true } } },
    });
    const memberClerkIds = members.map((m) => m.user.clerkId);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    const { searchParams } = new URL(req.url);
    const section = searchParams.get("section") || "overview";

    // Base sales where clause scoped to org
    const orgSalesWhere = {
      organizationId: organization.id,
    };

    if (section === "overview" || section === "all") {
      const [
        totalSalesAgg,
        monthSalesAgg,
        prevMonthSalesAgg,
        totalGenerations,
        weekGenerations,
        salesLinkedToClips,
        pendingSales,
        topVoicesByRevenue,
        recentSales,
        monthlyRevenue,
      ] = await Promise.all([
        // Total revenue
        prisma.ai_voice_sales.aggregate({
          where: orgSalesWhere,
          _sum: { amount: true, netEarned: true },
          _count: true,
        }),
        // This month revenue
        prisma.ai_voice_sales.aggregate({
          where: { ...orgSalesWhere, createdAt: { gte: startOfMonth } },
          _sum: { amount: true, netEarned: true },
          _count: true,
        }),
        // Previous month revenue
        prisma.ai_voice_sales.aggregate({
          where: {
            ...orgSalesWhere,
            createdAt: { gte: startOfPrevMonth, lt: startOfMonth },
          },
          _sum: { amount: true },
          _count: true,
        }),
        // Total voice clips generated
        prisma.ai_voice_generations.count({
          where: { userId: { in: memberClerkIds } },
        }),
        // Week generations
        prisma.ai_voice_generations.count({
          where: { userId: { in: memberClerkIds }, createdAt: { gte: startOfWeek } },
        }),
        // Sales with linked clips
        prisma.ai_voice_sales.count({
          where: { ...orgSalesWhere, voiceClipId: { not: null } },
        }),
        // Pending sales (recent, not yet reviewed — sales without notes containing "approved")
        prisma.ai_voice_sales.count({
          where: {
            ...orgSalesWhere,
            createdAt: { gte: startOfWeek },
          },
        }),
        // Top voices by revenue
        prisma.ai_voice_sales.findMany({
          where: { ...orgSalesWhere, voiceClipId: { not: null } },
          include: {
            generation: { select: { voiceName: true, voiceAccountId: true } },
          },
        }),
        // Recent sales for audit preview
        prisma.ai_voice_sales.findMany({
          where: orgSalesWhere,
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            generation: {
              select: { id: true, voiceName: true, voiceAccountId: true },
            },
          },
        }),
        // Monthly revenue for the last 6 months
        (async () => {
          const months = [];
          for (let i = 5; i >= 0; i--) {
            const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
            const agg = await prisma.ai_voice_sales.aggregate({
              where: {
                ...orgSalesWhere,
                createdAt: { gte: mStart, lt: mEnd },
              },
              _sum: { amount: true },
              _count: true,
            });
            months.push({
              label: mStart.toLocaleString("en", { month: "short" }),
              revenue: agg._sum.amount || 0,
              count: agg._count,
            });
          }
          return months;
        })(),
      ]);

      // Aggregate voice revenue
      const voiceRevenueMap: Record<string, { name: string; revenue: number; uses: number }> = {};
      for (const sale of topVoicesByRevenue) {
        const vName = sale.generation?.voiceName || "Unknown";
        if (!voiceRevenueMap[vName]) {
          voiceRevenueMap[vName] = { name: vName, revenue: 0, uses: 0 };
        }
        voiceRevenueMap[vName].revenue += sale.amount;
        voiceRevenueMap[vName].uses += 1;
      }
      const topVoices = Object.values(voiceRevenueMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Percentage change
      const prevRevenue = prevMonthSalesAgg._sum.amount || 0;
      const currRevenue = monthSalesAgg._sum.amount || 0;
      const revenueChange = prevRevenue > 0
        ? Math.round(((currRevenue - prevRevenue) / prevRevenue) * 100)
        : currRevenue > 0 ? 100 : 0;

      // Active chatters count (unique chatters in org)
      const activeChatters = await prisma.ai_voice_sales.groupBy({
        by: ["chatter"],
        where: orgSalesWhere,
      });

      return NextResponse.json({
        overview: {
          totalRevenue: totalSalesAgg._sum.amount || 0,
          totalNet: totalSalesAgg._sum.netEarned || 0,
          totalSalesCount: totalSalesAgg._count,
          monthRevenue: currRevenue,
          monthNet: monthSalesAgg._sum.netEarned || 0,
          monthSalesCount: monthSalesAgg._count,
          revenueChange,
          activeChattersCount: activeChatters.length,
          totalGenerations,
          weekGenerations,
          salesLinkedToClips,
          conversionRate: totalGenerations > 0
            ? ((salesLinkedToClips / totalGenerations) * 100).toFixed(1)
            : "0",
          pendingSalesCount: pendingSales,
          topVoices,
          recentSales: recentSales.map((s) => ({
            id: s.id,
            chatter: s.chatter,
            fanUsername: s.fanUsername,
            saleType: s.saleType,
            amount: s.amount,
            netEarned: s.netEarned,
            voiceName: s.generation?.voiceName || null,
            generationId: s.generation?.id || null,
            notes: s.notes,
            createdAt: s.createdAt,
          })),
          monthlyRevenue,
        },
      });
    }

    if (section === "revenue") {
      const rangeParam = searchParams.get("range") || "all";
      let rangeCutoff: Date | null = null;
      if (rangeParam === "month") {
        rangeCutoff = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (rangeParam === "30d") {
        rangeCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (rangeParam === "90d") {
        rangeCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      }
      const revWhere = { ...orgSalesWhere, ...(rangeCutoff ? { createdAt: { gte: rangeCutoff } } : {}) };

      // Revenue by sale type
      const revenueBySaleType = await prisma.ai_voice_sales.groupBy({
        by: ["saleType"],
        where: revWhere,
        _sum: { amount: true, netEarned: true },
        _count: true,
      });
      const totalRevenue = revenueBySaleType.reduce((acc, r) => acc + (r._sum.amount || 0), 0);

      // Chatter payouts
      const chatterPayouts = await prisma.ai_voice_sales.groupBy({
        by: ["chatter"],
        where: revWhere,
        _sum: { amount: true, netEarned: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
      });

      // Platform cut
      const totalGross = totalRevenue;
      const totalNet = revenueBySaleType.reduce((acc, r) => acc + (r._sum.netEarned || 0), 0);
      const platformCut = totalGross - totalNet;

      return NextResponse.json({
        revenue: {
          totalGross,
          totalNet,
          platformCut,
          bySaleType: revenueBySaleType.map((r) => ({
            saleType: r.saleType,
            amount: r._sum.amount || 0,
            netEarned: r._sum.netEarned || 0,
            count: r._count,
            percentage: totalRevenue > 0
              ? ((r._sum.amount || 0) / totalRevenue * 100).toFixed(1)
              : "0",
          })),
          chatterPayouts: chatterPayouts.map((c) => ({
            chatter: c.chatter,
            gross: c._sum.amount || 0,
            net: c._sum.netEarned || 0,
            salesCount: c._count,
          })),
        },
      });
    }

    if (section === "chatters") {
      // Get chatters data with their sales info
      const chatterData = await prisma.ai_voice_sales.groupBy({
        by: ["chatter", "userId"],
        where: orgSalesWhere,
        _sum: { amount: true, netEarned: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
      });

      // Get last active time per chatter
      const chatters = await Promise.all(
        chatterData.map(async (c) => {
          const lastSale = await prisma.ai_voice_sales.findFirst({
            where: { ...orgSalesWhere, chatter: c.chatter },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          });

          const member = members.find((m) => m.user.clerkId === c.userId);

          return {
            chatter: c.chatter,
            userId: c.userId,
            displayName: member?.user.name || member?.user.username || c.chatter,
            revenue: c._sum.amount || 0,
            netEarned: c._sum.netEarned || 0,
            salesCount: c._count,
            lastActive: lastSale?.createdAt || null,
          };
        })
      );

      return NextResponse.json({ chatters });
    }

    if (section === "voices") {
      // Voice analytics
      const voiceAccounts = await prisma.ai_voice_accounts.findMany({
        where: { isActive: true },
        select: { id: true, name: true, usageCount: true },
      });

      // Generation counts per voice
      const gensByVoice = await prisma.ai_voice_generations.groupBy({
        by: ["voiceAccountId", "voiceName"],
        where: { userId: { in: memberClerkIds } },
        _count: true,
      });

      // Sales linked per voice
      const salesByVoice = await prisma.ai_voice_sales.findMany({
        where: { ...orgSalesWhere, voiceClipId: { not: null } },
        include: {
          generation: { select: { voiceAccountId: true, voiceName: true } },
        },
      });

      // Aggregate
      const voiceMap: Record<string, {
        name: string;
        totalUses: number;
        salesLinked: number;
        revenueDriven: number;
        topChatter: string;
        topChatterRevenue: number;
      }> = {};

      for (const g of gensByVoice) {
        const name = g.voiceName;
        if (!voiceMap[name]) {
          voiceMap[name] = { name, totalUses: 0, salesLinked: 0, revenueDriven: 0, topChatter: "", topChatterRevenue: 0 };
        }
        voiceMap[name].totalUses += g._count;
      }

      // Track chatter revenue per voice
      const voiceChatterMap: Record<string, Record<string, number>> = {};
      for (const sale of salesByVoice) {
        const vName = sale.generation?.voiceName || "Unknown";
        if (!voiceMap[vName]) {
          voiceMap[vName] = { name: vName, totalUses: 0, salesLinked: 0, revenueDriven: 0, topChatter: "", topChatterRevenue: 0 };
        }
        voiceMap[vName].salesLinked += 1;
        voiceMap[vName].revenueDriven += sale.amount;

        if (!voiceChatterMap[vName]) voiceChatterMap[vName] = {};
        voiceChatterMap[vName][sale.chatter] = (voiceChatterMap[vName][sale.chatter] || 0) + sale.amount;
      }

      // Set top chatter per voice
      for (const [vName, chatters] of Object.entries(voiceChatterMap)) {
        const sorted = Object.entries(chatters).sort((a, b) => b[1] - a[1]);
        if (sorted[0] && voiceMap[vName]) {
          voiceMap[vName].topChatter = sorted[0][0];
          voiceMap[vName].topChatterRevenue = sorted[0][1];
        }
      }

      const voices = Object.values(voiceMap).sort((a, b) => b.revenueDriven - a.revenueDriven);

      // Total stats
      const totalClips = gensByVoice.reduce((acc, g) => acc + g._count, 0);
      const totalLinked = voices.reduce((acc, v) => acc + v.salesLinked, 0);
      const avgCharsPerClip = await prisma.ai_voice_generations.aggregate({
        where: { userId: { in: memberClerkIds } },
        _avg: { characterCount: true },
      });

      return NextResponse.json({
        voices: {
          list: voices,
          totalClips,
          clipsLinked: totalLinked,
          conversionRate: totalClips > 0 ? ((totalLinked / totalClips) * 100).toFixed(1) : "0",
          avgCharsPerClip: Math.round(avgCharsPerClip._avg.characterCount || 0),
          topVoice: voices[0]?.name || "N/A",
          topVoiceRevenue: voices[0]?.revenueDriven || 0,
        },
      });
    }

    if (section === "audit") {
      const sales = await prisma.ai_voice_sales.findMany({
        where: orgSalesWhere,
        orderBy: { createdAt: "desc" },
        include: {
          generation: {
            select: { id: true, voiceName: true, voiceAccountId: true },
          },
        },
      });

      return NextResponse.json({
        audit: {
          sales: sales.map((s) => ({
            id: s.id,
            chatter: s.chatter,
            fanUsername: s.fanUsername,
            saleType: s.saleType,
            amount: s.amount,
            platformCut: s.platformCut,
            netEarned: s.netEarned,
            voiceName: s.generation?.voiceName || null,
            generationId: s.generation?.id || null,
            voiceClipId: s.voiceClipId,
            notes: s.notes,
            screenshotUrl: s.screenshotUrl,
            submittedBy: s.submittedBy,
            createdAt: s.createdAt,
          })),
        },
      });
    }

    if (section === "commissions") {
      // Get chatter data with their average platform cuts
      const chatterData = await prisma.ai_voice_sales.groupBy({
        by: ["chatter"],
        where: orgSalesWhere,
        _sum: { amount: true, netEarned: true },
        _avg: { platformCut: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
      });

      return NextResponse.json({
        commissions: chatterData.map((c) => ({
          chatter: c.chatter,
          gross: c._sum.amount || 0,
          net: c._sum.netEarned || 0,
          salesCount: c._count,
          avgPlatformCut: Math.round(c._avg.platformCut || 20),
        })),
      });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error("Failed to fetch voice admin dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
