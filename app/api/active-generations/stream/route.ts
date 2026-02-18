import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { sseBroadcaster } from "@/lib/sse-broadcaster";

/**
 * GET /api/active-generations/stream
 * Server-Sent Events (SSE) endpoint for real-time generation updates
 * 
 * Replaces polling with efficient server-push:
 * - Client connects once via EventSource
 * - Server pushes updates only when jobs change
 * - Automatic reconnection on disconnect
 * 
 * Query params:
 * - type: Optional generation type filter
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Optional: filter by generation type
    const searchParams = request.nextUrl.searchParams;
    const generationType = searchParams.get("type") || undefined;

    console.log(`📡 SSE stream requested by ${userId}${generationType ? ` for ${generationType}` : ''}`);

    // Create SSE stream
    const stream = new ReadableStream({
      start: async (controller) => {
        // Register client with broadcaster
        sseBroadcaster.addClient(userId, controller, generationType);

        // Send initial connection message
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`)
        );

        // Send heartbeat every 30 seconds to keep connection alive
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(
              encoder.encode(`: heartbeat\n\n`)
            );
          } catch (e) {
            clearInterval(heartbeatInterval);
          }
        }, 30000);

        // Send initial job state immediately
        try {
          const where: any = { clerkId: userId };
          if (generationType) {
            where.generationType = generationType;
          }

          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          
          const jobs = await prisma.activeGeneration.findMany({
            where: {
              ...where,
              OR: [
                { status: { in: ["PENDING", "PROCESSING"] } },
                {
                  status: { in: ["COMPLETED", "FAILED"] },
                  completedAt: { gte: oneDayAgo },
                },
              ],
            },
            orderBy: [
              { completedAt: "desc" }, // Newest completed jobs first
              { startedAt: "desc" },   // Then by start time for pending/processing jobs
            ],
            take: 50,
          });

          // Send initial state
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'initial', jobs })}\n\n`)
          );

          console.log(`📡 Sent initial state to ${userId}: ${jobs.length} jobs`);
        } catch (error) {
          console.error("Failed to fetch initial jobs for SSE:", error);
        }

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          console.log(`📡 SSE client disconnected (abort): ${userId}`);
          clearInterval(heartbeatInterval);
          sseBroadcaster.removeClient(userId, controller);
          try {
            controller.close();
          } catch (e) {
            // Already closed
          }
        });
      },
      cancel: (controller) => {
        console.log(`📡 SSE stream cancelled: ${userId}`);
        sseBroadcaster.removeClient(userId, controller);
      },
    });

    // Return SSE response with proper headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });

  } catch (error: any) {
    console.error("SSE stream error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to establish SSE connection" }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
