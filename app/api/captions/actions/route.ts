import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// PATCH - Update caption actions (toggle favorite, track usage, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json(
        { error: "Caption ID and action are required" },
        { status: 400 }
      );
    }

    // Verify caption belongs to user
    const existingCaption = await prisma.caption.findFirst({
      where: {
        id,
        clerkId: userId,
      },
    });

    if (!existingCaption) {
      return NextResponse.json(
        { error: "Caption not found or unauthorized" },
        { status: 404 }
      );
    }

    let updatedCaption;

    switch (action) {
      case "toggleFavorite":
        updatedCaption = await prisma.caption.update({
          where: { id },
          data: {
            isFavorite: !existingCaption.isFavorite,
          },
        });
        break;

      case "trackUsage":
        updatedCaption = await prisma.caption.update({
          where: { id },
          data: {
            usageCount: existingCaption.usageCount + 1,
            lastUsedAt: new Date(),
          },
        });
        break;

      case "resetUsage":
        updatedCaption = await prisma.caption.update({
          where: { id },
          data: {
            usageCount: 0,
            lastUsedAt: null,
          },
        });
        break;

      case "updateCooldown":
        const { cooldownDays } = body;
        if (typeof cooldownDays !== "number" || cooldownDays < 0) {
          return NextResponse.json(
            { error: "Valid cooldown days required" },
            { status: 400 }
          );
        }
        updatedCaption = await prisma.caption.update({
          where: { id },
          data: {
            cooldownDays,
          },
        });
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    return NextResponse.json(updatedCaption);
  } catch (error) {
    console.error("Error updating caption action:", error);
    return NextResponse.json(
      { error: "Failed to update caption" },
      { status: 500 }
    );
  }
}

// GET - Get caption statistics
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { error: "Profile ID is required" },
        { status: 400 }
      );
    }

    // Verify profile belongs to user
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        clerkId: userId,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found or unauthorized" },
        { status: 404 }
      );
    }

    // Get statistics
    const totalCaptions = await prisma.caption.count({
      where: { profileId, clerkId: userId },
    });

    const favoriteCaptions = await prisma.caption.count({
      where: { profileId, clerkId: userId, isFavorite: true },
    });

    const totalUsage = await prisma.caption.aggregate({
      where: { profileId, clerkId: userId },
      _sum: { usageCount: true },
    });

    // Get most used captions
    const mostUsed = await prisma.caption.findMany({
      where: { profileId, clerkId: userId, usageCount: { gt: 0 } },
      orderBy: { usageCount: "desc" },
      take: 5,
      select: {
        id: true,
        caption: true,
        usageCount: true,
        captionCategory: true,
      },
    });

    // Get recently used captions
    const recentlyUsed = await prisma.caption.findMany({
      where: { profileId, clerkId: userId, lastUsedAt: { not: null } },
      orderBy: { lastUsedAt: "desc" },
      take: 5,
      select: {
        id: true,
        caption: true,
        lastUsedAt: true,
        usageCount: true,
        captionCategory: true,
      },
    });

    // Get captions in cooldown (used within their cooldown period)
    const now = new Date();
    const captionsWithCooldown = await prisma.caption.findMany({
      where: { 
        profileId, 
        clerkId: userId, 
        lastUsedAt: { not: null },
      },
      select: {
        id: true,
        caption: true,
        lastUsedAt: true,
        cooldownDays: true,
        captionCategory: true,
      },
    });

    const captionsInCooldown = captionsWithCooldown.filter(c => {
      if (!c.lastUsedAt) return false;
      const cooldownEnd = new Date(c.lastUsedAt);
      cooldownEnd.setDate(cooldownEnd.getDate() + c.cooldownDays);
      return cooldownEnd > now;
    }).map(c => ({
      ...c,
      cooldownEndsAt: (() => {
        const end = new Date(c.lastUsedAt!);
        end.setDate(end.getDate() + c.cooldownDays);
        return end;
      })(),
    }));

    // Get category breakdown
    const categoryStats = await prisma.caption.groupBy({
      by: ["captionCategory"],
      where: { profileId, clerkId: userId },
      _count: { id: true },
      _sum: { usageCount: true },
    });

    // Get type breakdown
    const typeStats = await prisma.caption.groupBy({
      by: ["captionTypes"],
      where: { profileId, clerkId: userId },
      _count: { id: true },
    });

    // Get bank breakdown
    const bankStats = await prisma.caption.groupBy({
      by: ["captionBanks"],
      where: { profileId, clerkId: userId },
      _count: { id: true },
    });

    return NextResponse.json({
      totalCaptions,
      favoriteCaptions,
      totalUsage: totalUsage._sum.usageCount || 0,
      mostUsed,
      recentlyUsed,
      captionsInCooldown,
      categoryStats: categoryStats.map(c => ({
        category: c.captionCategory,
        count: c._count.id,
        totalUsage: c._sum.usageCount || 0,
      })),
      typeStats: typeStats.map(t => ({
        type: t.captionTypes,
        count: t._count.id,
      })),
      bankStats: bankStats.map(b => ({
        bank: b.captionBanks,
        count: b._count.id,
      })),
    });
  } catch (error) {
    console.error("Error fetching caption stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
