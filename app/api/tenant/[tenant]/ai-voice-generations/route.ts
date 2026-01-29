import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { requireOrganizationAdmin } from "@/lib/organizationAuth";

// Force Node.js runtime
export const runtime = 'nodejs';

// Helper to get date filter
function getDateFilter(dateRange: string | null) {
  const now = new Date();

  switch (dateRange) {
    case "today":
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { gte: todayStart };
    case "week":
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      return { gte: weekStart };
    case "month":
      const monthStart = new Date(now);
      monthStart.setDate(now.getDate() - 30);
      return { gte: monthStart };
    default:
      return undefined;
  }
}

// GET - Fetch all generations with stats (organization-scoped)
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

    // Check organization admin access
    await requireOrganizationAdmin(tenant);

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { slug: tenant },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get all organization member clerkIds
    const members = await prisma.teamMember.findMany({
      where: { organizationId: organization.id },
      include: { user: { select: { clerkId: true } } },
    });

    const memberClerkIds = members.map(m => m.user.clerkId);

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const dateRange = searchParams.get("dateRange");
    const userIdFilter = searchParams.get("userId");
    const voiceAccountId = searchParams.get("voiceAccountId");
    const search = searchParams.get("search");
    const topUsersTimeRange = searchParams.get("topUsersTimeRange") || "month";
    const exportData = searchParams.get("export") === "true";

    // Build where clause for generations - filter by organization members
    const dateFilter = getDateFilter(dateRange);
    const whereClause: Record<string, unknown> = {
      userId: { in: memberClerkIds }, // Only show generations by organization members
    };

    if (dateFilter) {
      whereClause.createdAt = dateFilter;
    }
    if (userIdFilter && memberClerkIds.includes(userIdFilter)) {
      whereClause.userId = userIdFilter; // Override with specific user if they're a member
    }
    if (voiceAccountId) {
      whereClause.voiceAccountId = voiceAccountId;
    }
    if (search) {
      whereClause.OR = [
        { text: { contains: search, mode: "insensitive" } },
        { voiceName: { contains: search, mode: "insensitive" } },
      ];
    }

    // If export, return CSV
    if (exportData) {
      const allGenerations = await prisma.ai_voice_generations.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          voiceName: true,
          text: true,
          characterCount: true,
          modelId: true,
          outputFormat: true,
          createdAt: true,
        },
      });

      // Get user details for export
      const userIds = [...new Set(allGenerations.map((g) => g.userId))];
      const client = await clerkClient();
      const users = await Promise.all(
        userIds.map(async (uid) => {
          try {
            const user = await client.users.getUser(uid);
            return {
              id: uid,
              email: user.emailAddresses?.[0]?.emailAddress || "N/A",
              name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "N/A",
            };
          } catch {
            return { id: uid, email: "N/A", name: "N/A" };
          }
        })
      );
      const userMap = new Map(users.map((u) => [u.id, u]));

      // Generate CSV
      const csvHeaders = ["ID", "User ID", "User Email", "User Name", "Voice Name", "Text", "Characters", "Model", "Format", "Created At"];
      const csvRows = allGenerations.map((g) => {
        const user = userMap.get(g.userId);
        return [
          g.id,
          g.userId,
          user?.email || "N/A",
          user?.name || "N/A",
          g.voiceName,
          `"${g.text.replace(/"/g, '""')}"`,
          g.characterCount.toString(),
          g.modelId,
          g.outputFormat,
          g.createdAt.toISOString(),
        ].join(",");
      });

      const csv = [csvHeaders.join(","), ...csvRows].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="voice-generations-${organization.slug}-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // Fetch generations with pagination
    const [generations, totalCount] = await Promise.all([
      prisma.ai_voice_generations.findMany({
        where: whereClause,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          ai_voice_accounts: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.ai_voice_generations.count({ where: whereClause }),
    ]);

    // Get user details for generations
    const userIds = [...new Set(generations.map((g) => g.userId))];
    const client = await clerkClient();
    const users = await Promise.all(
      userIds.map(async (uid) => {
        try {
          const user = await client.users.getUser(uid);
          return {
            id: uid,
            email: user.emailAddresses?.[0]?.emailAddress || "Unknown",
            name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown User",
          };
        } catch {
          return { id: uid, email: "Unknown", name: "Unknown User" };
        }
      })
    );
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Enrich generations with user info
    const enrichedGenerations = generations.map((g) => {
      const user = userMap.get(g.userId);
      return {
        ...g,
        userEmail: user?.email,
        userName: user?.name,
      };
    });

    // Calculate stats - ONLY for organization members
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now);
    monthStart.setDate(now.getDate() - 30);

    const baseStatsWhere = { userId: { in: memberClerkIds } };

    const [
      totalGenerations,
      totalCreditsResult,
      activeUsersResult,
      generationsToday,
      generationsThisWeek,
      generationsThisMonth,
    ] = await Promise.all([
      prisma.ai_voice_generations.count({ where: baseStatsWhere }),
      prisma.ai_voice_generations.aggregate({
        where: baseStatsWhere,
        _sum: { characterCount: true },
      }),
      prisma.ai_voice_generations.groupBy({
        by: ["userId"],
        where: baseStatsWhere,
      }),
      prisma.ai_voice_generations.count({
        where: { ...baseStatsWhere, createdAt: { gte: todayStart } },
      }),
      prisma.ai_voice_generations.count({
        where: { ...baseStatsWhere, createdAt: { gte: weekStart } },
      }),
      prisma.ai_voice_generations.count({
        where: { ...baseStatsWhere, createdAt: { gte: monthStart } },
      }),
    ]);

    const totalCreditsUsed = totalCreditsResult._sum.characterCount || 0;
    const activeUsers = activeUsersResult.length;
    const avgCreditsPerGeneration = totalGenerations > 0
      ? Math.round(totalCreditsUsed / totalGenerations)
      : 0;

    // Get top users based on time range - ONLY organization members
    const topUsersDateFilter = getDateFilter(topUsersTimeRange);
    const topUsersWhere = topUsersDateFilter
      ? { ...baseStatsWhere, createdAt: topUsersDateFilter }
      : { ...baseStatsWhere };

    const topUsersData = await prisma.ai_voice_generations.groupBy({
      by: ["userId"],
      where: topUsersWhere,
      _count: { id: true },
      _sum: { characterCount: true },
      _max: { createdAt: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    });

    // Enrich top users with user details
    const topUsersWithDetails = await Promise.all(
      topUsersData.map(async (u) => {
        let userInfo = { email: "Unknown", name: "Unknown User" };
        try {
          const user = await client.users.getUser(u.userId);
          userInfo = {
            email: user.emailAddresses?.[0]?.emailAddress || "Unknown",
            name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown User",
          };
        } catch {
          // User not found, use defaults
        }
        return {
          userId: u.userId,
          userEmail: userInfo.email,
          userName: userInfo.name,
          totalGenerations: u._count.id,
          totalCreditsUsed: u._sum.characterCount || 0,
          lastGenerationAt: u._max.createdAt?.toISOString() || "",
        };
      })
    );

    // Get voice models for filter - ONLY voices used by organization members
    const voiceModels = await prisma.ai_voice_accounts.findMany({
      where: {
        ai_voice_generations: {
          some: {
            userId: { in: memberClerkIds },
          },
        },
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            ai_voice_generations: {
              where: { userId: { in: memberClerkIds } },
            },
          },
        },
      },
      orderBy: {
        ai_voice_generations: {
          _count: "desc",
        },
      },
    });

    const voiceModelsFormatted = voiceModels.map((v) => ({
      id: v.id,
      name: v.name,
      generationCount: v._count.ai_voice_generations,
    }));

    return NextResponse.json({
      stats: {
        totalGenerations,
        totalCreditsUsed,
        activeUsers,
        avgCreditsPerGeneration,
        generationsToday,
        generationsThisWeek,
        generationsThisMonth,
      },
      topUsers: topUsersWithDetails,
      generations: enrichedGenerations,
      voiceModels: voiceModelsFormatted,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      page,
    });
  } catch (error: any) {
    console.error("Error fetching generation data:", error);

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to fetch generation data" },
      { status: 500 }
    );
  }
}
