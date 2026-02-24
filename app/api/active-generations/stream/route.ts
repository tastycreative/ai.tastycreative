import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { sseBroadcaster } from "@/lib/sse-broadcaster";

// Vercel has a 60s timeout for Hobby, 300s for Pro with streaming
// Close gracefully at 50s to avoid timeout errors
const SSE_TIMEOUT_MS = 50000;
const HEARTBEAT_INTERVAL_MS = 15000; // More frequent heartbeats

/**
 * GET /api/active-generations/stream
 * Server-Sent Events (SSE) endpoint for real-time generation updates
 * 
 * Replaces polling with efficient server-push:
 * - Client connects once via EventSource
 * - Server pushes updates only when jobs change
 * - Automatic reconnection on disconnect
 * - Gracefully closes before Vercel timeout (50s) to avoid errors
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

    const encoder = new TextEncoder();
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let isClosed = false;

    // Create SSE stream
    const stream = new ReadableStream({
      start: async (controller) => {
        const cleanup = () => {
          if (isClosed) return;
          isClosed = true;
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          if (timeoutTimer) clearTimeout(timeoutTimer);
          sseBroadcaster.removeClient(userId, controller);
        };

        // Register client with broadcaster
        sseBroadcaster.addClient(userId, controller, generationType);

        // Send initial connection message
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`)
          );
        } catch (e) {
          cleanup();
          return;
        }

        // Send heartbeat every 15 seconds to keep connection alive
        heartbeatInterval = setInterval(() => {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          } catch (e) {
            cleanup();
          }
        }, HEARTBEAT_INTERVAL_MS);

        // Set timeout to gracefully close before Vercel's limit
        timeoutTimer = setTimeout(() => {
          if (isClosed) return;
          try {
            // Send reconnect event so client knows to reconnect
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'reconnect', message: 'Connection timeout, please reconnect' })}\n\n`)
            );
            controller.close();
          } catch (e) {
            // Already closed
          }
          cleanup();
          console.log(`📡 SSE timeout reached, gracefully closing for ${userId}`);
        }, SSE_TIMEOUT_MS);

        // Send initial job state immediately
        try {
          const where: Record<string, unknown> = { clerkId: userId };
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
          if (!isClosed) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'initial', jobs })}\n\n`)
            );
            console.log(`📡 Sent initial state to ${userId}: ${jobs.length} jobs`);
          }
        } catch (error) {
          console.error("Failed to fetch initial jobs for SSE:", error);
        }

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          console.log(`📡 SSE client disconnected (abort): ${userId}`);
          cleanup();
          try {
            controller.close();
          } catch (e) {
            // Already closed
          }
        });
      },
      cancel: () => {
        console.log(`📡 SSE stream cancelled: ${userId}`);
        isClosed = true;
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        if (timeoutTimer) clearTimeout(timeoutTimer);
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

  } catch (error: unknown) {
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
