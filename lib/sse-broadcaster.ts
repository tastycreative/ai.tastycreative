/**
 * SSE (Server-Sent Events) Broadcaster
 * Manages real-time push notifications for generation job updates
 * 
 * This replaces polling with efficient server-push architecture:
 * - Clients connect once via EventSource
 * - Server pushes updates only when jobs change
 * - Automatic reconnection and connection management
 */

type SSEClient = {
  userId: string;
  controller: ReadableStreamDefaultController;
  generationType?: string; // Optional filter
};

class SSEBroadcaster {
  private clients: Map<string, SSEClient[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Send heartbeat every 30 seconds to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
  }

  /**
   * Register a new SSE client connection
   */
  addClient(userId: string, controller: ReadableStreamDefaultController, generationType?: string) {
    const clientId = this.generateClientId();
    const client: SSEClient = { userId, controller, generationType };

    if (!this.clients.has(userId)) {
      this.clients.set(userId, []);
    }

    this.clients.get(userId)!.push(client);

    console.log(`📡 SSE client connected: ${userId} (${generationType || 'all types'}) - Total: ${this.getTotalClients()}`);

    return clientId;
  }

  /**
   * Remove a client connection
   */
  removeClient(userId: string, controller: ReadableStreamDefaultController) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const filtered = userClients.filter(c => c.controller !== controller);
      if (filtered.length === 0) {
        this.clients.delete(userId);
      } else {
        this.clients.set(userId, filtered);
      }
      console.log(`📡 SSE client disconnected: ${userId} - Remaining: ${this.getTotalClients()}`);
    }
  }

  /**
   * Broadcast job update to specific user
   */
  broadcastToUser(userId: string, data: any, generationType?: string) {
    const userClients = this.clients.get(userId);
    if (!userClients || userClients.length === 0) {
      return; // No clients connected for this user
    }

    const message = `data: ${JSON.stringify(data)}\n\n`;
    const encoder = new TextEncoder();
    const encoded = encoder.encode(message);

    const deadClients: ReadableStreamDefaultController[] = [];

    for (const client of userClients) {
      // Filter by generation type if specified
      if (generationType && client.generationType && client.generationType !== generationType) {
        continue;
      }

      try {
        client.controller.enqueue(encoded);
      } catch (error) {
        // Client disconnected, mark for removal
        deadClients.push(client.controller);
      }
    }

    // Clean up dead clients
    if (deadClients.length > 0) {
      const filtered = userClients.filter(c => !deadClients.includes(c.controller));
      if (filtered.length === 0) {
        this.clients.delete(userId);
      } else {
        this.clients.set(userId, filtered);
      }
    }
  }

  /**
   * Broadcast to all connected clients (admin use case)
   */
  broadcastToAll(data: any) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    const encoder = new TextEncoder();
    const encoded = encoder.encode(message);

    for (const [userId, userClients] of this.clients.entries()) {
      for (const client of userClients) {
        try {
          client.controller.enqueue(encoded);
        } catch (error) {
          // Ignore errors, will be cleaned up on next broadcast
        }
      }
    }
  }

  /**
   * Send heartbeat to keep connections alive
   */
  private sendHeartbeat() {
    const message = `: heartbeat\n\n`;
    const encoder = new TextEncoder();
    const encoded = encoder.encode(message);

    const allDeadClients = new Map<string, ReadableStreamDefaultController[]>();

    for (const [userId, userClients] of this.clients.entries()) {
      const deadClients: ReadableStreamDefaultController[] = [];

      for (const client of userClients) {
        try {
          client.controller.enqueue(encoded);
        } catch (error) {
          deadClients.push(client.controller);
        }
      }

      if (deadClients.length > 0) {
        allDeadClients.set(userId, deadClients);
      }
    }

    // Clean up all dead clients
    for (const [userId, deadClients] of allDeadClients.entries()) {
      const userClients = this.clients.get(userId);
      if (userClients) {
        const filtered = userClients.filter(c => !deadClients.includes(c.controller));
        if (filtered.length === 0) {
          this.clients.delete(userId);
        } else {
          this.clients.set(userId, filtered);
        }
      }
    }
  }

  /**
   * Get total number of connected clients
   */
  private getTotalClients(): number {
    let total = 0;
    for (const clients of this.clients.values()) {
      total += clients.length;
    }
    return total;
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection stats (for monitoring/debugging)
   */
  getStats() {
    return {
      totalClients: this.getTotalClients(),
      totalUsers: this.clients.size,
      userBreakdown: Array.from(this.clients.entries()).map(([userId, clients]) => ({
        userId,
        connections: clients.length,
      })),
    };
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.clients.clear();
  }
}

// Singleton instance
export const sseBroadcaster = new SSEBroadcaster();

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => sseBroadcaster.destroy());
  process.on('SIGINT', () => sseBroadcaster.destroy());
}
