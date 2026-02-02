import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { addSSEClient, removeSSEClient } from '@/lib/post-change-tracker';

// GET - Server-Sent Events stream
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get user's role
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }
    });

    const isAdmin = user && user.role === 'ADMIN';

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        // Store this client
        const clientId = `${userId}-${Date.now()}`;
        addSSEClient(clientId, controller);

        // Send initial connection message
        controller.enqueue(`data: ${JSON.stringify({ type: 'connected', role: user?.role })}\n\n`);

        // Heartbeat to keep connection alive
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(`: heartbeat\n\n`);
          } catch {
            clearInterval(heartbeat);
            removeSSEClient(clientId);
          }
        }, 30000); // Every 30 seconds

        // Cleanup on disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          removeSSEClient(clientId);
          try {
            controller.close();
          } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('❌ Error in SSE stream:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
