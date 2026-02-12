import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

/**
 * GET /api/active-generations
 * Fetch all active generation jobs for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Optional: filter by generation type
    const searchParams = request.nextUrl.searchParams;
    const generationType = searchParams.get("type");

    const where: any = { clerkId: userId };
    
    // Optionally filter by generation type
    if (generationType) {
      where.generationType = generationType;
    }

    // Get active jobs (not older than 24 hours for completed/failed)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const jobs = await prisma.activeGeneration.findMany({
      where: {
        ...where,
        OR: [
          // Keep all pending/processing jobs
          { status: { in: ["PENDING", "PROCESSING"] } },
          // Keep completed/failed jobs from last 24 hours
          {
            status: { in: ["COMPLETED", "FAILED"] },
            completedAt: { gte: oneDayAgo },
          },
        ],
      },
      orderBy: { startedAt: "desc" },
      take: 50, // Limit to recent 50 jobs
    });

    return NextResponse.json({ jobs });
  } catch (error: any) {
    console.error("Failed to fetch active generations:", error);
    return NextResponse.json(
      { error: "Failed to fetch active generations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/active-generations
 * Create or update an active generation job
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      jobId,
      generationType,
      progress,
      stage,
      message,
      status,
      metadata,
      results,
      error: jobError,
      startedAt,
      completedAt,
      elapsedTime,
      estimatedTimeRemaining,
    } = body;

    if (!jobId || !generationType) {
      return NextResponse.json(
        { error: "Missing required fields: jobId, generationType" },
        { status: 400 }
      );
    }

    // Upsert the job (create or update)
    const job = await prisma.activeGeneration.upsert({
      where: { jobId },
      create: {
        clerkId: userId,
        jobId,
        generationType,
        progress: progress ?? 0,
        stage: stage ?? "starting",
        message: message ?? "Starting generation...",
        status: status ?? "PENDING",
        metadata,
        results,
        error: jobError,
        startedAt: startedAt ? new Date(startedAt) : undefined,
        completedAt: completedAt ? new Date(completedAt) : undefined,
        elapsedTime,
        estimatedTimeRemaining,
      },
      update: {
        progress: progress ?? undefined,
        stage: stage ?? undefined,
        message: message ?? undefined,
        status: status ?? undefined,
        metadata,
        results,
        error: jobError,
        completedAt: completedAt ? new Date(completedAt) : undefined,
        elapsedTime,
        estimatedTimeRemaining,
      },
    });

    return NextResponse.json({ job });
  } catch (error: any) {
    console.error("Failed to save active generation:", error);
    return NextResponse.json(
      { error: "Failed to save active generation" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/active-generations
 * Delete active generation jobs (by jobId or clear all completed)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get("jobId");
    const clearCompleted = searchParams.get("clearCompleted") === "true";
    const generationType = searchParams.get("type");

    if (jobId) {
      // Delete specific job
      await prisma.activeGeneration.deleteMany({
        where: {
          clerkId: userId,
          jobId,
        },
      });
      return NextResponse.json({ success: true, deleted: 1 });
    }

    if (clearCompleted) {
      // Clear completed/failed jobs for specific generation type
      const where: any = {
        clerkId: userId,
        status: { in: ["COMPLETED", "FAILED"] },
      };

      if (generationType) {
        where.generationType = generationType;
      }

      const result = await prisma.activeGeneration.deleteMany({ where });
      return NextResponse.json({ success: true, deleted: result.count });
    }

    return NextResponse.json(
      { error: "Must provide jobId or clearCompleted=true" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Failed to delete active generations:", error);
    return NextResponse.json(
      { error: "Failed to delete active generations" },
      { status: 500 }
    );
  }
}
