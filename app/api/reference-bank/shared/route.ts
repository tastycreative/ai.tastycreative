import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { convertS3ToCdnUrl } from "@/lib/cdnUtils";

// GET - List folders shared with the current user's organizations
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get("organizationId");
    const folderId = searchParams.get("folderId"); // fetch items from a specific shared folder

    // Find all organizations the user belongs to
    const memberships = await prisma.teamMember.findMany({
      where: {
        user: { clerkId: userId },
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        orgTeamMemberships: {
          select: { teamId: true },
        },
      },
    });

    if (memberships.length === 0) {
      return NextResponse.json({ sharedFolders: [], items: [] });
    }

    const orgIds = memberships.map((m) => m.organizationId);
    const teamIds = memberships.flatMap((m) =>
      m.orgTeamMemberships.map((otm) => otm.teamId)
    );

    // If requesting items from a specific shared folder
    if (folderId) {
      // Verify the user has access to this shared folder
      const share = await prisma.reference_folder_shares.findFirst({
        where: {
          folderId,
          OR: [
            // Shared with an org the user belongs to (whole org share)
            { organizationId: { in: orgIds }, orgTeamId: null },
            // Shared with a specific team the user is on
            ...(teamIds.length > 0
              ? [{ orgTeamId: { in: teamIds } }]
              : []),
          ],
        },
      });

      if (!share) {
        return NextResponse.json(
          { error: "No access to this shared folder" },
          { status: 403 }
        );
      }

      const items = await prisma.reference_items.findMany({
        where: { folderId },
        include: {
          folder: { select: { id: true, name: true, color: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      // Convert S3 URLs to CDN
      const cdnItems = items.map((item) => ({
        ...item,
        awsS3Url: convertS3ToCdnUrl(item.awsS3Url),
        thumbnailUrl: item.thumbnailUrl
          ? convertS3ToCdnUrl(item.thumbnailUrl)
          : null,
      }));

      return NextResponse.json({
        items: cdnItems,
        permission: share.permission,
      });
    }

    // Otherwise, list all shared folders available to the user
    const shares = await prisma.reference_folder_shares.findMany({
      where: {
        OR: [
          { organizationId: { in: orgIds }, orgTeamId: null },
          ...(teamIds.length > 0
            ? [{ orgTeamId: { in: teamIds } }]
            : []),
        ],
        // Don't return shares for own folders
        NOT: { sharedByClerkId: userId },
      },
      include: {
        folder: {
          include: {
            _count: { select: { items: true } },
            user: {
              select: { firstName: true, lastName: true, username: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Also include own folders that have been shared (so owner can see share status)
    const ownShares = await prisma.reference_folder_shares.findMany({
      where: { sharedByClerkId: userId },
      select: { folderId: true },
    });
    const ownSharedFolderIds = new Set(ownShares.map((s) => s.folderId));

    // Deduplicate by folderId (a folder might be shared via multiple teams)
    const seen = new Set<string>();
    const sharedFolders = shares
      .filter((s) => {
        if (seen.has(s.folderId)) return false;
        seen.add(s.folderId);
        return true;
      })
      .map((s) => ({
        id: s.folder.id,
        name: s.folder.name,
        description: s.folder.description,
        color: s.folder.color,
        icon: s.folder.icon,
        itemCount: s.folder._count.items,
        permission: s.permission,
        sharedBy: s.folder.user
          ? `${s.folder.user.firstName || ""} ${s.folder.user.lastName || ""}`.trim() ||
            s.folder.user.username ||
            "Unknown"
          : "Unknown",
        organizationId: s.organizationId,
        orgTeamId: s.orgTeamId,
        createdAt: s.createdAt,
      }));

    return NextResponse.json({
      sharedFolders,
      ownSharedFolderIds: Array.from(ownSharedFolderIds),
    });
  } catch (error) {
    console.error("Error fetching shared folders:", error);
    return NextResponse.json(
      { error: "Failed to fetch shared folders" },
      { status: 500 }
    );
  }
}
