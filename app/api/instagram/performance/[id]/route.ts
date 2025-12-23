// app/api/instagram/performance/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// DELETE: Remove a performance metric
export async function DELETE(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Derive id from the request URL
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1];

    // Verify ownership
    const existingMetric = await prisma.performanceMetric.findUnique({
      where: { id },
    });

    if (!existingMetric) {
      return NextResponse.json(
        { error: "Performance metric not found" },
        { status: 404 }
      );
    }

    if (existingMetric.clerkId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.performanceMetric.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Performance metric deleted successfully" });
  } catch (error) {
    console.error("Error deleting performance metric:", error);
    return NextResponse.json(
      { error: "Failed to delete performance metric" },
      { status: 500 }
    );
  }
}
