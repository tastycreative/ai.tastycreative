import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET - List shares for a folder
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: folderId } = await params;

    // Verify folder ownership
    const folder = await prisma.reference_folders.findFirst({
      where: { id: folderId, clerkId: userId },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const shares = await prisma.reference_folder_shares.findMany({
      where: { folderId },
      orderBy: { createdAt: "desc" },
    });

    // Enrich with org/team names
    const orgIds = [...new Set(shares.map((s) => s.organizationId))];
    const teamIds = shares.map((s) => s.orgTeamId).filter(Boolean) as string[];

    const [orgs, teams] = await Promise.all([
      prisma.organization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true, slug: true, logoUrl: true },
      }),
      teamIds.length > 0
        ? prisma.orgTeam.findMany({
            where: { id: { in: teamIds } },
            select: { id: true, name: true, color: true },
          })
        : Promise.resolve([]),
    ]);

    const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o]));
    const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));

    const enrichedShares = shares.map((s) => ({
      ...s,
      organization: orgMap[s.organizationId] || null,
      orgTeam: s.orgTeamId ? teamMap[s.orgTeamId] || null : null,
    }));

    return NextResponse.json({ shares: enrichedShares });
  } catch (error) {
    console.error("Error fetching folder shares:", error);
    return NextResponse.json(
      { error: "Failed to fetch shares" },
      { status: 500 }
    );
  }
}

// POST - Share folder with an organization (or team)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: folderId } = await params;
    const body = await req.json();
    const { organizationId, orgTeamId, permission } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    // Verify folder ownership
    const folder = await prisma.reference_folders.findFirst({
      where: { id: folderId, clerkId: userId },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Verify the sharer is a member of the target organization
    const membership = await prisma.teamMember.findFirst({
      where: {
        organizationId,
        user: { clerkId: userId },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You must be a member of the organization to share with it" },
        { status: 403 }
      );
    }

    // Upsert the share — Prisma compound unique can't accept null,
    // so we branch on whether orgTeamId is provided.
    let share;
    if (orgTeamId) {
      share = await prisma.reference_folder_shares.upsert({
        where: {
          folderId_organizationId_orgTeamId: {
            folderId,
            organizationId,
            orgTeamId,
          },
        },
        update: {
          permission: permission || "VIEW",
        },
        create: {
          folderId,
          organizationId,
          sharedByClerkId: userId,
          orgTeamId,
          permission: permission || "VIEW",
        },
      });
    } else {
      const existing = await prisma.reference_folder_shares.findFirst({
        where: { folderId, organizationId, orgTeamId: null },
      });
      if (existing) {
        share = await prisma.reference_folder_shares.update({
          where: { id: existing.id },
          data: { permission: permission || "VIEW" },
        });
      } else {
        share = await prisma.reference_folder_shares.create({
          data: {
            folderId,
            organizationId,
            sharedByClerkId: userId,
            orgTeamId: null,
            permission: permission || "VIEW",
          },
        });
      }
    }

    return NextResponse.json({ share });
  } catch (error) {
    console.error("Error sharing folder:", error);
    return NextResponse.json(
      { error: "Failed to share folder" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a share
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: folderId } = await params;
    const { searchParams } = new URL(req.url);
    const shareId = searchParams.get("shareId");

    if (!shareId) {
      return NextResponse.json(
        { error: "shareId is required" },
        { status: 400 }
      );
    }

    // Verify folder ownership
    const folder = await prisma.reference_folders.findFirst({
      where: { id: folderId, clerkId: userId },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    await prisma.reference_folder_shares.delete({
      where: { id: shareId, folderId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing share:", error);
    return NextResponse.json(
      { error: "Failed to remove share" },
      { status: 500 }
    );
  }
}
